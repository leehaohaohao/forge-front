import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Breadcrumb,
  Typography,
  App,
  Popconfirm,
  Tag,
  Tooltip,
  Empty,
  List,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
  FolderOutlined,
  FolderAddOutlined,
  FileTextOutlined,
  PushpinOutlined,
  SendOutlined,
  StopOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKnowledgeStore } from '@/stores/knowledge';
import type { Space as SpaceType, Folder, Document } from '@/types/knowledge';

const { Text } = Typography;

export default function KnowledgeSpacePage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    spaces,
    currentSpaceId,
    folders,
    currentFolderId,
    documents,
    loading,
    pagination,
    fetchSpaces,
    createSpace,
    updateSpace,
    deleteSpace,
    setCurrentSpace,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    setCurrentFolder,
    fetchDocuments,
    fetchRootDocuments,
    deleteDocument,
    publishDocument,
    unpublishDocument,
    pinDocument,
    setPagination,
  } = useKnowledgeStore();

  const [spaceModalOpen, setSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<SpaceType | null>(null);
  const [spaceForm] = Form.useForm();

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderForm] = Form.useForm();

  useEffect(() => {
    setCurrentSpace(null);
  }, [location.pathname]);

  const currentSpace = useMemo(() => spaces.find((s) => s.id === currentSpaceId), [spaces, currentSpaceId]);

  // ========== 空间操作 ==========

  const handleAddSpace = () => {
    setEditingSpace(null);
    spaceForm.resetFields();
    setSpaceModalOpen(true);
  };

  const handleEditSpace = (space: SpaceType) => {
    setEditingSpace(space);
    spaceForm.setFieldsValue(space);
    setSpaceModalOpen(true);
  };

  const handleSpaceSubmit = async () => {
    try {
      const values = await spaceForm.validateFields();
      if (editingSpace) {
        await updateSpace(editingSpace.id, values);
        message.success('更新成功');
      } else {
        await createSpace(values);
        message.success('创建成功');
      }
      setSpaceModalOpen(false);
    } catch {
      // validation failed
    }
  };

  const handleDeleteSpace = async (id: number) => {
    try {
      await deleteSpace(id);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  // ========== 文件夹操作 ==========

  const handleAddFolder = () => {
    setEditingFolder(null);
    folderForm.resetFields();
    setFolderModalOpen(true);
  };

  const handleEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
    folderForm.setFieldsValue(folder);
    setFolderModalOpen(true);
  };

  const handleFolderSubmit = async () => {
    if (!currentSpaceId) return;
    try {
      const values = await folderForm.validateFields();
      if (editingFolder) {
        await updateFolder(editingFolder.id, values);
        message.success('更新成功');
      } else {
        await createFolder(currentSpaceId, values);
        message.success('创建成功');
      }
      setFolderModalOpen(false);
    } catch {
      // validation failed
    }
  };

  const handleDeleteFolder = async (id: number) => {
    try {
      await deleteFolder(id);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  // ========== 文档操作 ==========

  const handleDeleteDocument = async (id: number) => {
    try {
      await deleteDocument(id);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handlePublish = async (doc: Document) => {
    try {
      if (doc.status === 1) {
        await unpublishDocument(doc.id);
        message.success('已取消发布');
      } else {
        await publishDocument(doc.id);
        message.success('已发布');
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handlePin = async (id: number) => {
    try {
      await pinDocument(id);
      message.success('操作成功');
    } catch {
      message.error('操作失败');
    }
  };

  // ========== 面包屑 ==========

  const breadcrumbItems = useMemo(() => {
    const items: { title: React.ReactNode; onClick: () => void }[] = [
      { title: <HomeOutlined />, onClick: () => setCurrentSpace(null) },
    ];
    if (currentSpace) {
      items.push({ title: <span>{currentSpace.name}</span>, onClick: () => setCurrentFolder(null) });
    }
    if (currentFolderId) {
      const folder = folders.find((f) => f.id === currentFolderId);
      if (folder) items.push({ title: <span>{folder.name}</span>, onClick: () => {} });
    }
    return items;
  }, [currentSpace, currentFolderId, folders]);

  // ========== 文档列表列 ==========

  const docColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Document) => (
        <Space style={{ cursor: 'pointer' }} onClick={() => navigate(`/knowledge/document/${record.id}`)}>
          {record.is_pinned && <PushpinOutlined style={{ color: '#faad14' }} />}
          <FileTextOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ color: '#1677ff' }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: string[]) => (
        <Space size={[0, 4]} wrap>
          {tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => {
        const map: Record<number, { color: string; text: string }> = {
          0: { color: 'default', text: '草稿' },
          1: { color: 'green', text: '已发布' },
          2: { color: 'orange', text: '已归档' },
        };
        const s = map[status] || map[0];
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 80,
      render: (v: number) => (v === 1 ? <Tag color="blue">公开</Tag> : <Tag>私有</Tag>),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: Document) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/knowledge/document/${record.id}/edit`)} />
          </Tooltip>
          <Tooltip title={record.status === 1 ? '取消发布' : '发布'}>
            <Button type="text" icon={record.status === 1 ? <StopOutlined /> : <SendOutlined />} onClick={() => handlePublish(record)} />
          </Tooltip>
          <Tooltip title={record.is_pinned ? '取消置顶' : '置顶'}>
            <Button type="text" icon={<PushpinOutlined style={record.is_pinned ? { color: '#faad14' } : {}} />} onClick={() => handlePin(record.id)} />
          </Tooltip>
          <Popconfirm title="删除后不可恢复，确定？" onConfirm={() => handleDeleteDocument(record.id)}>
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 'calc(100vh - 180px)' }}>
      {/* 左侧空间列表 */}
      <Card
        style={{ width: 240, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flexShrink: 0 }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>我的空间</Text>
          <Button type="text" icon={<PlusOutlined />} size="small" onClick={handleAddSpace} />
        </div>
        <div style={{ padding: 8 }}>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              background: currentSpaceId === null ? '#e6f4ff' : 'transparent',
              marginBottom: 4,
            }}
            onClick={() => setCurrentSpace(null)}
          >
            <HomeOutlined style={{ marginRight: 8 }} />
            <Text>根目录</Text>
          </div>
          {spaces.map((space) => (
            <div
              key={space.id}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: currentSpaceId === space.id ? '#e6f4ff' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onClick={() => setCurrentSpace(space.id)}
            >
              <Text ellipsis style={{ flex: 1 }}>{space.name}</Text>
              <Space size={0}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEditSpace(space); }} />
                <Popconfirm title="确定删除？" onConfirm={() => handleDeleteSpace(space.id)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
              </Space>
            </div>
          ))}
          {spaces.length === 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>暂无空间，点击上方 + 创建</Text>
            </div>
          )}
        </div>
      </Card>

      {/* 右侧内容区 */}
      <div style={{ flex: 1 }}>
        <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
          {/* 面包屑 + 操作栏 */}
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Breadcrumb items={breadcrumbItems} />
              <Space>
                {currentSpaceId && !currentFolderId && (
                  <Button icon={<FolderAddOutlined />} size="small" onClick={handleAddFolder}>
                    新建文件夹
                  </Button>
                )}
                <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => navigate('/knowledge/document/new')}>
                  新建文档
                </Button>
              </Space>
            </div>
          </div>

          {/* 文件夹列表 */}
          {currentSpaceId && !currentFolderId && folders.length > 0 && (
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>文件夹</Text>
              <Space size={[8, 8]} wrap>
                {folders.map((folder) => (
                  <Card
                    key={folder.id}
                    hoverable
                    size="small"
                    style={{ width: 160, cursor: 'pointer' }}
                    styles={{ body: { padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }}
                    onClick={() => setCurrentFolder(folder.id)}
                  >
                    <Space>
                      <FolderOutlined style={{ color: '#faad14' }} />
                      <Text ellipsis style={{ maxWidth: 80 }}>{folder.name}</Text>
                    </Space>
                    <Space size={0}>
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }} />
                      <Popconfirm title="确定删除？" onConfirm={() => handleDeleteFolder(folder.id)}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                      </Popconfirm>
                    </Space>
                  </Card>
                ))}
              </Space>
            </div>
          )}

          {/* 文档列表 */}
          <Table
            columns={docColumns}
            dataSource={documents}
            rowKey="id"
            loading={loading}
            pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            onChange={(p) => {
              setPagination({ current: p.current, pageSize: p.pageSize });
              if (currentFolderId) {
                fetchDocuments({ folder_id: currentFolderId });
              } else if (currentSpaceId) {
                fetchDocuments({ space_id: currentSpaceId });
              } else {
                fetchRootDocuments();
              }
            }}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文档" />,
            }}
            style={{ padding: '0 24px' }}
          />
        </Card>
      </div>

      {/* 空间弹窗 */}
      <Modal
        title={editingSpace ? '编辑空间' : '新建空间'}
        open={spaceModalOpen}
        onOk={handleSpaceSubmit}
        onCancel={() => setSpaceModalOpen(false)}
        destroyOnHidden
      >
        <Form form={spaceForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入空间名称' }]}>
            <Input placeholder="如：技术笔记" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
          <Form.Item name="icon" label="图标标识">
            <Input placeholder="可选，如 folder" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件夹弹窗 */}
      <Modal
        title={editingFolder ? '编辑文件夹' : '新建文件夹'}
        open={folderModalOpen}
        onOk={handleFolderSubmit}
        onCancel={() => setFolderModalOpen(false)}
        destroyOnHidden
      >
        <Form form={folderForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="文件夹名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：Go 语言" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
