import { VaultSession, configOf } from './session';
import { VaultError, type VaultRead, type SecretContext } from './types';
import { decimal, requireThat, validateEnvelope } from './format';
import { readVault } from '@/services/vault';
import { accessToken, createToken, updateToken } from '@/services/token';
import type { Token, TokenFormValues, TokenMetadata } from '@/types/token';
export const vaultSession=new VaultSession();
let unlocked:VaultRead | undefined;
const requests=new Set<AbortController>();
const bindings=new Map<string,string>();
vaultSession.subscribe(()=>{
  if(vaultSession.state==='locked') { requests.forEach(c=>c.abort()); requests.clear(); unlocked=undefined; bindings.clear(); }
});
export function bindVault(v:VaultRead) { unlocked=v; }
export function operation() {
  const epoch=vaultSession.epoch, controller=new AbortController(); requests.add(controller);
  return {signal:controller.signal,guard:()=>{if(controller.signal.aborted || !vaultSession.isCurrent(epoch)) throw new VaultError('STALE');},
    done:()=>requests.delete(controller)};
}
export async function currentVault(signal:AbortSignal):Promise<VaultRead> {
  if(vaultSession.state!=='unlocked' || !unlocked) throw new VaultError('LOCKED');
  const previous=unlocked;
  const {vault:v,user_id}=await readVault(signal);
  if(!v || user_id!==previous.user_id || JSON.stringify(configOf(v))!==JSON.stringify(configOf(previous))) {
    vaultSession.lock(); throw new VaultError('STALE');
  }
  return v;
}
export async function readSecret(t:Token,purpose:'view'|'copy',signal:AbortSignal) {
  const v=await currentVault(signal);
  requireThat(t.user_id===v.user_id && t.encryption_state==='client_encrypted');
  const d=await accessToken(t.id,purpose,signal);
  decimal(d.revision);
  requireThat(d.id===t.id && d.user_id===t.user_id);
  if(d.revision!==t.revision) throw new VaultError('STALE');
  const e=d.secret_envelope;
  const c:SecretContext={user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:e.secret_id,secret_version:e.secret_version};
  validateEnvelope(e,c);
  const known=bindings.get(t.id); requireThat(!known || known===e.secret_id); bindings.set(t.id,e.secret_id);
  return {vault:v,envelope:e,context:c};
}
export async function saveSecret(t:Token|null,metadata:TokenMetadata,secret:TokenFormValues['secret']) {
  const op=operation();
  try {
    if(t && secret==='') { const result=await updateToken(t.id,{...metadata,expected_revision:t.revision},op.signal);op.guard();return result; }
    let v:VaultRead, c:SecretContext, previous=0;
    if(t) { const data=await readSecret(t,'view',op.signal);op.guard();v=data.vault;previous=data.envelope.secret_version;c={...data.context,secret_version:previous+1}; }
    else { v=await currentVault(op.signal);op.guard();c={user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:crypto.randomUUID(),secret_version:1}; }
    const envelope=await vaultSession.encrypt(c,secret,v.dek_wrap_count,previous);op.guard();
    const request={...metadata,secret_envelope:envelope,expected_vault_revision:v.revision};
    const result=t?await updateToken(t.id,{...request,expected_revision:t.revision},op.signal):await createToken(request,op.signal);
    op.guard();bindings.set(result.id,c.secret_id);return result;
  } finally {op.done();}
}

window.addEventListener('forge-auth-invalid',()=>vaultSession.lock());
window.addEventListener('storage',e=>{if(e.key==='forge_token') vaultSession.lock();});
