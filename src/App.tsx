import { useRequestError } from '@/hooks/useRequestError';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Layout, Menu, Button, Space, Typography, theme, Grid } from 'antd';
import { KeyOutlined, HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, UserOutlined, LinkOutlined, SettingOutlined, ReadOutlined, CompassOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { useQuickLinkStore } from '@/stores/quickLinks';
import { useQuickLinkShortcut } from '@/hooks/useQuickLinkShortcut';
import QuickLinkPanel from '@/components/quick-link/QuickLinkPanel';
import RecoveryCheck from './pages/token/RecoveryCheck';
import TokenPage from './pages/token';
import QuickLinkPage from './pages/quick-link';
import SettingsPage from './pages/settings';
import HomePage from './pages/home';
import LoginPage from './pages/login';
import KnowledgeSpacePage from './pages/knowledge/space';
import DocumentEditPage from './pages/knowledge/document/EditPage';
import DocumentViewPage from './pages/knowledge/document/ViewPage';
import KnowledgeSquarePage from './pages/knowledge/square';
import GlobalSearch from './components/knowledge/GlobalSearch';

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

const sidebarItems = [
  { key: '/app', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: '/app/token', icon: <KeyOutlined />, label: <Link to="/token">密钥管理</Link> },
  { key: '/app/quick-link', icon: <LinkOutlined />, label: <Link to="/quick-link">快捷链接</Link> },
  { key: '/app/knowledge', icon: <ReadOutlined />, label: <Link to="/knowledge">知识中心</Link> },
  { key: '/app/knowledge/square', icon: <CompassOutlined />, label: <Link to="/knowledge/square">知识广场</Link> },
  { key: '/app/settings', icon: <SettingOutlined />, label: <Link to="/settings">网站设置</Link> },
];

function AppLayout() {
  const reportError = useRequestError();
  const screens=Grid.useBreakpoint();
  const narrow=screens.md===false;
  const location = useLocation();
  const { user, isLoggedIn, logout } = useAuthStore();
  const { settings, fetchSettings } = useSettingsStore();
  const setPanelVisible = useQuickLinkStore((s) => s.setPanelVisible);
  const [collapsed, setCollapsed] = useState(settings.theme.sidebarCollapsed);
  useQuickLinkShortcut();

  useEffect(() => {
    fetchSettings().catch(reportError);
  }, []);

  useEffect(() => {
    setCollapsed(settings.theme.sidebarCollapsed);
  }, [settings.theme.sidebarCollapsed]);

  useEffect(() => {
    if (settings.quickLink.panelDefaultOpen) {
      setPanelVisible(true).catch(reportError);
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
          padding: narrow?'0 12px':'0 24px',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          zIndex: 10,
          height: 56,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff', flexShrink: 0 }}>Forge</div>
        <GlobalSearch />
        <Space>
          <Text type="secondary" style={{display:narrow?'none':undefined}}>
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
          collapsed={narrow||collapsed}
          collapsedWidth={narrow?48:80}
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
              display: narrow?'none':'flex',
              justifyContent: narrow||collapsed ? 'center' : 'flex-end',
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
        <Content style={{ padding: narrow?12:24, minWidth:0, background: '#f0f2f5', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/token" element={<TokenPage />} />
            <Route path="/quick-link" element={<QuickLinkPage />} />
            <Route path="/knowledge" element={<KnowledgeSpacePage />} />
            <Route path="/knowledge/square" element={<KnowledgeSquarePage />} />
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
  const authReady = useAuthStore((s) => s.authReady);

  useEffect(() => {
    initAuth();
  }, []);

  if (!authReady) return null;

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
        <BrowserRouter basename="/app">
          <Routes>
            <Route path="/recovery-check" element={<RecoveryCheck />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
