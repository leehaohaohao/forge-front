import {build} from 'esbuild';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const built=await build({stdin:{contents:"export * from './src/services/vault-migration';export * from './src/lib/vault/flow';export * from './src/lib/vault/backup-file';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',packages:'external',alias:{'@':process.cwd()+'/src'}});
const temp=new URL('../.completion-test.mjs',import.meta.url);await writeFile(temp,built.outputFiles[0].contents);
try{
 globalThis.localStorage={getItem:()=>null,removeItem:()=>{}};globalThis.window=new EventTarget();
 const {parseTask,flowSteps,parseBackup}=await import(temp.href);
 const flow=JSON.parse(await readFile('tests/vault/vault-migration-status-v1.json','utf8')).responses.switched.data;
 const task=require('./vault-completion-fixture.cjs').completedTask(flow);
 assert.equal(parseTask(task,flow).state,'completed');
 for(const mutate of [t=>t.failure_code='audit_failed',t=>t.audit_complete=false,t=>t.frozen=true,t=>t.batch.state='verified',t=>t.switched_at=null,t=>t.completed_at=null,t=>t.backup_state='exported',t=>t.recovery_state='verified',t=>t.failure_code='raw secret',t=>delete t.audited_at]){const t=structuredClone(task);mutate(t);assert.throws(()=>parseTask(t,flow));}
 const failed={...task,state:'failed',audit_complete:false,failure_code:'audit_failed',next_action:'operator_retry'};assert.equal(parseTask(failed,flow).state,'failed');
 assert.equal(flowSteps({...flow,completionConfirmed:false},false).current,'migration');assert.equal(flowSteps({...flow,completionConfirmed:true},false).current,'use');
 console.log('PASS F3 task contract, historical timestamps never override audit/freeze, failed recovery independent, completion gating');
}finally{await unlink(temp);}
