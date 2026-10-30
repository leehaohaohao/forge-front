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
