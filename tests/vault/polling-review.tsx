import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {App} from 'antd';
import SelfServiceMigration from '../../src/pages/token/SelfServiceMigration';import {SelfMigrationClient} from '../../src/services/vault-self-service';import {vaultSession,bindVault} from '../../src/lib/vault/runtime';import api from '../../src/lib/api';import {ApiError} from '../../src/lib/api-error';
const w=window as any;w.lists=0;w.reads=0;w.refreshes=0;w.starts=0;w.clientCloses=0;w.processed=0;w.phase=new URLSearchParams(location.search).has('empty')?null:'canceled';w.throttle=false;
const prepared=await vaultSession.initialize('7','synthetic-test-password');vaultSession.recoverySaved();await vaultSession.verifyRecovery(prepared.recovery);
const v={...prepared.vault,user_id:'7',revision:'1',dek_wrap_count:0,dek_wrap_limit:1000000 as const,dek_wrap_warn_at:900000 as const,created_at:'2026-01-01',updated_at:'2026-01-01'};let stored:any=null;
await vaultSession.publish({read:async()=>({user_id:'7',vault:stored}),create:async()=>{stored=v;return v;},credentials:async()=>v});bindVault(v);
const task=()=>({task_id:'fixture',revision:'1',phase:w.phase,can_cancel:true,counts:{staged:'0',verified:'0',total:'1'}});
api.defaults.adapter=async config=>{let data:any;if(config.url==='/vault')data={initialized:true,user_id:'7',vault:v};else{w.lists++;if(w.pollFail)throw new ApiError('network');data=w.phase===null?{active:null,latest:null}:{active:w.phase==='canceled'?null:task(),latest:task()};}return {config,status:200,statusText:'OK',headers:{},data:{code:0,data}};};
SelfMigrationClient.prototype.establish=async function(account:any,options:any){w.starts++;w.options=options;account.password='';w.phase='preparing';return task();};
SelfMigrationClient.prototype.read=async function(){w.reads++;if(w.throttle){w.throttle=false;throw new ApiError('rate-limit',429,429,undefined,30);}return task();};
SelfMigrationClient.prototype.process=async function(){w.processed++;w.phase='finalizing';return {accepted:true,phase:'finalizing'};};
SelfMigrationClient.prototype.act=async function(){w.phase='canceled';return task();};
SelfMigrationClient.prototype.close=function(){w.clientCloses++;};
const flow:any={vault:v,self_service:{execution_supported:true,start:{allowed:true},resume:{allowed:true}}};
function Parent(){const [mounted,setMounted]=useState(true);return mounted?<SelfServiceMigration flow={flow} unlocked onUnlock={()=>{}} onRunningChange={(x)=>w.running=x} onRefresh={()=>{w.refreshes++;setMounted(false);setTimeout(()=>setMounted(true),0);}}/>:null;}
createRoot(document.getElementById('root')!).render(<App><Parent/></App>);w.ready=true;
