import {object,requireThat,uuid,decimal} from './format';
export interface SelfService {protocol:string;execution_supported:boolean;blockers:string[];start:{allowed:boolean;reason:string|null};resume:{allowed:boolean;reason:string|null};cancel:{allowed:boolean;reason:string|null};active_task:null|{phase:string;failure_code:string|null;retryable:boolean};[key:string]:unknown}
export function parseSelfService(input:unknown):SelfService {
 const s=object(input,['protocol','configured','execution_supported','blockers','start','resume','cancel','local_unlock_required','recovery_verification_required','schema_state','session_revocation_supported','active_task']);
 requireThat(s.protocol==='self-service-v1');for(const k of ['configured','execution_supported','local_unlock_required','recovery_verification_required','session_revocation_supported'])requireThat(typeof s[k]==='boolean');
 requireThat(Array.isArray(s.blockers)&&s.blockers.every(x=>typeof x==='string'));
 for(const k of ['start','resume','cancel']){const op=object(s[k],['allowed','reason']);requireThat(typeof op.allowed==='boolean'&&(op.reason===null||typeof op.reason==='string'));}
 requireThat(['missing','incompatible','compatible'].includes(String(s.schema_state)));
 if(s.active_task!==null){const t=object(s.active_task,['task_id','phase','revision','failed_phase','failure_code','retryable']);uuid(t.task_id);decimal(t.revision);requireThat(['preparing','client_processing','finalizing','auditing','failed','canceled','completed'].includes(String(t.phase)));requireThat(typeof t.phase==='string'&&typeof t.retryable==='boolean'&&(t.failure_code===null||typeof t.failure_code==='string'));}
 return s as unknown as SelfService;
}
export function selfServiceLabel(s?:SelfService){
 const phase=s?.active_task?.phase;
 if(phase==='failed')return '迁移失败，请刷新状态后重试';
 if(phase==='preparing')return '系统正在准备迁移';
 if(phase==='client_processing')return '迁移已暂停，等待继续';
 if(phase==='finalizing'||phase==='auditing')return '正在完成迁移';
 return '迁移功能暂不可用';
}
// Front1 prototype: adapters are supplied by synthetic tests only. No production
// create/session endpoint is enabled until backend preparation and delivery exist.
export class StartPrototype {
 private generation=0;private running=false;private grant:unknown;
 cancel(){this.generation++;this.running=false;this.grant=undefined;}
 async start(adapters:{unlock:()=>Promise<void>;recipient:()=>Promise<unknown>;reauth:()=>Promise<string>;confirm:()=>Promise<boolean>;create:(key:unknown,proof:string)=>Promise<unknown>}){
  if(this.running)return;this.running=true;const generation=this.generation;
  const guard=()=>{if(generation!==this.generation)throw new Error('CANCELED');};let proof='';
  try{await adapters.unlock();guard();const key=await adapters.recipient();guard();proof=await adapters.reauth();guard();if(!await adapters.confirm())return;guard();const grant=await adapters.create(key,proof);guard();this.grant=grant;return true;}
  finally{proof='';if(generation===this.generation)this.running=false;}
 }
}
