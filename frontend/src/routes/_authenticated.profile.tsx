import { useState } from 'react';

import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
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
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';

import {
  createTokenMutation,
  deleteTokenMutation,
  getClientConfigOptions,
  listTokensOptions,
  listTokensQueryKey,
  usersCurrentUserOptions,
} from '@/client/@tanstack/react-query.gen';
import type { UserTokenSummary } from '@/client/types.gen';
import { copyTextToClipboard } from '@/utils/clipboard';

import { useAuth } from '../auth';

type TokenTtlChoice = 7 | 30 | 90 | 365 | 'never';
const DEFAULT_TOKEN_TTL: TokenTtlChoice = 90;
const ttlToApi = (c: TokenTtlChoice): number | undefined =>
  c === 'never' ? undefined : c;

const CodeBlock = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void (async () => {
      const ok = await copyTextToClipboard(text);
      if (ok) {
        setCopied(true);
        message.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } else {
        message.error('Could not copy to clipboard');
      }
    })();
  };

  return (
    <div style={{ position: 'relative' }}>
      <pre
        style={{
          margin: 0,
          padding: '12px',
          paddingRight: '40px',
          background: '#f5f5f5',
          borderRadius: 8,
          fontSize: 12,
          overflow: 'auto',
          maxHeight: 250,
          border: '1px solid #d9d9d9',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {text}
      </pre>
      <Tooltip title={copied ? 'Copied!' : 'Copy'}>
        <Button
          type="text"
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: copied ? '#52c41a' : 'rgba(0, 0, 0, 0.45)',
          }}
        />
      </Tooltip>
    </div>
  );
};

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfileComponent,
});

function ProfileComponent() {
  const { token, user } = useAuth();
  const isReadOnlyDemo = (user as { role?: string } | null)?.role === 'viewer';
  const queryClient = useQueryClient();
  const [isTokenModalVisible, setIsTokenModalVisible] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenTTL, setNewTokenTTL] =
    useState<TokenTtlChoice>(DEFAULT_TOKEN_TTL);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  useQuery({
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
    ...getClientConfigOptions({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
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
          ttl_days: ttlToApi(newTokenTTL),
        },
      });
      setGeneratedToken(result.token);
      queryClient.invalidateQueries({
        queryKey: listTokensQueryKey({
          headers: { Authorization: `Bearer ${token}` },
        }),
      });
      setNewTokenName('');
      setNewTokenTTL(DEFAULT_TOKEN_TTL);
    } catch (err) {
      console.error(err);
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
      queryClient.invalidateQueries({
        queryKey: listTokensQueryKey({
          headers: { Authorization: `Bearer ${token}` },
        }),
      });
    } catch {
      message.error('Failed to delete token');
    }
  };

  const getLoginCommand = () => {
    const host = window.location.origin;
    const workingPath =
      clientConfig?.FLOWO_WORKING_PATH || '<YOUR_WORKING_PATH>';
    return `flowo login --host ${host} --working-path ${workingPath}`;
  };

  const renderConfigTabs = () => (
    <Tabs
      defaultActiveKey="cli"
      items={[
        {
          key: 'cli',
          label: 'Auto-Generate (CLI)',
          children: (
            <Descriptions layout="vertical" bordered size="small">
              <Descriptions.Item label="Run this command in your terminal">
                <CodeBlock text={getLoginCommand()} />
              </Descriptions.Item>
            </Descriptions>
          ),
        },
      ]}
    />
  );

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
                <KeyOutlined />
                Access Tokens
              </Space>
            }
            extra={
              isReadOnlyDemo ? (
                <Tag color="blue">Demo read-only</Tag>
              ) : (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setNewTokenTTL(DEFAULT_TOKEN_TTL);
                    setIsTokenModalVisible(true);
                  }}
                >
                  Generate New Token
                </Button>
              )
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
                  width: 100,
                  render: (_: unknown, record: UserTokenSummary) =>
                    isReadOnlyDemo ? null : (
                      <Space>
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
        title="Generate New Token"
        open={isTokenModalVisible}
        onCancel={() => {
          setIsTokenModalVisible(false);
          setGeneratedToken(null);
          setNewTokenTTL(DEFAULT_TOKEN_TTL);
        }}
        footer={null}
        width={750}
        destroyOnHidden
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
            <Form.Item
              label="Expiration"
              extra='90 days or 1 year is recommended. "No expiration" only if you have a strong rotation process.'
            >
              <Select<TokenTtlChoice>
                value={newTokenTTL}
                onChange={setNewTokenTTL}
                options={[
                  { value: 90, label: '90 days (recommended)' },
                  { value: 365, label: '1 year' },
                  { value: 30, label: '30 days' },
                  { value: 7, label: '7 days' },
                  {
                    value: 'never',
                    label: 'No expiration (not recommended)',
                  },
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
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Alert
              type="warning"
              showIcon
              message="This secret is shown only once"
              description={
                <span>
                  Save it to a password manager, cluster secret store, or CI
                  vault. Flowo will not show the full token again. For normal
                  CLI setup, use{' '}
                  <Typography.Text code>flowo login --host …</Typography.Text>{' '}
                  to avoid manual copy/paste.
                </span>
              }
              style={{ marginBottom: 24 }}
            />
            {renderConfigTabs()}
            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <Button
                type="primary"
                onClick={() => {
                  setIsTokenModalVisible(false);
                  setGeneratedToken(null);
                  setNewTokenTTL(DEFAULT_TOKEN_TTL);
                }}
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
