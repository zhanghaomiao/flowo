import {
  DashboardOutlined,
  HomeOutlined,
  LogoutOutlined,
  ReadOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { type QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { Avatar, Dropdown, Layout, Menu, Space } from 'antd';

import { type AuthContextType, useAuth } from '../auth';

export interface MyRouterContext {
  auth: AuthContextType;
  queryClient: QueryClient;
}

const { Header, Content } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: <Link to="/">Workflows</Link>,
  },
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: <Link to="/dashboard">Dashboard</Link>,
  },
];

function RootComponent() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine the selected menu key based on current pathname
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname === '/') return '/';
    if (pathname.startsWith('/dashboard')) return '/dashboard';
    if (pathname.startsWith('/profile')) return '/profile';
    // For workflow detail pages (/workflow/xxx), don't highlight any menu item
    if (pathname.startsWith('/workflow')) return '/';
    return '';
  };

  const isPublicRoute =
    location.pathname === '/login' || location.pathname === '/register';

  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      {!isPublicRoute && (
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
          }}
        >
          <div
            style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              marginRight: '24px',
            }}
          >
            FlowO
          </div>
          <Menu
            theme="dark"
            mode="horizontal"
            style={{ flex: 1, minWidth: 0 }}
            items={menuItems}
            selectedKeys={[getSelectedKey()]}
          />
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'settings',
                    icon: <SettingOutlined />,
                    label: 'Settings',
                    onClick: () => navigate({ to: '/profile' }),
                  },
                  {
                    key: 'docs',
                    icon: <ReadOutlined />,
                    label: (
                      <a
                        href="https://flowo-docs.pages.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Documentation
                      </a>
                    ),
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    danger: true,
                    label: 'Logout',
                    onClick: logout,
                  },
                ],
              }}
              placement="bottomRight"
              arrow
            >
              <div
                style={{
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  transition: 'background 0.3s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <Space>
                  <Avatar icon={<UserOutlined />} size="small" />
                </Space>
              </div>
            </Dropdown>
          </div>
        </Header>
      )}
      <Content style={{ padding: '0px', minWidth: '80%', maxWidth: '100%' }}>
        <Outlet />
      </Content>
      <Layout.Footer
        style={{
          textAlign: 'center',
          padding: '12px 0',
          color: 'gray',
        }}
      >
        <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
          <span>
            FlowO v{__APP_VERSION__} ©{new Date().getFullYear()} Created by
            Iregene
          </span>
          <a
            href="https://flowo-docs.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'gray' }}
          >
            Documentation
          </a>
        </Space>
      </Layout.Footer>
      <ReactQueryDevtools initialIsOpen={false} />
    </Layout>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
});
