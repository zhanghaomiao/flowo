import React from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Switch } from 'antd';
import { Lock, Shield, ShieldCheck } from 'lucide-react';

import {
  updateSystemSettingsMutation,
  useGetSystemSettingsQuery,
} from '@/client/@tanstack/react-query.gen';
import type { SystemSettingsRead } from '@/client/types.gen';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

export const AdministrationSection: React.FC = () => {
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

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 rounded-lg">
                <ShieldCheck size={16} className="text-sky-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 m-0 leading-tight">
                  Enforce Email Verification
                </h4>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">
                  Require users to confirm their email before accessing the
                  dashboard.
                </p>
              </div>
            </div>
            <Switch
              size="small"
              checked={policy?.require_email_verification}
              onChange={() => handleTogglePolicy('require_email_verification')}
            />
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};
