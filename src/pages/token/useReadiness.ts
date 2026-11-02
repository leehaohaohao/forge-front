import {useEffect,useState} from 'react';
import {vaultSession} from '@/lib/vault/runtime';
import {retryStatus} from '@/lib/vault/status-retry';
import {readReadiness} from '@/services/vault-readiness';
import type {Readiness} from '@/lib/vault/readiness';
import type {FlowStatus} from '@/lib/vault/flow';
export function useReadiness(flow:FlowStatus,refresh:number,unlocked:boolean){
 const [diagnostic,setDiagnostic]=useState<Readiness|null>(),[failed,setFailed]=useState(false),[visible,setVisible]=useState(0);
 useEffect(()=>{
  const controller=new AbortController(),token=localStorage.getItem('forge_token'),epoch=vaultSession.epoch;
  const current=()=>!controller.signal.aborted&&token===localStorage.getItem('forge_token')&&vaultSession.isCurrent(epoch);
  setDiagnostic(undefined);setFailed(false);
  if(!document.hidden)void retryStatus(()=>readReadiness(controller.signal),controller.signal,current,()=>{if(current())setFailed(true);}).then(d=>{if(current()){setDiagnostic(d);setFailed(false);}}).catch(()=>{if(current())setFailed(true);});
  const invalidate=()=>{controller.abort();setDiagnostic(undefined);setFailed(true);};
  const storage=(e:StorageEvent)=>{if(e.storageArea===localStorage&&(e.key===null||e.key==='forge_token')&&token!==localStorage.getItem('forge_token'))invalidate();};
  const visibility=()=>{if(document.hidden)invalidate();else setVisible(v=>v+1);};
  const off=vaultSession.subscribe(()=>{if(!vaultSession.isCurrent(epoch)){controller.abort();if(token===localStorage.getItem('forge_token'))setVisible(v=>v+1);}});
  window.addEventListener('storage',storage);window.addEventListener('forge-auth-invalid',invalidate);document.addEventListener('visibilitychange',visibility);
  return()=>{controller.abort();off();window.removeEventListener('storage',storage);window.removeEventListener('forge-auth-invalid',invalidate);document.removeEventListener('visibilitychange',visibility);};
 },[flow,refresh,unlocked,visible]);
 return {diagnostic,failed};
}
