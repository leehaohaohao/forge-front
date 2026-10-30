import api,{type ApiResponse} from '@/lib/api';
import {ApiError} from '@/lib/api-error';
import {object,decimal,uuid,requireThat,utf8,validateEnvelope} from '@/lib/vault/format';
import {fingerprint} from '@/lib/vault/delivery';
import {validateBatch} from '@/lib/vault/migration-core';
import {validateRun,type SelfRun} from '@/lib/vault/self-migration';
import {VaultError,type VaultRead} from '@/lib/vault/types';
import type {VaultSession} from '@/lib/vault/session';
import type {MigrationHost,MigrationProgress} from '@/lib/vault/migration-protocol';

const root='/vault/self-service-migrations';
export interface SelfTransport {
 request(path:string,body:unknown|undefined,signal:AbortSignal,headers?:Record<string,string>):Promise<{data:any;date:string}>;
}
const http:SelfTransport={async request(path,body,signal,headers){
 const r=body===undefined?await api.get<ApiResponse<unknown>>(path,{signal,headers}):await api.post<ApiResponse<unknown>>(path,body,{signal,headers});
 return {data:r.data.data,date:String(r.headers.date??'')};
}};
interface Grant {token:string;expires_at:string;delivery_epoch:string;recipient:string;scope:'migration'|'cancel_only'}
// This controller has no production UI entry until backend3/frontend3. All secrets
// remain in memory; closing it aborts HTTP and terminates an active Worker run.
export class SelfMigrationClient {
 private controller=new AbortController();private epoch:number;private off:()=>void;
 private grant?:Grant;private pair?:{publicKey:JsonWebKey;recipient:string};private busy=false;
 private clock?:{seconds:number;at:number};private taskId?:string;
 constructor(private session:VaultSession,private vault:VaultRead,private transport:SelfTransport=http){
  this.epoch=session.epoch;this.off=session.subscribe(()=>{if(!session.isCurrent(this.epoch)||session.state!=='unlocked')this.clear();});
 }
 private clear(){this.controller.abort();this.grant=undefined;this.pair=undefined;this.off?.();}
 close(){this.clear();if(this.busy&&this.session.isCurrent(this.epoch))this.session.lock();}
 private guard(){if(this.controller.signal.aborted||!this.session.isCurrent(this.epoch))throw new VaultError('STALE');if(this.session.state!=='unlocked')throw new VaultError('LOCKED');}
 private now(){requireThat(this.clock);return this.clock!.seconds+Math.ceil((performance.now()-this.clock!.at)/1000);}
 private async request(path:string,body?:unknown,headers?:Record<string,string>){
  this.guard();const started=performance.now();const r=await this.transport.request(path,body,this.controller.signal,headers);this.guard();
  const date=Date.parse(r.date);requireThat(Number.isFinite(date));
  // Date is calibrated per server response, with a conservative RTT allowance.
  this.clock={seconds:Math.floor(date/1000)+Math.ceil((performance.now()-started)/1000),at:performance.now()};return r.data;
 }
 private task(t:any){
  requireThat(t?.protocol==='self-service-v1'&&t.vault_id===this.vault.vault_id);uuid(t.task_id);decimal(t.revision);
  if(this.taskId)requireThat(t.task_id===this.taskId);return t;
 }
 async establish(account:{password:string},options:{resume?:{taskId:string;revision:string;replaceExisting:boolean};resumeExisting?:boolean;cancelOnly?:boolean}){
  this.guard();if(this.busy)throw new VaultError('STALE');this.busy=true;let proof='';
  try{
   this.grant=undefined;this.pair=await this.session.selfRecipient();this.guard();
   requireThat(this.pair.recipient===await fingerprint(this.pair.publicKey));
   try{proof=(await this.request('/auth/reauth',{account_password:account.password,purpose:'vault_migration'})).reauth_token;}finally{account.password='';}
   requireThat(typeof proof==='string'&&proof.length>0);
   let path=root,body:any={request_id:crypto.randomUUID(),expected_vault_revision:this.vault.revision,recipient_public_key:this.pair.publicKey,impact_ack:{include_deleted:true,pause_writes:true,keep_page_open:true},resume_existing:options.resumeExisting===true};
   if(options.resume){uuid(options.resume.taskId);decimal(options.resume.revision);this.taskId=options.resume.taskId;path+='/'+this.taskId+'/session';body={request_id:crypto.randomUUID(),expected_task_revision:options.resume.revision,recipient_public_key:this.pair.publicKey,replace_existing:options.resume.replaceExisting,cancel_only:options.cancelOnly===true};}
   // Never replay a one-time account proof after an uncertain response. Caller
   // queries current state and explicitly establishes a replacement session.
   const result=await this.request(path,body,{'X-Vault-Reauth':proof});object(result,['task','authorization']);const task=this.task(result.task);this.taskId=task.task_id;
   if(result.authorization===null)throw new VaultError('SELF_AUTH');
   const g=object(result.authorization,['token','expires_at','delivery_epoch','recipient','scope']);decimal(g.delivery_epoch);
   const expiry=Date.parse(String(g.expires_at))/1000;
   requireThat(typeof g.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(g.token)&&g.scope===(options.cancelOnly?'cancel_only':'migration')&&g.recipient===this.pair.recipient&&Number.isFinite(expiry)&&expiry>this.now()&&expiry<=this.now()+900);
   requireThat(task.delivery?.epoch===g.delivery_epoch&&task.delivery?.recipient===g.recipient&&task.delivery?.expires_at===g.expires_at);
   this.grant=g as unknown as Grant;return task;
  }finally{proof='';account.password='';this.busy=false;}
 }
 async act(kind:'retry'|'cancel',task:any){
  this.guard();requireThat(this.grant&&task.task_id===this.taskId);decimal(task.revision);
  return this.task(await this.request(root+'/'+this.taskId+'/'+kind,{request_id:crypto.randomUUID(),expected_task_revision:task.revision},{'X-Vault-Migration-Authorization':this.grant!.token}));
 }
 async current(){return this.request(root);}
 async read(){requireThat(this.taskId);return this.task(await this.request(root+'/'+this.taskId));}
 private host(run:SelfRun):MigrationHost {return async request=>{
  try{
   this.guard();requireThat(request.kind==='api');const prefix=root+'/'+run.task_id,batch='/vault/migrations/'+run.batch_id,path=request.path,body=request.body;
   if(body===undefined){
    requireThat(path==='/vault'||path===prefix||path===batch||path.startsWith(batch+'?after='));
    if(path.startsWith(batch+'?after='))decimal(path.slice((batch+'?after=').length));
    const value=await this.request(path);if(path===prefix)this.task(value);if(path==='/vault')requireThat(value.user_id===this.vault.user_id&&value.vault?.vault_id===this.vault.vault_id);return {ok:true,value};
   }
   requireThat(this.grant&&this.grant.scope==='migration'&&this.grant.recipient===run.recipient&&this.grant.delivery_epoch===run.delivery_epoch);
   if(Math.floor(Date.parse(this.grant!.expires_at)/1000)<=this.now())throw new VaultError('SELF_AUTH');
   if(path===prefix+'/source-chunks'){
    const b=object(body,['snapshot_id','delivery_epoch','chunk_id']);decimal(b.chunk_id);requireThat(b.snapshot_id===run.snapshot_id&&b.delivery_epoch===run.delivery_epoch&&BigInt(b.chunk_id as string)<=BigInt(run.chunk_count));
   }else if(path===prefix+'/stage'||path===prefix+'/receipt'){
    const b=object(body,['request_id','expected_revision','records']);uuid(b.request_id);decimal(b.expected_revision);requireThat(Array.isArray(b.records)&&b.records.length>0&&b.records.length<=100);
    const stage=path.endsWith('/stage');requireThat(utf8(JSON.stringify(b)).length<=(stage?2097152:65536));
    for(const x of b.records){const row=object(x,['id','source_revision',stage?'secret_envelope':'envelope_sha256']);decimal(row.id);decimal(row.source_revision);
     if(stage){const e=row.secret_envelope as any;validateEnvelope(e,{user_id:this.vault.user_id,vault_id:this.vault.vault_id,vault_key_version:this.vault.vault_key_version,secret_id:e.secret_id,secret_version:1});}
     else requireThat(typeof row.envelope_sha256==='string'&&/^[0-9a-f]{64}$/.test(row.envelope_sha256));}
   }else{
    requireThat(path===prefix+'/finalize');const b=object(body,['request_id','expected_task_revision','expected_batch_revision','snapshot_id','delivery_epoch','manifest_sha256']);uuid(b.request_id);decimal(b.expected_task_revision);decimal(b.expected_batch_revision);requireThat(b.snapshot_id===run.snapshot_id&&b.delivery_epoch===run.delivery_epoch&&typeof b.manifest_sha256==='string'&&/^[0-9a-f]{64}$/.test(b.manifest_sha256));
   }
   const value=await this.request(path,body,{'X-Vault-Migration-Authorization':this.grant!.token});
   if(path.endsWith('/source-chunks')){object(value,['snapshot_id','delivery_epoch','chunk_id','jwe']);requireThat(typeof value.jwe==='string'&&utf8(JSON.stringify(value)).length<=1572864);return {ok:true,value:{...value,server_now:this.now()}};}
   if(path.endsWith('/stage')||path.endsWith('/receipt'))validateBatch(value);
   return {ok:true,value};
  }catch(e){
   if(this.controller.signal.aborted)return {ok:false,code:'STALE'};
   if(e instanceof VaultError)return {ok:false,code:e.code};
   if(e instanceof ApiError){
    if(e.businessCode===40910)return {ok:false,code:'SELF_UNAVAILABLE'};
    if(e.businessCode===40911)return {ok:false,code:'SELF_LEASE'};
    if(e.kind==='reauth')return {ok:false,code:'SELF_AUTH'};
    if(e.kind==='rate-limit')return {ok:false,code:'MIGRATION_RATE_LIMIT',retryAfterMs:Math.max(1000,(e.retryAfterSeconds??60)*1000)};
    if(e.kind==='network'||e.kind==='unavailable')return {ok:false,code:'MIGRATION_NETWORK'};
    if(e.kind==='unauthorized'||e.kind==='canceled')return {ok:false,code:'STALE'};
    if(e.kind==='conflict'||e.kind==='not-found')return {ok:false,code:'MIGRATION_CONFLICT'};
   }return {ok:false,code:'INVALID_FORMAT'};
  }
 };}
 async process(progress:(p:MigrationProgress)=>void){
  this.guard();if(this.busy)throw new VaultError('STALE');this.busy=true;
  try{
   requireThat(this.grant&&this.pair);const t=await this.read(),g=this.grant!;
   requireThat(t.phase==='client_processing'&&t.protection?.state==='verified'&&t.frozen===true&&t.delivery?.state==='active'&&t.delivery.epoch===g.delivery_epoch&&t.delivery.recipient===g.recipient&&t.delivery.expires_at===g.expires_at);
   const run:SelfRun={task_id:t.task_id,task_revision:t.revision,batch_id:t.batch.batch_id,snapshot_id:t.snapshot.snapshot_id,vault_revision:t.snapshot.vault_revision,delivery_epoch:g.delivery_epoch,recipient:g.recipient,expires_at:String(Math.floor(Date.parse(g.expires_at)/1000)),record_count:t.snapshot.record_count,chunk_count:t.snapshot.chunk_count,source_bytes:t.snapshot.source_bytes};validateRun(run);
   return await this.session.selfMigrate(run,this.host(run),progress);
  }finally{this.grant=undefined;this.pair=undefined;this.busy=false;}
 }
}
