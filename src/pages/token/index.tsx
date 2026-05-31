import { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  DatePicker,
  App,
  Popconfirm,
  Card,
  Empty,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CopyOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import type { Token, TokenFormValues } from '@/types/token';
import { useTokenStore } from '@/stores/tokens';
import dayjs from 'dayjs';

const { Text } = Typography;

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', color: '#10a37f' },
  { value: 'anthropic', label: 'Anthropic', color: '#d4a574' },
  { value: 'github', label: 'GitHub', color: '#333333' },
  { value: 'aws', label: 'AWS', color: '#ff9900' },
  { value: 'azure', label: 'Azure', color: '#0078d4' },
  { value: 'other', label: '其他', color: '#8c8c8c' },
];
const TOKEN_TYPES = ['coding', 'billing', 'access', 'infra'];
const CATEGORIES = ['密钥', '凭证', '证书', '其他'];

function mergeOptions(hardcoded: string[], fromData: (string | null | undefined)[]) {
  const unique = new Set([...hardcoded, ...fromData.filter(Boolean)]);
  return Array.from(unique).map((v) => ({ value: v, label: v }));
}

export default function TokenPage() {
  const { message } = App.useApp();
  const { tokens, loading, pagination, fetchTokens, createToken, updateToken, deleteToken, setPagination } =
    useTokenStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  const providerOptions = useMemo(() => {
    const hardcoded = PROVIDERS.map((p) => p.value);
    return mergeOptions(hardcoded, tokens.map((t) => t.provider));
  }, [tokens]);

  const typeOptions = useMemo(() => {
    return mergeOptions(TOKEN_TYPES, tokens.map((t) => t.token_type));
  }, [tokens]);

  const categoryOptions = useMemo(() => {
    return mergeOptions(CATEGORIES, tokens.map((t) => t.category));
  }, [tokens]);

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleAdd = () => {
    setEditingToken(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Token) => {
    setEditingToken(record);
    const wrapTags = (v: string | null | undefined) => (v ? [v] : undefined);
    form.setFieldsValue({
      ...record,
      provider: wrapTags(record.provider),
      token_type: wrapTags(record.token_type),
      category: wrapTags(record.category),
      expires_at: record.expires_at ? dayjs(record.expires_at) : undefined,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteToken(id);
      message.success('删除成功');
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const unwrapTags = (v: unknown) => (Array.isArray(v) ? v[0] : v);
      const data: TokenFormValues = {
        ...values,
        provider: unwrapTags(values.provider),
        token_type: unwrapTags(values.token_type),
        category: unwrapTags(values.category),
        expires_at: values.expires_at?.toISOString(),
      };

      if (editingToken) {
        await updateToken(editingToken.id, data);
        message.success('更新成功');
      } else {
        await createToken(data);
        message.success('创建成功');
      }

      setModalOpen(false);
    } catch {
      message.error('操作失败');
    }
  };

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    setPagination({ current: 1 });
    fetchTokens(values);
  };

  const handleReset = () => {
    searchForm.resetFields();
    setPagination({ current: 1 });
    fetchTokens();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制');
  };

  const getProviderColor = (provider: string) => {
    return PROVIDERS.find((p) => p.value === provider)?.color || '#8c8c8c';
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Token) => (
        <Space>
          <KeyOutlined style={{ color: getProviderColor(record.provider) }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'provider',
      key: 'provider',
      width: 120,
      render: (text: string) => (
        <Tag color={getProviderColor(text)} style={{ borderRadius: 4 }}>
          {PROVIDERS.find((p) => p.value === text)?.label || text}
        </Tag>
      ),
    },
    {
      title: '密钥值',
      dataIndex: 'token_value',
      key: 'token_value',
      render: (text: string, record: Token) => (
        <Space>
          <Text code style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {text.substring(0, record.mask_prefix_len || 6)}...
            {text.substring(text.length - (record.mask_suffix_len || 6))}
          </Text>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(text)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'token_type',
      key: 'token_type',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '种类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 160,
      render: (text: string | null) => {
        if (!text) return <Text type="secondary">永不过期</Text>;
        const isExpired = dayjs(text).isBefore(dayjs());
        return (
          <Text type={isExpired ? 'danger' : undefined}>
            {dayjs(text).format('YYYY-MM-DD')}
          </Text>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Token) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            密钥管理
          </Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增
          </Button>
        </div>
        <Form form={searchForm} layout="inline">
          <Form.Item name="keyword">
            <Input placeholder="搜索名称" prefix={<SearchOutlined />} style={{ width: 200 }} allowClear />
          </Form.Item>
          <Form.Item name="provider">
            <Select
              placeholder="供应商"
              allowClear
              style={{ width: 120 }}
              options={providerOptions}
              showSearch
              popupMatchSelectWidth={false}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <Table
        columns={columns}
        dataSource={tokens}
        rowKey="id"
        loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        onChange={(p) => {
          setPagination({ current: p.current, pageSize: p.pageSize });
          fetchTokens();
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: '#8c8c8c' }}>还没有密钥，点击上方「新增」添加第一个</span>
              }
            />
          ),
        }}
        style={{ padding: '0 24px' }}
      />

      <Modal
        title={editingToken ? '编辑密钥' : '新增密钥'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="provider"
            label="供应商"
            rules={[{ required: true, message: '请输入或选择供应商' }]}
          >
            <Select placeholder="输入或选择供应商" options={providerOptions} showSearch mode="tags" maxCount={1} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：GPT-4 Key" />
          </Form.Item>
          <Form.Item
            name="token_value"
            label="密钥值"
            rules={[{ required: true, message: '请输入密钥值' }]}
            normalize={(value) => value?.trim()}
          >
            <Input.TextArea rows={2} placeholder="sk-..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="token_type" label="类型">
                <Select
                  placeholder="输入或选择类型"
                  options={typeOptions}
                  showSearch
                  mode="tags"
                  maxCount={1}
                  allowClear
                  popupMatchSelectWidth={false}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="种类">
                <Select
                  placeholder="输入或选择种类"
                  options={categoryOptions}
                  showSearch
                  mode="tags"
                  maxCount={1}
                  allowClear
                  popupMatchSelectWidth={false}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="mask_prefix_len" label="前缀展示长度" initialValue={6}>
                <InputNumber min={0} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mask_suffix_len" label="后缀展示长度" initialValue={6}>
                <InputNumber min={0} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="expires_at" label="过期时间">
            <DatePicker showTime style={{ width: '100%' }} placeholder="留空则永不过期" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
