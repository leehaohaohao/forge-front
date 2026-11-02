import api,{type ApiResponse} from '@/lib/api';
import {ApiError} from '@/lib/api-error';
import {parseReadiness} from '@/lib/vault/readiness';
export async function readReadiness(signal:AbortSignal){
 try{return parseReadiness((await api.get<ApiResponse<unknown>>('/vault/self-service-readiness',{signal})).data.data);}
 catch(e){if(e instanceof ApiError&&e.httpStatus===404)return null;throw e;}
}
