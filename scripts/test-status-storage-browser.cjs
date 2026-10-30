const {chromium}=require('playwright');const assert=require('assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 for(const action of ['workspace','token','remove','clear','session','late-token']){
  const context=await b.newContext();const p=await context.newPage();await p.clock.install();await p.goto('http://localhost:3013/tests/vault/status-retry.html'+(action==='late-token'?'?hold':''));await p.waitForFunction(()=>window.tasks===1);await p.getByText('请求较多，正在等待限流结束后自动继续。').waitFor();
  if(action==='late-token'){await p.clock.runFor(31000);await p.waitForFunction(()=>typeof window.release==='function');}
  const peer=await context.newPage();await peer.route('**/storage-peer',r=>r.fulfill({contentType:'text/html',body:'<html>storage peer</html>'}));await peer.goto('http://localhost:3013/storage-peer');await p.bringToFront();
  await p.evaluate(()=>{window.storageEvents=0;window.addEventListener('storage',()=>window.storageEvents++);});
  if(action==='session')await p.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'forge_token',storageArea:sessionStorage,newValue:'different'})));
  else await peer.evaluate(a=>{if(a==='workspace')localStorage.setItem('forge_current_workspace','2');if(a==='token'||a==='late-token')localStorage.setItem('forge_token','new-account');if(a==='remove')localStorage.removeItem('forge_token');if(a==='clear')localStorage.clear();},action);
  await p.waitForFunction(()=>window.storageEvents===1);if(action==='late-token')await p.evaluate(()=>window.release());await p.clock.runFor(120000);
  if(action==='workspace'||action==='session'){await p.getByText('自动完成',{exact:true}).waitFor();assert.deepEqual(await p.evaluate(()=>[window.f1,window.tasks,window.ready]),[1,2,true]);}
  else{await p.getByText('登录状态已变化，请重新登录或刷新页面。',{exact:true}).waitFor();assert.deepEqual(await p.evaluate(()=>[window.f1,window.tasks,window.ready]),[1,action==='late-token'?2:1,false]);}
  await context.close();
 }
 console.log('PASS real cross-page storage: workspace preserves retry; token replacement/removal/clear cancel old requests; sessionStorage event ignored');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
