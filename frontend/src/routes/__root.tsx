import {
  DashboardOutlined,
  HomeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { type QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useLocation,
} from '@tanstack/react-router';
import { Layout, Menu } from 'antd';

import { type AuthContextType } from '../auth';

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
  {
    key: '/profile',
    icon: <UserOutlined />,
    label: <Link to="/profile">Profile</Link>,
  },
];

function RootComponent() {
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
        </Header>
      )}
      <Content style={{ padding: '0px', minWidth: '80%', maxWidth: '100%' }}>
        <Outlet />
      </Content>
      <ReactQueryDevtools initialIsOpen={false} />
    </Layout>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
});
