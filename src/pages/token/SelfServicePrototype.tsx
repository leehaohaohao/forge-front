import {useEffect,useId,useRef,useState} from 'react';
import {Alert,Button,Input,Modal,Space,Typography} from 'antd';
import {vaultSession} from '@/lib/vault/runtime';
export interface PrototypeTransport {
 reauth:(password:string,signal:AbortSignal)=>Promise<string>;
 create:(body:{request_id:string;expected_vault_revision:string;recipient_public_key:unknown;impact_ack:{include_deleted:true;pause_writes:true;keep_page_open:true};resume_existing:boolean},proof:string,signal:AbortSignal)=>Promise<{authorization:null|{token:string;expires_at:string;delivery_epoch:string;recipient:string;scope:string}}>;
}
// Only the synthetic harness supplies this transport in front1. Production renders
// a disabled entry even when old VITE migration flags are true.
export default function SelfServicePrototype({transport,unlocked,onUnlock,revision}:{transport:PrototypeTransport;unlocked:boolean;onUnlock:()=>void;revision:string}){
 const form=useId(),[intent,setIntent]=useState(false),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const scope=useRef<{active:boolean;worker?:Worker;abort?:AbortController;key?:unknown;proof?:string;grant?:unknown;busy:boolean}>({active:false,busy:false});
 const clear=()=>{const s=scope.current;s.abort?.abort();s.worker?.terminate();s.worker=undefined;s.proof='';s.key=undefined;s.grant=undefined;s.busy=false;setPassword('');setIntent(false);setConfirm(false);setBusy(false);setDone(false);};
 useEffect(()=>{const s={active:true,busy:false} as typeof scope.current;scope.current=s;const unsub=vaultSession.subscribe(()=>{if(vaultSession.state==='locked')clear();});const hidden=()=>{if(document.hidden)clear();};document.addEventListener('visibilitychange',hidden);return()=>{s.active=false;s.abort?.abort();s.worker?.terminate();s.proof='';s.grant=undefined;unsub();document.removeEventListener('visibilitychange',hidden);};},[]);
 async function prepare(){const s=scope.current;if(!s.active||s.busy||!unlocked||!password)return;s.busy=true;setBusy(true);setError('');s.abort=new AbortController();const signal=s.abort.signal;let account=password;setPassword('');
 try{const w=new Worker(new URL('../../lib/vault/delivery-worker.ts',import.meta.url),{type:'module'});s.worker=w;
 const key=await new Promise<unknown>((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error()),{once:true});w.onmessage=e=>e.data.ok?resolve(e.data.publicKey):reject(Error());w.onerror=e=>{e.preventDefault();reject(Error());};w.postMessage({id:1,action:'generate'});});
 if(signal.aborted||!s.active)return;s.key=key;const proof=await transport.reauth(account,signal);account='';if(signal.aborted||!s.active)return;s.proof=proof;setConfirm(true);
 }catch{if(s.active&&!signal.aborted){s.worker?.terminate();s.proof='';s.key=undefined;setError('身份确认或本地准备失败，请重试。');}}finally{account='';if(s.abort?.signal===signal){s.busy=false;if(s.active)setBusy(false);}}}
 async function start(){const s=scope.current;if(!s.active||s.busy||!s.key||!s.proof||!s.abort||s.abort.signal.aborted)return;s.busy=true;setBusy(true);setConfirm(false);const signal=s.abort.signal;
 try{const result=await transport.create({request_id:crypto.randomUUID(),expected_vault_revision:revision,recipient_public_key:s.key,impact_ack:{include_deleted:true,pause_writes:true,keep_page_open:true},resume_existing:true},s.proof,signal);s.proof='';if(s.active&&!signal.aborted){s.grant=result.authorization;setDone(true);setIntent(false);if(!result.authorization)setError('请求已记录，请重新确认身份后继续。');}}
 catch{if(s.active&&!signal.aborted){setDone(true);setError('启动结果尚未确认，请查询任务状态，不要重复创建。');}}
 finally{if(s.abort?.signal===signal){s.proof='';s.busy=false;if(s.active)setBusy(false);}}}
 return <Space orientation="vertical"><Button disabled={busy||done} onClick={()=>{setIntent(true);setError('');if(!unlocked)onUnlock();}}>一键迁移</Button>
 {intent&&!unlocked&&<Typography.Text>请先解锁，然后确认开始迁移</Typography.Text>}
 {intent&&unlocked&&<><form id={form} autoComplete="off" onSubmit={e=>e.preventDefault()}/><Input.Password aria-label="迁移身份确认密码" form={form} name="self-service-account-password" autoComplete="current-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)} placeholder="账号登录密码"/><Button disabled={busy||!password} onClick={()=>void prepare()}>确认身份</Button><Button onClick={clear}>取消迁移意图</Button></>}
 {error&&<Alert type="error" title={error}/>}{done&&<Typography.Text>系统正在准备迁移</Typography.Text>}
 <Modal title="确认开始迁移" open={confirm} onCancel={clear} onOk={()=>void start()} confirmLoading={busy}><Typography.Paragraph>包含全部历史记录和已删除记录；迁移期间暂停新增、修改、删除及凭据修改。浏览器处理阶段请保持页面打开。</Typography.Paragraph></Modal>
 </Space>;
}

