import React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message, Popconfirm, Switch, Tag } from 'antd';
import {
  AlertCircle,
  CheckCircle2,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
} from 'lucide-react';

import { useAuth } from '@/auth';
import {
  deleteUserMutation,
  listUsersOptions,
  usersPatchUserMutation,
} from '@/client/@tanstack/react-query.gen';
import type { UserRead } from '@/client/types.gen';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

export const UsersSection: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ ...listUsersOptions({}) });
  const patchUser = useMutation(usersPatchUserMutation());
  const deleteUser = useMutation(deleteUserMutation());

  const handleToggleAdmin = async (user: UserRead) => {
    try {
      await patchUser.mutateAsync({
        path: { id: user.id },
        body: { is_superuser: !user.is_superuser },
      });
      queryClient.invalidateQueries();
      message.success(`Status updated for ${user.email}`);
    } catch {
      message.error('Update failed');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={UsersIcon}
        title="Member Registry"
        subtitle="User & Role Management"
      />
      <SettingsCard>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {users.map((u: UserRead) => (
            <div
              key={u.id}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                  <UserIcon size={16} />
                </div>
                <div className="flex items-center gap-2">
                  <Tag
                    color={u.is_superuser ? 'gold' : 'blue'}
                    className="m-0 border-none rounded-md font-black text-[8px] uppercase px-1.5"
                  >
                    {u.is_superuser ? 'ADMIN' : 'USER'}
                  </Tag>
                  <Popconfirm
                    title="Delete user?"
                    description="This user will be permanently removed. Their previous workflows will remain but appear as anonymous."
                    onConfirm={async () => {
                      try {
                        await deleteUser.mutateAsync({
                          path: { user_id: u.id },
                        });
                        queryClient.invalidateQueries({
                          queryKey: listUsersOptions({}).queryKey,
                        });
                        message.success(`User ${u.email} deleted`);
                      } catch {
                        message.error('Failed to delete user');
                      }
                    }}
                    disabled={u.id === currentUser?.id}
                    okText="Delete"
                    okButtonProps={{
                      danger: true,
                      loading: deleteUser.isPending,
                    }}
                  >
                    <button
                      disabled={u.id === currentUser?.id}
                      className={`p-1 transition-colors ${
                        u.id === currentUser?.id
                          ? 'text-slate-100 cursor-not-allowed'
                          : 'text-slate-300 hover:text-rose-500'
                      }`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </Popconfirm>
                </div>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <h4 className="font-bold text-sm text-slate-800 truncate mb-0.5">
                    {u.email}
                  </h4>
                  <p className="text-[9px] font-mono text-slate-400 truncate">
                    {u.id}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-100 shadow-sm">
                  {u.is_verified ? (
                    <CheckCircle2
                      size={12}
                      className="text-emerald-500 fill-emerald-50"
                    />
                  ) : (
                    <AlertCircle size={12} className="text-amber-500" />
                  )}
                  <span
                    className={`text-[8px] font-black uppercase tracking-wider ${u.is_verified ? 'text-emerald-600' : 'text-amber-600'}`}
                  >
                    {u.is_verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Email Verified
                  </span>
                  <Switch
                    size="small"
                    checked={u.is_verified}
                    loading={patchUser.isPending}
                    onChange={async () => {
                      try {
                        await patchUser.mutateAsync({
                          path: { id: u.id },
                          body: { is_verified: !u.is_verified },
                        });
                        queryClient.invalidateQueries();
                        message.success(`Verification status updated`);
                      } catch {
                        message.error('Update failed');
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Admin Privileges
                  </span>
                  <Switch
                    size="small"
                    checked={u.is_superuser}
                    onChange={() => handleToggleAdmin(u)}
                    loading={patchUser.isPending}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
};
