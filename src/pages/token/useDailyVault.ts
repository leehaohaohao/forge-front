import {useCallback,useEffect,useState} from 'react';
import {readVault,type VaultStatus} from '@/services/vault';
import {vaultMessage} from '@/lib/vault/messages';
export function useDailyVault(){
 const [revision,setRevision]=useState(0),[data,setData]=useState<VaultStatus>(),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(()=>setRevision(n=>n+1),[]);
 useEffect(()=>{const controller=new AbortController(),token=localStorage.getItem('forge_token');const valid=()=>!controller.signal.aborted&&token===localStorage.getItem('forge_token');setLoading(true);setError('');
 const invalidate=()=>{controller.abort();setData(undefined);setLoading(false);setError('登录状态已变化，请重新登录');};
 const storage=(e:StorageEvent)=>{if(e.storageArea===localStorage&&(e.key===null||e.key==='forge_token')&&token!==localStorage.getItem('forge_token'))invalidate();};
 window.addEventListener('forge-auth-invalid',invalidate);window.addEventListener('storage',storage);
 void readVault(controller.signal).then(v=>{if(valid())setData(v);}).catch(e=>{if(valid()){setData(undefined);setError(vaultMessage(e));}}).finally(()=>{if(valid())setLoading(false);});
 return()=>{controller.abort();window.removeEventListener('forge-auth-invalid',invalidate);window.removeEventListener('storage',storage);};},[revision]);
 return {data,loading,error,ready:!!data&&!loading&&!error,refresh};
}
