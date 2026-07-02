import { useEffect, useState } from 'react';
import { Card, Button, Space, Tag, Typography, Divider, App } from 'antd';
import {
  ArrowLeftOutlined,
  LikeOutlined,
  LikeFilled,
  StarOutlined,
  StarFilled,
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useKnowledgeStore } from '@/stores/knowledge';
import { favoriteDocument, unfavoriteDocument } from '@/services/knowledge';
import MarkdownViewer from '@/components/knowledge/MarkdownViewer';
import CommentSection from '@/components/knowledge/CommentSection';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function DocumentViewPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    currentDocument: doc,
    isLiked,
    isFavorited,
    fetchDocument,
    likeDocument,
    unlikeDocument,
    fetchComments,
    clearDocument,
  } = useKnowledgeStore();

  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (id) {
      fetchDocument(Number(id)).then((d) => {
        setLikeCount(d.like_count);
      });
      fetchComments(Number(id));
    }
    return () => clearDocument();
  }, [id]);

  const handleLike = async () => {
    if (!id) return;
    try {
      if (isLiked) {
        await unlikeDocument(Number(id));
        setLikeCount((c) => c - 1);
      } else {
        await likeDocument(Number(id));
        setLikeCount((c) => c + 1);
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleFavorite = async () => {
    if (!id) return;
    try {
      if (isFavorited) {
        await unfavoriteDocument(Number(id));
        message.success('已取消收藏');
      } else {
        await favoriteDocument(Number(id));
        message.success('已收藏');
      }
    } catch {
      message.error('操作失败');
    }
  };

  if (!doc) return null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }} styles={{ body: { padding: '12px 24px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/knowledge/document/${id}/edit`)}>
              编辑
            </Button>
          </Space>
        </div>
      </Card>

      <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: '32px 48px' } }}>
        {/* 标题 */}
        <Title level={2} style={{ marginBottom: 16 }}>{doc.title}</Title>

        {/* 元信息 */}
        <div style={{ marginBottom: 24 }}>
          <Space size={16} wrap>
            <Text type="secondary">
              {dayjs(doc.published_at || doc.updated_at).format('YYYY-MM-DD HH:mm')}
            </Text>
            <Text type="secondary">
              <EyeOutlined style={{ marginRight: 4 }} />{doc.view_count} 浏览
            </Text>
            <Text type="secondary">
              {likeCount} 点赞
            </Text>
            <Text type="secondary">
              {doc.comment_count} 评论
            </Text>
          </Space>

          {doc.tags && doc.tags.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Space size={[0, 4]} wrap>
                {doc.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              </Space>
            </div>
          )}
        </div>

        <Divider />

        {/* 正文 */}
        <MarkdownViewer content={doc.content || ''} />

        <Divider />

        {/* 点赞/收藏 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 32 }}>
          <Button
            size="large"
            icon={isLiked ? <LikeFilled style={{ color: '#1677ff' }} /> : <LikeOutlined />}
            onClick={handleLike}
          >
            {isLiked ? '已点赞' : '点赞'}
          </Button>
          <Button
            size="large"
            icon={isFavorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            onClick={handleFavorite}
          >
            {isFavorited ? '已收藏' : '收藏'}
          </Button>
        </div>

        <Divider />

        {/* 评论区 */}
        <CommentSection documentId={Number(id)} />
      </Card>
    </div>
  );
}
