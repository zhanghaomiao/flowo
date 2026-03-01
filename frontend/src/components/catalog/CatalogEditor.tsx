import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CloseOutlined, SaveOutlined } from '@ant-design/icons';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, message, Spin, Tabs, Tooltip, Typography } from 'antd';

import {
  readFile2Options,
  writeFileMutation,
} from '@/client/@tanstack/react-query.gen';

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
  openFiles: string[];
  activeFile?: string;
  onClose: (filePath: string) => void;
  onCloseAll?: () => void;
}

const CatalogEditor: React.FC<Props> = ({
  slug,
  openFiles,
  activeFile,
  onClose,
  onCloseAll,
}) => {
  const [tabs, setTabs] = useState<Map<string, FileTab>>(new Map());
  const [activeKey, setActiveKey] = useState<string>('');
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const writeFileMut = useMutation(writeFileMutation());

  // Sync active tab when parent changes activeFile
  useEffect(() => {
    if (activeFile && openFiles.includes(activeFile)) {
      setActiveKey(activeFile);
    }
  }, [activeFile, openFiles]);

  // Load files when openFiles change
  useEffect(() => {
    const newFiles = openFiles.filter((f) => !tabs.has(f));
    if (newFiles.length > 0 && !activeFile) {
      setActiveKey(openFiles[openFiles.length - 1]);
    }
  }, [openFiles, tabs, activeFile]);

  const activeTab = tabs.get(activeKey);

  const handleSave = useCallback(
    async (filePath: string) => {
      const tab = tabs.get(filePath);
      if (!tab || !tab.dirty) return;

      try {
        await writeFileMut.mutateAsync({
          body: {
            content: tab.content,
          },
          path: {
            file_path: filePath,
            slug,
          },
        });
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
      } catch {
        message.error('Failed to save file');
      }
    },
    [tabs, writeFileMut, slug],
  );

  const handleSaveAll = useCallback(async () => {
    const dirtyTabs = [...tabs.values()].filter((t) => t.dirty);
    for (const tab of dirtyTabs) {
      await handleSave(tab.key);
    }
  }, [tabs, handleSave]);

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
    const tab = tabs.get(filePath);
    if (tab?.dirty) {
      message.warning('Unsaved changes will be lost');
    }
    setTabs((prev) => {
      const next = new Map(prev);
      next.delete(filePath);
      return next;
    });
    onClose(filePath);

    // Set next active tab
    const remaining = openFiles.filter((f) => f !== filePath);
    if (remaining.length > 0) {
      setActiveKey(remaining[remaining.length - 1]);
    }
  };

  const hasDirty = [...tabs.values()].some((t) => t.dirty);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Ctrl+S to save
    editor.addCommand(
      // Monaco KeyMod.CtrlCmd | KeyCode.KeyS = 2097
      2097,
      () => {
        if (activeKey) handleSave(activeKey);
      },
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* File Tabs with integrated actions */}
      {openFiles.length > 0 && (
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          type="card"
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
              <Tooltip title="Save (Ctrl+S)">
                <Button
                  size="small"
                  type="text"
                  icon={<SaveOutlined />}
                  disabled={!activeTab?.dirty}
                  onClick={() => activeKey && handleSave(activeKey)}
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
        {activeKey ? (
          <FileEditorPanel
            slug={slug}
            filePath={activeKey}
            tabs={tabs}
            setTabs={setTabs}
            onContentChange={handleContentChange}
            onEditorMount={handleEditorMount}
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
            padding: '2px 12px',
            borderTop: '1px solid #f0f0f0',
            backgroundColor: '#fafafa',
            fontSize: 12,
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

// Sub-component that handles loading file content
interface FileEditorPanelProps {
  slug: string;
  filePath: string;
  tabs: Map<string, FileTab>;
  setTabs: React.Dispatch<React.SetStateAction<Map<string, FileTab>>>;
  onContentChange: (filePath: string, content: string | undefined) => void;
  onEditorMount: OnMount;
}

const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  slug,
  filePath,
  tabs,
  setTabs,
  onContentChange,
  onEditorMount,
}) => {
  const { data, isLoading } = useQuery({
    ...readFile2Options({
      path: { slug, file_path: filePath },
    }),
    enabled: !!slug && !!filePath && slug !== '{slug}',
  });
  const tab = tabs.get(filePath);

  // Initialize tab when data loads
  useEffect(() => {
    if (data && !tabs.has(filePath)) {
      setTabs((prev) => {
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
    }
  }, [data, filePath, tabs, setTabs]);

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

  return (
    <Editor
      height="100%"
      language={tab.language}
      theme="vs"
      value={tab.content}
      onChange={(value) => onContentChange(filePath, value)}
      onMount={onEditorMount}
      options={{
        fontSize: 12,
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
