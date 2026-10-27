const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fixtures=require('../tests/vault/vault-migration-status-v1.json').responses;
const config=require('../tests/vault/token-vault-v1-api-fixtures.json');
const vectors=require('../tests/vault/token-vault-v1-vectors.json');
const {completedTask}=require('./vault-completion-fixture.cjs');
const base=process.env.VAULT_PAGE_URL||'http://localhost:4180',now='2026-10-27T00:00:00Z';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const vault={...config.vault_create_request,user_id:'7',revision:'4',created_at:now,updated_at:now,dek_wrap_count:1,dek_wrap_warn_at:900000,dek_wrap_limit:1000000};
const metadata={id:'1',user_id:'7',revision:'2',provider:'fixture',name:'migrated-fixture',token_type:'access',category:'',remark:'',expires_at:null,created_at:now,updated_at:now,has_secret:true,encryption_state:'client_encrypted'};
const backup={format_version:1,export_id:'88888888-8888-4888-8888-888888888888',exported_at:now,user_id:'7',vault,record_count:1,legacy_pending_count:0,records:[{metadata,deleted_at:now,secret_envelope:config.token_create_request.secret_envelope}]};
const recovery={format_version:1,user_id:'7',vault_id:vault.vault_id,recovery_key:Buffer.from(vectors.inputs.rk_hex,'hex').toString('base64')};
const file=(name,obj)=>({name,mimeType:'application/json',buffer:Buffer.from(typeof obj==='string'?obj:JSON.stringify(obj))});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let status=structuredClone(fixtures.verified.data),task=null,taskFailure=false,tokenReads=0,reauthPurpose='',exportCalls=0;
 await page.addInitScript(()=>{localStorage.setItem('forge_token','fixture');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'fixture'}));});
 await page.route('**/forge/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const send=(data,http=200,code=0)=>route.fulfill({status:http,contentType:'application/json',body:JSON.stringify({code,data})});
  if(path==='/forge/vault/migration-status')return send(status);
  if(path==='/forge/vault/migration-requests')return taskFailure?send(null,500,500):send({active:null,latest:task});
  if(path==='/forge/vault')return send({initialized:true,user_id:'7',vault});
  if(path==='/forge/token'){tokenReads++;return send({list:[{...metadata,encryption_state:status.latest_batch?.state==='switched'?'client_encrypted':'legacy_pending'}],total:1,page:1,page_size:10});}
  if(path==='/forge/token/1/access')return send({id:metadata.id,user_id:metadata.user_id,revision:metadata.revision,secret_envelope:config.token_create_request.secret_envelope});
  if(path==='/forge/auth/reauth'){reauthPurpose=route.request().postDataJSON().purpose;return send({reauth_token:'export-grant'});}
  if(path==='/forge/vault/export'){exportCalls++;assert.equal(route.request().headers()['x-forge-reauth'],'export-grant');assert.deepEqual(route.request().postDataJSON(),{expected_revision:'4'});return send(backup);}
  return send({});
 });
 const step=()=>page.locator('.vault-steps [aria-current=step]').getAttribute('data-step');
 const refresh=()=>page.getByRole('button',{name:'刷新状态',exact:true}).click();
 const btn=name=>page.getByRole('button',{name:new RegExp('^'+[...name].join('\\s*')+'$')});
 try{
  await page.goto(base+'/app/token');await page.getByLabel('独立解锁密码',{exact:true}).waitFor();assert.equal(await step(),'migration');
  const n=tokenReads;status=structuredClone(fixtures.switched.data);task=completedTask(status);task.state='awaiting_cutover';task.audit_complete=false;task.next_action='operator_verify_cutover';await refresh();await page.getByText('迁移完成状态尚未通过核对，请刷新或联系负责人。').waitFor();assert.equal(await step(),'migration');
  task=completedTask(status);await refresh();await page.getByText('历史迁移已完成',{exact:true}).waitFor();assert.equal(await step(),'use');assert.equal(await page.locator('.vault-step-number').count(),4);assert(tokenReads>n);await page.getByText('已加密',{exact:true}).waitFor();assert(await btn('新增密钥').isEnabled());assert(await btn('查看').isDisabled());
  await page.getByText('迁移结果与后续核验详情',{exact:true}).click();await page.getByText(/管理员加密备份：待处理/).waitFor();
  task.backup_state='exported';task.backup_id='99999999-9999-4999-8999-999999999999';task.backup_exported_at=now;task.recovery_state='failed';task.recovery_checked_at=now;task.next_action='operator_verify_recovery';await refresh();await page.getByText('迁移结果与后续核验详情',{exact:true}).click();await page.getByText(/该快照独立恢复：失败/).waitFor();assert.equal(await step(),'use');assert(await btn('新增密钥').isEnabled());
  await page.getByLabel('独立解锁密码',{exact:true}).fill(vectors.inputs.password);await btn('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();assert(await btn('查看').isEnabled());assert(await btn('复制').isEnabled());await btn('查看').click();await page.getByRole('dialog').getByText(vectors.inputs.plaintext,{exact:true}).waitFor();await btn('隐藏').click();await page.context().grantPermissions(['clipboard-read','clipboard-write']);await btn('复制').click();await page.getByText('已复制',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),vectors.inputs.plaintext);await page.evaluate(()=>navigator.clipboard.writeText(''));
  await btn('新增密钥').click();await page.getByLabel('业务密钥',{exact:true}).waitFor();await btn('Cancel').click();
  await page.getByText('加密备份与独立恢复验证',{exact:true}).click();await page.getByLabel('备份账号登录密码').fill('ACCOUNT-FIXTURE');await page.getByRole('button',{name:'准备加密备份',exact:true}).click();await page.getByRole('button',{name:'下载加密备份',exact:true}).waitFor();assert.equal(reauthPurpose,'vault_export');assert.equal(exportCalls,1);assert.equal(await page.getByLabel('备份账号登录密码').inputValue(),'');
  const readDownload=async(name)=>{const promise=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const d=await promise;const chunks=[];for await(const chunk of await d.createReadStream())chunks.push(chunk);return Buffer.concat(chunks);};
  const downloaded=await readDownload('下载加密备份'),sum=await readDownload('下载备份摘要');assert.deepEqual(JSON.parse(downloaded),backup);assert.equal(sum.toString().trim(),hash(downloaded));assert(!downloaded.toString().includes(vectors.inputs.plaintext));
  if(process.env.FRONT3_SCREENSHOT)await page.screenshot({path:process.env.FRONT3_SCREENSHOT,fullPage:true});
  taskFailure=true;await refresh();await page.getByText('服务暂时不可用，请稍后重试',{exact:true}).waitFor();assert.equal(await page.locator('.vault-steps').getAttribute('aria-busy'),'true');assert.equal(await page.getByText('历史迁移已完成',{exact:true}).count(),0);
  taskFailure=false;task={...task,state:'failed',audit_complete:false,failure_code:'audit_failed',next_action:'operator_retry'};await page.reload();await page.getByText('切换后核验失败，请联系负责人处理').waitFor();assert.equal(await step(),'migration');
  await page.goto(base+'/app/recovery-check');await page.getByText('当前浏览器存在登录会话，请复制本页地址到新的隐私窗口。').waitFor();assert.equal(await page.getByLabel('恢复验证恢复文件').count(),0);
  const clean=await browser.newContext(),check=await clean.newPage();check.setDefaultTimeout(15000);const traffic=[];check.on('pageerror',e=>errors.push(e.message));check.on('request',r=>{if(r.url().includes('/forge/'))traffic.push(r.url());});
  await check.goto(base+'/app/recovery-check');
  const verify=async(b=backup,r=recovery,checksum)=>{const bytes=Buffer.from(JSON.stringify(b));await check.getByLabel('恢复验证加密备份').setInputFiles(file('backup.json',b));await check.getByLabel('恢复验证备份摘要').setInputFiles(file('backup.sha256',checksum??hash(bytes)));await check.getByLabel('恢复验证恢复文件').setInputFiles(file('recovery.json',r));await check.getByRole('checkbox').check();await check.getByRole('button',{name:'验证备份恢复',exact:true}).click();};
  await verify();await check.getByText('本次备份独立恢复验证通过',{exact:true}).waitFor();assert.equal(await check.getByLabel('恢复验证恢复文件').inputValue(),'');
  await verify(backup,{...recovery,recovery_key:Buffer.alloc(32,1).toString('base64')});await check.getByText(/恢复验证失败，请核对/).waitFor();assert.equal(await check.getByText('本次备份独立恢复验证通过',{exact:true}).count(),0);
  const tamper=structuredClone(backup);tamper.records[0].secret_envelope.ciphertext='A'+tamper.records[0].secret_envelope.ciphertext.slice(1);await verify(tamper);await check.getByText(/恢复验证失败，请核对/).waitFor();
  await verify(backup,recovery,'0'.repeat(64));await check.getByText(/恢复验证失败，请核对/).waitFor();
  const legacy=structuredClone(backup);legacy.legacy_pending_count=1;legacy.records[0].metadata.encryption_state='legacy_pending';legacy.records[0].secret_envelope=null;await verify(legacy);await check.getByText('备份不完整，不能确认全部恢复',{exact:true}).waitFor();
  await verify();await check.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await check.getByText('验证已暂停，请重新选择文件。').waitFor();await check.waitForTimeout(500);assert.equal(await check.getByText('本次备份独立恢复验证通过',{exact:true}).count(),0);
  assert.equal(traffic.length,0);assert.equal(await check.evaluate(()=>localStorage.length+sessionStorage.length),0);assert(!(await check.locator('body').innerText()).includes(vectors.inputs.plaintext));assert.deepEqual(errors,[]);await clean.close();
  console.log('PASS F3 UI: completion requires task+audit, list refresh, locked progress, failed recovery independent, export+checksum, clean browser actual Worker recovery, wrong material/tamper/legacy/hidden, no business HTTP/storage');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
