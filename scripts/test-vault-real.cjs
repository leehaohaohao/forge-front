const {chromium}=require('playwright');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const auth=JSON.parse(await fs.readFile(process.env.FORGE_TEST_AUTH_FILE||'/tmp/forge-browser-acceptance/auth.json','utf8'));
 const origin=process.env.FORGE_TEST_ORIGIN||'http://localhost:4185',password='Fictional real backend vault password!',value='fictional-real-service-secret-中文';let recovery;
 for(const channel of ['msedge','chromium']){
 const browser=await chromium.launch({headless:channel==='chromium',ignoreDefaultArgs:['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling'],...(channel==='msedge'?{channel}:{})});const context=await browser.newContext({acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 await context.addInitScript(token=>{localStorage.setItem('forge_token',token);localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:77,username:'browser-test'}));},auth.token);
 let page=await context.newPage();page.setDefaultTimeout(20000);const bodies=[];page.on('request',r=>{if(r.postData())bodies.push(r.postData());});
 const btn=name=>page.getByRole('button',{name:new RegExp('^'+[...name].join('\\s*')+'$')});
 try{
 const response=await page.goto(origin+'/app/token');assert.equal(response.headers()['x-frame-options'],'DENY');
 await page.getByLabel('独立解锁密码',{exact:true}).fill(password);
 if(await btn('创建本地保险库').count()){
 await btn('创建本地保险库').click();const download=page.waitForEvent('download');await btn('下载恢复材料').click();recovery=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
 await page.getByLabel('重新输入恢复密钥',{exact:true}).fill(recovery.recovery_key);await btn('验证恢复材料').click();await btn('保存加密保险库').click();
 }else await btn('解锁').click();
 await page.getByText('已解锁',{exact:true}).waitFor();
 if(await page.getByRole('cell',{name:'real-browser-check',exact:true}).count()===0){
 await btn('新增密钥').click();await page.getByLabel('供应商',{exact:true}).fill('test');await page.getByLabel('名称',{exact:true}).fill('real-browser-check');await page.getByLabel('业务密钥',{exact:true}).fill(value);await btn('OK').click();await page.getByRole('cell',{name:'real-browser-check',exact:true}).waitFor();
 }
 await btn('查看').click();await page.getByText(value,{exact:true}).waitFor();await btn('隐藏').click();await btn('复制').click();await page.getByText('已复制',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),value);

 await btn('编辑').click();await page.getByLabel('分类',{exact:true}).fill('verified');await btn('OK').click();await page.getByRole('cell',{name:'verified',exact:true}).waitFor();
 await btn('编辑').click();await page.getByLabel('替换密钥（留空保留）',{exact:true}).fill(value);await btn('OK').click();await page.getByLabel('替换密钥（留空保留）',{exact:true}).waitFor({state:'hidden'});
 await btn('查看').click();await page.getByText(value,{exact:true}).waitFor();await btn('隐藏').click();
 if(channel==='chromium'){await btn('删除').click();await btn('OK').click();await page.getByRole('cell',{name:'real-browser-check',exact:true}).waitFor({state:'hidden'});}
 // Native visibility is a separately documented outstanding host check.
 await btn('锁定并清理').click();
 await page.getByLabel('独立解锁密码',{exact:true}).fill(password);await btn('解锁').click();await page.getByText('已解锁',{exact:true}).waitFor();
 // Renderer crash must not survive a reload.
 const cdp=await context.newCDPSession(page);const crashed=page.waitForEvent('crash');cdp.send('Page.crash').catch(()=>{});await crashed;await page.close();page=await context.newPage();await page.goto(origin+'/app/token');await page.getByText('已锁定',{exact:true}).waitFor();
 for(const s of [password,value,recovery?.recovery_key??'not-present'])assert(!bodies.some(b=>b.includes(s)));
 console.log(channel+' '+browser.version()+': PASS real Go/MySQL, native clipboard, manual lock, crash/reload, independent profile decryption');
 }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
