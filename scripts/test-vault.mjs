import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const result=await build({stdin:{contents:`import {runCore} from './tests/vault/core.ts'; export {runCore};`,resolveDir:process.cwd(),sourcefile:'vault-test-entry.ts'},bundle:true,write:false,platform:'node',format:'esm',target:'node20'});
const {runCore}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const vectors=JSON.parse(await readFile('tests/vault/token-vault-v1-vectors.json','utf8'));
const api=JSON.parse(await readFile('tests/vault/token-vault-v1-api-fixtures.json','utf8'));
await runCore(vectors,api,console.log);
