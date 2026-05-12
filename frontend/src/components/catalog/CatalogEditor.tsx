import React, { useEffect, useLayoutEffect, useState } from 'react';

import { CloseOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useQuery } from '@tanstack/react-query';
import { Button, Spin, Tabs, Tooltip, Typography } from 'antd';

import { readFile2Options } from '@/client/@tanstack/react-query.gen';
import {
  fetchSnakeTemplateFile,
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
  language: string;
}

interface Props {
  /** Catalog id (preferred) or slug for read/write API paths. */
  catalogRef: string;
  /** When `snake-template`, read use `/catalog/snake-template/file` instead of catalog slug APIs. */
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
  catalogRef,
  fileSource = 'catalog',
  openFiles,
  activeFile,
  onActiveFileChange,
  onClose,
  onCloseAll,
  viewMode,
}) => {
  const [tabs, setTabs] = useState<Map<string, FileTab>>(new Map());

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

  const handleCloseTab = (filePath: string) => {
    setTabs((prev) => {
      const next = new Map(prev);
      next.delete(filePath);
      return next;
    });
    onClose(filePath);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* File Tabs */}
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
              {onCloseAll && (
                <Tooltip title="Close viewer">
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

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {focusPath ? (
          <FileEditorPanel
            key={focusPath}
            catalogRef={catalogRef}
            fileSource={fileSource}
            filePath={focusPath}
            tabs={tabs}
            setTabs={setTabs}
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
            <Text type="secondary">Select a file to view</Text>
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
  catalogRef: string;
  fileSource: 'catalog' | 'snake-template';
  filePath: string;
  tabs: Map<string, FileTab>;
  setTabs: React.Dispatch<React.SetStateAction<Map<string, FileTab>>>;
  viewMode?: 'preview' | 'source';
}

const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  catalogRef,
  fileSource,
  filePath,
  tabs,
  setTabs,
  viewMode,
}) => {
  const catalogQuery = useQuery({
    ...readFile2Options({
      path: { catalog_ref: catalogRef, file_path: filePath },
    }),
    enabled: fileSource === 'catalog' && !!catalogRef && !!filePath,
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

  useEffect(() => {
    if (!data) return;
    setTabs((prev) => {
      if (prev.has(filePath)) return prev;
      const next = new Map(prev);
      next.set(filePath, {
        key: filePath,
        label: data.name,
        content: data.content,
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
      options={{
        fontSize: 15,
        lineNumbers: 'on',
        readOnly: true,
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
