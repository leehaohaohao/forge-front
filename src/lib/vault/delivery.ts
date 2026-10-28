import {object,requireThat,utf8,uuid,decimal} from './format';
import {strictJson} from './migration-source';
export const protocol='self-service-v1';
export const encode=(b:Uint8Array)=>btoa(Array.from(b,x=>String.fromCharCode(x)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(s:string,max:number){requireThat(typeof s==='string'&&s.length>0&&s.length<=Math.ceil(max*4/3)&&/^[A-Za-z0-9_-]+$/.test(s));const b=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));requireThat(b.length<=max&&encode(b)===s);return b;}
export async function fingerprint(jwk:JsonWebKey){requireThat(jwk.kty==='RSA'&&jwk.e==='AQAB'&&jwk.n);const n=decode(jwk.n,384);requireThat(n.length===384&&n[0]>=128&&(n[383]&1)===1);return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',utf8(JSON.stringify({e:'AQAB',kty:'RSA',n:jwk.n})))));}
export async function recipient(){const keys=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['encrypt','decrypt']);const j=await crypto.subtle.exportKey('jwk',keys.publicKey);return {privateKey:keys.privateKey,publicKey:{kty:'RSA',n:j.n!,e:'AQAB',alg:'RSA-OAEP-256'},recipient:await fingerprint(j)};}
const fields=['version','purpose','recipient','user_id','vault_id','task_id','batch_id','snapshot_id','delivery_epoch','chunk_id','expires_at'];
export type DeliveryContext=Record<string,string>;
export class DeliveryReceiver {
  private seen=new Set<string>();
  constructor(private key:CryptoKey,private recipient:string){}
  async open(jwe:string,expected:DeliveryContext,now:number):Promise<Uint8Array>{
    requireThat(!this.key.extractable&&jwe.length<=1409024&&Number.isSafeInteger(now));
    const parts=jwe.split('.');requireThat(parts.length===5);
    const header=strictJson(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0],4096)));
    object(header,['alg','enc','typ','crit','forge']);object(header.forge,fields);const c=header.forge;
    requireThat(header.alg==='RSA-OAEP-256'&&header.enc==='A256GCM'&&header.typ==='forge-migration+jwe'&&JSON.stringify(header.crit)==='["forge"]');
    requireThat(c.version===protocol&&c.purpose==='migration-source'&&c.recipient===this.recipient);
    for(const k of ['vault_id','task_id','batch_id','snapshot_id'])uuid(c[k]);
    for(const k of ['user_id','delivery_epoch','chunk_id','expires_at'])decimal(c[k]);
    for(const k of fields)requireThat(typeof c[k]==='string'&&c[k]===expected[k]);
    const expiry=BigInt(c.expires_at);requireThat(expiry>BigInt(now)&&expiry<=BigInt(now)+900n);
    const canonical={alg:'RSA-OAEP-256',enc:'A256GCM',typ:'forge-migration+jwe',crit:['forge'],forge:Object.fromEntries(fields.map(k=>[k,c[k]]))};
    requireThat(encode(utf8(JSON.stringify(canonical)))===parts[0]);
    const id=[c.snapshot_id,c.delivery_epoch,c.chunk_id].join(':');requireThat(!this.seen.has(id));
    const wrapped=decode(parts[1],384),iv=decode(parts[2],12),cipher=decode(parts[3],1048576),tag=decode(parts[4],16);
    requireThat(wrapped.length===384&&iv.length===12&&tag.length===16);
    const raw=new Uint8Array(await crypto.subtle.decrypt({name:'RSA-OAEP'},this.key,wrapped));
    try {requireThat(raw.length===32);const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);const result=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:utf8(parts[0]),tagLength:128},key,new Uint8Array([...cipher,...tag])));this.seen.add(id);return result;}finally{raw.fill(0);}
  }
}
