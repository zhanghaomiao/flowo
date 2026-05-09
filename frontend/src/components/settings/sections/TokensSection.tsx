import React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Tabs,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import {
  Copy,
  FileText,
  Fingerprint,
  Key,
  Plus,
  Terminal,
  Trash2,
} from 'lucide-react';

import {
  createTokenMutation,
  deleteTokenMutation,
  getClientConfigOptions,
  listTokensOptions,
} from '@/client/@tanstack/react-query.gen';
import type { UserTokenResponse } from '@/client/types.gen';
import { copyTextToClipboard } from '@/utils/clipboard';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

export const TokensSection: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const { data: tokenData } = useQuery({ ...listTokensOptions({}) });
  const { data: clientConfig } = useQuery({ ...getClientConfigOptions({}) });

  const tokens = tokenData?.tokens || [];
  const createTokenMutationHook = useMutation(createTokenMutation());
  const deleteTokenHook = useMutation(deleteTokenMutation());

  // Creation State
  const [isCreating, setIsCreating] = React.useState(false);
  const [tokenName, setTokenName] = React.useState('');
  const [tokenTTL, setTokenTTL] = React.useState<number | undefined>(undefined);
  const [generatedToken, setGeneratedToken] = React.useState<string | null>(
    null,
  );

  // Usage Modal State
  const [usageModal, setUsageModal] = React.useState<{
    open: boolean;
    token: string;
    name: string;
  }>({ open: false, token: '', name: '' });

  const handleCreateToken = async () => {
    try {
      const res = await createTokenMutationHook.mutateAsync({
        body: {
          name: tokenName || `Token-${Date.now()}`,
          ttl_days: tokenTTL,
        },
      });
      queryClient.invalidateQueries({
        queryKey: listTokensOptions({}).queryKey,
      });
      setGeneratedToken(res.token || null);
      messageApi.success('New access token generated');
    } catch {
      messageApi.error('Failed to create token');
    }
  };

  const handleDeleteToken = async (id: string) => {
    try {
      await deleteTokenHook.mutateAsync({ path: { token_id: id } });
      queryClient.invalidateQueries({
        queryKey: listTokensOptions({}).queryKey,
      });
      messageApi.success('Token revoked');
    } catch {
      messageApi.error('Failed to revoke token');
    }
  };

  const getEnvContent = (t: string) => {
    const tokenLine = t ? `FLOWO_USER_TOKEN=${t}` : '# FLOWO_USER_TOKEN=';
    return `FLOWO_HOST=${window.location.origin}\n${tokenLine}\nFLOWO_WORKING_PATH=${clientConfig?.FLOWO_WORKING_PATH ?? '<YOUR_WORKING_PATH>'}`;
  };

  const getCLICmd = (t: string) =>
    `flowo --generate-config --token ${t || '<YOUR_TOKEN>'} --host ${window.location.origin} --working-path ${clientConfig?.FLOWO_WORKING_PATH ?? '<YOUR_WORKING_PATH>'}`;

  const CopyableCode = ({ text }: { text: string }) => (
    <div className="relative group">
      <pre className="bg-slate-50 text-slate-700 p-4 rounded-lg text-sm font-mono overflow-x-auto border border-slate-200">
        {text}
      </pre>
      <Tooltip title="Copy to clipboard">
        <button
          type="button"
          onClick={() => {
            void (async () => {
              const ok = await copyTextToClipboard(text);
              if (ok) messageApi.success('Copied');
              else messageApi.error('Could not copy to clipboard');
            })();
          }}
          className="absolute top-3 right-3 p-2 bg-white text-slate-400 hover:text-sky-600 rounded-lg border border-slate-200"
        >
          <Copy size={14} />
        </button>
      </Tooltip>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <SectionHeader
          icon={Fingerprint}
          title="API Tokens"
          subtitle="API Access & Authentication"
        />
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setGeneratedToken(null);
            setTokenName('');
            setTokenTTL(undefined);
            setIsCreating(true);
          }}
          className="h-11 px-6 rounded-xl font-bold bg-sky-600 hover:bg-sky-700 border-none flex items-center gap-2"
        >
          New Token
        </Button>
      </div>

      <SettingsCard>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Token
                </th>
                <th className="pb-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="pb-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="pb-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tokens.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-slate-400 text-sm"
                  >
                    No tokens created yet
                  </td>
                </tr>
              ) : (
                tokens.map((token: UserTokenResponse) => (
                  <tr key={token.id} className="hover:bg-slate-50">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Key size={14} className="text-slate-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">
                            {token.name || 'Unnamed Token'}
                          </div>
                          <div className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                            {token.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-600">
                        {dayjs(token.created_at).format('MMM D, YYYY')}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {token.expires_at ? (
                        <div className="text-sm text-amber-600">
                          {dayjs(token.expires_at).format('MMM D, YYYY')}
                        </div>
                      ) : (
                        <span className="text-sm text-emerald-600">Never</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip title="Configure">
                          <Button
                            type="text"
                            size="small"
                            icon={<Terminal size={14} />}
                            onClick={() =>
                              setUsageModal({
                                open: true,
                                token: token.token || '',
                                name: token.name || 'Unnamed',
                              })
                            }
                            className="text-sky-600"
                          >
                            Configure
                          </Button>
                        </Tooltip>

                        <Popconfirm
                          title="Revoke token?"
                          onConfirm={() => handleDeleteToken(token.id)}
                          okText="Revoke"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 size={14} />}
                          >
                            Revoke
                          </Button>
                        </Popconfirm>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      {/* Token Generation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Fingerprint className="text-sky-500" size={20} />
            <span className="font-bold text-slate-800">Generate New Token</span>
          </div>
        }
        open={isCreating}
        onCancel={() => setIsCreating(false)}
        footer={null}
        width={520}
      >
        {!generatedToken ? (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Token Name
                </label>
                <Input
                  placeholder="e.g. Personal MacBook Pro"
                  value={tokenName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTokenName(e.target.value)
                  }
                  className="rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Expiration
                </label>
                <Select
                  className="w-full"
                  value={tokenTTL}
                  onChange={setTokenTTL}
                  placeholder="Never expire"
                  options={[
                    { value: undefined, label: 'Never expire' },
                    { value: 7, label: '7 Days' },
                    { value: 30, label: '30 Days' },
                    { value: 90, label: '90 Days' },
                    { value: 365, label: '1 Year' },
                  ]}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="primary"
                onClick={handleCreateToken}
                loading={createTokenMutationHook.isPending}
                className="rounded-lg"
              >
                Generate Token
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
              <div className="flex items-center gap-3">
                <Key className="text-emerald-600" size={18} />
                <div className="font-medium text-emerald-900">
                  Token created successfully
                </div>
              </div>
            </div>

            <CopyableCode text={generatedToken} />

            <div className="p-4 bg-slate-50 rounded-lg">
              <Tabs
                size="small"
                items={[
                  {
                    key: 'cli',
                    label: (
                      <div className="flex items-center gap-2">
                        <Terminal size={14} />
                        <span>CLI Setup</span>
                      </div>
                    ),
                    children: <CopyableCode text={getCLICmd(generatedToken)} />,
                  },
                  {
                    key: 'env',
                    label: (
                      <div className="flex items-center gap-2">
                        <FileText size={14} />
                        <span>Environment</span>
                      </div>
                    ),
                    children: (
                      <CopyableCode text={getEnvContent(generatedToken)} />
                    ),
                  },
                ]}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setIsCreating(false)}
                className="rounded-lg"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Usage Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Terminal className="text-sky-500" size={20} />
            <span className="font-bold text-slate-800">
              Configure: {usageModal.name}
            </span>
          </div>
        }
        open={usageModal.open}
        onCancel={() => setUsageModal({ ...usageModal, open: false })}
        footer={null}
        width={520}
      >
        <div className="py-4 space-y-6">
          <Tabs
            items={[
              {
                key: 'cli',
                label: (
                  <div className="flex items-center gap-2">
                    <Terminal size={14} />
                    <span>CLI Command</span>
                  </div>
                ),
                children: <CopyableCode text={getCLICmd(usageModal.token)} />,
              },
              {
                key: 'env',
                label: (
                  <div className="flex items-center gap-2">
                    <FileText size={14} />
                    <span>.env Template</span>
                  </div>
                ),
                children: (
                  <CopyableCode text={getEnvContent(usageModal.token)} />
                ),
              },
            ]}
          />

          <div className="flex justify-end">
            <Button
              onClick={() => setUsageModal({ ...usageModal, open: false })}
              className="rounded-lg"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
