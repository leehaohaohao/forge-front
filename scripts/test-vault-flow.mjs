import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const result=await build({entryPoints:['src/lib/vault/flow.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {parseFlowStatus,flowSteps,capabilityMessage}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const f=JSON.parse(await readFile('tests/vault/vault-migration-status-v1.json','utf8')).responses;
const copy=k=>structuredClone(f[k].data);
for(const [key,current] of [['uninitialized','create'],['mixed_unfrozen','migration'],['verified','migration'],['switched','use']])assert.equal(flowSteps(parseFlowStatus(copy(key)),false).current,current);
assert.equal(flowSteps(copy('uninitialized'),true).current,'recovery');
assert.equal(flowSteps(copy('uninitialized'),false).steps.length,3);
assert.equal(flowSteps(copy('switched'),false).steps.length,4);
assert.equal(flowSteps(copy('switched'),true).current,'use','credential changes do not reset setup');
let s=copy('mixed_unfrozen');s.counts.legacy_active=0;assert.equal(flowSteps(s,false).current,'migration','deleted rows count');assert(s.operations.create_token.allowed);
s=copy('switched');s.audit={state:'failed',complete:false,checked_at:null,switched_at:null};assert.equal(flowSteps(s,false).current,'migration','failed audit blocks completion');
s=copy('verified');s.active_batch.state='aborted';s.latest_batch.state='aborted';s.active_batch=null;s.frozen=false;assert.equal(flowSteps(s,false).current,'migration');
s=copy('mixed_unfrozen');s.user_id='9007199254740993';assert.equal(parseFlowStatus(s).user_id,s.user_id);
for(const mutate of [s=>s.user_id=9007199254740993,s=>s.counts.legacy_deleted=-1,s=>s.counts.legacy_active=NaN,s=>s.audit.complete=true,s=>s.initialized=false,s=>delete s.operations.create_token,s=>s.operations.create_token.allowed='yes',s=>s.extra='secret']){s=copy('mixed_unfrozen');mutate(s);assert.throws(()=>parseFlowStatus(s));}
assert(!capabilityMessage({allowed:false,reason:'RAW secret'}).includes('RAW'));
console.log('PASS F1 fixtures, exact IDs, deleted/mixed/frozen/verified/aborted/switched/audit states, credential drafts, malformed responses');
