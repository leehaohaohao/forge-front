import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const b=await build({entryPoints:['src/lib/vault/migration-source.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {readSourceFile,strictJson,SOURCE_LIMIT}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].contents).toString('base64'));
const f=JSON.parse(await readFile('../forge/docs/testdata/token-vault-migration-v1-api-fixtures.json','utf8'));
const row=structuredClone(f.source_record),batch={batch_id:f.batch_id,user_id:'7',vault_id:f.stage_request.records[0].secret_envelope.vault_id,revision:'1',state:'frozen',record_count:1,staged_count:0,verified_count:0};
const blob=(records=[row],header={format:'forge-migration-source-v1',batch})=>new Blob([JSON.stringify(header)+'\n'+records.map(r=>JSON.stringify(r)).join('\n')+'\n']);
row.legacy_value='  原值-🔐-é  ';row.deleted_at='2026-10-26T00:00:00Z';
assert.equal((await readSourceFile(blob())).records[0].legacy_value,row.legacy_value);
assert.equal((await readSourceFile(blob())).records[0].deleted_at,row.deleted_at);
for(const value of ['{"a":1,"a":2}','{"x":{"a":1,"a":2}}','{"a":1} tail','{"a":}'])assert.throws(()=>strictJson(value));
await assert.rejects(()=>readSourceFile(new Blob([new Uint8Array([255])])));
await assert.rejects(()=>readSourceFile(new Blob(['x'.repeat(SOURCE_LIMIT+1)])),e=>e.code==='MIGRATION_LIMIT');
await assert.rejects(()=>readSourceFile(blob([])));
await assert.rejects(()=>readSourceFile(blob([row,row])));
for(const mutate of [r=>r.metadata.user_id='8',r=>r.source_revision='2',r=>r.deleted_at='invalid',r=>r.legacy_value=' ',r=>r.legacy_value='x'.repeat(8193),r=>r.legacy_value='\ud800',r=>r.extra='secret']){const bad=structuredClone(row);mutate(bad);await assert.rejects(()=>readSourceFile(blob([bad])));}
const huge={...batch,record_count:2001};await assert.rejects(()=>readSourceFile(blob([],{format:'forge-migration-source-v1',batch:huge})),e=>e.code==='MIGRATION_LIMIT');
console.log('PASS streamed JSONL source: byte/record/line caps, duplicate keys, invalid encoding/surrogates, full set, identity/revision/deletion and exact whitespace');
