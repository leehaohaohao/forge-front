import { derive, importAes, sealAt, open, unwrapPassword, unwrapRecovery, decryptSecret, encryptSecret, wrapVault } from '../../src/lib/vault/crypto';
import { unbase64, base64, utf8, validatePassword, validateKdf, validateVault, validateEnvelope, decimal, secretAad, dekAad, passwordAad, recoveryAad } from '../../src/lib/vault/format';
import type { VaultConfig, SecretContext } from '../../src/lib/vault/types';
export function assert(value:unknown,label:string):asserts value { if (!value) throw new Error(label); }
export async function rejects(action:()=>unknown|Promise<unknown>,label:string) {
  try { await action(); } catch { return; }
  throw new Error('Expected rejection: '+label);
}
export const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export const fromHex=(value:string)=>Uint8Array.from(value.match(/../g)!,n=>parseInt(n,16));
export async function runCore(v:any,api:any,log:(line:string)=>void) {
  const vault:VaultConfig=api.vault_create_request;
  const c:SecretContext={user_id:'7',vault_id:vault.vault_id,vault_key_version:1,secret_id:v.secret_envelope.secret_id,secret_version:1};
  const start=performance.now();
  assert(hex(await derive(v.inputs.password,vault.kdf))===v.inputs.kek_hex,'Go Argon2id KEK');
  const kdfMs=Math.round(performance.now()-start);
  assert(hex(await derive(v.inputs.nfc_password,vault.kdf))===v.inputs.nfc_kek_hex,'NFC distinction');
  assert(hex(utf8(v.inputs.password))===v.inputs.password_utf8_hex,'password UTF8');
  assert(hex(utf8(v.inputs.plaintext))===v.inputs.plaintext_utf8_hex,'plaintext UTF8');
  const v2={...vault,credential_version:2,kdf:{...vault.kdf,salt:v.inputs.new_salt}};
  assert(hex(await derive(v.inputs.password,v2.kdf))===v.inputs.new_kek_hex,'new salt KDF');
  const expected:any={
    secret:secretAad(c),dek_wrap:dekAad(c),password_wrap:passwordAad('7',vault),recovery_wrap:recoveryAad('7',vault),
    password_wrap_v2:passwordAad('7',v2),recovery_wrap_v2:recoveryAad('7',v2),
    replacement_secret:secretAad({...c,secret_version:2}),replacement_dek_wrap:dekAad({...c,secret_version:2}),rotated_dek_wrap:dekAad({...c,vault_key_version:2}),
  };
  for (const [name,op] of Object.entries(v.operations) as [string,any][]) {
    assert(hex(expected[name])===op.aad_hex,'AAD '+name);
    const key=await importAes(fromHex(op.key_hex));
    assert(!key.extractable,'non-exportable '+name);
    assert(await sealAt(key,fromHex(op.plaintext_hex),expected[name],unbase64(op.nonce,12))===op.ciphertext,'ciphertext '+name);
    assert(hex(await open(key,op,expected[name],16,8208))===op.plaintext_hex,'decrypt '+name);
  }
  log('PASS Go/Python fixed vectors: Argon2id, all 9 AAD/wrap/content operations, Unicode; KDF '+kdfMs+'ms');
  const vk=await importAes(fromHex(v.inputs.vk_hex));
  assert(hex(await unwrapPassword('7',vault,v.inputs.password))===v.inputs.vk_hex,'password VK');
  assert(hex(await unwrapRecovery('7',vault,base64(fromHex(v.inputs.rk_hex))))===v.inputs.vk_hex,'recovery VK');
  assert(await decryptSecret(vk,c,v.secret_envelope)===v.inputs.plaintext,'content');
  assert(await decryptSecret(await importAes(fromHex(v.inputs.rotated_vk_hex)),{...c,vault_key_version:2},v.rotated_secret_envelope)===v.inputs.plaintext,'rotation');
  assert(v.rotated_secret_envelope.ciphertext===v.secret_envelope.ciphertext,'rotation body unchanged');
  assert(await decryptSecret(vk,{...c,secret_version:2},v.replacement_secret_envelope)==='dummy-replacement-业务值','replacement');
  const replacement=await encryptSecret(vk,c,'  dummy-🔐-é  ',0);
  const again=await encryptSecret(vk,c,'  dummy-🔐-é  ',1);
  assert(replacement.ciphertext!==again.ciphertext && replacement.wrapped_dek!==again.wrapped_dek && replacement.nonce!==again.nonce && replacement.wrap_nonce!==again.wrap_nonce,'fresh DEK/nonces');
  assert(await decryptSecret(vk,c,replacement)==='  dummy-🔐-é  ','preserve value bytes');
  await rejects(()=>unwrapPassword('7',vault,'wrong password'),'wrong password');
  await rejects(()=>unwrapRecovery('7',vault,base64(new Uint8Array(32))),'wrong RK');
  await rejects(()=>unwrapPassword('8',vault,v.inputs.password),'wrong user');
  for (const [key,value] of Object.entries({user_id:'8',secret_id:'33333333-3333-4333-8333-333333333333',secret_version:2,vault_key_version:2})) {
    await rejects(()=>decryptSecret(vk,{...c,[key]:value},v.secret_envelope),'wrong context '+key);
  }
  const corrupt=(value:string)=>{const b=unbase64(value,17,8208);b[b.length-1]^=1;return base64(b);};
  await rejects(()=>decryptSecret(vk,c,{...v.secret_envelope,ciphertext:corrupt(v.secret_envelope.ciphertext)}),'tag tamper');
  await rejects(()=>decryptSecret(vk,c,{...v.secret_envelope,wrapped_dek:corrupt(v.secret_envelope.wrapped_dek)}),'wrapped DEK tag');
  await rejects(()=>decryptSecret(vk,c,{...v.secret_envelope,nonce:base64(new Uint8Array(12))}),'nonce tamper');
  await rejects(()=>open(vk,v.operations.dek_wrap,secretAad(c)),'domain isolation');
  await rejects(()=>validateEnvelope({...v.secret_envelope,format_version:2},c),'version');
  await rejects(()=>validateVault({...vault,unexpected:true}),'unknown field');
  for (const memory of [65537,2147483647]) await rejects(()=>validateKdf({...vault.kdf,memory_kib:memory}),'resource ceiling');
  for (const b64 of ['_AAA','AAAA\n','AB==','AAA','====']) await rejects(()=>unbase64(b64,1,16),'canonical Base64');
  for (const id of ['0','01','+7','9223372036854775808',7]) await rejects(()=>decimal(id),'decimal identity');
  decimal('9007199254740993');
  await rejects(()=>utf8('\ud800'),'unpaired surrogate');
  await rejects(()=>utf8('\udc00'),'unpaired surrogate low');
  await rejects(()=>validatePassword('short'),'weak new password');
  await rejects(()=>validatePassword(' '.repeat(12)),'blank new password');
  await rejects(()=>encryptSecret(vk,c,' ',0),'blank secret');
  await rejects(()=>encryptSecret(vk,c,'汉'.repeat(2731),0),'UTF8 upper bound');
  await rejects(()=>encryptSecret(vk,c,'fictional',1000000),'VK wrap ceiling');
  await rejects(()=>encryptSecret(vk,{...c,secret_version:3},'fictional',0,1),'secret version cannot skip');
  await rejects(()=>encryptSecret(vk,{...c,secret_version:1},'fictional',0,1),'secret version cannot decrease');
  log('PASS wrong password/RK/user/secret/version/domain, nonce/tag tamper, strict schema/encoding, KDF ceiling, sizes, random replacement, key rotation');
  const raw=fromHex(v.inputs.vk_hex);
  const rotated=await wrapVault('7',raw,'A separate new password 2026!',vault);
  assert(rotated.vault.credential_version===2 && rotated.vault.vault_id===vault.vault_id && rotated.vault.vault_key_version===1,'credentials stable identity');
  assert(rotated.recovery.recovery_key!==base64(fromHex(v.inputs.rk_hex)),'new RK');
  assert(hex(await unwrapPassword('7',rotated.vault,'A separate new password 2026!'))===v.inputs.vk_hex,'credential same VK password');
  assert(hex(await unwrapRecovery('7',rotated.vault,rotated.recovery.recovery_key))===v.inputs.vk_hex,'credential same VK recovery');
  raw.fill(0);
  log('PASS credential rewrap: same VK, new salt/RK/nonces, credential version +1');
  return {kdfMs};
}
