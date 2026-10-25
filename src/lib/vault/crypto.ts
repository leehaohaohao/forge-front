// This module runs inside the vault Worker. Raw keys must never be returned by its RPC API.
import { argon2id } from 'hash-wasm';
import type { Kdf, VaultConfig, SecretContext, SecretEnvelope, Wrap } from './types';
import { VaultError } from './types';
import { base64, unbase64, utf8, validateKdf, validateVault, validateEnvelope, validatePassword, requireThat, newKdf, secretAad, dekAad, passwordAad, recoveryAad, version } from './format';
export const importAes = (raw: Uint8Array<ArrayBuffer>) => {
  requireThat(raw.length === 32);
  return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
};
export async function derive(password: string, kdf: Kdf) {
  validateKdf(kdf);
  const bytes = utf8(password);
  // Unlock has no minimum-strength rule, but still enforces a resource/input limit.
  try {
    requireThat(bytes.length <= 1024);
    return new Uint8Array(await argon2id({password:bytes, salt:unbase64(kdf.salt,16), parallelism:4, iterations:3, memorySize:65536, hashLength:32, outputType:'binary'}));
  } finally { bytes.fill(0); }
}
export async function seal(key: CryptoKey, data: Uint8Array<ArrayBuffer>, aad: Uint8Array<ArrayBuffer>): Promise<Wrap> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  return {nonce:base64(nonce), ciphertext:await sealAt(key,data,aad,nonce)};
}
// Deterministic primitive is used only by cross-implementation tests. Production always calls seal().
export async function sealAt(key: CryptoKey, data: Uint8Array<ArrayBuffer>, aad: Uint8Array<ArrayBuffer>, nonce: Uint8Array<ArrayBuffer>) {
  requireThat(nonce.length === 12);
  return base64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:aad,tagLength:128},key,data)));
}
export async function open(key: CryptoKey, wrap: Wrap, aad: Uint8Array<ArrayBuffer>, min = 48, max = min) {
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(wrap.nonce,12),additionalData:aad,tagLength:128},key,unbase64(wrap.ciphertext,min,max)));
}
export async function unwrapPassword(user: string, vault: VaultConfig, password: string) {
  validateVault(vault);
  const kek = await derive(password,vault.kdf);
  try { return await open(await importAes(kek),vault.password_wrap,passwordAad(user,vault)); }
  finally { kek.fill(0); }
}
export async function unwrapRecovery(user: string, vault: VaultConfig, recoveryKey: string) {
  validateVault(vault);
  const rk = unbase64(recoveryKey,32);
  try { return await open(await importAes(rk),vault.recovery_wrap,recoveryAad(user,vault)); }
  finally { rk.fill(0); }
}
export async function wrapVault(user: string, rawVk: Uint8Array<ArrayBuffer>, password: string, previous?: VaultConfig) {
  validatePassword(password);
  const rk = crypto.getRandomValues(new Uint8Array(32));
  // Placeholders are valid lengths so AAD builders can validate the complete shape before encryption.
  const empty = {nonce:base64(new Uint8Array(12)),ciphertext:base64(new Uint8Array(48))};
  const vault: VaultConfig = {
    vault_id:previous?.vault_id ?? crypto.randomUUID(), format_version:1,
    vault_key_version:previous?.vault_key_version ?? 1, credential_version:previous ? previous.credential_version + 1 : 1,
    kdf:newKdf(), password_wrap:{...empty}, recovery_wrap:{...empty},
  };
  version(vault.credential_version);
  let kek: Uint8Array<ArrayBuffer> | undefined;
  try {
    kek = await derive(password,vault.kdf);
    vault.password_wrap = await seal(await importAes(kek),rawVk,passwordAad(user,vault));
    vault.recovery_wrap = await seal(await importAes(rk),rawVk,recoveryAad(user,vault));
    // Verify both routes before offering recovery material or publishing anything.
    const a = await unwrapPassword(user,vault,password);
    const b = await unwrapRecovery(user,vault,base64(rk));
    try { requireThat(a.every((n,i) => n === rawVk[i]) && b.every((n,i) => n === rawVk[i])); }
    finally { a.fill(0); b.fill(0); }
    return {vault,recovery:{format_version:1 as const,vault_id:vault.vault_id,user_id:user,recovery_key:base64(rk)}};
  } finally { rk.fill(0); kek?.fill(0); }
}
export async function encryptSecret(vk: CryptoKey, context: SecretContext, value: string, wrapCount: number, previousVersion = 0): Promise<SecretEnvelope> {
  requireThat(Number.isInteger(previousVersion) && previousVersion >= 0 && previousVersion < 2147483647 && context.secret_version === previousVersion + 1);
  requireThat(Number.isSafeInteger(wrapCount) && wrapCount >= 0);
  if (wrapCount >= 1000000) throw new VaultError('KEY_LIMIT');
  const bytes = utf8(value);
  const dek = crypto.getRandomValues(new Uint8Array(32));
  try {
    requireThat(bytes.length >= 1 && bytes.length <= 8192 && value.trim());
    const content = await seal(await importAes(dek),bytes,secretAad(context));
    const wrapped = await seal(vk,dek,dekAad(context));
    return {format_version:1,algorithm:'AES-256-GCM',vault_id:context.vault_id,vault_key_version:context.vault_key_version,secret_id:context.secret_id,secret_version:context.secret_version,ciphertext:content.ciphertext,nonce:content.nonce,wrapped_dek:wrapped.ciphertext,wrap_nonce:wrapped.nonce};
  } finally { bytes.fill(0); dek.fill(0); }
}
export async function decryptSecret(vk: CryptoKey, c: SecretContext, envelope: SecretEnvelope) {
  validateEnvelope(envelope,c);
  const dek = await open(vk,{nonce:envelope.wrap_nonce,ciphertext:envelope.wrapped_dek},dekAad(c));
  let bytes: Uint8Array<ArrayBuffer> | undefined;
  try {
    bytes = await open(await importAes(dek),{nonce:envelope.nonce,ciphertext:envelope.ciphertext},secretAad(c),17,8208);
    const value = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    requireThat(value.trim());
    return value;
  } finally { dek.fill(0); bytes?.fill(0); }
}
