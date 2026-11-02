import {ApiError} from '@/lib/api-error';
import {requireThat} from '@/lib/vault/format';
import {VaultError} from '@/lib/vault/types';
import type {Status,Row,Commit} from './protocol';
export interface Progress {done:string;total:string;error?:string;complete?:boolean;disabled?:boolean;stopped?:boolean}
export interface Driver {status(after?:string,limit?:number):Promise<Status>;convert(row:Row):Promise<Commit>;commit(row:Row,body:Commit):Promise<void>;changed():void}
export function legacyReason(e:unknown){
 if(e instanceof ApiError){switch(e.businessCode){case 40920:return '历史整理服务已关闭';case 40921:return '历史存储格式暂不支持，请联系维护人员';case 42201:return '部分历史密钥数据损坏，原记录已保留';case 40905:return '保险库包装次数已达上限';case 40902:return '数据正在变化，请重试整理';case 409:return '历史记录暂时被占用，请稍后重试';}}
 if(e instanceof VaultError)return e.code==='KEY_LIMIT'?'保险库包装次数已达上限':'历史密钥完整性校验未通过，原记录已保留';
 return '暂时无法整理历史密钥，请检查网络后重试';
}
export function pause(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new VaultError('STALE'));return;}const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(new VaultError('STALE'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);signal.addEventListener('abort',stop,{once:true});});}
const transient=(e:unknown)=>e instanceof ApiError&&(e.kind==='network'||e.kind==='unavailable'||e.kind==='rate-limit');
export async function autoMigrate(driver:Driver,signal:AbortSignal,current:()=>boolean,report:(p:Progress)=>void,wait=pause){
 const guard=()=>{if(signal.aborted||!current())throw new VaultError('STALE');};
 let done=0n,total=0n;
 const update=(p:Partial<Progress>={})=>{guard();report({done:String(done),total:String(total),...p});};
 const retry=async<T>(fn:()=>Promise<T>):Promise<T>=>{let n=0;for(;;){guard();try{const v=await fn();guard();return v;}catch(e){guard();if(!transient(e))throw e;update({error:e instanceof ApiError&&e.kind==='rate-limit'?'请求较多，等待后自动继续':'网络暂不可用，稍后自动重试'});if(e instanceof ApiError&&e.kind==='rate-limit'){await wait(Math.max(1,e.retryAfterSeconds??60)*1000,signal);}else {if(++n>=3)throw e;await wait(1000*2**(n-1),signal);}}}};
 let page=await retry(()=>driver.status());
 if(!page.enabled){update({disabled:true});return;}
 total=BigInt(page.pending_count!);if(page.complete){update({complete:true});return;}
 requireThat(page.vault);update();
 const failures=new Map<string,string>();let after:string|undefined;
 for(;;){
  guard();
  if(!page.enabled){update({disabled:true});return;}
  for(const original of page.records){
   let row=original;
   try{
    let success=false;
    for(let attempt=0;attempt<3&&!success;attempt++){
     guard();
     try{
      const body=await retry(()=>driver.convert(row));guard();
      // Never blindly re-encrypt/replay a write whose response may have been lost.
      try{await driver.commit(row,body);guard();success=true;}
      catch(e){guard();if(!transient(e))throw e;
       const before=BigInt(row.id)-1n;const check=await retry(()=>driver.status(before>0n?String(before):undefined,1));
       if(!check.enabled){update({disabled:true});return;}
       if(!check.records.some(x=>x.id===row.id)){success=true;}else{
        const delay=e instanceof ApiError&&e.kind==='rate-limit'?Math.max(1,e.retryAfterSeconds??60)*1000:1000;
        update({error:e instanceof ApiError&&e.kind==='rate-limit'?'请求较多，等待后自动继续':'正在核对提交结果，稍后自动重试'});
        await wait(delay,signal);await retry(()=>driver.commit(row,body));success=true;
       }
      }
     }catch(e){guard();if(!(e instanceof ApiError&&([40902,404].includes(e.businessCode??0))))throw e;
      const before=BigInt(row.id)-1n;const check=await retry(()=>driver.status(before>0n?String(before):undefined,1));
      if(!check.enabled){update({disabled:true});return;}
      const found=check.records.find(x=>x.id===row.id);if(!found){success=true;}else {row=found;if(attempt===2)throw e;await wait(250*(attempt+1),signal);}
     }
    }
    if(success){done++;update();driver.changed();}
   }catch(e){guard();if(e instanceof ApiError&&(e.kind==='unauthorized'||e.businessCode===40920)){if(e.businessCode===40920){update({disabled:true});return;}throw e;}
    if(e instanceof VaultError&&['STALE','LOCKED'].includes(e.code))throw e;
    failures.set(row.id,legacyReason(e));update({error:legacyReason(e)});
   }
  }
  if(!page.next_after)break;requireThat(page.next_after!==after);after=page.next_after;page=await retry(()=>driver.status(after));
 }
 // Full unfiltered recount is the only completion authority, including unsupported rows.
 const final=await retry(()=>driver.status());if(!final.enabled){update({disabled:true});return;}
 if(final.complete){update({complete:true});driver.changed();return;}
 total=done+BigInt(final.pending_count!);
 update({stopped:true,error:final.unsupported_count!=='0'?'存在不支持的历史数据，原记录已保留，请联系维护人员':failures.values().next().value??'仍有历史密钥未完成整理，请重试'});
}
