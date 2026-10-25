import {build} from 'esbuild';
import assert from 'node:assert/strict';
const built=await build({stdin:{contents:"export {default as api} from './src/lib/api'; export * from './src/lib/api-error'; export {useAuthStore} from './src/stores/auth'; export {useTokenStore} from './src/stores/tokens'; export {vaultSession} from './src/lib/vault/runtime';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',packages:'external',alias:{'@':process.cwd()+'/src'}});
// A temporary module keeps package resolution anchored in the repository.
const {writeFile,unlink}=await import('node:fs/promises');
const path=new URL('../.api-errors-test.mjs',import.meta.url);
await writeFile(path,built.outputFiles[0].contents);
try {
 const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 globalThis.document=new EventTarget();globalThis.window=new EventTarget();window.location={href:"http://localhost/app/token"};let invalid=0;window.addEventListener('forge-auth-invalid',()=>invalid++);
 const {api,ApiError,normalizeApiError,apiErrorMessage,useAuthStore,useTokenStore,vaultSession}=await import(path.href);
 const {AxiosError,CanceledError}=await import('axios');
 const seed=()=>{for(const k of ['forge_token','forge_token_time','forge_user'])values.set(k,'fixture');useAuthStore.setState({token:'fixture',user:{id:7,username:'fixture',status:'active'},isLoggedIn:true});useTokenStore.setState({tokens:[{id:'7'}]});};
 const run=async(status,code,message,url='/auth/login',rejected=false)=>{
  api.defaults.adapter=async config=>{const response={status,statusText:'fixture',data:{code,message,request_id:'body-id'},headers:{'x-request-id':'trace-123'},config};if(rejected)throw new AxiosError('RAW SQL password=secret','ERR_BAD_RESPONSE',config,{},response);return response;};
  try{await api.post(url,{password:'secret'});assert.fail('must reject');}catch(error){
   assert(error instanceof ApiError);assert.equal(error.httpStatus,status);assert.equal(error.businessCode,code);assert.equal(error.requestId,'trace-123');
   assert(!JSON.stringify(error).includes('secret'));assert(!apiErrorMessage(error).includes('RAW'));return error;
  }
 };
 assert.equal((await run(200,400,'手机号或密码错误')).kind,'account');
 assert.equal((await run(400,400,'手机号或密码错误','/auth/login',true)).kind,'account');
 assert.equal((await run(200,400,'无效请求参数')).kind,'parameters');
 assert.equal((await run(200,400,'RAW SQL password=secret')).kind,'parameters');
 assert.equal((await run(200,400,'该手机号已注册！','/auth/register')).kind,'registered');
 assert.equal((await run(200,500,'RAW SQL password=secret')).kind,'unavailable');
 assert.equal((await run(500,500,'手机号或密码错误','/auth/login',true)).kind,'unavailable');
 for(const [status,code] of [[200,401],[401,401],[401,undefined]]) {
  seed();const before=invalid,epoch=vaultSession.epoch;assert.equal((await run(status,code,'expired','/token',status!==200)).kind,'unauthorized');assert.equal(invalid,before+1);assert.equal(values.size,0);assert.equal(useAuthStore.getState().isLoggedIn,false);assert.equal(useAuthStore.getState().token,null);assert.equal(useTokenStore.getState().tokens.length,0);assert(vaultSession.epoch>epoch);assert.equal(vaultSession.state,'locked');
 }
 for(const status of [200,401]) {seed();const before=invalid,epoch=vaultSession.epoch;assert.equal((await run(status,40101,'reauth failed','/auth/reauth',status!==200)).kind,'reauth');assert.equal(invalid,before);assert.equal(values.size,3);assert.equal(useAuthStore.getState().isLoggedIn,true);assert.equal(vaultSession.epoch,epoch);}
 assert.equal(normalizeApiError(new AxiosError('RAW','ERR_NETWORK')).kind,'network');
 assert.equal(normalizeApiError(new CanceledError()).kind,'canceled');
 assert.equal((await run(200,400,'账号已被禁用')).kind,'disabled');
 assert.equal((await run(200,400,'手机号或密码错误','/token')).kind,'parameters');
 const fallback=normalizeApiError(undefined,{status:422,data:{code:400,request_id:'body-trace'},headers:{},config:{url:'/auth/register'}});
 assert.equal(fallback.requestId,'body-trace');assert.equal(fallback.httpStatus,422);assert.equal(fallback.businessCode,400);
 assert.equal(apiErrorMessage(new Error('RAW exception')),'请求未完成，请稍后重试');
 console.log('PASS normalized metadata, safe messages, HTTP/legacy expiry, 40101, network and cancellation');
} finally {await unlink(path);}
