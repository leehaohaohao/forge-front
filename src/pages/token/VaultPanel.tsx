import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space, Typography, App } from 'antd';
import { bindVault, operation, vaultSession } from '@/lib/vault/runtime';
import { readVault, reauthenticate, vaultTransport, type VaultStatus } from '@/services/vault';
import { vaultMessage } from '@/lib/vault/messages';
import type { RecoveryMaterial } from '@/lib/vault/types';
export default function VaultPanel() {
  const {message}=App.useApp();
  const [info,setInfo]=useState<VaultStatus>();
  const [state,setState]=useState(vaultSession.state);
  const [mode,setMode]=useState<'unlock'|'password'|'recovery'>('unlock');
  const [password,setPassword]=useState(''),[next,setNext]=useState(''),[entry,setEntry]=useState(''),[account,setAccount]=useState('');
  const [recovery,setRecovery]=useState<RecoveryMaterial>();
  const [saved,setSaved]=useState(false),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false);
  const mutex=useRef(false);
  const clear=()=>{setPassword('');setNext('');setEntry('');setAccount('');setRecovery(undefined);setSaved(false);setVerified(false);setMode('unlock');};
  useEffect(()=>{
    const op=operation();
    readVault(op.signal).then(v=>{op.guard();setInfo(v);}).catch(e=>{if(!op.signal.aborted) message.error(vaultMessage(e));}).finally(op.done);
    const unsubscribe=vaultSession.subscribe(()=>{setState(vaultSession.state);if(vaultSession.state==='locked') clear();});
    return ()=>{unsubscribe();op.done();};
  },[]);
  async function run(action:(op:ReturnType<typeof operation>)=>Promise<void>) {
    if(mutex.current)return;mutex.current=true;setBusy(true);const op=operation();
    try {await action(op);}catch(e){message.error(vaultMessage(e));}
    finally{op.done();mutex.current=false;setBusy(false);setPassword('');setNext('');setAccount('');}
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
    vaultSession.recoverySaved();setSaved(true);
  }
  const pending=vaultSession.pendingConfirmation;
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
      <Typography.Paragraph>待确认的加密草稿已保留，明文密钥已清理。请输入刚设置的解锁密码，继续确认同一份恢复材料。若未保存恢复文件，请放弃草稿后重新生成。</Typography.Paragraph>
      <Input.Password aria-label="草稿解锁密码" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
      <Button disabled={busy} onClick={()=>run(async op=>{await vaultSession.resumePrepared(password);op.guard();setSaved(pending.saved);setVerified(false);})}>继续确认恢复材料</Button>
      <Button disabled={busy} onClick={()=>vaultSession.lock()}>放弃草稿</Button>
    </div>}
    {pending && state==='pending' && <div style={{marginTop:16,maxWidth:560}}>
      <Typography.Paragraph>请下载恢复材料并离线保管，再从保存的文件中重新输入恢复密钥验证。不要将它上传或填写到备注中。</Typography.Paragraph>
      {recovery && <Button disabled={busy} onClick={download}>下载恢复材料</Button>}
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
