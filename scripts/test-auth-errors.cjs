const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage();page.setDefaultTimeout(10000);
 let response={status:200,code:400,message:'手机号或密码错误'},calls=0;
 await page.route('**/forge/**',async route=>{
  if(!new URL(route.request().url()).pathname.startsWith('/forge/auth/'))return route.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data:{list:[],total:0}})});
  calls++;if(response.network)return route.abort('failed');
  return route.fulfill({status:response.status,headers:{'x-request-id':'fixture-trace'},contentType:'application/json',body:JSON.stringify({...response,data:null})});
 });
 await page.goto((process.env.VAULT_PAGE_URL||'http://localhost:4180')+'/app/login');
 const login=page.getByRole('tabpanel',{name:'登录'}),register=page.getByRole('tabpanel',{name:'注册'});
 await login.getByPlaceholder('手机号',{exact:true}).fill('13800138000');await login.getByPlaceholder('密码',{exact:true}).fill('fictional-password');
 const check=async(panel,button,fixture,text)=>{
  response=fixture;const before=calls;await panel.getByRole('button',{name:button}).click();
  await page.locator('.ant-message-notice').filter({hasText:text}).waitFor();
  assert.equal(await page.locator('.ant-message-notice').count(),1,'one failure, one notice');
  assert.equal(await page.locator('.ant-message').count(),1,'one App message container');assert.equal(calls,before+1);
  assert(!(await page.locator('body').innerText()).includes('RAW_SQL_SECRET'));
  await page.locator('.ant-message-notice').waitFor({state:'hidden'});
 };
 for(const fixture of [{status:200,code:400,message:'手机号或密码错误'},{status:400,code:400,message:'手机号或密码错误'}])await check(login,/登\s*录/,fixture,'手机号或密码错误');
 await check(login,/登\s*录/,{status:200,code:400,message:'无效请求参数'},'请求参数不正确');
 await check(login,/登\s*录/,{status:200,code:400,message:'RAW_SQL_SECRET'},'请求参数不正确');
 await check(login,/登\s*录/,{status:500,code:500,message:'RAW_SQL_SECRET'},'服务暂时不可用');
 await check(login,/登\s*录/,{status:200,code:500,message:'RAW_SQL_SECRET'},'服务暂时不可用');
 await check(login,/登\s*录/,{network:true},'网络连接失败');
 await page.getByRole('tab',{name:'注册',exact:true}).click();
 await register.getByPlaceholder('手机号',{exact:true}).fill('13800138000');await register.getByPlaceholder('用户名',{exact:true}).fill('fixture');await register.getByPlaceholder('密码',{exact:true}).fill('fictional-password');
 await check(register,/注\s*册/,{status:200,code:400,message:'该手机号已注册！'},'该手机号已注册');
 await check(register,/注\s*册/,{status:400,code:400,message:'RAW_SQL_SECRET'},'请求参数不正确');
 await check(register,/注\s*册/,{status:500,code:500,message:'RAW_SQL_SECRET'},'服务暂时不可用');
 console.log('PASS login/register: single notice/container, safe account/parameter/server/network messages');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
