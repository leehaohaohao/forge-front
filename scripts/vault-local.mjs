import {build} from 'esbuild';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import readline from 'node:readline';
const built=await build({entryPoints:['tools/vault-migrate.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'node20'});
const lib=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
function check(ok){if(!ok)throw new Error('INVALID');}
async function secret(label){
 check(process.stdin.isTTY);process.stdout.write(label+': ');readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const handler=(s,k)=>{if(k?.name==='return'){done();resolve(value);}else if(k?.ctrl&&k.name==='c'){done();reject(new Error('CANCELLED'));}else if(k?.name==='backspace')value=value.slice(0,-1);else if(s&&!k?.ctrl)value+=s;};function done(){process.stdin.off('keypress',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('keypress',handler);});
}
async function file(name,max=134217728){const st=await lstat(name);check(st.isFile()&&!st.isSymbolicLink()&&st.size<=max);return readFile(name);}
async function main(){
 const [mode,path,origin,authMode]=process.argv.slice(2);
 if(mode==='migrate'||mode==='export'){
  const url=new URL(origin);check(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)));check(url.username===''&&url.password===''&&url.search===''&&url.hash==='');
  const src=mode==='migrate'?lib.source(await file(path)):null;const bearer=await secret('账号登录令牌（隐藏输入）');
  const api=async(route,body,token)=>{const response=await fetch(url.origin+'/forge'+route,{method:body?'POST':'GET',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json',...(token?{'X-Forge-Reauth':token}:{})},...(body?{body:JSON.stringify(body)}:{})});check(response.ok);const data=await response.json();check(data.code===0);return data.data;};
  const {vault}=await api('/vault');check(vault);
  if(mode==='export'){const auth=await api('/auth/reauth',{account_password:await secret('账号密码（导出身份验证）'),purpose:'vault_export'});const backup=await api('/vault/export',{expected_revision:vault.revision},auth.reauth_token);const bytes=Buffer.from(JSON.stringify(backup));await writeFile(path,bytes,{flag:'wx',mode:0o600});await writeFile(path+'.sha256',await lib.digest(bytes)+'\n',{flag:'wx',mode:0o600});console.log('加密备份与摘要已保存；请运行 verify-backup 独立验证。');return;}
  const key=await lib.unlock(vault,await secret(authMode==='recovery'?'恢复密钥':'保险库独立密码'),authMode==='recovery');
  const reauth=async()=>{const d=await api('/auth/reauth',{account_password:await secret('账号密码（仅用于本次迁移身份验证）'),purpose:'vault_migration'});return d.reauth_token;};
  const result=await lib.migrate(src,vault,key,api,reauth);console.log(JSON.stringify({state:result.state,verified_count:result.verified_count,source_cleared:false}));
 }else if(mode==='verify-shards'){
  const dir=resolve(path),manifest=JSON.parse(await file(resolve(dir,'manifest.json'),1048576));check(manifest.format==='forge-encrypted-backup-shards-v1');check(Array.isArray(manifest.parts)&&manifest.parts.length>0&&manifest.parts.length<=10000);check(Number.isSafeInteger(manifest.record_count)&&manifest.record_count>=0&&manifest.record_count<=1000000);let vault,records=[];let totalBytes=0;
  for(let i=0;i<manifest.parts.length;i++){const part=manifest.parts[i];check(part.name==='part-'+String(i+1).padStart(6,'0')+'.jsonl'&&basename(part.name)===part.name);const bytes=await file(resolve(dir,part.name),1048576);check(bytes.length===part.bytes&&await lib.digest(bytes)===part.sha256);totalBytes+=bytes.length;check(totalBytes<=536870912);const rows=lib.lines(bytes);check(rows.length===part.lines);if(i===0){const h=rows.shift();check(h.format===manifest.format);vault=h.vault;}check(records.length+rows.length<=manifest.record_count);records.push(...rows);}
  check(vault);const key=await lib.unlock(vault,await secret(origin==='recovery'?'恢复密钥':'保险库独立密码'),origin==='recovery');console.log(JSON.stringify(await lib.verifyBackup(vault,records,key,manifest.user_id,manifest.record_count,manifest.legacy_pending_count)));
 }else if(mode==='verify-backup'){
  const bytes=await file(path);check(await lib.digest(bytes)===(await file(origin,1024)).toString().trim());const d=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));check(d.format_version===1);const key=await lib.unlock(d.vault,await secret(authMode==='recovery'?'恢复密钥':'保险库独立密码'),authMode==='recovery');console.log(JSON.stringify(await lib.verifyBackup(d.vault,d.records,key,d.user_id,d.record_count,d.legacy_pending_count)));
 }else throw new Error('USAGE');
}
try{await main();}catch{console.error('未完成：请核对文件、凭据、批次状态或网络。未输出秘密；重新运行将读回已暂存项继续核验。');process.exitCode=1;}
