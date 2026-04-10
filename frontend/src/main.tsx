import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { App, ConfigProvider } from 'antd';
import { Inbox } from 'lucide-react';

import './index.css';

import { AuthProvider, useAuth } from './auth';
import { routeTree } from './routeTree.gen';

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

function MainApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfigProvider
          renderEmpty={() => (
            <div className="flex flex-col items-center justify-center py-8 text-slate-300">
              <Inbox size={32} strokeWidth={1} className="mb-2 opacity-20" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-30">
                No Records
              </span>
            </div>
          )}
          theme={{
            token: {
              fontFamily:
                "'Inter', 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
              borderRadius: 12,
              colorPrimary: '#0ea5e9',
              colorInfo: '#0ea5e9',
              colorSuccess: '#0ea5e9',
              fontSize: 14,
              controlHeight: 44,
            },
            components: {
              Select: {
                fontFamily: "'Inter', 'Outfit', sans-serif",
              },
              Input: {
                fontFamily: "'Inter', 'Outfit', sans-serif",
              },
              Button: {
                fontFamily: "'Inter', 'Outfit', sans-serif",
                fontWeight: 600,
                borderRadius: 10,
              },
              Table: {
                fontFamily: "'Inter', 'Outfit', sans-serif",
                headerBg: '#fbfcfd',
                headerColor: '#64748b',
                headerBorderRadius: 12,
              },
              Tree: {
                indentSize: 12,
              },
              Layout: {
                headerHeight: 45,
              },
              Card: {
                bodyPadding: 4,
                borderRadiusLG: 16,
              },
            },
          }}
        >
          <App>
            <MainApp />
          </App>
        </ConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
