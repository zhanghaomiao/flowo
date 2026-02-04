import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { ConfigProvider } from 'antd';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { routeTree } from './routeTree.gen';
import { AuthProvider, useAuth, type AuthContextType } from './auth';

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
    auth: undefined!, // This will be set by the Provider
  },
  defaultPreload: 'intent',
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
          <App />
        </ConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
