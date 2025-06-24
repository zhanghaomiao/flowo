import React, { useCallback, useEffect, useMemo, useRef } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { a11yLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from "react-virtualized";

interface VirtualizedCodeViewerProps {
  code: string;
  language?: string;
  theme?: "light" | "dark";
  fontSize?: number;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  wrapLongLines?: boolean;
  maxWidth?: number;
}

const VirtualizedCodeViewer: React.FC<VirtualizedCodeViewerProps> = ({
  code,
  language = "python",
  theme = "light",
  fontSize = 12,
  showLineNumbers = true,
  wrapLines = true,
  wrapLongLines = true,
  maxWidth,
}) => {
  // 将代码分割成行
  const codeLines = useMemo(() => {
    return code ? code.split("\n") : [];
  }, [code]);

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
                display: "flex",
                alignItems: "flex-start",
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
                fontSize: `${fontSize}px`,
                lineHeight: "1.5",
                whiteSpace: wrapLines ? "pre-wrap" : "pre",
                wordBreak: wrapLines ? "break-word" : "normal",
                padding: "2px 0",
              }}
            >
              {showLineNumbers && (
                <div
                  style={{
                    minWidth: "50px",
                    paddingRight: "12px",
                    paddingLeft: "8px",
                    color: theme === "dark" ? "#666" : "#999",
                    textAlign: "right",
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {lineNumber}
                </div>
              )}
              <div
                style={{
                  flex: 1,
                  paddingRight: "8px",
                  maxWidth: maxWidth ? `${maxWidth}px` : undefined,
                  overflow: wrapLines ? "visible" : "hidden",
                }}
              >
                <SyntaxHighlighter
                  style={a11yLight}
                  language={language}
                  customStyle={{
                    margin: 0,
                    padding: 0,
                    background: "transparent",
                    fontSize: "inherit",
                    fontFamily: "inherit",
                    lineHeight: "inherit",
                  }}
                  wrapLines={wrapLines}
                  wrapLongLines={wrapLongLines}
                  showLineNumbers={false}
                  showInlineLineNumbers={false}
                >
                  {line}
                </SyntaxHighlighter>
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
    ],
  );

  if (!code || codeLines.length === 0) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#999",
          fontStyle: "italic",
        }}
      >
        No code to display
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        width: "100%",
        backgroundColor: theme === "dark" ? "#282c34" : "#fafafa",
        border: "1px solid #d9d9d9",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
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
              outline: "none",
            }}
          />
        )}
      </AutoSizer>
    </div>
  );
};

export default VirtualizedCodeViewer;
