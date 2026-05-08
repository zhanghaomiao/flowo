import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NodeApi, NodeRendererProps } from 'react-arborist';
import { Tree } from 'react-arborist';

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
  MoreOutlined,
  PushpinOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dropdown, Input, message, Tooltip } from 'antd';

import {
  deleteDirectoryMutation,
  getCatalogQueryKey,
  renamePathMutation,
  writeFileMutation,
} from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import type { CatalogDetail, CatalogFileInfo } from '@/client/types.gen';

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

export type CatalogArboristNode = {
  id: string;
  name: string;
  isFile: boolean;
  children?: CatalogArboristNode[];
};

function fileLeafIcon(name: string): React.ReactNode {
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
  return (
    FILE_ICON_MAP[name] ||
    FILE_ICON_MAP[ext] || <FileTextOutlined style={{ color: '#8c8c8c' }} />
  );
}

function buildNestedTree(files: CatalogFileInfo[]): CatalogArboristNode[] {
  const root: CatalogArboristNode[] = [];
  const map: Record<string, CatalogArboristNode> = {};

  for (const file of files) {
    if (file.path.startsWith('.snakemake/') || file.path === '.snakemake') {
      continue;
    }
    const parts = file.path.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const isFile = isLast && !file.is_dir;
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map[currentPath]) {
        const node: CatalogArboristNode = {
          id: currentPath,
          name: part,
          isFile,
          ...(isFile ? {} : { children: [] }),
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
    }
  }

  const sortNodes = (nodes: CatalogArboristNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children?.length && sortNodes(n.children));
  };

  sortNodes(root);
  return root;
}

interface Props {
  catalog: CatalogDetail;
  slug: string;
  /** Hide create / rename / delete; tree is browse + open only. */
  readOnly?: boolean;
  onOpenFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFiles: (oldPath: string, newPath: string) => void;
}

type CreateCtx = { type: 'file' | 'folder'; parentPath: string };

const CatalogFileTree: React.FC<Props> = ({
  catalog,
  slug,
  readOnly = false,
  onOpenFile,
  onDeleteFile,
  onDeleteFolder,
  onRenameFiles,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 300, height: 400 });

  const writeFileMut = useMutation(writeFileMutation());
  const renamePathMut = useMutation(renamePathMutation());
  const deleteDirMut = useMutation(deleteDirectoryMutation());
  const createDirMut = useMutation({
    mutationFn: async ({ slug: s, path }: { slug: string; path: string }) => {
      return client.post({
        url: `/api/v1/catalog/${s}/dirs/${path}`,
        security: [{ scheme: 'bearer', type: 'http' }],
      });
    },
  });

  const [createCtx, setCreateCtx] = useState<CreateCtx | null>(null);
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const treeData = useMemo(() => {
    if (!catalog?.files?.length) return [];
    return buildNestedTree(catalog.files as unknown as CatalogFileInfo[]);
  }, [catalog.files]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.max(100, el.clientWidth);
      const h = Math.max(120, el.clientHeight);
      setSize({ width: w, height: h });
    });
    ro.observe(el);
    setSize({
      width: Math.max(100, el.clientWidth),
      height: Math.max(120, el.clientHeight),
    });
    return () => ro.disconnect();
  }, []);

  const submitCreate = useCallback(async () => {
    if (!createCtx || !createName.trim()) {
      setCreateCtx(null);
      setCreateName('');
      return;
    }
    setIsCreating(true);
    try {
      const parent = createCtx.parentPath ? `${createCtx.parentPath}/` : '';
      const fullPath = `${parent}${createName.trim()}`;
      if (createCtx.type === 'file') {
        await writeFileMut.mutateAsync({
          body: { content: `# ${createName.trim()}\n` },
          path: { file_path: fullPath, slug },
        });
        messageApi.success(`File "${createName.trim()}" created`);
        onOpenFile(fullPath);
      } else {
        await createDirMut.mutateAsync({ slug, path: fullPath });
        messageApi.success(`Folder "${createName.trim()}" created`);
      }
      queryClient.invalidateQueries({
        queryKey: getCatalogQueryKey({ path: { slug } }),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Creation failed';
      messageApi.error(errorMsg);
    } finally {
      setIsCreating(false);
      setCreateCtx(null);
      setCreateName('');
    }
  }, [
    createCtx,
    createName,
    createDirMut,
    messageApi,
    onOpenFile,
    queryClient,
    slug,
    writeFileMut,
  ]);

  const submitRename = useCallback(
    async (node: NodeApi<CatalogArboristNode>) => {
      const newName = renameValue.trim();
      if (!newName || newName === node.data.name) {
        setRenamingPath(null);
        return;
      }
      const parentPath = node.id.substring(
        0,
        node.id.length - node.data.name.length,
      );
      const newPath = `${parentPath}${newName}`;
      try {
        await renamePathMut.mutateAsync({
          body: { old_path: node.id, new_path: newPath },
          path: { slug },
        });
        messageApi.success(`Renamed to "${newName}"`);
        onRenameFiles(node.id, newPath);
        queryClient.invalidateQueries({
          queryKey: getCatalogQueryKey({ path: { slug } }),
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Rename failed';
        messageApi.error(errorMsg);
      } finally {
        setRenamingPath(null);
      }
    },
    [messageApi, onRenameFiles, queryClient, renamePathMut, renameValue, slug],
  );

  const CatalogRow = useCallback(
    ({ node, style, dragHandle }: NodeRendererProps<CatalogArboristNode>) => {
      const isRenaming = renamingPath === node.id;

      return (
        <div
          ref={dragHandle}
          style={style}
          className="group mx-0.5 flex min-w-0 items-center justify-between gap-2 rounded-md py-0.5 pr-1 pl-0.5 hover:bg-slate-100 data-[selected=true]:bg-indigo-50/90"
          data-selected={node.isSelected ? 'true' : 'false'}
        >
          <span className="inline-flex min-w-0 flex-1 select-none items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap pl-1">
            {node.isLeaf ? (
              fileLeafIcon(node.data.name)
            ) : node.isOpen ? (
              <FolderOpenOutlined style={{ color: '#595959' }} />
            ) : (
              <FolderOutlined style={{ color: '#595959' }} />
            )}
            {isRenaming ? (
              <Input
                size="small"
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                disabled={renamePathMut.isPending}
                className="min-w-0 flex-1 text-xs !h-[22px]"
                onClick={(e) => e.stopPropagation()}
                onPressEnter={() => void submitRename(node)}
                onBlur={() => {
                  window.setTimeout(() => {
                    if (!renamePathMut.isPending) setRenamingPath(null);
                  }, 150);
                }}
              />
            ) : (
              <span>{node.data.name}</span>
            )}
          </span>
          {!isRenaming && !readOnly && (
            <div
              className="flex shrink-0 items-center pl-1 opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="inline-flex items-center gap-0.5 rounded-lg p-px transition-[background-color,box-shadow] group-hover:bg-white/90 group-hover:shadow-[0_0_0_1px_rgb(203_213_225)]">
                {!node.isLeaf && (
                  <>
                    <Tooltip title="New file in this folder">
                      <Button
                        type="text"
                        size="small"
                        className="!m-0 !flex !h-7 !w-7 !min-w-7 !items-center !justify-center !rounded-md !border-0 !p-0 !text-slate-500 [&_.anticon]:!text-sm hover:!bg-slate-300/35 hover:!text-slate-900"
                        icon={<FileAddOutlined />}
                        onClick={() => {
                          setCreateCtx({ type: 'file', parentPath: node.id });
                          setCreateName('');
                          node.open();
                        }}
                      />
                    </Tooltip>
                    <Tooltip title="New folder in this folder">
                      <Button
                        type="text"
                        size="small"
                        className="!m-0 !flex !h-7 !w-7 !min-w-7 !items-center !justify-center !rounded-md !border-0 !p-0 !text-slate-500 [&_.anticon]:!text-sm hover:!bg-slate-300/35 hover:!text-slate-900"
                        icon={<FolderAddOutlined />}
                        onClick={() => {
                          setCreateCtx({ type: 'folder', parentPath: node.id });
                          setCreateName('');
                          node.open();
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
                          setRenamingPath(node.id);
                          setRenameValue(node.data.name);
                        },
                      },
                      { type: 'divider' },
                      {
                        key: 'delete',
                        label: 'Delete',
                        danger: true,
                        icon: <DeleteOutlined />,
                        onClick: async () => {
                          if (node.isLeaf) {
                            onDeleteFile(node.id);
                          } else {
                            try {
                              await deleteDirMut.mutateAsync({
                                path: { slug, directory_path: node.id },
                              });
                              onDeleteFolder(node.id);
                              messageApi.success(
                                `Folder "${node.data.name}" deleted`,
                              );
                              queryClient.invalidateQueries({
                                queryKey: getCatalogQueryKey({
                                  path: { slug },
                                }),
                              });
                            } catch (err: unknown) {
                              const errorMsg =
                                err instanceof Error
                                  ? err.message
                                  : 'Delete failed';
                              messageApi.error(errorMsg);
                            }
                          }
                        },
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Tooltip title="More actions">
                    <Button
                      type="text"
                      size="small"
                      className="!m-0 !flex !h-7 !w-7 !min-w-7 !items-center !justify-center !rounded-md !border-0 !p-0 !text-slate-500 [&_.anticon]:!text-sm hover:!bg-slate-300/35 hover:!text-slate-900"
                      icon={<MoreOutlined />}
                    />
                  </Tooltip>
                </Dropdown>
              </div>
            </div>
          )}
        </div>
      );
    },
    [
      onDeleteFile,
      onDeleteFolder,
      renamePathMut.isPending,
      renameValue,
      renamingPath,
      readOnly,
      submitRename,
      deleteDirMut,
      messageApi,
      queryClient,
      slug,
    ],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white">
      {contextHolder}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Files
        </span>
        {!readOnly && (
          <div
            className="inline-flex divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200/80 bg-white"
            role="toolbar"
            aria-label="Create files"
          >
            <Tooltip title="New file at catalog root">
              <Button
                type="text"
                className="!m-0 !flex !h-8 !w-10 !min-w-10 !items-center !justify-center !rounded-none !border-0 !p-0 !text-slate-600 [&_.anticon]:!text-base hover:!bg-indigo-50 hover:!text-indigo-700"
                icon={<FileAddOutlined />}
                aria-label="New file at catalog root"
                onClick={() => {
                  setCreateCtx({ type: 'file', parentPath: '' });
                  setCreateName('');
                }}
              />
            </Tooltip>
            <Tooltip title="New folder at catalog root">
              <Button
                type="text"
                className="!m-0 !flex !h-8 !w-10 !min-w-10 !items-center !justify-center !rounded-none !border-0 !p-0 !text-slate-600 [&_.anticon]:!text-base hover:!bg-indigo-50 hover:!text-indigo-700"
                icon={<FolderAddOutlined />}
                aria-label="New folder at catalog root"
                onClick={() => {
                  setCreateCtx({ type: 'folder', parentPath: '' });
                  setCreateName('');
                }}
              />
            </Tooltip>
          </div>
        )}
      </div>

      {!readOnly && createCtx && (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2">
          <span className="whitespace-nowrap text-xs text-neutral-500">
            New {createCtx.type} in {createCtx.parentPath || '/'}
          </span>
          <Input
            size="small"
            autoFocus
            placeholder="Name…"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            disabled={isCreating}
            onPressEnter={() => void submitCreate()}
            className="min-w-0 flex-1"
          />
          <Button
            size="small"
            type="primary"
            onClick={() => void submitCreate()}
          >
            Add
          </Button>
          <Button
            size="small"
            onClick={() => {
              if (!isCreating) {
                setCreateCtx(null);
                setCreateName('');
              }
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="relative box-border min-h-0 w-full flex-1 px-2 pb-2 pt-0.5">
        <div className="relative h-full min-h-0 w-full" ref={wrapRef}>
          <Tree<CatalogArboristNode>
            // Stable key: do not tie to updated_at / file count — refetch after create
            // would remount the tree, reset scroll, and collapse open folders.
            key={`${slug}-${readOnly ? 'ro' : 'rw'}`}
            className="text-sm font-sans leading-snug"
            data={treeData}
            width={size.width}
            height={size.height}
            indent={16}
            rowHeight={34}
            openByDefault={false}
            disableDrag
            disableDrop
            disableEdit
            overscanCount={8}
            onActivate={(node) => {
              if (node.isLeaf) {
                onOpenFile(node.id);
              } else {
                node.toggle();
              }
            }}
          >
            {CatalogRow}
          </Tree>
        </div>
      </div>
    </div>
  );
};

export default CatalogFileTree;
