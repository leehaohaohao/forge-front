import {migrationCompletion} from '@/services/migration-completion';
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
      clearTimeout(timer);controller?.abort();const id=++serial;
      setView(v=>({...v,loading:true,error:undefined}));
      const start=async()=>{
        controller=new AbortController();const signal=controller.signal;
        try{const data=await readFlowStatus(signal);let task:PreparationTask|null|undefined;let selfTask:any;
          if(data.latest_batch?.state==='switched'){
            const completion=await migrationCompletion(data,async()=>(await api.get('/vault/self-service-migrations',{signal})).data.data,()=>readTasks(data,signal));
            task=completion.task;selfTask=completion.selfTask;data.completionConfirmed=completion.complete;
          }
          if(active && id===serial && !signal.aborted)setView({data,task,selfTask,loading:false});}
        catch(e){if(active && id===serial && !signal.aborted){
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
    load.current=request;request();document.addEventListener('visibilitychange',visibility);
    return ()=>{active=false;++serial;clearTimeout(timer);controller?.abort();load.current=()=>{};document.removeEventListener('visibilitychange',visibility);};
  },[]);
  return {...view,refresh,ready:!!view.data&&!view.loading&&!view.error};
}
