const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage();const methods=[];let favored=false,fail=false;
 await page.addInitScript(()=>{localStorage.setItem('forge_token','fixture');localStorage.setItem('forge_token_time',String(Date.now()));localStorage.setItem('forge_user',JSON.stringify({id:7,username:'fixture'}));});
 await page.route('**/forge/**',async route=>{
  const path=new URL(route.request().url()).pathname,method=route.request().method();
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({code:status===200?0:500,message:'fixture',data})});
  if(path.endsWith('/favorite')){methods.push(method);if(fail){fail=false;return send(null,500);}favored=method==='POST';return send(null);}
  if(path==='/forge/knowledge/document/1')return send({document:{id:1,title:'Favorite regression',content:'fixture',tags:[],like_count:0,view_count:0,comment_count:0},is_liked:false,is_favorited:favored});
  if(path.endsWith('/comment'))return send([]);
  return send({list:[],total:0});
 });
 await page.goto((process.env.VAULT_PAGE_URL||'http://localhost:4180')+'/app/knowledge/document/1');
 const favorite=()=>page.getByRole('button',{name:/(?:^| )收\s*藏$/});const unfavorite=()=>page.getByRole('button',{name:/已收藏$/});
 await favorite().click();await unfavorite().waitFor();assert.equal(favored,true);
 await unfavorite().click();await favorite().waitFor();assert.equal(favored,false);
 fail=true;await favorite().click();await page.getByText('操作失败',{exact:true}).waitFor();assert.equal(favored,false);await favorite().waitFor();
 await favorite().click();await unfavorite().waitFor();await page.reload();await unfavorite().waitFor();
 await unfavorite().click();await favorite().waitFor();
 assert.deepEqual(methods,['POST','DELETE','POST','POST','DELETE']);
 console.log('PASS document favorite/unfavorite, failed request retains state, retry and reload');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


