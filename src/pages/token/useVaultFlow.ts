import {retryStatus} from '@/lib/vault/status-retry';
import {migrationCompletion,consumeCompletedTask} from '@/services/migration-completion';
import api from '@/lib/api';
import {useCallback,useEffect,useRef,useState} from 'react';
import {readTasks,type PreparationTask} from '@/services/vault-migration';
import {readFlowStatus} from '@/services/vault-flow';
import type {FlowStatus} from '@/lib/vault/flow';
import {ApiError} from '@/lib/api-error';
import {vaultMessage} from '@/lib/vault/messages';
import {VaultError} from '@/lib/vault/types';
// No polling: explicit refresh, returning to a visible page, or a successful mutation.
// Coalesce refreshes and honor Retry-After. Each effect lifetime owns its requests.
export function useVaultFlow() {
  const [view,setView]=useState<{data?:FlowStatus;task?:PreparationTask|null;selfTask?:any;loading:boolean;error?:string}>({loading:true});
  const load=useRef<()=>void>(()=>{});
  const refresh=useCallback(()=>load.current(),[]);
  useEffect(()=>{
    let active=true, serial=0, controller:AbortController|undefined, timer:ReturnType<typeof setTimeout>|undefined, next=0;
    const request=()=>{
      if(!active || document.hidden)return;
      clearTimeout(timer);controller?.abort();const id=++serial,token=localStorage.getItem('forge_token');
      setView(v=>({...v,loading:true,error:undefined}));
      const start=async()=>{
        controller=new AbortController();const signal=controller.signal;
        const current=()=>active&&id===serial&&!document.hidden&&localStorage.getItem('forge_token')===token;
        const read=<T,>(fn:()=>Promise<T>)=>retryStatus(fn,signal,current,()=>{if(current())setView(v=>({...v,loading:true,error:'请求较多，正在等待限流结束后自动继续。'}));});
        try{const data=await read(()=>readFlowStatus(signal));let task:PreparationTask|null|undefined;let selfTask:any;
          if(data.latest_batch?.state==='switched'){
            const completion=await migrationCompletion(data,async()=>consumeCompletedTask(data)??read(async()=>(await api.get('/vault/self-service-migrations',{signal})).data.data),()=>read(()=>readTasks(data,signal)));
            task=completion.task;selfTask=completion.selfTask;data.completionConfirmed=completion.complete;
          }
          if(current() && !signal.aborted)setView({data,task,selfTask,loading:false});}
        catch(e){if(current() && !signal.aborted){
          next=Date.now()+10000;
          if(e instanceof ApiError && e.kind==='rate-limit')next=Math.max(next,Date.now()+(e.retryAfterSeconds??60)*1000);
          setView(v=>({...v,loading:false,error:e instanceof ApiError && e.kind==='rate-limit'?'请求较多，请稍后重试；重试会等待限流结束。':e instanceof VaultError?'准备状态无法确认，请刷新后重试':vaultMessage(e)}));
        }}
      };
      const delay=Math.max(0,next-Date.now());
      if(delay)timer=setTimeout(start,delay);else void start();
    };
    const visibility=()=>{
      if(document.hidden){++serial;clearTimeout(timer);controller?.abort();setView(v=>({...v,loading:false,error:'页面已暂停，返回后重新读取状态'}));}
      else request();
    };
    let observedToken=localStorage.getItem('forge_token');
    const invalidate=()=>{++serial;clearTimeout(timer);controller?.abort();if(active)setView({loading:false,error:'登录状态已变化，请重新登录或刷新页面。'});};
    const storage=(event:StorageEvent)=>{
      if(event.storageArea!==localStorage||(event.key!==null&&event.key!=='forge_token'))return;
      const token=localStorage.getItem('forge_token');
      if(token===observedToken)return;
      observedToken=token;invalidate();
    };
    window.addEventListener('forge-auth-invalid',invalidate);window.addEventListener('storage',storage);
    load.current=request;request();document.addEventListener('visibilitychange',visibility);
    return ()=>{active=false;++serial;clearTimeout(timer);controller?.abort();load.current=()=>{};document.removeEventListener('visibilitychange',visibility);window.removeEventListener('forge-auth-invalid',invalidate);window.removeEventListener('storage',storage);};
  },[]);
  return {...view,refresh,ready:!!view.data&&!view.loading&&!view.error};
}
