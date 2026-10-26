import {requireThat} from './format';
import {sourceRecords,validateBatch,validateSourceRecord} from './migration-core';
import {VaultError} from './types';
export const SOURCE_LIMIT=8*1024*1024, RECORD_LIMIT=2000, LINE_LIMIT=64*1024;
// Parse each JSONL object with duplicate-key rejection, including nested metadata.
export function strictJson(text:string):any {
  let i=0;
  const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
  const string=()=>{const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')return JSON.parse(text.slice(start,i));}throw new VaultError('INVALID_FORMAT');};
  const value=(depth:number):any=>{
    requireThat(depth<16);ws();
    if(text[i]==='"')return string();
    if(text[i]==='{'){
      i++;ws();const result=Object.create(null),keys=new Set();if(text[i]==='}'){i++;return result;}
      while(i<text.length){requireThat(text[i]==='"');const key=string();requireThat(!keys.has(key));keys.add(key);ws();requireThat(text[i++]===':');result[key]=value(depth+1);ws();if(text[i]==='}'){i++;return result;}requireThat(text[i++ ]===',');ws();}
    }else if(text[i]==='['){i++;ws();const result:any[]=[];if(text[i]===']'){i++;return result;}while(i<text.length){result.push(value(depth+1));ws();if(text[i]===']'){i++;return result;}requireThat(text[i++ ]===',');}}
    else {const m=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/);requireThat(m);i+=m[0].length;return JSON.parse(m[0]);}
    throw new VaultError('INVALID_FORMAT');
  };
  const result=value(0);ws();requireThat(i===text.length);return result;
}
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
