import React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, message, Popconfirm, Tooltip } from 'antd';
import { Copy, Fingerprint, Key, Plus, Trash2 } from 'lucide-react';

import {
  createTokenMutation,
  deleteTokenMutation,
  listTokensOptions,
} from '@/client/@tanstack/react-query.gen';
import type { UserTokenResponse } from '@/client/types.gen';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

export const TokensSection: React.FC = () => {
  const { message: messageApi } = App.useApp();
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
        queryKey: listTokensOptions({}).queryKey,
      });
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
          loading={createTokenMutationHook.isPending}
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
                        <button
                          disabled={deleteTokenHook.isPending}
                          className="p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-50"
                        >
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
