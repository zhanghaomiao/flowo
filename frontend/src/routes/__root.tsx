import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import {
  BarChart3,
  ChevronRight,
  Command,
  Library,
  PlayCircle,
  Settings2,
} from 'lucide-react';

import { type AuthContextType } from '../auth';

export interface MyRouterContext {
  auth: AuthContextType;
  queryClient: QueryClient;
}

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute =
    location.pathname === '/login' || location.pathname === '/register';

  if (isPublicRoute) {
    return (
      <div className="min-h-screen w-full bg-slate-50 font-sans">
        <Outlet />
      </div>
    );
  }

  const navItems = [
    { label: 'Runs', to: '/runs', icon: PlayCircle },
    { label: 'Catalog', to: '/catalog', icon: Library },
    {
      label: 'Dashboard',
      to: '/dashboard',
      icon: BarChart3,
      search: { target_user_id: undefined },
    },
  ] as const;

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-[#fbfcfd] overflow-hidden">
      {/* Ultra-Premium Glass Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-2xl z-[1000] border-b border-slate-200/60 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_4px_6px_-2px_rgba(0,0,0,0.05)]">
        <div className="w-full mx-auto h-full flex items-center px-4 gap-6">
          {/* Logo Section */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group pr-4 border-r border-slate-100"
            onClick={() => navigate({ to: '/runs' })}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-brand-500/35"
              aria-hidden
            >
              <Command size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black tracking-tight text-neutral-950">
              FlowO
            </span>
          </div>

          {/* Navigation Menus */}
          <nav className="flowo-header-nav flex flex-1 items-center gap-1.5">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                search={'search' in item ? item.search : undefined}
                className="inline-flex items-center gap-2.5 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
                activeProps={{
                  className:
                    '!bg-brand-500 !text-white shadow-md ring-2 ring-brand-600/30 hover:!bg-brand-600 hover:!text-white',
                }}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <item.icon
                      size={18}
                      strokeWidth={isActive ? 2.75 : 2}
                      className={
                        isActive
                          ? 'shrink-0 text-white'
                          : 'shrink-0 text-slate-500'
                      }
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </Link>
            ))}
          </nav>

          {/* Settings */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate({ to: '/settings' })}
              className={`
                group flex items-center gap-3 rounded-2xl border py-1.5 pl-4 pr-2 text-sm font-bold transition-all duration-300
                ${
                  location.pathname === '/settings'
                    ? 'border-transparent bg-brand-500 text-white shadow-md ring-2 ring-brand-600/30 hover:bg-brand-600'
                    : 'border-slate-100 bg-slate-50 text-black hover:border-slate-200 hover:bg-white hover:shadow-lg'
                }
              `}
            >
              <span
                className={
                  location.pathname === '/settings'
                    ? 'font-bold text-white'
                    : 'font-bold text-black'
                }
              >
                Settings
              </span>
              <div
                className={`
                  flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-500
                  ${
                    location.pathname === '/settings'
                      ? 'border border-white/25 bg-white/15 text-white'
                      : 'border border-slate-200 bg-white text-slate-500 group-hover:text-black group-hover:rotate-45'
                  }
                `}
              >
                <Settings2 size={16} strokeWidth={2.5} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mt-14 w-full min-h-0 flex flex-col items-stretch overflow-hidden relative">
        <div className="flex flex-1 min-h-0 w-full flex-col overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Global Status Bar / Footer */}
      <footer className="w-full h-10 flex items-center justify-between px-8 bg-white border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] shrink-0">
        <div className="flex items-center gap-4">
          <span className="opacity-50">FlowO v{__APP_VERSION__}</span>
          <span className="text-slate-100">|</span>
          <span className="text-sky-500 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
            System Healthy
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="https://flowo-docs.pages.dev/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-900 transition-colors flex items-center gap-1 group"
          >
            Documentation
            <ChevronRight
              size={12}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </a>
          <span className="opacity-30">&copy; 2026 FlowO</span>
        </div>
      </footer>

      <ReactQueryDevtools initialIsOpen={false} />
    </div>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
});
