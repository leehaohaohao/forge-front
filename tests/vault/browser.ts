import { runCore, assert, rejects } from './core';
import { VaultSession, configOf } from '../../src/lib/vault/session';
import type { VaultRead, SecretContext } from '../../src/lib/vault/types';
import type { VaultTransport } from '../../src/lib/vault/session';
const output=document.getElementById('result')!;
const button=document.getElementById('run') as HTMLButtonElement;
const log=(line:string)=>{output.textContent+='\n'+line;};
button.onclick=async()=>{
  button.disabled=true; output.textContent='RUNNING '+navigator.userAgent;
  let session:VaultSession|undefined;
  try {
    const vectors=await (await fetch('/tests/vault/token-vault-v1-vectors.json',{cache:'no-store'})).json();
    const api=await (await fetch('/tests/vault/token-vault-v1-api-fixtures.json',{cache:'no-store'})).json();
    await runCore(vectors,api,log);
    session=new VaultSession();
    assert(session.state==='locked','new session locked');
    const session2=new VaultSession();
    const context:SecretContext={user_id:'7',vault_id:api.vault_create_request.vault_id,vault_key_version:1,secret_id:vectors.secret_envelope.secret_id,secret_version:1};
    await rejects(()=>session2.decrypt(context,vectors.secret_envelope),'fresh/refresh cannot decrypt');
    session2.dispose();
    const started=performance.now();
    await session.unlock('7',api.vault_create_request,vectors.inputs.password);
    log('PASS real Worker Argon2id unlock '+Math.round(performance.now()-started)+'ms');
    assert(await session.decrypt(context,vectors.secret_envelope)===vectors.inputs.plaintext,'worker plaintext');
    session.lock();
    await rejects(()=>session.unlock('7',api.vault_create_request,'wrong password'),'worker wrong password');
    session.lock();
    try {
      await session.unlock('7',{...api.vault_create_request,password_wrap:{...api.vault_create_request.password_wrap,ciphertext:'broken'}},vectors.inputs.password);
      throw new Error('corrupt vault unexpectedly unlocked');
    } catch(error) { assert((error as any).code==='UNLOCK_FAILED','malformed vault uses same safe unlock error'); }
    const late=session.unlock('7',api.vault_create_request,vectors.inputs.password);
    session.lock();
    await rejects(()=>late,'late KDF after lock');
    assert(session.state==='locked','late result cannot unlock');
    const prepared=await session.initialize('9007199254740993','Independent local password 2026!');
    const newContext={...context,user_id:'9007199254740993',vault_id:prepared.vault.vault_id};
    await rejects(()=>session.encrypt(newContext,'fictional',0),'no write before recovery verify');
    let saved:VaultRead|null=null;
    let writes=0;
    let lose=true;
    const transport:VaultTransport={
      async read(){return {user_id:'9007199254740993',vault:saved};},
      async create(v){
        writes++; if(saved) throw new Error('conflict');
        saved={...v,user_id:'9007199254740993',revision:'1',created_at:'2026-10-22T00:00:00Z',updated_at:'2026-10-22T00:00:00Z',dek_wrap_count:0,dek_wrap_warn_at:900000,dek_wrap_limit:1000000};
        if(lose){lose=false;throw new Error('response lost');} return saved;
      },
      async credentials(input){
        writes++; assert(saved && saved.revision===input.expected_revision,'credential revision guard');
        saved={...saved,...input,revision:String(BigInt(saved.revision)+1n)};
        delete (saved as any).expected_revision;
        return saved;
      },
    };
    await rejects(()=>session!.publish(transport),'no publish before verify');
    assert(writes===0,'no upload before recovery verified');
    await rejects(()=>session!.verifyRecovery(prepared.recovery),'not saved');
    session.recoverySaved();
    session.suspend();
    assert(session.state==='locked' && session.pendingConfirmation?.vault_id===prepared.vault.vault_id,'only encrypted draft retained');
    await rejects(()=>session!.resumePrepared('incorrect'),'wrong draft password');
    assert(session.pendingConfirmation?.saved,'wrong password retains saved encrypted draft');
    await session.resumePrepared('Independent local password 2026!');
    await rejects(()=>session!.publish(transport),'resumed draft must reverify recovery');
    await rejects(()=>session!.verifyRecovery({...prepared.recovery,recovery_key:btoa('x'.repeat(32))}),'reentry wrong');
    await session.verifyRecovery(prepared.recovery);
    const published=await session.publish(transport);
    assert(published.vault_id===prepared.vault.vault_id && writes===1,'uncertain write re-read, one VK and one POST');
    const env=await session.encrypt(newContext,'fictional-local-secret',0);
    assert(await session.decrypt(newContext,env)==='fictional-local-secret','new local roundtrip');
    assert(!JSON.stringify(published).includes(prepared.recovery.recovery_key),'public vault excludes RK');
    const recovery=await session.changeCredentials('9007199254740993',published,{recoveryKey:prepared.recovery.recovery_key},'Changed local password 2026!');
    assert(recovery.vault.vault_id===prepared.vault.vault_id && recovery.recovery.recovery_key!==prepared.recovery.recovery_key,'same vault new recovery');
    session.recoverySaved(); session.suspend(); await session.resumePrepared('Changed local password 2026!'); await session.verifyRecovery(recovery.recovery);
    const credentials=await session.publish(transport);
    assert(await session.decrypt(newContext,env)==='fictional-local-secret','recovery retained VK/body');
    session.lock();
    await rejects(()=>session!.unlock('9007199254740993',configOf(credentials),'Independent local password 2026!'),'old password revoked for new wraps');
    session.lock(); await session.unlock('9007199254740993',configOf(credentials),'Changed local password 2026!');
    assert(await session.decrypt(newContext,env)==='fictional-local-secret','new password same data');
    const passwordDraft=await session.changeCredentials('9007199254740993',credentials,{password:'Changed local password 2026!'},'Third local password 2026!');
    session.recoverySaved(); session.suspend();
    await session.resumePrepared('Third local password 2026!');
    await session.verifyRecovery(passwordDraft.recovery); await session.publish(transport);
    assert(await session.decrypt(newContext,env)==='fictional-local-secret','password change resumed same VK');
    const discard=await session.changeCredentials('9007199254740993',saved!,{password:'Third local password 2026!'},'Discard local password 2026!');
    session.recoverySaved(); session.suspend(); session.lock();
    assert(!session.pendingConfirmation,'explicit lock discards encrypted draft');
    await rejects(()=>session!.resumePrepared('Discard local password 2026!'),'discard cannot resume');
    assert(discard.vault.vault_id===prepared.vault.vault_id,'credential update retains identity');
    session.dispose();
    session=new VaultSession(1500);
    await session.unlock('7',api.vault_create_request,vectors.inputs.password);
    assert(session.state==='unlocked','idle starts unlocked');
    await new Promise(resolve=>setTimeout(resolve,1600));
    assert(session.state==='locked','idle lock');
    session.dispose();
    // A failed write keeps the same verified draft, and an existing foreign draft is never overwritten.
    session=new VaultSession();
    const retryDraft=await session.initialize('7','Offline retry password 2026!');
    session.recoverySaved(); await session.verifyRecovery(retryDraft.recovery);
    let offline=true, retrySaved:VaultRead|null=null, attempts=0;
    const retryTransport:VaultTransport={
      async read(){return {user_id:'7',vault:retrySaved};},
      async create(v){
        attempts++; if(offline) throw new Error('offline');
        retrySaved={...v,user_id:'7',revision:'1',created_at:'2026-10-22T00:00:00Z',updated_at:'2026-10-22T00:00:00Z',dek_wrap_count:0,dek_wrap_warn_at:900000,dek_wrap_limit:1000000};
        return retrySaved;
      },
      async credentials(){throw new Error('not used');},
    };
    await rejects(()=>session!.publish(retryTransport),'offline create');
    assert(session.state==='pending','offline retains pending draft');
    await rejects(()=>session!.publish({...retryTransport,read:async()=>({user_id:'7',vault:published})}),'different vault cannot overwrite');
    assert(attempts===1,'no overwrite POST');
    offline=false;
    const retryResult=await session.publish(retryTransport);
    assert(retryResult.vault_id===retryDraft.vault.vault_id && attempts===2,'offline retries same VK');
    session.dispose();
    session=new VaultSession();
    const lateDraft=await session.initialize('7','Late request password 2026!');
    session.recoverySaved(); await session.verifyRecovery(lateDraft.recovery);
    let release:((value:{user_id:string;vault:null})=>void)|undefined;
    let lateWrites=0;
    const latePublish=session.publish({
      read:()=>new Promise(resolve=>{release=resolve;}),
      create:async()=>{lateWrites++;throw new Error('must not write');},
      credentials:async()=>{throw new Error('must not write');},
    });
    while(!release) await new Promise(resolve=>setTimeout(resolve,10));
    session.lock(); release({user_id:'7',vault:null});
    await rejects(()=>latePublish,'read returns after lock');
    assert(lateWrites===0 && session.state==='locked','late read cannot upload or unlock');
    session.dispose();
    log('PASS offline retry reuses draft, existing vault conflict prevents write, late read after lock cannot submit');
    log('PASS Worker/session: locked on refresh, stale KDF, saved+reentered recovery gate, no upload before verification, uncertain POST readback, exact large user_id, recovery and new password, idle lock');
    log('PASS ALL — crypto vectors and Worker/session integration');
    output.dataset.status='passed';
  } catch(error) { log('FAIL '+(error instanceof Error?error.message:'test failed')); output.dataset.status='failed'; }
  finally {session?.dispose();button.disabled=false;}
};
