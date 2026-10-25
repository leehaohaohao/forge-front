const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.VAULT_TEST_URL || 'http://localhost:3000';
const artifact=process.env.VAULT_TEST_ARTIFACTS;
(async()=>{
  const reports=[];
  for(const channel of (process.env.VAULT_BROWSERS || 'chromium,msedge').split(',')) {
    const browser=await chromium.launch({headless:true,...(channel==='chromium'?{}:{channel})});
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage();
    const errors=[],external=[],writes=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{
      const url=new URL(r.url());
      if(!['localhost','127.0.0.1'].includes(url.hostname) && !['data:','blob:'].includes(url.protocol)) external.push(url.origin);
      if(!['GET','HEAD'].includes(r.method())) writes.push(r.url());
    });
    try {
      await page.goto(base+'/vault-tests.html');
      await page.getByRole('button',{name:'Run fixed vectors and lifecycle tests'}).click();
      await page.locator('#result[data-status]').waitFor({timeout:90000});
      const result=await page.locator('#result').innerText();
      assert.equal(await page.locator('#result').getAttribute('data-status'),'passed',result);
      console.log(channel+' '+browser.version()+'\n'+result);
      await page.goto(process.env.VAULT_PROTOTYPE_URL || base+'/vault-prototype.html');
      await page.getByRole('heading',{name:'你的密钥，只在这里解锁。'}).waitFor();
      await page.getByLabel('独立解锁密码',{exact:true}).fill('Fictional local password 2026!');
      await page.getByRole('button',{name:'在本地初始化',exact:true}).click();
      await page.getByRole('heading',{name:'保存恢复材料'}).waitFor({timeout:30000});
      assert.equal(await page.getByRole('button',{name:'验证恢复材料',exact:true}).isEnabled(),false);
      assert.equal(await page.getByRole('button',{name:'保存加密包装到模拟服务器',exact:true}).isEnabled(),false);
      const downloadPromise=page.waitForEvent('download');
      await page.getByRole('button',{name:'下载独立恢复材料',exact:true}).click();
      const download=await downloadPromise;
      const material=JSON.parse(await fs.readFile(await download.path(),'utf8'));
      assert.equal(material.format_version,1);assert.equal(material.user_id,'7');
      assert.equal(material.recovery_key,await page.locator('.recovery code').innerText());
      await page.getByLabel('重新输入恢复密钥',{exact:true}).fill(material.recovery_key);
      await page.getByRole('button',{name:'验证恢复材料',exact:true}).click();
      await page.getByRole('status').filter({hasText:'恢复材料已通过本地解密验证'}).waitFor();
      await page.getByRole('checkbox',{name:'模拟服务器已写入但响应中断'}).check();
      await page.getByRole('button',{name:'保存加密包装到模拟服务器',exact:true}).click();
      await page.getByRole('heading',{name:'保险库 已解锁',exact:true}).waitFor();
      await page.getByLabel('虚构业务密钥',{exact:true}).fill('fictional-prototype-business-secret');
      await page.getByRole('button',{name:'本地加密',exact:true}).click();
      await page.getByRole('status').filter({hasText:'已生成密文包'}).waitFor();
      await page.getByRole('button',{name:'查看30秒',exact:true}).click();
      await page.locator('code').filter({hasText:'fictional-prototype-business-secret'}).waitFor();
      // Headless Chromium keeps every tab visible. Exercise the browser lifecycle handler
      // with a controlled visibility signal; native tab hiding is a later headed acceptance check.
      await page.evaluate(()=>{
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
      });
      await page.getByRole('heading',{name:'保险库 已锁定',exact:true}).waitFor({timeout:10000});
      assert.equal(await page.locator('code').count(),0,'visibility signal clears plaintext');
      await page.getByLabel('独立解锁密码',{exact:true}).fill('wrong password');
      await page.getByRole('button',{name:'解锁',exact:true}).click();
      await page.getByRole('status').filter({hasText:'无法解锁，请检查密码或使用恢复材料'}).waitFor();
      await page.getByRole('button',{name:'使用恢复材料',exact:true}).click();
      await page.getByLabel('恢复密钥',{exact:true}).fill(material.recovery_key);
      await page.getByLabel('新的独立解锁密码',{exact:true}).fill('New fictional password 2026!');
      await page.getByRole('button',{name:'本地恢复并生成新凭据',exact:true}).click();
      await page.getByRole('heading',{name:'保存恢复材料'}).waitFor({timeout:30000});
      const newRecovery=await page.locator('.recovery code').innerText();assert.notEqual(newRecovery,material.recovery_key);
      await page.getByRole('button',{name:'锁定并清理',exact:true}).click();
      await page.getByRole('heading',{name:'保险库 已锁定',exact:true}).waitFor();
      assert.equal(await page.locator('code').count(),0);
      assert.ok((await page.locator('input[type=password]').evaluateAll(inputs=>inputs.map(input=>input.value))).every(value=>value===''),'all secret inputs cleared');
      assert.deepEqual(errors,[],'browser errors');assert.deepEqual(external,[],'no runtime remote sources');assert.deepEqual(writes,[],'prototype sends no secret to a server');
      const storage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));
      assert.deepEqual(storage,{local:[],session:[]});
      if(artifact){await fs.mkdir(artifact,{recursive:true});await page.screenshot({path:path.join(artifact,channel+'-vault-prototype-locked.png'),fullPage:true});}
      reports.push({browser:channel,version:browser.version(),result,prototype:'PASS init/recovery download+reentry/uncertain response/local encryption/visibility signal lock/wrong password/recovery; no remote sources, no POST, empty storage',errors});
      console.log(channel+' prototype PASS');
    } finally {await context.close();await browser.close();}
  }
  if(artifact) await fs.writeFile(path.join(artifact,'vault-browser-report.json'),JSON.stringify(reports,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
