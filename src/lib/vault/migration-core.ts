import { encryptSecret, decryptSecret, importAes, unwrapPassword, unwrapRecovery } from './crypto';
import { decimal, uuid, requireThat, utf8, object, validateEnvelope } from './format';
import {VaultError} from './types';
import { configOf } from './session';
export async function digest(bytes:Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join(''); }
export async function envelopeDigest(e:any) {
  const out:any={};for(const k of ['format_version','vault_id','vault_key_version','secret_id','secret_version','algorithm','ciphertext','nonce','wrapped_dek','wrap_nonce'])out[k]=e[k];
  return digest(utf8(JSON.stringify(out)));
}
export function lines(bytes:Uint8Array) {
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes).trimEnd().split('\n').map(line=>JSON.parse(line));
}
function ordered(records:any[]) {let last=0n;for(const r of records){decimal(r.id);requireThat(BigInt(r.id)>last);last=BigInt(r.id);}}
export function source(bytes:Uint8Array) {
  const [header,...records]=lines(bytes);return sourceRecords(header,records);
}
export function sourceRecords(header:any,records:any[]) {
  object(header,['format','batch']);requireThat(header.format==='forge-migration-source-v1');
  const b=validateBatch(header.batch);requireThat(records.length===b.record_count);ordered(records);
  for(const r of records)validateSourceRecord(r,b);
  return {batch:b,records};
}
export function validateBatch(b:any) {
  object(b,['batch_id','user_id','vault_id','state','revision','record_count','staged_count','verified_count']);
  uuid(b.batch_id);uuid(b.vault_id);decimal(b.user_id);decimal(b.revision);
  requireThat(['frozen','exported','staged','verified','switched','aborted'].includes(b.state));
  for(const k of ['record_count','staged_count','verified_count'])requireThat(Number.isSafeInteger(b[k])&&b[k]>=0);
  requireThat(b.verified_count<=b.staged_count&&b.staged_count<=b.record_count);return b;
}
export function validateSourceRecord(r:any,b:any) {
  object(r,['id','source_revision','metadata','deleted_at','legacy_value']);decimal(r.id);decimal(r.source_revision);
  const m=object(r.metadata,['id','user_id','revision','provider','name','token_type','category','remark','expires_at','created_at','updated_at','has_secret','encryption_state']);
  requireThat(m.id===r.id&&m.revision===r.source_revision&&m.user_id===b.user_id&&m.encryption_state==='legacy_pending'&&m.has_secret===true);
  for(const k of ['provider','name','token_type','category','remark'])requireThat(typeof m[k]==='string');
  for(const t of [r.deleted_at,m.expires_at])requireThat(t===null||(typeof t==='string'&&Number.isFinite(Date.parse(t))));
  for(const t of [m.created_at,m.updated_at])requireThat(typeof t==='string'&&Number.isFinite(Date.parse(t)));
  requireThat(typeof r.legacy_value==='string');const v=utf8(r.legacy_value);
  try{requireThat(v.length>0&&v.length<=8192&&r.legacy_value.trim()&&new TextDecoder('utf-8',{fatal:true}).decode(v)===r.legacy_value);}finally{v.fill(0);}
}

export async function unlock(v:any,password:string,recovery:boolean) {
  const raw=recovery?await unwrapRecovery(v.user_id,configOf(v),password):await unwrapPassword(v.user_id,configOf(v),password);
  try{return await importAes(raw);}finally{raw.fill(0);}
}
const context=(v:any,e:any)=>({user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:e.secret_id,secret_version:e.secret_version});
export async function snapshot(api:any,batch:string,maxRecords=Number.MAX_SAFE_INTEGER) {
  const records:any[]=[];let after:string|undefined,view:any;
  do {const d=await api('/vault/migrations/'+batch+(after?'?after='+after:''));
    validateBatch(d.batch);requireThat(d.batch.batch_id===batch&&d.batch.record_count<=maxRecords);
    if(view){if(JSON.stringify(d.batch)!==JSON.stringify(view))throw new VaultError('MIGRATION_CONFLICT');}else view=d.batch;
    requireThat(Array.isArray(d.records)&&d.records.length<=100&&records.length+d.records.length<=view.record_count);
    records.push(...d.records);const next=d.next_after; if(next!==null){decimal(next);requireThat(d.records.length>0&&next===d.records.at(-1).id&&(!after||BigInt(next)>BigInt(after)));}after=next;
  }while(after);
  ordered(records);requireThat(records.length===view.record_count);return {batch:view,records};
}
function match(s:any,d:any){object(d,['id','source_revision','metadata','deleted_at','secret_envelope','envelope_sha256','verified']);requireThat(typeof d.verified==='boolean' && Object.keys(s.metadata).length===Object.keys(d.metadata).length);requireThat(s.id===d.id&&s.source_revision===d.source_revision&&s.deleted_at===d.deleted_at);for(const k of Object.keys(s.metadata))requireThat(JSON.stringify(s.metadata[k])===JSON.stringify(d.metadata[k]));}
export class RateLimitError extends Error {
  constructor(public retryAfterMs:number) { super('RATE_LIMITED'); }
}
export function retryAfterMs(header:string|null,now=Date.now()) {
  if(header && /^\d+$/.test(header)) return Math.max(1000,Number(header)*1000);
  const date=header?Date.parse(header):NaN;
  return Number.isFinite(date)?Math.max(1000,date-now):60000;
}
export async function retryRateLimit<T>(action:()=>Promise<T>,sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))) {
  for(let attempt=0;;attempt++) {
    try {return await action();} catch(error) {
      if(!(error instanceof RateLimitError) || attempt>=8) throw error;
      // Reject unreasonable waits rather than overflowing setTimeout and retrying early.
      requireThat(Number.isFinite(error.retryAfterMs)&&error.retryAfterMs>=0&&error.retryAfterMs<=86400000);
      await sleep(error.retryAfterMs);
    }
  }
}
export interface MigrationJournal {pending?:{kind:string;body:any}}
export async function migrate(src:any,v:any,key:CryptoKey,api:any,reauth:()=>Promise<string>,sleep?:(ms:number)=>Promise<void>,journal:MigrationJournal={},progress:(staged:number,verified:number,total:number)=>void=()=>{}) {
  requireThat(v.user_id===src.batch.user_id&&v.vault_id===src.batch.vault_id);
  const read=(path:string)=>retryRateLimit<any>(()=>api(path),sleep);
  let snap=await snapshot(read,src.batch.batch_id,src.records.length);
  const validate=()=>{requireThat(snap.batch.user_id===v.user_id&&snap.batch.vault_id===v.vault_id&&snap.batch.record_count===src.records.length&&['exported','staged','verified'].includes(snap.batch.state));src.records.forEach((s:any,i:number)=>match(s,snap.records[i]));};validate();
  const send=async(kind:string,records:any[])=>{
    const body=journal.pending?.body??{request_id:crypto.randomUUID(),expected_revision:snap.batch.revision,records};
    requireThat(!journal.pending||journal.pending.kind===kind);journal.pending={kind,body};
    requireThat(utf8(JSON.stringify(body)).length<=(kind==='stage'?2*1024*1024:64*1024));
    await retryRateLimit(async()=>{
      // Every distinct write has fresh one-time authorization; a rate-limited write
      // reacquires authorization after waiting, since the original may have expired.
      const token=await retryRateLimit(reauth,sleep);
      try {await api('/vault/migrations/'+src.batch.batch_id+'/'+kind,body,token);}
      catch(error) {
        if(error instanceof RateLimitError) throw error;
        if(error instanceof VaultError && error.code!=='MIGRATION_NETWORK'){delete journal.pending;throw error;}
        // Uncertain response: identical request ID and ciphertext, never re-encrypt.
        await api('/vault/migrations/'+src.batch.batch_id+'/'+kind,body,token);
      }
    },sleep);
    snap=await snapshot(read,src.batch.batch_id,src.records.length);validate();delete journal.pending;progress(snap.batch.staged_count,snap.batch.verified_count,snap.batch.record_count);
  };
  if(journal.pending)await send(journal.pending.kind,journal.pending.body.records);
  progress(snap.batch.staged_count,snap.batch.verified_count,snap.batch.record_count);
  // Both endpoints permit 100 records. Even maximum-size envelopes fit stage's
  // 2 MiB bound; receipts fit 64 KiB. Read back each staged chunk before receipt.
  for(let offset=0;offset<src.records.length;offset+=100) {
    const inputs=src.records.slice(offset,offset+100),stage=[];
    const missing=inputs.filter((_:any,j:number)=>!snap.records[offset+j].secret_envelope);
    if(missing.length) {
      const live=await read('/vault');requireThat(live.vault.user_id===undefined||live.vault.user_id===v.user_id);requireThat(live.vault.vault_id===v.vault_id&&live.vault.vault_key_version===v.vault_key_version);
      for(const s of missing) {
        const c={user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:crypto.randomUUID(),secret_version:1};
        const e=await encryptSecret(key,c,s.legacy_value,live.vault.dek_wrap_count+stage.length);
        stage.push({id:s.id,source_revision:s.source_revision,secret_envelope:e});
      }
      await send('stage',stage);
    }
    const receipts=[];
    for(let j=0;j<inputs.length;j++) {
      const s=inputs[j],d=snap.records[offset+j];
      validateEnvelope(d.secret_envelope,context(v,d.secret_envelope));requireThat(d.secret_envelope.secret_version===1);
      const hash=await envelopeDigest(d.secret_envelope);requireThat(hash===d.envelope_sha256);
      const plain=await decryptSecret(key,context(v,d.secret_envelope),d.secret_envelope);requireThat(plain===s.legacy_value);
      if(!d.verified) receipts.push({id:s.id,source_revision:s.source_revision,envelope_sha256:hash});
    }
    if(receipts.length) await send('receipt',receipts);
  }
  requireThat(snap.batch.verified_count===src.records.length);return snap.batch;
}
export async function verifyBackup(v:any,records:any[],key:CryptoKey,user:string,count:number,legacy:number){
  decimal(user);uuid(v.vault_id);requireThat(Number.isSafeInteger(count)&&count>=0&&Number.isSafeInteger(legacy)&&legacy>=0&&legacy<=count);
  requireThat(v.user_id===user&&records.length===count);ordered(records.map(r=>r.metadata));
  const secrets=new Set<string>();
  let pending=0;for(const r of records){requireThat(r.metadata.user_id===user);decimal(r.metadata.revision);requireThat(r.deleted_at===null||(typeof r.deleted_at==='string'&&!Number.isNaN(Date.parse(r.deleted_at))));if(r.metadata.encryption_state==='legacy_pending'){requireThat(r.secret_envelope===null);pending++;}else{requireThat(r.metadata.encryption_state==='client_encrypted'&&r.metadata.has_secret===true);requireThat(r.secret_envelope&&!secrets.has(r.secret_envelope.secret_id));secrets.add(r.secret_envelope.secret_id);await decryptSecret(key,context(v,r.secret_envelope),r.secret_envelope);}}
  requireThat(pending===legacy);return {records:count,legacy_pending:pending,complete:pending===0};
}
