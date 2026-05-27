import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
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
import { getTokens, createToken, updateToken, deleteToken } from '@/services/token';
import dayjs from 'dayjs';

const { Text } = Typography;

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', color: '#10a37f' },
  { value: 'anthropic', label: 'Anthropic', color: '#d4a574' },
  { value: 'google', label: 'Google', color: '#4285f4' },
  { value: 'azure', label: 'Azure', color: '#0078d4' },
  { value: 'other', label: '其他', color: '#8c8c8c' },
];
const GROUPS = ['默认', '生产', '测试', '开发'];
const TOKEN_TYPES = ['API Key', 'Access Token', 'Refresh Token'];

export default function TokenPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const fetchTokens = async (params?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await getTokens({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...params,
      });
      setTokens(res.data);
      setPagination((prev) => ({ ...prev, total: res.total }));
    } catch {
      message.error('获取Token列表失败');
    } finally {
      setLoading(false);
    }
  };

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
    form.setFieldsValue({
      ...record,
      expires_at: record.expires_at ? dayjs(record.expires_at) : undefined,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteToken(id);
      message.success('删除成功');
      fetchTokens();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data: TokenFormValues = {
        ...values,
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
      fetchTokens();
    } catch {
      message.error('操作失败');
    }
  };

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    setPagination((prev) => ({ ...prev, current: 1 }));
    fetchTokens(values);
  };

  const handleReset = () => {
    searchForm.resetFields();
    setPagination((prev) => ({ ...prev, current: 1 }));
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
      title: 'Token',
      dataIndex: 'token_value',
      key: 'token_value',
      render: (text: string) => (
        <Space>
          <Text
            code
            style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {text.substring(0, 6)}...{text.substring(text.length - 4)}
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
      title: '分组',
      dataIndex: 'group_name',
      key: 'group_name',
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
    <Card
      style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>Token 管理</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增
          </Button>
        </div>
        <Form form={searchForm} layout="inline">
          <Form.Item name="keyword">
            <Input
              placeholder="搜索名称"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
            />
          </Form.Item>
          <Form.Item name="provider">
            <Select placeholder="供应商" allowClear style={{ width: 120 }}>
              {PROVIDERS.map((p) => (
                <Select.Option key={p.value} value={p.value}>
                  {p.label}
                </Select.Option>
              ))}
            </Select>
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
          setPagination((prev) => ({ ...prev, current: p.current, pageSize: p.pageSize }));
          fetchTokens();
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: '#8c8c8c' }}>
                  还没有Token，点击上方「新增」添加第一个
                </span>
              }
            />
          ),
        }}
        style={{ padding: '0 24px' }}
      />

      <Modal
        title={editingToken ? '编辑Token' : '新增Token'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="provider"
            label="供应商"
            rules={[{ required: true, message: '请选择供应商' }]}
          >
            <Select placeholder="选择供应商">
              {PROVIDERS.map((p) => (
                <Select.Option key={p.value} value={p.value}>
                  <Space>
                    <span style={{ color: p.value }}>{p.label}</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：GPT-4 Key" />
          </Form.Item>
          <Form.Item
            name="token_value"
            label="Token值"
            rules={[{ required: true, message: '请输入Token值' }]}
          >
            <Input.TextArea rows={2} placeholder="sk-..." />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="group_name" label="分组" style={{ width: 240 }}>
              <Select placeholder="选择分组" allowClear>
                {GROUPS.map((g) => (
                  <Select.Option key={g} value={g}>
                    {g}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="token_type" label="类型" style={{ width: 240 }}>
              <Select placeholder="选择类型" allowClear>
                {TOKEN_TYPES.map((t) => (
                  <Select.Option key={t} value={t}>
                    {t}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
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
