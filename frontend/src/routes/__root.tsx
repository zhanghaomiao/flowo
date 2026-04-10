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
  BookOpen,
  ChevronRight,
  Command,
  LogOut,
  Settings2,
  Workflow,
} from 'lucide-react';

import { type AuthContextType, useAuth } from '../auth';

export interface MyRouterContext {
  auth: AuthContextType;
  queryClient: QueryClient;
}

function RootComponent() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

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
    { label: 'Workflows', to: '/', icon: Workflow },
    { label: 'Catalog', to: '/catalog', icon: BookOpen },
    {
      label: 'Dashboard',
      to: '/dashboard',
      icon: BarChart3,
      search: { target_user_id: undefined },
    },
  ];

  const getActiveState = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-[#fbfcfd] overflow-hidden">
      {/* Ultra-Premium Glass Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-2xl z-[1000] border-b border-slate-200/60 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_4px_6px_-2px_rgba(0,0,0,0.05)]">
        <div className="w-full mx-auto h-full flex items-center px-4 gap-6">
          {/* Logo Section */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group pr-4 border-r border-slate-100"
            onClick={() => navigate({ to: '/' })}
          >
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:shadow-sky-200 group-hover:scale-105">
              <Command size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-black tracking-tight text-black">
              FlowO
            </span>
          </div>

          {/* Navigation Menus */}
          <nav className="flex items-center gap-1.5 flex-1">
            {navItems.map((item) => {
              const isActive = getActiveState(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={item.search}
                  className={`
                    flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300
                    ${
                      isActive
                        ? 'bg-slate-100 text-black shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-black hover:bg-slate-100/50 active:scale-95'
                    }
                  `}
                >
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={isActive ? 'text-black' : 'text-slate-400'}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User & Settings Section */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: '/settings' })}
              className={`
                group flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-2xl border transition-all duration-300
                ${
                  location.pathname === '/settings'
                    ? 'bg-white border-slate-200 shadow-xl'
                    : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-lg'
                }
              `}
            >
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] leading-none mb-0.5">
                  Admin
                </span>
                <span className="text-sm font-bold text-black">Settings</span>
              </div>
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500
                  ${
                    location.pathname === '/settings'
                      ? 'bg-black text-white rotate-90'
                      : 'bg-white border border-slate-200 text-slate-500 group-hover:text-black group-hover:rotate-45'
                  }
                `}
              >
                <Settings2 size={16} strokeWidth={2.5} />
              </div>
            </button>

            <button
              onClick={() => auth.logout()}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 border border-rose-100 hover:shadow-lg hover:shadow-rose-100 active:scale-95 group"
              title="Logout"
            >
              <LogOut
                size={18}
                strokeWidth={2.5}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mt-14 w-full flex flex-col items-stretch overflow-hidden relative">
        <div className="flex-1 w-full overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Global Status Bar / Footer */}
      <footer className="w-full h-10 flex items-center justify-between px-8 bg-white border-t border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] shrink-0">
        <div className="flex items-center gap-4">
          <span className="opacity-50">FlowO Engine v1.2</span>
          <span className="text-slate-100">|</span>
          <span className="text-sky-500 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
            System Healthy
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="/docs"
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
