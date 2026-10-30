import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {App} from 'antd';import SelfServicePrototype from '../../src/pages/token/SelfServicePrototype';
const w=window as any;w.created=0;w.authenticated=0;
function Harness(){const [unlocked,setUnlocked]=useState(false);return <SelfServicePrototype unlocked={unlocked} onUnlock={()=>setUnlocked(true)} revision="4" transport={{reauth:async(password)=>{if(password!=='synthetic-account')throw Error();w.authenticated++;return 'synthetic-proof';},create:async(body,proof)=>{if(proof!=='synthetic-proof')throw Error();w.created++;w.body=body;return {authorization:{token:'synthetic-grant',expires_at:new Date(Date.now()+900000).toISOString(),delivery_epoch:'1',recipient:'fixture',scope:'migration'}};}}}/>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App><Harness/></App></React.StrictMode>);

