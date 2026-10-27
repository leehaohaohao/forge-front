import {readSourceFile} from './migration-source';
import {migrate,RateLimitError,type MigrationJournal} from './migration-core';
import type {MigrationRequest,MigrationReply,MigrationProgress} from './migration-protocol';
import type { VaultCommand, PreparedVault, VaultConfig } from './types';
import { VaultError } from './types';
import { decimal, requireThat, validateVault, validateRecovery, validateContext } from './format';
import { importAes, wrapVault, unwrapPassword, unwrapRecovery, encryptSecret, decryptSecret } from './crypto';

let vk: CryptoKey | undefined;
let identity: string | undefined;
let current: VaultConfig | undefined;
let pending: { vault: VaultConfig; digest: Uint8Array<ArrayBuffer>; confirmed: boolean } | undefined;
let bridgeSerial=0;
const bridgeWaiters=new Map<number,(reply:MigrationReply)=>void>();
const bridge=(request:MigrationRequest)=>new Promise<any>((resolve,reject)=>{
  const id=++bridgeSerial;bridgeWaiters.set(id,reply=>{if(reply.ok)resolve(reply.value);else reject(reply.retryAfterMs!==undefined?new RateLimitError(reply.retryAfterMs):new VaultError(reply.code));});
  self.postMessage({kind:'migration-request',id,request});
});
let journal:MigrationJournal={},journalBatch='';
let progress:MigrationProgress={staged:0,verified:0,total:0};
const report=(p:MigrationProgress)=>{progress=p;self.postMessage({kind:'migration-progress',progress:p});};
const digest = async (bytes: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
async function adopt(user: string, vault: VaultConfig, raw: Uint8Array<ArrayBuffer>) {
  const key = await importAes(raw);
  vk = key; identity = user; current = vault;
}
async function prepare(user: string, password: string, raw: Uint8Array<ArrayBuffer>, old?: VaultConfig): Promise<PreparedVault> {
  const result = await wrapVault(user,raw,password,old);
  await adopt(user,result.vault,raw);
  pending?.digest.fill(0);
  pending = {vault:result.vault,digest:await digest(raw),confirmed:false};
  return result;
}
async function execute(command: VaultCommand | {action:'activatePrepared'}) {
  if (!crypto?.subtle || typeof WebAssembly === 'undefined') throw new VaultError('UNSUPPORTED');
  switch (command.action) {
    case 'initialize': {
      decimal(command.userId);
      // An initialized worker is never silently replaced, even by a second click.
      if (vk || pending) throw new VaultError('STALE');
      const raw = crypto.getRandomValues(new Uint8Array(32));
      try { return await prepare(command.userId,command.password,raw); }
      finally { raw.fill(0); }
    }
    case 'resumePrepared': {
      decimal(command.userId); validateVault(command.vault);
      if (vk || pending) throw new VaultError('STALE');
      const raw = await unwrapPassword(command.userId,command.vault,command.password);
      try {
        await adopt(command.userId,command.vault,raw);
        pending = {vault:command.vault,digest:await digest(raw),confirmed:false};
        return true;
      } finally { raw.fill(0); }
    }
    case 'unlock': {
      decimal(command.userId); validateVault(command.vault);
      if (pending) throw new VaultError('RECOVERY_UNVERIFIED');
      vk = undefined; current = undefined; identity = undefined;
      let raw: Uint8Array<ArrayBuffer> | undefined;
      try {
        raw = await unwrapPassword(command.userId,command.vault,command.password);
        await adopt(command.userId,command.vault,raw);
        return true;
      } catch { throw new VaultError('UNLOCK_FAILED'); }
      finally { raw?.fill(0); }
    }
    case 'credentials': {
      decimal(command.userId); validateVault(command.vault);
      if (pending) throw new VaultError('RECOVERY_UNVERIFIED');
      requireThat((typeof command.password === 'string') !== (typeof command.recoveryKey === 'string'));
      let raw: Uint8Array<ArrayBuffer>;
      try {
        raw = command.recoveryKey !== undefined
          ? await unwrapRecovery(command.userId,command.vault,command.recoveryKey)
          : await unwrapPassword(command.userId,command.vault,command.password!);
      } catch { throw new VaultError('UNLOCK_FAILED'); }
      try { return await prepare(command.userId,command.newPassword,raw,command.vault); }
      finally { raw.fill(0); }
    }
    case 'verifyRecovery': {
      if (!pending || !identity) throw new VaultError('LOCKED');
      validateRecovery(command.material);
      requireThat(command.material.user_id === identity && command.material.vault_id === pending.vault.vault_id);
      let raw: Uint8Array<ArrayBuffer> | undefined;
      let hash: Uint8Array<ArrayBuffer> | undefined;
      pending.confirmed = false;
      try {
        raw = await unwrapRecovery(identity,pending.vault,command.material.recovery_key);
        hash = await digest(raw);
        let difference = 0;
        for (let i=0;i<hash.length;i++) difference |= hash[i] ^ pending.digest[i];
        requireThat(difference === 0);
        pending.confirmed = true;
        return true;
      } catch { throw new VaultError('UNLOCK_FAILED'); }
      finally { raw?.fill(0); hash?.fill(0); }
    }
    case 'prepared':
      if (!pending?.confirmed) throw new VaultError('RECOVERY_UNVERIFIED');
      return pending.vault;
    case 'activatePrepared':
      if (!pending?.confirmed) throw new VaultError('RECOVERY_UNVERIFIED');
      pending.digest.fill(0); pending = undefined;
      return true;
    case 'migrate': {
      if(!vk||!current||!identity)throw new VaultError('LOCKED');
      if(pending)throw new VaultError('RECOVERY_UNVERIFIED');
      const src=await readSourceFile(command.file);
      requireThat(src.records.length>0&&src.batch.batch_id===command.batchId&&src.batch.user_id===identity&&src.batch.vault_id===current.vault_id);
      if(journalBatch!==command.batchId){journal={};journalBatch=command.batchId;}
      report({staged:0,verified:0,total:src.records.length});
      try {
        return await migrate(src,{...current,user_id:identity},vk,
          (path:string,body?:unknown)=>bridge({kind:'api',path,body}),
          async()=>{await bridge({kind:'reauth'});return 'host-authorized';},
          async ms=>{report({...progress,waitingUntil:Date.now()+ms});await new Promise(r=>setTimeout(r,ms));report({...progress,waitingUntil:undefined});},
          journal,(staged,verified,total)=>report({staged,verified,total}));
      } catch(error){if(error instanceof RateLimitError)throw new VaultError('MIGRATION_RATE_LIMIT');throw error;}
      finally{for(const r of src.records)r.legacy_value='';src.records.length=0;}
    }
    case 'encrypt':
    case 'decrypt': {
      if (!vk || !current || !identity) throw new VaultError('LOCKED');
      if (pending) throw new VaultError('RECOVERY_UNVERIFIED');
      validateContext(command.context);
      requireThat(command.context.user_id === identity && command.context.vault_id === current.vault_id && command.context.vault_key_version === current.vault_key_version);
      return command.action === 'encrypt'
        ? encryptSecret(vk,command.context,command.value,command.wrapCount,command.previousVersion)
        : decryptSecret(vk,command.context,command.envelope);
    }
  }
  throw new VaultError('INVALID_FORMAT');
}
// Serialize KDF and key operations. Locking terminates this whole Worker (including WASM memory).
let chain = Promise.resolve();
self.onmessage = (event: MessageEvent<{id:number; command:VaultCommand; migrationReply?:number;reply?:MigrationReply}>) => {
  if(event.data.migrationReply!==undefined){const resolve=bridgeWaiters.get(event.data.migrationReply);bridgeWaiters.delete(event.data.migrationReply);if(resolve&&event.data.reply)resolve(event.data.reply);return;}
  const {id,command} = event.data;
  chain = chain.then(async () => {
    try { self.postMessage({id,ok:true,value:await execute(command)}); }
    catch (error) { self.postMessage({id,ok:false,code:error instanceof VaultError ? error.code : 'INVALID_FORMAT'}); }
  });
};
