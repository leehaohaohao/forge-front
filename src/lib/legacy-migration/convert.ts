// Imported only by the existing key Worker. No plaintext crosses its RPC boundary.
import {object,requireThat,utf8,unbase64,base64,secretAad,dekAad} from '@/lib/vault/format';
import {strictJson} from '@/lib/vault/strict-json';
import {importAes,seal,open} from '@/lib/vault/crypto';
import {VaultError,type VaultRead,type SecretContext} from '@/lib/vault/types';
import {binding,bindingFields,protocol,type Row,type Commit} from './protocol';
const enc=(v:Uint8Array)=>base64(v).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function dec(v:string,min:number,max=min){requireThat(typeof v==='string'&&v.length<=Math.ceil(max*4/3)&&/^[A-Za-z0-9_-]+$/.test(v));const bytes=unbase64(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4),min,max);requireThat(enc(bytes)===v);return bytes;}
const text=(v:Uint8Array)=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(v);
const hash=async(v:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',v)),x=>x.toString(16).padStart(2,'0')).join('');
export async function legacyRecipient(){const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['encrypt','decrypt']);const j=await crypto.subtle.exportKey('jwk',pair.publicKey);const publicKey={kty:'RSA',e:'AQAB',n:j.n!,alg:'RSA-OAEP-256'};const recipient=enc(new Uint8Array(await crypto.subtle.digest('SHA-256',utf8(JSON.stringify({e:publicKey.e,kty:publicKey.kty,n:publicKey.n})))));return {key:pair.privateKey,publicKey,recipient};}
export type Pair=Awaited<ReturnType<typeof legacyRecipient>>;
export interface Conversion {row:Row;vault:VaultRead;response:unknown;now:number}
export async function convertLegacy(pair:Pair,key:CryptoKey,input:Conversion):Promise<Commit>{
 const started=performance.now(),{row,vault:v,now}=input;requireThat(Number.isSafeInteger(now)&&!pair.key.extractable);
 const outer=object(input.response,['protocol','binding','jwe']);requireThat(outer.protocol===protocol&&typeof outer.jwe==='string'&&outer.jwe.length<=24000);
 const b=binding(outer.binding);requireThat(b.user_id===v.user_id&&b.vault_id===v.vault_id&&b.vault_revision===v.revision&&b.vault_key_version===v.vault_key_version&&b.credential_version===v.credential_version&&b.id===row.id&&b.revision===row.revision&&b.recipient===pair.recipient);
 const fresh=()=>requireThat(BigInt(b.expires_at)>BigInt(now+Math.floor((performance.now()-started)/1000))&&BigInt(b.expires_at)<=BigInt(now)+300n);fresh();
 const parts=outer.jwe.split('.');requireThat(parts.length===5);
 const h=object(strictJson(text(dec(parts[0],1,4096))),['alg','enc','typ','crit','forge']);requireThat(h.alg==='RSA-OAEP-256'&&h.enc==='A256GCM'&&h.typ==='forge-legacy-migration+jwe'&&JSON.stringify(h.crit)==='["forge"]');
 const same=(value:unknown)=>{const other=binding(value);for(const k of bindingFields)requireThat(other[k as keyof typeof other]===b[k as keyof typeof b]);};same(h.forge);
 let raw:Uint8Array<ArrayBuffer>|undefined,plain:Uint8Array<ArrayBuffer>|undefined,bytes:Uint8Array<ArrayBuffer>|undefined,dek:Uint8Array<ArrayBuffer>|undefined,check:Uint8Array<ArrayBuffer>|undefined;let payload:Record<string,unknown>|undefined;
 try{
 raw=new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP'},pair.key,dec(parts[1],384)));requireThat(raw.length===32);
 const cipher=dec(parts[3],1,16384),tag=dec(parts[4],16);plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:dec(parts[2],12),additionalData:utf8(parts[0]),tagLength:128},await importAes(raw),new Uint8Array([...cipher,...tag])));
 payload=object(strictJson(text(plain)),['protocol','binding','source_format','value_b64','source_sha256','byte_length','deleted']);same(payload.binding);
 requireThat(payload.protocol===protocol&&payload.source_format==='token-value-utf8-v1'&&payload.deleted===row.deleted);
 bytes=unbase64(payload.value_b64,1,8192);requireThat(payload.byte_length===bytes.length&&typeof payload.source_sha256==='string'&&/^[0-9a-f]{64}$/.test(payload.source_sha256)&&await hash(bytes)===payload.source_sha256);
 // Reject malformed UTF-8, but preserve BOM, whitespace, NUL and combining characters.
 const decoded=utf8(text(bytes));try{requireThat(decoded.length===bytes.length&&decoded.every((x,i)=>x===bytes![i]));}finally{decoded.fill(0);}
 if(v.dek_wrap_count>=1000000)throw new VaultError('KEY_LIMIT');
 const c:SecretContext={user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:crypto.randomUUID(),secret_version:1};
 dek=crypto.getRandomValues(new Uint8Array(32));const dk=await importAes(dek),content=await seal(dk,bytes,secretAad(c)),wrapped=await seal(key,dek,dekAad(c));
 // Verify the complete wrapped envelope, not just the content key held above.
 const recovered=await open(key,wrapped,dekAad(c));try{check=await open(await importAes(recovered),content,secretAad(c),17,8208);}finally{recovered.fill(0);}
 requireThat(check.length===bytes.length&&check.every((x,i)=>x===bytes![i]));fresh();
 return {id:row.id,expected_revision:row.revision,expected_vault_revision:v.revision,vault_id:v.vault_id,vault_key_version:v.vault_key_version,credential_version:v.credential_version,source_sha256:payload.source_sha256 as string,secret_envelope:{format_version:1,algorithm:'AES-256-GCM',vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:c.secret_id,secret_version:1,ciphertext:content.ciphertext,nonce:content.nonce,wrapped_dek:wrapped.ciphertext,wrap_nonce:wrapped.nonce}};
 }finally{raw?.fill(0);plain?.fill(0);bytes?.fill(0);dek?.fill(0);check?.fill(0);if(payload){payload.value_b64='';payload.source_sha256='';}}
}
