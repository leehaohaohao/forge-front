import ReadinessStatus from './ReadinessStatus';
import {useEffect,useState} from 'react';
import {readReadiness} from '@/services/vault-readiness';
import {readinessView,type Readiness} from '@/lib/vault/readiness';
import SelfServiceMigration from './SelfServiceMigration';
import SelfServicePrototype,{type PrototypeTransport} from './SelfServicePrototype';
import {Button,Space} from 'antd';
import type {FlowStatus} from '@/lib/vault/flow';

export default function MigrationPanel({flow,onRefresh,unlocked,onUnlock,onRunningChange,prototype}:{flow:FlowStatus;unlocked:boolean;onUnlock:()=>void;onRefresh:()=>void;onRunningChange:(running:boolean)=>void;prototype?:PrototypeTransport}){
 const [diagnostic,setDiagnostic]=useState<Readiness|null>(),[failed,setFailed]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();const token=localStorage.getItem('forge_token');setDiagnostic(undefined);setFailed(false);void readReadiness(controller.signal).then(d=>{if(!controller.signal.aborted&&token===localStorage.getItem('forge_token'))setDiagnostic(d);}).catch(()=>{if(!controller.signal.aborted&&token===localStorage.getItem('forge_token'))setFailed(true);});return()=>controller.abort();},[flow,refresh]);
 const view=readinessView(flow,unlocked,diagnostic,failed);
 return <div id="vault-migration-step" tabIndex={-1}>
 <ReadinessStatus view={flow.audit.state==='failed'?{...view,label:'迁移核验失败，请刷新状态后重试'}:view}/>
 <Space>{prototype?<SelfServicePrototype transport={prototype} unlocked={unlocked} onUnlock={onUnlock} revision={flow.vault!.revision}/>:import.meta.env.VITE_SELF_SERVICE_UI_ENABLED==='true'?<SelfServiceMigration readinessAllowed={view.allowed} flow={flow} onRefresh={onRefresh} onUnlock={onUnlock} unlocked={unlocked} onRunningChange={onRunningChange}/>:<Button disabled>一键迁移</Button>}<Button onClick={()=>{setRefresh(v=>v+1);onRefresh();}}>刷新迁移状态</Button></Space>

 </div>;
}
