import { authJwtLoginMutation } from '@/client/@tanstack/react-query.gen';
import {
  ArrowRightOutlined,
  GithubOutlined,
  LockOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button, Card, Divider, Form, Input, Typography, message } from 'antd';

import { useAuth } from '../auth';

const { Title, Text } = Typography;

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
  const { login } = useAuth();
  const { redirect } = Route.useSearch();
  const loginMutation = useMutation(authJwtLoginMutation());

  const onFinish = async (values: any) => {
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
        navigate({ to: redirect || '/' });
      } else {
        throw new Error('No token received');
      }
    } catch (error: any) {
      console.error(error);
      message.error('Invalid credentials. Please try again.');
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
      }}
    >
      {/* Background decorative elements */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '300px',
          height: '300px',
          background: 'rgba(0, 162, 255, 0.1)',
          borderRadius: '50%',
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '400px',
          height: '400px',
          background: 'rgba(123, 31, 162, 0.1)',
          borderRadius: '50%',
          filter: 'blur(100px)',
        }}
      />

      <Card
        style={{
          width: 440,
          borderRadius: 24,
          border: 'none',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        }}
        bodyStyle={{ padding: '48px 40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: 'linear-gradient(135deg, #00A2FF 0%, #7B1FA2 100%)',
              borderRadius: 16,
              margin: '0 auto 24px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 8px 16px rgba(0, 162, 255, 0.2)',
            }}
          >
            <Title style={{ color: 'white', margin: 0, fontSize: 32 }}>F</Title>
          </div>
          <Title
            level={2}
            style={{ color: '#1a1a1a', marginBottom: 8, marginTop: 0 }}
          >
            Welcome Back
          </Title>
          <Text style={{ color: '#666666', fontSize: 16 }}>
            Sign in to continue to FlowO
          </Text>
        </div>

        <Form name="login" onFinish={onFinish} size="large" layout="vertical">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Email address"
              style={{
                background: '#f5f5f5',
                border: '1px solid #e8e8e8',
                color: '#333',
                borderRadius: 12,
              }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Password"
              style={{
                background: '#f5f5f5',
                border: '1px solid #e8e8e8',
                color: '#333',
                borderRadius: 12,
              }}
            />
          </Form.Item>

          <div style={{ marginBottom: 24, textAlign: 'right' }}>
            <Link to="/login" style={{ color: '#00A2FF', fontSize: 14 }}>
              Forgot password?
            </Link>
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
              block
              style={{
                height: 48,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #00A2FF 0%, #0077FF 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0, 162, 255, 0.3)',
              }}
            >
              Log In <ArrowRightOutlined />
            </Button>
          </Form.Item>

          <Divider style={{ borderColor: '#f0f0f0' }}>
            <Text style={{ color: '#bfbfbf', fontSize: 12 }}>
              OR CONTINUE WITH
            </Text>
          </Divider>

          <Button
            block
            icon={<GithubOutlined />}
            style={{
              height: 48,
              borderRadius: 12,
              background: '#ffffff',
              color: '#333',
              borderColor: '#e8e8e8',
            }}
          >
            GitHub
          </Button>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Text style={{ color: '#666666' }}>Don't have an account?</Text>{' '}
            <Link to="/register" style={{ color: '#00A2FF', fontWeight: 500 }}>
              Create now
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
