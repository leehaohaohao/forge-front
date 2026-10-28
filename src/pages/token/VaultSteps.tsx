import {useRef,useState} from 'react';
import {Button,Popover} from 'antd';
import {ExclamationCircleOutlined} from '@ant-design/icons';
import {flowSteps,migrationSummary,type FlowStatus,type FlowStep} from '@/lib/vault/flow';
import './vault-flow.css';
const titles:Record<FlowStep,string>={create:'创建保险库',recovery:'保存并验证恢复材料',migration:'迁移历史密钥',use:'开始使用'};
function Help({step,status}:{step:FlowStep;status:FlowStatus}) {
  const [open,setOpen]=useState(false);
  const pinned=useRef(false);
  const close=()=>{pinned.current=false;setOpen(false);};
  const content:Record<FlowStep,string[]>={
    create:['设置独立于账号登录密码的长口令，用于本地解锁。业务密钥在本地加密后才上传。','点击创建，在本地生成草稿。此时尚未保存到服务端。'],
    recovery:['点击下载，确认恢复文件已保存，再从文件重新输入恢复密钥。','验证成功后点击保存加密保险库，服务端确认保存后才完成本步。','恢复文件不包含所有业务密钥，需要与加密数据备份分别保管。不要向管理员提供独立密码、恢复密钥或主密钥。'],
    migration:['一键迁移会按需引导本地解锁和账号身份确认，不会重复创建已有保险库。','确认全量范围（包含已删除历史记录）及冻结影响后，系统自动准备保护备份，浏览器接收加密分片并本地转换。','迁移期间暂停新增、修改、删除及凭据修改；浏览器处理阶段需保持页面打开。','隐藏、离页或锁定会暂停本地处理，返回后根据实际进度继续。','系统自动切换并核验，只有切换及审计通过才完成；自助执行尚未开放时不能开始真实迁移。'],
    use:['解锁后可新增、查看和复制。创建保险库只做一次，正常锁定不会重置准备进度。','刷新、隐藏页面、离开页面、5分钟无操作或手动锁定会清理本地秘密；浏览器提示框获得焦点不会锁定。','查看30秒后隐藏；复制内容留在系统剪贴板，请自行处理。名称、供应商、分类和备注为明文，请勿填写秘密。','账号密码只用于登录与身份确认，独立密码用于本地解锁。丢失独立密码和恢复材料后无法找回。','展开加密备份入口，使用账号密码确认身份，分别下载备份和摘要。在新的隐私窗口打开独立恢复验证，选择备份、摘要和恢复文件。含待迁移记录的备份不能确认完整恢复。','迁移结果详情分别显示切换、审计、管理员备份、独立恢复和临时文件处置；下载备份或本地核验不会自动替管理员登记。']};
  return <Popover open={open} onOpenChange={value=>{if(!pinned.current)setOpen(value);}} trigger={['hover','focus']} title={titles[step]} content={<div className="vault-step-help"><ol>{content[step].map(t=><li key={t}>{t}</li>)}</ol><Button size="small" onClick={close}>关闭说明</Button></div>}>
    <button type="button" className="vault-help" aria-label={`${titles[step]}说明`} aria-expanded={open} onClick={()=>{pinned.current=true;setOpen(true);}} onKeyDown={e=>{if(e.key==='Escape')close();}}><ExclamationCircleOutlined/></button>
  </Popover>;
}
export default function VaultSteps({status,draft,stale}:{status:FlowStatus;draft:boolean;stale:boolean}) {
  const {steps,current}=flowSteps(status,draft),index=steps.indexOf(current);
  return <ol className="vault-steps" aria-label="保险库准备进度" aria-busy={stale}>
    {steps.map((step,i)=><li key={step} data-step={step} data-state={i<index?'complete':i===index?'current':'future'} aria-current={i===index?'step':undefined}>
      <span className="vault-step-number">{i+1}</span><span>{titles[step]}</span><Help step={step} status={status}/>
    </li>)}
  </ol>;
}
