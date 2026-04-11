import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { App, Button, Card, Form, Input } from 'antd';
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';

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
      <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-[#f8fafc] overflow-hidden">
        <Card className="w-full max-w-[460px] rounded-3xl border-none shadow-2xl relative z-10 p-8 text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-8 mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0f172a] mb-4">
            Security Updated
          </h1>
          <p className="text-slate-500 text-lg mb-10">
            Your password has been changed successfully. You can now log in with
            your new credentials.
          </p>
          <Button
            type="primary"
            size="large"
            block
            onClick={() => navigate({ to: '/login' })}
            className="h-14 rounded-xl text-lg font-bold bg-slate-900 border-none hover:bg-slate-800"
          >
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-[#f8fafc] overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-sky-100 rounded-full blur-[100px] opacity-60" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-50 rounded-full blur-[120px] opacity-60" />

      <Card
        className="w-full max-w-[460px] rounded-3xl border-none shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500"
        bodyStyle={{ padding: '48px 40px' }}
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-orange-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0f172a] mb-2 tracking-tight">
            New Password
          </h1>
          <p className="text-slate-500 text-lg">
            Create a secure password for your account
          </p>
        </div>

        <Form
          name="reset_password"
          onFinish={onFinish}
          size="large"
          layout="vertical"
          className="space-y-4"
        >
          <Form.Item
            name="password_new"
            label={
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
              className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
            />
          </Form.Item>

          <Form.Item
            name="confirm"
            label={
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
              className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
            />
          </Form.Item>

          <Form.Item className="pt-4">
            <Button
              type="primary"
              htmlType="submit"
              loading={resetMutation.isPending}
              block
              className="h-14 rounded-xl text-lg font-bold bg-slate-900 border-none hover:bg-slate-800 flex items-center justify-center group"
            >
              Reset Password
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
