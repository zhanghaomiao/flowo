import React, { useMemo } from 'react';

import Editor from '@monaco-editor/react';
import { Typography } from 'antd';

import type { FileViewerProps } from './types';

const { Text } = Typography;

export const CodeViewer: React.FC<FileViewerProps> = ({
  content,
  fileName,
  fileFormat = 'yaml',
  showFileName = false,
}) => {
  const fileContent = content || '';

  const fileAnalysis = useMemo(() => {
    if (!fileContent) {
      return {
        lineCount: 0,
        sizeInKB: 0,
      };
    }

    const sizeInBytes = new Blob([fileContent]).size;
    const lineCount = fileContent.split('\n').length;

    return {
      lineCount,
      sizeInKB: Math.round(sizeInBytes / 1024),
    };
  }, [fileContent]);

  const getLanguageFromFormat = (format: string) => {
    switch (format) {
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'log':
        return 'log';
      case 'python':
      case 'py':
        return 'python';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'sh':
      case 'bash':
        return 'shell';
      default:
        return format || 'plaintext';
    }
  };

  return (
    <div
      style={{
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {showFileName && fileName && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            padding: '8px 12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            flexShrink: 0,
          }}
        >
          <div>
            <Text strong>{fileName}</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {fileAnalysis.lineCount} lines ({fileAnalysis.sizeInKB} KB)
            </Text>
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <style>{`
          /* Hide the flickering '(Escape)' tooltip */
          .monaco-editor .monaco-hover,
          .monaco-hover {
            display: none !important;
          }
        `}</style>
        <Editor
          height="100%"
          width="100%"
          language={getLanguageFromFormat(fileFormat)}
          theme="vs" // Default to light theme
          value={fileContent}
          options={{
            fontSize: 14,
            lineNumbers: 'on',
            readOnly: true,
            scrollBeyondLastLine: false,
            minimap: {
              enabled: false,
            },
            automaticLayout: true,
            wordWrap: 'on',
            folding: true,
            lineDecorationsWidth: 4,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'none',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            overviewRulerLanes: 10,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            fixedOverflowWidgets: true,
            find: {
              addExtraSpaceOnTop: false,
              autoFindInSelection: 'never',
              seedSearchStringFromSelection: 'never',
            },
          }}
        />
      </div>
    </div>
  );
};

export default CodeViewer;
