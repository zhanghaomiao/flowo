import React, { useEffect, useRef, useState } from 'react';

import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileTextOutlined,
  FolderOutlined,
  PlusOutlined,
  PushpinOutlined,
  RightOutlined,
  SettingOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  Button,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Segmented,
  Spin,
  Tag,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  deleteFileMutation,
  deleteTemplateMutation,
  getTemplateOptions,
  getTemplateQueryKey,
  gitPushMutation,
  updateTemplateMutation,
  writeFileMutation,
} from '@/client/@tanstack/react-query.gen';
import type { TemplateFileInfo } from '@/client/types.gen';

import './TemplateDetail.css';

import Dag from '../job/dag/Dag';

import TemplateEditor from './TemplateEditor';

dayjs.extend(relativeTime);

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
  const queryClient = useQueryClient();
  const {
    data: template,
    isLoading,
    error,
  } = useQuery({
    ...getTemplateOptions({ path: { slug } }),
    enabled: !!slug && slug !== '{slug}',
  });
  const updateMutation = useMutation(updateTemplateMutation());
  const deleteMutation = useMutation(deleteTemplateMutation());
  const gitMutation = useMutation(gitPushMutation());
  const writeFileMut = useMutation(writeFileMutation());
  const deleteFileMut = useMutation(deleteFileMutation());

  // Editor state
  const [editingFiles, setEditingFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');

  // Right panel mode: 'preview' (DAG) or 'editor'
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'editor'>(
    'preview',
  );

  // Collapsible categories
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(['snakefile']),
  );

  // Add file modal
  const [addFileModal, setAddFileModal] = useState<{
    category: string;
    dir: string;
    ext: string;
  } | null>(null);
  const [addFileForm] = Form.useForm();

  // Edit metadata modal
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [pushGitOpen, setPushGitOpen] = useState(false);
  const [gitSyncResult, setGitSyncResult] = useState<string | null>(null);
  const [metaForm] = Form.useForm();
  const [gitForm] = Form.useForm();

  // Track if we've already done initial expansion for this slug
  const initialExpandDone = useRef<string | null>(null);

  // Auto-expand categories that have files when template loads
  useEffect(() => {
    if (template?.files && initialExpandDone.current !== slug) {
      setExpandedCats((prev) => {
        const next = new Set(prev);
        Object.entries(template.files).forEach(([catKey, files]) => {
          if (files && files.length > 0) {
            next.add(catKey);
          }
        });
        return next;
      });
      initialExpandDone.current = slug;
    }
  }, [template, slug]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <Empty description="Template not found" style={{ padding: 120 }}>
        <Button onClick={() => navigate({ to: '/templates' })}>
          Back to Templates
        </Button>
      </Empty>
    );
  }

  const toggleCategory = (catKey: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  };

  const openFile = (filePath: string) => {
    setEditingFiles((prev) =>
      prev.includes(filePath) ? prev : [...prev, filePath],
    );
    setActiveFile(filePath);
    setRightPanelMode('editor');
  };

  const handleAddFile = async () => {
    if (!addFileModal) return;
    try {
      const values = await addFileForm.validateFields();
      let fileName = values.filename.trim();
      if (addFileModal.ext && !fileName.endsWith(addFileModal.ext)) {
        fileName += addFileModal.ext;
      }
      const filePath = `${addFileModal.dir}/${fileName}`;
      await writeFileMut.mutateAsync({
        body: {
          content: `# ${fileName}\n`,
        },
        path: {
          file_path: filePath,
          slug,
        },
      });
      queryClient.invalidateQueries({
        queryKey: getTemplateQueryKey({ path: { slug } }),
      });
      message.success(`File "${fileName}" created`);
      setAddFileModal(null);
      addFileForm.resetFields();
      openFile(filePath);
    } catch {
      // validation error
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    await deleteFileMut.mutateAsync({ path: { file_path: filePath, slug } });
    queryClient.invalidateQueries({
      queryKey: getTemplateQueryKey({ path: { slug } }),
    });
    message.success('File deleted');
    setEditingFiles((prev) => prev.filter((f) => f !== filePath));
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
        body: {
          name: values.name,
          description: values.description,
          version: values.version,
          tags: tagsArray,
        },
        path: { slug },
      });
      queryClient.invalidateQueries({
        queryKey: getTemplateQueryKey({ path: { slug } }),
      });
      message.success('Template updated');
      setEditMetaOpen(false);
    } catch {
      // validation error
    }
  };

  const renderCategoryPanel = (catKey: string, files: TemplateFileInfo[]) => {
    const config = CATEGORY_CONFIG[catKey];
    if (!config) return null;

    const catInfo = template.categories?.[catKey];
    const isRequired = catInfo?.required || false;
    const isExpanded = expandedCats.has(catKey);

    return (
      <div key={catKey} className="template-category-panel">
        <div
          className="template-category-header"
          onClick={() => toggleCategory(catKey)}
        >
          <div className="template-category-header-left">
            <RightOutlined
              className={`template-category-chevron ${isExpanded ? 'expanded' : ''}`}
            />
            <span className={`template-category-icon ${catKey}`}>
              {config.icon}
            </span>
            <span className="template-category-label">{config.label}</span>
            {isRequired && (
              <Tag
                color="error"
                style={{ fontSize: 11, lineHeight: '18px', margin: 0 }}
              >
                required
              </Tag>
            )}
            {files.length > 0 && (
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                {files.length}
              </span>
            )}
          </div>
          <div
            className="template-category-actions"
            onClick={(e) => e.stopPropagation()}
          >
            {catKey !== 'snakefile' && (
              <Tooltip title={`Add ${config.label.toLowerCase()} file`}>
                <Button
                  size="small"
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setAddFileModal({
                      category: catKey,
                      dir: catInfo?.dir || '',
                      ext: config.defaultExt,
                    })
                  }
                />
              </Tooltip>
            )}
          </div>
        </div>

        {isExpanded && files.length > 0 && (
          <div className="template-file-list">
            {files.map((file) => (
              <div
                key={file.path}
                className="template-file-item"
                onClick={() => openFile(file.path)}
              >
                <div className="template-file-item-info">
                  <span className="template-file-name">{file.name}</span>
                </div>
                <div
                  className="template-file-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip title="Edit">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openFile(file.path)}
                    />
                  </Tooltip>
                  {catKey !== 'snakefile' && (
                    <Popconfirm
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
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ margin: '0 auto', padding: '16px 24px' }}>
      {/* Compact header toolbar */}
      <div className="template-detail-toolbar">
        <div className="template-toolbar-left">
          <span
            className="template-back-link"
            onClick={() => navigate({ to: '/templates' })}
          >
            <ArrowLeftOutlined />
            Templates
          </span>
          <span className="template-toolbar-sep">/</span>
          <Tooltip
            title={template.description || undefined}
            placement="bottomLeft"
          >
            <span className="template-toolbar-name">{template.name}</span>
          </Tooltip>
          <Tag
            color="blue"
            style={{
              fontSize: 11,
              padding: '0 6px',
              borderRadius: 10,
              fontWeight: 600,
              lineHeight: '20px',
              margin: 0,
            }}
          >
            v{template.version}
          </Tag>
          {template.tags?.map((tag: string) => (
            <Tag
              key={tag}
              color="geekblue"
              style={{ fontSize: 11, margin: 0, lineHeight: '20px' }}
            >
              {tag}
            </Tag>
          ))}
        </div>
        <div className="template-toolbar-right">
          <Button
            size="small"
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
            size="small"
            icon={<DownloadOutlined />}
            href={`/api/v1/templates/${slug}/export`}
          >
            Export
          </Button>
          <Button
            size="small"
            icon={<SyncOutlined />}
            onClick={() => {
              gitForm.setFieldsValue({
                remote_url: template?.source_url || '',
              });
              setGitSyncResult(null);
              setPushGitOpen(true);
            }}
          >
            Push to Git
          </Button>
          <Popconfirm
            title={`Delete "${template.name}"?`}
            description="This will permanently delete the template and all its files."
            onConfirm={async () => {
              await deleteMutation.mutateAsync({ path: { slug } });
              message.success('Template deleted');
              navigate({ to: '/templates' });
            }}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
            placement="bottomRight"
          >
            <Button
              className="template-btn-delete"
              size="small"
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* Main content: file browser + editor */}
      <div className="template-detail-content">
        {/* File browser panel */}
        <div className="template-file-panel">
          {/* Category panels */}
          {Object.entries(CATEGORY_CONFIG).map(([catKey]) =>
            renderCategoryPanel(catKey, template.files?.[catKey] || []),
          )}

          {/* README */}
          <div className="template-category-panel">
            <div className="template-category-header">
              <div className="template-category-header-left">
                <span className="template-category-icon snakefile">
                  <FileTextOutlined />
                </span>
                <span className="template-category-label">README</span>
                {(template.files?.readme?.length || 0) > 0 && (
                  <span
                    style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}
                  >
                    {template.files?.readme?.length}
                  </span>
                )}
              </div>
              <div
                className="template-category-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {template.files?.readme?.length ? (
                  <Tooltip title="Edit README">
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openFile('README.md')}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title="Create README">
                    <Button
                      size="small"
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={async () => {
                        await writeFileMut.mutateAsync({
                          body: {
                            content: `# ${template.name}\n\n${template.description || 'Describe your workflow here.'}\n`,
                          },
                          path: {
                            file_path: 'README.md',
                            slug,
                          },
                        });
                        message.success('README created');
                        openFile('README.md');
                      }}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
            {(template.files?.readme?.length || 0) > 0 && (
              <div className="template-file-list">
                {template.files?.readme?.map((file) => (
                  <div
                    key={file.path}
                    className="template-file-item"
                    onClick={() => openFile(file.path)}
                  >
                    <div className="template-file-item-info">
                      <span className="template-file-name">{file.name}</span>
                    </div>
                    <div
                      className="template-file-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title="Edit">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => openFile(file.path)}
                        />
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer metadata */}
          <div className="template-detail-footer">
            <span className="template-footer-item">
              <UserOutlined />
              <span className="template-footer-value">{template.owner}</span>
            </span>
            <span className="template-footer-item">
              <CalendarOutlined />
              Created{' '}
              <span className="template-footer-value">
                {dayjs(template.created_at).format('YYYY-MM-DD HH:mm')}
              </span>
            </span>
            <span className="template-footer-item">
              <ClockCircleOutlined />
              Updated{' '}
              <span className="template-footer-value">
                {dayjs(template.updated_at).fromNow()}
              </span>
            </span>
            <span className="template-footer-item">
              <EyeOutlined />
              {template.is_public ? (
                <Tag color="green" style={{ margin: 0 }}>
                  Public
                </Tag>
              ) : (
                <Tag style={{ margin: 0 }}>Private</Tag>
              )}
            </span>
          </div>
        </div>

        {/* Right panel: Preview / Editor */}
        <div className="template-editor-panel">
          {/* Panel header with toggle */}
          <div className="template-panel-header">
            <span className="template-panel-title">
              {rightPanelMode === 'editor' ? (
                <>
                  <CodeOutlined /> Editor
                </>
              ) : (
                <>
                  <ApartmentOutlined /> DAG Preview
                </>
              )}
            </span>
            <Segmented
              value={rightPanelMode}
              onChange={(val) => setRightPanelMode(val as 'preview' | 'editor')}
              options={[
                {
                  label: 'Preview',
                  value: 'preview',
                  icon: <ApartmentOutlined />,
                  disabled: !template?.has_snakefile,
                },
                {
                  label: 'Editor',
                  value: 'editor',
                  icon: <CodeOutlined />,
                },
              ]}
              size="small"
            />
          </div>

          {/* Panel content */}
          <div className="template-panel-body">
            {rightPanelMode === 'editor' ? (
              <TemplateEditor
                slug={slug}
                openFiles={editingFiles}
                activeFile={activeFile}
                onCloseAll={() => {
                  setEditingFiles([]);
                  setActiveFile('');
                  setRightPanelMode('preview');
                }}
                onClose={(filePath) =>
                  setEditingFiles((prev) => {
                    const next = prev.filter((f) => f !== filePath);
                    if (next.length === 0) {
                      setActiveFile('');
                      setRightPanelMode('preview');
                    }
                    return next;
                  })
                }
              />
            ) : template?.has_snakefile ? (
              <Dag templateSlug={slug} />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#999',
                }}
              >
                No Snakefile found — add one to preview the DAG
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add File Modal */}
      <Modal
        title={`Add ${addFileModal?.category || ''} file`}
        open={!!addFileModal}
        onOk={handleAddFile}
        onCancel={() => {
          setAddFileModal(null);
          addFileForm.resetFields();
        }}
        confirmLoading={writeFileMut.isPending}
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

      {/* Push to Git Modal */}
      <Modal
        title={
          <span>
            <SyncOutlined style={{ marginRight: 8, color: '#4f46e5' }} />
            Push All Templates to Git
          </span>
        }
        open={pushGitOpen}
        onOk={async () => {
          try {
            const values = await gitForm.validateFields();
            const result = await gitMutation.mutateAsync({
              body: {
                remote_url: values.remote_url || null,
                token: values.token || null,
              },
            });
            const url =
              (result as { remote_url?: string }).remote_url ??
              values.remote_url;
            setGitSyncResult(url || null);
            message.success(
              (result as { status?: string }).status === 'nothing_to_push'
                ? 'Nothing new to push — templates are already up to date.'
                : 'Templates pushed successfully!',
            );
          } catch {
            // error displayed by useMutation
          }
        }}
        onCancel={() => {
          setPushGitOpen(false);
          setGitSyncResult(null);
          gitForm.resetFields();
        }}
        confirmLoading={gitMutation.isPending}
        okText="Push to Git"
        okButtonProps={{ icon: <SyncOutlined /> }}
      >
        <Form form={gitForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="remote_url"
            label="Git Remote URL"
            extra="e.g. https://github.com/your-org/flowo-templates"
          >
            <Input placeholder="https://github.com/..." />
          </Form.Item>
          <Form.Item
            name="token"
            label="Access Token (optional)"
            extra="Personal access token for private repositories"
          >
            <Input.Password placeholder="ghp_..." autoComplete="off" />
          </Form.Item>
          {gitSyncResult && (
            <div
              style={{
                marginTop: 8,
                padding: '10px 12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#15803d',
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                ✅ Share this repository URL:
              </div>
              <Input
                value={gitSyncResult}
                readOnly
                size="small"
                addonAfter={
                  <Button
                    type="text"
                    size="small"
                    onClick={() => {
                      void navigator.clipboard.writeText(gitSyncResult);
                      message.success('Copied!');
                    }}
                  >
                    Copy
                  </Button>
                }
              />
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateDetail;
