import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Alert, Switch, Typography } from "antd";
import React, { useMemo, useState } from "react";

import VirtualizedCodeViewer from "./VirtualizedCodeViewer";

const { Text } = Typography;

// Constants for performance optimization
const MAX_FILE_SIZE_FOR_HIGHLIGHTING = 100 * 1024; // 100KB
const MAX_LINES_FOR_HIGHLIGHTING = 5000;
const LARGE_FILE_PREVIEW_LINES = 5000;

interface FileContentProps {
  fileContent: string;
  fileName?: string;
  fileFormat?: "log" | "yaml" | "json" | "python";
  showFileName?: boolean;
}

const FileContent: React.FC<FileContentProps> = ({
  fileContent,
  fileName,
  fileFormat = "yaml",
  showFileName = false,
}) => {
  const [forceHighlighting, setForceHighlighting] = useState(false);

  // Analyze file size and complexity
  const fileAnalysis = useMemo(() => {
    // Handle undefined or null fileContent
    if (!fileContent) {
      return {
        sizeInBytes: 0,
        lineCount: 0,
        isLargeFile: false,
        hasLotsOfLines: false,
        shouldSkipHighlighting: false,
        sizeInKB: 0,
      };
    }

    const sizeInBytes = new Blob([fileContent]).size;
    const lineCount = fileContent.split("\n").length;
    const isLargeFile = sizeInBytes > MAX_FILE_SIZE_FOR_HIGHLIGHTING;
    const hasLotsOfLines = lineCount > MAX_LINES_FOR_HIGHLIGHTING;
    const shouldSkipHighlighting =
      (isLargeFile || hasLotsOfLines) && !forceHighlighting;

    return {
      sizeInBytes,
      lineCount,
      isLargeFile,
      hasLotsOfLines,
      shouldSkipHighlighting,
      sizeInKB: Math.round(sizeInBytes / 1024),
    };
  }, [fileContent, forceHighlighting]);

  // Get preview content for large files
  const previewContent = useMemo(() => {
    if (!fileContent || !fileAnalysis.shouldSkipHighlighting)
      return fileContent || "";

    const lines = fileContent.split("\n");
    if (lines.length <= LARGE_FILE_PREVIEW_LINES) return fileContent;

    const preview = lines.slice(0, LARGE_FILE_PREVIEW_LINES).join("\n");
    const remainingLines = lines.length - LARGE_FILE_PREVIEW_LINES;

    return `${preview}\n\n... [${remainingLines} more lines truncated for performance] ...`;
  }, [fileContent, fileAnalysis.shouldSkipHighlighting]);

  const getLanguageFromFormat = () => {
    switch (fileFormat) {
      case "json":
        return "json";
      case "yaml":
        return "yaml";
      case "log":
        return "text";
      case "python":
        return "python";
      default:
        return "yaml";
    }
  };

  return (
    <div style={{ height: "100%", maxHeight: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {showFileName && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            padding: "8px 12px",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
            flexShrink: 0,
          }}
        >
          {showFileName && fileName && (
            <div>
              <Text strong>{fileName}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {fileAnalysis.lineCount} lines
              </Text>
            </div>
          )}
        </div>
      )}

      {/* Performance warning for large files */}
      {fileAnalysis.shouldSkipHighlighting && (
        <Alert
          message="Large File Detected"
          description={
            <div>
              <Text>
                This file is large ({fileAnalysis.sizeInKB}KB,{" "}
                {fileAnalysis.lineCount} lines) and syntax highlighting has been
                disabled for performance.
                {fileAnalysis.lineCount > LARGE_FILE_PREVIEW_LINES && (
                  <span>
                    {" "}
                    Showing first {LARGE_FILE_PREVIEW_LINES} lines only.
                  </span>
                )}
              </Text>
              <div style={{ marginTop: 8 }}>
                <Switch
                  size="small"
                  checked={forceHighlighting}
                  onChange={setForceHighlighting}
                />
                <span style={{ marginLeft: 8 }}>
                  Force syntax highlighting (may cause performance issues)
                </span>
              </div>
            </div>
          }
          type="warning"
          icon={<ExclamationCircleOutlined />}
          showIcon
          style={{ marginBottom: "16px", flexShrink: 0 }}
        />
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {fileAnalysis.shouldSkipHighlighting ? (
          <div
            style={{
              margin: 0,
              padding: "16px",
              fontSize: "12px",
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
              whiteSpace: "pre-wrap",
              backgroundColor: "#f8f9fa",
              color: "#495057",
              lineHeight: "1.5",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
              flex: 1,
              overflow: "auto",
            }}
          >
            {previewContent}
          </div>
        ) : (
          <div style={{ height: "100%", minHeight: 0 }}>
            <VirtualizedCodeViewer
              code={fileContent || ""}
              language={getLanguageFromFormat()}
              theme="light"
              fontSize={12}
              showLineNumbers={true}
              wrapLines={true}
              wrapLongLines={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FileContent;
