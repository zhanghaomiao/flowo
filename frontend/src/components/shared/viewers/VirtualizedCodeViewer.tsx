import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from 'react-virtualized';

interface VirtualizedCodeViewerProps {
  code: string;
  language?: string;
  theme?: 'light' | 'dark';
  fontSize?: number;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  wrapLongLines?: boolean;
  maxWidth?: number;
}

// Simple search interface
interface SearchResult {
  lineIndex: number;
  startIndex: number;
  endIndex: number;
}

const VirtualizedCodeViewer: React.FC<VirtualizedCodeViewerProps> = ({
  code,
  language = 'python',
  theme = 'light',
  fontSize = 12,
  showLineNumbers = true,
  wrapLines = true,
  wrapLongLines = true,
  maxWidth,
}) => {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const codeLines = useMemo(() => {
    return code ? code.split('\n') : [];
  }, [code]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const results: SearchResult[] = [];
    const searchLower = searchTerm.toLowerCase();

    codeLines.forEach((line, lineIndex) => {
      const lineLower = line.toLowerCase();
      let startIndex = 0;

      while (true) {
        const foundIndex = lineLower.indexOf(searchLower, startIndex);
        if (foundIndex === -1) break;

        results.push({
          lineIndex,
          startIndex: foundIndex,
          endIndex: foundIndex + searchTerm.length,
        });

        startIndex = foundIndex + 1;
      }
    });

    return results;
  }, [codeLines, searchTerm]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchResults]);

  const cache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        defaultHeight: fontSize * 1.5, // 预估行高
      }),
    [fontSize],
  );

  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousWidthRef = useRef<number>(0);

  const clearCacheAndRecompute = useCallback(() => {
    cache.clearAll();
    if (listRef.current) {
      listRef.current.recomputeRowHeights();
    }
  }, [cache]);

  useEffect(() => {
    clearCacheAndRecompute();
  }, [code, fontSize, wrapLines, clearCacheAndRecompute]);

  const handleResize = useCallback(
    (info: { width: number; height: number }) => {
      const { width } = info;
      if (Math.abs(width - previousWidthRef.current) > 1) {
        previousWidthRef.current = width;
        setTimeout(() => {
          clearCacheAndRecompute();
        }, 0);
      }
    },
    [clearCacheAndRecompute],
  );

  // Navigate to specific match
  const goToMatch = useCallback(
    (matchIndex: number) => {
      if (searchResults.length === 0) return;

      const validIndex = Math.max(
        0,
        Math.min(matchIndex, searchResults.length - 1),
      );
      setCurrentMatchIndex(validIndex);

      const result = searchResults[validIndex];
      if (listRef.current && result) {
        listRef.current.scrollToRow(result.lineIndex);
      }
    },
    [searchResults],
  );

  // Navigation handlers
  const goToNextMatch = useCallback(() => {
    goToMatch(currentMatchIndex + 1);
  }, [currentMatchIndex, goToMatch]);

  const goToPrevMatch = useCallback(() => {
    goToMatch(currentMatchIndex - 1);
  }, [currentMatchIndex, goToMatch]);

  // Highlight search matches in text
  const highlightText = useCallback(
    (text: string, lineIndex: number) => {
      if (!searchTerm.trim()) return text;

      const lineMatches = searchResults.filter(
        (r) => r.lineIndex === lineIndex,
      );
      if (lineMatches.length === 0) return text;

      const parts = [];
      let lastIndex = 0;

      lineMatches.forEach((match) => {
        // Add text before match
        if (match.startIndex > lastIndex) {
          parts.push(text.slice(lastIndex, match.startIndex));
        }

        // Add highlighted match
        const isCurrentMatch = searchResults[currentMatchIndex] === match;
        const matchText = text.slice(match.startIndex, match.endIndex);
        parts.push(
          <span
            key={`${lineIndex}-${match.startIndex}`}
            style={{
              backgroundColor: isCurrentMatch ? '#ff6b35' : '#ffeb3b',
              color: isCurrentMatch ? 'white' : 'black',
              fontWeight: isCurrentMatch ? 'bold' : 'normal',
            }}
          >
            {matchText}
          </span>,
        );

        lastIndex = match.endIndex;
      });

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }

      return parts;
    },
    [searchTerm, searchResults, currentMatchIndex],
  );

  const rowRenderer = useCallback(
    ({ index, key, style, parent }: ListRowProps) => {
      const line = codeLines[index];
      const lineNumber = index + 1;

      return (
        <CellMeasurer
          key={key}
          cache={cache}
          parent={parent}
          columnIndex={0}
          rowIndex={index}
        >
          {({ registerChild }) => (
            <div
              ref={registerChild}
              style={{
                ...style,
                display: 'flex',
                alignItems: 'flex-start',
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                fontSize: `${fontSize}px`,
                lineHeight: '1.5',
                whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                wordBreak: wrapLines ? 'break-word' : 'normal',
                padding: '2px 0',
              }}
            >
              {showLineNumbers && (
                <div
                  style={{
                    minWidth: '40px',
                    paddingRight: '0px',
                    paddingLeft: '8px',
                    color: theme === 'dark' ? '#666' : '#999',
                    textAlign: 'right',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  {lineNumber}
                </div>
              )}
              <div
                style={{
                  flex: 1,
                  paddingRight: '8px',
                  maxWidth: maxWidth ? `${maxWidth}px` : undefined,
                  overflow: wrapLines ? 'visible' : 'hidden',
                }}
              >
                {searchTerm.trim() ? (
                  <div
                    style={{
                      fontFamily:
                        'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                      fontSize: 'inherit',
                      lineHeight: 'inherit',
                      whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                      wordBreak: wrapLines ? 'break-word' : 'normal',
                    }}
                  >
                    {highlightText(line, index)}
                  </div>
                ) : (
                  <SyntaxHighlighter
                    style={a11yLight}
                    language={language}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: 'transparent',
                      fontSize: 'inherit',
                      fontFamily: 'inherit',
                      lineHeight: 'inherit',
                    }}
                    wrapLines={wrapLines}
                    wrapLongLines={wrapLongLines}
                    showLineNumbers={false}
                    showInlineLineNumbers={false}
                  >
                    {line}
                  </SyntaxHighlighter>
                )}
              </div>
            </div>
          )}
        </CellMeasurer>
      );
    },
    [
      codeLines,
      cache,
      fontSize,
      showLineNumbers,
      theme,
      language,
      wrapLines,
      wrapLongLines,
      maxWidth,
      searchTerm,
      highlightText,
    ],
  );

  if (!code || codeLines.length === 0) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: '#999',
          fontStyle: 'italic',
        }}
      >
        No content to display.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="code-viewer-container"
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: theme === 'dark' ? '#282c34' : '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search Bar */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #d9d9d9',
          backgroundColor: theme === 'dark' ? '#21252b' : '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Search in code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (searchResults.length > 0) {
                goToNextMatch();
              }
            }
          }}
          style={{
            flex: 1,
            padding: '4px 8px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
          }}
        />
        {searchResults.length > 0 && (
          <>
            <span
              style={{
                fontSize: '12px',
                color: theme === 'dark' ? '#ccc' : '#666',
                minWidth: '60px',
              }}
            >
              {currentMatchIndex + 1} of {searchResults.length}
            </span>
            <button
              onClick={goToPrevMatch}
              disabled={searchResults.length === 0}
              style={{
                padding: '2px 6px',
                border: '1px solid #d9d9d9',
                borderRadius: '3px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ↑
            </button>
            <button
              onClick={goToNextMatch}
              disabled={searchResults.length === 0}
              style={{
                padding: '2px 6px',
                border: '1px solid #d9d9d9',
                borderRadius: '3px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ↓
            </button>
          </>
        )}
      </div>

      {/* Code Content */}
      <div style={{ flex: 1 }}>
        <AutoSizer onResize={handleResize}>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              width={width}
              rowCount={codeLines.length}
              deferredMeasurementCache={cache}
              rowHeight={cache.rowHeight}
              rowRenderer={rowRenderer}
              overscanRowCount={5}
              style={{
                outline: 'none',
              }}
            />
          )}
        </AutoSizer>
      </div>
    </div>
  );
};

export default VirtualizedCodeViewer;
