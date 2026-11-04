import { decryptSecret, importAes, unwrapPassword, unwrapRecovery } from './crypto';
import { decimal, uuid, requireThat } from './format';
import { configOf } from './session';
// B1 backup verification remains available independently of retired migration protocols.
export async function digest(bytes:Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join(''); }
function ordered(records:any[]) {let last=0n;for(const r of records){decimal(r.id);requireThat(BigInt(r.id)>last);last=BigInt(r.id);}}
export async function unlock(v:any,password:string,recovery:boolean) {
  const raw=recovery?await unwrapRecovery(v.user_id,configOf(v),password):await unwrapPassword(v.user_id,configOf(v),password);
  try{return await importAes(raw);}finally{raw.fill(0);}
}
const context=(v:any,e:any)=>({user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:e.secret_id,secret_version:e.secret_version});
export async function verifyBackup(v:any,records:any[],key:CryptoKey,user:string,count:number,legacy:number){
  decimal(user);uuid(v.vault_id);requireThat(Number.isSafeInteger(count)&&count>=0&&Number.isSafeInteger(legacy)&&legacy>=0&&legacy<=count);
  requireThat(v.user_id===user&&records.length===count);ordered(records.map(r=>r.metadata));
  const secrets=new Set<string>();
  let pending=0;for(const r of records){requireThat(r.metadata.user_id===user);decimal(r.metadata.revision);requireThat(r.deleted_at===null||(typeof r.deleted_at==='string'&&!Number.isNaN(Date.parse(r.deleted_at))));if(r.metadata.encryption_state==='legacy_pending'){requireThat(r.secret_envelope===null);pending++;}else{requireThat(r.metadata.encryption_state==='client_encrypted'&&r.metadata.has_secret===true);requireThat(r.secret_envelope&&!secrets.has(r.secret_envelope.secret_id));secrets.add(r.secret_envelope.secret_id);await decryptSecret(key,context(v,r.secret_envelope),r.secret_envelope);}}
  requireThat(pending===legacy);return {records:count,legacy_pending:pending,complete:pending===0};
}
export function lines(bytes:Uint8Array) {
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes).trimEnd().split('\n').map(line=>JSON.parse(line));
}
