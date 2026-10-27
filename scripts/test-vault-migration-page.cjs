const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const cfg=require('../tests/vault/token-vault-v1-api-fixtures.json').vault_create_request;
const pass=require('../tests/vault/token-vault-v1-vectors.json').inputs.password;
const {statusFor}=require('./vault-flow-fixture.cjs');
const base=process.env.VAULT_PAGE_URL||'http://localhost:4180';
const batchId='66666666-6666-4666-8666-666666666666';
const taskId='77777777-7777-4777-8777-777777777777';
const now='2026-10-26T00:00:00Z';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.MIGRATION_BROWSER?{channel:process.env.MIGRATION_BROWSER}:{})});const page=await browser.newPage();page.setDefaultTimeout(20000);
 let count=3,batch,rows,sourceRows,task,mode='ready',lost=true,stageFail=false,receiptHold=false,receiptRelease,sourceTamper=false,receiptFail=false,revisionDrift=false,rateOnce=false,requestLost=false,taskPosts=[],authFailOnce=false;
 const requests=[],errors=[];let writes=0,reauth=0,stageWrites=0,receiptWrites=0;
 const seen=new Map();
 const reset=(n=3)=>{
  count=n;seen.clear();writes=reauth=stageWrites=receiptWrites=0;stageFail=false;receiptHold=false;sourceTamper=false;authFailOnce=false;receiptFail=false;revisionDrift=false;rateOnce=false;mode='ready';lost=true;receiptRelease=undefined;
  batch={batch_id:batchId,user_id:'7',vault_id:cfg.vault_id,state:'exported',revision:'2',record_count:n,staged_count:0,verified_count:0};
  sourceRows=Array.from({length:n},(_,i)=>({id:String(i+1),source_revision:'1',metadata:{id:String(i+1),user_id:'7',provider:'fixture',name:'row-'+i,token_type:'access',category:'',remark:'',expires_at:null,created_at:now,updated_at:now,has_secret:true,encryption_state:'legacy_pending',revision:'1'},deleted_at:i===1?now:null,legacy_value:'  SYNTHETIC-MIGRATION-SECRET-'+i+'-🔐-é  '}));
  rows=sourceRows.map(({legacy_value,...r})=>({...r,secret_envelope:null,envelope_sha256:null,verified:false}));
  task={task_id:taskId,user_id:'7',vault_id:cfg.vault_id,state:'ready_for_local',revision:'5',batch,operator_id:'42',failure_code:null,next_action:'select_local_source',frozen:true,can_cancel:false,source_exported_at:now,delivered_at:now,created_at:now,updated_at:now};
 };
 reset();
 const vault=()=>({...cfg,user_id:'7',revision:String(4+batch.staged_count),dek_wrap_count:batch.staged_count,dek_wrap_warn_at:900000,dek_wrap_limit:1000000,created_at:now,updated_at:now});
 const status=()=>{const d=statusFor(vault(),'7');d.counts={legacy_active:count-1,legacy_deleted:1,encrypted:0};d.migration_required=true;d.frozen=mode==='ready';d.has_migration_history=mode==='ready';d.audit.state='pending';d.active_batch=d.frozen?{...batch,created_at:now,updated_at:now}:null;d.latest_batch=d.active_batch;
  if(d.frozen)for(const k of ['create_token','replace_secret','edit_metadata','delete_token','update_credentials'])d.operations[k]={allowed:false,reason:'migration_frozen'};
  d.operations.request_migration=mode==='none'?{allowed:true,reason:null}:{allowed:false,reason:'active_request'};return d;};
 const taskView=()=>task?{...task,batch:mode==='ready'?{...batch}:null,...(batch.state==='verified'?{state:'awaiting_cutover',next_action:'operator_verify_cutover'}:{})}:null;
 const hash=e=>require('node:crypto').createHash('sha256').update(JSON.stringify(Object.fromEntries(['format_version','vault_id','vault_key_version','secret_id','secret_version','algorithm','ciphertext','nonce','wrapped_dek','wrap_nonce'].map(k=>[k,e[k]])))).digest('hex');
 await page.addInitScript(()=>{localStorage.setItem('forge_token','fixture');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'fixture'}));const Original=Worker;window.__workerReplies=[];window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',e=>window.__workerReplies.push(e.data));}};});
 page.on('pageerror',e=>errors.push(e.message));
 const handle=async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,body=req.postDataJSON();requests.push({path,body});
  const send=(data,status=200,code=0)=>route.fulfill({status,headers:{'Retry-After':'1'},contentType:'application/json',body:JSON.stringify({code,data})});
  if(path==='/forge/vault/migration-status')return send(status());
  if(path==='/forge/vault')return send({initialized:true,user_id:'7',vault:vault()});
  if(path==='/forge/vault/migration-requests'){
   if(req.method()==='GET'){const t=taskView();return send({active:t?.state==='canceled'?null:t,latest:t});}
   taskPosts.push(body.request_id);assert.deepEqual(Object.keys(body),['request_id']);if(!task){task={...taskView(),task_id:body.request_id,user_id:'7',vault_id:cfg.vault_id,state:'requested',revision:'1',batch:null,operator_id:null,failure_code:null,next_action:'wait_for_operator',frozen:false,can_cancel:true,source_exported_at:null,delivered_at:null,created_at:now,updated_at:now};mode='requested';}
   assert.equal(task.task_id,body.request_id);if(requestLost){requestLost=false;return route.abort();}return send(task);
  }
  if(path.endsWith('/cancel')){assert.equal(body.expected_revision,task.revision);task={...task,state:'canceled',revision:'2',can_cancel:false,next_action:'request_again'};mode='none';return send(task);}
  if(path==='/forge/auth/reauth'){if(authFailOnce){authFailOnce=false;return send(null,401,40101);}if(rateOnce){rateOnce=false;return send(null,429,429);}assert.equal(body.purpose,'vault_migration');assert.equal(body.account_password,'ACCOUNT-FIXTURE');reauth++;return send({reauth_token:'authorization-'+reauth});}
  if(path==='/forge/vault/migrations/'+batchId && req.method()==='GET'){
   const after=Number(url.searchParams.get('after')||0);const selected=structuredClone(rows.filter(r=>Number(r.id)>after).slice(0,100));
   if(sourceTamper&&selected[0]?.secret_envelope)selected[0].envelope_sha256='0'.repeat(64);
   return send({batch:{...batch,...(revisionDrift&&after?{revision:String(BigInt(batch.revision)+1n)}:{})},records:selected,next_after:selected.length===100?selected.at(-1).id:null});
  }
  if(path.endsWith('/stage')||path.endsWith('/receipt')){
   writes++;assert(req.headers()['x-forge-reauth']);assert(body.records.length>0&&body.records.length<=100);assert(Buffer.byteLength(JSON.stringify(body))<=(path.endsWith('/stage')?2*1024*1024:64*1024));
   if(seen.has(body.request_id)){assert.deepEqual(body,seen.get(body.request_id).body);return send(seen.get(body.request_id).reply);}
   if(body.expected_revision!==batch.revision)return send(null,409,40902);
   if(path.endsWith('/stage')){
    if(stageFail)return route.abort();
    for(const item of body.records){const row=rows.find(r=>r.id===item.id);assert(!row.secret_envelope);row.secret_envelope=item.secret_envelope;row.envelope_sha256=hash(item.secret_envelope);batch.staged_count++;}stageWrites++;
   }else{
    if(receiptFail)return route.abort();
    if(receiptHold)await new Promise(r=>receiptRelease=r);
    for(const item of body.records){const row=rows.find(r=>r.id===item.id);assert.equal(item.envelope_sha256,row.envelope_sha256);row.verified=true;batch.verified_count++;}receiptWrites++;
   }
   batch.revision=String(BigInt(batch.revision)+1n);batch.state=batch.verified_count===count?'verified':'staged';seen.set(body.request_id,{body:structuredClone(body),reply:{...batch}});
   if(path.endsWith('/stage')&&lost){lost=false;return route.abort();}return send({...batch});
  }
  if(path==='/forge/token')return send({list:[],total:0,page:1,page_size:10});
  return send({});
 };await page.route('**/forge/**',handle);
 const btn=name=>page.getByRole('button',{name:new RegExp('^'+[...name].join('\\s*')+'$')});
 const load=async()=>{await page.goto(base+'/app/token');await page.getByLabel('独立解锁密码',{exact:true}).waitFor();};
 const unlock=async()=>{await page.getByLabel('独立解锁密码',{exact:true}).fill(pass);await btn('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();};
 const file=(records=sourceRows)=>({name:'fixture.jsonl',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'forge-migration-source-v1',batch:{...batch,state:'frozen',revision:'1',staged_count:0,verified_count:0}})+'\n'+records.map(r=>JSON.stringify(r)).join('\n')+'\n')});
 const start=async chosen=>{await page.getByLabel('选择本地迁移源文件',{exact:true}).setInputFiles(chosen||file());await page.getByLabel('迁移账号登录密码',{exact:true}).fill('ACCOUNT-FIXTURE');await page.getByRole('checkbox').check();await btn('开始本地校验').click();};
 try{
  if(process.env.EXPECT_MIGRATION_DISABLED){mode='none';task=null;await load();await page.getByText('迁移执行入口尚未开放，请联系管理员确认部署与验收。',{exact:true}).waitFor();assert.equal(await btn('申请迁移准备').count(),0);reset();await load();await unlock();assert.equal(await page.getByLabel('选择本地迁移源文件',{exact:true}).count(),0);assert.equal(writes,0);console.log('PASS disabled migration gate: read-only state, no preparation/local writes');return;}

  mode='none';task=null;requestLost=true;await load();await btn('申请迁移准备').click();await btn('OK').click();await page.getByText(/网络连接失败/).waitFor();await btn('OK').waitFor({state:'hidden'});await btn('申请迁移准备').click();await btn('OK').click();assert.equal(taskPosts[0],taskPosts[1]);await page.getByText(/等待管理员领取/).first().waitFor();assert.equal(batch.state,'exported');await btn('取消申请').click();await btn('OK').click();await page.getByText(/上次准备已取消/).waitFor();
  reset();await load();await btn('解锁后继续迁移').click();await unlock();
  const bad=structuredClone(sourceRows);bad[0].source_revision='2';bad[0].metadata.revision='2';await start(file(bad));await page.getByText(/文件或服务端暂存包校验失败/).waitFor();assert.equal(writes,0);
  rateOnce=true;await start();await page.getByText(/限流或重试等待/).waitFor();await page.getByText(/等待管理员最终切换/).waitFor();assert.equal(stageWrites,1);assert.equal(receiptWrites,1);assert.equal(reauth,2);assert(writes===3,'lost stage response reused request');assert.equal(await page.locator('.vault-steps [aria-current=step]').getAttribute('data-step'),'migration');
  const traffic=JSON.stringify(requests),replies=JSON.stringify(await page.evaluate(()=>window.__workerReplies));
  for(const row of sourceRows){assert(!traffic.includes(row.legacy_value));assert(!replies.includes(row.legacy_value));}assert(!replies.includes('ACCOUNT-FIXTURE'));assert(!replies.includes(pass));
  assert(!(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).includes('SYNTHETIC-MIGRATION'));
  reset(201);await load();await unlock();await start();await page.getByText(/等待管理员最终切换/).waitFor({timeout:60000});assert.equal(stageWrites,3);assert.equal(receiptWrites,3);assert.equal(reauth,6);
  reset();receiptHold=true;await load();await unlock();await start();while(!receiptRelease)await page.waitForTimeout(50);await btn('停止并锁定').click();receiptHold=false;receiptRelease();await page.getByText('已锁定',{exact:true}).waitFor();await page.waitForTimeout(200);assert.equal(await page.getByLabel('选择本地迁移源文件',{exact:true}).count(),0);
  // The server can finish an already-submitted transaction despite client cancellation.
  assert.equal(await page.getByText(/正在本地校验/).count(),0);await btn('刷新状态').click();await page.getByText(/等待管理员最终切换/).waitFor();
  reset();stageFail=true;await load();await unlock();await start();await page.getByText(/迁移请求结果暂时无法确认/).waitFor();assert.equal(stageWrites,0);const attempts=requests.filter(r=>r.path.endsWith('/stage')).slice(-2);assert.deepEqual(attempts[0].body,attempts[1].body);stageFail=false;await start();await page.getByText(/等待管理员最终切换/).waitFor();assert.equal(stageWrites,1);
  reset();receiptFail=true;await load();await unlock();await start();await page.getByText(/迁移请求结果暂时无法确认/).waitFor();assert.equal(stageWrites,1);assert.equal(receiptWrites,0);receiptFail=false;await page.reload();await page.getByLabel('独立解锁密码',{exact:true}).waitFor();assert.equal(await page.getByLabel('选择本地迁移源文件',{exact:true}).count(),0);await unlock();await page.getByLabel('选择本地迁移源文件',{exact:true}).waitFor();assert.equal(await page.getByLabel('选择本地迁移源文件',{exact:true}).inputValue(),'');await start();await page.getByText(/等待管理员最终切换/).waitFor();assert.equal(stageWrites,1,'resume never reencrypts staged records');assert.equal(receiptWrites,1);
  reset(201);revisionDrift=true;await load();await unlock();await start();await page.getByText(/迁移状态已变化/).waitFor();assert.equal(writes,0,'mixed page revisions cannot write');
  reset();sourceTamper=true;await load();await unlock();await start();await page.getByText(/文件或服务端暂存包校验失败/).waitFor();assert.equal(receiptWrites,0);
  reset();authFailOnce=true;await load();await unlock();await start();await page.getByText(/账号身份确认失败/).waitFor();assert.equal(stageWrites,0);assert.equal(await page.evaluate(()=>localStorage.getItem('forge_token')),'fixture');assert.equal(await page.getByLabel('迁移账号登录密码',{exact:true}).inputValue(),'');await start();await page.getByText(/等待管理员最终切换/).waitFor();assert.equal(stageWrites,1);
  reset();lost=false;await load();await unlock();
  const other=await browser.newPage();other.setDefaultTimeout(20000);await other.addInitScript(()=>{localStorage.setItem('forge_token','fixture');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'fixture'}));});await other.route('**/forge/**',handle);await other.goto(base+'/app/token');await other.getByLabel('独立解锁密码',{exact:true}).fill(pass);await other.getByRole('button',{name:/^解\s*锁$/}).click();await other.getByText('已解锁',{exact:true}).waitFor();
  for(const p of [page,other]){await p.getByLabel('选择本地迁移源文件',{exact:true}).setInputFiles(file());await p.getByLabel('迁移账号登录密码',{exact:true}).fill('ACCOUNT-FIXTURE');await p.getByRole('checkbox').check();}
  await Promise.all([page,other].map(p=>p.getByRole('button',{name:'开始本地校验',exact:true}).click()));
  const deadline=Date.now()+20000;while(batch.verified_count!==count && Date.now()<deadline)await page.waitForTimeout(100);assert.equal(batch.verified_count,count);assert.equal(stageWrites,1);assert.equal(receiptWrites,1);await page.waitForTimeout(300);
  const texts=await Promise.all([page,other].map(p=>p.locator('body').innerText()));assert(texts.some(t=>t.includes('等待管理员最终切换')));assert(texts.some(t=>t.includes('迁移状态已变化')||t.includes('等待管理员最终切换')));await other.close();
  const finalTraffic=JSON.stringify(requests);assert(!finalTraffic.includes('SYNTHETIC-MIGRATION-SECRET'));if(process.env.MIGRATION_SCREENSHOT)await page.screenshot({path:process.env.MIGRATION_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS browser migration: idempotent preparation/cancel, source validation, real Worker/ciphertext-only, 201 records, rate limit, stop/late reply, refresh resume, identical retry, page revision drift, tamper and concurrent sessions');
 }catch(e){console.log('migration diagnostic',{taskPosts,stageWrites,receiptWrites,batchState:batch.state});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
