import {Alert,Typography} from 'antd';
import type {PreparationTask} from '@/services/vault-migration';
import type {FlowStatus} from '@/lib/vault/flow';
export default function MigrationResult({task,flow}:{task:PreparationTask;flow:FlowStatus}){
  const complete=flow.completionConfirmed===true;
  const status=(s?:string)=>({pending:'待处理',failed:'失败，请联系负责人重试',exported:'已导出',verified:'已验证'}[s??'']??'尚未确认');
  return <div style={{marginBottom:12}}>{complete?<Typography.Paragraph role="status">历史迁移已完成</Typography.Paragraph>:<Alert type="warning" title="迁移完成状态尚未通过核对，请刷新或联系负责人。"/>}
    {(task.backup_state==='failed'||task.recovery_state==='failed')&&<Alert type="warning" showIcon title={task.backup_state==='failed'?'加密备份导出失败，请联系负责人重试。':'独立恢复验证失败，请联系负责人处理并重新核验。'}/>}
    <details><summary>迁移结果与后续核验详情</summary>
      <Typography.Paragraph>负责人：{task.operator_id??'等待分配'} · 任务回执：{task.task_id}</Typography.Paragraph>
      <Typography.Paragraph>迁移 {task.batch?.record_count??0} 条 · 本地验证 {task.batch?.verified_count??0} 条</Typography.Paragraph>
      <Typography.Paragraph>切换时间：{task.switched_at??'尚未确认'} · 审计：{task.audit_complete?'通过':'未通过'} · 完成时间：{task.completed_at??'尚未确认'}</Typography.Paragraph>
      <Typography.Paragraph>管理员加密备份：{status(task.backup_state)} · 导出时间：{task.backup_exported_at??'尚未登记'} · 快照：{task.backup_id??'尚未登记'}</Typography.Paragraph>
      <Typography.Paragraph>该快照独立恢复：{status(task.recovery_state)} · 核验时间：{task.recovery_checked_at??'尚未登记'}</Typography.Paragraph>
      <Typography.Paragraph>历史临时文件处置：{task.files_disposed_at??'尚未登记'}</Typography.Paragraph>
      <Typography.Text type="secondary">备份、独立恢复和临时文件处置分别由负责人核实登记；不影响已解除冻结后的正常使用。需要处理时，请向负责人提供任务回执，不发送密码或恢复材料。</Typography.Text>
    </details>
  </div>;
}
