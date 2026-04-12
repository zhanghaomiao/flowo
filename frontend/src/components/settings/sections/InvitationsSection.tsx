import React, { useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, message, notification, Popconfirm } from 'antd';
import { Mail, Plus, Trash2 } from 'lucide-react';

import {
  createInvitationMutation,
  deleteInvitationMutation,
  listInvitationsOptions,
} from '@/client/@tanstack/react-query.gen';
import type { InvitationRead } from '@/client/types.gen';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

export const InvitationsSection: React.FC = () => {
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
      const res = await createInvite.mutateAsync({ body: { email } });
      queryClient.invalidateQueries({
        queryKey: [listInvitationsOptions({}).queryKey],
      });
      setEmail('');

      if (res.email_sent) {
        message.success(`Invitation email sent to ${email}`);
      } else {
        notification.warning({
          message: 'Email Not Sent',
          description:
            'The invitation was created, but the email could not be delivered. Please share the invitation token with the user manually.',
          duration: 0,
        });
      }
    } catch {
      message.error('Failed to create invitation');
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
