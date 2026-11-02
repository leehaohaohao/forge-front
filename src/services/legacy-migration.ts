import api,{type ApiResponse} from '@/lib/api';
import {ApiError} from '@/lib/api-error';
import {currentVault,vaultSession} from '@/lib/vault/runtime';
import {requireThat} from '@/lib/vault/format';
import {parseStatus,committed,type Row,type Commit} from '@/lib/legacy-migration/protocol';
export function legacyDriver(signal:AbortSignal,guard:()=>void,changed:()=>void){
 return {
  async status(after?:string,limit=50){try{const r=await api.get<ApiResponse<unknown>>('/vault/legacy-migration/status',{signal,params:{...(after?{after_id:after}:{}),limit}});guard();return parseStatus(r.data.data,after);}catch(e){if(e instanceof ApiError&&[404,410].includes(e.httpStatus??0))return parseStatus({protocol:'legacy-migration-v1',enabled:false,source_format:null,pending_count:null,deleted_count:null,unsupported_count:null,complete:false,vault:null,records:[],next_after:null});throw e;}},
  async convert(row:Row){
   const vault=await currentVault(signal);guard();const pair=await vaultSession.legacyRecipient();guard();const started=performance.now();
   try{const result=await api.post<ApiResponse<unknown>>('/vault/legacy-migration/source',{id:row.id,expected_revision:row.revision,recipient:pair.publicKey},{signal});guard();
    const date=Date.parse(String(result.headers.date));requireThat(Number.isFinite(date));
    const body=await vaultSession.legacyConvert({row,vault,response:result.data.data,now:Math.floor(date/1000)+Math.ceil((performance.now()-started)/1000)});guard();return body;
   }finally{vaultSession.clearLegacy();}
  },
  async commit(row:Row,body:Commit){guard();const r=await api.post<ApiResponse<unknown>>('/vault/legacy-migration/commit',body,{signal});guard();committed(r.data.data,row);},changed,
 };
}
