import {
  createTokenMutation,
  deleteTokenMutation,
  listTokensOptions,
  usersCurrentUserOptions,
} from '@/client/@tanstack/react-query.gen';
import { UserTokenResponse } from '@/client/types.gen';
import {
  DeleteOutlined,
  KeyOutlined,
  LogoutOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import { useAuth } from '../auth';

const { Text, Paragraph } = Typography;

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfileComponent,
});

function ProfileComponent() {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isTokenModalVisible, setIsTokenModalVisible] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenTTL, setNewTokenTTL] = useState<number | undefined>(undefined);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [targetToken, setTargetToken] = useState<string | null>(null);
  const [targetTokenName, setTargetTokenName] = useState<string>('');

  const { data: user, isLoading } = useQuery({
    ...usersCurrentUserOptions({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    enabled: !!token,
  });

  const { data: tokensData, isLoading: isTokensLoading } = useQuery({
    ...listTokensOptions({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    enabled: !!token,
  });

  const createTokenMut = useMutation(
    createTokenMutation({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );

  const deleteTokenMut = useMutation(
    deleteTokenMutation({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );

  const { data: clientConfig } = useQuery({
    queryKey: ['clientConfig'],
    queryFn: async () => {
      const response = await fetch('/api/v1/utils/client-config', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    },
    enabled: !!token,
  });

  const handleCreateToken = async () => {
    if (!newTokenName) {
      message.error('Please enter a token name');
      return;
    }

    try {
      const result = await createTokenMut.mutateAsync({
        body: {
          name: newTokenName,
          ttl_days: newTokenTTL,
        },
      });
      setGeneratedToken(result.token);
      queryClient.invalidateQueries({ queryKey: ['listTokens'] });
      setNewTokenName('');
      setNewTokenTTL(undefined);
    } catch (err) {
      message.error('Failed to create token');
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    try {
      await deleteTokenMut.mutateAsync({
        path: {
          token_id: tokenId,
        },
      });
      message.success('Token deleted');
      queryClient.invalidateQueries({ queryKey: ['listTokens'] });
    } catch (err) {
      message.error('Failed to delete token');
    }
  };

  const handleLogout = () => {
    logout();
    message.success('Logged out successfully');
  };

  const getConfigFileContent = (t: string) => {
    if (!clientConfig) return 'Loading configuration template...';
    const tokenLine = t ? `FLOWO_USER_TOKEN=${t}` : '# FLOWO_USER_TOKEN=';
    const host = window.location.origin;

    return `FLOWO_HOST=${host}
${tokenLine}
FLOWO_WORKING_PATH=${clientConfig.FLOWO_WORKING_PATH}`;
  };

  const getGenerateCommand = (t: string) => {
    return `flowo --generate-config --token ${t || '<YOUR_TOKEN>'}`;
  };

  if (isLoading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <div
      style={{
        padding: '12px',
        background: '#f5f5f5',
        minHeight: '90vh',
        width: '80%',
        margin: '0 auto',
      }}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <UserOutlined />
                User Profile
              </Space>
            }
            extra={
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <Button
                type="primary"
                danger
                ghost
                icon={<LogoutOutlined />}
                onClick={logout}
              >
                Logout
              </Button>
            }
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
              <Descriptions.Item label="ID">
                <Paragraph copyable style={{ marginBottom: 0 }}>
                  {user?.id}
                </Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={user?.is_active ? 'green' : 'red'}>
                  {user?.is_active ? 'Active' : 'Inactive'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title={
              <Space>
                <KeyOutlined />
                Access Tokens
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsTokenModalVisible(true)}
              >
                Generate New Token
              </Button>
            }
          >
            <Table
              dataSource={tokensData?.tokens || []}
              loading={isTokensLoading}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: 'Created',
                  dataIndex: 'created_at',
                  key: 'created_at',
                  render: (date: string) =>
                    dayjs(date).format('YYYY-MM-DD HH:mm'),
                },
                {
                  title: 'Expires',
                  dataIndex: 'expires_at',
                  key: 'expires_at',
                  render: (date: string | null) =>
                    date ? (
                      <Tag color="orange">
                        {dayjs(date).format('YYYY-MM-DD')}
                      </Tag>
                    ) : (
                      <Tag color="green">Never</Tag>
                    ),
                },
                {
                  title: 'Action',
                  key: 'action',
                  width: 150,
                  render: (_: any, record: UserTokenResponse) => (
                    <Space>
                      <Button
                        size="small"
                        type="link"
                        icon={<KeyOutlined />}
                        onClick={() => {
                          setTargetToken((record as any).token || '');
                          setTargetTokenName(record.name);
                          setConfigModalVisible(true);
                        }}
                      >
                        Config
                      </Button>
                      <Popconfirm
                        title="Delete this token?"
                        onConfirm={() => handleDeleteToken(record.id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          type="text"
                        />
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={`Configuration for "${targetTokenName || 'Token'}"`}
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        width={750}
        footer={[
          <Button key="close" onClick={() => setConfigModalVisible(false)}>
            Close
          </Button>,
        ]}
      >
        <div style={{ marginTop: 16 }}>
          <Alert
            message="Secure API Reporting"
            description="Use one of the methods below to configure your environment. Do not share your token."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Tabs
            defaultActiveKey="cli"
            items={[
              {
                key: 'cli',
                label: 'Auto-Generate (CLI)',
                children: (
                  <Descriptions layout="vertical" bordered size="small">
                    <Descriptions.Item label="Run this command in your terminal">
                      <Paragraph
                        copyable={{
                          text: getGenerateCommand(targetToken || ''),
                        }}
                        style={{ marginBottom: 0 }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            padding: 8,
                            background: '#f5f5f5',
                            borderRadius: 4,
                            fontSize: 12,
                            overflow: 'auto',
                          }}
                        >
                          {getGenerateCommand(targetToken || '')}
                        </pre>
                      </Paragraph>
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'manual',
                label: 'Manual Configuration',
                children: (
                  <>
                    <Descriptions layout="vertical" bordered size="small">
                      <Descriptions.Item label="File Content (~/.config/flowo/.env)">
                        <Paragraph
                          copyable={{
                            text: getConfigFileContent(
                              targetToken || '<YOUR_TOKEN>',
                            ),
                          }}
                          style={{ marginBottom: 0 }}
                        >
                          <pre
                            style={{
                              margin: 0,
                              padding: 8,
                              background: '#f5f5f5',
                              borderRadius: 4,
                              fontSize: 12,
                              maxHeight: 250,
                              overflow: 'auto',
                            }}
                          >
                            {getConfigFileContent(
                              targetToken || '<YOUR_TOKEN>',
                            )}
                          </pre>
                        </Paragraph>
                      </Descriptions.Item>
                    </Descriptions>
                  </>
                ),
              },
            ]}
          />
        </div>
      </Modal>

      <Modal
        title="Generate New Token"
        open={isTokenModalVisible}
        onCancel={() => setIsTokenModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {!generatedToken ? (
          <Form
            layout="vertical"
            onFinish={handleCreateToken}
            style={{ marginTop: 16 }}
          >
            <Form.Item label="Token Name" required>
              <Input
                placeholder="e.g. Work Laptop, Snakemake CI"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
            </Form.Item>
            <Form.Item label="Expiration">
              <Select
                placeholder="Select expiration"
                value={newTokenTTL}
                onChange={setNewTokenTTL}
                options={[
                  { value: undefined, label: 'Never Expire' },
                  { value: 7, label: '7 Days' },
                  { value: 30, label: '30 Days' },
                  { value: 90, label: '90 Days' },
                  { value: 365, label: '1 Year' },
                ]}
              />
            </Form.Item>
            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Space>
                <Button onClick={() => setIsTokenModalVisible(false)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onClick={handleCreateToken}
                  loading={createTokenMut.isPending}
                >
                  Generate
                </Button>
              </Space>
            </div>
          </Form>
        ) : (
          <div style={{ margin: '16px 0' }}>
            <Alert
              message="Token Generated Successfully"
              description="This token will only be shown once. Please save your configuration now."
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Descriptions
              title="Configuration File"
              layout="vertical"
              bordered
              size="small"
            >
              <Descriptions.Item label="~/.config/flowo/.env">
                <Paragraph
                  copyable={{ text: getConfigFileContent(generatedToken) }}
                  style={{ marginBottom: 0 }}
                >
                  <pre
                    style={{
                      margin: 0,
                      padding: 8,
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {getConfigFileContent(generatedToken)}
                  </pre>
                </Paragraph>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Button
                type="primary"
                onClick={() => setIsTokenModalVisible(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
