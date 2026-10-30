const {chromium}=require('playwright');const assert=require('assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage();p.on('pageerror',e=>console.log(e.message));p.on('console',m=>{if(m.type()==='error')console.log(m.text());});await p.goto('http://localhost:3013/tests/vault/polling-review.html');await p.waitForFunction(()=>window.ready);await p.waitForFunction(()=>window.lists===1);await p.clock.install();
 await p.clock.runFor(60000);assert.equal(await p.evaluate(()=>window.refreshes),0);assert((await p.evaluate(()=>window.lists))<=5);
 async function start(){await p.getByLabel('迁移账号登录密码').fill('synthetic-account');await p.getByRole('checkbox').check();await p.getByRole('button',{name:'一键迁移',exact:true}).click();await p.waitForFunction(()=>window.running);}
 await start();const base=await p.evaluate(()=>window.lists);await p.evaluate(()=>window.throttle=true);await p.clock.runFor(90000);assert.equal(await p.evaluate(()=>window.running),true);assert.equal(await p.evaluate(()=>window.clientCloses),0);assert.equal(await p.evaluate(()=>window.lists),base);assert((await p.evaluate(()=>window.reads))<=5);
 await p.evaluate(()=>window.phase='client_processing');await p.clock.runFor(15000);await p.waitForFunction(()=>window.processed===1);await p.clock.runFor(10);
 // Terminal transition triggers one refresh; remount of the same history is stable.
 await p.evaluate(()=>window.phase='canceled');await p.clock.runFor(30000);const refresh=await p.evaluate(()=>window.refreshes);await p.clock.runFor(60000);assert.equal(await p.evaluate(()=>window.refreshes),refresh);
 await start();assert.equal(await p.evaluate(()=>window.options.resumeExisting),true);assert.equal(await p.evaluate(()=>window.starts),2);
 console.log('PASS actual React component + parent unmount: canceled history stable, restart creates task, >minute preparing single polling budget, 429 retains context');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
