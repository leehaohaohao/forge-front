import { decimal, uuid, version, object, requireThat } from './format';
export const operationNames=['initialize_vault','create_token','replace_secret','edit_metadata','delete_token','update_credentials','read_encrypted','export_encrypted','request_migration'] as const;
export type Capability={allowed:boolean;reason:string|null};
export type Batch={batch_id:string;user_id:string;vault_id:string;state:'frozen'|'exported'|'staged'|'verified'|'switched'|'aborted';revision:string;record_count:number;staged_count:number;verified_count:number;created_at:string;updated_at:string};
export interface FlowStatus {
  user_id:string; initialized:boolean;
  vault:null|{format_version:1;vault_id:string;revision:string;vault_key_version:number;credential_version:number};
  counts:{legacy_active:number;legacy_deleted:number;encrypted:number};
  has_migration_history:boolean; migration_required:boolean; frozen:boolean; encrypted_only:boolean;
  active_batch:Batch|null; latest_batch:Batch|null;
  audit:{state:'not_applicable'|'pending'|'complete'|'failed';complete:boolean;checked_at:string|null;switched_at:string|null};
  operations:Record<typeof operationNames[number],Capability>;
}
const count=(v:unknown)=>requireThat(Number.isSafeInteger(v) && Number(v)>=0);
const time=(v:unknown)=>requireThat(typeof v==='string' && Number.isFinite(Date.parse(v)));
export function parseFlowStatus(input:unknown):FlowStatus {
  const d=object(input,['user_id','initialized','vault','counts','has_migration_history','migration_required','frozen','encrypted_only','active_batch','latest_batch','audit','operations']);
  decimal(d.user_id);
  for(const k of ['initialized','has_migration_history','migration_required','frozen','encrypted_only'])requireThat(typeof d[k]==='boolean');
  requireThat(d.initialized===(d.vault!==null));
  if(d.vault!==null){const v=object(d.vault,['format_version','vault_id','revision','vault_key_version','credential_version']);requireThat(v.format_version===1);uuid(v.vault_id);decimal(v.revision);version(v.vault_key_version);version(v.credential_version);}
  const c=object(d.counts,['legacy_active','legacy_deleted','encrypted']);Object.values(c).forEach(count);
  for(const raw of [d.active_batch,d.latest_batch])if(raw!==null){
    const b=object(raw,['batch_id','user_id','vault_id','state','revision','record_count','staged_count','verified_count','created_at','updated_at']);
    uuid(b.batch_id);uuid(b.vault_id);decimal(b.user_id);decimal(b.revision);requireThat(b.user_id===d.user_id);
    requireThat(['frozen','exported','staged','verified','switched','aborted'].includes(String(b.state)));
    [b.record_count,b.staged_count,b.verified_count].forEach(count);
    requireThat(Number(b.verified_count)<=Number(b.staged_count) && Number(b.staged_count)<=Number(b.record_count));time(b.created_at);time(b.updated_at);
  }
  const a=object(d.audit,['state','complete','checked_at','switched_at']);requireThat(['not_applicable','pending','complete','failed'].includes(String(a.state)));requireThat(typeof a.complete==='boolean' && a.complete===(a.state==='complete'));
  for(const t of [a.checked_at,a.switched_at])if(t!==null)time(t);
  const ops=object(d.operations,[...operationNames]);
  for(const key of operationNames){const op=object(ops[key],['allowed','reason']);requireThat(typeof op.allowed==='boolean' && (op.allowed?op.reason===null:typeof op.reason==='string'));}
  return input as FlowStatus;
}
export type FlowStep='create'|'recovery'|'migration'|'use';
export function flowSteps(s:FlowStatus,draft:boolean) {
  const hasMigration=s.has_migration_history || s.counts.legacy_active>0 || s.counts.legacy_deleted>0 || !!s.active_batch || s.migration_required;
  const steps:FlowStep[]=hasMigration?['create','recovery','migration','use']:['create','recovery','use'];
  const migrated=s.latest_batch?.state==='switched' && s.latest_batch.vault_id===s.vault?.vault_id && s.audit.complete && s.audit.state==='complete';
  const needsMigration=s.migration_required || !!s.active_batch || s.frozen || s.counts.legacy_active>0 || s.counts.legacy_deleted>0 || (s.latest_batch?.state==='switched' && !migrated);
  const current:FlowStep=!s.initialized?(draft?'recovery':'create'):needsMigration?'migration':'use';
  return {steps,current};
}
export function capabilityMessage(c?:Capability) {
  if(c?.allowed)return '';
  return ({vault_not_initialized:'请先完成保险库准备',vault_already_initialized:'保险库已创建',migration_frozen:'记录迁移中，写入已暂停，请等待管理员处理',key_limit:'保险库已达到写入上限，请联系维护人员',version_limit:'数据版本已达到上限，请联系维护人员',not_supported:'迁移申请暂未开放，请联系管理员准备',no_legacy_records:'没有需要迁移的历史记录',active_request:'已有迁移申请，请查看当前任务'} as Record<string,string>)[c?.reason??''] ?? '暂时无法执行，请刷新状态后重试';
}
export function migrationSummary(s:FlowStatus) {
  const b=s.active_batch??s.latest_batch;
  if(s.audit.state==='failed')return '迁移核验失败，请联系管理员';
  if(b?.state==='switched')return s.audit.complete?'历史迁移已完成':'切换后核验中';
  if(b?.state==='verified')return `等待管理员切换 · 已验证 ${b.verified_count}/${b.record_count}`;
  if(b?.state==='staged')return `等待本地校验 · 已验证 ${b.verified_count}/${b.record_count}`;
  if(b?.state==='exported')return '等待取得源文件并本地校验';
  if(b?.state==='frozen')return '等待管理员准备源文件';
  if(b?.state==='aborted')return '上次准备已取消，请联系管理员重新准备';
  return '等待管理员准备';
}
