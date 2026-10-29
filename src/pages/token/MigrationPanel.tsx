import SelfServiceMigration from './SelfServiceMigration';
import SelfServicePrototype,{type PrototypeTransport} from './SelfServicePrototype';
import {Button,Space,Typography} from 'antd';
import type {FlowStatus} from '@/lib/vault/flow';
import {selfServiceLabel} from '@/lib/vault/self-service';
export default function MigrationPanel({flow,onRefresh,unlocked,onUnlock,onRunningChange,prototype}:{flow:FlowStatus;unlocked:boolean;onUnlock:()=>void;onRefresh:()=>void;onRunningChange:(running:boolean)=>void;prototype?:PrototypeTransport}){
 const s=flow.self_service;
 return <div id="vault-migration-step" tabIndex={-1}>
 <Typography.Paragraph role="status">历史 {flow.counts.legacy_active} 条 · 已删除历史 {flow.counts.legacy_deleted} 条 · {flow.audit.state==='failed'?'迁移核验失败，请刷新状态后重试':selfServiceLabel(s)}</Typography.Paragraph>
 <Space>{prototype?<SelfServicePrototype transport={prototype} unlocked={unlocked} onUnlock={onUnlock} revision={flow.vault!.revision}/>:import.meta.env.VITE_SELF_SERVICE_UI_ENABLED==='true'?<SelfServiceMigration flow={flow} onRefresh={onRefresh} onUnlock={onUnlock} unlocked={unlocked} onRunningChange={onRunningChange}/>:<Button disabled>一键迁移</Button>}<Button onClick={onRefresh}>刷新迁移状态</Button></Space>
 <Typography.Paragraph type="secondary">{s?.blockers.includes('schema_missing')?'部署尚未完成，请稍后再试。':s?.execution_supported?'系统自动准备、转换和核验，已提交进度可继续。':'自助迁移尚未开放，现有密钥和已提交进度保留。'}</Typography.Paragraph>
 </div>;
}
