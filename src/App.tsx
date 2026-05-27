import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import { KeyOutlined, HomeOutlined } from '@ant-design/icons';
import TokenPage from './pages/token';

const { Content } = Layout;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: '/token', icon: <KeyOutlined />, label: <Link to="/token">Token</Link> },
];

function AppLayout() {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 56,
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff' }}>Forge</div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>
      <Content style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/token" element={<TokenPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

function HomePage() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <h1 style={{ fontSize: 32, color: '#1d1d1f', marginBottom: 8 }}>个人导航页</h1>
      <p style={{ color: '#86868b', fontSize: 16 }}>管理你的Token和服务</p>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#1677ff', borderRadius: 8 },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ConfigProvider>
  );
}
