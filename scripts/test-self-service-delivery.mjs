import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile('../forge/modules/vault/testdata/self-service-jwe-v1.json','utf8'));
const source=`import {DeliveryReceiver,recipient} from './src/lib/vault/delivery';
self.onmessage=async({data:f})=>{try{
 const raw=Uint8Array.from(atob(f.private_pkcs8),x=>x.charCodeAt(0));const key=await crypto.subtle.importKey('pkcs8',raw,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);raw.fill(0);
 let passed=0;const check=v=>{if(!v)throw Error();passed++;};
 const decode=async(j=f.go_jwe,c=f.context,now=f.now)=>new DeliveryReceiver(key,f.context.recipient).open(j,c,now);
 for(const j of [f.go_jwe,f.node_jwe]){const bytes=await decode(j);check(btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''))===f.plain_base64);bytes.fill(0);}
 async function reject(fn){let failed=false;try{await fn();}catch{failed=true;}check(failed);}
 const pair=await recipient();check(!pair.privateKey.extractable);await reject(()=>crypto.subtle.exportKey('pkcs8',pair.privateKey));
 await reject(()=>new DeliveryReceiver(pair.privateKey,pair.recipient).open(f.go_jwe,f.context,f.now));
 for(const field of ['user_id','task_id','snapshot_id','delivery_epoch','recipient'])await reject(()=>decode(f.go_jwe,{...f.context,[field]:'wrong'}));
 await reject(()=>decode(f.go_jwe,f.context,Number(f.context.expires_at)));
 const replay=new DeliveryReceiver(key,f.context.recipient);(await replay.open(f.go_jwe,f.context,f.now)).fill(0);await reject(()=>replay.open(f.go_jwe,f.context,f.now));
 for(const part of [1,2,3,4]){const parts=f.go_jwe.split('.');parts[part]=(parts[part][0]==='A'?'B':'A')+parts[part].slice(1);await reject(()=>decode(parts.join('.')));}
 const parts=f.go_jwe.split('.');parts[0]=btoa(JSON.stringify({alg:'RSA1_5'})).replace(/=+$/,'');await reject(()=>decode(parts.join('.')));
 self.postMessage({ok:true,passed});
}catch{self.postMessage({ok:false});}};`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife'});
await writeFile('/tmp/forge-self-delivery-worker.js',result.outputFiles[0].contents);
const b=await build({entryPoints:['src/lib/vault/self-service.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {StartPrototype}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].contents).toString('base64'));
let calls=0,release;const gate=new Promise(r=>release=r),p=new StartPrototype();const adapters={unlock:async()=>gate,recipient:async()=>({}),reauth:async()=>'proof',confirm:async()=>true,create:async()=>{calls++;return {};}};
const first=p.start(adapters);await p.start(adapters);p.cancel();release();await assert.rejects(first);assert.equal(calls,0);await p.start({...adapters,unlock:async()=>{}});assert.equal(calls,1);
console.log('PASS duplicate/cancel intent guards; browser Worker bundle generated from production JWE module');
