import React, { useState } from 'react';

import {
  CloudDownloadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  PlusOutlined,
  SearchOutlined,
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
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  createTemplateMutation,
  deleteTemplateMutation,
  importFromGitMutation,
  listTemplatesQueryKey,
  useListTemplatesQuery,
} from '@/client/@tanstack/react-query.gen';
import type { TemplateSummary } from '@/client/types.gen';

dayjs.extend(relativeTime);

const { Title } = Typography;

const TemplateList: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importGitOpen, setImportGitOpen] = useState(false);
  const [form] = Form.useForm();
  const [gitImportForm] = Form.useForm();

  const { data: templates, isLoading } = useListTemplatesQuery({
    query: { search: search || undefined },
  });
  const createMutation = useMutation(createTemplateMutation());
  const deleteMutation = useMutation(deleteTemplateMutation());
  const importGitMutation = useMutation(importFromGitMutation());

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
      queryClient.invalidateQueries({ queryKey: listTemplatesQueryKey() });
      message.success('Template created');
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
      queryClient.invalidateQueries({ queryKey: listTemplatesQueryKey() });
      const count = Array.isArray(imported) ? imported.length : 1;
      message.success(
        `Successfully imported ${count} template${count > 1 ? 's' : ''} from Git!`,
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
      render: (name: string, record: TemplateSummary) => (
        <Space>
          <Link
            to="/templates/$templateSlug"
            params={{ templateSlug: record.slug }}
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
      title: 'Files',
      dataIndex: 'file_count',
      key: 'file_count',
      width: 80,
      render: (count: number) => (
        <Space size={4}>
          <FileOutlined />
          {count}
        </Space>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (date: string) => dayjs(date).fromNow(),
      sorter: (a: TemplateSummary, b: TemplateSummary) =>
        dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: TemplateSummary) => (
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            href={`/api/v1/templates/${record.slug}/export`}
            title="Download"
          />
          <Popconfirm
            title={`Delete "${record.name}"?`}
            description="This will permanently delete the template and all its files."
            onConfirm={async () => {
              await deleteMutation.mutateAsync({ path: { slug: record.slug } });
              queryClient.invalidateQueries({
                queryKey: listTemplatesQueryKey(),
              });
              message.success('Template deleted');
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
          Workflow Templates
        </Title>
        <Space>
          <Input
            placeholder="Search templates..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'new',
                  label: 'Create blank template',
                  icon: <PlusOutlined />,
                  onClick: () => setCreateOpen(true),
                },
                {
                  key: 'git',
                  label: 'Import from Git URL',
                  icon: <CloudDownloadOutlined />,
                  onClick: () => setImportGitOpen(true),
                },
              ],
            }}
          >
            <Button type="primary" icon={<PlusOutlined />}>
              New Template
            </Button>
          </Dropdown>
        </Space>
      </div>

      <Table
        dataSource={templates || []}
        columns={columns}
        rowKey="slug"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        locale={{ emptyText: 'No templates found. Create your first one!' }}
      />

      {/* Create Template Modal */}
      <Modal
        title="Create New Template"
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
            label="Template Name"
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
            Import Templates from Git
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
            extra="Supports GitHub, GitLab, or any public/private Git repo. Monorepos with multiple templates are fully supported."
          >
            <Input placeholder="https://github.com/your-org/flowo-templates" />
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

export default TemplateList;
