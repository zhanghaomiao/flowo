import React, { useEffect } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Form, Input, InputNumber, Switch } from 'antd';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  Send,
  Shield,
  Wifi,
} from 'lucide-react';

import {
  testAdminSmtpConnectionMutation,
  updateSystemSettingsMutation,
  useGetSystemSettingsQuery,
} from '@/client/@tanstack/react-query.gen';
import type { SystemSettingsUpdate } from '@/client/types.gen';

import { SectionHeader } from '../shared/SectionHeader';
import { SettingsCard } from '../shared/SettingsCard';

export const SMTPSettingsSection: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGetSystemSettingsQuery();
  const updateConfig = useMutation(updateSystemSettingsMutation());
  const testSmtp = useMutation(testAdminSmtpConnectionMutation());
  const [form] = Form.useForm();

  // Synchronize form with data from database when it loads
  useEffect(() => {
    if (config) {
      form.setFieldsValue(config);
    }
  }, [config, form]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Loading Infrastructure...
        </p>
      </div>
    );
  }

  const onFinish = async (values: SystemSettingsUpdate) => {
    const hide = messageApi.loading('Updating configuration...', 0);
    try {
      await updateConfig.mutateAsync({ body: values });
      queryClient.invalidateQueries();
      hide();
      messageApi.success('SMTP settings updated successfully');
    } catch {
      hide();
      messageApi.error(
        'Update failed. Please check your network or permissions.',
      );
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      const hide = messageApi.loading('Testing connection...', 0);
      try {
        const res = await testSmtp.mutateAsync({ body: values });
        hide();
        if (res.success) {
          messageApi.success(res.message || 'Connection successful!');
        } else {
          messageApi.error(res.message || 'Connection failed.');
        }
      } catch (err: unknown) {
        hide();
        const errorMessage =
          err instanceof Error ? err.message : 'Connection test failed.';
        messageApi.error(errorMessage);
      }
    } catch {
      messageApi.error('Please fill in all required fields correctly.');
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Send}
        title="SMTP Infrastructure"
        subtitle="Standard notification and email delivery service"
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={config || {}}
        onFinish={onFinish}
        className="space-y-6"
      >
        <SettingsCard>
          <div className="mb-6 pb-4 border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-800 m-0">
              Connection Settings
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Configure your mail server and authentication details.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
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
            </div>
            <div>
              <Form.Item
                name="smtp_port"
                label={
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Port
                  </span>
                }
              >
                <InputNumber
                  className="w-full rounded-xl border-slate-100 h-11 flex items-center"
                  placeholder="587"
                />
              </Form.Item>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="smtp_user"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Authentication User
                </span>
              }
            >
              <Input
                placeholder="user@example.com"
                className="rounded-xl border-slate-100 h-11"
              />
            </Form.Item>
            <Form.Item
              name="smtp_password"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Auth Password
                </span>
              }
            >
              <Input.Password
                placeholder="••••••••"
                className="rounded-xl border-slate-100 h-11"
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="smtp_from"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Sender Address (From)
                </span>
              }
            >
              <Input
                placeholder="noreply@flowo.cloud"
                className="rounded-xl border-slate-100 h-11"
              />
            </Form.Item>
            <Form.Item
              name="site_url"
              label={
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Root URL (for email links)
                </span>
              }
            >
              <Input
                placeholder="https://flowo.example.com"
                className="rounded-xl border-slate-100 h-11"
              />
            </Form.Item>
          </div>

          <div className="mt-2 p-4 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/10 rounded-lg">
                <Shield size={16} className="text-sky-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 m-0">
                  Secure Connection (TLS)
                </h4>
                <p className="text-[9px] text-slate-400 font-medium">
                  Encrypt the communication with the SMTP server.
                </p>
              </div>
            </div>
            <Form.Item name="smtp_use_tls" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>
        </SettingsCard>

        {/* Notification Triggers */}
        <SettingsCard>
          <div className="mb-6 pb-4 border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-800 m-0">
              Workflow Event Notifications
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Choose which workflow lifecycle events should trigger an email to
              the user.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'notify_on_submit',
                label: 'Workflow Submitted',
                desc: 'Sent when a user starts a new computational run.',
                icon: Send,
                color: 'text-indigo-500',
                bg: 'bg-indigo-50',
              },
              {
                id: 'notify_on_success',
                label: 'Workflow Succeeded',
                desc: 'Sent when all steps in a workflow complete successfully.',
                icon: CheckCircle2,
                color: 'text-emerald-500',
                bg: 'bg-emerald-50',
              },
              {
                id: 'notify_on_failure',
                label: 'Workflow Failed',
                desc: 'Sent immediately if any step in the workflow encounters an error.',
                icon: AlertCircle,
                color: 'text-rose-500',
                bg: 'bg-rose-50',
              },
            ].map((trigger) => (
              <div
                key={trigger.id}
                className="flex items-center justify-between p-4 bg-slate-50/30 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 ${trigger.bg} rounded-xl`}>
                    <trigger.icon size={18} className={trigger.color} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 m-0">
                      {trigger.label}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {trigger.desc}
                    </p>
                  </div>
                </div>
                <Form.Item name={trigger.id} valuePropName="checked" noStyle>
                  <Switch />
                </Form.Item>
              </div>
            ))}
          </div>
        </SettingsCard>

        {/* System Mandatory Emails */}
        <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Mail size={120} className="text-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-sky-500/20 rounded-lg">
                <Lock size={16} className="text-sky-300" />
              </div>
              <h3 className="text-sm font-bold text-white m-0">
                System Transactional Emails
              </h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed max-w-lg">
              The following essential emails are{' '}
              <strong>automatically enabled</strong> once SMTP is configured, as
              they are required for secure account management and system access:
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-white/10 text-sky-200 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">
                User Registration
              </span>
              <span className="px-3 py-1 bg-white/10 text-sky-200 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">
                Email Verification
              </span>
              <span className="px-3 py-1 bg-white/10 text-sky-200 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">
                Password Reset
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <Button
            type="primary"
            htmlType="submit"
            loading={updateConfig.isPending}
            className="h-12 px-8 rounded-2xl font-bold bg-sky-500 hover:bg-sky-600 border-none shadow-lg shadow-sky-200 transition-all active:scale-95"
          >
            Save Configuration
          </Button>
          <Button
            icon={<Wifi size={16} />}
            onClick={handleTest}
            loading={testSmtp.isPending}
            className="h-12 px-8 rounded-2xl font-bold border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all active:scale-95"
          >
            Test Connection
          </Button>
        </div>
      </Form>
    </div>
  );
};
