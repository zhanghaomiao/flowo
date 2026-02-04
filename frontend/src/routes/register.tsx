import { useNavigate, Link } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { Form, Input, Button, Card, message, Typography, Divider } from 'antd';
import { LockOutlined, MailOutlined, UserAddOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { registerRegisterMutation } from '@/client/@tanstack/react-query.gen';

const { Title, Text } = Typography;

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
});

function RegisterComponent() {
  const navigate = useNavigate();
  const registerMutation = useMutation(registerRegisterMutation());

  const onFinish = async (values: any) => {
    try {
      await registerMutation.mutateAsync({
        body: {
          email: values.email,
          password: values.password,
        },
      });
      message.success('Registration successful! Please login.');
      navigate({ to: '/login' });
    } catch (error: any) {
      console.error(error);
      message.error('Registration failed. Email might already be taken.');
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #121212 0%, #1a1a2e 100%)',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 1000
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: 'absolute',
        top: '15%',
        right: '10%',
        width: '350px',
        height: '350px',
        background: 'rgba(0, 162, 255, 0.05)',
        borderRadius: '50%',
        filter: 'blur(90px)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '10%',
        width: '450px',
        height: '450px',
        background: 'rgba(123, 31, 162, 0.05)',
        borderRadius: '50%',
        filter: 'blur(110px)',
      }} />

      <Card
        style={{
          width: 440,
          borderRadius: 24,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
        bodyStyle={{ padding: '48px 40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, #00A2FF 0%, #7B1FA2 100%)',
            borderRadius: 16,
            margin: '0 auto 24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 8px 16px rgba(0, 162, 255, 0.3)'
          }}>
            <UserAddOutlined style={{ color: 'white', fontSize: 32 }} />
          </div>
          <Title level={2} style={{ color: 'white', marginBottom: 8, marginTop: 0 }}>Create Account</Title>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>Join FlowO for better workflow management</Text>
        </div>

        <Form
          name="register"
          onFinish={onFinish}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="email"
            rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}
          >
            <Input
              prefix={<MailOutlined style={{ color: 'rgba(255,255,255,0.25)' }} />}
              placeholder="Email address"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                borderRadius: 12
              }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Password is required' }, { min: 8, message: 'Minimum 8 characters' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.25)' }} />}
              placeholder="Password"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                borderRadius: 12
              }}
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
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.25)' }} />}
              placeholder="Confirm password"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                borderRadius: 12
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={registerMutation.isPending}
              block
              style={{
                height: 48,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #00A2FF 0%, #0077FF 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0, 162, 255, 0.3)'
              }}
            >
              Create Account <ArrowRightOutlined />
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)' }}>Already have an account?</Text>{' '}
            <Link to="/login" style={{ color: '#00A2FF', fontWeight: 500 }}>Sign in</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
