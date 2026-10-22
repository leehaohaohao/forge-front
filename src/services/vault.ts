import api, { type ApiResponse } from '@/lib/api';
import type { VaultConfig, VaultRead } from '@/lib/vault/types';
import { configOf, type VaultTransport } from '@/lib/vault/session';
import { decimal, requireThat } from '@/lib/vault/format';
export interface VaultStatus {initialized:boolean;user_id:string;vault:VaultRead|null}
export async function readVault(signal?:AbortSignal):Promise<VaultStatus> {
  const d=(await api.get<ApiResponse<VaultStatus>>('/vault',{signal})).data.data;
  decimal(d.user_id); requireThat(typeof d.initialized==='boolean' && d.initialized===(d.vault!==null));
  if(d.vault) {
    configOf(d.vault); decimal(d.vault.revision); requireThat(d.vault.user_id===d.user_id);
    requireThat(Number.isSafeInteger(d.vault.dek_wrap_count) && d.vault.dek_wrap_count>=0 && d.vault.dek_wrap_limit===1000000 && d.vault.dek_wrap_warn_at===900000);
  }
  return d;
}
export function vaultTransport(signal:AbortSignal,reauth?:string):VaultTransport {
  return {
    read:()=>readVault(signal),
    create:async(v:VaultConfig)=>(await api.post<ApiResponse<VaultRead>>('/vault',configOf(v),{signal})).data.data,
    credentials:async(input)=>{
      requireThat(reauth);
      return (await api.put<ApiResponse<VaultRead>>('/vault/credentials',input,{signal,headers:{'X-Forge-Reauth':reauth}})).data.data;
    },
  };
}
export async function reauthenticate(account_password:string,signal:AbortSignal) {
  return (await api.post<ApiResponse<{reauth_token:string}>>('/auth/reauth',{account_password,purpose:'vault_credentials'},{signal})).data.data.reauth_token;
}
