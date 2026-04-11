import React, { useState } from 'react';

import {
  Fingerprint,
  GitBranch,
  LucideIcon,
  Mail,
  Send,
  Shield,
  User as UserIcon,
  Users as UsersIcon,
} from 'lucide-react';

import { useAuth } from '@/auth';

import { AdministrationSection } from './sections/AdministrationSection';
import { GitSettingsSection } from './sections/GitSettingsSection';
import { InvitationsSection } from './sections/InvitationsSection';
import { ProfileSection } from './sections/ProfileSection';
import { SMTPSettingsSection } from './sections/SMTPSettingsSection';
import { TokensSection } from './sections/TokensSection';
import { UsersSection } from './sections/UsersSection';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.is_superuser;
  type TabId =
    | 'profile'
    | 'tokens'
    | 'git'
    | 'users'
    | 'invites'
    | 'smtp'
    | 'system';

  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const categories: {
    title: string;
    items: { id: TabId; label: string; icon: LucideIcon }[];
  }[] = [
    {
      title: 'Personnel',
      items: [
        {
          id: 'profile' as TabId,
          label: 'Identity',
          icon: UserIcon,
        },
        {
          id: 'tokens' as TabId,
          label: 'Security Tokens',
          icon: Fingerprint,
        },
        {
          id: 'git' as TabId,
          label: 'Git Repository',
          icon: GitBranch,
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'Management',
            items: [
              {
                id: 'users' as TabId,
                label: 'Member Registry',
                icon: UsersIcon,
              },
              {
                id: 'invites' as TabId,
                label: 'Invitations',
                icon: Mail,
              },
              {
                id: 'smtp' as TabId,
                label: 'SMTP Infrastructure',
                icon: Send,
              },
              {
                id: 'system' as TabId,
                label: 'Global Policies',
                icon: Shield,
              },
            ],
          },
        ]
      : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSection user={user} logout={logout} />;
      case 'tokens':
        return <TokensSection />;
      case 'git':
        return <GitSettingsSection />;
      case 'users':
        return isAdmin ? <UsersSection /> : null;
      case 'invites':
        return isAdmin ? <InvitationsSection /> : null;
      case 'smtp':
        return isAdmin ? <SMTPSettingsSection /> : null;
      case 'system':
        return isAdmin ? <AdministrationSection /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="w-full flex h-[calc(100vh-56px)] bg-[#fbfcfd] overflow-hidden">
      {/* Settings Navigation Sidebar */}
      <aside className="w-64 border-r border-slate-100 bg-white flex flex-col p-4 space-y-6 overflow-y-auto">
        {categories.map((category) => (
          <div key={category.title} className="space-y-1.5">
            <div className="px-3 mb-3">
              <h1 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] opacity-30">
                {category.title}
              </h1>
            </div>
            {category.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-100'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <item.icon
                  size={16}
                  strokeWidth={activeTab === item.id ? 2.5 : 2}
                />
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50/30 p-8 lg:p-12">
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
