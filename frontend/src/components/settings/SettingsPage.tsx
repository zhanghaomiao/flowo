import React, { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import {
  Copy,
  Fingerprint,
  GitBranch,
  Globe,
  Key,
  Lock,
  LucideIcon,
  Mail,
  Plus,
  Send,
  Shield,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
  Wifi,
} from 'lucide-react';

import { useAuth } from '@/auth';
import {
  createInvitationMutation,
  createTokenMutation,
  deleteInvitationMutation,
  deleteTokenMutation,
  getSettingsOptions,
  listInvitationsOptions,
  listTokensOptions,
  listUsersOptions,
  testAdminSmtpConnectionMutation,
  testGitConnectionMutation,
  updateSettingsMutation,
  updateSystemSettingsMutation,
  useGetSystemSettingsQuery,
  usersDeleteUserMutation,
  usersPatchUserMutation,
} from '@/client/@tanstack/react-query.gen';
import type {
  InvitationRead,
  SystemSettingsRead,
  SystemSettingsUpdate,
  UserRead,
  UserSettingsUpdate,
  UserTokenResponse,
} from '@/client/types.gen';

// --- Shared Components for Settings ---

const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) => (
  <div className="flex items-center gap-4 mb-8">
    <div className="p-2.5 bg-slate-900 rounded-xl shadow-lg flex items-center justify-center">
      <Icon size={18} className="text-sky-400" strokeWidth={2.5} />
    </div>
    <div>
      <h2 className="text-lg font-black text-slate-800 m-0 tracking-tight leading-none">
        {title}
      </h2>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-none">
        {subtitle}
      </p>
    </div>
  </div>
);

const SettingsCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 ${className}`}
  >
    {children}
  </div>
);

// --- Sub-sections ---

const ProfileSection = ({
  user,
}: {
  user: UserRead | { email: string; id: string; is_superuser?: boolean } | null;
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
        </div>
      </SettingsCard>
    </div>
  );
};

const TokensSection = () => {
  const queryClient = useQueryClient();
  const { data: tokenData } = useQuery({ ...listTokensOptions({}) });
  const tokens = tokenData?.tokens || [];
  const createTokenMutationHook = useMutation(createTokenMutation());
  const deleteTokenHook = useMutation(deleteTokenMutation());

  const handleCreateToken = async () => {
    try {
      await createTokenMutationHook.mutateAsync({
        body: { name: `Token-${Date.now()}` },
      });
      queryClient.invalidateQueries({
        queryKey: [listTokensOptions({}).queryKey],
      });
      message.success('New access token generated');
    } catch {
      message.error('Failed to create token');
    }
  };

  const handleDeleteToken = async (id: string) => {
    try {
      await deleteTokenHook.mutateAsync({ path: { token_id: id } });
      queryClient.invalidateQueries({
        queryKey: [listTokensOptions({}).queryKey],
      });
      message.success('Token revoked');
    } catch {
      message.error('Failed to revoke token');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
        <SectionHeader
          icon={Fingerprint}
          title="Security Tokens"
          subtitle="API Access & Authentication"
        />
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={handleCreateToken}
          className="h-11 px-6 rounded-2xl font-bold shadow-sm bg-slate-900 border-none mb-8 flex items-center gap-2"
        >
          New Token
        </Button>
      </div>

      <SettingsCard>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Token ID
                </th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tokens.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="py-10 text-center text-slate-400 text-xs font-medium"
                  >
                    No active tokens found
                  </td>
                </tr>
              ) : (
                tokens.map((token: UserTokenResponse) => (
                  <tr
                    key={token.id}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-100 rounded-lg">
                          <Key size={12} className="text-slate-500" />
                        </div>
                        <span className="font-mono text-xs text-slate-600 break-all">
                          {token.id}
                        </span>
                        <Tooltip title="Copy">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(token.id);
                              message.info('Copied');
                            }}
                            className="p-1 text-slate-300 hover:text-sky-500"
                          >
                            <Copy size={12} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="py-4 text-right px-4">
                      <Popconfirm
                        title="Revoke this token?"
                        onConfirm={() => handleDeleteToken(token.id)}
                        okText="Revoke"
                        okButtonProps={{
                          danger: true,
                          className: 'rounded-md',
                        }}
                      >
                        <button className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </Popconfirm>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </div>
  );
};

const GitSettingsSection = () => {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ ...getSettingsOptions() });
  const updateSettings = useMutation(updateSettingsMutation());
  const testGit = useMutation(testGitConnectionMutation());
  const [form] = Form.useForm();

  const onFinish = async (values: UserSettingsUpdate) => {
    try {
      await updateSettings.mutateAsync({ body: values });
      queryClient.invalidateQueries({
        queryKey: [getSettingsOptions().queryKey],
      });
      message.success('Git settings updated');
    } catch {
      message.error('Update failed');
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      const res = await testGit.mutateAsync({ body: values });
      if (res.success) {
        message.success(res.message);
      } else {
        message.error(res.message || 'Connection failed');
      }
    } catch {
      message.error('Validation failed');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={GitBranch}
        title="Git Repository"
        subtitle="Manage your workflow synchronization"
      />
      <SettingsCard>
        <Form
          form={form}
          layout="vertical"
          initialValues={settings || {}}
          onFinish={onFinish}
          className="space-y-4"
        >
          <Form.Item
            name="git_remote_url"
            label={
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Remote URL
              </span>
            }
          >
            <Input
              prefix={<Globe size={14} className="text-slate-400 mr-2" />}
              placeholder="https://github.com/user/repo.git"
              className="rounded-xl border-slate-100 h-11"
            />
          </Form.Item>

          <Form.Item
            name="git_token"
            label={
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Personal Access Token
              </span>
            }
          >
            <Input.Password
              prefix={<Lock size={14} className="text-slate-400 mr-2" />}
              placeholder="ghp_xxxxxxxxxxxx"
              className="rounded-xl border-slate-100 h-11"
            />
          </Form.Item>

          <div className="flex gap-3 pt-4 border-t border-slate-50">
            <Button
              type="primary"
              htmlType="submit"
              loading={updateSettings.isPending}
              className="h-11 px-6 rounded-xl font-bold bg-slate-900 border-none shadow-md"
            >
              Save Repository
            </Button>
            <Button
              icon={<Wifi size={14} />}
              onClick={handleTest}
              loading={testGit.isPending}
              className="h-11 px-6 rounded-xl font-bold border-slate-100 text-slate-600 hover:text-slate-900"
            >
              Test Connection
            </Button>
          </div>
        </Form>
      </SettingsCard>
    </div>
  );
};

const UsersSection = () => {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({ ...listUsersOptions({}) });
  const patchUser = useMutation(usersPatchUserMutation());
  const deleteUser = useMutation(usersDeleteUserMutation());

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
                    onConfirm={() =>
                      deleteUser.mutateAsync({ path: { id: u.id } })
                    }
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <button className="p-1 text-slate-300 hover:text-rose-500">
                      <Trash2 size={14} />
                    </button>
                  </Popconfirm>
                </div>
              </div>
              <h4 className="font-bold text-sm text-slate-800 truncate mb-0.5">
                {u.email}
              </h4>
              <p className="text-[9px] font-mono text-slate-400 mb-4 truncate">
                {u.id}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Admin Privileges
                </span>
                <Switch
                  size="small"
                  checked={u.is_superuser}
                  onChange={() => handleToggleAdmin(u)}
                />
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
};

const InvitationsSection = () => {
  const queryClient = useQueryClient();
  const { data: invitations = [] } = useQuery({
    ...listInvitationsOptions({}),
  });
  const createInvite = useMutation(createInvitationMutation());
  const deleteInvite = useMutation(deleteInvitationMutation());
  const [email, setEmail] = useState('');

  const handleCreate = async () => {
    if (!email) return;
    try {
      await createInvite.mutateAsync({ body: { email } });
      queryClient.invalidateQueries({
        queryKey: [listInvitationsOptions({}).queryKey],
      });
      setEmail('');
      message.success('Invitation sent');
    } catch {
      message.error('Failed to send invitation');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Mail}
        title="Access Invitations"
        subtitle="Bring new members to your team"
      />
      <div className="flex gap-2 mb-6">
        <Input
          placeholder="New user email address..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl h-11 border-slate-100 text-sm"
        />
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={handleCreate}
          loading={createInvite.isPending}
          className="h-11 px-6 rounded-xl font-bold bg-slate-900 border-none shadow-md flex items-center gap-2"
        >
          Invite
        </Button>
      </div>
      <SettingsCard>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Recipient
                </th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invitations.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="py-10 text-center text-slate-400 text-xs"
                  >
                    No pending invitations
                  </td>
                </tr>
              ) : (
                invitations.map((inv: InvitationRead) => (
                  <tr
                    key={inv.id}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-50 text-sky-500 rounded-lg">
                          <Mail size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">
                            {inv.email || 'Generic Invitation'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {inv.token}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <Popconfirm
                        title="Revoke this invitation?"
                        onConfirm={() =>
                          deleteInvite
                            .mutateAsync({ path: { invitation_id: inv.id } })
                            .then(() => queryClient.invalidateQueries())
                        }
                        okText="Revoke"
                        okButtonProps={{ danger: true }}
                      >
                        <button className="p-2 text-rose-300 hover:text-rose-500 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </Popconfirm>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </div>
  );
};

const AdministrationSection = () => {
  const queryClient = useQueryClient();
  const { data: policy } = useGetSystemSettingsQuery();
  const updatePolicy = useMutation(updateSystemSettingsMutation());

  const handleTogglePolicy = async (field: keyof SystemSettingsRead) => {
    if (!policy) return;
    try {
      const { ...updateData } = policy;
      await updatePolicy.mutateAsync({
        body: { ...updateData, [field]: !policy[field] },
      });
      queryClient.invalidateQueries();
      message.success('Policy updated');
    } catch {
      message.error('Failed to update policy');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Shield}
        title="System Policies"
        subtitle="Global Governance & Access"
      />
      <SettingsCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Lock size={16} className="text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 m-0 leading-tight">
                  Open Registration
                </h4>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">
                  Allow anyone to create a new account.
                </p>
              </div>
            </div>
            <Switch
              size="small"
              checked={policy?.allow_public_registration}
              onChange={() => handleTogglePolicy('allow_public_registration')}
            />
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

const SMTPSettingsSection = () => {
  const queryClient = useQueryClient();
  const { data: config } = useGetSystemSettingsQuery();
  const updateConfig = useMutation(updateSystemSettingsMutation());
  const testSmtp = useMutation(testAdminSmtpConnectionMutation());
  const [form] = Form.useForm();

  const onFinish = async (values: SystemSettingsUpdate) => {
    try {
      await updateConfig.mutateAsync({ body: values });
      queryClient.invalidateQueries();
      message.success('SMTP settings updated');
    } catch {
      message.error('Update failed');
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      const res = await testSmtp.mutateAsync({ body: values });
      if (res.success) {
        message.success(res.message);
      } else {
        message.error(res.message);
      }
    } catch {
      message.error('Validation failed or test failed');
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Send}
        title="SMTP Infrastructure"
        subtitle="Notification & Email Service Configuration"
      />
      <SettingsCard>
        <Form
          form={form}
          layout="vertical"
          initialValues={config || {}}
          onFinish={onFinish}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="smtp_host"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  SMTP Host
                </span>
              }
            >
              <Input
                placeholder="smtp.example.com"
                className="rounded-xl border-slate-100 h-11"
              />
            </Form.Item>
            <Form.Item
              name="smtp_port"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  SMTP Port
                </span>
              }
            >
              <InputNumber
                className="w-full rounded-xl border-slate-100 h-11 pt-1"
                placeholder="587"
              />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="smtp_user"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  SMTP User
                </span>
              }
            >
              <Input
                placeholder="user@example.com"
                className="rounded-xl border-slate-100 h-11"
              />
            </Form.Item>
            <Form.Item
              name="smtp_from"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Default From Address
                </span>
              }
            >
              <Input
                placeholder="noreply@example.com"
                className="rounded-xl border-slate-100 h-11"
              />
            </Form.Item>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 rounded-lg flex items-center justify-center">
                <Shield size={16} className="text-sky-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 m-0 leading-tight">
                  Use TLS
                </h4>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">
                  Enable secure transport for email
                </p>
              </div>
            </div>
            <Form.Item name="smtp_use_tls" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-50">
            <Button
              type="primary"
              htmlType="submit"
              loading={updateConfig.isPending}
              className="h-11 px-6 rounded-xl font-bold bg-slate-900 border-none shadow-md"
            >
              Save Configuration
            </Button>
            <Button
              icon={<Wifi size={14} />}
              onClick={handleTest}
              loading={testSmtp.isPending}
              className="h-11 px-6 rounded-xl font-bold border-slate-100 text-slate-600 hover:text-slate-900"
            >
              Test Connection
            </Button>
          </div>
        </Form>
      </SettingsCard>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
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
        return <ProfileSection user={user} />;
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
