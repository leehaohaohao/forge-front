import {build} from 'esbuild';import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const b=await build({stdin:{contents:`export * from './tests/vault/self-migration-fixture';export * from './src/lib/vault/self-migration';export * from './src/lib/vault/delivery';export * from './src/lib/vault/types';export {RateLimitError} from './src/lib/vault/migration-core';export {ApiError} from './src/lib/api-error';export {SelfMigrationClient} from './src/services/vault-self-service';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm'});
await writeFile('/tmp/forge-self-migration-test.mjs',b.outputFiles[0].contents);const m=await import('/tmp/forge-self-migration-test.mjs');
const v={user_id:'7',vault_id:crypto.randomUUID(),vault_key_version:1,credential_version:1};const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
let passed=0;const check=(a,b)=>{assert.deepEqual(a,b);passed++;};
async function execute(f,api=f.api.bind(f),progress=()=>{}){const p=await m.recipient(),run=await f.bind(p);return m.selfMigrate(run,v,key,new m.DeliveryReceiver(p.privateKey,p.recipient),api,progress,async()=>{});}
const f=new m.Fixture(v);await f.payloads();f.lostStage=f.lostReceipt=f.lostFinalize=true;
check(await execute(f),{accepted:true,phase:'finalizing'});check([f.stages,f.receipts,f.finalizes,f.vault.dek_wrap_count],[3,3,1,201]);
const hashes=f.rows.map(r=>r.envelope_sha256);f.task.phase='client_processing';await execute(f);check(f.rows.map(r=>r.envelope_sha256),hashes);check([f.stages,f.receipts,f.sources],[3,3,6]);
f.task.phase='client_processing';f.tamper=true;await assert.rejects(()=>execute(f));check(f.finalizes,2);f.tamper=false;
for(const code of ['SELF_AUTH','SELF_LEASE','STALE']){f.failure=code;await assert.rejects(()=>execute(f),{code});}f.failure=undefined;passed+=3;
let tries=0,waits=[];await assert.rejects(()=>execute(f,async()=>{tries++;throw new m.RateLimitError(2000);},p=>{if(p.waitingUntil)waits.push(p);}));check(tries,4);check(waits.length,3);
tries=0;await assert.rejects(()=>execute(f,async()=>{tries++;throw new m.VaultError('MIGRATION_NETWORK');}));check(tries,4);
// Boundary fixture exercises all 2000 real encrypt/decrypt comparisons and exactly 8 MiB payload.
const large=new m.Fixture(v,2000);await large.payloads(8*1024*1024);check(Number(large.task.snapshot.source_bytes),8388608);check(large.chunks.every(c=>c.length<=1048576),true);await execute(large);check([large.stages,large.receipts,large.vault.dek_wrap_count],[20,20,2000]);
const pair=await m.recipient(),run=await large.bind(pair);for(const bad of [{record_count:'2001'},{source_bytes:'8388609'},{chunk_count:'0'}]){assert.throws(()=>m.validateRun({...run,...bad}));passed++;}
// Valid AEAD with corrupt manifest / invalid UTF-8 is still rejected before stage.
for(const mode of ['manifest','utf8','sourcebytes']){const bad=new m.Fixture(v,1);await bad.payloads();if(mode==='utf8')bad.chunks[0]=new Uint8Array([255]);else if(mode==='manifest'){const c=JSON.parse(new TextDecoder().decode(bad.chunks[0]));c.manifest.records=[];bad.chunks[0]=new TextEncoder().encode(JSON.stringify(c));}else bad.task.snapshot.source_bytes='1';await assert.rejects(()=>execute(bad));check(bad.stages,0);}
// Main-thread client: exact auth scope, password clear, grant never crosses Worker boundary.
let received,host,closed=false;const session={epoch:1,state:'unlocked',isCurrent:e=>e===1,subscribe:()=>()=>{},selfRecipient:async()=>pair,selfMigrate:async(r,h)=>{received=r;host=h;
 for(const [e,code] of [[new m.ApiError('reauth',401,40101),'SELF_AUTH'],[new m.ApiError('conflict',409,40911),'SELF_LEASE'],[new m.ApiError('conflict',409,40910),'SELF_UNAVAILABLE'],[new m.ApiError('unauthorized',401,401),'STALE']]){fault=e;check((await h({kind:'api',path:'/vault'})).code,code);}fault=undefined;
 fault=new m.ApiError('rate-limit',429,429,undefined,7);check((await h({kind:'api',path:'/vault'})).retryAfterMs,7000);fault=undefined;
 for(const req of [{kind:'reauth'},{kind:'api',path:'/vault/migrations/'+r.batch_id+'/stage',body:{}},{kind:'api',path:'/vault/self-service-migrations/'+r.task_id+'/stage',body:{request_id:crypto.randomUUID(),expected_revision:'2',records:[{id:'1',source_revision:'10',legacy_value:'no'}]}}])check((await h(req)).ok,false);
 return m.selfMigrate(r,v,key,new m.DeliveryReceiver(pair.privateKey,pair.recipient),async(path,body)=>{const reply=await h({kind:'api',path,body});if(!reply.ok)throw new m.VaultError(reply.code);return reply.value;},()=>{},async()=>{});
 },lock:()=>{closed=true;}};
const t=new m.Fixture(v,1);await t.payloads();await t.bind(pair);const headers=[];const token='a'.repeat(43);let fault;
const client=new m.SelfMigrationClient(session,{...v,revision:'1'},{request:async(path,body,signal,h)=>{headers.push({path,body,h,signal});if(fault)throw fault;let data;if(path==='/auth/reauth')data={reauth_token:'proof'};else if(path==='/vault/self-service-migrations')data={task:t.task,authorization:{token,...t.task.delivery,delivery_epoch:t.run.delivery_epoch,scope:'migration'}};else data=await t.api(path,body);if(data.authorization){delete data.authorization.epoch;delete data.authorization.state;}if(data.server_now)delete data.server_now;return {data,date:new Date().toUTCString()};}});
const account={password:'synthetic-account'};await client.establish(account,{});check(account.password,'');await client.process(()=>{});check(JSON.stringify(received).includes(token),false);check(headers[1].h,{'X-Vault-Reauth':'proof'});check(headers.filter(x=>x.path.endsWith('/stage')||x.path.endsWith('/receipt')||x.path.endsWith('/finalize')||x.path.endsWith('/source-chunks')).every(x=>x.h?.['X-Vault-Migration-Authorization']===token&&!x.h?.['X-Forge-Reauth']),true);
// process clears task authorization, preventing stale host use after completion.
check((await host({kind:'api',path:'/auth/login',body:{}})).ok,false);client.close();check(headers[0].signal.aborted,true);
console.log('PASS self-service processing checks:',passed,'(201 mixed rows; 2000/8MiB; lost responses; resume; tamper; auth/lease; retries; host lifecycle)');
