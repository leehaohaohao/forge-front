import {ApiError} from '@/lib/api-error';
import type {FlowStatus} from '@/lib/vault/flow';
import type {PreparationTask} from './vault-migration';
export async function migrationCompletion(data:FlowStatus,readSelf:()=>Promise<any>,readLegacy:()=>Promise<{active:PreparationTask|null;latest:PreparationTask|null}>){
 const batch=data.latest_batch!;
 const clean=!data.frozen&&!data.active_batch&&!data.migration_required&&data.counts.legacy_active===0&&data.counts.legacy_deleted===0&&data.audit.complete;
 let result:any;
 if(data.self_service){try{result=await readSelf();}catch(e){if(!(e instanceof ApiError&&e.businessCode===40910))throw e;}}
 const selfTask=[result?.active,result?.latest].find(t=>t&&t.vault_id===data.vault?.vault_id&&t.batch?.batch_id===batch.batch_id);
 // A matching self-service owner is authoritative even when incomplete. Never
 // mask an adopted task's failed audit with an old completed F2 receipt.
 if(selfTask)return {selfTask,task:undefined,complete:clean&&selfTask.phase==='completed'&&selfTask.batch.state==='switched'&&selfTask.audit?.complete===true&&!selfTask.completion_gate&&!selfTask.frozen};
 const legacy=await readLegacy();const task=[legacy.active,legacy.latest].find(t=>t&&t.vault_id===data.vault?.vault_id&&t.batch?.batch_id===batch.batch_id);
 return {task,selfTask:undefined,complete:!!task&&clean&&task.state==='completed'&&task.audit_complete===true&&!task.frozen&&task.batch?.state==='switched'&&task.batch.revision===batch.revision};
}

let completed:{token:string|null;task:any;until:number}|undefined;
export function rememberCompletedTask(task:any){
 if(task?.phase==='completed'&&task.batch?.state==='switched'&&task.audit?.complete===true&&!task.frozen&&!task.completion_gate)
  completed={token:localStorage.getItem('forge_token'),task:structuredClone(task),until:performance.now()+30000};
}
export function consumeCompletedTask(flow:FlowStatus){
 const cached=completed;completed=undefined;
 if(cached&&cached.token===localStorage.getItem('forge_token')&&performance.now()<cached.until&&cached.task.vault_id===flow.vault?.vault_id&&cached.task.batch.batch_id===flow.latest_batch?.batch_id&&cached.task.batch.revision===flow.latest_batch?.revision)return {active:null,latest:cached.task};
}
