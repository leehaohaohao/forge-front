// Synthetic backend only: never imported by application entries.
import {encode} from '../../src/lib/vault/delivery';
import {digest,envelopeDigest} from '../../src/lib/vault/migration-core';
import {utf8} from '../../src/lib/vault/format';
import {VaultError} from '../../src/lib/vault/types';
export class Fixture {
 vault:any;batch:any;task:any;rows:any[]=[];source:any[]=[];chunks:Uint8Array[]=[];run:any;
 pair:any;stages=0;receipts=0;finalizes=0;sources=0;requests:any[]=[];
 lostStage=false;lostReceipt=false;lostFinalize=false;failure?:string;tamper=false;seen=new Set<string>();
 constructor(v:any,count=201){
  this.vault={...v,revision:'1',dek_wrap_count:0};
  this.batch={batch_id:crypto.randomUUID(),user_id:v.user_id,vault_id:v.vault_id,state:'exported',revision:'2',record_count:count,staged_count:0,verified_count:0};
  this.task={protocol:'self-service-v1',task_id:crypto.randomUUID(),vault_id:v.vault_id,revision:'4',phase:'client_processing',protection:{state:'verified'},frozen:true,batch:{batch_id:this.batch.batch_id},snapshot:{snapshot_id:crypto.randomUUID(),record_count:String(count),chunk_count:String(Math.ceil(count/100)),vault_revision:'1'},delivery:{}};
  for(let i=0;i<count;i++){
   const id=String(i+1),source_revision=String(10+i),metadata={id,user_id:v.user_id,revision:source_revision,provider:'fixture',name:'合成记录 '+id,token_type:'dev',category:'测试',remark:'',expires_at:null,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',has_secret:true,encryption_state:'legacy_pending'};
   const r={id,source_revision,metadata,deleted_at:i%3===0?'2026-01-02T00:00:00Z':null,legacy_value:'  synthetic-secret-'+id+' 中文🦊é\n '};this.source.push(r);
   const {legacy_value,...rest}=r;this.rows.push({...structuredClone(rest),secret_envelope:null,envelope_sha256:null,verified:false});
  }
 }
 async payloads(targetBytes?:number){
  const manifest={records:this.source.map(r=>[r.id,r.source_revision,r.deleted_at]),sha256:''};manifest.sha256=await digest(utf8(JSON.stringify(manifest.records)));
  const build=()=>{this.chunks=[];for(let i=0;i<this.source.length;i+=100)this.chunks.push(utf8(JSON.stringify({protocol:'self-service-v1',snapshot_id:this.task.snapshot.snapshot_id,chunk_id:String(i/100+1),chunk_count:this.task.snapshot.chunk_count,record_count:String(this.source.length),records:this.source.slice(i,i+100),manifest})));};build();
  if(targetBytes){const extra=targetBytes-this.chunks.reduce((n,c)=>n+c.length,0);if(extra<0)throw Error('target too small');this.source.forEach((r,i)=>{r.metadata.remark='x'.repeat(Math.floor(extra/this.source.length)+(i<extra%this.source.length?1:0));this.rows[i].metadata.remark=r.metadata.remark;});build();}
  this.task.snapshot.source_bytes=String(this.chunks.reduce((n,c)=>n+c.length,0));
 }
 async bind(pair:any){this.pair=pair;const epoch=String(Number(this.task.delivery.epoch??0)+1);this.task.delivery={epoch,recipient:pair.recipient,expires_at:new Date((Math.floor(Date.now()/1000)+880)*1000).toISOString(),state:'active'};
  this.run={task_id:this.task.task_id,task_revision:this.task.revision,batch_id:this.batch.batch_id,snapshot_id:this.task.snapshot.snapshot_id,vault_revision:'1',delivery_epoch:epoch,recipient:pair.recipient,expires_at:String(Date.parse(this.task.delivery.expires_at)/1000),record_count:String(this.source.length),chunk_count:String(this.chunks.length),source_bytes:this.task.snapshot.source_bytes};return this.run;
 }
 async jwe(i:number){
  const c={version:'self-service-v1',purpose:'migration-source',recipient:this.run.recipient,user_id:this.vault.user_id,vault_id:this.vault.vault_id,task_id:this.run.task_id,batch_id:this.run.batch_id,snapshot_id:this.run.snapshot_id,delivery_epoch:this.run.delivery_epoch,chunk_id:String(i),expires_at:this.run.expires_at};
  const head=encode(utf8(JSON.stringify({alg:'RSA-OAEP-256',enc:'A256GCM',typ:'forge-migration+jwe',crit:['forge'],forge:c}))),raw=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  const pub=await crypto.subtle.importKey('jwk',this.pair.publicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
  const enc=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8(head)},key,this.chunks[i-1] as Uint8Array<ArrayBuffer>));const wrapped=new Uint8Array(await crypto.subtle.encrypt({name:'RSA-OAEP'},pub,raw));raw.fill(0);return [head,encode(wrapped),encode(iv),encode(enc.slice(0,-16)),encode(enc.slice(-16))].join('.');
 }
 async api(path:string,body?:any):Promise<any>{
  this.requests.push({path,body:structuredClone(body)});if(this.failure)throw new VaultError(this.failure as any);
  if(path==='/vault')return {user_id:this.vault.user_id,vault:this.vault};
  if(path==='/vault/self-service-migrations/'+this.task.task_id&&body===undefined)return structuredClone(this.task);
  if(body===undefined){const after=Number(path.split('?after=')[1]??0),rows=structuredClone(this.rows.slice(after,after+100));if(this.tamper&&rows[0]?.secret_envelope)rows[0].secret_envelope.ciphertext='AAAA';return {batch:{...this.batch},records:rows,next_after:after+100<this.rows.length?rows.at(-1).id:null};}
  if(path.endsWith('/source-chunks')){this.sources++;return {snapshot_id:this.run.snapshot_id,delivery_epoch:this.run.delivery_epoch,chunk_id:body.chunk_id,jwe:await this.jwe(Number(body.chunk_id)),server_now:Math.floor(Date.now()/1000)};}
  if(path.endsWith('/finalize')){this.finalizes++;const hash=await digest(utf8(this.rows.map(r=>JSON.stringify([r.id,r.source_revision,r.envelope_sha256])+'\n').join('')));if(hash!==body.manifest_sha256||this.rows.some(r=>!r.verified))throw Error('bad finalize');this.task.phase='finalizing';if(this.lostFinalize){this.lostFinalize=false;throw new VaultError('MIGRATION_NETWORK');}return {accepted:true,task:structuredClone(this.task)};}
  if(this.seen.has(body.request_id))return {...this.batch};
  if(body.expected_revision!==this.batch.revision)throw new VaultError('MIGRATION_CONFLICT');this.seen.add(body.request_id);
  if(path.endsWith('/stage')){this.stages++;for(const r of body.records){const d=this.rows[Number(r.id)-1];if(d.secret_envelope)throw Error('re-encryption');d.secret_envelope=r.secret_envelope;d.envelope_sha256=await envelopeDigest(r.secret_envelope);this.batch.staged_count++;this.vault.dek_wrap_count++;}this.batch.state='staged';}
  else if(path.endsWith('/receipt')){this.receipts++;for(const r of body.records){const d=this.rows[Number(r.id)-1];if(r.envelope_sha256!==d.envelope_sha256)throw Error('bad receipt');d.verified=true;this.batch.verified_count++;}if(this.batch.verified_count===this.rows.length)this.batch.state='verified';}else throw Error('unexpected route');
  this.batch.revision=String(Number(this.batch.revision)+1);
  if(path.endsWith('/stage')&&this.lostStage){this.lostStage=false;throw new VaultError('MIGRATION_NETWORK');}
  if(path.endsWith('/receipt')&&this.lostReceipt){this.lostReceipt=false;throw new VaultError('MIGRATION_NETWORK');}return {...this.batch};
 }
}
