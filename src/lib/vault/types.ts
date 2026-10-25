export interface Kdf {
  algorithm: 'argon2id'; version: 19; memory_kib: 65536; iterations: 3; parallelism: 4; length: 32; salt: string;
}
export interface Wrap { nonce: string; ciphertext: string }
export interface VaultConfig {
  vault_id: string; format_version: 1; vault_key_version: number; credential_version: number;
  kdf: Kdf; password_wrap: Wrap; recovery_wrap: Wrap;
}
export interface VaultRead extends VaultConfig {
  user_id: string; revision: string; created_at: string; updated_at: string;
  dek_wrap_count: number; dek_wrap_warn_at: 900000; dek_wrap_limit: 1000000;
}
export interface SecretContext {
  user_id: string; vault_id: string; vault_key_version: number; secret_id: string; secret_version: number;
}
export interface SecretEnvelope {
  format_version: 1; vault_id: string; vault_key_version: number; secret_id: string; secret_version: number;
  algorithm: 'AES-256-GCM'; ciphertext: string; nonce: string; wrapped_dek: string; wrap_nonce: string;
}
export interface RecoveryMaterial { format_version: 1; vault_id: string; user_id: string; recovery_key: string }
export interface PreparedVault { vault: VaultConfig; recovery: RecoveryMaterial }
export type VaultFailure = 'INVALID_FORMAT' | 'INVALID_PASSWORD' | 'UNLOCK_FAILED' | 'LOCKED' | 'STALE' | 'RECOVERY_UNVERIFIED' | 'UNSUPPORTED' | 'KEY_LIMIT';
export class VaultError extends Error {
  constructor(public code: VaultFailure) { super(code); }
}
export type VaultCommand =
  | { action: 'initialize'; userId: string; password: string }
  | { action: 'resumePrepared'; userId: string; vault: VaultConfig; password: string }
  | { action: 'unlock'; userId: string; vault: VaultConfig; password: string }
  | { action: 'credentials'; userId: string; vault: VaultConfig; password?: string; recoveryKey?: string; newPassword: string }
  | { action: 'verifyRecovery'; material: RecoveryMaterial }
  | { action: 'prepared' }
  | { action: 'encrypt'; context: SecretContext; value: string; wrapCount: number; previousVersion?: number }
  | { action: 'decrypt'; context: SecretContext; envelope: SecretEnvelope };
