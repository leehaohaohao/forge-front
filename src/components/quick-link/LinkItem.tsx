import { Typography } from 'antd';

const { Text } = Typography;

interface LinkItemProps {
  name: string;
  url: string;
  selected: boolean;
  onClick: () => void;
}

export default function LinkItem({ name, url, selected, onClick }: LinkItemProps) {
  const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const firstChar = name.charAt(0).toUpperCase();

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '12px 8px',
        borderRadius: 8,
        cursor: 'pointer',
        background: selected ? '#e6f4ff' : '#fafafa',
        border: selected ? '1px solid #91caff' : '1px solid #f0f0f0',
        transition: 'all 0.15s',
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = '#f0f5ff';
          e.currentTarget.style.borderColor = '#b7d4ff';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = '#fafafa';
          e.currentTarget.style.borderColor = '#f0f0f0';
        }
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: '#1677ff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {firstChar}
      </div>
      <Text strong style={{ fontSize: 13, textAlign: 'center', lineHeight: 1.2 }} ellipsis={{ tooltip: name }}>
        {name}
      </Text>
      <Text type="secondary" style={{ fontSize: 11 }} ellipsis={{ tooltip: displayUrl }}>
        {displayUrl}
      </Text>
    </div>
  );
}
