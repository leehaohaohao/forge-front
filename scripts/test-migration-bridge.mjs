import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
const built=await build({stdin:{contents:"export {default as api} from './src/lib/api';export * from './src/services/vault-migration';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',packages:'external',alias:{'@':process.cwd()+'/src'}});
const temp=new URL('../.migration-bridge-test.mjs',import.meta.url);await writeFile(temp,built.outputFiles[0].contents);
try{
 globalThis.localStorage={getItem:()=>null,removeItem:()=>{}};globalThis.window=new EventTarget();
 const {api,migrationHost,parseTask,readTasks}=await import(temp.href);
 const flow=JSON.parse(await readFile('tests/vault/vault-migration-status-v1.json','utf8')).responses.mixed_unfrozen.data;
 const fixture=JSON.parse(await readFile('../forge/docs/testdata/token-vault-migration-v1-api-fixtures.json','utf8'));
 const batch={batch_id:fixture.batch_id,user_id:'7',vault_id:flow.vault.vault_id,state:'staged',revision:'3',record_count:1,staged_count:1,verified_count:0};
 let calls=[],limited=false;
 api.defaults.adapter=async config=>{calls.push(config);return {config,status:limited?429:200,statusText:'fixture',headers:{'retry-after':'2'},data:{code:limited?429:0,data:config.url==='/auth/reauth'?{reauth_token:'private-token'}:batch}};};
 const credentials={password:'private-account-password',authorization:''},controller=new AbortController();const host=migrationHost(flow,batch.batch_id,credentials,controller.signal);
 for(const req of [{kind:'api',path:'/vault/migrations/other'},{kind:'api',path:'/vault/migrations/'+batch.batch_id+'/stage',body:{...fixture.stage_request,legacy_value:'MUST_NOT_SEND'}},{kind:'api',path:'/vault/migrations/'+batch.batch_id+'?after=1&user_id=8'}]){assert.equal((await host(req)).ok,false);}assert.equal(calls.length,0);
 assert.deepEqual(await host({kind:'reauth'}),{ok:true,value:true});assert.equal(JSON.parse(calls[0].data).purpose,'vault_migration');assert.equal(credentials.authorization,'private-token');
 assert.equal((await host({kind:'api',path:'/vault/migrations/'+batch.batch_id+'/stage',body:fixture.stage_request})).ok,true);assert.equal(calls.at(-1).headers['X-Forge-Reauth'],'private-token');assert(!calls.at(-1).data.includes('private-account-password'));
 controller.abort();const before=calls.length;assert.equal((await host({kind:'reauth'})).code,'STALE');assert.equal(calls.length,before);
 const task={task_id:'77777777-7777-4777-8777-777777777777',user_id:'7',vault_id:flow.vault.vault_id,state:'ready_for_local',revision:'1',batch,operator_id:'42',failure_code:null,next_action:'select_local_source',frozen:true,can_cancel:false,source_exported_at:'2026-10-26T00:00:00Z',delivered_at:'2026-10-26T00:00:00Z',created_at:'2026-10-26T00:00:00Z',updated_at:'2026-10-26T00:00:00Z'};
 assert.equal(parseTask(task,flow).task_id,task.task_id);
 for(const mutate of [t=>t.user_id='8',t=>t.delivered_at=null,t=>t.failure_code='RAW SQL',t=>t.can_cancel=true,t=>t.frozen=false,t=>t.secret='secret']){const t=structuredClone(task);mutate(t);assert.throws(()=>parseTask(t,flow));}
 limited=true;await assert.rejects(()=>readTasks(flow,new AbortController().signal),e=>e.kind==='rate-limit');const n=calls.length;await assert.rejects(()=>readTasks(flow,new AbortController().signal),e=>e.kind==='rate-limit');assert.equal(calls.length,n);
 console.log('PASS migration bridge allowlist, forbidden plaintext fields, one-time auth kept out of Worker, abort, task identity/delivery validation and backoff across reads');
}finally{await unlink(temp);}
