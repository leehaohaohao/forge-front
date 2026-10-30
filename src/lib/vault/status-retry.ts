import {ApiError} from '../api-error';
import {VaultError} from './types';
export async function retryStatus<T>(read:()=>Promise<T>,signal:AbortSignal,current:()=>boolean,waiting:()=>void=()=>{},sleep=(ms:number)=>new Promise<void>((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new VaultError('STALE'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
})):Promise<T>{
 for(;;){if(signal.aborted||!current())throw new VaultError('STALE');try{return await read();}catch(e){if(!(e instanceof ApiError&&e.kind==='rate-limit'))throw e;
 const seconds=e.retryAfterSeconds??60;if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw e;
 waiting();await sleep(Math.max(1000,seconds*1000));}}
}
