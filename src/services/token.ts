import api, { type ApiResponse, type PageData } from '@/lib/api';
import type { Token, TokenMetadata, CreateTokenRequest, UpdateTokenRequest, TokenQueryParams, TokenAccess } from '@/types/token';
import { decimal, requireThat } from '@/lib/vault/format';
// Explicit DTO projection keeps unexpected legacy fields out of component/store state.
export function tokenMetadata(t: Token): Token {
  decimal(t.id); decimal(t.user_id); decimal(t.revision);
  requireThat(['legacy_pending','client_encrypted'].includes(t.encryption_state) && typeof t.has_secret === 'boolean');
  return {id:t.id,user_id:t.user_id,revision:t.revision,provider:t.provider,name:t.name,
    token_type:t.token_type,category:t.category,remark:t.remark,expires_at:t.expires_at,
    created_at:t.created_at,updated_at:t.updated_at,has_secret:t.has_secret,encryption_state:t.encryption_state};
}
function metadata(d: Partial<TokenMetadata>) {
  const out: Partial<TokenMetadata> = {};
  for (const k of ['provider','name','token_type','category','remark','expires_at'] as const) {
    if (d[k] !== undefined) Object.assign(out,{[k]:d[k]});
  }
  return out;
}
export async function getTokens(params?: TokenQueryParams, signal?: AbortSignal) {
  const res=await api.get<ApiResponse<PageData<Token>>>('/token',{params,signal});
  return {data:res.data.data.list.map(tokenMetadata),total:res.data.data.total};
}
export async function getToken(id:string, signal?:AbortSignal) {
  decimal(id); return tokenMetadata((await api.get<ApiResponse<Token>>(`/token/${id}`,{signal})).data.data);
}
export async function createToken(d:CreateTokenRequest, signal?:AbortSignal) {
  const body={...metadata(d),secret_envelope:d.secret_envelope,expected_vault_revision:d.expected_vault_revision};
  return tokenMetadata((await api.post<ApiResponse<Token>>('/token',body,{signal})).data.data);
}
export async function updateToken(id:string,d:UpdateTokenRequest,signal?:AbortSignal) {
  decimal(id);
  const body={...metadata(d),expected_revision:d.expected_revision,...(d.secret_envelope===undefined?{}:{secret_envelope:d.secret_envelope,expected_vault_revision:d.expected_vault_revision})};
  return tokenMetadata((await api.put<ApiResponse<Token>>(`/token/${id}`,body,{signal})).data.data);
}
export async function deleteToken(t:Token,signal?:AbortSignal) {
  decimal(t.id); await api.delete(`/token/${t.id}`,{data:{expected_revision:t.revision},signal});
}
export async function accessToken(id:string,purpose:'view'|'copy',signal?:AbortSignal) {
  decimal(id); return (await api.post<ApiResponse<TokenAccess>>(`/token/${id}/access`,{purpose},{signal})).data.data;
}
