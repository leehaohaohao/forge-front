import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VaultSession } from '../lib/vault/session';
import type { VaultTransport } from '../lib/vault/session';
import { validateRecovery } from '../lib/vault/format';
import { VaultError } from '../lib/vault/types';
import type { VaultRead, RecoveryMaterial, SecretEnvelope } from '../lib/vault/types';
import './vault.css';

// Development-only fixture transport. No backend calls or browser persistence.
const session = new VaultSession();
let fixture:VaultRead|null=null;
let uncertain=false;
const transport:VaultTransport = {
  async read() { return {user_id:'7',vault:fixture}; },
  async create(v) {
    if (fixture) throw new Error('conflict');
    fixture={...v,user_id:'7',revision:'1',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),dek_wrap_count:0,dek_wrap_warn_at:900000,dek_wrap_limit:1000000};
    if (uncertain) { uncertain=false; throw new Error('fixture-lost-response'); }
    return fixture;
  },
  async credentials(input) {
    if (!fixture || input.expected_revision !== fixture.revision) throw new Error('conflict');
    fixture={...fixture,credential_version:input.credential_version,kdf:input.kdf,password_wrap:input.password_wrap,recovery_wrap:input.recovery_wrap,revision:String(BigInt(fixture.revision)+1n)};
    return fixture;
  },
};
function download(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Prototype() {
  const [state,setState]=useState(session.state);
  const [password,setPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [recovery,setRecovery]=useState<RecoveryMaterial>();
  const [reentry,setReentry]=useState('');
  const [saved,setSaved]=useState(false);
  const [verified,setVerified]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('所有操作只在本地测试，未连接真实业务接口。');
  const [value,setValue]=useState('');
  const [envelope,setEnvelope]=useState<SecretEnvelope>();
  const [visible,setVisible]=useState('');
  const [mode,setMode]=useState<'password'|'recovery'>('password');
  useEffect(()=>{
    const unsubscribe=session.subscribe(()=>{
      setState(session.state);
      if (session.state!=='unlocked') setVisible('');
      if (session.state==='locked') { setMode('password'); setNotice('保险库已锁定，临时输入已清理。'); setRecovery(undefined); setPassword(''); setNewPassword(''); setReentry(''); setVisible(''); setValue(''); setSaved(false); setVerified(false); }
    });
    return ()=>{ unsubscribe(); session.dispose(); };
  },[]);
  useEffect(()=>{
    if (!visible) return;
    const timer=setTimeout(()=>setVisible(''),30000);
    return ()=>clearTimeout(timer);
  },[visible]);
  async function run(action:()=>Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); }
    catch(error) {
      const code=error instanceof VaultError?error.code:'';
      setNotice(code==='INVALID_PASSWORD' ? '解锁密码至少12个字符，最多1024字节，不能全为空白。建议使用独立长口令。'
        : code==='RECOVERY_UNVERIFIED' ? '请先保存恢复材料并重新输入验证。'
        : code==='UNSUPPORTED' ? '当前设备不支持所需的 Web Crypto、WASM 或 Worker，请更换支持的浏览器，不会降低加密强度。'
        : code==='UNLOCK_FAILED' ? '无法解锁，请检查密码或使用恢复材料'
        : code==='STALE' ? '状态已变化或结果不确定，请读取当前状态后重试；草稿不会自动重建。'
        : code==='LOCKED' ? '保险库已锁定。' : '操作未完成，请检查输入或设备支持情况。');
    } finally { setBusy(false); setPassword(''); setNewPassword(''); }
  }
  const context=()=>({user_id:'7',vault_id:fixture!.vault_id,vault_key_version:fixture!.vault_key_version,secret_id:envelope?.secret_id??crypto.randomUUID(),secret_version:envelope?.secret_version??1});
  return <main>
    <header><span className="eyebrow">FORGE · 本地验证</span><h1>你的密钥，只在这里解锁。</h1><p>使用独立于登录密码的长口令。恢复材料请离线保管，丢失口令与恢复材料后无法由管理员找回。</p></header>
    <aside>开发原型 · 测试账号 7 · 不填写真实秘密。刷新会清除本页的模拟服务器。真实 API 接入属于前2。</aside>
    <section><div className="row"><h2>保险库 <small>{state==='locked'?'已锁定':state==='pending'?'待验证与保存':'已解锁'}</small></h2><button onClick={()=>session.lock()}>锁定并清理</button></div>
      <p role="status">{notice}</p>
      <fieldset disabled={busy}>
      {!fixture && !recovery && <>
        <label>独立解锁密码<input aria-label="独立解锁密码" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <button onClick={()=>run(async()=>{const result=await session.initialize('7',password); setRecovery(result.recovery); setSaved(false); setVerified(false); setNotice('请下载恢复材料，再重新输入恢复密钥以验证。');})}>在本地初始化</button>
      </>}
      {fixture && state==='locked' && <>
        <div className="row"><button onClick={()=>setMode('password')}>密码解锁</button><button onClick={()=>setMode('recovery')}>使用恢复材料</button></div>
        {mode==='password' ? <><label>独立解锁密码<input aria-label="独立解锁密码" type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} /></label><button onClick={()=>run(async()=>{await session.unlock('7',fixture!,password); setNotice('已在本地解锁。');})}>解锁</button></> : <>
          <label>恢复密钥<input aria-label="恢复密钥" type="password" autoComplete="off" value={reentry} onChange={e=>setReentry(e.target.value)} /></label>
          <label>新的独立解锁密码<input aria-label="新的独立解锁密码" type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label>
          <button onClick={()=>run(async()=>{const result=await session.changeCredentials('7',fixture!,{recoveryKey:reentry},newPassword); setRecovery(result.recovery); setSaved(false); setVerified(false); setReentry(''); setNotice('已恢复同一保险库，请保存并验证新的恢复材料。');})}>本地恢复并生成新凭据</button>
        </>}
      </>}
      {recovery && <div className="recovery">
        <h3>保存恢复材料</h3><p>恢复密钥只在本地显示，请与加密备份分开存放。</p><code>{recovery.recovery_key}</code>
        <button onClick={()=>{download(recovery,'forge-recovery.json'); session.recoverySaved(); setSaved(true);}}>下载独立恢复材料</button>
        <label>重新输入已保存的恢复密钥<input aria-label="重新输入恢复密钥" type="password" autoComplete="off" value={reentry} onChange={e=>{setReentry(e.target.value);setVerified(false);}} /></label>
        <button disabled={!saved} onClick={()=>run(async()=>{const material={...recovery,recovery_key:reentry}; validateRecovery(material); await session.verifyRecovery(material); setVerified(true); setReentry(''); setNotice('恢复材料已通过本地解密验证。');})}>验证恢复材料</button>
        <button disabled={!verified} onClick={()=>run(async()=>{await session.publish(transport); setRecovery(undefined);setVerified(false);setSaved(false);setNotice('加密包装已保存到模拟服务器；解锁材料未上传。');})}>保存加密包装到模拟服务器</button>
        <label className="inline"><input type="checkbox" onChange={e=>{uncertain=e.target.checked;}} />模拟服务器已写入但响应中断</label>
      </div>}
      {fixture && state==='unlocked' && <>
        <h3>本地业务值往返</h3><label>虚构业务密钥<textarea aria-label="虚构业务密钥" value={value} onChange={e=>setValue(e.target.value)} /></label>
        <button onClick={()=>run(async()=>{const c={...context(),secret_version:envelope?envelope.secret_version+1:1}; setEnvelope(await session.encrypt(c,value,fixture!.dek_wrap_count,envelope?.secret_version ?? 0)); setValue(''); setVisible(''); setNotice('已生成密文包，未发送明文。');})}>本地加密</button>
        <button disabled={!envelope} onClick={()=>run(async()=>{setVisible(await session.decrypt(context(),envelope!));})}>查看30秒</button>
        <button onClick={()=>setVisible('')}>隐藏</button>{visible && <code>{visible}</code>}
        <h3>修改解锁密码</h3><label>原独立解锁密码<input aria-label="原独立解锁密码" type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <label>新独立解锁密码<input aria-label="新独立解锁密码" type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label>
        <button onClick={()=>run(async()=>{const result=await session.changeCredentials('7',fixture!,{password},newPassword);setRecovery(result.recovery);setSaved(false);setVerified(false);setNotice('已重包装同一保险库密钥，业务密文保持不变。');})}>本地生成新凭据</button>
      </>}
      </fieldset>
    </section><footer>5分钟无操作自动锁定；页面隐藏、离开或刷新立即锁定。业务元数据仍为明文，请勿在备注填写秘密。</footer>
  </main>;
}
if (!import.meta.env.DEV && import.meta.env.MODE !== 'vault-lab') throw new Error('Development prototype only');
createRoot(document.getElementById('root')!).render(<Prototype />);
