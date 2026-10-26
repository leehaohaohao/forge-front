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
    migration:[migrationSummary(status),'点击申请迁移准备，等待管理员确认备份、冻结并交付源文件。','管理员通过经认证的加密通道或加密归档交付文件，勿通过普通附件或公开链接上传。','取得文件后解锁保险库，选择本地文件并核对交付渠道，输入账号登录密码开始校验。源文件仅在当前浏览器本地读取，不上传原文；网页最多8 MiB、2000条，较大文件由管理员协助使用本地工具。', '账号密码只在本次处理中逐批确认身份；停止、锁定或离页后清理。刷新或断网后重新选择文件并解锁，从服务端已暂存/已验证进度继续，不覆盖已成功项。', '本地加密后上传密文、读回校验，最后由管理员切换并核验；验证完成并不代表迁移完成。','冻结期间暂停新增、编辑、删除及修改凭据；未冻结时可以先新增加密密钥。'],
    use:['解锁后可新增、查看和复制。创建保险库只做一次，正常锁定不会重置准备进度。','刷新、隐藏页面、离开页面、5分钟无操作或手动锁定会清理本地秘密；浏览器提示框获得焦点不会锁定。','查看30秒后隐藏；复制内容留在系统剪贴板，请自行处理。名称、供应商、分类和备注为明文，请勿填写秘密。','账号密码只用于登录与身份确认，独立密码用于本地解锁。丢失独立密码和恢复材料后无法找回。']};
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
