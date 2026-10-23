import { encryptSecret, decryptSecret, importAes, unwrapPassword, unwrapRecovery } from '../src/lib/vault/crypto';
import { decimal, uuid, requireThat, utf8 } from '../src/lib/vault/format';
import { configOf } from '../src/lib/vault/session';
export async function digest(bytes:Uint8Array) { return Buffer.from(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)).toString('hex'); }
export async function envelopeDigest(e:any) {
  const out:any={};for(const k of ['format_version','vault_id','vault_key_version','secret_id','secret_version','algorithm','ciphertext','nonce','wrapped_dek','wrap_nonce'])out[k]=e[k];
  return digest(utf8(JSON.stringify(out)));
}
export function lines(bytes:Uint8Array) {
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes).trimEnd().split('\n').map(line=>JSON.parse(line));
}
function ordered(records:any[]) {let last=0n;for(const r of records){decimal(r.id);requireThat(BigInt(r.id)>last);last=BigInt(r.id);}}
export function source(bytes:Uint8Array) {
  const [header,...records]=lines(bytes);requireThat(header.format==='forge-migration-source-v1');
  const b=header.batch;uuid(b.batch_id);uuid(b.vault_id);decimal(b.user_id);decimal(b.revision);
  requireThat(records.length===b.record_count);ordered(records);
  for(const r of records){decimal(r.source_revision);requireThat(r.metadata.id===r.id&&r.metadata.revision===r.source_revision&&r.metadata.user_id===b.user_id&&r.metadata.encryption_state==='legacy_pending');requireThat(r.deleted_at===null||typeof r.deleted_at==='string');const v=utf8(r.legacy_value);requireThat(v.length>0&&v.length<=8192&&r.legacy_value.trim());v.fill(0);}
  return {batch:b,records};
}
export async function unlock(v:any,password:string,recovery:boolean) {
  const raw=recovery?await unwrapRecovery(v.user_id,configOf(v),password):await unwrapPassword(v.user_id,configOf(v),password);
  try{return await importAes(raw);}finally{raw.fill(0);}
}
const context=(v:any,e:any)=>({user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:e.secret_id,secret_version:e.secret_version});
export async function snapshot(api:any,batch:string) {
  const records:any[]=[];let after:string|undefined,view:any;
  do {const d=await api('/vault/migrations/'+batch+(after?'?after='+after:''));
    if(view)requireThat(d.batch.revision===view.revision);else view=d.batch;
    records.push(...d.records);const next=d.next_after; if(next!==null){decimal(next);requireThat(!after||BigInt(next)>BigInt(after));}after=next;
  }while(after);
  ordered(records);requireThat(records.length===view.record_count);return {batch:view,records};
}
function match(s:any,d:any){requireThat(s.id===d.id&&s.source_revision===d.source_revision&&s.deleted_at===d.deleted_at);for(const k of Object.keys(s.metadata))requireThat(JSON.stringify(s.metadata[k])===JSON.stringify(d.metadata[k]));}
export async function migrate(src:any,v:any,key:CryptoKey,api:any,reauth:()=>Promise<string>) {
  requireThat(v.user_id===src.batch.user_id&&v.vault_id===src.batch.vault_id);
  let snap=await snapshot(api,src.batch.batch_id);
  const validate=()=>{requireThat(snap.batch.user_id===v.user_id&&snap.batch.vault_id===v.vault_id&&snap.batch.record_count===src.records.length&&['exported','staged','verified'].includes(snap.batch.state));src.records.forEach((s:any,i:number)=>match(s,snap.records[i]));};validate();
  for(let i=0;i<src.records.length;i++) {
    const s=src.records[i];let d=snap.records[i];
    if(!d.secret_envelope){
      const live=await api('/vault');requireThat(live.vault.vault_id===v.vault_id&&live.vault.vault_key_version===v.vault_key_version);
      const c={user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:crypto.randomUUID(),secret_version:1};
      const e=await encryptSecret(key,c,s.legacy_value,live.vault.dek_wrap_count);
      const body={request_id:crypto.randomUUID(),expected_revision:snap.batch.revision,records:[{id:s.id,source_revision:s.source_revision,secret_envelope:e}]};
      const token=await reauth();
      try{await api('/vault/migrations/'+src.batch.batch_id+'/stage',body,token);}catch{
        // Resolve an uncertain response with exactly the same request ID and ciphertext.
        await api('/vault/migrations/'+src.batch.batch_id+'/stage',body,token);
      }
      snap=await snapshot(api,src.batch.batch_id);validate();d=snap.records[i];
    }
    const hash=await envelopeDigest(d.secret_envelope);requireThat(hash===d.envelope_sha256);
    const plain=await decryptSecret(key,context(v,d.secret_envelope),d.secret_envelope);requireThat(plain===s.legacy_value);
    if(!d.verified){
      const body={request_id:crypto.randomUUID(),expected_revision:snap.batch.revision,records:[{id:s.id,source_revision:s.source_revision,envelope_sha256:hash}]};
      const token=await reauth();try{await api('/vault/migrations/'+src.batch.batch_id+'/receipt',body,token);}catch{await api('/vault/migrations/'+src.batch.batch_id+'/receipt',body,token);}
      snap=await snapshot(api,src.batch.batch_id);validate();
    }
  }
  requireThat(snap.batch.verified_count===src.records.length);return snap.batch;
}
export async function verifyBackup(v:any,records:any[],key:CryptoKey,user:string,count:number,legacy:number){
  requireThat(v.user_id===user&&records.length===count);ordered(records.map(r=>r.metadata));
  let pending=0;for(const r of records){requireThat(r.metadata.user_id===user);if(r.metadata.encryption_state==='legacy_pending'){requireThat(r.secret_envelope===null);pending++;}else{requireThat(r.metadata.encryption_state==='client_encrypted');await decryptSecret(key,context(v,r.secret_envelope),r.secret_envelope);}}
  requireThat(pending===legacy);return {records:count,legacy_pending:pending,complete:pending===0};
}
