import type { SecretEnvelope } from '@/lib/vault/types';
export interface Token {
  id: string; user_id: string; revision: string; provider: string; name: string;
  token_type: string; category: string; remark: string; expires_at: string | null;
  created_at: string; updated_at: string; has_secret: boolean;
  encryption_state: 'legacy_pending' | 'client_encrypted';
}
export interface TokenMetadata {
  provider: string; name: string; token_type?: string; category?: string; remark?: string;
  expires_at?: string | null;
}
// UI-only input. Never pass this object to a network transport.
export interface TokenFormValues extends TokenMetadata { secret: string }
export interface CreateTokenRequest extends TokenMetadata { secret_envelope: SecretEnvelope; expected_vault_revision: string }
export interface UpdateTokenRequest extends Partial<TokenMetadata> {
  expected_revision: string; secret_envelope?: SecretEnvelope; expected_vault_revision?: string;
}
export interface TokenAccess { id: string; user_id: string; revision: string; secret_envelope: SecretEnvelope }
export interface TokenQueryParams { page?: number; page_size?: number; provider?: string; category?: string; keyword?: string }
