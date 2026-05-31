import { useState, useEffect } from 'react';
import { Row, Col, Statistic, Spin } from 'antd';
import { KeyOutlined, FolderOutlined, LinkOutlined } from '@ant-design/icons';
import { getDashboardStats, type DashboardStats } from '@/services/dashboard';

export default function DashboardCard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    { title: '密钥', value: stats.token_count, icon: <KeyOutlined />, color: '#1677ff' },
    { title: '工作区', value: stats.workspace_count, icon: <FolderOutlined />, color: '#52c41a' },
    { title: '链接', value: stats.link_count, icon: <LinkOutlined />, color: '#722ed1' },
  ];

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 24 }}>数据概览</div>
      <Row gutter={24}>
        {items.map((item) => (
          <Col key={item.title} span={8} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, color: item.color, marginBottom: 8 }}>{item.icon}</div>
            <Statistic title={item.title} value={item.value} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
