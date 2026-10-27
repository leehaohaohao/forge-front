import {object,decimal,uuid,requireThat,validateEnvelope} from './format';
import {configOf} from './session';
export const BACKUP_LIMIT=8*1024*1024, BACKUP_RECORD_LIMIT=2000;
export function parseBackup(value:unknown) {
  const d=object(value,['format_version','export_id','exported_at','user_id','vault','record_count','legacy_pending_count','records']);
  requireThat(d.format_version===1);uuid(d.export_id);decimal(d.user_id);
  requireThat(typeof d.exported_at==='string'&&Number.isFinite(Date.parse(d.exported_at)));
  const v=object(d.vault,['vault_id','format_version','vault_key_version','credential_version','kdf','password_wrap','recovery_wrap','user_id','revision','created_at','updated_at','dek_wrap_count','dek_wrap_warn_at','dek_wrap_limit']);
  configOf(v as any);decimal(v.revision);requireThat(v.user_id===d.user_id);
  requireThat(Number.isSafeInteger(d.record_count)&&Number(d.record_count)>=0&&Number(d.record_count)<=BACKUP_RECORD_LIMIT);
  requireThat(Number.isSafeInteger(d.legacy_pending_count)&&Number(d.legacy_pending_count)>=0&&Number(d.legacy_pending_count)<=Number(d.record_count));
  requireThat(Array.isArray(d.records)&&d.records.length===d.record_count);
  let last=0n,pending=0;const ids=new Set<string>();
  for(const r of d.records){
    object(r,['metadata','deleted_at','secret_envelope']);
    const m=object(r.metadata,['id','user_id','revision','provider','name','token_type','category','remark','expires_at','created_at','updated_at','has_secret','encryption_state']);
    decimal(m.id);decimal(m.revision);requireThat(BigInt(m.id)>last&&m.user_id===d.user_id);last=BigInt(m.id);
    for(const k of ['provider','name','token_type','category','remark'])requireThat(typeof m[k]==='string');
    for(const t of [r.deleted_at,m.expires_at,m.created_at,m.updated_at])requireThat(t===null||typeof t==='string'&&Number.isFinite(Date.parse(t)));
    requireThat(typeof m.has_secret==='boolean');
    if(m.encryption_state==='legacy_pending'){requireThat(r.secret_envelope===null);pending++;}
    else {requireThat(m.encryption_state==='client_encrypted'&&m.has_secret===true&&r.secret_envelope);const e=r.secret_envelope;validateEnvelope(e,{user_id:d.user_id,vault_id:v.vault_id as string,vault_key_version:v.vault_key_version as number,secret_id:e.secret_id,secret_version:e.secret_version});requireThat(!ids.has(e.secret_id));ids.add(e.secret_id);}
  }
  requireThat(pending===d.legacy_pending_count);return d as any;
}
