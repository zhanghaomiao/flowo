import { useState } from 'react';

import {
  BranchesOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
  LoadingOutlined,
  MailOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Switch,
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
} from '@/client/@tanstack/react-query.gen';
import type { UserTokenResponse } from '@/client/types.gen';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionKey = 'git' | 'smtp' | 'tokens';

export interface UserSettings {
  git_remote_url?: string | null;
  git_token?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from?: string | null;
  smtp_use_tls?: boolean | null;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const API_BASE = '/api/v1/settings';

export function useSettingsQuery(token: string | null) {
  return useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const res = await fetch(API_BASE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load settings');
      return res.json() as Promise<UserSettings>;
    },
    enabled: !!token,
  });
}

function useUpdateSettings(token: string | null) {
  const qc = useQueryClient();
  return useMutation<UserSettings, Error, UserSettings>({
    mutationFn: async (body) => {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save settings');
      }
      return res.json() as Promise<UserSettings>;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['user-settings'] }),
  });
}

function useTestGit(token: string | null) {
  return useMutation<
    ConnectionTestResult,
    Error,
    { remote_url: string; token?: string | null }
  >({
    mutationFn: async (body) => {
      try {
        const res = await fetch(`${API_BASE}/test/git`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return {
            success: false,
            message: err.detail || `Server error (${res.status})`,
          };
        }
        return res.json() as Promise<ConnectionTestResult>;
      } catch (e) {
        return {
          success: false,
          message: e instanceof Error ? e.message : 'Network error',
        };
      }
    },
  });
}

function useTestSmtp(token: string | null) {
  return useMutation<
    ConnectionTestResult,
    Error,
    {
      smtp_host: string;
      smtp_port: number;
      smtp_user?: string | null;
      smtp_password?: string | null;
      smtp_use_tls: boolean;
    }
  >({
    mutationFn: async (body) => {
      try {
        const res = await fetch(`${API_BASE}/test/smtp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return {
            success: false,
            message: err.detail || `Server error (${res.status})`,
          };
        }
        return res.json() as Promise<ConnectionTestResult>;
      } catch (e) {
        return {
          success: false,
          message: e instanceof Error ? e.message : 'Network error',
        };
      }
    },
  });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Title level={5} style={{ margin: 0, fontWeight: 600 }}>
        {title}
      </Title>
      {subtitle && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {subtitle}
        </Text>
      )}
    </div>
  );
}

function TestBadge({
  result,
  loading,
}: {
  result?: ConnectionTestResult | null;
  loading: boolean;
}) {
  if (loading) return <LoadingOutlined style={{ color: '#4f46e5' }} />;
  if (!result) return null;
  return result.success ? (
    <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
      {result.message}
    </Tag>
  ) : (
    <Tag icon={<CloseCircleOutlined />} color="error" style={{ margin: 0 }}>
      {result.message}
    </Tag>
  );
}

// ─── Git Section ─────────────────────────────────────────────────────────────

function GitSection({
  initial,
  token,
  onSave,
}: {
  initial: UserSettings;
  token: string | null;
  onSave: () => void;
}) {
  const [form] = Form.useForm<{ git_remote_url: string; git_token: string }>();
  const updateMut = useUpdateSettings(token);
  const testMut = useTestGit(token);

  // seed once
  const [seeded, setSeeded] = useState(false);
  if (!seeded && initial.git_remote_url !== undefined) {
    form.setFieldsValue({
      git_remote_url: initial.git_remote_url ?? '',
      git_token: initial.git_token ?? '',
    });
    setSeeded(true);
  }

  const save = async () => {
    try {
      const v = await form.validateFields();
      await updateMut.mutateAsync({
        ...initial,
        git_remote_url: v.git_remote_url || null,
        git_token: v.git_token || null,
      });
      message.success('Git settings saved');
      onSave();
    } catch (e) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'name' in e &&
        e.name === 'ValidationError'
      )
        return;
      message.error(
        e instanceof Error ? e.message : 'Failed to save Git settings',
      );
    }
  };

  const test = async () => {
    const v = form.getFieldsValue();
    if (!v.git_remote_url) {
      message.warning('Enter a Remote URL first');
      return;
    }
    await testMut.mutateAsync({
      remote_url: v.git_remote_url,
      token: v.git_token || null,
    });
  };

  return (
    <>
      <SectionHeader
        title="Git Integration"
        subtitle="Push and share catalogs via a Git repository."
      />
      <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
        <Form.Item
          label="Remote Repository URL"
          name="git_remote_url"
          style={{ marginBottom: 12 }}
        >
          <Input
            prefix={<BranchesOutlined style={{ color: '#bbb' }} />}
            placeholder="https://gitlab.com/your-org/flowo-catalogs"
            allowClear
          />
        </Form.Item>
        <Form.Item
          label="Access Token"
          name="git_token"
          style={{ marginBottom: 16 }}
          extra={
            <span style={{ fontSize: 11, color: '#999' }}>
              PAT for private repositories
            </span>
          }
        >
          <Input.Password
            placeholder="your-personal-access-token"
            autoComplete="off"
            allowClear
          />
        </Form.Item>
        <Row gutter={8} align="middle" wrap>
          <Col>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              loading={updateMut.isPending}
              onClick={() => void save()}
            >
              Save
            </Button>
          </Col>
          <Col>
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              loading={testMut.isPending}
              onClick={() => void test()}
            >
              Test Connection
            </Button>
          </Col>
          <Col>
            <TestBadge result={testMut.data} loading={testMut.isPending} />
          </Col>
        </Row>
      </Form>

      <Alert
        style={{ marginTop: 16, maxWidth: 560 }}
        type="info"
        showIcon
        message={
          <span style={{ fontSize: 12 }}>
            Use <strong>Push to Git</strong> in any catalog to sync, then share
            the URL with others via <strong>Import from Git URL</strong>.
          </span>
        }
      />
    </>
  );
}

// ─── SMTP Section ─────────────────────────────────────────────────────────────

function SmtpSection({
  initial,
  token,
  onSave,
}: {
  initial: UserSettings;
  token: string | null;
  onSave: () => void;
}) {
  const [form] = Form.useForm<{
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_password: string;
    smtp_from: string;
    smtp_use_tls: boolean;
  }>();
  const updateMut = useUpdateSettings(token);
  const testMut = useTestSmtp(token);

  const [seeded, setSeeded] = useState(false);
  if (!seeded && initial.smtp_host !== undefined) {
    form.setFieldsValue({
      smtp_host: initial.smtp_host ?? '',
      smtp_port: initial.smtp_port ?? 587,
      smtp_user: initial.smtp_user ?? '',
      smtp_password: initial.smtp_password ?? '',
      smtp_from: initial.smtp_from ?? '',
      smtp_use_tls: initial.smtp_use_tls ?? true,
    });
    setSeeded(true);
  }

  const save = async () => {
    try {
      const v = await form.validateFields();
      await updateMut.mutateAsync({
        ...initial,
        smtp_host: v.smtp_host || null,
        smtp_port: v.smtp_port || null,
        smtp_user: v.smtp_user || null,
        smtp_password: v.smtp_password || null,
        smtp_from: v.smtp_from || null,
        smtp_use_tls: v.smtp_use_tls ?? true,
      });
      message.success('SMTP settings saved');
      onSave();
    } catch (e) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'name' in e &&
        e.name === 'ValidationError'
      )
        return;
      message.error(
        e instanceof Error ? e.message : 'Failed to save SMTP settings',
      );
    }
  };

  const test = async () => {
    const v = form.getFieldsValue();
    if (!v.smtp_host) {
      message.warning('Enter an SMTP host first');
      return;
    }
    await testMut.mutateAsync({
      smtp_host: v.smtp_host,
      smtp_port: v.smtp_port || 587,
      smtp_user: v.smtp_user || null,
      smtp_password: v.smtp_password || null,
      smtp_use_tls: v.smtp_use_tls ?? true,
    });
  };

  return (
    <>
      <SectionHeader
        title="SMTP Configuration"
        subtitle="Email server for workflow notifications."
      />
      <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
        <Row gutter={12}>
          <Col flex="1">
            <Form.Item
              label="SMTP Host"
              name="smtp_host"
              style={{ marginBottom: 12 }}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#bbb' }} />}
                placeholder="smtp.gmail.com"
              />
            </Form.Item>
          </Col>
          <Col style={{ width: 120 }}>
            <Form.Item
              label="Port"
              name="smtp_port"
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="587"
                min={1}
                max={65535}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="Username / Email"
          name="smtp_user"
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="you@example.com" autoComplete="off" />
        </Form.Item>
        <Form.Item
          label="Password"
          name="smtp_password"
          style={{ marginBottom: 12 }}
        >
          <Input.Password placeholder="••••••••" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="From Address"
          name="smtp_from"
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="FlowO <noreply@example.com>" />
        </Form.Item>
        <Form.Item
          label="Use TLS / SSL"
          name="smtp_use_tls"
          valuePropName="checked"
          style={{ marginBottom: 16 }}
        >
          <Switch checkedChildren="TLS" unCheckedChildren="Off" />
        </Form.Item>
        <Row gutter={8} align="middle" wrap>
          <Col>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              loading={updateMut.isPending}
              onClick={() => void save()}
            >
              Save
            </Button>
          </Col>
          <Col>
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              loading={testMut.isPending}
              onClick={() => void test()}
            >
              Test Connection
            </Button>
          </Col>
          <Col>
            <TestBadge result={testMut.data} loading={testMut.isPending} />
          </Col>
        </Row>
      </Form>
    </>
  );
}

// ─── Tokens Section (from profile page) ──────────────────────────────────────

const CodeBlock = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <pre
        style={{
          margin: 0,
          padding: '10px 36px 10px 12px',
          background: '#f5f5f5',
          borderRadius: 6,
          fontSize: 12,
          overflow: 'auto',
          maxHeight: 200,
          border: '1px solid #e8e8e8',
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
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            color: copied ? '#52c41a' : '#aaa',
          }}
        />
      </Tooltip>
    </div>
  );
};

function TokensSection({ authToken }: { authToken: string | null }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenTTL, setTokenTTL] = useState<number | undefined>();
  const [generated, setGenerated] = useState<string | null>(null);
  const [configModal, setConfigModal] = useState<{
    open: boolean;
    token: string;
    name: string;
  }>({ open: false, token: '', name: '' });

  const headers = { Authorization: `Bearer ${authToken}` };

  const { data: tokensData, isLoading } = useQuery({
    ...listTokensOptions({ headers }),
    enabled: !!authToken,
  });

  const { data: clientConfig } = useQuery({
    ...getClientConfigOptions({ headers }),
    enabled: !!authToken,
  });

  const createMut = useMutation(createTokenMutation({ headers }));
  const deleteMut = useMutation(deleteTokenMutation({ headers }));

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: listTokensQueryKey({ headers }) });

  const handleCreate = async () => {
    if (!tokenName) {
      message.error('Enter a token name');
      return;
    }
    try {
      const res = await createMut.mutateAsync({
        body: { name: tokenName, ttl_days: tokenTTL },
      });
      setGenerated(res.token ?? null);
      invalidate();
      setTokenName('');
      setTokenTTL(undefined);
    } catch {
      message.error('Failed to create token');
    }
  };

  const getEnvContent = (t: string) => {
    const tokenLine = t ? `FLOWO_USER_TOKEN=${t}` : '# FLOWO_USER_TOKEN=';
    return `FLOWO_HOST=${window.location.origin}\n${tokenLine}\nFLOWO_WORKING_PATH=${clientConfig?.FLOWO_WORKING_PATH ?? '<YOUR_WORKING_PATH>'}`;
  };

  const getCLICmd = (t: string) =>
    `flowo --generate-config --token ${t || '<YOUR_TOKEN>'} --host ${window.location.origin} --working-path ${clientConfig?.FLOWO_WORKING_PATH ?? '<YOUR_WORKING_PATH>'}`;

  return (
    <>
      <SectionHeader
        title="Access Tokens"
        subtitle="Tokens used by the Snakemake plugin to authenticate with FlowO."
      />

      <Button
        type="primary"
        size="small"
        icon={<PlusOutlined />}
        style={{ marginBottom: 12 }}
        onClick={() => {
          setCreateOpen(true);
          setGenerated(null);
        }}
      >
        Generate New Token
      </Button>

      <Table
        size="small"
        dataSource={tokensData?.tokens ?? []}
        loading={isLoading}
        rowKey="id"
        pagination={false}
        style={{ maxWidth: 640 }}
        columns={[
          { title: 'Name', dataIndex: 'name', key: 'name' },
          {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
          },
          {
            title: 'Expires',
            dataIndex: 'expires_at',
            key: 'expires_at',
            render: (d: string | null) =>
              d ? (
                <Tag color="orange">{dayjs(d).format('YYYY-MM-DD')}</Tag>
              ) : (
                <Tag color="green">Never</Tag>
              ),
          },
          {
            title: '',
            key: 'action',
            width: 100,
            render: (_: unknown, r: UserTokenResponse) => (
              <span style={{ display: 'flex', gap: 4 }}>
                <Button
                  size="small"
                  type="link"
                  style={{ padding: '0 4px' }}
                  onClick={() =>
                    setConfigModal({
                      open: true,
                      token: r.token ?? '',
                      name: r.name,
                    })
                  }
                >
                  Use
                </Button>
                <Popconfirm
                  title="Delete this token?"
                  onConfirm={async () => {
                    await deleteMut.mutateAsync({ path: { token_id: r.id } });
                    message.success('Deleted');
                    invalidate();
                  }}
                  okText="Delete"
                  okType="danger"
                  cancelText="No"
                >
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />

      {/* Create Modal */}
      <Modal
        title="Generate New Token"
        open={createOpen}
        footer={null}
        width={600}
        onCancel={() => {
          setCreateOpen(false);
          setGenerated(null);
        }}
        destroyOnHidden
      >
        {!generated ? (
          <div style={{ marginTop: 8 }}>
            <Form layout="vertical">
              <Form.Item label="Name" style={{ marginBottom: 12 }}>
                <Input
                  placeholder="e.g. Work Laptop"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Expiration" style={{ marginBottom: 16 }}>
                <Select
                  value={tokenTTL}
                  onChange={setTokenTTL}
                  placeholder="Never expire"
                  options={[
                    { value: undefined, label: 'Never expire' },
                    { value: 7, label: '7 Days' },
                    { value: 30, label: '30 Days' },
                    { value: 90, label: '90 Days' },
                    { value: 365, label: '1 Year' },
                  ]}
                />
              </Form.Item>
              <div style={{ textAlign: 'right' }}>
                <Button
                  type="primary"
                  onClick={() => void handleCreate()}
                  loading={createMut.isPending}
                >
                  Generate
                </Button>
              </div>
            </Form>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <Alert
              message="Token generated — copy it now, it won't be shown again."
              type="success"
              showIcon
              style={{ marginBottom: 12 }}
            />
            {renderConfigTabs(generated, getEnvContent, getCLICmd)}
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <Button
                type="primary"
                onClick={() => {
                  setCreateOpen(false);
                  setGenerated(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Config Modal */}
      <Modal
        title={`Use token: ${configModal.name}`}
        open={configModal.open}
        footer={
          <Button
            onClick={() => setConfigModal((s) => ({ ...s, open: false }))}
          >
            Close
          </Button>
        }
        width={600}
        onCancel={() => setConfigModal((s) => ({ ...s, open: false }))}
      >
        {renderConfigTabs(configModal.token, getEnvContent, getCLICmd)}
      </Modal>
    </>
  );
}

function renderConfigTabs(
  t: string,
  getEnvContent: (t: string) => string,
  getCLICmd: (t: string) => string,
) {
  return (
    <Tabs
      defaultActiveKey="cli"
      size="small"
      items={[
        {
          key: 'cli',
          label: 'CLI (auto-generate)',
          children: <CodeBlock text={getCLICmd(t)} />,
        },
        {
          key: 'manual',
          label: 'Manual (.env file)',
          children: <CodeBlock text={getEnvContent(t)} />,
        },
      ]}
    />
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

interface SettingsPageProps {
  token: string | null;
}

export function SettingsPage({ token }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SectionKey>('tokens');
  const { data: settings, isLoading, refetch } = useSettingsQuery(token);

  const isConfigured = (s: SectionKey) => {
    if (!settings) return false;
    if (s === 'git') return !!settings.git_remote_url;
    if (s === 'smtp') return !!settings.smtp_host;
    return false;
  };

  const menuGroups = [
    {
      type: 'group' as const,
      label: (
        <Text
          type="secondary"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Personal
        </Text>
      ),
      children: [
        { key: 'tokens', icon: <KeyOutlined />, label: 'Access Tokens' },
      ],
    },
    {
      type: 'group' as const,
      label: (
        <Text
          type="secondary"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Integrations
        </Text>
      ),
      children: [
        {
          key: 'git',
          icon: <BranchesOutlined />,
          label: (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              Git
              {isConfigured('git') && <Badge color="green" />}
            </span>
          ),
        },
        {
          key: 'smtp',
          icon: <MailOutlined />,
          label: (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              SMTP
              {isConfigured('smtp') && <Badge color="green" />}
            </span>
          ),
        },
      ],
    },
  ];

  return (
    <Layout style={{ minHeight: '100%', background: 'transparent' }}>
      <Sider
        width={200}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeSection]}
          style={{ border: 'none', paddingTop: 8 }}
          onClick={({ key }) => setActiveSection(key as SectionKey)}
          items={menuGroups}
        />
      </Sider>

      <Content
        style={{
          padding: '24px 32px',
          background: '#fafafa',
          minHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <LoadingOutlined style={{ fontSize: 28, color: '#4f46e5' }} />
            </div>
          ) : (
            <>
              {activeSection === 'git' && settings && (
                <GitSection
                  initial={settings}
                  token={token}
                  onSave={() => void refetch()}
                />
              )}
              {activeSection === 'smtp' && settings && (
                <SmtpSection
                  initial={settings}
                  token={token}
                  onSave={() => void refetch()}
                />
              )}
              {activeSection === 'tokens' && (
                <TokensSection authToken={token} />
              )}
            </>
          )}
        </div>
      </Content>
    </Layout>
  );
}
