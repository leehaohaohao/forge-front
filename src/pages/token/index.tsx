import { useEffect, useRef, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Space, Table, Tag, Typography, Checkbox } from 'antd';
import { useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Token, TokenMetadata } from '@/types/token';
import { useTokenStore } from '@/stores/tokens';
import { deleteToken } from '@/services/token';
import { operation, readSecret, saveSecret, vaultSession } from '@/lib/vault/runtime';
import { vaultMessage } from '@/lib/vault/messages';
import { utf8, requireThat } from '@/lib/vault/format';
import VaultPanel from './VaultPanel';
import {useVaultFlow} from './useVaultFlow';
import {capabilityMessage} from '@/lib/vault/flow';
export default function TokenPage() {
  const {message}=App.useApp(),location=useLocation();
  const {tokens,loading,pagination,fetchTokens,setPagination,clear}=useTokenStore();
  const [form]=Form.useForm();
  const flow=useVaultFlow();
  const [createIntent,setCreateIntent]=useState(false),[focusRequest,setFocusRequest]=useState(0);
  const panel=useRef<HTMLDivElement>(null);
  const cancelIntent=()=>setCreateIntent(false);
  const locateVault=()=>{panel.current?.scrollIntoView({block:'start',behavior:'smooth'});setFocusRequest(n=>n+1);};
  const locateMigration=()=>{const target=document.getElementById('vault-migration-step');(target??panel.current)?.scrollIntoView({block:'center'});target?.focus();};
  const [open,setOpen]=useState(false),[editing,setEditing]=useState<Token|null>(null),[never,setNever]=useState(false);
  const [busy,setBusy]=useState(false),[query,setQuery]=useState(''),[provider,setProvider]=useState(''),[state,setState]=useState(vaultSession.state);
  const [visible,setVisible]=useState(''),[copyReady,setCopyReady]=useState(false);
  const copyValue=useRef(''),mutex=useRef(false),epoch=useRef(0),timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearDisplay=()=>{clearTimeout(timer.current);copyValue.current='';setCopyReady(false);setVisible('');};
  const close=()=>{form.resetFields();setOpen(false);setEditing(null);setNever(false);};
  const refresh=()=>fetchTokens({keyword:query,provider:provider||undefined});
  useEffect(()=>{
    refresh().catch(e=>message.error(vaultMessage(e)));
    const unsubscribe=vaultSession.subscribe(()=>{setState(vaultSession.state);if(vaultSession.state==='locked'){setCreateIntent(false);close();clearDisplay();}});
    return ()=>{unsubscribe();setCreateIntent(false);vaultSession.lock();form.resetFields();copyValue.current='';clearTimeout(timer.current);clear();};
  },[location.key]);
  useEffect(()=>{
    if(createIntent && state==='unlocked' && flow.ready){
      setCreateIntent(false);
      if(flow.data?.operations.create_token.allowed)edit(null);
    }
  },[createIntent,state,flow.ready,flow.data]);
  function requestCreate() {
    if(!flow.ready)return;
    if(!flow.data?.initialized){setCreateIntent(true);locateVault();return;}
    if(!flow.data.operations.create_token.allowed)return;
    if(state==='unlocked')edit(null);
    else {setCreateIntent(true);locateVault();}
  }
  async function run(action:(op:ReturnType<typeof operation>)=>Promise<void>) {
    if(mutex.current)return;mutex.current=true;setBusy(true);const op=operation();
    try{await action(op);}catch(e){if(!op.signal.aborted){message.error(vaultMessage(e));flow.refresh();await refresh().catch(()=>{});}}
    finally{op.done();mutex.current=false;setBusy(false);}
  }
  function edit(t:Token|null) {
    clearDisplay();form.resetFields();setEditing(t);setNever(t?false:true);
    if(t)form.setFieldsValue({provider:t.provider,name:t.name,token_type:t.token_type,category:t.category,remark:t.remark,secret:''});
    setOpen(true);
  }
  async function submit(op:ReturnType<typeof operation>) {
    const d=await form.validateFields();op.guard();
    const secret=d.secret??'';
    if(!editing||secret!==''){const bytes=utf8(secret);try{requireThat(bytes.length>0&&bytes.length<=8192&&secret.trim());}finally{bytes.fill(0);}}
    const data:TokenMetadata={provider:d.provider,name:d.name,token_type:d.token_type??'',category:d.category??'',remark:d.remark??'',
      ...(never?{expires_at:null}:d.expires_at?{expires_at:d.expires_at.toISOString()}:{})};
    form.setFieldValue('secret','');
    await saveSecret(editing,data,secret);op.guard();close();await refresh();op.guard();message.success('保存成功');
  }
  async function show(t:Token,purpose:'view'|'copy',op:ReturnType<typeof operation>) {
    clearDisplay();
    const {context,envelope}=await readSecret(t,purpose,op.signal);op.guard();
    const value=await vaultSession.decrypt(context,envelope);op.guard();epoch.current=vaultSession.epoch;
    if(purpose==='view')setVisible(value);
    else {
      try{op.guard();await navigator.clipboard.writeText(value);op.guard();message.success('已复制');}
      catch{op.guard();copyValue.current=value;setCopyReady(true);message.info('剪贴板未授权，请点击“确认复制”重试。');}
    }
    timer.current=setTimeout(clearDisplay,30000);
  }
  function confirmCopy() {
    if(mutex.current||!copyValue.current||!vaultSession.isCurrent(epoch.current)||vaultSession.state!=='unlocked')return;
    // Invoke inside this click, without a preceding network/Worker await (Safari permission model).
    mutex.current=true;setBusy(true);
    const current=epoch.current;
    navigator.clipboard?.writeText(copyValue.current).then(()=>{if(vaultSession.isCurrent(current)){clearDisplay();message.success('已复制');}})
      .catch(()=>{if(vaultSession.isCurrent(current))message.error('剪贴板写入失败，请检查浏览器权限。');})
      .finally(()=>{mutex.current=false;setBusy(false);});
    if(!navigator.clipboard){mutex.current=false;setBusy(false);message.error('当前环境无法写入剪贴板，请使用 HTTPS。');}
  }
  return <Space orientation="vertical" size={16} style={{width:'100%'}} data-private="true" data-sentry-mask="true" className="ph-no-capture token-page">
    <div ref={panel}><VaultPanel flow={flow} createRequested={createIntent} onCancelIntent={cancelIntent} focusRequest={focusRequest}/></div>
    <Card title="密钥管理" extra={<Button type="primary" disabled={busy||!flow.ready||(!!flow.data?.initialized&&!flow.data.operations.create_token.allowed)} onClick={requestCreate}>新增密钥</Button>}>
      {!flow.ready?<Typography.Text type="secondary">准备状态尚未确认，请在保险库区域重试或等待读取</Typography.Text>:!flow.data?.operations.create_token.allowed && <Typography.Text type="secondary">{capabilityMessage(flow.data?.operations.create_token)}</Typography.Text>}
      <Space wrap style={{margin:'16px 0'}}><Input aria-label="搜索名称" placeholder="搜索名称" value={query} onChange={e=>setQuery(e.target.value)}/><Input aria-label="筛选供应商" placeholder="筛选供应商" value={provider} onChange={e=>setProvider(e.target.value)}/><Button disabled={busy} onClick={()=>{setPagination({current:1});refresh().catch(e=>message.error(vaultMessage(e)));}}>搜索</Button><Button disabled={busy} onClick={()=>{setQuery('');setProvider('');setPagination({current:1});fetchTokens().catch(e=>message.error(vaultMessage(e)));}}>重置</Button></Space>
      <Table<Token> scroll={{x:1000}} rowKey="id" dataSource={tokens} loading={loading} pagination={{...pagination,showSizeChanger:true}} onChange={p=>{setPagination({current:p.current,pageSize:p.pageSize});refresh().catch(e=>message.error(vaultMessage(e)));}} columns={[
        {title:'名称',dataIndex:'name'},{title:'供应商',dataIndex:'provider'},{title:'类型',dataIndex:'token_type'},{title:'分类',dataIndex:'category'},
        {title:'密钥',render:()=> <Typography.Text code>••••••••</Typography.Text>},
        {title:'状态',render:(_,t)=><Tag color={t.encryption_state==='legacy_pending'?'orange':'green'}>{t.encryption_state==='legacy_pending'?<Button type="link" size="small" onClick={locateMigration}>待迁移</Button>:'已加密'}</Tag>},
        {title:'到期时间',render:(_,t)=>t.expires_at?<Typography.Text type={dayjs(t.expires_at).isBefore(dayjs())?'danger':undefined}>{dayjs(t.expires_at).format('YYYY-MM-DD')}</Typography.Text>:'永不过期'},
        {title:'操作',render:(_,t)=><Space wrap>
          <Button disabled={busy||state!=='unlocked'||t.encryption_state!=='client_encrypted'||!t.has_secret} onClick={()=>run(op=>show(t,'view',op))}>查看</Button>
          <Button disabled={busy||state!=='unlocked'||t.encryption_state!=='client_encrypted'||!t.has_secret} onClick={()=>run(op=>show(t,'copy',op))}>复制</Button>
          <Button disabled={busy||!flow.ready||!flow.data?.operations.edit_metadata.allowed} onClick={()=>edit(t)}>编辑</Button>
          <Popconfirm title="删除此记录？" description="删除后不会清除已复制的剪贴板内容。" onConfirm={()=>run(async op=>{await deleteToken(t,op.signal);op.guard();await refresh();op.guard();message.success('删除成功');})}><Button danger disabled={busy||!flow.ready||!flow.data?.operations.delete_token.allowed}>删除</Button></Popconfirm>
        </Space>},
      ]}/>
    </Card>
    <Modal title={editing?'编辑密钥':'新增密钥'} open={open} onCancel={close} onOk={()=>run(submit)} confirmLoading={busy} cancelButtonProps={{disabled:busy}} closable={!busy} maskClosable={!busy} keyboard={!busy} destroyOnHidden>
      <Typography.Paragraph type="secondary">名称、供应商、分类和备注为明文，请勿填写秘密。</Typography.Paragraph>
      <Form form={form} layout="vertical" preserve={false} autoComplete="off">
        <Form.Item name="provider" label="供应商" rules={[{required:true,whitespace:true},{max:50}]}><Input disabled={busy}/></Form.Item>
        <Form.Item name="name" label="名称" rules={[{required:true,whitespace:true},{max:100}]}><Input disabled={busy}/></Form.Item>
        <Form.Item name="secret" label={editing?'替换密钥（留空保留）':'业务密钥'}><Input.Password autoComplete="off" disabled={busy||state!=='unlocked'||editing?.encryption_state==='legacy_pending'||!flow.ready||(!!editing&&!flow.data?.operations.replace_secret.allowed)}/></Form.Item>
        <Form.Item name="token_type" label="类型" rules={[{max:50}]}><Input disabled={busy}/></Form.Item>
        <Form.Item name="category" label="分类" rules={[{max:50}]}><Input disabled={busy}/></Form.Item>
        <Checkbox disabled={busy} checked={never} onChange={e=>setNever(e.target.checked)}>清空到期时间（永不过期）</Checkbox>
        {!never&&<Form.Item name="expires_at" label={editing?'新到期时间（不选则保留）':'到期时间'}><DatePicker showTime disabled={busy}/></Form.Item>}
        <Form.Item name="remark" label="备注（请勿填写秘密）" rules={[{validator:(_,v)=>!v||utf8(v).length<=4096?Promise.resolve():Promise.reject(new Error('备注最多4096字节'))}]}><Input.TextArea disabled={busy}/></Form.Item>
      </Form>
    </Modal>
    <Modal open={!!visible||copyReady} title={copyReady?'确认复制':'密钥（30秒后隐藏）'} onCancel={clearDisplay} footer={copyReady?<Button loading={busy} onClick={confirmCopy}>确认复制</Button>:<Button onClick={clearDisplay}>隐藏</Button>} destroyOnHidden>
      {visible?<Typography.Paragraph style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{visible}</Typography.Paragraph>:<Typography.Paragraph>再次点击以授权剪贴板写入，内容不会在此显示。</Typography.Paragraph>}
    </Modal>
  </Space>;
}
