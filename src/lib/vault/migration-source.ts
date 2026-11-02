import {requireThat} from './format';
import {sourceRecords,validateBatch,validateSourceRecord} from './migration-core';
import {VaultError} from './types';
export const SOURCE_LIMIT=8*1024*1024, RECORD_LIMIT=2000, LINE_LIMIT=64*1024;
// Parse each JSONL object with duplicate-key rejection, including nested metadata.
export {strictJson} from './strict-json';
import {strictJson} from './strict-json';
export async function readSourceFile(file:Blob) {
  if(file.size>SOURCE_LIMIT)throw new VaultError('MIGRATION_LIMIT');
  requireThat(file.size>0);
  const reader=file.stream().getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let rest='',header:any,totalBytes=0;const records:any[]=[];
  const line=(s:string)=>{
    requireThat(s.length>0 && s.length<=LINE_LIMIT);
    const parsed=strictJson(s);
    if(!header){header=parsed;validateBatch(header.batch);if(header.batch.record_count>RECORD_LIMIT)throw new VaultError('MIGRATION_LIMIT');}
    else{if(records.length>=RECORD_LIMIT)throw new VaultError('MIGRATION_LIMIT');validateSourceRecord(parsed,header.batch);records.push(parsed);}
  };
  try {
    for(;;){const {done,value}=await reader.read();if(done)break;
      totalBytes+=value.byteLength;if(totalBytes>SOURCE_LIMIT)throw new VaultError('MIGRATION_LIMIT');
      rest+=decoder.decode(value,{stream:true});value.fill(0);
      let end;while((end=rest.indexOf('\n'))>=0){line(rest.slice(0,end));rest=rest.slice(end+1);}
      requireThat(rest.length<=LINE_LIMIT);
    }
    rest+=decoder.decode();if(rest.length)line(rest);
    return sourceRecords(header,records);
  }finally{rest='';try{await reader.cancel();}finally{reader.releaseLock();}}
}
