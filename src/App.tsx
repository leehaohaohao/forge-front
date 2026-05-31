import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Layout, Menu, Button, Space, Typography, theme } from 'antd';
import { KeyOutlined, HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, UserOutlined, LinkOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useQuickLinkShortcut } from '@/hooks/useQuickLinkShortcut';
import QuickLinkPanel from '@/components/quick-link/QuickLinkPanel';
import TokenPage from './pages/token';
import QuickLinkPage from './pages/quick-link';
import HomePage from './pages/home';
import LoginPage from './pages/login';

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

const sidebarItems = [
  { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: '/token', icon: <KeyOutlined />, label: <Link to="/token">密钥管理</Link> },
  { key: '/quick-link', icon: <LinkOutlined />, label: <Link to="/quick-link">快捷链接</Link> },
];

function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, isLoggedIn, logout } = useAuthStore();
  useQuickLinkShortcut();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          zIndex: 10,
          height: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff' }}>Forge</div>
        </div>
        <Space>
          <Text type="secondary">
            <UserOutlined style={{ marginRight: 4 }} />
            {user?.username}
          </Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
            }}
          >
            退出
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={200}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: collapsed ? 'center' : 'flex-end',
              padding: '12px 16px',
              cursor: 'pointer',
            }}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={sidebarItems}
            style={{ border: 'none' }}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#f0f2f5', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/token" element={<TokenPage />} />
            <Route path="/quick-link" element={<QuickLinkPage />} />
          </Routes>
        </Content>
      </Layout>
      <Footer
        style={{
          textAlign: 'center',
          padding: '12px 24px',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          color: '#8c8c8c',
          fontSize: 13,
        }}
      >
        Forge &copy; {new Date().getFullYear()}
      </Footer>
      <QuickLinkPanel />
    </Layout>
  );
}

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#1677ff', borderRadius: 8 },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <AntApp>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
