import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space, Typography, App } from 'antd';
import { bindVault, operation, vaultSession } from '@/lib/vault/runtime';
import { readVault, reauthenticate, vaultTransport, type VaultStatus } from '@/services/vault';
import { vaultMessage } from '@/lib/vault/messages';
import { VaultError, type RecoveryMaterial } from '@/lib/vault/types';
import { ApiError } from '@/lib/api-error';
type Operation = ReturnType<typeof operation>;
type Lifetime = {active:boolean; operations:Set<Operation>};
export default function VaultPanel() {
  const {message}=App.useApp();
  const [info,setInfo]=useState<VaultStatus>();
  const [{state,pending},setSession]=useState(()=>({state:vaultSession.state,pending:vaultSession.pendingConfirmation}));
  const [mode,setMode]=useState<'unlock'|'password'|'recovery'>('unlock');
  const [password,setPassword]=useState(''),[next,setNext]=useState(''),[entry,setEntry]=useState(''),[account,setAccount]=useState('');
  const [recovery,setRecovery]=useState<RecoveryMaterial>();
  const [saved,setSaved]=useState(false),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false);
  const mutex=useRef(false);
  const lifetime=useRef<Lifetime | null>(null);
  const clear=()=>{setPassword('');setNext('');setEntry('');setAccount('');setRecovery(undefined);setSaved(false);setVerified(false);setMode('unlock');};
  useEffect(()=>{
    // StrictMode replays setup/cleanup: each setup owns an independent lifetime.
    const scope:Lifetime={active:true,operations:new Set()};
    lifetime.current=scope;
    const op=operation();scope.operations.add(op);
    readVault(op.signal).then(v=>{
      if(!scope.active)return;
      op.guard();setInfo(v);
    }).catch(e=>{
      if(scope.active && !op.signal.aborted) message.error(vaultMessage(e));
    }).finally(()=>{op.done();scope.operations.delete(op);});
    const unsubscribe=vaultSession.subscribe(()=>{
      if(!scope.active)return;
      // Draft removal can be locked -> locked; subscribe to both pieces of UI state.
      setSession({state:vaultSession.state,pending:vaultSession.pendingConfirmation});
      if(vaultSession.state==='locked') clear();
    });
    return ()=>{
      scope.active=false;unsubscribe();
      scope.operations.forEach(request=>request.cancel());scope.operations.clear();
      mutex.current=false;
    };
  },[]);
  async function run(action:(op:Operation)=>Promise<void>) {
    const scope=lifetime.current;
    if(!scope?.active || mutex.current)return;
    mutex.current=true;setBusy(true);const op=operation();scope.operations.add(op);
    try {await action(op);}catch(e){
      const canceled=op.signal.aborted && ((e instanceof ApiError && e.kind==='canceled') || (e instanceof VaultError && e.code==='STALE'));
      if(scope.active && !canceled) message.error(vaultMessage(e));
    } finally {
      op.done();scope.operations.delete(op);
      if(scope.active && lifetime.current===scope){mutex.current=false;setBusy(false);setPassword('');setNext('');setAccount('');}
    }
  }
  async function prepare(op:ReturnType<typeof operation>) {
    const latest=await readVault(op.signal);op.guard();setInfo(latest);
    if(latest.vault && mode==='unlock') {await vaultSession.unlock(latest.user_id,latest.vault,password);op.guard();bindVault(latest.vault);message.success('保险库已在本地解锁');return;}
    const result=latest.vault
      ?await vaultSession.changeCredentials(latest.user_id,latest.vault,mode==='recovery'?{recoveryKey:entry}:{password},next)
      :await vaultSession.initialize(latest.user_id,password);
    op.guard();setRecovery(result.recovery);setEntry('');setSaved(false);setVerified(false);
  }
  function download() {
    if(!recovery)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(recovery,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='forge-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    vaultSession.recoverySaved();setSaved(true);message.info('已发起下载，请在浏览器下载记录中查找 forge-recovery.json；文件是否保存成功请自行确认。');
  }
  return <Card title={<Space>个人保险库 <Typography.Text type="secondary">{state==='unlocked'?'已解锁':state==='pending'?'等待恢复材料验证':'已锁定'}</Typography.Text></Space>} extra={<Button onClick={()=>vaultSession.lock()}>锁定并清理</Button>}>
    <Alert type="info" showIcon title="使用独立于登录密码的长口令。解锁密码和恢复材料只在本地处理。" description="查看30秒自动隐藏，5分钟无操作、切换标签页、切换应用或离开本页会锁定。复制后内容留在系统剪贴板，请自行处理。丢失密码与恢复材料后无法找回。" />
    {info && !pending && !recovery && (state!=='unlocked'||mode!=='unlock') && <div style={{marginTop:16,maxWidth:560}}>
      {info.initialized && <Space wrap style={{marginBottom:12}}><Button disabled={busy} onClick={()=>{clear();setMode('unlock');}}>密码解锁</Button><Button disabled={busy} onClick={()=>{clear();setMode('recovery');}}>使用恢复材料</Button><Button disabled={busy} onClick={()=>{clear();setMode('password');}}>修改解锁密码</Button></Space>}
      {mode==='recovery'?<Input.Password aria-label="原恢复密钥" autoComplete="off" value={entry} onChange={e=>setEntry(e.target.value)} placeholder="原恢复密钥" disabled={busy}/>:<Input.Password aria-label="独立解锁密码" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} placeholder={info.initialized?'独立解锁密码':'设置独立长口令（至少12个字符）'} disabled={busy}/>}
      {info.initialized && mode!=='unlock' && <Input.Password style={{marginTop:8}} aria-label="新的解锁密码" autoComplete="off" value={next} onChange={e=>setNext(e.target.value)} placeholder="新的独立长口令" disabled={busy}/>}
      <Button style={{marginTop:8}} type="primary" loading={busy} onClick={()=>run(prepare)}>{!info.initialized?'创建本地保险库':mode==='unlock'?'解锁':'生成新恢复材料'}</Button>
    </div>}
    {!info && <Button loading={busy} onClick={()=>run(async op=>{const v=await readVault(op.signal);op.guard();setInfo(v);})}>读取保险库状态</Button>}
    {state==='unlocked' && mode==='unlock' && <Button style={{marginTop:12}} onClick={()=>{vaultSession.lock();setMode('password');}}>修改解锁密码</Button>}
    {pending && state==='locked' && <div style={{marginTop:16,maxWidth:560}}>
      <Typography.Paragraph>
        {pending.pauseReason==='idle'?'因长时间未操作，保险库已自动锁定。':pending.pauseReason==='hidden'?'因切换标签页或隐藏页面，保险库已自动锁定。':pending.pauseReason==='blur'?'因浏览器窗口失去焦点，保险库已自动锁定。':'保险库已锁定。'}
        恢复材料确认流程尚未完成。
      </Typography.Paragraph>
      {pending.saved ? <>
        <Typography.Paragraph>恢复文件已发起下载。请在浏览器下载记录中查找 forge-recovery.json，并离线保管。输入刚设置的解锁密码后，可继续验证文件中的恢复密钥。若找不到文件，请放弃草稿并重新开始。</Typography.Paragraph>
        <Input.Password aria-label="草稿解锁密码" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
        <Button disabled={busy} onClick={()=>run(async op=>{await vaultSession.resumePrepared(password);op.guard();setSaved(pending.saved);setVerified(false);})}>继续确认恢复材料</Button>
      </> : <Alert style={{marginBottom:12}} type="warning" showIcon title="恢复文件尚未下载" description="自动锁定已清理恢复密钥，当前草稿无法继续下载或验证。请点击下方“放弃草稿”，重新输入密码生成材料，然后先点击“下载恢复材料”。这不会删除已有密钥。" />}
      <Button disabled={busy} onClick={()=>vaultSession.lock()}>放弃草稿</Button>
    </div>}
    {pending && state==='pending' && <div style={{marginTop:16,maxWidth:560}}>
      <Typography.Paragraph>尚未完成保存。请先点击“下载恢复材料”（不会自动弹出下载），再从文件中重新输入恢复密钥验证，最后保存加密保险库。不要将恢复材料上传或填写到备注中。</Typography.Paragraph>
      {recovery && <Button type="primary" disabled={busy} onClick={download}>下载恢复材料</Button>}
      <Input.Password style={{marginTop:8}} aria-label="重新输入恢复密钥" autoComplete="off" value={entry} onChange={e=>{setEntry(e.target.value);setVerified(false);}} disabled={busy}/>
      <Button disabled={!saved||busy} onClick={()=>run(async op=>{await vaultSession.verifyRecovery({format_version:pending.format_version,user_id:pending.user_id,vault_id:pending.vault_id,recovery_key:entry});op.guard();setEntry('');setVerified(true);message.success('恢复材料验证成功');})}>验证恢复材料</Button>
      {info?.initialized && <Input.Password style={{marginTop:8}} aria-label="账号登录密码" autoComplete="off" placeholder="账号登录密码（仅用于身份重认证）" value={account} onChange={e=>setAccount(e.target.value)} disabled={busy}/>}
      <Button type="primary" disabled={!verified||busy} onClick={()=>run(async op=>{
        const reauth=info?.initialized?await reauthenticate(account,op.signal):undefined;op.guard();setAccount('');
        const v=await vaultSession.publish(vaultTransport(op.signal,reauth));op.guard();bindVault(v);setInfo({initialized:true,user_id:v.user_id,vault:v});clear();message.success('保险库已保存并解锁');
      })}>保存加密保险库</Button>
    </div>}
  </Card>;
}
