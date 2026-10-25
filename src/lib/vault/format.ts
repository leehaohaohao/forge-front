import type { Kdf, VaultConfig, SecretEnvelope, SecretContext, RecoveryMaterial } from './types';
import { VaultError } from './types';
export function requireThat(ok: unknown): asserts ok { if (!ok) throw new VaultError('INVALID_FORMAT'); }
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  requireThat(value && typeof value === 'object' && !Array.isArray(value));
  const record = value as Record<string, unknown>;
  requireThat(Object.keys(record).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(record, k)));
  return record;
}
export function decimal(value: unknown): asserts value is string {
  requireThat(typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value));
  requireThat(BigInt(value) <= 9223372036854775807n);
}
export function uuid(value: unknown): asserts value is string {
  requireThat(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value));
}
export function version(value: unknown): asserts value is number {
  requireThat(Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 2147483647);
}
export function base64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
export function unbase64(value: unknown, min: number, max = min): Uint8Array<ArrayBuffer> {
  requireThat(typeof value === 'string' && value.length <= Math.ceil(max / 3) * 4);
  requireThat(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value));
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  requireThat(bytes.length >= min && bytes.length <= max && base64(bytes) === value);
  return bytes;
}
export function utf8(value: unknown): Uint8Array<ArrayBuffer> {
  requireThat(typeof value === 'string');
  for (let i = 0; i < value.length; i++) {
    const n = value.charCodeAt(i);
    if (n >= 0xd800 && n <= 0xdbff) { const next = value.charCodeAt(++i); requireThat(next >= 0xdc00 && next <= 0xdfff); }
    else requireThat(n < 0xdc00 || n > 0xdfff);
  }
  return new TextEncoder().encode(value);
}
export function validatePassword(value: string) {
  const bytes = utf8(value);
  try { if ([...value].length < 12 || bytes.length > 1024 || !value.trim()) throw new VaultError('INVALID_PASSWORD'); }
  finally { bytes.fill(0); }
}
export function validateKdf(value: unknown): asserts value is Kdf {
  const k = object(value, ['algorithm','version','memory_kib','iterations','parallelism','length','salt']);
  requireThat(k.algorithm === 'argon2id' && k.version === 19 && k.memory_kib === 65536 && k.iterations === 3 && k.parallelism === 4 && k.length === 32);
  unbase64(k.salt, 16);
}
export function validateVault(value: unknown): asserts value is VaultConfig {
  const v = object(value, ['vault_id','format_version','vault_key_version','credential_version','kdf','password_wrap','recovery_wrap']);
  uuid(v.vault_id); requireThat(v.format_version === 1); version(v.vault_key_version); version(v.credential_version); validateKdf(v.kdf);
  for (const wrap of [v.password_wrap,v.recovery_wrap]) {
    const w = object(wrap,['nonce','ciphertext']); unbase64(w.nonce,12); unbase64(w.ciphertext,48);
  }
}
export function validateContext(c: SecretContext) {
  object(c, ['user_id','vault_id','vault_key_version','secret_id','secret_version']);
  decimal(c.user_id); uuid(c.vault_id); uuid(c.secret_id); version(c.vault_key_version); version(c.secret_version);
}
export function validateEnvelope(value: unknown, c: SecretContext): asserts value is SecretEnvelope {
  validateContext(c);
  const e = object(value,['format_version','vault_id','vault_key_version','secret_id','secret_version','algorithm','ciphertext','nonce','wrapped_dek','wrap_nonce']);
  requireThat(e.format_version === 1 && e.algorithm === 'AES-256-GCM' && e.vault_id === c.vault_id && e.vault_key_version === c.vault_key_version && e.secret_id === c.secret_id && e.secret_version === c.secret_version);
  unbase64(e.nonce,12); unbase64(e.wrap_nonce,12); unbase64(e.wrapped_dek,48); unbase64(e.ciphertext,17,8208);
}
export function validateRecovery(value: unknown): asserts value is RecoveryMaterial {
  const r = object(value,['format_version','vault_id','user_id','recovery_key']);
  requireThat(r.format_version === 1); uuid(r.vault_id); decimal(r.user_id); unbase64(r.recovery_key,32).fill(0);
}
export const newKdf = (): Kdf => ({ algorithm:'argon2id', version:19, memory_kib:65536, iterations:3, parallelism:4, length:32, salt:base64(crypto.getRandomValues(new Uint8Array(16))) });
const aad = (fields: string[]) => utf8(JSON.stringify(['forge-vault', ...fields]));
export function secretAad(c: SecretContext) { validateContext(c); return aad(['secret','1',c.user_id,c.vault_id,c.secret_id,String(c.secret_version)]); }
export function dekAad(c: SecretContext) { validateContext(c); return aad(['dek-wrap','1',c.user_id,c.vault_id,c.secret_id,String(c.secret_version),String(c.vault_key_version)]); }
export function passwordAad(user: string, v: VaultConfig) {
  decimal(user); validateVault(v);
  return aad(['password-wrap','1',user,v.vault_id,String(v.vault_key_version),String(v.credential_version),'argon2id','19','65536','3','4','32',v.kdf.salt]);
}
export function recoveryAad(user: string, v: VaultConfig) {
  decimal(user); validateVault(v);
  return aad(['recovery-wrap','1',user,v.vault_id,String(v.vault_key_version),String(v.credential_version)]);
}
