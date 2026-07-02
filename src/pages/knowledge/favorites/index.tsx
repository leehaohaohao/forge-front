import { useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, App, Empty, Button, Popconfirm } from 'antd';
import { EyeOutlined, LikeOutlined, StarOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeStore } from '@/stores/knowledge';
import { unfavoriteDocument } from '@/services/knowledge';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function KnowledgeFavoritesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const {
    documents,
    loading,
    pagination,
    fetchFavoriteDocuments,
    setPagination,
  } = useKnowledgeStore();

  useEffect(() => {
    fetchFavoriteDocuments();
  }, []);

  const handleUnfavorite = async (id: number) => {
    try {
      await unfavoriteDocument(id);
      message.success('已取消收藏');
      fetchFavoriteDocuments();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: { id: number }) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/knowledge/document/${record.id}`)}>
          {text}
        </Button>
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
      title: '浏览',
      dataIndex: 'view_count',
      key: 'view_count',
      width: 80,
      render: (v: number) => <Text type="secondary"><EyeOutlined style={{ marginRight: 4 }} />{v}</Text>,
    },
    {
      title: '点赞',
      dataIndex: 'like_count',
      key: 'like_count',
      width: 80,
      render: (v: number) => <Text type="secondary"><LikeOutlined style={{ marginRight: 4 }} />{v}</Text>,
    },
    {
      title: '收藏时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: { id: number }) => (
        <Popconfirm title="确定取消收藏？" onConfirm={() => handleUnfavorite(record.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Space>
          <StarOutlined style={{ color: '#faad14' }} />
          <Text strong style={{ fontSize: 16 }}>我的收藏</Text>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={documents}
        rowKey="id"
        loading={loading}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        onChange={(p) => {
          setPagination({ current: p.current, pageSize: p.pageSize });
          fetchFavoriteDocuments();
        }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无收藏" /> }}
        style={{ padding: '0 24px' }}
      />
    </Card>
  );
}
