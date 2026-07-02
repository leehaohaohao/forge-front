import { Card, Tag, Space, Typography } from 'antd';
import { EyeOutlined, LikeOutlined, MessageOutlined, PushpinOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Document } from '@/types/knowledge';

const { Text, Paragraph } = Typography;

interface DocumentCardProps {
  doc: Document;
}

export default function DocumentCard({ doc }: DocumentCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      hoverable
      style={{ borderRadius: 8 }}
      styles={{ body: { padding: 16 } }}
      onClick={() => navigate(`/knowledge/document/${doc.id}`)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 16, flex: 1 }} ellipsis={{ tooltip: doc.title }}>
          {doc.is_pinned && <PushpinOutlined style={{ color: '#faad14', marginRight: 6 }} />}
          {doc.title}
        </Text>
      </div>

      {doc.summary && (
        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 12 }}>
          {doc.summary}
        </Paragraph>
      )}

      {doc.tags && doc.tags.length > 0 && (
        <Space size={[0, 4]} wrap style={{ marginBottom: 12 }}>
          {doc.tags.map((tag) => (
            <Tag key={tag} style={{ borderRadius: 4 }}>{tag}</Tag>
          ))}
        </Space>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(doc.published_at || doc.updated_at).format('YYYY-MM-DD')}
        </Text>
        <Space size={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <EyeOutlined style={{ marginRight: 4 }} />{doc.view_count}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <LikeOutlined style={{ marginRight: 4 }} />{doc.like_count}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <MessageOutlined style={{ marginRight: 4 }} />{doc.comment_count}
          </Text>
        </Space>
      </div>
    </Card>
  );
}
