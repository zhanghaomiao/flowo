import {
  DashboardOutlined,
  HomeOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { Layout, Menu } from "antd";

const { Header, Content } = Layout;

const menuItems = [
  {
    key: "/",
    icon: <HomeOutlined />,
    label: <Link to="/">Workflows</Link>,
  },
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: <Link to="/dashboard">Dashboard</Link>,
  },
  {
    key: "/about",
    icon: <QuestionCircleOutlined />,
    label: <Link to="/about">About</Link>,
  },
];

function RootComponent() {
  const location = useLocation();

  // Determine the selected menu key based on current pathname
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname === "/") return "/";
    if (pathname.startsWith("/dashboard")) return "/dashboard";
    if (pathname.startsWith("/about")) return "/about";
    // For workflow detail pages (/workflow/xxx), don't highlight any menu item
    return "";
  };

  return (
    <Layout style={{ minHeight: "100vh", width: "100%" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: "18px",
            fontWeight: "bold",
            marginRight: "24px",
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
      <Content style={{ padding: "10px", minWidth: "80%", maxWidth: "100%" }}>
        <Outlet />
      </Content>
      <ReactQueryDevtools initialIsOpen={false} />
    </Layout>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
