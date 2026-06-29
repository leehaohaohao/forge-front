import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Popconfirm,
  Tag,
  Tooltip,
  Typography,
  Modal,
  Input,
  Form,
  App,
} from 'antd';
import {
  DeleteOutlined,
  MinusCircleOutlined,
  LinkOutlined,
  CopyOutlined,
  PlusOutlined,
  FolderAddOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useQuickLinkStore } from '@/stores/quickLinks';
import { useSettingsStore } from '@/stores/settings';
import AddLinkModal from '@/components/quick-link/AddLinkModal';
import type { QuickLink } from '@/types/quickLink';

const { Text } = Typography;

export default function QuickLinkPage() {
  const { message } = App.useApp();
  const openInNewTab = useSettingsStore((s) => s.settings.quickLink.openInNewTab);
  const togglePanelShortcut = useSettingsStore((s) => s.settings.shortcuts.togglePanel);
  const {
    workspaces,
    links,
    loading,
    currentWorkspaceId,
    fetchWorkspaces,
    fetchLinks,
    setCurrentWorkspace,
    deleteLink,
    removeLinkFromWorkspace,
    batchAssignWorkspace,
    deleteWorkspace,
    createWorkspace,
  } = useQuickLinkStore();

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [targetWorkspace, setTargetWorkspace] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (currentWorkspaceId) {
      fetchLinks(currentWorkspaceId);
    }
  }, [currentWorkspaceId]);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId],
  );

  const isDefault = currentWorkspace?.is_default ?? false;

  const otherWorkspaces = useMemo(
    () => workspaces.filter((w) => w.id !== currentWorkspaceId),
    [workspaces, currentWorkspaceId],
  );

  const handleRemove = async (link: QuickLink) => {
    if (!currentWorkspaceId) return;
    try {
      await removeLinkFromWorkspace(link.id, currentWorkspaceId);
      message.success('已移除');
    } catch {
      message.error('移除失败');
    }
  };

  const handleDeleteLink = async (id: number) => {
    try {
      await deleteLink(id);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handleBatchAssign = async () => {
    if (!targetWorkspace || selectedRowKeys.length === 0) return;
    setAssigning(true);
    try {
      await batchAssignWorkspace(selectedRowKeys, targetWorkspace);
      const wsName = workspaces.find((w) => w.id === targetWorkspace)?.name || '';
      message.success(`已分配 ${selectedRowKeys.length} 个链接到「${wsName}」`);
      setSelectedRowKeys([]);
      setTargetWorkspace(null);
    } catch {
      message.error('分配失败');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    try {
      await deleteWorkspace(id);
      message.success('工作区已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handleAddWorkspace = async () => {
    const name = workspaceName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createWorkspace(name);
      message.success('工作区创建成功');
      setAddWorkspaceOpen(false);
      await fetchWorkspaces();
    } catch {
      message.error('创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setDeleting(true);
    try {
      if (isDefault) {
        await Promise.all(selectedRowKeys.map((id) => deleteLink(id)));
      } else {
        await Promise.all(selectedRowKeys.map((id) => removeLinkFromWorkspace(id, currentWorkspaceId!)));
      }
      message.success(`已删除 ${selectedRowKeys.length} 个链接`);
      setSelectedRowKeys([]);
    } catch {
      message.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      message.success('已复制');
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      message.success('已复制');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: QuickLink) => (
        <Space style={{ cursor: 'pointer' }} onClick={() => window.open(record.url, openInNewTab ? '_blank' : '_self')}>
          <LinkOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ color: '#1677ff' }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (text: string) => (
        <Space>
          <Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
            {text}
          </Text>
          <Tooltip title="复制">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(text)} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (text: string) => text ? <Tag>{text}</Tag> : '-',
    },
    {
      title: '所属工作区',
      dataIndex: 'workspaces',
      key: 'workspaces',
      width: 200,
      render: (wsIds: number[]) => (
        <Space size={[0, 4]} wrap>
          {wsIds.map((id) => {
            const ws = workspaces.find((w) => w.id === id);
            return (
              <Tag key={id} color={ws?.is_default ? 'blue' : 'default'}>
                {ws?.name || id}
              </Tag>
            );
          })}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: QuickLink) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditingLink(record); setAddLinkOpen(true); }} />
          </Tooltip>
          {isDefault ? (
            <Popconfirm title="删除后不可恢复，确定删除？" onConfirm={() => handleDeleteLink(record.id)}>
              <Tooltip title="删除">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          ) : (
            <Popconfirm title="确定从此工作区移除？" onConfirm={() => handleRemove(record)}>
              <Tooltip title="移除此工作区">
                <Button type="text" danger icon={<MinusCircleOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = workspaces.map((w) => ({
    key: String(w.id),
    label: (
      <span>
        {w.name}
        {w.is_default ? ' (默认)' : ''}
      </span>
    ),
  }));

  return (
    <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
      {/* Workspace Tabs */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Text strong style={{ fontSize: 16 }}>
              快捷链接管理
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              按 {togglePanelShortcut} 快速打开链接面板
            </Text>
          </Space>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditingLink(null); setAddLinkOpen(true); }}>
              添加链接
            </Button>
            <Button icon={<FolderAddOutlined />} size="small" onClick={() => { setWorkspaceName(''); setAddWorkspaceOpen(true); }}>
              添加工作区
            </Button>
            {!isDefault && currentWorkspaceId && (
              <Popconfirm
                title="删除工作区将解除所有关联，链接本身保留，确定？"
                onConfirm={() => handleDeleteWorkspace(currentWorkspaceId)}
              >
                <Button danger size="small">
                  删除此工作区
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>
        <Space>
          {tabItems.map((tab) => (
            <Button
              key={tab.key}
              type={String(currentWorkspaceId) === tab.key ? 'primary' : 'default'}
              size="small"
              onClick={() => setCurrentWorkspace(Number(tab.key))}
            >
              {tab.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* Batch Action Bar */}
      {selectedRowKeys.length > 0 && (
        <div style={{ padding: '8px 24px', background: '#e6f4ff', borderBottom: '1px solid #91caff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text>已选 {selectedRowKeys.length} 项</Text>
          <Select
            placeholder="选择目标工作区"
            style={{ width: 180 }}
            value={targetWorkspace}
            onChange={setTargetWorkspace}
            options={otherWorkspaces.map((w) => ({ value: w.id, label: w.name }))}
          />
          <Button type="primary" size="small" loading={assigning} disabled={!targetWorkspace} onClick={handleBatchAssign}>
            批量分配
          </Button>
          <Popconfirm
            title={isDefault ? '删除后不可恢复，确定删除选中项？' : '确定从当前工作区移除选中项？'}
            onConfirm={handleBatchDelete}
          >
            <Button danger size="small" loading={deleting}>
              批量删除
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>
            取消选择
          </Button>
        </div>
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={links}
        rowKey="id"
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        pagination={false}
        locale={{ emptyText: '该工作区暂无链接' }}
        style={{ padding: '0 24px' }}
      />

      <AddLinkModal
        open={addLinkOpen}
        onClose={() => { setAddLinkOpen(false); setEditingLink(null); }}
        editingLink={editingLink}
      />
      <Modal
        title="添加工作区"
        open={addWorkspaceOpen}
        onOk={handleAddWorkspace}
        onCancel={() => setAddWorkspaceOpen(false)}
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="工作区名称" required>
            <Input
              placeholder="输入工作区名称"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onPressEnter={handleAddWorkspace}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
