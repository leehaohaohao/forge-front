import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import { KeyOutlined, HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import TokenPage from './pages/token';
import HomePage from './pages/home';

const { Header, Sider, Content, Footer } = Layout;

const sidebarItems = [
  { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: '/token', icon: <KeyOutlined />, label: <Link to="/token">密钥管理</Link> },
];

function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
    </Layout>
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
