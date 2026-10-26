import {useEffect,useId,useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Space,Typography,Popconfirm} from 'antd';
import type {FlowStatus} from '@/lib/vault/flow';
import {capabilityMessage,migrationSummary} from '@/lib/vault/flow';
import {vaultSession,operation} from '@/lib/vault/runtime';
import {vaultMessage} from '@/lib/vault/messages';
import {ApiError} from '@/lib/api-error';
import {SOURCE_LIMIT} from '@/lib/vault/migration-source';
import {VaultError} from '@/lib/vault/types';
import type {MigrationProgress} from '@/lib/vault/migration-protocol';
import {readTasks,requestPreparation,cancelPreparation,migrationHost,type PreparationTask,type MigrationCredentials} from '@/services/vault-migration';
const taskLabels:Record<string,string>={requested:'等待管理员领取',preparing:'管理员准备中',awaiting_source:'等待管理员交付文件',ready_for_local:'请选择本地源文件',awaiting_cutover:'等待管理员最终切换',failed:'准备失败，请联系负责人',canceled:'上次准备已取消',completed:'请刷新准备状态确认核验结果'};
const failureLabels:Record<string,string>={source_invalid:'源文件不符合要求',backup_required:'需要确认可恢复的备份',delivery_failed:'文件交付失败',preparation_failed:'准备未完成',export_failed:'文件导出失败'};
export default function MigrationPanel({flow,unlocked,onUnlock,onRefresh,onRunningChange}:{flow:FlowStatus;unlocked:boolean;onUnlock:()=>void;onRefresh:()=>void;onRunningChange:(running:boolean)=>void}) {
  const [task,setTask]=useState<PreparationTask|null>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
  const [file,setFile]=useState<File>(),[password,setPassword]=useState(''),[confirmed,setConfirmed]=useState(false);
  const [progress,setProgress]=useState<MigrationProgress>(),[waitUntil,setWaitUntil]=useState(0),[now,setNow]=useState(Date.now());
  const [running,setRunning]=useState(false),formId=useId();
  const [confirmation,setConfirmation]=useState<'request'|'cancel'|null>(null);
  const picker=useRef<HTMLInputElement>(null),requestId=useRef<string|undefined>(undefined),refreshRef=useRef<()=>void>(()=>{});
  const lifecycle=useRef<{active:boolean;read?:AbortController;op?:ReturnType<typeof operation>;credentials?:MigrationCredentials;running:boolean;busy:boolean;next:number}|undefined>(undefined);
  const reset=()=>{setFile(undefined);setPassword('');setConfirmed(false);setProgress(undefined);if(picker.current)picker.current.value='';};
  useEffect(()=>{
    const scope={active:true,running:false,busy:false,next:0} as NonNullable<typeof lifecycle.current>;lifecycle.current=scope;
    const load=async()=>{
      if(scope.busy||Date.now()<scope.next||document.hidden)return;
      scope.busy=true;setBusy(true);setError('');setLoaded(false);scope.read=new AbortController();
      try{const d=await readTasks(flow,scope.read.signal);if(scope.active&&!scope.read.signal.aborted){setTask(d.active??d.latest);setLoaded(true);}}
      catch(e){if(scope.active&&!scope.read.signal.aborted){scope.next=Date.now()+(e instanceof ApiError&&e.kind==='rate-limit'?(e.retryAfterSeconds??60)*1000:10000);setWaitUntil(scope.next);setError(vaultMessage(e));}}
      finally{scope.busy=false;if(scope.active)setBusy(false);}
    };
    refreshRef.current=()=>void load();void load();
    const unsubscribe=vaultSession.subscribe(()=>{if(vaultSession.state==='locked'){
      scope.op?.cancel();if(scope.credentials){scope.credentials.password='';scope.credentials.authorization='';}reset();
    }});
    return ()=>{scope.active=false;unsubscribe();scope.read?.abort();scope.op?.cancel();if(scope.credentials){scope.credentials.password='';scope.credentials.authorization='';}if(scope.running)vaultSession.lock();refreshRef.current=()=>{};onRunningChange(false);};
  },[flow.user_id,flow.vault?.vault_id]);
  useEffect(()=>{if(!waitUntil&&!progress?.waitingUntil)return;const until=Math.max(waitUntil,progress?.waitingUntil??0);const t=setInterval(()=>{const n=Date.now();setNow(n);if(n>=until){clearInterval(t);setWaitUntil(0);}},1000);return ()=>clearInterval(t);},[waitUntil,progress?.waitingUntil]);
  const until=Math.max(waitUntil,progress?.waitingUntil??0),waiting=Math.max(0,Math.ceil((until-now)/1000));
  async function taskAction(cancel=false) {
    const scope=lifecycle.current;if(!scope?.active||scope.busy||Date.now()<scope.next)return;
    scope.busy=true;setBusy(true);setError('');scope.read=new AbortController();
    try {
      if(!requestId.current)requestId.current=crypto.randomUUID();
      const result=cancel&&task?await cancelPreparation(task,flow,scope.read.signal):await requestPreparation(requestId.current,flow,scope.read.signal);
      if(scope.active&&!scope.read.signal.aborted){setTask(result);setLoaded(true);requestId.current=undefined;onRefresh();}
    }catch(e){if(scope.active&&!scope.read.signal.aborted){setError(vaultMessage(e));if(e instanceof ApiError&&e.kind==='rate-limit'){scope.next=Date.now()+(e.retryAfterSeconds??60)*1000;setWaitUntil(scope.next);}}}
    finally{scope.busy=false;if(scope.active)setBusy(false);}
  }
  async function start() {
    const scope=lifecycle.current;if(!scope?.active||scope.busy||!file||!password||!confirmed||!unlocked||!task?.batch)return;
    const selected=file;setFile(undefined);setConfirmed(false);
    const op=operation();scope.op=op;scope.busy=true;scope.running=true;scope.credentials={password,authorization:''};setPassword('');setBusy(true);setRunning(true);onRunningChange(true);setError('');
    try {
      const latest=await readTasks(flow,op.signal);op.guard();const current=latest.active;
      if(!current||current.task_id!==task.task_id||current.state!=='ready_for_local'||current.batch?.batch_id!==task.batch.batch_id||!current.frozen)throw new VaultError('MIGRATION_CONFLICT');
      await vaultSession.migrate(selected,current.batch.batch_id,migrationHost(flow,current.batch.batch_id,scope.credentials,op.signal),p=>{if(scope.active&&!op.signal.aborted){setProgress(p);setNow(Date.now());}});op.guard();
      if(scope.active){reset();onRefresh();}
    }catch(e){if(scope.active&&!op.signal.aborted)setError(e instanceof VaultError&&e.code==='INVALID_FORMAT'?'文件或服务端暂存包校验失败。请核对文件归属、完整性和版本；不会提交失败记录的验证回执。':vaultMessage(e));}
    finally{scope.credentials.password='';scope.credentials.authorization='';scope.running=false;scope.busy=false;op.done();if(scope.active){setBusy(false);setRunning(false);onRunningChange(false);}}
  }
  const ready=loaded&&task?.state==='ready_for_local'&&task.frozen&&!!task.batch;
  const canRequest=loaded&&(!task||task.state==='canceled')&&flow.operations.request_migration.allowed;
  return <div id="vault-migration-step" tabIndex={-1} style={{marginBottom:12}}>
    <Typography.Paragraph role="status">{task?taskLabels[task.state]:migrationSummary(flow)} · 历史 {flow.counts.legacy_active} 条，已删除历史 {flow.counts.legacy_deleted} 条{task?.operator_id?` · 负责人 ${task.operator_id}`:''}</Typography.Paragraph>
    {task?.failure_code&&<Typography.Paragraph type="danger">{failureLabels[task.failure_code]}</Typography.Paragraph>}
    {error&&<Alert type="error" showIcon title={error}/>}
    {waiting>0&&<Typography.Paragraph role="status">限流或重试等待 {waiting} 秒，已提交进度保留</Typography.Paragraph>}
    <Space wrap style={{marginBlock:8}}>
      <Button disabled={busy||waiting>0} onClick={()=>{refreshRef.current();onRefresh();}}>刷新迁移状态</Button>
      {canRequest&&<Popconfirm open={confirmation==='request'} onOpenChange={open=>setConfirmation(open?'request':null)} title="申请管理员准备迁移？" description="申请不会立即冻结。管理员准备后会暂停新增、编辑、删除和修改凭据；关闭页面不会解除冻结，已有密文仍可读取。" onConfirm={()=>{setConfirmation(null);void taskAction();}}><Button disabled={busy||waiting>0}>申请迁移准备</Button></Popconfirm>}
      {loaded&&task?.can_cancel&&<Popconfirm open={confirmation==='cancel'} onOpenChange={open=>setConfirmation(open?'cancel':null)} title="取消尚未领取的申请？" onConfirm={()=>{setConfirmation(null);void taskAction(true);}}><Button disabled={busy||waiting>0}>取消申请</Button></Popconfirm>}
      {!loaded&&!busy&&<Button disabled={waiting>0} onClick={()=>refreshRef.current()}>重试任务状态</Button>}
      {running&&<Button danger onClick={()=>vaultSession.lock()}>停止并锁定</Button>}
    </Space>
    {loaded&&!task&&!canRequest&&<Typography.Text type="secondary">{capabilityMessage(flow.operations.request_migration)}</Typography.Text>}
    {ready&&!running&&(!unlocked?<Button onClick={onUnlock}>解锁后继续迁移</Button>:<div style={{maxWidth:560}}>
      <Typography.Paragraph type="secondary">仅选择管理员安全交付的文件；本地处理，最多8 MiB、2000条。较大文件请联系管理员使用本地迁移工具。</Typography.Paragraph>
      <input ref={picker} aria-label="选择本地迁移源文件" style={{maxWidth:'100%'}} type="file" accept=".jsonl,application/json" disabled={busy} onChange={e=>{const chosen=e.target.files?.[0];setConfirmed(false);if(chosen&&chosen.size>SOURCE_LIMIT){setFile(undefined);e.target.value='';setError(vaultMessage(new VaultError('MIGRATION_LIMIT')));}else{setFile(chosen);setError('');}}}/>
      <form id={formId} autoComplete="off" onSubmit={e=>e.preventDefault()}/>
      <Input.Password style={{marginBlock:8}} aria-label="迁移账号登录密码" form={formId} name="migration-account-password" autoComplete="current-password" placeholder="账号登录密码（用于逐批身份确认）" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/>
      <Checkbox checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}>已核对文件来自管理员的安全交付渠道；本次使用账号密码逐批确认身份</Checkbox>
      <Button type="primary" disabled={busy||!file||!password||!confirmed||waiting>0} onClick={()=>void start()}>开始本地校验</Button>
    </div>)}
    {(progress||task?.batch)&&<details><summary>查看处理数量</summary><Typography.Paragraph>待暂存 {(progress?.total??task!.batch.record_count)-(progress?.staged??task!.batch.staged_count)} 条 · 已暂存 {progress?.staged??task!.batch.staged_count} 条 · 已验证 {progress?.verified??task!.batch.verified_count} 条</Typography.Paragraph></details>}
    {progress&&<Typography.Paragraph role="status">{running?(progress.verified===progress.total?'等待管理员切换':'正在本地校验'):error?'已暂停，请刷新任务后继续':'本地校验已结束'} · 已暂存 {progress.staged}/{progress.total}，已验证 {progress.verified}/{progress.total}</Typography.Paragraph>}
  </div>;
}
