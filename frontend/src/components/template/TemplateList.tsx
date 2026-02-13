import React, { useState } from 'react';

import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
} from '@/api/templates';

dayjs.extend(relativeTime);

const { Title } = Typography;

const TemplateList: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: templates, isLoading } = useTemplates(search || undefined);
  const createMutation = useCreateTemplate();
  const deleteMutation = useDeleteTemplate();

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
        name: values.name,
        description: values.description || '',
        tags: tagsArray,
      });
      message.success('Template created');
      setCreateOpen(false);
      form.resetFields();
    } catch {
      // Form validation error or API error
    }
  };

  const handleDelete = (slug: string, name: string) => {
    Modal.confirm({
      title: `Delete "${name}"?`,
      content: 'This will permanently delete the template and all its files.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        await deleteMutation.mutateAsync(slug);
        message.success('Template deleted');
      },
    });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: { slug: string; version: string }) => (
        <Space>
          <a
            onClick={() => navigate({ to: `/templates/${record.slug}` })}
            style={{ fontWeight: 500 }}
          >
            {name}
          </a>
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
      sorter: (a: { updated_at: string }, b: { updated_at: string }) =>
        dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: { slug: string; name: string }) => (
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            href={`/api/v1/templates/${record.slug}/export`}
            title="Export"
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.slug, record.name)}
            title="Delete"
          />
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            New Template
          </Button>
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
    </div>
  );
};

export default TemplateList;
