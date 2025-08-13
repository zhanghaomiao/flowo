import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ConfigProvider } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { routeTree } from "./routeTree.gen";


// 启动 MSW（仅在开发环境）
async function enableMocking() {
  console.log('🔄 Starting MSW to intercept API requests...')
  const { worker } = await import('./mocks/browser')

  // 启动 worker
  return worker.start({
    onUnhandledRequest: 'bypass',
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30000, // Default stale time
      refetchOnWindowFocus: false,
    },
  },
});

// Create router
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            components: {
              Tree: {
                indentSize: 12,
              },
              Layout: {
                headerHeight: 45,
              },
              Card: {
                bodyPadding: 4,
              },
            },
          }}
        >
          <RouterProvider router={router} />
        </ConfigProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
})
