import ReadinessStatus from './ReadinessStatus';
import {useState} from 'react';
import {useReadiness} from './useReadiness';
import {readinessView} from '@/lib/vault/readiness';
import SelfServiceMigration from './SelfServiceMigration';
import SelfServicePrototype,{type PrototypeTransport} from './SelfServicePrototype';
import {Button,Space} from 'antd';
import type {FlowStatus} from '@/lib/vault/flow';

export default function MigrationPanel({flow,onRefresh,unlocked,onUnlock,onRunningChange,prototype}:{flow:FlowStatus;unlocked:boolean;onUnlock:()=>void;onRefresh:()=>void;onRunningChange:(running:boolean)=>void;prototype?:PrototypeTransport}){
 const [refresh,setRefresh]=useState(0),[running,setRunning]=useState(false);
 const {diagnostic,failed}=useReadiness(flow,refresh,unlocked);
 const view=readinessView(flow,unlocked,diagnostic,failed);
 return <div id="vault-migration-step" tabIndex={-1}>
 <ReadinessStatus view={flow.audit.state==='failed'?{...view,label:'迁移核验失败，请刷新状态后重试'}:view}/>
 <Space>{prototype?<SelfServicePrototype transport={prototype} unlocked={unlocked} onUnlock={onUnlock} revision={flow.vault!.revision}/>:import.meta.env.VITE_SELF_SERVICE_UI_ENABLED==='true'?<SelfServiceMigration key={refresh} readinessAllowed={view.allowed} flow={flow} onRefresh={onRefresh} onUnlock={onUnlock} unlocked={unlocked} onRunningChange={v=>{setRunning(v);onRunningChange(v);}}/>:<Button disabled>一键迁移</Button>}<Button disabled={running} onClick={()=>{setRefresh(v=>v+1);onRefresh();}}>刷新迁移状态</Button></Space>

 </div>;
}
