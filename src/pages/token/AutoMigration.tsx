import {useEffect,useRef,useState} from 'react';
import {Button,Popover,Space,Typography} from 'antd';
import {QuestionCircleOutlined} from '@ant-design/icons';
import {vaultSession} from '@/lib/vault/runtime';
import {VaultError} from '@/lib/vault/types';
import {legacyDriver} from '@/services/legacy-migration';
import {autoMigrate,legacyReason,type Progress} from '@/lib/legacy-migration/scheduler';
export default function AutoMigration({onChanged}:{onChanged:()=>void}){
 const [epoch,setEpoch]=useState(vaultSession.epoch),[unlocked,setUnlocked]=useState(vaultSession.state==='unlocked'),[attempt,setAttempt]=useState(0),[progress,setProgress]=useState<Progress>();
 const changed=useRef(onChanged);changed.current=onChanged;
 useEffect(()=>vaultSession.subscribe(()=>{setEpoch(vaultSession.epoch);setUnlocked(vaultSession.state==='unlocked');}),[]);
 useEffect(()=>{
  setProgress(undefined);if(!unlocked)return;
  const controller=new AbortController(),token=localStorage.getItem('forge_token');let timer:ReturnType<typeof setTimeout>|undefined;
  const current=()=>!controller.signal.aborted&&vaultSession.isCurrent(epoch)&&vaultSession.state==='unlocked'&&localStorage.getItem('forge_token')===token;
  const guard=()=>{if(!current())throw new VaultError('STALE');};
  const invalidate=()=>controller.abort();
  const storage=(e:StorageEvent)=>{if(e.storageArea===localStorage&&(e.key===null||e.key==='forge_token')&&token!==localStorage.getItem('forge_token'))invalidate();};
  const off=vaultSession.subscribe(()=>{if(!current())invalidate();});window.addEventListener('forge-auth-invalid',invalidate);window.addEventListener('storage',storage);
  const refresh=()=>{if(!timer)timer=setTimeout(()=>{timer=undefined;if(current())changed.current();},500);};
  void autoMigrate(legacyDriver(controller.signal,guard,refresh),controller.signal,current,p=>{if(current())setProgress(p);}).catch(e=>{if(current())setProgress(p=>({done:p?.done??'0',total:p?.total??'0',stopped:true,error:legacyReason(e)}));});
  return()=>{controller.abort();clearTimeout(timer);off();window.removeEventListener('forge-auth-invalid',invalidate);window.removeEventListener('storage',storage);vaultSession.clearLegacy();};
 },[unlocked,epoch,attempt]);
 if(!progress||progress.complete||progress.disabled||(!progress.error&&progress.total==='0'))return null;
 return <Space id="vault-migration-step" style={{marginBottom:12}} wrap><Typography.Text role="status">{progress.error??`正在整理历史密钥 ${progress.done}/${progress.total}`}</Typography.Text><Popover content="解锁后自动整理全部历史密钥（包含已删除记录）。锁定或离开页面会暂停，再次解锁后继续；已加密密钥仍可正常使用。"><Button type="text" shape="circle" aria-label="历史密钥整理说明" icon={<QuestionCircleOutlined/>}/></Popover>{progress.error&&progress.stopped&&<Button size="small" onClick={()=>setAttempt(n=>n+1)}>重试整理</Button>}</Space>;
}
