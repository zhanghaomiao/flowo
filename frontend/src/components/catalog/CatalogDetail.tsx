import React, { useState } from 'react';

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
  FileAddOutlined,
  FileTextOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PushpinOutlined,
  SettingOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  Button,
  Dropdown,
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
  Tree,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  deleteCatalogMutation,
  deleteFileMutation,
  getCatalogOptions,
  getCatalogQueryKey,
  gitPushMutation,
  renamePathMutation,
  syncCatalogsMutation,
  updateCatalogMutation,
  writeFileMutation,
} from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import type { CatalogFileInfo } from '@/client/types.gen';

import './CatalogDetail.css';

import Dag from '../job/dag/Dag';
import { type GraphData } from '../job/dag/useDag';

import CatalogEditor from './CatalogEditor';

dayjs.extend(relativeTime);

// Category display config (kept for specific icons)
const FILE_ICON_MAP: Record<string, React.ReactNode> = {
  Snakefile: <PushpinOutlined style={{ color: '#10b981' }} />, // emerald
  '.smk': <CodeOutlined style={{ color: '#10b981' }} />,
  '.py': <CodeOutlined style={{ color: '#3b82f6' }} />, // blue
  '.yaml': <SettingOutlined style={{ color: '#8b5cf6' }} />, // purple
  '.yml': <SettingOutlined style={{ color: '#8b5cf6' }} />,
  '.ipynb': <ExperimentOutlined style={{ color: '#f59e0b' }} />, // amber
  '.rst': <FileTextOutlined style={{ color: '#64748b' }} />, // slate
  '.md': <FileTextOutlined style={{ color: '#3b82f6' }} />,
};

interface TreeNode {
  title: React.ReactNode;
  key: string;
  isLeaf?: boolean;
  children?: TreeNode[];
  icon?: React.ReactNode;
  path: string;
  name: string;
}

interface Props {
  slug: string;
}

const CatalogDetail: React.FC<Props> = ({ slug }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: catalog,
    isLoading,
    error,
  } = useQuery({
    ...getCatalogOptions({ path: { slug } }),
    enabled: !!slug && slug !== '{slug}',
  });
  const updateMutation = useMutation(updateCatalogMutation());
  const deleteMutation = useMutation(deleteCatalogMutation());
  const gitMutation = useMutation(gitPushMutation());
  const writeFileMut = useMutation(writeFileMutation());
  const deleteFileMut = useMutation(deleteFileMutation());
  const renamePathMut = useMutation(renamePathMutation());
  const syncMutation = useMutation(syncCatalogsMutation());

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync({});
      queryClient.invalidateQueries({
        queryKey: getCatalogQueryKey({ path: { slug } }),
      });
      messageApi.success('Database synchronized with filesystem');
    } catch {
      // Handled by client
    }
  };

  const createDirMut = useMutation({
    mutationFn: async ({ slug, path }: { slug: string; path: string }) => {
      return client.post({
        url: `/api/v1/catalogs/${slug}/dirs/${path}`,
        security: [{ scheme: 'bearer', type: 'http' }],
      });
    },
  });

  const deleteDirMut = useMutation({
    mutationFn: async ({ slug, path }: { slug: string; path: string }) => {
      return client.delete({
        url: `/api/v1/catalogs/${slug}/dirs/${path}`,
        security: [{ scheme: 'bearer', type: 'http' }],
      });
    },
  });

  // Editor state
  const [editingFiles, setEditingFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');

  // Right panel mode: 'preview' (DAG) or 'editor'
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'editor'>(
    'preview',
  );

  // Inline creation state
  const [inlineCreate, setInlineCreate] = useState<{
    type: 'file' | 'folder';
    parentPath: string;
  } | null>(null);
  const [inlineCreateValue, setInlineCreateValue] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // Inline rename state
  const [inlineRename, setInlineRename] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [inlineRenameValue, setInlineRenameValue] = useState<string>('');

  // Edit metadata modal
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [metaForm] = Form.useForm();

  // Helper to build tree from flat files
  const buildTreeData = (files: CatalogFileInfo[]): TreeNode[] => {
    const root: TreeNode[] = [];
    const map: Record<string, TreeNode> = {};

    files.forEach((file) => {
      if (file.path.startsWith('.snakemake/') || file.path === '.snakemake') {
        return;
      }
      const parts = file.path.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        const isLastPart = index === parts.length - 1;
        const isLeafNode = isLastPart && !file.is_dir;
        const prevPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!map[currentPath]) {
          const ext = part.includes('.') ? `.${part.split('.').pop()}` : '';
          const icon = isLeafNode
            ? FILE_ICON_MAP[part] ||
              FILE_ICON_MAP[ext] || (
                <FileTextOutlined style={{ color: '#8c8c8c' }} />
              )
            : undefined; // Will be handled by Tree's icon prop

          const node: TreeNode = {
            title: part,
            key: currentPath,
            isLeaf: isLeafNode,
            icon: icon,
            path: currentPath,
            name: part,
          };
          map[currentPath] = node;

          if (!prevPath) {
            root.push(node);
          } else {
            const parent = map[prevPath];
            if (!parent.children) parent.children = [];
            parent.children.push(node);
          }
        }
      });
    });

    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((n) => n.children && sortNodes(n.children));
    };

    sortNodes(root);
    return root;
  };

  const treeData = catalog?.files
    ? buildTreeData(catalog.files as unknown as CatalogFileInfo[])
    : [];

  if (inlineCreate) {
    const inlineNode: TreeNode = {
      title: (
        <Input
          size="small"
          autoFocus
          value={inlineCreateValue}
          onChange={(e) => setInlineCreateValue(e.target.value)}
          onPressEnter={() => {
            // Need to extract logic to a separate handler, we will define it below.
            const handleInlineCreateSubmit = async () => {
              if (!inlineCreate || !inlineCreateValue.trim()) {
                setInlineCreate(null);
                return;
              }
              setIsCreating(true);
              try {
                const parent = inlineCreate.parentPath
                  ? `${inlineCreate.parentPath}/`
                  : '';
                const fullPath = `${parent}${inlineCreateValue.trim()}`;
                if (inlineCreate.type === 'file') {
                  await writeFileMut.mutateAsync({
                    body: { content: `# ${inlineCreateValue.trim()}\n` },
                    path: { file_path: fullPath, slug },
                  });
                  messageApi.success(`File "${inlineCreateValue}" created`);
                  openFile(fullPath);
                } else {
                  await createDirMut.mutateAsync({ slug, path: fullPath });
                  messageApi.success(`Folder "${inlineCreateValue}" created`);
                  setExpandedKeys((prev) =>
                    Array.from(new Set([...prev, fullPath])),
                  );
                }
                queryClient.invalidateQueries({
                  queryKey: getCatalogQueryKey({ path: { slug } }),
                });
              } catch (err) {
                const errorMsg =
                  err instanceof Error ? err.message : 'Creation failed';
                messageApi.error(errorMsg);
              } finally {
                setIsCreating(false);
                setInlineCreate(null);
                setInlineCreateValue('');
              }
            };
            handleInlineCreateSubmit();
          }}
          onBlur={() => {
            setTimeout(() => {
              if (!isCreating) {
                setInlineCreate(null);
                setInlineCreateValue('');
              }
            }, 150);
          }}
          disabled={isCreating}
          style={{
            height: 24,
            padding: '0 4px',
            fontSize: 13,
            width: 'calc(100% - 24px)',
            margin: '1px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      key: 'inline-create',
      path: 'inline-create',
      name: 'inline-create',
      isLeaf: inlineCreate.type === 'file',
      icon:
        inlineCreate.type === 'file' ? (
          <FileTextOutlined style={{ color: '#8c8c8c' }} />
        ) : (
          <FolderOutlined style={{ color: '#595959' }} />
        ),
    };

    if (!inlineCreate.parentPath) {
      treeData.unshift(inlineNode);
    } else {
      const insertNode = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.path === inlineCreate.parentPath && !node.isLeaf) {
            node.children = node.children || [];
            node.children.unshift(inlineNode);
            return true;
          }
          if (node.children && insertNode(node.children)) return true;
        }
        return false;
      };
      insertNode(treeData);
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <Empty description="Catalog not found" style={{ padding: 120 }}>
        <Button onClick={() => navigate({ to: '/catalog' })}>
          Back to Catalogs
        </Button>
      </Empty>
    );
  }

  const openFile = (filePath: string) => {
    setEditingFiles((prev) =>
      prev.includes(filePath) ? prev : [...prev, filePath],
    );
    setActiveFile(filePath);
    setRightPanelMode('editor');
  };

  const handleDeleteFile = async (filePath: string) => {
    await deleteFileMut.mutateAsync({ path: { file_path: filePath, slug } });
    queryClient.invalidateQueries({
      queryKey: getCatalogQueryKey({ path: { slug } }),
    });
    messageApi.success('File deleted');
    setEditingFiles((prev) => {
      const next = prev.filter((f) => f !== filePath);
      if (activeFile === filePath) {
        if (next.length > 0) {
          setActiveFile(next[next.length - 1]);
        } else {
          setActiveFile('');
          setRightPanelMode('preview');
        }
      }
      return next;
    });
  };

  const handleDeleteFolder = async (path: string) => {
    if (!window.confirm(`Delete folder "${path}" and all its contents?`))
      return;

    try {
      await deleteDirMut.mutateAsync({ slug, path });
      queryClient.invalidateQueries({
        queryKey: getCatalogQueryKey({ path: { slug } }),
      });
      messageApi.success(`Folder "${path}" deleted`);
      // Close any open files that were in this folder
      setEditingFiles((prev) => {
        const next = prev.filter(
          (f) => !f.startsWith(`${path}/`) && f !== path,
        );
        if (activeFile === path || activeFile.startsWith(`${path}/`)) {
          if (next.length > 0) {
            setActiveFile(next[next.length - 1]);
          } else {
            setActiveFile('');
            setRightPanelMode('preview');
          }
        }
        return next;
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to delete folder';
      messageApi.error(errorMsg);
    }
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
        queryKey: getCatalogQueryKey({ path: { slug } }),
      });
      messageApi.success('Catalog updated');
      setEditMetaOpen(false);
    } catch {
      // validation error
    }
  };

  const renderFileTree = () => {
    if (treeData.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
          No files in this catalog
        </div>
      );
    }

    return (
      <div className="catalog-file-tree-container">
        <div className="catalog-tree-header">
          <span style={{ fontWeight: 600, fontSize: 13 }}>Files</span>
          <div className="catalog-tree-actions">
            <Tooltip title="New Root File">
              <Button
                size="small"
                type="text"
                icon={<FileAddOutlined />}
                onClick={() => {
                  setInlineCreate({ type: 'file', parentPath: '' });
                  setInlineCreateValue('');
                }}
              />
            </Tooltip>
            <Tooltip title="New Root Folder">
              <Button
                size="small"
                type="text"
                icon={<FolderAddOutlined />}
                onClick={() => {
                  setInlineCreate({ type: 'folder', parentPath: '' });
                  setInlineCreateValue('');
                }}
              />
            </Tooltip>
          </div>
        </div>
        <Tree
          showIcon
          blockNode
          className="catalog-file-tree"
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          icon={(props: {
            isLeaf?: boolean;
            expanded?: boolean;
            icon?: React.ReactNode;
          }) => {
            if (props.isLeaf) return props.icon;
            return props.expanded ? (
              <FolderOpenOutlined style={{ color: '#595959' }} />
            ) : (
              <FolderOutlined style={{ color: '#595959' }} />
            );
          }}
          onSelect={(_, info) => {
            const node = info.node as TreeNode;
            if (node.key === 'inline-create') return;
            if (node.isLeaf) {
              openFile(node.path);
            }
          }}
          titleRender={(node: TreeNode) => {
            if (inlineRename?.path === node.path) {
              return (
                <div
                  className="tree-node-render"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    size="small"
                    autoFocus
                    value={inlineRenameValue}
                    onChange={(e) => setInlineRenameValue(e.target.value)}
                    disabled={renamePathMut.isPending}
                    style={{
                      height: 24,
                      padding: '0 4px',
                      fontSize: 13,
                      width: '100%',
                      margin: '1px 0',
                    }}
                    onPressEnter={async () => {
                      const newName = inlineRenameValue.trim();
                      if (!newName || newName === node.name) {
                        setInlineRename(null);
                        return;
                      }
                      const parentPath = node.path.substring(
                        0,
                        node.path.length - node.name.length,
                      );
                      const newPath = `${parentPath}${newName}`;

                      try {
                        await renamePathMut.mutateAsync({
                          body: { old_path: node.path, new_path: newPath },
                          path: { slug },
                        });
                        messageApi.success(`Renamed to "${newName}"`);

                        // Handle open files rename
                        setEditingFiles((prev) =>
                          prev.map((f) =>
                            f === node.path || f.startsWith(`${node.path}/`)
                              ? f.replace(node.path, newPath)
                              : f,
                          ),
                        );
                        if (
                          activeFile === node.path ||
                          activeFile.startsWith(`${node.path}/`)
                        ) {
                          setActiveFile(activeFile.replace(node.path, newPath));
                        }

                        queryClient.invalidateQueries({
                          queryKey: getCatalogQueryKey({ path: { slug } }),
                        });
                      } catch (err) {
                        const errorMsg =
                          err instanceof Error ? err.message : 'Rename failed';
                        messageApi.error(errorMsg);
                      } finally {
                        setInlineRename(null);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (!renamePathMut.isPending) {
                          setInlineRename(null);
                        }
                      }, 150);
                    }}
                  />
                </div>
              );
            }

            return (
              <div className="tree-node-render">
                <span className="tree-node-title">{node.title}</span>
                <div
                  className="tree-node-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!node.isLeaf && (
                    <>
                      <Tooltip title="New file here">
                        <Button
                          size="small"
                          type="text"
                          icon={<FileAddOutlined style={{ fontSize: 12 }} />}
                          onClick={() => {
                            setInlineCreate({
                              type: 'file',
                              parentPath: node.path,
                            });
                            setInlineCreateValue('');
                            setExpandedKeys((prev) =>
                              Array.from(new Set([...prev, node.path])),
                            );
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="New folder here">
                        <Button
                          size="small"
                          type="text"
                          icon={<FolderAddOutlined style={{ fontSize: 12 }} />}
                          onClick={() => {
                            setInlineCreate({
                              type: 'folder',
                              parentPath: node.path,
                            });
                            setInlineCreateValue('');
                            setExpandedKeys((prev) =>
                              Array.from(new Set([...prev, node.path])),
                            );
                          }}
                        />
                      </Tooltip>
                    </>
                  )}
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'rename',
                          label: 'Rename',
                          icon: <EditOutlined />,
                          onClick: () => {
                            setInlineRename({
                              path: node.path,
                              name: node.name,
                            });
                            setInlineRenameValue(node.name);
                          },
                        },
                        { type: 'divider' },
                        {
                          key: 'delete',
                          label: 'Delete',
                          danger: true,
                          icon: <DeleteOutlined />,
                          onClick: () => {
                            if (node.isLeaf) handleDeleteFile(node.path);
                            else handleDeleteFolder(node.path);
                          },
                        },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <Button
                      size="small"
                      type="text"
                      icon={<SettingOutlined style={{ fontSize: 10 }} />}
                    />
                  </Dropdown>
                </div>
              </div>
            );
          }}
        />
      </div>
    );
  };

  return (
    <div style={{ margin: '0 auto', padding: '16px 24px' }}>
      {contextHolder}
      {/* Compact header toolbar */}
      <div className="catalog-detail-toolbar">
        <div className="catalog-toolbar-left">
          <span
            className="catalog-back-link"
            onClick={() => navigate({ to: '/catalog' })}
          >
            <ArrowLeftOutlined />
            Catalogs
          </span>
          <span className="catalog-toolbar-sep">/</span>
          <Tooltip
            title={catalog.description || undefined}
            placement="bottomLeft"
          >
            <span className="catalog-toolbar-name">{catalog.name}</span>
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
            v{catalog.version}
          </Tag>
          {catalog.tags?.map((tag: string) => (
            <Tag
              key={tag}
              color="geekblue"
              style={{ fontSize: 11, margin: 0, lineHeight: '20px' }}
            >
              {tag}
            </Tag>
          ))}
        </div>
        <div className="catalog-toolbar-right">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              metaForm.setFieldsValue({
                name: catalog.name,
                description: catalog.description,
                version: catalog.version,
                tags: catalog.tags?.join(', '),
              });
              setEditMetaOpen(true);
            }}
          >
            Edit Info
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            href={`/api/v1/catalogs/${slug}/export`}
          >
            Export
          </Button>
          <Button
            size="small"
            icon={<SyncOutlined />}
            loading={gitMutation.isPending}
            onClick={async () => {
              try {
                const result = await gitMutation.mutateAsync({
                  body: {},
                });

                const status = (result as { status?: string })?.status;
                if (status === 'nothing_to_push') {
                  messageApi.info(
                    'Nothing new to push — catalogs are already up to date.',
                    3,
                  );
                } else {
                  messageApi.success('Catalogs pushed successfully!', 3);
                }
              } catch (err: unknown) {
                console.error('Git push failed:', err);
                const errorMsg =
                  err instanceof Error
                    ? err.message
                    : 'Failed to push catalogs. Check your Git settings.';
                messageApi.error(errorMsg, 5);
              }
            }}
          >
            Push to Git
          </Button>
          <Tooltip title="Sync database from filesystem">
            <Button
              size="small"
              icon={<SyncOutlined spin={syncMutation.isPending} />}
              onClick={handleSync}
              loading={syncMutation.isPending}
            >
              Sync
            </Button>
          </Tooltip>
          <Popconfirm
            title={`Delete "${catalog.name}"?`}
            description="This will permanently delete the catalog and all its files."
            onConfirm={async () => {
              await deleteMutation.mutateAsync({ path: { slug } });
              messageApi.success('Catalog deleted');
              navigate({ to: '/catalog' });
            }}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
            placement="bottomRight"
          >
            <Button
              className="catalog-btn-delete"
              size="small"
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* Main content: file browser + editor */}
      <div className="catalog-detail-content">
        {/* File tree panel */}
        <div className="catalog-file-panel">
          {renderFileTree()}

          {/* Footer metadata */}
          <div className="catalog-detail-footer">
            <span className="catalog-footer-item">
              <UserOutlined />
              <span className="catalog-footer-value">{catalog.owner}</span>
            </span>
            <span className="catalog-footer-item">
              <CalendarOutlined />
              Created{' '}
              <span className="catalog-footer-value">
                {dayjs(catalog.created_at).format('YYYY-MM-DD HH:mm')}
              </span>
            </span>
            <span className="catalog-footer-item">
              <ClockCircleOutlined />
              Updated{' '}
              <span className="catalog-footer-value">
                {dayjs(catalog.updated_at).fromNow()}
              </span>
            </span>
            <span className="catalog-footer-item">
              <EyeOutlined />
              {catalog.is_public ? (
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
        <div className="catalog-editor-panel">
          {/* Panel header with toggle */}
          <div className="catalog-panel-header">
            <span className="catalog-panel-title">
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
                  disabled: !catalog?.has_snakefile,
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
          <div className="catalog-panel-body">
            {rightPanelMode === 'editor' ? (
              <CatalogEditor
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
            ) : catalog?.has_snakefile ? (
              <Dag
                catalogSlug={slug}
                initialData={catalog.rulegraph_data as unknown as GraphData}
              />
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

      {/* Edit Metadata Modal */}
      <Modal
        title="Edit Catalog Info"
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

export default CatalogDetail;
