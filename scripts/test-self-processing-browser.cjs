const {chromium}=require('playwright');const assert=require('assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await b.newContext();await context.addInitScript(()=>{window.workerPackets=[];const Original=window.Worker;window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(window.monitor)window.workerPackets.push(data);});}};});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:3013/tests/vault/self-processing.html');await p.waitForFunction(()=>window.ready);await p.evaluate(()=>window.setup());
 await p.evaluate(()=>{window.block=true;window.outcome=window.run().catch(e=>({error:e.code}));});await p.waitForFunction(()=>window.waiting);
 await p.evaluate(()=>window.lock());assert.deepEqual(await p.evaluate(()=>window.outcome),{error:'STALE'});assert.equal(await p.evaluate(()=>window.aborted),1);
 let state=await p.evaluate(()=>window.snapshot());assert.equal(state.batch.staged_count,100);assert.equal(state.batch.verified_count,100);const hashes=state.rows.slice(0,100).map(r=>r.envelope_sha256);
 // Real document reload: only synthetic backend ciphertext/state is reconstructed.
 await p.reload();await p.waitForFunction(()=>window.ready);await p.evaluate(s=>window.setup(s),state);assert.deepEqual(await p.evaluate(()=>window.run()),{accepted:true,phase:'finalizing'});
 let stats=await p.evaluate(()=>window.stats());assert.deepEqual([stats.stages,stats.receipts,stats.wraps],[2,2,201]);state=await p.evaluate(()=>window.snapshot());assert.deepEqual(state.rows.slice(0,100).map(r=>r.envelope_sha256),hashes);
 const packets=await p.evaluate(()=>JSON.stringify(window.workerPackets));assert(!packets.includes('synthetic-secret-'));assert(!packets.includes('legacy_value'));assert(!packets.includes('privateKey'));
 assert(!JSON.stringify(stats.requests).includes('synthetic-secret-'));assert.equal(await p.evaluate(()=>localStorage.length+sessionStorage.length),0);
 // Fresh Worker, receipts already present: still fetch/decrypt all three source chunks.
 await p.evaluate(s=>window.setup(s),state);await p.evaluate(()=>window.run());stats=await p.evaluate(()=>window.stats());assert.deepEqual([stats.stages,stats.receipts,stats.sources],[0,0,3]);
 // Idle timeout must terminate a waiting migration, even though progress was emitted.
 await p.evaluate(s=>window.setup(s,5000),state);await p.evaluate(()=>{window.block=true;window.waiting=false;window.outcome=window.run().catch(e=>({error:e.code}));});await p.waitForFunction(()=>window.waiting);await p.waitForFunction(()=>window.stats().state==='locked',{},{timeout:15000});assert.deepEqual(await p.evaluate(()=>window.outcome),{error:'STALE'});
 // Visibility policy and Worker exit reuse the same cancellation path.
 await p.evaluate(s=>window.setup(s),state);await p.evaluate(()=>{window.block=true;window.waiting=false;window.outcome=window.run().catch(e=>({error:e.code}));});await p.waitForFunction(()=>window.waiting);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.deepEqual(await p.evaluate(()=>window.outcome),{error:'STALE'});await p.evaluate(()=>{delete document.hidden;});
 await p.evaluate(s=>window.setup(s),state);await p.evaluate(()=>{window.block=true;window.waiting=false;window.outcome=window.run().catch(e=>({error:e.code}));});await p.waitForFunction(()=>window.waiting);await p.evaluate(()=>window.exitWorker());assert.deepEqual(await p.evaluate(()=>window.outcome),{error:'STALE'});
 assert.deepEqual(errors,[]);console.log('PASS Chrome real Worker: 201 rows, lock abort, actual reload/resume, receipt recheck, boundary scan, idle, visibility event, Worker disposal (synthetic transport)');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
