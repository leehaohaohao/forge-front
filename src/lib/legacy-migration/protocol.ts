import {object,requireThat,decimal,uuid,version} from '@/lib/vault/format';
import type {SecretEnvelope} from '@/lib/vault/types';
export const protocol='legacy-migration-v1';
export interface Row {id:string;revision:string;deleted:boolean}
export interface Status {protocol:typeof protocol;enabled:boolean;source_format:string|null;pending_count:string|null;deleted_count:string|null;unsupported_count:string|null;complete:boolean;vault:{vault_id:string;revision:string;key_version:number;credential_version:number}|null;records:Row[];next_after:string|null}
export function count(v:unknown):asserts v is string {if(v!=='0')decimal(v);}
export function parseStatus(value:unknown,after?:string):Status {
 const s=object(value,['protocol','enabled','source_format','pending_count','deleted_count','unsupported_count','complete','vault','records','next_after']);
 requireThat(s.protocol===protocol&&typeof s.enabled==='boolean'&&typeof s.complete==='boolean'&&Array.isArray(s.records)&&s.records.length<=100);
 if(!s.enabled){requireThat(s.pending_count===null&&s.deleted_count===null&&s.unsupported_count===null&&s.vault===null&&s.next_after===null&&s.complete===false&&s.records.length===0);return s as unknown as Status;}
 requireThat(s.source_format==='token-value-utf8-v1');count(s.pending_count);count(s.deleted_count);count(s.unsupported_count);
 requireThat(BigInt(s.deleted_count)<=BigInt(s.pending_count)&&s.complete===(s.pending_count==='0'&&s.unsupported_count==='0'));
 if(s.vault!==null){const v=object(s.vault,['vault_id','revision','key_version','credential_version']);uuid(v.vault_id);decimal(v.revision);version(v.key_version);version(v.credential_version);}
 let previous=BigInt(after??'0');for(const item of s.records){const row=object(item,['id','revision','deleted']);decimal(row.id);decimal(row.revision);requireThat(typeof row.deleted==='boolean'&&BigInt(row.id)>previous);previous=BigInt(row.id);}
 requireThat(BigInt(s.records.length)<=BigInt(s.pending_count));
 if(s.next_after!==null){decimal(s.next_after);requireThat(s.records.length>0&&BigInt(s.next_after)===previous);}
 return s as unknown as Status;
}
export const bindingFields=['version','purpose','user_id','vault_id','vault_revision','vault_key_version','credential_version','id','revision','recipient','expires_at'];
export interface Binding {version:string;purpose:string;user_id:string;vault_id:string;vault_revision:string;vault_key_version:number;credential_version:number;id:string;revision:string;recipient:string;expires_at:string}
export function binding(v:unknown):Binding {const b=object(v,bindingFields);requireThat(b.version===protocol&&b.purpose==='legacy-token-source');for(const k of ['user_id','vault_revision','id','revision','expires_at'])decimal(b[k]);uuid(b.vault_id);version(b.vault_key_version);version(b.credential_version);requireThat(typeof b.recipient==='string'&&/^[A-Za-z0-9_-]{43}$/.test(b.recipient));return b as unknown as Binding;}
export interface Commit {id:string;expected_revision:string;expected_vault_revision:string;vault_id:string;vault_key_version:number;credential_version:number;source_sha256:string;secret_envelope:SecretEnvelope}
export function committed(value:unknown,row:Row){const d=object(value,['protocol','id','revision','state','outcome']);decimal(d.revision);requireThat(d.protocol===protocol&&d.id===row.id&&BigInt(d.revision)===BigInt(row.revision)+1n&&d.state==='client_encrypted'&&['committed','already_committed'].includes(String(d.outcome)));}
