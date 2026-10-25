const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base=process.env.VAULT_PAGE_URL||'http://localhost:4180';
(async()=>{
for(const channel of (process.env.VAULT_BROWSERS||'chromium,msedge').split(',')) {
 const browser=await chromium.launch({headless:!process.env.VAULT_NATIVE,...(channel==='chromium'?{}:{channel}),...(process.env.VAULT_NATIVE?{ignoreDefaultArgs:true,args:['--remote-debugging-pipe','--no-first-run','--no-default-browser-check','--user-data-dir='+require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'forge-review-'))]}:{})});
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const password='Fictional vault phrase 2026!', secret='  fictional-secret-中文-前2  ', replacement='fictional-replacement-2026';
 const user='9007199254740993';
 const secrets=[password,secret,replacement];const requests=[],errors=[];let vault=null,records=[],envelopes={},access=0,conflict=false,delay=0,tamper=false,unauthorized=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   localStorage.setItem('forge_token','fixture-auth');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'测试用户',status:'active'}));
   window.__copies=[];window.__denyCopy=false;
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(window.__denyCopy)throw new Error('denied');window.__copies.push(value);}}});
 });
 await page.route('**/forge/**',async route=>{
   const r=route.request(),url=new URL(r.url()),path=url.pathname,method=r.method(),body=r.postDataJSON();
   requests.push({path,method,body});
   const respond=(data,status=200,code=0)=>route.fulfill({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify({code,message:code?'request failed':'success',data})});
   if(unauthorized&&path==='/forge/token'){unauthorized=false;return respond(null,401,401);}
   if(path==='/forge/vault'&&method==='GET')return respond({initialized:!!vault,user_id:user,vault});
   if(path==='/forge/vault'&&method==='POST'){
     assert.equal(vault,null);assert(!('user_id' in body));vault={...body,user_id:user,revision:'1',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),dek_wrap_count:0,dek_wrap_warn_at:900000,dek_wrap_limit:1000000};return respond(vault);
   }
   if(path==='/forge/auth/reauth') { assert.equal(body.purpose,'vault_credentials');assert.equal(body.account_password,'fixture-account-password');return respond({reauth_token:'fixture-reauth'}); }
   if(path==='/forge/vault/credentials') { assert.equal(r.headers()['x-forge-reauth'],'fixture-reauth');assert.equal(body.expected_revision,vault.revision);const {expected_revision,...wraps}=body;vault={...vault,...wraps,revision:String(BigInt(vault.revision)+1n)};return respond(vault); }
   if(path==='/forge/token'&&method==='GET')return respond({list:records,total:records.length,page:1,page_size:10});
   if(path==='/forge/token'&&method==='POST'){
     assert(body.secret_envelope&&!('secret' in body)&&!('token_value' in body));assert.equal(body.expected_vault_revision,vault.revision);
     const {secret_envelope,expected_vault_revision,...meta}=body;
     const t={...meta,id:'9007199254740995',user_id:user,revision:'1',has_secret:true,encryption_state:'client_encrypted',expires_at:meta.expires_at??null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
     records.push(t);envelopes[t.id]=secret_envelope;vault.revision=String(BigInt(vault.revision)+1n);vault.dek_wrap_count++;return respond(t);
   }
   const match=path.match(/^\/forge\/token\/(\d+)(\/access)?$/);
   if(match){
     const t=records.find(t=>t.id===match[1]);if(!t)return respond(null,404,404);
     if(match[2]){access++;const data={id:t.id,user_id:user,revision:t.revision,secret_envelope:envelopes[t.id]};if(tamper){tamper=false;data.id='123';}if(delay)await new Promise(r=>setTimeout(r,delay));return respond(data);}
     if(method==='PUT'){
       if(conflict){conflict=false;t.revision=String(BigInt(t.revision)+1n);return respond(null,409,40902);}
       assert.equal(body.expected_revision,t.revision);
       if(body.secret_envelope){assert.equal(body.expected_vault_revision,vault.revision);assert.equal(body.secret_envelope.secret_version,envelopes[t.id].secret_version+1);envelopes[t.id]=body.secret_envelope;vault.revision=String(BigInt(vault.revision)+1n);vault.dek_wrap_count++;}
       else assert(!('expected_vault_revision' in body));
       const {expected_revision,expected_vault_revision,secret_envelope,...meta}=body;Object.assign(t,meta,{revision:String(BigInt(t.revision)+1n)});return respond(t);
     }
     if(method==='DELETE'){assert.equal(body.expected_revision,t.revision);records=records.filter(r=>r!==t);return respond(null);}
   }
   return respond({list:[],total:0});
 });
 try {
  await page.clock.install(); await page.goto(base+'/app/token');
  const discardLockedDraft=async(action)=>{
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    const field=page.getByLabel('草稿解锁密码',{exact:true});await field.waitFor();
    assert.equal(await field.inputValue(),'');
    // Do not type or otherwise change local component state before discarding.
    await page.getByRole('button',{name:action,exact:true}).click();
    await field.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'继续确认恢复材料',exact:true}).waitFor({state:'hidden'});
    await page.getByLabel('独立解锁密码',{exact:true}).waitFor();
  };
  for(const savedFile of [false,true]) for(const action of ['放弃草稿','锁定并清理']) {
    await page.getByLabel('独立解锁密码',{exact:true}).fill(password);
    await page.getByRole('button',{name:'创建本地保险库',exact:true}).click();
    await page.getByRole('button',{name:'下载恢复材料',exact:true}).waitFor();
    if(savedFile){const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载恢复材料',exact:true}).click();await download;}
    await discardLockedDraft(action);
    await page.getByRole('button',{name:'创建本地保险库',exact:true}).waitFor();
    assert.equal(vault,null,'discard never publishes draft');
  }
  await page.getByLabel('独立解锁密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'创建本地保险库',exact:true}).click();
  await page.getByRole('button',{name:'下载恢复材料',exact:true}).waitFor();
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'下载恢复材料',exact:true}).click();
  const material=JSON.parse(await fs.readFile(await (await downloaded).path(),'utf8'));secrets.push(material.recovery_key);
  const pauseAndResume=async(pass)=>{
    if(process.env.VAULT_NATIVE) {
      const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
      const other=await context.newPage();await (await context.newCDPSession(other)).send('Emulation.setFocusEmulationEnabled',{enabled:false});
      await other.goto('about:blank');await other.bringToFront();
      await page.getByLabel('草稿解锁密码',{exact:true}).waitFor({state:'attached'});
      await other.close();await page.bringToFront();await cdp.detach();
    } else await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.getByLabel('草稿解锁密码',{exact:true}).waitFor();
    assert((await page.locator('input[type=password]').evaluateAll(xs=>xs.map(x=>x.value))).every(x=>x===''));
    await page.getByLabel('草稿解锁密码',{exact:true}).fill(pass);
    await page.getByRole('button',{name:'继续确认恢复材料',exact:true}).click();
    await page.getByLabel('重新输入恢复密钥',{exact:true}).waitFor();
    assert(await page.getByRole('button',{name:'保存加密保险库',exact:true}).isDisabled());
  };
  await pauseAndResume(password);
  await page.getByLabel('重新输入恢复密钥',{exact:true}).fill(material.recovery_key);
  await page.getByRole('button',{name:'验证恢复材料',exact:true}).click();
  await page.getByRole('button',{name:'保存加密保险库',exact:true}).click();
  await page.getByText('已解锁',{exact:true}).waitFor();assert.equal(vault.vault_id,material.vault_id);
  const btn=(name)=>page.getByRole('button',{name:new RegExp('^'+[...name].join('\\s*')+'$')});
  await btn('新增密钥').click();await page.getByLabel('供应商',{exact:true}).fill('openai');await page.getByLabel('名称',{exact:true}).fill('fixture');await page.getByLabel('业务密钥',{exact:true}).fill(secret);
  await btn('OK').click();await page.getByRole('cell',{name:'fixture',exact:true}).waitFor();
  assert.equal(access,0);assert.equal(records[0].id,'9007199254740995');
  await btn('查看').click();await page.getByText(secret,{exact:true}).waitFor();await btn('隐藏').click();
  await btn('复制').click();await page.waitForFunction(()=>window.__copies.length===1);assert.equal(await page.evaluate(()=>window.__copies[0]),secret);
  const before=access;await btn('编辑').click();await page.getByLabel('名称',{exact:true}).fill('metadata-edit');await btn('OK').click();await page.getByRole('cell',{name:'metadata-edit',exact:true}).waitFor();assert.equal(access,before);
  await btn('编辑').click();await page.getByLabel('替换密钥（留空保留）',{exact:true}).fill(replacement);await btn('OK').click();await page.getByText('保存成功',{exact:true}).last().waitFor();
  await page.waitForFunction(()=>!document.querySelector('.ant-modal-wrap:not([style*="display: none"])'));
  await page.evaluate(()=>window.__denyCopy=true);await btn('复制').click();await btn('确认复制').waitFor();assert.equal(await page.evaluate(()=>window.__copies.length),1);
  await page.evaluate(()=>window.__denyCopy=false);await btn('确认复制').click();await page.waitForFunction(()=>window.__copies.length===2);assert.equal(await page.evaluate(()=>window.__copies[1]),replacement);
  tamper=true;await btn('查看').click();await page.getByText(/输入或密文校验失败/).waitFor();assert.equal(await page.getByText(replacement,{exact:true}).count(),0);
  conflict=true;await btn('编辑').click();await page.getByLabel('名称',{exact:true}).fill('conflict-change');await btn('OK').click();await page.getByText(/数据已变更或提交结果不确定/).waitFor();assert.equal(records[0].name,'metadata-edit');await btn('Cancel').click();
  delay=1200;const oldAccess=access;await btn('复制').click();await page.waitForTimeout(200);await btn('锁定并清理').click();await page.waitForTimeout(1400);assert.equal(await page.evaluate(()=>window.__copies.length),2);assert.equal(access,oldAccess+1);delay=0;
  await page.getByLabel('独立解锁密码',{exact:true}).fill(password);await btn('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();
  await btn('新增密钥').click();await page.getByLabel('业务密钥',{exact:true}).fill('discard-on-hide');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByText('已锁定',{exact:true}).waitFor();await page.getByLabel('业务密钥',{exact:true}).waitFor({state:'hidden'});
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
  await page.getByLabel('独立解锁密码',{exact:true}).fill('wrong-password');await btn('解锁').click();await page.getByText('无法解锁，请检查密码或使用恢复材料',{exact:true}).waitFor();
  await page.getByLabel('独立解锁密码',{exact:true}).fill(password);await btn('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();
  await btn('查看').click();await page.getByText(replacement,{exact:true}).waitFor();
  await page.clock.fastForward(30001);await page.getByText(replacement,{exact:true}).waitFor({state:'hidden'});
  await page.clock.fastForward(300001);await page.getByText('已锁定',{exact:true}).waitFor();
  // Recover the same VK, persist new wrappers only after reentry and account reauthentication.
  const nextPassword='New fictional vault phrase 2026!';secrets.push(nextPassword);
  for(const action of ['放弃草稿','锁定并清理']) {
    const previous=JSON.stringify(vault);
    await btn('修改解锁密码').click();await page.getByLabel('独立解锁密码',{exact:true}).fill(password);
    await page.getByLabel('新的解锁密码',{exact:true}).fill(nextPassword);await btn('生成新恢复材料').click();
    await btn('下载恢复材料').waitFor();await discardLockedDraft(action);
    await btn('解锁').waitFor();assert.equal(JSON.stringify(vault),previous,'discard preserves server credentials');
  }
  await btn('使用恢复材料').click();await page.getByLabel('原恢复密钥',{exact:true}).fill(material.recovery_key);
  await page.getByLabel('新的解锁密码',{exact:true}).fill(nextPassword);await btn('生成新恢复材料').click();
  const nextDownload=page.waitForEvent('download');await btn('下载恢复材料').click();
  const nextMaterial=JSON.parse(await fs.readFile(await (await nextDownload).path(),'utf8'));secrets.push(nextMaterial.recovery_key);
  await pauseAndResume(nextPassword);
  await page.getByLabel('重新输入恢复密钥',{exact:true}).fill(nextMaterial.recovery_key);await btn('验证恢复材料').click();
  await page.getByLabel('账号登录密码',{exact:true}).fill('fixture-account-password');await btn('保存加密保险库').click();await page.getByText('已解锁',{exact:true}).waitFor();
  await btn('查看').click();await page.getByText(replacement,{exact:true}).waitFor();await btn('隐藏').click();
  // Legacy rows allow metadata only, and deletion carries a revision in the JSON body.
  records.push({...records[0],id:'100',name:'legacy',encryption_state:'legacy_pending'});await btn('搜索').click();
  const legacy=page.getByRole('row').filter({has:page.getByRole('cell',{name:'legacy',exact:true})});
  assert(await legacy.getByRole('button',{name:/查\s*看/}).isDisabled());assert(await legacy.getByRole('button',{name:/复\s*制/}).isDisabled());
  await legacy.getByRole('button',{name:/编\s*辑/}).click();assert(await page.getByLabel('替换密钥（留空保留）',{exact:true}).isDisabled());await btn('Cancel').click();
  await legacy.getByRole('button',{name:/删\s*除/}).click();await btn('OK').click();await legacy.waitFor({state:'hidden'});
  // Route departure and reload both lose unlocked keys.
  await page.getByRole('link',{name:'首页',exact:true}).click();await page.getByRole('link',{name:'密钥管理',exact:true}).click();await page.getByText('已锁定',{exact:true}).waitFor();
  await page.getByLabel('独立解锁密码',{exact:true}).fill(nextPassword);await btn('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();
  await page.reload();await page.getByText('已锁定',{exact:true}).waitFor();
  const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
  for(const value of secrets){assert(!JSON.stringify(requests).includes(value),'plaintext in request');assert(!stored.includes(value),'plaintext in storage');}
  unauthorized=true;await btn('搜索').click();await page.waitForURL('**/app/login');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(channel+' '+browser.version()+': PASS production page: initialize, precise IDs, encrypted CRUD, metadata-only, copy retry, tamper, conflict, late response, hide, wrong password, timers, storage/network');
 } catch(e) { console.log('page test failed at '+page.url()); console.log(errors); throw e; } finally {await browser.close();}
}
})().catch(e=>{console.error(e);process.exitCode=1;});
