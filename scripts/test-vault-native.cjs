const {chromium}=require('playwright');const assert=require('node:assert/strict');const crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.LOCALAPPDATA+'\\Google\\Chrome\\Application\\chrome.exe',headless:false,ignoreDefaultArgs:true,args:['--user-data-dir='+require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'forge-chrome-native-')),'--remote-debugging-pipe','--no-first-run','--no-default-browser-check']});
 const context=await browser.newContext();
 const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const head=enc({alg:'HS256',typ:'JWT'}),payload=enc({user_id:77,username:'browser-test',iss:'forge',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});const token=head+'.'+payload+'.'+crypto.createHmac('sha256','browser-acceptance-only-signing-key').update(head+'.'+payload).digest('base64url');
 await context.addInitScript(token=>{localStorage.setItem('forge_token',token);localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:77,username:'browser-test'}));},token);
 const page=await context.newPage();page.setDefaultTimeout(15000);const cdp=await context.newCDPSession(page);
 // Disable CDP focus emulation, which otherwise masks native visibility changes.
 await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 try{
 await page.goto('http://localhost:4185/app/token');await page.getByText('已锁定',{exact:true}).waitFor();
 const unlock=async()=>{await page.bringToFront();if(await page.getByText('已解锁',{exact:true}).count())return;await page.getByLabel('独立解锁密码',{exact:true}).fill('Fictional real backend vault password!');await page.getByRole('button',{name:/^解\s*锁$/}).click();await page.getByText('已解锁',{exact:true}).waitFor();};
 await unlock();const other=await context.newPage();const otherCDP=await context.newCDPSession(other);await otherCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.goto('about:blank');await other.bringToFront();await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 console.log('native windows',await cdp.send('Browser.getWindowForTarget'),await otherCDP.send('Browser.getWindowForTarget'));const hidden=await page.evaluate(()=>document.hidden);await page.getByText(hidden?'已锁定':'已解锁',{exact:true}).waitFor({state:'attached'});await page.bringToFront();console.log('PASS native Chrome tab switch respects document visibility; hidden='+hidden);await other.close();
 await unlock();const {windowId}=await cdp.send('Browser.getWindowForTarget');await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});const minimizedHidden=await page.evaluate(()=>document.hidden);await page.getByText(minimizedHidden?'已锁定':'已解锁',{exact:true}).waitFor({state:'attached'});await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await page.bringToFront();console.log('PASS native Chrome minimize respects visibility; hidden='+minimizedHidden+'; version '+browser.version());
 }catch(e){console.log('visibility diagnostic',await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState,focus:document.hasFocus()})));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
