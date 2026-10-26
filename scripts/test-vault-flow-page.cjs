const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fixtures=require('../tests/vault/vault-migration-status-v1.json').responses;
const config=require('../tests/vault/token-vault-v1-api-fixtures.json').vault_create_request;
const password=require('../tests/vault/token-vault-v1-vectors.json').inputs.password;
const base=process.env.VAULT_PAGE_URL||'http://localhost:4180';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.VAULT_BROWSER?{channel:process.env.VAULT_BROWSER}:{})});
 const page=await browser.newPage();page.setDefaultTimeout(15000);
 let status=structuredClone(fixtures.mixed_unfrozen.data),failure=0,reads=0,writes=0,gate,hold=false;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('forge_token','fixture');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'fixture'}));});
 await page.route('**/forge/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const send=(data,http=200,code=0)=>route.fulfill({status:http,headers:{'Retry-After':'20'},contentType:'application/json',body:JSON.stringify({code,data})});
  if(route.request().method()!=='GET')writes++;
  if(path==='/forge/vault/migration-status'){reads++;const body=structuredClone(status),failed=failure;if(hold)await new Promise(r=>gate=r);return send(failed?null:body,failed||200,failed);}
  if(path==='/forge/vault')return send({initialized:status.initialized,user_id:'7',vault:status.initialized?{...config,user_id:'7',revision:'4',dek_wrap_count:1,dek_wrap_warn_at:900000,dek_wrap_limit:1000000}:null});
  if(path==='/forge/token')return send({list:[{id:'9',user_id:'7',name:'legacy-fixture',provider:'fixture',revision:'1',encryption_state:'legacy_pending',has_secret:true,expires_at:null}],total:1,page:1,page_size:10});
  if(path==='/forge/dashboard/stats')return send({token_count:0,workspace_count:0,link_count:0});
  return send({});
 });
 const step=()=>page.locator('.vault-steps [aria-current=step]').getAttribute('data-step');
 const button=name=>page.getByRole('button',{name:new RegExp('^'+[...name].join('\\s*')+'$')});
 const load=async key=>{status=structuredClone(fixtures[key].data);failure=0;await page.goto(base+'/app/token');await page.getByLabel('独立解锁密码',{exact:true}).waitFor();};
 try{
  await load('mixed_unfrozen');assert.equal(await step(),'migration');assert.equal(await page.locator('.vault-step-number').allTextContents()+ '','1,2,3,4');assert(await button('新增密钥').isEnabled());
  const before=reads;
  const help=page.getByRole('button',{name:'迁移历史密钥说明',exact:true});await help.hover();await page.getByText('管理员通过经认证的加密通道或加密归档交付文件，勿通过普通附件或公开链接上传。',{exact:true}).waitFor();await page.mouse.move(0,0);await help.focus();await page.getByRole('button',{name:'关闭说明',exact:true}).waitFor();await help.press('Escape');await help.click();await page.getByRole('button',{name:'关闭说明',exact:true}).click();assert.equal(reads,before);assert.equal(writes,0);
  await button('待迁移').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'vault-migration-step');
  await button('新增密钥').click();assert.equal(await page.getByLabel('业务密钥',{exact:true}).count(),0);await button('取消新增').click();
  await page.getByLabel('独立解锁密码',{exact:true}).fill(password);await button('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();assert.equal(await page.getByLabel('业务密钥',{exact:true}).count(),0,'canceled intent cannot reopen');assert.equal(await step(),'migration');
  await button('锁定并清理').click();await button('新增密钥').click();await page.getByLabel('独立解锁密码',{exact:true}).fill(password);await button('解锁').click();await button('取消新增').click();await page.waitForTimeout(800);assert.equal(await page.getByLabel('业务密钥',{exact:true}).count(),0,'cancel during KDF cannot reopen');
  await button('锁定并清理').click();assert.equal(await step(),'migration');await button('新增密钥').click();await page.getByLabel('独立解锁密码',{exact:true}).fill(password);await button('解锁').click();await page.getByLabel('业务密钥',{exact:true}).waitFor();assert.equal(await page.getByLabel('业务密钥',{exact:true}).inputValue(),'');assert.equal(writes,0);await button('Cancel').click();
  await button('锁定并清理').click();await button('新增密钥').click();await page.getByRole('link',{name:'首页',exact:true}).click();await page.getByRole('link',{name:'密钥管理',exact:true}).click();await page.getByLabel('独立解锁密码',{exact:true}).fill(password);await button('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();assert.equal(await page.getByLabel('业务密钥',{exact:true}).count(),0,'route departure clears intent');
  await load('verified');assert.equal(await step(),'migration');await page.getByText(/等待管理员切换/).first().waitFor();assert(await button('新增密钥').isDisabled());assert(await button('编辑').isDisabled());
  await load('switched');assert.equal(await step(),'use');assert.equal(await page.locator('.vault-step-number').count(),4);
  await button('修改解锁密码').click();assert.equal(await step(),'use');await page.getByRole('heading',{name:'更新解锁凭据',exact:true}).waitFor();
  await load('mixed_unfrozen');status.counts.legacy_active=0;await button('刷新迁移状态').click();await page.getByText(/历史 0 条，已删除历史 1 条/).waitFor();assert.equal(await step(),'migration');
  status=structuredClone(fixtures.switched.data);status.audit={state:'failed',complete:false,checked_at:null,switched_at:null};await button('刷新迁移状态').click();await page.getByText(/迁移核验失败/).first().waitFor();assert.equal(await step(),'migration');
  if(process.env.VAULT_FLOW_SCREENSHOT)await page.screenshot({path:process.env.VAULT_FLOW_SCREENSHOT,fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.locator('.vault-step-number').last().isVisible());const h=page.getByRole('button',{name:'创建保险库说明',exact:true});await h.click();await page.getByRole('button',{name:'关闭说明',exact:true}).waitFor();await page.getByRole('button',{name:'关闭说明',exact:true}).click();
  await page.getByRole('button',{name:'关闭说明',exact:true}).waitFor({state:'hidden'});
  assert(await page.locator('.vault-step-number, .vault-help').evaluateAll(xs=>xs.every(x=>{const r=x.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth;})),'all mobile step numbers and help controls must fit');
  if(process.env.VAULT_FLOW_SCREENSHOT)await page.screenshot({path:process.env.VAULT_FLOW_SCREENSHOT.replace('.png','-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});await load('uninitialized');assert.equal(await step(),'create');assert.equal(await page.locator('.vault-step-number').count(),3);await button('新增密钥').click();assert.equal(await page.getByLabel('业务密钥',{exact:true}).count(),0);await button('取消新增').click();
  await page.clock.install();failure=429;await page.reload();await page.getByText(/请求较多/).waitFor();assert.equal(await page.locator('.vault-steps').count(),0);assert.equal(await page.locator('.ant-message-notice').count(),0);assert(await button('新增密钥').isDisabled());const throttled=reads;failure=0;await button('重试状态').click();await page.clock.runFor(19900);assert.equal(reads,throttled);await page.clock.runFor(200);await page.getByLabel('独立解锁密码',{exact:true}).waitFor();
  failure=500;await button('刷新状态').click();await page.getByText('服务暂时不可用，请稍后重试',{exact:true}).waitFor();assert.equal(await page.locator('.vault-steps').getAttribute('aria-busy'),'true');assert.equal(await button('创建本地保险库').count(),0);
  failure=500;await page.reload();await page.getByText('服务暂时不可用，请稍后重试',{exact:true}).waitFor();assert.equal(await page.locator('.vault-steps').count(),0);assert.equal(await button('创建本地保险库').count(),0);
  failure=0;hold=true;await button('重试状态').click();await page.clock.runFor(10001);await page.waitForFunction(()=>location.pathname==='/app/token');await page.waitForTimeout(100);await page.getByRole('link',{name:'首页',exact:true}).click();hold=false;gate?.();await page.waitForTimeout(300);assert.equal(await page.locator('.vault-steps').count(),0);assert.equal(await page.locator('.ant-message-notice').count(),0);
  assert.equal(writes,0);assert.deepEqual(errors,[]);console.log('PASS F1 production UI: progress, deleted scope, frozen/audit, help mouse/focus/click, create intent/real unlock/cancel/leave, failure/retry/backoff/stale response');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
