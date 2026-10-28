import {object,decimal,uuid,requireThat,utf8} from './format';
import {DeliveryReceiver} from './delivery';
import {strictJson} from './migration-source';
import {snapshot,validateSourceRecord,envelopeDigest,digest,RateLimitError} from './migration-core';
import {encryptSecret,decryptSecret} from './crypto';
import {VaultError} from './types';
export interface SelfRun {
 task_id:string;task_revision:string;batch_id:string;snapshot_id:string;vault_revision:string;
 delivery_epoch:string;recipient:string;expires_at:string;record_count:string;chunk_count:string;source_bytes:string;
}
export type SelfApi=(path:string,body?:unknown)=>Promise<any>;
const count=(s:unknown,max:number)=>{requireThat(typeof s==='string'&&/^(0|[1-9][0-9]*)$/.test(s)&&BigInt(s)<=BigInt(max));return Number(s);};
export function validateRun(r:SelfRun){object(r,['task_id','task_revision','batch_id','snapshot_id','vault_revision','delivery_epoch','recipient','expires_at','record_count','chunk_count','source_bytes']);for(const k of ['task_id','batch_id','snapshot_id'] as const)uuid(r[k]);for(const k of ['task_revision','vault_revision','delivery_epoch','expires_at'] as const)decimal(r[k]);requireThat(/^[A-Za-z0-9_-]{43}$/.test(r.recipient));const total=count(r.record_count,2000),chunks=count(r.chunk_count,2000);requireThat(total>0&&chunks>0&&chunks<=total&&count(r.source_bytes,8*1024*1024)>0);return {total,chunks};}
export async function selfMigrate(run:SelfRun,v:any,key:CryptoKey,receiver:DeliveryReceiver,api:SelfApi,progress:(p:{staged:number;verified:number;total:number;waitingUntil?:number})=>void,sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))){
 const {total,chunks}=validateRun(run);let counts={staged:0,verified:0,total};const root='/vault/self-service-migrations/'+run.task_id;
 const retry=async<T>(action:()=>Promise<T>):Promise<T>=>{for(let attempt=0;;attempt++){try{return await action();}catch(e){if(attempt>=3)throw e;let delay=0;if(e instanceof RateLimitError){requireThat(Number.isFinite(e.retryAfterMs)&&e.retryAfterMs>=0&&e.retryAfterMs<=900000);delay=e.retryAfterMs;}else if(e instanceof VaultError&&e.code==='MIGRATION_NETWORK')delay=1000*2**attempt;else throw e;progress({...counts,waitingUntil:Date.now()+delay});await sleep(delay);progress(counts);}}};
 const request=(path:string,body?:unknown)=>retry(()=>api(path,body));
 const read=()=>snapshot((path:string)=>request(path),run.batch_id,total);
 let snap=await read();
 const binding=()=>{requireThat(snap.batch.user_id===v.user_id&&snap.batch.vault_id===v.vault_id&&snap.batch.record_count===total&&['exported','staged','verified'].includes(snap.batch.state));};binding();
 let manifestText='',seen=0,sourceBytes=0,last=0n;const checked=new Map<string,string>();
 const report=()=>{counts={staged:snap.batch.staged_count,verified:snap.batch.verified_count,total};progress(counts);};report();
 const send=async(kind:string,records:any[])=>{const body={request_id:crypto.randomUUID(),expected_revision:snap.batch.revision,records};requireThat(records.length>0&&records.length<=100&&utf8(JSON.stringify(body)).length<=(kind==='stage'?2097152:65536));await retry(async()=>{try{return await api(root+'/'+kind,body);}catch(e){if(e instanceof VaultError&&e.code==='MIGRATION_NETWORK'){snap=await read();binding();}throw e;}});snap=await read();binding();report();};
 for(let i=1;i<=chunks;i++){
  const delivery=await request(root+'/source-chunks',{snapshot_id:run.snapshot_id,delivery_epoch:run.delivery_epoch,chunk_id:String(i)});
  object(delivery,['snapshot_id','delivery_epoch','chunk_id','jwe','server_now']);requireThat(delivery.snapshot_id===run.snapshot_id&&delivery.delivery_epoch===run.delivery_epoch&&delivery.chunk_id===String(i)&&typeof delivery.jwe==='string');
  const bytes=await receiver.open(delivery.jwe,{version:'self-service-v1',purpose:'migration-source',recipient:run.recipient,user_id:v.user_id,vault_id:v.vault_id,task_id:run.task_id,batch_id:run.batch_id,snapshot_id:run.snapshot_id,delivery_epoch:run.delivery_epoch,chunk_id:String(i),expires_at:run.expires_at},delivery.server_now);
  let chunk:any;
  try{
   sourceBytes+=bytes.length;requireThat(sourceBytes<=8*1024*1024&&sourceBytes<=Number(run.source_bytes));
   chunk=strictJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));object(chunk,['protocol','snapshot_id','chunk_id','chunk_count','record_count','records','manifest']);
   requireThat(chunk.protocol==='self-service-v1'&&chunk.snapshot_id===run.snapshot_id&&chunk.chunk_id===String(i)&&chunk.chunk_count===run.chunk_count&&chunk.record_count===run.record_count);
   requireThat(Array.isArray(chunk.records)&&chunk.records.length>0&&chunk.records.length<=100&&seen+chunk.records.length<=total);
   const m=object(chunk.manifest,['records','sha256']);requireThat(Array.isArray(m.records)&&m.records.length===total);const text=JSON.stringify(m.records);requireThat(await digest(utf8(text))===m.sha256);
   if(!manifestText){manifestText=text;let previous=0n;for(let j=0;j<total;j++){const row=m.records[j];requireThat(Array.isArray(row)&&row.length===3);decimal(row[0]);decimal(row[1]);requireThat(BigInt(row[0])>previous);previous=BigInt(row[0]);const stored=snap.records[j];requireThat(row[0]===stored.id&&row[1]===stored.source_revision&&row[2]===stored.deleted_at);}}
   else requireThat(text===manifestText);
   const match=()=>chunk.records.forEach((s:any,j:number)=>{const d=snap.records[seen+j];object(d,['id','source_revision','metadata','deleted_at','secret_envelope','envelope_sha256','verified']);requireThat(typeof d.verified==='boolean'&&s.id===d.id&&s.source_revision===d.source_revision&&s.deleted_at===d.deleted_at&&Object.keys(s.metadata).length===Object.keys(d.metadata).length);for(const k of Object.keys(s.metadata))requireThat(JSON.stringify(s.metadata[k])===JSON.stringify(d.metadata[k]));});
   for(const s of chunk.records){validateSourceRecord(s,snap.batch);requireThat(BigInt(s.id)>last);last=BigInt(s.id);}match();
   const missing=chunk.records.filter((_:any,j:number)=>!snap.records[seen+j].secret_envelope),stage=[];
   if(missing.length){const live=await request('/vault');requireThat(live.user_id===v.user_id&&live.vault?.vault_id===v.vault_id&&live.vault.vault_key_version===v.vault_key_version&&live.vault.credential_version===v.credential_version);
    for(const s of missing){const c={user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:crypto.randomUUID(),secret_version:1};stage.push({id:s.id,source_revision:s.source_revision,secret_envelope:await encryptSecret(key,c,s.legacy_value,live.vault.dek_wrap_count+stage.length)});}await send('stage',stage);match();}
   const receipts=[];
   for(let j=0;j<chunk.records.length;j++){const s=chunk.records[j],d=snap.records[seen+j],e=d.secret_envelope;requireThat(e&&e.secret_version===1);const hash=await envelopeDigest(e);requireThat(hash===d.envelope_sha256);const plain=await decryptSecret(key,{user_id:v.user_id,vault_id:v.vault_id,vault_key_version:v.vault_key_version,secret_id:e.secret_id,secret_version:e.secret_version},e);requireThat(plain===s.legacy_value);checked.set(s.id,hash);if(!d.verified)receipts.push({id:s.id,source_revision:s.source_revision,envelope_sha256:hash});}
   if(receipts.length)await send('receipt',receipts);
   seen+=chunk.records.length;
  }finally{bytes.fill(0);if(chunk?.records)for(const s of chunk.records)s.legacy_value='';chunk=undefined;}
 }
 requireThat(seen===total&&sourceBytes===Number(run.source_bytes));snap=await read();binding();requireThat(snap.batch.state==='verified'&&snap.batch.verified_count===total);
 requireThat(JSON.stringify(snap.records.map((r:any)=>[r.id,r.source_revision,r.deleted_at]))===manifestText);
 const secrets=new Set<string>();let lines='';for(const r of snap.records){requireThat(r.secret_envelope&&!secrets.has(r.secret_envelope.secret_id));secrets.add(r.secret_envelope.secret_id);requireThat(r.verified&&checked.get(r.id)===r.envelope_sha256&&await envelopeDigest(r.secret_envelope)===r.envelope_sha256);lines+=JSON.stringify([r.id,r.source_revision,r.envelope_sha256])+'\n';}
 const task=await request(root);requireThat(task.task_id===run.task_id&&task.vault_id===v.vault_id&&task.snapshot?.snapshot_id===run.snapshot_id&&task.batch?.batch_id===run.batch_id&&task.snapshot.record_count===run.record_count&&task.snapshot.vault_revision===run.vault_revision&&task.delivery?.epoch===run.delivery_epoch&&task.delivery?.recipient===run.recipient&&task.phase==='client_processing');decimal(task.revision);
 const body={request_id:crypto.randomUUID(),expected_task_revision:task.revision,expected_batch_revision:snap.batch.revision,snapshot_id:run.snapshot_id,delivery_epoch:run.delivery_epoch,manifest_sha256:await digest(utf8(lines))};
 // Finalize is never retried after an uncertain response: query persisted state.
 const accepted=(state:any)=>{requireThat(state.task_id===run.task_id&&state.vault_id===v.vault_id&&state.batch?.batch_id===run.batch_id&&state.snapshot?.snapshot_id===run.snapshot_id&&['finalizing','auditing','completed'].includes(state.phase));if(state.phase==='completed')requireThat(state.batch.state==='switched'&&state.audit?.complete===true&&state.audit.state==='passed'&&state.completion_gate===false&&state.frozen===false);return {accepted:true as const,phase:state.phase};};
 try{const result=await api(root+'/finalize',body);requireThat(result.accepted===true);return accepted(result.task);}
 catch(e){if(e instanceof VaultError&&e.code==='MIGRATION_NETWORK')return accepted(await request(root));throw e;}
}
