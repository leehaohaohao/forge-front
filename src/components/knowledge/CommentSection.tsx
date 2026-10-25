import { useState } from 'react';
import { List, Input, Button, Space, Avatar, Typography, Popconfirm, App } from 'antd';
import { DeleteOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { useKnowledgeStore } from '@/stores/knowledge';
import { useAuthStore } from '@/stores/auth';
import dayjs from 'dayjs';
import type { Comment } from '@/types/knowledge';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface CommentSectionProps {
  documentId: number;
}

export default function CommentSection({ documentId }: CommentSectionProps) {
  const { message } = App.useApp();
  const { comments, fetchComments, createComment, deleteComment } = useKnowledgeStore();
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; userId: number; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await createComment(documentId, {
        content: text,
        parent_id: replyTo?.id,
        reply_to_user_id: replyTo?.userId,
      });
      setContent('');
      setReplyTo(null);
      message.success('评论成功');
    } catch {
      message.error('评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteComment(id);
      await fetchComments(documentId);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const renderComment = (comment: Comment) => (
    <List.Item
      key={comment.id}
      style={{ padding: '12px 0' }}
      actions={
        user?.id === comment.user_id
          ? [
              <Popconfirm key="del" title="确定删除？" onConfirm={() => handleDelete(comment.id)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]
          : undefined
      }
    >
      <List.Item.Meta
        avatar={<Avatar icon={<UserOutlined />} size="small" />}
        title={
          <Space size={8}>
            <Text strong style={{ fontSize: 13 }}>用户 {comment.user_id}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(comment.created_at).format('MM-DD HH:mm')}
            </Text>
          </Space>
        }
        description={
          <div>
            {comment.reply_to_user_id && (
              <Text type="secondary" style={{ fontSize: 12 }}>回复 用户 {comment.reply_to_user_id}：</Text>
            )}
            <Paragraph style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{comment.content}</Paragraph>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 12 }}
              onClick={() => setReplyTo({ id: comment.id, userId: comment.user_id, name: `用户 ${comment.user_id}` })}
            >
              回复
            </Button>
          </div>
        }
      />
    </List.Item>
  );

  return (
    <div>
      <Text strong style={{ fontSize: 15, marginBottom: 16, display: 'block' }}>
        评论 ({comments.length})
      </Text>

      {replyTo && (
        <div style={{ marginBottom: 8, padding: '6px 12px', background: '#f5f5f5', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>回复 {replyTo.name}</Text>
          <Button type="text" size="small" onClick={() => setReplyTo(null)}>取消</Button>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <TextArea
          rows={3}
          placeholder="写下你的评论..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPressEnter={(e) => {
            if (e.ctrlKey || e.metaKey) handleSubmit();
          }}
        />
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <Button type="primary" icon={<SendOutlined />} loading={submitting} disabled={!content.trim()} onClick={handleSubmit}>
            发表评论
          </Button>
        </div>
      </div>

      <List
        dataSource={comments}
        renderItem={renderComment}
        locale={{ emptyText: '暂无评论' }}
        split={false}
      />
    </div>
  );
}
