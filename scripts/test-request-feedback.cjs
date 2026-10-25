const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.VAULT_PAGE_URL||'http://localhost:4180';
  const defaults={quickLink:{panelDefaultOpen:false,openInNewTab:true},shortcuts:{togglePanel:'Ctrl+Shift+K',openSearch:'Ctrl+K'},theme:{sidebarCollapsed:false}};
  let settings=structuredClone(defaults),failure=null,failed=0,writes=0;
  await page.addInitScript(()=>{localStorage.setItem('forge_token','fixture');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'fixture'}));});
  await page.route('**/forge/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname.replace('/forge',''),method=req.method();
   if(method!=='GET')writes++;
   if(failure && path===failure.path && method===failure.method){failed++;if(failure.network)return route.abort('failed');return route.fulfill({status:failure.status||200,contentType:'application/json',body:JSON.stringify({code:500,message:'RAW_BACKEND_SECRET'})});}
   let data={list:[],total:0};
   if(path==='/user/settings'){if(method==='PUT')settings=req.postDataJSON();if(method==='DELETE')settings=structuredClone(defaults);data=settings;}
   if(path==='/workspace')data=[{id:1,name:'默认',is_default:true},{id:2,name:'第二工作区',is_default:false}];
   if(path==='/quick-link'||path==='/knowledge/space')data=[];
   if(path==='/dashboard/stats')data={token_count:0,workspace_count:0,link_count:0};
   return route.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data})});
  });
  const notice=async(text='服务暂时不可用')=>{
   await page.locator('.ant-message-notice').filter({hasText:text}).waitFor();
   assert.equal(await page.locator('.ant-message-notice').count(),1);assert.equal(await page.locator('.ant-message').count(),1);
   assert(!(await page.locator('body').innerText()).includes('RAW_BACKEND_SECRET'));
   await page.locator('.ant-message-notice').waitFor({state:'hidden'});
  };
  await page.goto(base+'/app/settings');
  const toggle=page.getByRole('switch',{name:'链接在新标签页打开',exact:true});
  for(const fault of [{status:200},{status:500},{network:true}]){
   failure={path:'/user/settings',method:'PUT',...fault};const before=failed;
   await toggle.click();await notice(fault.network?'网络连接失败':'服务暂时不可用');
   assert.equal(failed,before+1);assert.equal(await toggle.getAttribute('aria-checked'),'true');
  }
  failure=null;const saved=page.waitForResponse(r=>r.url().endsWith('/user/settings')&&r.request().method()==='PUT');await toggle.click();await saved;
  assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.equal(await page.locator('.ant-message-notice').count(),0);
  failure={path:'/user/settings',method:'DELETE'};await page.getByRole('button',{name:/恢复默认/}).click();await notice('重置失败');assert.equal(await toggle.getAttribute('aria-checked'),'false');
  failure=null;await page.getByRole('button',{name:/恢复默认/}).click();await notice('已恢复默认设置');assert.equal(await toggle.getAttribute('aria-checked'),'true');
  // Fields own validation; only submitted server failures toast.
  await page.goto(base+'/app/quick-link');await page.getByRole('button',{name:/添加链接/}).click();
  const modal=page.getByRole('dialog');const before=writes;await modal.getByRole('button',{name:/OK|确.*定/}).click();await page.getByText('请输入链接名称',{exact:true}).waitFor();assert.equal(writes,before);assert.equal(await page.locator('.ant-message-notice').count(),0);
  await modal.getByLabel('名称',{exact:true}).fill('fixture');await modal.getByLabel('URL',{exact:true}).fill('https://example.com');failure={path:'/quick-link',method:'POST'};
  await modal.getByRole('button',{name:/OK|确.*定/}).click();await notice();assert(await modal.isVisible());
  failure={path:'/knowledge/document',method:'GET'};await page.goto(base+'/app/settings');await page.getByPlaceholder('搜索...',{exact:true}).fill('fixture');await notice();
  failure={path:'/dashboard/stats',method:'GET'};await page.goto(base+'/app');await notice();
  failure={path:'/knowledge/space',method:'GET'};await page.goto(base+'/app/knowledge');await notice();
  failure={path:'/workspace',method:'GET'};await page.goto(base+'/app/quick-link');await notice();
  failure={path:'/user/settings',method:'GET'};const n=failed;await page.goto(base+'/app/settings');await notice();assert.equal(failed,n+1,'settings is loaded by layout only');
  assert.deepEqual(errors,[]);console.log('PASS settings rollback/retry/reset/load, form validation/server failure, search and page-load feedback: one App notice, no unhandled rejection');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
