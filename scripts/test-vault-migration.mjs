import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const b=await build({entryPoints:['tools/vault-migrate.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const m=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].contents).toString('base64'));
const f=JSON.parse(await readFile('../forge/docs/testdata/token-vault-migration-v1-api-fixtures.json','utf8'));
console.log('M1 fixture sections:',Object.keys(f).join(','));
assert.equal(await m.digest(new TextEncoder().encode('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.throws(()=>m.source(new TextEncoder().encode('{}')));
assert.throws(()=>m.lines(new Uint8Array([255])));
console.log('PASS digest and malformed source/encoding rejection');

assert.equal(await m.envelopeDigest(f.stage_request.records[0].secret_envelope),f.envelope_sha256);
const sr=f.source_record;
const vault={user_id:sr.metadata.user_id,vault_id:f.stage_request.records[0].secret_envelope.vault_id,vault_key_version:1,dek_wrap_count:0};
let batch={batch_id:f.batch_id,user_id:vault.user_id,vault_id:vault.vault_id,revision:'2',state:'exported',record_count:1,staged_count:0,verified_count:0};
const src=m.source(new TextEncoder().encode(JSON.stringify({format:'forge-migration-source-v1',batch})+'\n'+JSON.stringify(sr)+'\n'));
let record={...sr,secret_envelope:null,envelope_sha256:null,verified:false};delete record.legacy_value;
const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
let staged=0,receipts=0,lost=true;const seen=new Set();
const api=async(path,body)=>{
 if(path==='/vault')return {vault};
 if(!body)return {batch:{...batch},records:[{...record}],next_after:null};
 if(seen.has(body.request_id))return batch;
 assert(!JSON.stringify(body).includes(sr.legacy_value));assert.equal(body.expected_revision,batch.revision);
 seen.add(body.request_id);batch.revision=String(BigInt(batch.revision)+1n);
 if(path.endsWith('/stage')){staged++;record.secret_envelope=body.records[0].secret_envelope;record.envelope_sha256=await m.envelopeDigest(record.secret_envelope);batch.staged_count=1;batch.state='staged';if(lost){lost=false;throw new Error('lost response');}}
 else{receipts++;assert.equal(body.records[0].envelope_sha256,record.envelope_sha256);record.verified=true;batch.verified_count=1;batch.state='verified';}return batch;
};
await m.migrate(src,vault,key,api,async()=>'fixture');
await m.migrate(src,vault,key,api,async()=>'fixture');
assert.equal(staged,1);assert.equal(receipts,1);
assert.equal((await m.verifyBackup(vault,[{metadata:sr.metadata,deleted_at:null,secret_envelope:null}],key,vault.user_id,1,1)).complete,false);
record.envelope_sha256='0'.repeat(64);await assert.rejects(()=>m.migrate(src,vault,key,api,async()=>'fixture'));
console.log('PASS M1 canonical hash, encrypted staging, lost-response idempotency, resume, local receipt verification, tamper rejection and incomplete backup');

const good={metadata:{...sr.metadata,encryption_state:'client_encrypted',has_secret:true},deleted_at:null,secret_envelope:record.secret_envelope};
assert.equal((await m.verifyBackup(vault,[good],key,vault.user_id,1,0)).complete,true);
await assert.rejects(()=>m.verifyBackup(vault,[good,{...good,metadata:{...good.metadata,id:String(BigInt(good.metadata.id)+1n)}}],key,vault.user_id,2,0));
await assert.rejects(()=>m.verifyBackup(vault,[{...good,deleted_at:'invalid'}],key,vault.user_id,1,0));
await assert.rejects(()=>m.snapshot(async()=>({batch:{...batch,batch_id:'wrong'},records:[],next_after:null}),batch.batch_id));
console.log('PASS duplicate secret, invalid deletion state, wrong batch rejected');

// Six writes across three chunks exceed the real five-reauth/minute policy.
for(const count of [3,201]) {
 let now=0,authWindow=0,authCount=0,authSerial=0,write429=true,read429=true;
 const waits=[],tokens=new Set(),requests=new Map(),sizes=[];
 const many=Array.from({length:count},(_,i)=>({...sr,id:String(i+1),metadata:{...sr.metadata,id:String(i+1)}}));
 const rows=many.map(({legacy_value,...row})=>({...row,secret_envelope:null,envelope_sha256:null,verified:false}));
 const batch2={...batch,revision:'1',state:'exported',record_count:count,staged_count:0,verified_count:0};
 const sleep=async ms=>{waits.push(ms);now+=ms;};
 const reauth=async()=>{
  const window=Math.floor(now/60000);if(window!==authWindow){authWindow=window;authCount=0;}
  if(authCount===5)throw new m.RateLimitError(60000-now%60000);
  authCount++;const token='one-time-'+(++authSerial);tokens.add(token);return token;
 };
 const multiApi=async(path,body,token)=>{
  if(!body){
   if(read429){read429=false;throw new m.RateLimitError(2000);}
   if(path==='/vault')return {vault};
   const after=Number(new URL('http://fixture'+path).searchParams.get('after')||0);
   const page=rows.filter(r=>Number(r.id)>after).slice(0,100);
   return {batch:{...batch2},records:structuredClone(page),next_after:page.length===100?page.at(-1).id:null};
  }
  assert(tokens.has(token),'fresh authorization');tokens.delete(token);
  if(write429){write429=false;throw new m.RateLimitError(3000);}
  assert(!requests.has(body.request_id));requests.set(body.request_id,structuredClone(body));
  assert.equal(body.expected_revision,batch2.revision);assert(body.records.length<=100);sizes.push(body.records.length);
  for(const item of body.records){const row=rows.find(r=>r.id===item.id);
   if(path.endsWith('/stage')){row.secret_envelope=item.secret_envelope;row.envelope_sha256=await m.envelopeDigest(item.secret_envelope);batch2.staged_count++;}
   else{assert.equal(item.envelope_sha256,row.envelope_sha256);row.verified=true;batch2.verified_count++;}
  }
  batch2.revision=String(BigInt(batch2.revision)+1n);batch2.state=batch2.verified_count===count?'verified':'staged';
  return batch2;
 };
 await m.migrate({batch:batch2,records:many},vault,key,multiApi,reauth,sleep);
 assert.equal(batch2.verified_count,count);assert.equal(requests.size,Math.ceil(count/100)*2);
 assert(waits.includes(2000)&&waits.includes(3000));if(count>100)assert(now>=60000,'reauth limit waited');
 const writes=requests.size;await m.migrate({batch:batch2,records:many},vault,key,multiApi,reauth,sleep);assert.equal(requests.size,writes);
 console.log('PASS '+count+' records: batching, pagination, read/write 429, fresh authorization, reauth limit and resume');
}
assert.equal(m.retryAfterMs('7'),7000);
assert.equal(m.retryAfterMs('Thu, 01 Jan 1970 00:00:10 GMT',0),10000);
assert.equal(m.retryAfterMs(null),60000);
let attempts=0;await assert.rejects(()=>m.retryRateLimit(async()=>{attempts++;throw new m.RateLimitError(1);},async()=>{}));assert.equal(attempts,9);
console.log('PASS Retry-After seconds/date/fallback and bounded retries');
