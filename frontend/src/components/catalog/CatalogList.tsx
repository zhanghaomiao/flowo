import React, { useState } from 'react';

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
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Download,
  ExternalLink,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  User,
} from 'lucide-react';

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
import { downloadFile } from '@/utils/download';

dayjs.extend(relativeTime);

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
      await createMutation.mutateAsync({
        body: {
          name: values.name,
          description: values.description || '',
          tags: values.tags || [],
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
      render: (name: string, record: CatalogSummary) => {
        const isGitHub = record.source_url?.includes('github.com');
        return (
          <Space>
            <Tooltip title={isGitHub ? 'GitHub Source' : 'Local Source'}>
              <a
                href={record.source_url || undefined}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 16,
                  marginRight: 2,
                }}
              >
                {isGitHub ? <ExternalLink size={16} /> : <User size={16} />}
              </a>
            </Tooltip>
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
        );
      },
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
            icon={<Download size={16} />}
            onClick={async () => {
              try {
                await downloadFile(
                  `/api/v1/catalog/${record.slug}/download`,
                  `${record.slug}.tar.gz`,
                );
              } catch {
                message.error('Download failed');
              }
            }}
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
              icon={<Trash2 size={16} />}
              title="Delete"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="w-full h-full">
      {/* Integrated Header */}
      <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <div className="flex flex-col">
          <h3 className="m-0 text-xl font-black text-slate-800 tracking-tight">
            Catalog
          </h3>
          <div className="text-[10px] uppercase font-black text-slate-400 mt-1 flex items-center gap-2">
            <span>{catalogs?.length || 0} templates available</span>
            <span className="h-1 w-1 rounded-full bg-slate-200" />
            <span>Ready to deploy</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search catalogs..."
            prefix={<Search size={18} className="text-slate-400" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 h-12 rounded-2xl border-none bg-slate-100/50 hover:bg-slate-100 transition-colors shadow-sm"
            allowClear
          />
          <Tooltip title="Sync with filesystem">
            <Button
              icon={
                <RefreshCcw
                  size={18}
                  className={syncMutation.isPending ? 'animate-spin' : ''}
                />
              }
              onClick={handleSync}
              loading={syncMutation.isPending}
              className="flex items-center justify-center h-12 w-12 rounded-2xl border-none text-slate-500 hover:text-sky-500 bg-slate-100/50 hover:bg-slate-100 transition-all duration-300 shadow-sm"
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'new',
                  label: 'Create blank catalog',
                  icon: <Plus size={16} />,
                  onClick: () => setCreateOpen(true),
                },
                {
                  key: 'sync_git',
                  label: 'Sync from Git (Pull)',
                  icon: <RefreshCcw size={16} />,
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
                  icon: <RefreshCcw size={16} />,
                  onClick: handleSync,
                },
                {
                  key: 'git',
                  label: 'Import from custom Git URL',
                  icon: <Download size={16} />,
                  onClick: () => setImportGitOpen(true),
                },
              ],
            }}
          >
            <Button
              type="primary"
              icon={<Plus size={18} />}
              className="h-11 px-6 flex items-center shadow-md bg-brand-500 hover:bg-brand-600 border-none rounded-2xl font-bold"
            >
              New Workflow
            </Button>
          </Dropdown>
        </div>
      </div>

      <div className="px-4 py-6">
        <Table
          dataSource={catalogs || []}
          columns={columns}
          rowKey="slug"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: 'No catalogs found. Create your first one!' }}
          className="bg-transparent"
        />
      </div>

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
          <Form.Item name="tags" label="Tags">
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="Add tags..."
              tokenSeparators={[',']}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import from Git URL Modal */}
      <Modal
        title={
          <span>
            <Download size={20} style={{ marginRight: 8, color: '#4f46e5' }} />
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
