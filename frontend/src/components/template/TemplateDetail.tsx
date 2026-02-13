import React, { useState } from 'react';

import {
  CodeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FolderOutlined,
  PushpinOutlined,
  SettingOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  type TemplateFileInfo,
  useDeleteTemplate,
  useDeleteTemplateFile,
  useTemplate,
  useUpdateTemplate,
  useWriteTemplateFile,
} from '@/api/templates';

import TemplateEditor from './TemplateEditor';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

// Category display config
const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; defaultExt: string }
> = {
  snakefile: {
    label: 'Snakefile',
    icon: <PushpinOutlined />,
    defaultExt: '',
  },
  rules: {
    label: 'Rules',
    icon: <CodeOutlined />,
    defaultExt: '.smk',
  },
  envs: {
    label: 'Environments',
    icon: <FolderOutlined />,
    defaultExt: '.yaml',
  },
  scripts: {
    label: 'Scripts',
    icon: <FileTextOutlined />,
    defaultExt: '.py',
  },
  config: {
    label: 'Config',
    icon: <SettingOutlined />,
    defaultExt: '.yaml',
  },
  notebooks: {
    label: 'Notebooks',
    icon: <ExperimentOutlined />,
    defaultExt: '.ipynb',
  },
  report: {
    label: 'Report',
    icon: <FileTextOutlined />,
    defaultExt: '.rst',
  },
};

interface Props {
  slug: string;
}

const TemplateDetail: React.FC<Props> = ({ slug }) => {
  const navigate = useNavigate();
  const { data: template, isLoading, error } = useTemplate(slug);
  const updateMutation = useUpdateTemplate(slug);
  const deleteMutation = useDeleteTemplate();
  const writeFileMutation = useWriteTemplateFile(slug);
  const deleteFileMutation = useDeleteTemplateFile(slug);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFiles, setEditingFiles] = useState<string[]>([]);

  // Add file modal
  const [addFileModal, setAddFileModal] = useState<{
    category: string;
    dir: string;
    ext: string;
  } | null>(null);
  const [addFileForm] = Form.useForm();

  // Edit metadata modal
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [metaForm] = Form.useForm();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <Empty description="Template not found" style={{ padding: 80 }}>
        <Button onClick={() => navigate({ to: '/templates' })}>
          Back to Templates
        </Button>
      </Empty>
    );
  }

  const openFile = (filePath: string) => {
    setEditingFiles((prev) =>
      prev.includes(filePath) ? prev : [...prev, filePath],
    );
    setEditorOpen(true);
  };

  const handleAddFile = async () => {
    if (!addFileModal) return;
    try {
      const values = await addFileForm.validateFields();
      let fileName = values.filename.trim();
      // Auto-append extension if missing
      if (addFileModal.ext && !fileName.endsWith(addFileModal.ext)) {
        fileName += addFileModal.ext;
      }
      const filePath = `${addFileModal.dir}/${fileName}`;
      await writeFileMutation.mutateAsync({
        filePath,
        content: `# ${fileName}\n`,
      });
      message.success(`File "${fileName}" created`);
      setAddFileModal(null);
      addFileForm.resetFields();
      // Open the new file in editor
      openFile(filePath);
    } catch {
      // validation error
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    await deleteFileMutation.mutateAsync(filePath);
    message.success('File deleted');
    // Remove from editor tabs if open
    setEditingFiles((prev) => prev.filter((f) => f !== filePath));
  };

  const handleDeleteTemplate = () => {
    Modal.confirm({
      title: `Delete "${template.name}"?`,
      content: 'This will permanently delete the template and all its files.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        await deleteMutation.mutateAsync(slug);
        message.success('Template deleted');
        navigate({ to: '/templates' });
      },
    });
  };

  const handleUpdateMeta = async () => {
    try {
      const values = await metaForm.validateFields();
      const tagsArray = values.tags
        ? values.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [];
      await updateMutation.mutateAsync({
        name: values.name,
        description: values.description,
        version: values.version,
        tags: tagsArray,
      });
      message.success('Template updated');
      setEditMetaOpen(false);
    } catch {
      // validation error
    }
  };

  const renderCategorySection = (catKey: string, files: TemplateFileInfo[]) => {
    const config = CATEGORY_CONFIG[catKey];
    if (!config) return null;

    const catInfo = template.categories?.[catKey];
    const isRequired = catInfo?.required || false;

    return (
      <div
        key={catKey}
        style={{
          padding: '16px 0',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: files.length > 0 ? 12 : 0,
          }}
        >
          <Space>
            {config.icon}
            <Text strong style={{ fontSize: 15 }}>
              {config.label}
            </Text>
            {isRequired && (
              <Tag color="red" style={{ fontSize: 11 }}>
                required
              </Tag>
            )}
            <Badge
              count={files.length}
              showZero
              style={{
                backgroundColor: files.length > 0 ? '#1677ff' : '#d9d9d9',
              }}
            />
          </Space>
          <Space>
            {catKey !== 'snakefile' && (
              <Button
                size="small"
                icon={<FileAddOutlined />}
                onClick={() =>
                  setAddFileModal({
                    category: catKey,
                    dir: catInfo?.dir || '',
                    ext: config.defaultExt,
                  })
                }
              >
                Add
              </Button>
            )}
            {files.length > 0 && (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openFile(files[0].path)}
              >
                Edit
              </Button>
            )}
          </Space>
        </div>

        {files.length > 0 && (
          <List
            size="small"
            dataSource={files}
            renderItem={(file) => (
              <List.Item
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
                actions={[
                  <Tooltip title="Edit" key="edit">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openFile(file.path)}
                    />
                  </Tooltip>,
                  ...(catKey !== 'snakefile'
                    ? [
                        <Popconfirm
                          key="delete"
                          title={`Delete "${file.name}"?`}
                          onConfirm={() => handleDeleteFile(file.path)}
                          okText="Delete"
                          okType="danger"
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <List.Item.Meta
                  title={<a onClick={() => openFile(file.path)}>{file.name}</a>}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {file.lines} lines ·{' '}
                      {Math.round(file.size / 1024) || '<1'} KB ·{' '}
                      {dayjs(file.modified).fromNow()}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Space align="center">
            <Button type="text" onClick={() => navigate({ to: '/templates' })}>
              ← Templates
            </Button>
            <Title level={3} style={{ margin: 0 }}>
              {template.name}
            </Title>
            <Tag color="blue">v{template.version}</Tag>
          </Space>
          {template.description && (
            <Paragraph
              type="secondary"
              style={{ margin: '8px 0 0 0', maxWidth: 600 }}
            >
              {template.description}
            </Paragraph>
          )}
          {template.tags?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {template.tags.map((tag) => (
                <Tag key={tag} color="geekblue">
                  {tag}
                </Tag>
              ))}
            </div>
          )}
        </div>
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              metaForm.setFieldsValue({
                name: template.name,
                description: template.description,
                version: template.version,
                tags: template.tags?.join(', '),
              });
              setEditMetaOpen(true);
            }}
          >
            Edit Info
          </Button>
          <Button
            icon={<DownloadOutlined />}
            href={`/api/v1/templates/${slug}/export`}
          >
            Export
          </Button>
          <Button
            icon={<SyncOutlined />}
            disabled
            title="Git Sync (coming soon)"
          >
            Git Sync
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleDeleteTemplate}
          >
            Delete
          </Button>
        </Space>
      </div>

      {/* Category Sections */}
      <Row gutter={24}>
        <Col span={editorOpen ? 10 : 24}>
          <Card>
            {Object.entries(CATEGORY_CONFIG).map(([catKey]) =>
              renderCategorySection(catKey, template.files?.[catKey] || []),
            )}

            {/* README */}
            <Collapse
              ghost
              style={{ marginTop: 16 }}
              items={[
                {
                  key: 'readme',
                  label: (
                    <Space>
                      <FileTextOutlined />
                      <Text strong>README</Text>
                      <Badge
                        count={template.files?.readme?.length || 0}
                        showZero
                        style={{
                          backgroundColor:
                            (template.files?.readme?.length || 0) > 0
                              ? '#1677ff'
                              : '#d9d9d9',
                        }}
                      />
                    </Space>
                  ),
                  children: template.files?.readme?.length ? (
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openFile('README.md')}
                    >
                      Edit README
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      icon={<FileAddOutlined />}
                      onClick={async () => {
                        await writeFileMutation.mutateAsync({
                          filePath: 'README.md',
                          content: `# ${template.name}\n\n${template.description || 'Describe your workflow here.'}\n`,
                        });
                        message.success('README created');
                        openFile('README.md');
                      }}
                    >
                      Create README
                    </Button>
                  ),
                },
              ]}
            />

            {/* Action bar */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid #f0f0f0',
              }}
            >
              <Space>
                <Button
                  icon={<ExperimentOutlined />}
                  disabled
                  title="Preview DAG (coming soon)"
                >
                  Preview DAG
                </Button>
              </Space>
            </div>

            {/* Metadata */}
            <Descriptions
              size="small"
              column={2}
              style={{ marginTop: 16 }}
              items={[
                {
                  key: 'owner',
                  label: 'Owner',
                  children: template.owner,
                },
                {
                  key: 'created',
                  label: 'Created',
                  children: dayjs(template.created_at).format(
                    'YYYY-MM-DD HH:mm',
                  ),
                },
                {
                  key: 'updated',
                  label: 'Last Updated',
                  children: dayjs(template.updated_at).fromNow(),
                },
                {
                  key: 'visibility',
                  label: 'Visibility',
                  children: template.is_public ? (
                    <Tag color="green">Public</Tag>
                  ) : (
                    <Tag>Private</Tag>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Editor Panel (side by side) */}
        {editorOpen && (
          <Col span={14}>
            <Card
              title="Editor"
              extra={
                <Button
                  type="text"
                  size="small"
                  onClick={() => setEditorOpen(false)}
                >
                  ✕ Close
                </Button>
              }
              styles={{ body: { padding: 0, height: 'calc(100vh - 260px)' } }}
            >
              <TemplateEditor
                slug={slug}
                openFiles={editingFiles}
                onClose={(filePath) =>
                  setEditingFiles((prev) => {
                    const next = prev.filter((f) => f !== filePath);
                    if (next.length === 0) setEditorOpen(false);
                    return next;
                  })
                }
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* Add File Modal */}
      <Modal
        title={`Add ${addFileModal?.category || ''} file`}
        open={!!addFileModal}
        onOk={handleAddFile}
        onCancel={() => {
          setAddFileModal(null);
          addFileForm.resetFields();
        }}
        confirmLoading={writeFileMutation.isPending}
        okText="Create"
      >
        <Form form={addFileForm} layout="vertical">
          <Form.Item
            name="filename"
            label="Filename"
            rules={[{ required: true, message: 'Please enter a filename' }]}
            help={
              addFileModal?.ext
                ? `Will be saved to ${addFileModal.dir}/<filename>${addFileModal.ext}`
                : `Will be saved to ${addFileModal?.dir}/`
            }
          >
            <Input placeholder={`e.g. my_rule${addFileModal?.ext || ''}`} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Metadata Modal */}
      <Modal
        title="Edit Template Info"
        open={editMetaOpen}
        onOk={handleUpdateMeta}
        onCancel={() => setEditMetaOpen(false)}
        confirmLoading={updateMutation.isPending}
      >
        <Form form={metaForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="version" label="Version">
            <Input placeholder="0.1.0" />
          </Form.Item>
          <Form.Item name="tags" label="Tags (comma-separated)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateDetail;
