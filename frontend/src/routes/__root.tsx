import { HomeOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Layout, Menu } from "antd";

const { Header, Content } = Layout;

export const Route = createRootRoute({
  component: () => (
    <Layout style={{ minHeight: "100vh", width: "100%" }}>
      <Header
        style={{ display: "flex", alignItems: "center", padding: "0 24px" }}
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
          items={[
            {
              key: "home",
              icon: <HomeOutlined />,
              label: <Link to="/">Workflows</Link>,
            },
            {
              key: "about",
              icon: <InfoCircleOutlined />,
              label: <Link to="/about">About</Link>,
            },
          ]}
        />
      </Header>
      <Content style={{ padding: "10px", minWidth: "80%", maxWidth: "100%" }}>
        <Outlet />
      </Content>
      <ReactQueryDevtools initialIsOpen={false} />
    </Layout>
  ),
});
