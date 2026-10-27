import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Card,Checkbox,Space,Typography} from 'antd';
import {BACKUP_LIMIT} from '@/lib/vault/backup-file';
export default function RecoveryCheck(){
  const [backup,setBackup]=useState<File>(),[recovery,setRecovery]=useState<File>(),[checksum,setChecksum]=useState<File>();
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<any>();
  const worker=useRef<Worker|null>(null),root=useRef<HTMLDivElement>(null),generation=useRef(0);
  const clean=()=>{++generation.current;worker.current?.terminate();worker.current=null;setBusy(false);setBackup(undefined);setRecovery(undefined);setChecksum(undefined);setConfirmed(false);root.current?.querySelectorAll('input[type=file]').forEach(e=>(e as HTMLInputElement).value='');};
  useEffect(()=>{const stop=()=>{if(document.hidden){clean();setResult(undefined);setError('验证已暂停，请重新选择文件。');}};document.addEventListener('visibilitychange',stop);return()=>{++generation.current;worker.current?.terminate();document.removeEventListener('visibilitychange',stop);};},[]);
  const cleanBrowser=!localStorage.getItem('forge_token');
  function verify(){
    if(!backup||!recovery||!checksum||!confirmed||busy||!cleanBrowser)return;
    setError('');setResult(undefined);
    if(backup.size>BACKUP_LIMIT||recovery.size>4096||checksum.size>256){clean();setError('文件超过浏览器验证上限，请联系管理员使用本地恢复验证工具。');return;}
    const id=++generation.current;setBusy(true);
    const w=new Worker(new URL('../../lib/vault/backup-worker.ts',import.meta.url),{type:'module'});worker.current=w;
    const finish=(data:any)=>{if(id!==generation.current)return;clean();if(data.ok)setResult(data.result);else setError('恢复验证失败，请核对恢复文件、备份及摘要是否配套且完整。');};
    w.onmessage=e=>finish(e.data);w.onerror=e=>{e.preventDefault();finish({ok:false});};
    w.postMessage({backup,recovery,checksum});setBackup(undefined);setRecovery(undefined);setChecksum(undefined);
  }
  return <div ref={root} data-private="true" data-sentry-mask="true" className="ph-no-capture" style={{maxWidth:760,margin:'32px auto',padding:16}}><Card title="独立恢复验证">
    <Typography.Paragraph>在新的隐私窗口或干净浏览器中打开本页。无需登录，文件仅在本地验证，不写回业务记录，也不会自动登记管理员恢复结果。</Typography.Paragraph>
    {!cleanBrowser?<Alert type="warning" showIcon title="当前浏览器存在登录会话，请复制本页地址到新的隐私窗口。"/>:<Space orientation="vertical" style={{width:'100%'}}>
      <Typography.Text>选择加密备份、对应的 .sha256 摘要和恢复文件；恢复文件与备份请分别保管。</Typography.Text>
      <label>加密备份 <input type="file" aria-label="恢复验证加密备份" disabled={busy} onChange={e=>{setBackup(e.target.files?.[0]);setResult(undefined);}}/></label>
      <label>备份摘要 <input type="file" aria-label="恢复验证备份摘要" disabled={busy} onChange={e=>{setChecksum(e.target.files?.[0]);setResult(undefined);}}/></label>
      <label>恢复文件 <input type="file" aria-label="恢复验证恢复文件" disabled={busy} onChange={e=>{setRecovery(e.target.files?.[0]);setResult(undefined);}}/></label>
      <Checkbox checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}>已在干净浏览器中打开，并核对文件来自可信保管位置</Checkbox>
      <Typography.Text type="secondary">上限8 MiB、2000条；分片备份或更大文件请联系管理员使用 verify-shards 本地工具。</Typography.Text>
      <Space><Button type="primary" disabled={busy||!backup||!recovery||!checksum||!confirmed} onClick={verify}>验证备份恢复</Button><Button onClick={()=>{clean();setResult(undefined);setError('');}}>停止并清理</Button></Space>
    </Space>}
    {busy&&<Typography.Paragraph role="status">正在独立验证…</Typography.Paragraph>}
    {error&&<Alert type="error" showIcon title={error}/>}
    {result&&<Alert type={result.complete?'success':'warning'} showIcon title={result.complete?'本次备份独立恢复验证通过':'备份不完整，不能确认全部恢复'} description={<><p>核验 {result.records} 条，待迁移 {result.legacy_pending} 条。</p><p>导出标识：{result.export_id}</p><p>验证时间：{result.checked_at}</p><p>仅代表此备份的本地核验结果；管理员须另行核对并登记对应快照。</p></>}/>}
  </Card></div>;
}
