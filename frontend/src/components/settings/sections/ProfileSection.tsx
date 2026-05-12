import React from 'react';

import { Button, Popconfirm } from 'antd';
import { LogOut, Shield, User as UserIcon } from 'lucide-react';

import type { UserRead } from '@/client/types.gen';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

interface ProfileSectionProps {
  user: UserRead | { email: string; id: string; is_superuser?: boolean } | null;
  logout: () => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  user,
  logout,
}) => {
  if (!user) return null;
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={UserIcon}
        title="Identity"
        subtitle="Personal Profile"
      />
      <SettingsCard>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-2xl font-black shadow-lg">
              {user.email ? user.email[0].toUpperCase() : '?'}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-lg shadow-md border border-slate-100 flex items-center justify-center">
              <Shield size={14} className="text-sky-500" />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-slate-800 mb-0.5">
              {user.email}
            </h3>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
              <span className="px-2.5 py-0.5 bg-slate-100 rounded-md text-[9px] font-black text-slate-500 uppercase tracking-widest">
                ID: {user.id}
              </span>
              {user.is_superuser && (
                <span className="px-2.5 py-0.5 bg-sky-500 text-white rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm">
                  Administrator
                </span>
              )}
            </div>
          </div>
          <div className="pt-4 md:pt-0">
            <Popconfirm
              title="Are you sure you want to sign out?"
              onConfirm={() => logout()}
              okText="Sign Out"
              okButtonProps={{ danger: true, className: 'rounded-lg' }}
              cancelText="Stay"
              cancelButtonProps={{ className: 'rounded-lg' }}
            >
              <Button
                danger
                icon={<LogOut size={16} />}
                className="h-11 px-6 rounded-xl font-bold flex items-center gap-2 border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-sm shadow-rose-100 hover:shadow-rose-200"
              >
                Sign Out
              </Button>
            </Popconfirm>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
