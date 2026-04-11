import React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Tabs,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import {
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Fingerprint,
  Key,
  Lock,
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
    <div className="relative group mt-2">
      <pre className="bg-slate-50 text-slate-700 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-slate-100 shadow-sm">
        {text}
      </pre>
      <Tooltip title="Copy to clipboard">
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            message.info('Copied to clipboard');
          }}
          className="absolute top-3 right-3 p-2 bg-white text-slate-400 hover:text-sky-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-md border border-slate-100"
        >
          <Copy size={14} />
        </button>
      </Tooltip>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-2">
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
                  Identity
                </th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                  Created
                </th>
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                  Expiration
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
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-slate-700">
                            {token.name || 'Unnamed Token'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 break-all">
                            {token.id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={12} />
                        <span className="text-[11px] font-medium">
                          {dayjs(token.created_at).format('MMM D, YYYY')}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {token.expires_at ? (
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <Clock size={12} />
                          <span className="text-[11px] font-black uppercase tracking-tight">
                            {dayjs(token.expires_at).format('MMM D, YYYY')}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase tracking-widest">
                          Never
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-right px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip title="Configure Client">
                          <button
                            onClick={() =>
                              setUsageModal({
                                open: true,
                                token: token.token || '',
                                name: token.name || 'Unnamed',
                              })
                            }
                            className="p-1.5 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-all"
                          >
                            <ExternalLink size={14} />
                          </button>
                        </Tooltip>

                        <Popconfirm
                          title="Revoke this token?"
                          onConfirm={() => handleDeleteToken(token.id)}
                          okText="Revoke"
                          okButtonProps={{
                            danger: true,
                            className: 'rounded-md',
                          }}
                        >
                          <button
                            disabled={deleteTokenHook.isPending}
                            className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
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
            <span className="font-black text-slate-800 tracking-tight">
              Generate New Token
            </span>
          </div>
        }
        open={isCreating}
        onCancel={() => setIsCreating(false)}
        footer={null}
        width={560}
        className="premium-modal"
      >
        {!generatedToken ? (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Token Name
                </label>
                <Input
                  placeholder="e.g. Personal MacBook Pro"
                  value={tokenName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTokenName(e.target.value)
                  }
                  className="rounded-xl h-12 shadow-sm border-slate-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Expiration Policy
                </label>
                <Select
                  className="w-full h-12"
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

            <div className="flex justify-end pt-4">
              <Button
                type="primary"
                onClick={handleCreateToken}
                loading={createTokenMutationHook.isPending}
                className="h-11 px-8 rounded-xl font-bold bg-slate-900 border-none shadow-lg"
              >
                Generate Token
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-4">
              <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-100">
                <Key size={18} />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900 text-sm">
                  Token created successfully
                </h4>
              </div>
            </div>

            <CopyableCode text={generatedToken} />

            <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Quick Setup
              </h5>
              <Tabs
                size="small"
                items={[
                  {
                    key: 'cli',
                    label: (
                      <div className="flex items-center gap-2 px-2">
                        <Terminal size={14} />
                        <span>CLI Setup</span>
                      </div>
                    ),
                    children: <CopyableCode text={getCLICmd(generatedToken)} />,
                  },
                  {
                    key: 'env',
                    label: (
                      <div className="flex items-center gap-2 px-2">
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
                className="h-11 px-8 rounded-xl font-bold bg-slate-100 border-none text-slate-600 hover:bg-slate-200"
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
            <span className="font-black text-slate-800 tracking-tight">
              Client Configuration: {usageModal.name}
            </span>
          </div>
        }
        open={usageModal.open}
        onCancel={() => setUsageModal({ ...usageModal, open: false })}
        footer={null}
        width={560}
      >
        <div className="py-4 space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
            <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-100">
              <Lock size={18} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                Security Recommendation
              </h4>
              <p className="text-amber-700/70 text-xs text-pretty">
                Use environment variables or the configuration file for local
                development. Never commit your `.env` files to public
                repositories.
              </p>
            </div>
          </div>

          <Tabs
            className="premium-tabs"
            items={[
              {
                key: 'cli',
                label: (
                  <div className="flex items-center gap-2 px-2">
                    <Terminal size={14} />
                    <span>CLI Command</span>
                  </div>
                ),
                children: (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 font-medium px-1">
                      Run this command to automatically configure your local
                      FlowO CLI tool:
                    </p>
                    <CopyableCode text={getCLICmd(usageModal.token)} />
                  </div>
                ),
              },
              {
                key: 'env',
                label: (
                  <div className="flex items-center gap-2 px-2">
                    <FileText size={14} />
                    <span>.env Template</span>
                  </div>
                ),
                children: (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 font-medium px-1">
                      Add these variables to your project&apos;s `.env` file:
                    </p>
                    <CopyableCode text={getEnvContent(usageModal.token)} />
                  </div>
                ),
              },
            ]}
          />

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setUsageModal({ ...usageModal, open: false })}
              className="h-11 px-8 rounded-xl font-bold bg-slate-100 border-none text-slate-600 hover:bg-slate-200"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
