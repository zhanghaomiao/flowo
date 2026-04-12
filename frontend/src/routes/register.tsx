import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { App, Button, Card, Form, Input } from 'antd';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import { registerRegisterMutation } from '@/client/@tanstack/react-query.gen';
import { RegisterRegisterError } from '@/client/types.gen';

interface RegisterFormValues {
  email: string;
  password: string;
}

export const Route = createFileRoute('/register')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      email: (search.email as string) || undefined,
      token: (search.token as string) || undefined,
    };
  },
  component: RegisterComponent,
});

function RegisterComponent() {
  const navigate = useNavigate();
  const { email: initialEmail, token } = Route.useSearch();
  const registerMutation = useMutation(registerRegisterMutation());
  const { message } = App.useApp();
  const [isSuccess, setIsSuccess] = useState(false);
  const onFinish = async (values: RegisterFormValues) => {
    try {
      await registerMutation.mutateAsync({
        body: {
          email: values.email,
          password: values.password,
          invitation_code: token,
        } as { email: string; password: string; invitation_code?: string },
      });

      message.success('Account created successfully!');
      setIsSuccess(true);
    } catch (err: unknown) {
      const error = err as RegisterRegisterError;
      console.error('Registration error details:', error);
      if (error?.detail === 'REGISTER_USER_ALREADY_EXISTS') {
        message.error('Registration failed. Email is already registered.');
      } else if (typeof error?.detail === 'string') {
        message.error(error.detail);
      } else {
        message.error('Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center bg-[#f8fafc] overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-sky-100 rounded-full blur-[100px] opacity-60" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-50 rounded-full blur-[120px] opacity-60" />

      <Card
        className="w-full max-w-[460px] rounded-3xl border-none shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500"
        bodyStyle={{ padding: '48px 40px' }}
      >
        {isSuccess ? (
          <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-emerald-50 rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-lg shadow-emerald-200/50">
              <CheckCircle2 className="text-emerald-500 w-10 h-10" />
            </div>
            <h1 className="text-3xl font-extrabold text-[#0f172a] mb-4 tracking-tight">
              Registration Successful
            </h1>
            <div className="mt-4 space-y-4">
              <p className="text-slate-600 text-lg leading-relaxed">
                Your account has been created successfully. You can now log in
                to the dashboard.
              </p>
            </div>

            <Button
              type="primary"
              size="large"
              block
              onClick={() => navigate({ to: '/login' })}
              className="mt-10 h-14 rounded-xl text-lg font-bold bg-sky-500 hover:bg-sky-600 border-none shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 group transition-all"
            >
              Sign In Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-sky-400/20">
                <UserPlus className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-extrabold text-[#0f172a] mb-2 tracking-tight">
                Create Account
              </h1>
              <p className="text-slate-500 text-lg">
                Join FlowO for better workflow management
              </p>
            </div>

            <Form
              name="register"
              onFinish={onFinish}
              size="large"
              layout="vertical"
              initialValues={{ email: initialEmail }}
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
                  prefix={<Mail className="text-slate-400 w-5 h-5 mr-2" />}
                  placeholder="Email address"
                  className="h-12 bg-slate-50 border-slate-200 rounded-xl hover:border-sky-300 focus:border-sky-500 transition-all focus:bg-white"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: 'Password is required' },
                  { min: 8, message: 'Minimum 8 characters' },
                ]}
              >
                <Input.Password
                  prefix={<Lock className="text-slate-400 w-5 h-5 mr-2" />}
                  placeholder="Password"
                  className="h-12 bg-slate-50 border-slate-200 rounded-xl hover:border-sky-300 focus:border-sky-500 transition-all focus:bg-white"
                />
              </Form.Item>

              <Form.Item
                name="confirm"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error('Passwords do not match'),
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={
                    <ShieldCheck className="text-slate-400 w-5 h-5 mr-2" />
                  }
                  placeholder="Confirm password"
                  className="h-12 bg-slate-50 border-slate-200 rounded-xl hover:border-sky-300 focus:border-sky-500 transition-all focus:bg-white"
                />
              </Form.Item>

              <Form.Item className="!mt-8">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={registerMutation.isPending}
                  block
                  className="h-14 rounded-xl text-lg font-bold bg-sky-500 hover:bg-sky-600 border-none shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 group"
                >
                  Create Account
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Form.Item>

              <div className="text-center mt-8">
                <span className="text-slate-500">
                  Already have an account?{' '}
                </span>
                <Link
                  to="/login"
                  className="text-sky-500 font-bold hover:text-sky-600 transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}
