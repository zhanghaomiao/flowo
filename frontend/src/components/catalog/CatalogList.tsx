import React, { useState } from 'react';

import {
  CloudDownloadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Button,
  Dropdown,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  createCatalogMutation,
  deleteCatalogMutation,
  gitPullMutation,
  importFromGitMutation,
  listCatalogsQueryKey,
  syncCatalogsMutation,
  useListCatalogsQuery,
} from '@/client/@tanstack/react-query.gen';
import type { CatalogSummary } from '@/client/types.gen';

dayjs.extend(relativeTime);

const { Title } = Typography;

const CatalogList: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importGitOpen, setImportGitOpen] = useState(false);
  const [form] = Form.useForm();
  const [gitImportForm] = Form.useForm();

  const { data: catalogs, isLoading } = useListCatalogsQuery({
    query: { search: search || undefined },
  });
  const createMutation = useMutation(createCatalogMutation());
  const deleteMutation = useMutation(deleteCatalogMutation());
  const importGitMutation = useMutation(importFromGitMutation());
  const gitPullMut = useMutation(gitPullMutation());
  const syncMutation = useMutation(syncCatalogsMutation());

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync({});
      queryClient.invalidateQueries({ queryKey: listCatalogsQueryKey() });
      message.success('Database synchronized with filesystem');
    } catch {
      // Handled by client
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const tagsArray = values.tags
        ? values.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [];
      await createMutation.mutateAsync({
        body: {
          name: values.name,
          description: values.description || '',
          tags: tagsArray,
        },
      });
      queryClient.invalidateQueries({ queryKey: listCatalogsQueryKey() });
      message.success('Catalog created');
      setCreateOpen(false);
      form.resetFields();
    } catch {
      // Form validation error or API error
    }
  };

  const handleImportFromGit = async () => {
    try {
      const values = await gitImportForm.validateFields();
      const imported = await importGitMutation.mutateAsync({
        body: {
          git_url: values.git_url,
          token: values.token || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: listCatalogsQueryKey() });
      const count = Array.isArray(imported) ? imported.length : 1;
      message.success(
        `Successfully imported ${count} catalog${count > 1 ? 's' : ''} from Git!`,
      );
      setImportGitOpen(false);
      gitImportForm.resetFields();
    } catch {
      // API error is shown by the mutation
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CatalogSummary) => (
        <Space>
          <Link
            to="/catalog/$catalogSlug"
            params={{ catalogSlug: record.slug }}
            style={{ fontWeight: 500 }}
          >
            {name}
          </Link>
          <Tag color="blue" style={{ fontSize: 11 }}>
            v{record.version}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[] | undefined) =>
        (tags || []).map((tag) => (
          <Tag key={tag} color="geekblue">
            {tag}
          </Tag>
        )),
    },

    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (date: string) => dayjs(date).fromNow(),
      sorter: (a: CatalogSummary, b: CatalogSummary) =>
        dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: CatalogSummary) => (
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            href={`/api/v1/catalogs/${record.slug}/export`}
            title="Download"
          />
          <Popconfirm
            title={`Delete "${record.name}"?`}
            description="This will permanently delete the catalog and all its files."
            onConfirm={async () => {
              await deleteMutation.mutateAsync({ path: { slug: record.slug } });
              queryClient.invalidateQueries({
                queryKey: listCatalogsQueryKey(),
              });
              message.success('Catalog deleted');
            }}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
            placement="topRight"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Delete"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Catalog
        </Title>
        <Space>
          <Input
            placeholder="Search catalogs..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Tooltip title="Sync with filesystem (detect manual changes)">
            <Button
              icon={<SyncOutlined spin={syncMutation.isPending} />}
              onClick={handleSync}
              loading={syncMutation.isPending}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'new',
                  label: 'Create blank catalog',
                  icon: <PlusOutlined />,
                  onClick: () => setCreateOpen(true),
                },
                {
                  key: 'sync_git',
                  label: 'Sync from Git (Pull)',
                  icon: <SyncOutlined />,
                  onClick: async () => {
                    try {
                      await gitPullMut.mutateAsync({});
                      queryClient.invalidateQueries({
                        queryKey: listCatalogsQueryKey(),
                      });
                      message.success('Catalogs synced from Git successfully');
                    } catch {
                      // Handled by mutation
                    }
                  },
                },
                {
                  key: 'sync_fs',
                  label: 'Force Sync Filesystem',
                  icon: <SyncOutlined />,
                  onClick: handleSync,
                },
                {
                  key: 'git',
                  label: 'Import from custom Git URL',
                  icon: <CloudDownloadOutlined />,
                  onClick: () => setImportGitOpen(true),
                },
              ],
            }}
          >
            <Button type="primary" icon={<PlusOutlined />}>
              New Workflow
            </Button>
          </Dropdown>
        </Space>
      </div>

      <Table
        dataSource={catalogs || []}
        columns={columns}
        rowKey="slug"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        locale={{ emptyText: 'No catalogs found. Create your first one!' }}
      />

      {/* Create Catalog Modal */}
      <Modal
        title="Create New Workflow"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending}
        okText="Create"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Catalog Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g. RNA-Seq Pipeline" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={3}
              placeholder="Brief description of this workflow"
            />
          </Form.Item>
          <Form.Item name="tags" label="Tags (comma-separated)">
            <Input placeholder="e.g. rnaseq, alignment, production" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import from Git URL Modal */}
      <Modal
        title={
          <span>
            <CloudDownloadOutlined
              style={{ marginRight: 8, color: '#4f46e5' }}
            />
            Import Catalogs from Git
          </span>
        }
        open={importGitOpen}
        onOk={handleImportFromGit}
        onCancel={() => {
          setImportGitOpen(false);
          gitImportForm.resetFields();
        }}
        confirmLoading={importGitMutation.isPending}
        okText="Import"
      >
        <Form form={gitImportForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="git_url"
            label="Git Repository URL"
            rules={[{ required: true, message: 'Please enter a Git URL' }]}
            extra="Supports GitHub, GitLab, or any public/private Git repo. Monorepos with multiple catalogs are fully supported."
          >
            <Input placeholder="https://github.com/your-org/flowo-catalogs" />
          </Form.Item>
          <Form.Item
            name="token"
            label="Access Token (optional)"
            extra="Required for private repositories"
          >
            <Input.Password placeholder="ghp_..." autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CatalogList;
