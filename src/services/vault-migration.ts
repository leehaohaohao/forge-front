import api,{type ApiResponse} from '@/lib/api';
import {ApiError} from '@/lib/api-error';
import {object,decimal,uuid,requireThat,utf8,validateEnvelope} from '@/lib/vault/format';
import {validateBatch} from '@/lib/vault/migration-core';
import type {FlowStatus} from '@/lib/vault/flow';
import type {MigrationHost,MigrationRequest,MigrationReply} from '@/lib/vault/migration-protocol';
import {readVault} from './vault';
export type TaskState='requested'|'preparing'|'awaiting_source'|'ready_for_local'|'awaiting_cutover'|'failed'|'canceled'|'completed';
export interface PreparationTask {
  task_id:string;user_id:string;vault_id:string;state:TaskState;revision:string;batch:ReturnType<typeof validateBatch>|null;
  operator_id:string|null;failure_code:string|null;next_action:string;frozen:boolean;can_cancel:boolean;
  source_exported_at:string|null;delivered_at:string|null;created_at:string;updated_at:string;
}
export function parseTask(input:unknown,flow:FlowStatus):PreparationTask {
  const d=object(input,['task_id','user_id','vault_id','state','revision','batch','operator_id','failure_code','next_action','frozen','can_cancel','source_exported_at','delivered_at','created_at','updated_at']);
  uuid(d.task_id);uuid(d.vault_id);decimal(d.user_id);decimal(d.revision);if(d.operator_id!==null)decimal(d.operator_id);
  requireThat(d.user_id===flow.user_id&&d.vault_id===flow.vault?.vault_id);
  requireThat(['requested','preparing','awaiting_source','ready_for_local','awaiting_cutover','failed','canceled','completed'].includes(String(d.state)));
  requireThat(['wait_for_operator','operator_prepare','operator_deliver_source','select_local_source','operator_verify_cutover','operator_retry','request_again','none'].includes(String(d.next_action)));
  requireThat(d.failure_code===null||['source_invalid','backup_required','delivery_failed','preparation_failed','export_failed'].includes(String(d.failure_code)));
  for(const k of ['frozen','can_cancel'])requireThat(typeof d[k]==='boolean');
  for(const k of ['source_exported_at','delivered_at','created_at','updated_at'])requireThat(d[k]===null||typeof d[k]==='string'&&Number.isFinite(Date.parse(d[k] as string)));
  if(d.batch!==null){const b=validateBatch(d.batch);requireThat(b.user_id===d.user_id&&b.vault_id===d.vault_id);}
  requireThat(!d.can_cancel||(d.state==='requested'&&d.batch===null&&!d.frozen));
  if(d.state==='ready_for_local')requireThat(d.frozen&&d.batch!==null&&d.delivered_at!==null&&d.source_exported_at!==null);return input as PreparationTask;
}
const backoff=new Map<string,number>();
async function taskRequest<T>(user:string,action:()=>Promise<T>):Promise<T> {
  const remaining=(backoff.get(user)??0)-Date.now();
  if(remaining>0)throw new ApiError('rate-limit',429,429,undefined,Math.ceil(remaining/1000));
  try{return await action();}catch(e){if(e instanceof ApiError&&e.kind==='rate-limit')backoff.set(user,Date.now()+(e.retryAfterSeconds??60)*1000);throw e;}
}
export async function readTasks(flow:FlowStatus,signal:AbortSignal) {
  const d=object((await taskRequest(flow.user_id,()=>api.get<ApiResponse<unknown>>('/vault/migration-requests',{signal}))).data.data,['active','latest']);
  return {active:d.active===null?null:parseTask(d.active,flow),latest:d.latest===null?null:parseTask(d.latest,flow)};
}
export async function requestPreparation(id:string,flow:FlowStatus,signal:AbortSignal) {
  uuid(id);return parseTask((await taskRequest(flow.user_id,()=>api.post<ApiResponse<unknown>>('/vault/migration-requests',{request_id:id},{signal}))).data.data,flow);
}
export async function cancelPreparation(task:PreparationTask,flow:FlowStatus,signal:AbortSignal) {
  return parseTask((await taskRequest(flow.user_id,()=>api.post<ApiResponse<unknown>>(`/vault/migration-requests/${task.task_id}/cancel`,{expected_revision:task.revision},{signal}))).data.data,flow);
}
export interface MigrationCredentials {password:string;authorization:string}
// The Worker bridge is intentionally restricted to M1 ciphertext requests. It cannot
// upload a source file or invoke arbitrary business endpoints.
export function migrationHost(flow:FlowStatus,batch:string,credentials:MigrationCredentials,signal:AbortSignal):MigrationHost {
  uuid(batch);
  return async(request:MigrationRequest):Promise<MigrationReply>=>{
    try {
      if(signal.aborted)return {ok:false,code:'STALE'};
      if(request.kind==='reauth'){
        requireThat(credentials.password.length>0);
        credentials.authorization=(await api.post<ApiResponse<{reauth_token:string}>>('/auth/reauth',{account_password:credentials.password,purpose:'vault_migration'},{signal})).data.data.reauth_token;
        return {ok:true,value:true};
      }
      requireThat(request.kind==='api');
      const prefix='/vault/migrations/'+batch,path=request.path;
      if(request.body===undefined){
        if(path==='/vault'){const data=await readVault(signal);requireThat(data.user_id===flow.user_id&&data.vault?.vault_id===flow.vault?.vault_id);return {ok:true,value:data};}
        requireThat(path===prefix||path.startsWith(prefix+'?after='));
        if(path!==prefix)decimal(path.slice((prefix+'?after=').length));
        return {ok:true,value:(await api.get<ApiResponse<unknown>>(path,{signal})).data.data};
      }
      requireThat(path===prefix+'/stage'||path===prefix+'/receipt');
      const body=object(request.body,['request_id','expected_revision','records']);uuid(body.request_id);decimal(body.expected_revision);
      requireThat(Array.isArray(body.records)&&body.records.length>0&&body.records.length<=100);
      const stage=path.endsWith('/stage');requireThat(utf8(JSON.stringify(body)).length<=(stage?2*1024*1024:64*1024));
      for(const item of body.records){
        const row=object(item,['id','source_revision',stage?'secret_envelope':'envelope_sha256']);decimal(row.id);decimal(row.source_revision);
        if(stage){const envelope=row.secret_envelope as any;validateEnvelope(envelope,{user_id:flow.user_id,vault_id:flow.vault!.vault_id,vault_key_version:flow.vault!.vault_key_version,secret_id:envelope.secret_id,secret_version:1});}
        else requireThat(typeof row.envelope_sha256==='string'&&/^[0-9a-f]{64}$/.test(row.envelope_sha256));
      }
      requireThat(credentials.authorization);
      return {ok:true,value:validateBatch((await api.post<ApiResponse<unknown>>(path,body,{signal,headers:{'X-Forge-Reauth':credentials.authorization}})).data.data)};
    }catch(e){
      if(signal.aborted)return {ok:false,code:'STALE'};
      if(e instanceof ApiError){
        if(e.kind==='rate-limit')return {ok:false,code:'MIGRATION_RATE_LIMIT',retryAfterMs:Math.max(1000,(e.retryAfterSeconds??60)*1000)};
        if(e.kind==='reauth')return {ok:false,code:'MIGRATION_AUTH'};
        if(e.kind==='conflict'||e.kind==='not-found')return {ok:false,code:'MIGRATION_CONFLICT'};
        if(e.kind==='network'||e.kind==='unavailable')return {ok:false,code:'MIGRATION_NETWORK'};
        if(e.kind==='unauthorized'||e.kind==='canceled')return {ok:false,code:'STALE'};
      }
      return {ok:false,code:'INVALID_FORMAT'};
    }
  };
}
