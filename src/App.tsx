import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Layout, Menu, Button, Space, Typography, theme } from 'antd';
import { KeyOutlined, HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, UserOutlined, LinkOutlined, SettingOutlined, ReadOutlined, StarOutlined, CompassOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { useQuickLinkStore } from '@/stores/quickLinks';
import { useQuickLinkShortcut } from '@/hooks/useQuickLinkShortcut';
import QuickLinkPanel from '@/components/quick-link/QuickLinkPanel';
import TokenPage from './pages/token';
import QuickLinkPage from './pages/quick-link';
import SettingsPage from './pages/settings';
import HomePage from './pages/home';
import LoginPage from './pages/login';
import KnowledgeSpacePage from './pages/knowledge/space';
import DocumentEditPage from './pages/knowledge/document/EditPage';
import DocumentViewPage from './pages/knowledge/document/ViewPage';
import KnowledgeSquarePage from './pages/knowledge/square';
import KnowledgeFavoritesPage from './pages/knowledge/favorites';
import GlobalSearch from './components/knowledge/GlobalSearch';

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

const sidebarItems = [
  { key: '/app', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: '/app/token', icon: <KeyOutlined />, label: <Link to="/token">密钥管理</Link> },
  { key: '/app/quick-link', icon: <LinkOutlined />, label: <Link to="/quick-link">快捷链接</Link> },
  { key: '/app/knowledge', icon: <ReadOutlined />, label: <Link to="/knowledge">知识中心</Link> },
  { key: '/app/knowledge/square', icon: <CompassOutlined />, label: <Link to="/knowledge/square">知识广场</Link> },
  { key: '/app/knowledge/favorites', icon: <StarOutlined />, label: <Link to="/knowledge/favorites">我的收藏</Link> },
  { key: '/app/settings', icon: <SettingOutlined />, label: <Link to="/settings">网站设置</Link> },
];

function AppLayout() {
  const location = useLocation();
  const { user, isLoggedIn, logout } = useAuthStore();
  const { settings, fetchSettings } = useSettingsStore();
  const setPanelVisible = useQuickLinkStore((s) => s.setPanelVisible);
  const [collapsed, setCollapsed] = useState(settings.theme.sidebarCollapsed);
  useQuickLinkShortcut();

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setCollapsed(settings.theme.sidebarCollapsed);
  }, [settings.theme.sidebarCollapsed]);

  useEffect(() => {
    if (settings.quickLink.panelDefaultOpen) {
      setPanelVisible(true);
    }
  }, [settings.quickLink.panelDefaultOpen]);

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
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff', flexShrink: 0 }}>Forge</div>
        <GlobalSearch />
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
            className="sidebar-menu"
            style={{ border: 'none' }}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#f0f2f5', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/token" element={<TokenPage />} />
            <Route path="/quick-link" element={<QuickLinkPage />} />
            <Route path="/knowledge" element={<KnowledgeSpacePage />} />
            <Route path="/knowledge/square" element={<KnowledgeSquarePage />} />
            <Route path="/knowledge/favorites" element={<KnowledgeFavoritesPage />} />
            <Route path="/knowledge/document/new" element={<DocumentEditPage />} />
            <Route path="/knowledge/document/:id" element={<DocumentViewPage />} />
            <Route path="/knowledge/document/:id/edit" element={<DocumentEditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
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
        token: { colorPrimary: '#1677ff', borderRadius: 8, controlItemBgActive: '#e6f4ff', controlItemBgHover: '#f0f5ff' },
        algorithm: theme.defaultAlgorithm,
        components: {
          Menu: {
            itemSelectedBg: '#e6f4ff',
            itemSelectedColor: '#1677ff',
            itemActiveBg: '#f0f5ff',
            subMenuItemBg: '#fff',
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter basename="/app" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
