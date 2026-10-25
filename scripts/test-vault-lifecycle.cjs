const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('forge_token','fixture');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'fixture'}));});
  let gate=null,fail=false,reads=0,writes=0;
  await page.route('**/forge/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   const send=(data,status=200,code=0)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({code,data})});
   if(req.method()!=='GET')writes++;
   if(path==='/forge/vault'){
    reads++;const shouldFail=fail;
    if(gate)await gate.promise;else await new Promise(r=>setTimeout(r,250));
    await send(shouldFail?null:{initialized:false,user_id:'7',vault:null},shouldFail?500:200,shouldFail?500:0);return;
   }
   if(path==='/forge/token')return send({list:[],total:0,page:1,page_size:10});
   if(path==='/forge/dashboard/stats')return send({token_count:0,workspace_count:0,link_count:0});
   if(path==='/forge/user/settings')return send({});
   return send([]);
  });
  const base=process.env.VAULT_DEV_URL||'http://localhost:3000';
  await page.goto(base+'/app/token');await page.getByRole('button',{name:'创建本地保险库',exact:true}).waitFor();
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.ant-message-notice').count(),0,'opening dev page alone must not toast');
  // Observe actual Axios signals on subsequent StrictMode remounts.
  await page.evaluate(async()=>{
   const {default:api}=await import('/src/lib/api.ts');window.__vaultSignals=[];
   api.interceptors.request.use(config=>{if(config.url==='/vault')window.__vaultSignals.push(config.signal);return config;});
  });
  const home=async()=>{await page.getByRole('link',{name:'首页',exact:true}).click();await page.getByRole('button',{name:'读取保险库状态',exact:true}).waitFor({state:'hidden'});await page.waitForURL(/\/app\/?$/);};
  const token=()=>page.getByRole('link',{name:'密钥管理',exact:true}).click();
  const hold=()=>{let release;const promise=new Promise(r=>release=r);gate={promise,release};return gate;};
  for(const failure of [false,true]) {
   await home();fail=failure;const pending=hold();const before=reads;
   await token();await page.waitForFunction(()=>window.__vaultSignals.length>0);
   await page.waitForTimeout(300);assert(reads>before);
   await home();
   await page.waitForFunction(()=>window.__vaultSignals.every(signal=>signal.aborted));
   gate=null;pending.release();await page.waitForTimeout(500);
   assert.equal(await page.locator('.ant-message-notice').count(),0,'late success/failure must not toast on home');
  }
  fail=false;await token();await page.getByRole('button',{name:'创建本地保险库',exact:true}).waitFor();
  const pending=hold(),before=reads,signalStart=await page.evaluate(()=>window.__vaultSignals.length);
  await page.getByLabel('独立解锁密码',{exact:true}).fill('Fictional lifecycle password!');await page.getByRole('button',{name:'创建本地保险库',exact:true}).click();
  await page.waitForTimeout(300);assert(reads>before);await home();
  await page.waitForFunction(start=>window.__vaultSignals.slice(start).every(signal=>signal.aborted),signalStart);
  gate=null;pending.release();await page.waitForTimeout(500);assert.equal(writes,0);assert.equal(await page.locator('.ant-message-notice').count(),0);
  // A live mount still reports a real service error exactly once.
  fail=true;await token();await page.getByText('服务暂时不可用，请稍后重试',{exact:true}).waitFor();assert.equal(await page.locator('.ant-message-notice').count(),1);
  const checks=await page.evaluate(async()=>{
   const {operation,vaultSession}=await import('/src/lib/vault/runtime.ts');
   const canceled=operation();canceled.cancel();let cancelGuard=false;try{canceled.guard();}catch(e){cancelGuard=e.code==='STALE';}
   const stale=operation();vaultSession.lock();let staleGuard=false;try{stale.guard();}catch(e){staleGuard=e.code==='STALE';}stale.done();
   return {aborted:canceled.signal.aborted,cancelGuard,staleGuard,locked:vaultSession.state==='locked'};
  });
  assert.deepEqual(checks,{aborted:true,cancelGuard:true,staleGuard:true,locked:true});assert.deepEqual(errors,[]);
  console.log('PASS real development StrictMode: silent initial load, actual signal abort, unmounted success/failure/action isolation, live errors and session guards');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


