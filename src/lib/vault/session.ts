import type { VaultFailure, VaultCommand, VaultConfig, VaultRead, PreparedVault, RecoveryMaterial, SecretContext, SecretEnvelope } from './types';
import { VaultError } from './types';
import { decimal, validateVault, validatePassword } from './format';

export interface VaultTransport {
  read(): Promise<{ user_id: string; vault: VaultRead | null }>;
  create(vault: VaultConfig): Promise<VaultRead>;
  // Implementation in front2 must require account reauthentication (X-Forge-Reauth).
  credentials(input: Omit<VaultConfig,'vault_id'|'format_version'|'vault_key_version'> & {expected_revision:string}): Promise<VaultRead>;
}
export function configOf(v: VaultConfig): VaultConfig {
  const config = {vault_id:v.vault_id,format_version:v.format_version,vault_key_version:v.vault_key_version,credential_version:v.credential_version,kdf:v.kdf,password_wrap:v.password_wrap,recovery_wrap:v.recovery_wrap};
  validateVault(config); return config;
}
function equalConfig(a: VaultConfig, b: VaultConfig) {
  const x=configOf(a), y=configOf(b);
  // Config fields are explicit; compare each nested value without relying on wire object key order.
  return x.vault_id === y.vault_id && x.format_version === y.format_version && x.vault_key_version === y.vault_key_version && x.credential_version === y.credential_version
    && Object.entries(x.kdf).every(([k,v]) => y.kdf[k as keyof typeof y.kdf] === v)
    && x.password_wrap.nonce === y.password_wrap.nonce && x.password_wrap.ciphertext === y.password_wrap.ciphertext
    && x.recovery_wrap.nonce === y.recovery_wrap.nonce && x.recovery_wrap.ciphertext === y.recovery_wrap.ciphertext;
}
export class VaultSession {
  private worker?: Worker;
  private serial=0;
  private generation=0;
  private waiters=new Map<number,{resolve:(value:unknown)=>void; reject:(error:Error)=>void}>();
  private timer?: ReturnType<typeof setTimeout>;
  private stop?: () => void;
  private listeners=new Set<() => void>();
  private draft?: {userId:string; vault:VaultConfig; revision?:string; verified:boolean; saved:boolean};
  private status: 'locked'|'pending'|'unlocked' = 'locked';
  constructor(private idleMs=300000) {
    if (typeof window !== 'undefined') {
      const hide=() => { if (document.hidden) this.suspend(); };
      const activity=() => { if (this.status !== 'locked') this.touch(); };
      const leave=() => this.lock();
      document.addEventListener('visibilitychange',hide);
      window.addEventListener('pagehide',leave);
      const blur=()=>this.suspend();
      window.addEventListener('blur',blur);
      window.addEventListener('popstate',leave);
      window.addEventListener('pointerdown',activity);
      window.addEventListener('keydown',activity);
      this.stop=() => {
        document.removeEventListener('visibilitychange',hide); window.removeEventListener('pagehide',leave); window.removeEventListener('blur',blur);
        window.removeEventListener('popstate',leave); window.removeEventListener('pointerdown',activity); window.removeEventListener('keydown',activity);
      };
    }
  }
  get state() { return this.status; }
  get epoch() { return this.generation; }
  isCurrent(epoch:number) { return epoch === this.generation; }
  subscribe(listener:()=>void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { this.listeners.forEach(fn=>fn()); }
  private touch() {
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.suspend(),this.idleMs);
  }
  private call<T>(command:VaultCommand | {action:'activatePrepared'}): Promise<T> {
    if (typeof document !== 'undefined' && document.hidden) return Promise.reject(new VaultError('LOCKED'));
    if (!globalThis.crypto?.subtle || typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return Promise.reject(new VaultError('UNSUPPORTED'));
    if (!this.worker) {
      this.worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
      this.worker.onmessage=({data}) => {
        const waiter=this.waiters.get(data.id);
        if (!waiter) return;
        this.waiters.delete(data.id);
        if (data.ok) waiter.resolve(data.value); else waiter.reject(new VaultError(data.code));
      };
      this.worker.onerror=() => this.lock('UNSUPPORTED');
    }
    this.touch();
    const id=++this.serial;
    return new Promise((resolve,reject)=>{
      this.waiters.set(id,{resolve:resolve as (v:unknown)=>void,reject});
      this.worker!.postMessage({id,command});
    });
  }
  get pendingConfirmation() {
    const d=this.draft;
    return d ? {format_version:1 as const,user_id:d.userId,vault_id:d.vault.vault_id,saved:d.saved} : undefined;
  }
  // Only encrypted wrappers and non-secret confirmation metadata survive focus loss.
  suspend() { this.lock('STALE',true); }
  async resumePrepared(password:string) {
    const draft=this.draft, epoch=this.generation;
    if (!draft || this.state!=='locked') throw new VaultError('STALE');
    try {
      await this.call({action:'resumePrepared',userId:draft.userId,vault:draft.vault,password});
      if (!this.isCurrent(epoch) || this.draft!==draft) throw new VaultError('STALE');
      this.status='pending'; this.notify();
    } catch(error) {
      if(this.isCurrent(epoch)) this.suspend();
      throw error;
    }
  }
  lock(reason:VaultFailure='STALE',preserveDraft=false) {
    this.generation++; this.worker?.terminate(); this.worker=undefined;
    this.waiters.forEach(w=>w.reject(new VaultError(reason))); this.waiters.clear();
    clearTimeout(this.timer); if(preserveDraft && this.draft) this.draft.verified=false; else this.draft=undefined; this.status='locked'; this.notify();
  }
  dispose() { this.lock(); this.stop?.(); this.listeners.clear(); }
  async initialize(userId:string,password:string):Promise<PreparedVault> {
    if (this.status !== 'locked' || this.draft) throw new VaultError('STALE');
    decimal(userId);
    const result=await this.call<PreparedVault>({action:'initialize',userId,password});
    this.draft={userId,vault:result.vault,verified:false,saved:false}; this.status='pending'; this.notify();
    return result;
  }
  async unlock(userId:string,vault:VaultConfig,password:string) {
    if (this.draft) throw new VaultError('RECOVERY_UNVERIFIED');
    try {
      await this.call({action:'unlock',userId,vault:configOf(vault),password});
      this.status='unlocked'; this.notify();
    } catch(error) {
      this.lock();
      if (error instanceof VaultError && ['UNSUPPORTED','STALE','LOCKED'].includes(error.code)) throw error;
      throw new VaultError('UNLOCK_FAILED');
    }
  }
  async changeCredentials(userId:string,vault:VaultRead,credentials:{password:string}|{recoveryKey:string},newPassword:string):Promise<PreparedVault> {
    if (this.draft) throw new VaultError('RECOVERY_UNVERIFIED');
    validatePassword(newPassword);
    try {
      decimal(vault.revision); if (vault.user_id !== userId) throw new VaultError('INVALID_FORMAT');
      const result=await this.call<PreparedVault>({action:'credentials',userId,vault:configOf(vault),...credentials,newPassword});
      this.draft={userId,vault:result.vault,revision:vault.revision,verified:false,saved:false}; this.status='pending'; this.notify();
      return result;
    } catch(error) {
      this.lock();
      if (error instanceof VaultError && ['UNSUPPORTED','STALE','LOCKED'].includes(error.code)) throw error;
      throw new VaultError('UNLOCK_FAILED');
    }
  }
  recoverySaved() { if (!this.draft) throw new VaultError('LOCKED'); this.draft.saved=true; }
  async verifyRecovery(material:RecoveryMaterial) {
    if (!this.draft?.saved) throw new VaultError('RECOVERY_UNVERIFIED');
    this.draft.verified=false;
    await this.call({action:'verifyRecovery',material});
    if (!this.draft) throw new VaultError('STALE');
    this.draft.verified=true;
  }
  async publish(transport:VaultTransport):Promise<VaultRead> {
    const draft=this.draft, epoch=this.generation;
    if (!draft?.verified || !draft.saved) throw new VaultError('RECOVERY_UNVERIFIED');
    const config=await this.call<VaultConfig>({action:'prepared'});
    const guard=() => { if (!this.isCurrent(epoch) || this.draft !== draft) throw new VaultError('STALE'); };
    const matches=(v:VaultRead) => v.user_id === draft.userId && equalConfig(v,config) && (decimal(v.revision), true)
      && (draft.revision ? BigInt(v.revision) === BigInt(draft.revision)+1n : v.revision === '1');
    const before=await transport.read(); guard(); decimal(before.user_id);
    if (before.user_id !== draft.userId) throw new VaultError('STALE');
    let result:VaultRead;
    if (before.vault && matches(before.vault)) result=before.vault;
    else {
      if (draft.revision ? !before.vault || before.vault.revision !== draft.revision : before.vault !== null) throw new VaultError('STALE');
      try {
        guard();
        result=draft.revision
          ? await transport.credentials({expected_revision:draft.revision,credential_version:config.credential_version,kdf:config.kdf,password_wrap:config.password_wrap,recovery_wrap:config.recovery_wrap})
          : await transport.create(config);
      } catch {
        guard();
        // Unknown result: read back the same draft. Never regenerate VK or silently overwrite.
        const after=await transport.read(); guard();
        if (after.user_id !== draft.userId || !after.vault || !matches(after.vault)) throw new VaultError('STALE');
        result=after.vault;
      }
    }
    guard(); if (!matches(result)) throw new VaultError('STALE');
    await this.call({action:'activatePrepared'}); guard();
    this.draft=undefined; this.status='unlocked'; this.notify();
    return result;
  }
  encrypt(context:SecretContext,value:string,wrapCount:number,previousVersion=0) { if (this.state !== 'unlocked') return Promise.reject(new VaultError('LOCKED')); return this.call<SecretEnvelope>({action:'encrypt',context,value,wrapCount,previousVersion}); }
  decrypt(context:SecretContext,envelope:SecretEnvelope) { if (this.state !== 'unlocked') return Promise.reject(new VaultError('LOCKED')); return this.call<string>({action:'decrypt',context,envelope}); }
}
