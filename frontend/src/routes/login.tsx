import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { App, Button, Card, Form, Input, Modal } from 'antd';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';

import {
  authJwtLoginMutation,
  resetForgotPasswordMutation,
  useGetSystemInfoQuery,
} from '@/client/@tanstack/react-query.gen';
import { AuthJwtLoginError } from '@/client/types.gen';

import { useAuth } from '../auth';

export const Route = createFileRoute('/login')({
  component: LoginComponent,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
});

function LoginComponent() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { redirect } = Route.useSearch();
  const loginMutation = useMutation(authJwtLoginMutation());
  const forgotMutation = useMutation(resetForgotPasswordMutation());
  const [isForgotModalVisible, setIsForgotModalVisible] = useState(false);
  const { data: systemInfo } = useGetSystemInfoQuery();
  const allowPublicRegistration =
    systemInfo?.allow_public_registration !== false;
  const { message } = App.useApp();
  const [loginForm] = Form.useForm();
  const [forgotForm] = Form.useForm();

  useEffect(() => {
    if (isAuthenticated) {
      if (redirect) {
        navigate({ to: redirect });
      } else {
        navigate({ to: '/' });
      }
    }
  }, [isAuthenticated, navigate, redirect]);

  interface LoginFormValues {
    email: string;
    password: string;
  }

  const onFinish = async (values: LoginFormValues) => {
    try {
      const data = await loginMutation.mutateAsync({
        body: {
          username: values.email,
          password: values.password,
        },
      });

      if (data && data.access_token) {
        login(data.access_token);
        message.success('Welcome back to FlowO');
      } else {
        message.error('Login failed. No token received.');
      }
    } catch (err: unknown) {
      const error = err as AuthJwtLoginError;
      console.error('Login error details:', error);
      if (error?.detail === 'LOGIN_BAD_CREDENTIALS') {
        message.error('Invalid email or password. Please try again.');
      } else if (typeof error?.detail === 'string') {
        message.error(error.detail);
      } else if (
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail
      ) {
        message.error(
          (error as { response: { data: { detail: string } } }).response.data
            .detail,
        );
      } else {
        message.error('Login failed. Please check your credentials.');
      }
    }
  };

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
          <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-sky-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0f172a] mb-2 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-slate-500 text-lg">Sign in to continue to FlowO</p>
        </div>

        <Form
          form={loginForm}
          name="login"
          onFinish={onFinish}
          size="large"
          layout="vertical"
          className="space-y-4"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input
              prefix={<Mail className="w-5 h-5 text-slate-400 mr-2" />}
              placeholder="Email address"
              className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Password is required' }]}
            className="!mb-2"
          >
            <Input.Password
              prefix={<Lock className="w-5 h-5 text-slate-400 mr-2" />}
              placeholder="Password"
              className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
            />
          </Form.Item>

          <div className="flex justify-end mb-6">
            <button
              type="button"
              onClick={() => {
                const email = loginForm.getFieldValue('email');
                if (email) {
                  forgotForm.setFieldsValue({ email });
                }
                setIsForgotModalVisible(true);
              }}
              className="text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
              block
              className="h-14 rounded-xl text-lg font-bold bg-sky-500 hover:bg-sky-600 border-none shadow-lg shadow-sky-500/20 flex items-center justify-center group"
            >
              Log In
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Form.Item>

          {allowPublicRegistration && (
            <div className="text-center mt-8">
              <span className="text-slate-500">
                Don&apos;t have an account?{' '}
              </span>
              <Link
                to="/register"
                search={{ email: undefined, token: undefined }}
                className="font-bold text-sky-500 hover:text-sky-600 transition-colors"
              >
                Create now
              </Link>
            </div>
          )}
        </Form>
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2 pt-2">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xl font-bold text-[#0f172a]">
              Reset Password
            </span>
          </div>
        }
        open={isForgotModalVisible}
        onCancel={() => setIsForgotModalVisible(false)}
        centered
        footer={null}
        className="rounded-2xl overflow-hidden"
      >
        <div className="py-6">
          <p className="text-slate-600 text-[15px] leading-relaxed mb-6">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </p>
          <Form
            form={forgotForm}
            name="forgot_password"
            onFinish={async (values: { email: string }) => {
              try {
                await forgotMutation.mutateAsync({
                  body: { email: values.email },
                });
                message.success(
                  'If an account exists with that email, a reset link has been sent.',
                  8,
                );
                setIsForgotModalVisible(false);
              } catch {
                message.error('Failed to request password reset.');
              }
            }}
            layout="vertical"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Email is required' },
                { type: 'email', message: 'Enter a valid email' },
              ]}
            >
              <Input
                prefix={<Mail className="w-5 h-5 text-slate-400 mr-2" />}
                placeholder="Email address"
                className="h-12 rounded-xl"
              />
            </Form.Item>
            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                loading={forgotMutation.isPending}
                block
                className="h-12 rounded-xl font-bold bg-slate-900 border-none hover:bg-slate-800"
              >
                Send Reset Link
              </Button>
            </Form.Item>
          </Form>

          {!systemInfo?.email_enabled && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-slate-400 text-sm mb-4">
                Admin note: SMTP is not configured. Email will not be sent.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 italic">
                <code className="text-slate-500 text-xs break-all">
                  docker exec -it flowo-backend python -m app.manage tokens
                  list-resets
                </code>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
