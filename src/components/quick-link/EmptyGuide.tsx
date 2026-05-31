import { Typography, Button } from 'antd';
import { PlusOutlined, LinkOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface EmptyGuideProps {
  onAdd: () => void;
}

export default function EmptyGuide({ onAdd }: EmptyGuideProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <LinkOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">还没有快捷链接</Text>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
        添加第一个链接
      </Button>
    </div>
  );
}
