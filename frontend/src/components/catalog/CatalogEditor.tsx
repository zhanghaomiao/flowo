import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { CloseOutlined, SaveOutlined } from '@ant-design/icons';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, message, Spin, Tabs, Tooltip, Typography } from 'antd';

import {
  getCatalogQueryKey,
  readFile2Options,
  readFile2QueryKey,
  writeFileMutation,
} from '@/client/@tanstack/react-query.gen';
import {
  fetchSnakeTemplateFile,
  putSnakeTemplateFile,
  snakeTemplateQueryKey,
} from '@/lib/snakeTemplate';

import { MarkdownViewer } from '../shared/viewers';

const { Text } = Typography;

// Language detection from filename/extension
function detectLanguage(filePath: string): string {
  const name = filePath.split('/').pop() || '';
  if (name === 'Snakefile') return 'python';

  const ext = name.includes('.')
    ? `.${name.split('.').pop()?.toLowerCase()}`
    : '';
  const map: Record<string, string> = {
    '.py': 'python',
    '.smk': 'python',
    '.r': 'r',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.sh': 'shell',
    '.rst': 'restructuredtext',
    '.md': 'markdown',
    '.tsv': 'plaintext',
    '.pl': 'perl',
  };
  return map[ext] || 'plaintext';
}

interface FileTab {
  key: string; // file path
  label: string; // file name
  content: string;
  originalContent: string;
  dirty: boolean;
  language: string;
}

interface Props {
  slug: string;
  /** When `snake-template`, read/write use `/catalog/snake-template/file` instead of catalog slug APIs. */
  fileSource?: 'catalog' | 'snake-template';
  openFiles: string[];
  activeFile?: string;
  /** Keep in sync with the focused tab (must run when user clicks a tab, not only when opening from tree). */
  onActiveFileChange: (path: string) => void;
  onClose: (filePath: string) => void;
  onCloseAll?: () => void;
  viewMode?: 'preview' | 'source';
  onViewModeChange?: (mode: 'preview' | 'source') => void;
}

const CatalogEditor: React.FC<Props> = ({
  slug,
  fileSource = 'catalog',
  openFiles,
  activeFile,
  onActiveFileChange,
  onClose,
  onCloseAll,
  viewMode,
}) => {
  const [tabs, setTabs] = useState<Map<string, FileTab>>(new Map());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const queryClient = useQueryClient();

  const writeFileMut = useMutation(writeFileMutation());

  /** Single source of truth with parent `activeFile`; avoids local activeKey fighting the tree. */
  const focusPath =
    openFiles.length === 0
      ? ''
      : activeFile && openFiles.includes(activeFile)
        ? activeFile
        : openFiles[openFiles.length - 1]!;

  // Heal stale activeFile (e.g. pointed at a closed tab) so Tabs stay valid.
  useLayoutEffect(() => {
    if (!openFiles.length) return;
    if (!activeFile || !openFiles.includes(activeFile)) {
      const fallback = openFiles[openFiles.length - 1]!;
      if (activeFile !== fallback) {
        onActiveFileChange(fallback);
      }
    }
  }, [openFiles, activeFile, onActiveFileChange]);

  const activeTab = tabs.get(focusPath);

  const focusPathRef = useRef(focusPath);
  focusPathRef.current = focusPath;

  const handleSave = useCallback(
    async (filePath: string) => {
      const tab = tabsRef.current.get(filePath);
      if (!tab) {
        message.warning('File is still loading; try Save again in a moment.');
        return;
      }
      if (!tab.dirty) {
        message.info('No changes to save.');
        return;
      }

      try {
        if (fileSource === 'snake-template') {
          await putSnakeTemplateFile(filePath, tab.content);
          await queryClient.invalidateQueries({
            queryKey: [...snakeTemplateQueryKey],
          });
        } else {
          const saved = await writeFileMut.mutateAsync({
            body: {
              content: tab.content,
            },
            path: {
              file_path: filePath,
              slug,
            },
          });
          // Global staleTime is 30s; keep read cache aligned (must not block marking saved).
          try {
            queryClient.setQueryData(
              readFile2QueryKey({ path: { slug, file_path: filePath } }),
              saved,
            );
          } catch (e) {
            console.warn('readFile2 cache update failed', e);
          }
          void queryClient.invalidateQueries({
            queryKey: getCatalogQueryKey({ path: { slug } }),
          });
        }
        setTabs((prev) => {
          const next = new Map(prev);
          const t = next.get(filePath);
          if (t) {
            next.set(filePath, {
              ...t,
              originalContent: t.content,
              dirty: false,
            });
          }
          return next;
        });
        message.success(`Saved ${filePath.split('/').pop()}`);
      } catch (err) {
        console.error(err);
        message.error(
          err instanceof Error ? err.message : 'Failed to save file',
        );
      }
    },
    [writeFileMut, slug, fileSource, queryClient],
  );

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleSaveAll = useCallback(async () => {
    const dirtyTabs = [...tabsRef.current.values()].filter((t) => t.dirty);
    for (const tab of dirtyTabs) {
      await handleSave(tab.key);
    }
  }, [handleSave]);

  const handleContentChange = useCallback(
    (filePath: string, newContent: string | undefined) => {
      if (newContent === undefined) return;
      setTabs((prev) => {
        const next = new Map(prev);
        const tab = next.get(filePath);
        if (tab) {
          next.set(filePath, {
            ...tab,
            content: newContent,
            dirty: newContent !== tab.originalContent,
          });
        }
        return next;
      });
    },
    [],
  );

  const handleCloseTab = (filePath: string) => {
    const tab = tabsRef.current.get(filePath);
    if (tab?.dirty) {
      message.warning('Unsaved changes will be lost');
    }
    setTabs((prev) => {
      const next = new Map(prev);
      next.delete(filePath);
      return next;
    });
    onClose(filePath);
  };

  const hasDirty = [...tabs.values()].some((t) => t.dirty);

  const markdownPreviewBlocksEdit =
    viewMode === 'preview' &&
    !!focusPath &&
    (focusPath.toLowerCase().endsWith('.md') ||
      focusPath.toLowerCase().endsWith('.markdown'));

  const handleEditorMount = useCallback<OnMount>((editor) => {
    editorRef.current = editor;
    // Ctrl+S — use refs so the command always sees the current tab + save handler.
    editor.addCommand(
      // Monaco KeyMod.CtrlCmd | KeyCode.KeyS = 2097
      2097,
      () => {
        const k = focusPathRef.current;
        if (k) void handleSaveRef.current(k);
      },
    );
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* File Tabs with integrated actions */}
      {openFiles.length > 0 && (
        <Tabs
          activeKey={focusPath || undefined}
          onChange={(key) => onActiveFileChange(key)}
          type="line"
          size="small"
          className="catalog-editor-tabs"
          style={{ flexShrink: 0, marginBottom: 0 }}
          tabBarExtraContent={
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                paddingRight: 8,
              }}
            >
              <Tooltip
                title={
                  markdownPreviewBlocksEdit
                    ? 'Switch to Source mode (above) to edit Markdown; Preview is read-only'
                    : 'Save (Ctrl+S)'
                }
              >
                <Button
                  size="small"
                  type="text"
                  icon={<SaveOutlined />}
                  disabled={!activeTab?.dirty || markdownPreviewBlocksEdit}
                  onClick={() => focusPath && handleSave(focusPath)}
                />
              </Tooltip>
              <Tooltip title="Save All">
                <Button
                  size="small"
                  type="text"
                  disabled={!hasDirty}
                  onClick={handleSaveAll}
                  style={{ fontSize: 12 }}
                >
                  Save All
                </Button>
              </Tooltip>
              {onCloseAll && (
                <Tooltip title="Close editor">
                  <Button
                    size="small"
                    type="text"
                    onClick={onCloseAll}
                    icon={<CloseOutlined />}
                  />
                </Tooltip>
              )}
            </span>
          }
          items={openFiles.map((filePath) => {
            const tab = tabs.get(filePath);
            const name = filePath.split('/').pop() || filePath;
            return {
              key: filePath,
              label: (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{name}</span>
                  {tab?.dirty && (
                    <span style={{ color: '#faad14', fontWeight: 'bold' }}>
                      ●
                    </span>
                  )}
                  <Tooltip title="Close tab">
                    <CloseOutlined
                      style={{ fontSize: 10, marginLeft: 4 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(filePath);
                      }}
                    />
                  </Tooltip>
                </span>
              ),
            };
          })}
        />
      )}

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {focusPath ? (
          <FileEditorPanel
            key={focusPath}
            slug={slug}
            fileSource={fileSource}
            filePath={focusPath}
            tabs={tabs}
            setTabs={setTabs}
            onContentChange={handleContentChange}
            onEditorMount={handleEditorMount}
            viewMode={viewMode}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text type="secondary">Select a file to edit</Text>
          </div>
        )}
      </div>

      {/* Status bar */}
      {activeTab && (
        <div
          style={{
            padding: '2px 10px',
            borderTop: '1px solid #f0f0f0',
            backgroundColor: '#fafafa',
            fontSize: 13,
            color: '#8c8c8c',
            flexShrink: 0,
          }}
        >
          {activeTab.language} · {activeTab.content.split('\n').length} lines
        </div>
      )}
    </div>
  );
};

interface FileEditorPanelProps {
  slug: string;
  fileSource: 'catalog' | 'snake-template';
  filePath: string;
  tabs: Map<string, FileTab>;
  setTabs: React.Dispatch<React.SetStateAction<Map<string, FileTab>>>;
  onContentChange: (filePath: string, content: string | undefined) => void;
  onEditorMount: OnMount;
  viewMode?: 'preview' | 'source';
}

const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  slug,
  fileSource,
  filePath,
  tabs,
  setTabs,
  onContentChange,
  onEditorMount,
  viewMode,
}) => {
  const catalogQuery = useQuery({
    ...readFile2Options({
      path: { slug, file_path: filePath },
    }),
    enabled:
      fileSource === 'catalog' && !!slug && !!filePath && slug !== '{slug}',
  });

  const templateQuery = useQuery({
    queryKey: [...snakeTemplateQueryKey, 'file', filePath],
    queryFn: () => fetchSnakeTemplateFile(filePath),
    enabled: fileSource === 'snake-template' && !!filePath,
  });

  const isTemplate = fileSource === 'snake-template';
  const data = isTemplate ? templateQuery.data : catalogQuery.data;
  const isLoading = isTemplate
    ? templateQuery.isLoading
    : catalogQuery.isLoading;
  const tab = tabs.get(filePath);

  // Initialize tab when data loads (do not depend on `tabs` — that re-ran every keystroke).
  useEffect(() => {
    if (!data) return;
    setTabs((prev) => {
      if (prev.has(filePath)) return prev;
      const next = new Map(prev);
      next.set(filePath, {
        key: filePath,
        label: data.name,
        content: data.content,
        originalContent: data.content,
        dirty: false,
        language: data.language || detectLanguage(filePath),
      });
      return next;
    });
  }, [data, filePath, setTabs]);

  if (isLoading || !tab) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin />
      </div>
    );
  }

  if (
    viewMode === 'preview' &&
    (filePath.toLowerCase().endsWith('.md') ||
      filePath.toLowerCase().endsWith('.markdown'))
  ) {
    return (
      <MarkdownViewer
        content={tab.content}
        fileName={filePath.split('/').pop()}
      />
    );
  }

  return (
    <Editor
      height="100%"
      language={tab.language}
      theme="vs"
      value={tab.content}
      onChange={(value) => onContentChange(filePath, value)}
      onMount={onEditorMount}
      options={{
        fontSize: 15,
        lineNumbers: 'on',
        readOnly: false,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
        automaticLayout: true,
        wordWrap: 'on',
        folding: true,
        lineDecorationsWidth: 4,
        lineNumbersMinChars: 3,
        renderLineHighlight: 'line',
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
          useShadows: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  );
};

export default CatalogEditor;
