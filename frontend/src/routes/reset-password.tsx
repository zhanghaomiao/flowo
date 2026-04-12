import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { App, Button, Card, Form, Input } from 'antd';
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';

import { resetResetPasswordMutation } from '@/client/@tanstack/react-query.gen';
import { ResetResetPasswordError } from '@/client/types.gen';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordComponent,
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    return {
      token: (search.token as string) || undefined,
    };
  },
});

function ResetPasswordComponent() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const { message } = App.useApp();
  const resetMutation = useMutation(resetResetPasswordMutation());
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!token) {
      message.error('Invalid or missing reset token.');
      navigate({ to: '/login' });
    }
  }, [token, message, navigate]);

  const onFinish = async (values: { password_new: string }) => {
    if (!token) return;

    try {
      await resetMutation.mutateAsync({
        body: {
          token,
          password: values.password_new,
        },
      });
      setIsDone(true);
      message.success('Password reset successfully!');
    } catch (err: unknown) {
      const error = err as ResetResetPasswordError;
      if (typeof error?.detail === 'string') {
        message.error(error.detail);
      } else {
        message.error('Failed to reset password. The link may have expired.');
      }
    }
  };

  if (isDone) {
    return (
      <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-[#f8fafc] overflow-hidden font-sans">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-emerald-50 rounded-full blur-[100px] opacity-40 animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-sky-50 rounded-full blur-[120px] opacity-40 animate-pulse" />

        <Card
          className="w-full max-w-[460px] rounded-[32px] border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-700"
          bodyStyle={{ padding: '64px 48px' }}
        >
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mb-10 mx-auto shadow-2xl shadow-emerald-500/20 transform rotate-6 hover:rotate-0 transition-transform duration-500">
              <CheckCircle2
                className="w-12 h-12 text-white"
                strokeWidth={2.5}
              />
            </div>
            <h1 className="text-4xl font-extrabold text-[#0f172a] mb-4 tracking-tighter">
              Security Updated
            </h1>
            <p className="text-slate-500 text-lg mb-12 leading-relaxed">
              Your password has been changed successfully. You can now log in
              with your new credentials and explorer FlowO.
            </p>
            <Button
              type="primary"
              size="large"
              block
              onClick={() => navigate({ to: '/login' })}
              className="h-16 rounded-2xl text-xl font-black bg-sky-500 hover:bg-sky-600 border-none shadow-xl shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center group"
            >
              Back to Login
              <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-sky-100 rounded-full blur-[100px] opacity-60" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-50 rounded-full blur-[120px] opacity-60" />

      <Card
        className="w-full max-w-[460px] rounded-[32px] border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative z-10 animate-in fade-in zoom-in-95 duration-700"
        bodyStyle={{ padding: '56px 48px' }}
      >
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-orange-500/20 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-[#0f172a] mb-3 tracking-tighter">
            New Password
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed font-medium">
            Create a secure password for your account
          </p>
        </div>

        <Form
          name="reset_password"
          onFinish={onFinish}
          size="large"
          layout="vertical"
          className="space-y-6"
        >
          <Form.Item
            name="password_new"
            label={
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                New Password
              </span>
            }
            rules={[
              { required: true, message: 'Please enter your new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password
              prefix={<Lock className="w-5 h-5 text-slate-400 mr-2" />}
              placeholder="••••••••"
              className="h-14 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:shadow-sm transition-all"
            />
          </Form.Item>

          <Form.Item
            name="confirm"
            label={
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                Confirm Password
              </span>
            }
            dependencies={['password_new']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password_new') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error('The two passwords do not match!'),
                  );
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<Lock className="w-5 h-5 text-slate-400 mr-2" />}
              placeholder="••••••••"
              className="h-14 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:shadow-sm transition-all"
            />
          </Form.Item>

          <Form.Item className="pt-6">
            <Button
              type="primary"
              htmlType="submit"
              loading={resetMutation.isPending}
              block
              className="h-16 rounded-2xl text-xl font-black bg-sky-500 hover:bg-sky-600 border-none shadow-xl shadow-sky-500/20 flex items-center justify-center group active:scale-95 transition-all"
            >
              Reset Password
              <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
