import {rememberCompletedTask} from '@/services/migration-completion';
import {useEffect,useId,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Space,Typography} from 'antd';
import {ApiError} from '@/lib/api-error';
import api from '@/lib/api';
import {currentVault,vaultSession} from '@/lib/vault/runtime';
import {SelfMigrationClient} from '@/services/vault-self-service';
import {vaultMessage} from '@/lib/vault/messages';
import type {FlowStatus} from '@/lib/vault/flow';
export default function SelfServiceMigration({flow,onRefresh,onUnlock,onRunningChange,unlocked}:{flow:FlowStatus;onRefresh:()=>void;onUnlock:()=>void;onRunningChange:(v:boolean)=>void;unlocked:boolean}){
 const form=useId(),[task,setTask]=useState<any>(),[password,setPassword]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pollError,setPollError]=useState('');
 const scope=useRef<{active:boolean;busy:boolean;client?:SelfMigrationClient;abort:AbortController}>({active:false,busy:false,abort:new AbortController()});
 const callbacks=useRef({onRefresh,onRunningChange});callbacks.current={onRefresh,onRunningChange};
 useEffect(()=>{const s={active:true,busy:false,abort:new AbortController(),client:undefined as SelfMigrationClient|undefined};scope.current=s;let timer:ReturnType<typeof setTimeout>;let delay=15000;let previous:any;
 const poll=async()=>{if(document.hidden||s.busy){timer=setTimeout(poll,15000);return;}try{const r=(await api.get('/vault/self-service-migrations',{signal:s.abort.signal})).data.data;const t=r.active??r.latest;if(!s.active)return;if(s.busy)return;setTask(t);setPollError('');delay=15000;const changed=!!previous&&!!t&&previous.task_id===t.task_id&&previous.phase!==t.phase;previous=t;if(changed&&(t?.phase==='completed'||t?.phase==='canceled')){rememberCompletedTask(t);callbacks.current.onRefresh();}}catch(e){if(s.active){setPollError(vaultMessage(e));delay=e instanceof ApiError&&e.kind==='rate-limit'?Math.max(15000,(e.retryAfterSeconds??60)*1000):Math.min(delay*2,60000);}}finally{if(s.active)timer=setTimeout(poll,delay);}};void poll();
 const off=vaultSession.subscribe(()=>{if(vaultSession.state==='locked'){s.client?.close();setPassword('');if(s.busy)setError('本地迁移已暂停。解锁后可继续，已提交的进度会保留。');}});
 return()=>{s.active=false;clearTimeout(timer);s.abort.abort();s.client?.close();off();callbacks.current.onRunningChange(false);};},[]);
 async function run(action:'process'|'retry'|'cancel'){
  const s=scope.current;if(s.busy||!s.active)return;if(!unlocked){onUnlock();return;}s.busy=true;setBusy(true);setError('');callbacks.current.onRunningChange(true);const account={password};setPassword('');
  try{const v=await currentVault(s.abort.signal);if(!s.active)return;const client=new SelfMigrationClient(vaultSession,v);s.client=client;
   let t=await client.establish(account,task&&!['completed','canceled'].includes(task.phase)?{resume:{taskId:task.task_id,revision:task.revision,replaceExisting:true},cancelOnly:action==='cancel'}:{resumeExisting:true});
   if(action!=='process')t=await client.act(action,t);
   while(s.active){setTask(t);if(t.phase==='client_processing'&&action!=='cancel'){await client.process(()=>{});break;}if(!['preparing'].includes(t.phase))break;let wait=15000;
    for(;;){await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);s.abort.signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,wait);s.abort.signal.addEventListener('abort',done,{once:true});});if(!s.active)return;
     try{t=await client.read();break;}catch(e){if(e instanceof ApiError&&e.kind==='rate-limit'){wait=Math.max(15000,(e.retryAfterSeconds??60)*1000);continue;}throw e;}}
   }
   if(s.active)callbacks.current.onRefresh();
  }catch(e){if(s.active)setError(vaultMessage(e));}finally{account.password='';s.client?.close();s.client=undefined;s.busy=false;if(s.active){setBusy(false);callbacks.current.onRunningChange(false);}}
 }
 const allowed=flow.self_service?.execution_supported&&(flow.self_service.start.allowed||flow.self_service.resume.allowed);
 const final=task&&['finalizing','auditing'].includes(task.phase);
 const completed=task?.phase==='completed'&&task.batch?.state==='switched'&&task.audit?.complete===true&&!task.completion_gate&&!task.frozen;
 return <Space orientation="vertical">
 <Typography.Text role="status">{completed?'迁移完成，切换和审计已通过':final?'系统正在完成切换和审计，可稍后查看结果':busy?'正在处理，请保持页面打开':task?.phase==='failed'?'迁移未完成，请根据当前状态重试或取消':'解锁后可开始或继续迁移'}</Typography.Text>
 {task?.counts&&<Typography.Text>已暂存 {task.counts.staged}/{task.counts.total} · 已验证 {task.counts.verified}/{task.counts.total}</Typography.Text>}
 {(error||pollError)&&<Alert type="error" title={error||pollError}/>}
 {!unlocked?<Button onClick={onUnlock}>解锁保险库</Button>:!completed&&!final&&<><form id={form} autoComplete="off" onSubmit={e=>e.preventDefault()}/><Input.Password form={form} name="migration-account-confirmation" autoComplete="current-password" aria-label="迁移账号登录密码" placeholder="账号登录密码（不是保险库密码）" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/><Checkbox checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}>包含已删除历史记录；迁移期间暂停写入。继续会替换其他页面的交付会话。</Checkbox><Space><Button type="primary" disabled={!allowed||busy||!password||!confirmed||(task?.phase==='failed'&&!task.retryable)} onClick={()=>void run(task?.phase==='failed'?'retry':'process')}>{task&&!['canceled','completed'].includes(task.phase)?'继续迁移':'一键迁移'}</Button>{task?.can_cancel&&<Button disabled={busy||!password||!confirmed} onClick={()=>void run('cancel')}>取消迁移并解除冻结</Button>}</Space></>}
 {task?.phase==='failed'&&!task.retryable&&<Alert type="error" title="当前任务不能自动重试，请保留现有数据并检查完整性或部署状态。"/>}
 {completed&&<Typography.Text>加密备份：{task.post_backup?.state??'pending'}。备份生成不代表独立恢复验证已完成。</Typography.Text>}
 </Space>;
}
