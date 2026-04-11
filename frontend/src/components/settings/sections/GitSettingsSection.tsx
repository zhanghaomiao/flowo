import React from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, message } from 'antd';
import { GitBranch, Globe, Lock, Wifi } from 'lucide-react';

import {
  getSettingsOptions,
  testGitConnectionMutation,
  updateSettingsMutation,
} from '@/client/@tanstack/react-query.gen';
import type { UserSettingsUpdate } from '@/client/types.gen';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

export const GitSettingsSection: React.FC = () => {
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
