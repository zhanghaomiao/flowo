import React, { useState } from 'react';

import {
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PushpinOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dropdown, Input, message, Tooltip, Tree } from 'antd';

import {
  getCatalogQueryKey,
  renamePathMutation,
  writeFileMutation,
} from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import type { CatalogDetail, CatalogFileInfo } from '@/client/types.gen';

// Category display config
const FILE_ICON_MAP: Record<string, React.ReactNode> = {
  Snakefile: <PushpinOutlined style={{ color: '#10b981' }} />,
  '.smk': <CodeOutlined style={{ color: '#10b981' }} />,
  '.py': <CodeOutlined style={{ color: '#3b82f6' }} />,
  '.yaml': <SettingOutlined style={{ color: '#8b5cf6' }} />,
  '.yml': <SettingOutlined style={{ color: '#8b5cf6' }} />,
  '.ipynb': <ExperimentOutlined style={{ color: '#f59e0b' }} />,
  '.rst': <FileTextOutlined style={{ color: '#64748b' }} />,
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
  catalog: CatalogDetail;
  slug: string;
  onOpenFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFiles: (oldPath: string, newPath: string) => void;
}

const CatalogFileTree: React.FC<Props> = ({
  catalog,
  slug,
  onOpenFile,
  onDeleteFile,
  onDeleteFolder,
  onRenameFiles,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  const writeFileMut = useMutation(writeFileMutation());
  const renamePathMut = useMutation(renamePathMutation());

  const createDirMut = useMutation({
    mutationFn: async ({ slug, path }: { slug: string; path: string }) => {
      return client.post({
        url: `/api/v1/catalog/${slug}/dirs/${path}`,
        security: [{ scheme: 'bearer', type: 'http' }],
      });
    },
  });

  // Local state for tree management
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [inlineCreate, setInlineCreate] = useState<{
    type: 'file' | 'folder';
    parentPath: string;
  } | null>(null);
  const [inlineCreateValue, setInlineCreateValue] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const [inlineRename, setInlineRename] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [inlineRenameValue, setInlineRenameValue] = useState<string>('');

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
            : undefined;

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
          onOpenFile(fullPath);
        } else {
          await createDirMut.mutateAsync({ slug, path: fullPath });
          messageApi.success(`Folder "${inlineCreateValue}" created`);
          setExpandedKeys((prev) => Array.from(new Set([...prev, fullPath])));
        }
        queryClient.invalidateQueries({
          queryKey: getCatalogQueryKey({ path: { slug } }),
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Creation failed';
        messageApi.error(errorMsg);
      } finally {
        setIsCreating(false);
        setInlineCreate(null);
        setInlineCreateValue('');
      }
    };

    const inlineNode: TreeNode = {
      title: (
        <Input
          size="small"
          autoFocus
          value={inlineCreateValue}
          onChange={(e) => setInlineCreateValue(e.target.value)}
          onPressEnter={handleInlineCreateSubmit}
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

  return (
    <div className="catalog-file-tree-container">
      {contextHolder}
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
            onOpenFile(node.path);
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
                      onRenameFiles(node.path, newPath);
                      queryClient.invalidateQueries({
                        queryKey: getCatalogQueryKey({ path: { slug } }),
                      });
                    } catch (err: unknown) {
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
                          setInlineRename({ path: node.path, name: node.name });
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
                          if (node.isLeaf) onDeleteFile(node.path);
                          else onDeleteFolder(node.path);
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

export default CatalogFileTree;
