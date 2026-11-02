import {object,requireThat} from './format';
import type {FlowStatus} from './flow';
import {selfServiceLabel} from './self-service';
export interface Readiness {protocol:'readiness-v1';checked_at:string;conclusion:'ready'|'blocked'|'unknown';reasons:string[];source:{state:'checked'|'unknown';counts:null|Record<'total'|'deleted'|'verified'|'missing'|'mismatched'|'unsupported',string>;reasons:string[]};actions:string[]}
export function parseReadiness(input:unknown):Readiness {
 const d=object(input,['protocol','checked_at','conclusion','reasons','source','actions']);requireThat(d.protocol==='readiness-v1'&&typeof d.checked_at==='string'&&Number.isFinite(Date.parse(d.checked_at))&&['ready','blocked','unknown'].includes(String(d.conclusion)));
 for(const value of [d.reasons,d.actions])requireThat(Array.isArray(value)&&value.every(v=>typeof v==='string'));
 const s=object(d.source,['state','counts','reasons']);requireThat(['checked','unknown'].includes(String(s.state))&&Array.isArray(s.reasons)&&s.reasons.every(v=>typeof v==='string'));
 if(s.state==='unknown')requireThat(s.counts===null&&d.conclusion!=='ready');
 else{const c=object(s.counts,['total','deleted','verified','missing','mismatched','unsupported']);for(const v of Object.values(c))requireThat(typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v)&&BigInt(v)<=9223372036854775807n);const n=(k:string)=>BigInt(c[k] as string);requireThat(n('total')===n('verified')+n('missing')+n('mismatched')+n('unsupported')&&n('deleted')<=n('total'));if(d.conclusion==='ready')requireThat(n('total')===n('verified'));}
 if(d.conclusion==='ready')requireThat((d.reasons as string[]).length===0&&(s.reasons as string[]).length===0);
 return input as Readiness;
}
const labels:Record<string,string>={feature_disabled:'自助迁移未启用',configuration_invalid:'迁移部署未完成',source_registration_missing:'历史数据来源待核验',source_provenance_unverified:'历史数据来源待核验',source_binding_mismatch:'历史数据发生变化，需要重新核验',source_evidence_invalid:'历史数据来源凭据需要重新核验',source_format_unsupported:'部分历史数据暂不支持自动迁移',executor_unavailable:'迁移服务暂不可用',execution_not_implemented:'迁移服务暂不可用',backup_adapter_unavailable:'迁移保护服务暂不可用',restore_adapter_unavailable:'迁移恢复验证服务暂不可用'};
for(const key of ['schema_missing','schema_incompatible','completion_schema_missing','completion_schema_incompatible','completion_triggers_missing','source_schema_missing','source_schema_incompatible'])labels[key]='迁移部署未完成';
export function readinessView(flow:FlowStatus,unlocked:boolean,diagnostic:Readiness|null|undefined,failed=false){
 const reasons=diagnostic?[...new Set([...diagnostic.reasons,...diagnostic.source.reasons])]:flow.self_service?.blockers??[];
 const details=reasons.map(r=>r==='source_registration_missing'&&diagnostic?.source.counts?`历史数据来源待核验（${diagnostic.source.counts.missing} 条）`:labels[r]??'迁移状态暂无法确认，请刷新后重试');
 const known=reasons.every(r=>!!labels[r]);
 const allowed=!failed&&diagnostic!==undefined&&known&&reasons.length===0&&(diagnostic===null||diagnostic.conclusion==='ready')&&flow.self_service?.execution_supported===true&&(flow.self_service.start.allowed||flow.self_service.resume.allowed);
 let label=failed?'暂时无法获取迁移状态':diagnostic===undefined?'正在获取迁移状态':details[0]??(allowed?(unlocked?'可以迁移':'解锁后可迁移'):'迁移状态暂无法确认，请刷新后重试');
 if(flow.completionConfirmed===true&&flow.latest_batch?.state==='switched'&&flow.audit.complete)label='迁移已完成';
 else if(flow.self_service?.active_task)label=selfServiceLabel(flow.self_service);
 else if(!failed&&diagnostic!==undefined&&!flow.migration_required&&flow.counts.legacy_active===0&&flow.counts.legacy_deleted===0)label='无需迁移历史数据';
 if(failed&&label!=='暂时无法获取迁移状态')details.unshift('暂时无法获取迁移状态');
 return {label,details,allowed};
}
