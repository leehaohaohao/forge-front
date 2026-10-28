import {VaultSession} from '../../src/lib/vault/session';
import {SelfMigrationClient} from '../../src/services/vault-self-service';
import {fingerprint} from '../../src/lib/vault/delivery';
import {Fixture} from './self-migration-fixture';
const w=window as any;let session:VaultSession,f:Fixture,v:any,client:SelfMigrationClient;
const password='synthetic-vault-password';w.progress=[];w.aborted=0;w.block=false;w.monitor=false;
w.setup=async(state?:any,idle=300000)=>{
 session?.dispose();session=new VaultSession(idle);
 if(state){v=state.vault;f=new Fixture(v,state.rows.length);f.batch=state.batch;f.rows=state.rows;f.task=state.task;f.task.phase='client_processing';f.vault={...v,dek_wrap_count:f.rows.filter(r=>r.secret_envelope).length};await f.payloads();await session.unlock('7',v,password);}
 else{const prepared=await session.initialize('7',password);session.recoverySaved();await session.verifyRecovery(prepared.recovery);v={...prepared.vault,user_id:'7',revision:'1',dek_wrap_count:0,dek_wrap_limit:1000000,dek_wrap_warn_at:900000};let stored:any=null;await session.publish({read:async()=>({user_id:'7',vault:stored}),create:async()=>{stored=v;return v;},credentials:async()=>v});f=new Fixture(v);await f.payloads();}
 return true;
};
w.run=async()=>{
 client=new SelfMigrationClient(session,v,{request:async(path,body:any,signal,headers)=>{
  let data:any;
  if(path==='/auth/reauth')data={reauth_token:'synthetic-proof'};
  else if(path.endsWith('/session')){if(headers?.['X-Vault-Reauth']!=='synthetic-proof')throw Error('proof header');await f.bind({publicKey:body.recipient_public_key,recipient:await fingerprint(body.recipient_public_key)});data={task:f.task,authorization:{token:'a'.repeat(43),expires_at:f.task.delivery.expires_at,delivery_epoch:f.run.delivery_epoch,recipient:f.run.recipient,scope:'migration'}};}
  else{
   if(body&&headers?.['X-Vault-Migration-Authorization']!=='a'.repeat(43))throw Error('task header');
   if(w.block&&path.endsWith('/source-chunks')&&body.chunk_id==='2'){w.waiting=true;await new Promise((_,reject)=>signal.addEventListener('abort',()=>{w.aborted++;reject(Error('aborted'));},{once:true}));}
   data=await f.api(path,body);if(data.server_now)delete data.server_now;
  }
  return {data,date:new Date().toUTCString()};
 }});
 const account={password:'synthetic-account'};
 try{await client.establish(account,{resume:{taskId:f.task.task_id,revision:f.task.revision,replaceExisting:true}});if(account.password)throw Error('password retained');w.monitor=true;const result=await client.process(p=>w.progress.push(p));return result;}
 finally{w.monitor=false;client.close();}
};
w.lock=()=>session.lock();w.exitWorker=()=>session.dispose();
w.snapshot=()=>({vault:v,batch:f.batch,task:f.task,rows:f.rows});
w.stats=()=>({stages:f.stages,receipts:f.receipts,sources:f.sources,finalizes:f.finalizes,wraps:f.vault.dek_wrap_count,state:session.state,requests:f.requests});
w.ready=true;
