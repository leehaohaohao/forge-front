import {useEffect,useId,useRef,useState} from 'react';
import {Alert,Button,Input,Space,Typography} from 'antd';
import api,{type ApiResponse} from '@/lib/api';
import {ApiError} from '@/lib/api-error';
import {VaultError} from '@/lib/vault/types';
import {readVault} from '@/services/vault';
import {operation,vaultSession} from '@/lib/vault/runtime';
import {vaultMessage} from '@/lib/vault/messages';
import {parseBackup,BACKUP_LIMIT} from '@/lib/vault/backup-file';
import {digest} from '@/lib/vault/migration-core';
import {requireThat,utf8} from '@/lib/vault/format';
import type {FlowStatus} from '@/lib/vault/flow';
export default function BackupPanel({flow}:{flow:FlowStatus}){
  const form=useId(),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<{blob:Blob;hash:string;legacy:number;id:string}>();
  const [retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
  useEffect(()=>{if(!retryAt)return;const timer=setInterval(()=>{const n=Date.now();setNow(n);if(n>=retryAt){setRetryAt(0);clearInterval(timer);}},1000);return()=>clearInterval(timer);},[retryAt]);
  const scope=useRef<{active:boolean;op?:ReturnType<typeof operation>;busy:boolean}>({active:false,busy:false});
  useEffect(()=>{const s={active:true,busy:false} as typeof scope.current;scope.current=s;const unsub=vaultSession.subscribe(()=>{if(vaultSession.state==='locked'){s.op?.cancel();setPassword('');setFile(undefined);}});return()=>{s.active=false;s.op?.cancel();unsub();};},[]);
  async function prepare(){
    const s=scope.current;if(Date.now()<retryAt||!s.active||s.busy||!password||!flow.operations.export_encrypted.allowed)return;
    s.busy=true;const op=operation();s.op=op;setBusy(true);setError('');setFile(undefined);let account=password;setPassword('');
    try{const live=await readVault(op.signal);op.guard();requireThat(live.user_id===flow.user_id&&live.vault?.vault_id===flow.vault?.vault_id);
      const grant=(await api.post<ApiResponse<{reauth_token:string}>>('/auth/reauth',{account_password:account,purpose:'vault_export'},{signal:op.signal})).data.data;account='';op.guard();
      const result=parseBackup((await api.post<ApiResponse<unknown>>('/vault/export',{expected_revision:live.vault!.revision},{signal:op.signal,headers:{'X-Forge-Reauth':grant.reauth_token}})).data.data);op.guard();requireThat(result.user_id===flow.user_id&&result.vault.vault_id===flow.vault?.vault_id);
      const bytes=utf8(JSON.stringify(result));requireThat(bytes.length<=BACKUP_LIMIT);const hash=await digest(bytes);op.guard();if(s.active)setFile({blob:new Blob([bytes]),hash,legacy:result.legacy_pending_count,id:result.export_id});
    }catch(e){if(s.active&&!op.signal.aborted){setError(e instanceof VaultError&&e.code==='INVALID_FORMAT'?'备份无法校验或超过浏览器上限（8 MiB、2000条），请联系管理员使用本地备份工具。':vaultMessage(e));if(e instanceof ApiError&&e.kind==='rate-limit'){setNow(Date.now());setRetryAt(Date.now()+(e.retryAfterSeconds??60)*1000);}}}finally{account='';op.done();s.busy=false;if(s.active)setBusy(false);}
  }
  const download=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <details style={{marginTop:16}}><summary>加密备份与独立恢复验证</summary><Space orientation="vertical" style={{maxWidth:600,width:'100%',marginTop:12}}>
    <Typography.Text>恢复文件只保存恢复材料；加密备份保存密文记录，两者分别保管。下载成功不代表恢复验证通过。</Typography.Text>
    <form id={form} autoComplete="off" onSubmit={e=>e.preventDefault()}/>
    <Input.Password aria-label="备份账号登录密码" form={form} name="backup-account-password" autoComplete="current-password" placeholder="账号登录密码（导出身份确认）" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/>
    <Button disabled={busy||now<retryAt||!password||!flow.operations.export_encrypted.allowed} onClick={()=>void prepare()}>准备加密备份</Button>
    {retryAt>now&&<Typography.Text role="status">请等待 {Math.ceil((retryAt-now)/1000)} 秒后重试导出</Typography.Text>}
    {error&&<Alert type="error" showIcon title={error}/>}
    {file&&<><Typography.Text type={file.legacy?'danger':undefined}>{file.legacy?`备份仍有 ${file.legacy} 条未迁移记录，不包含其原值，不能用于完整恢复。`:'加密备份已准备，请分别下载备份与摘要。'}</Typography.Text><Space wrap><Button onClick={()=>download(file.blob,`forge-backup-${file.id}.json`)}>下载加密备份</Button><Button onClick={()=>download(new Blob([file.hash+'\n']),`forge-backup-${file.id}.json.sha256`)}>下载备份摘要</Button></Space></>}
    <a href="/app/recovery-check" target="_blank" rel="noopener noreferrer">打开独立恢复验证</a>
    <Typography.Text type="secondary">请将验证页地址复制到隐私窗口。浏览器上限8 MiB、2000条；更大或分片备份由管理员使用现有本地工具处理。</Typography.Text>
  </Space></details>;
}
