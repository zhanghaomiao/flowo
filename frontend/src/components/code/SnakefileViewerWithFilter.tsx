import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { Alert, Button, Space } from "antd";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

import { useWorkflowSnakefile } from "../../hooks/useQueries";

interface SnakefileViewerWithFilterProps {
  workflowId: string;
  selectedRule?: string | null;
  onRuleClick?: (ruleName: string) => void;
}

const SnakefileViewerWithFilter: React.FC<SnakefileViewerWithFilterProps> = ({
  workflowId,
  selectedRule,
}) => {
  const {
    data: snakefileContent,
    isLoading,
    error,
  } = useWorkflowSnakefile(workflowId);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
  const syntaxHighlighterRef = useRef<HTMLDivElement>(null);

  // Memoized function to extract string content from API response
  const getContentString = useCallback((data: unknown): string => {
    if (typeof data === "string") {
      return data;
    }
    if (data && typeof data === "object") {
      // Handle the specific API response format: {snakefile_content: "xxxxx"}
      if ("snakefile_content" in data)
        return String((data as Record<string, unknown>).snakefile_content);
      // Handle other possible response structures
      if ("content" in data)
        return String((data as Record<string, unknown>).content);
      if ("data" in data) return String((data as Record<string, unknown>).data);
      if ("text" in data) return String((data as Record<string, unknown>).text);
      if ("value" in data)
        return String((data as Record<string, unknown>).value);
      // If it's an array, try to get the first element
      if (Array.isArray(data) && data.length > 0) {
        return getContentString(data[0]);
      }
    }
    return String(data || "");
  }, []);

  // Memoized function to find rule lines in Snakefile content
  const findRuleLines = useCallback(
    (content: string, ruleName: string): number[] => {
      if (!content || !ruleName) return [];

      const contentStr = getContentString(content);
      const lines = contentStr.split("\n");
      const ruleLines: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Match rule definitions: "rule ruleName:" with exact rule name matching
        const rulePattern = new RegExp(
          `^rule\\s+${ruleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`,
        );
        if (rulePattern.test(line)) {
          ruleLines.push(i + 1); // Line numbers are 1-based

          // Find the end of this rule (next rule, checkpoint, or top-level statement)
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();

            // Stop at next rule or checkpoint
            if (
              nextLine.match(/^rule\s+\w+\s*:/) ||
              nextLine.match(/^checkpoint\s+\w+\s*:/)
            ) {
              break;
            }

            // Stop at other top-level Snakemake directives
            if (
              nextLine.match(
                /^(import|include|configfile|workdir|wildcard_constraints|localrules|ruleorder|onstart|onsuccess|onerror)\s/,
              )
            ) {
              break;
            }

            // Stop at function definitions or other Python constructs at top level
            if (
              lines[j].length > 0 &&
              !lines[j].startsWith(" ") &&
              !lines[j].startsWith("\t") &&
              !lines[j].startsWith("#")
            ) {
              // Check if it's a continuation of a multi-line statement from the rule
              const prevNonEmptyLine = lines
                .slice(0, j)
                .reverse()
                .find((l) => l.trim() !== "");
              if (
                prevNonEmptyLine &&
                !prevNonEmptyLine.trim().endsWith(",") &&
                !prevNonEmptyLine.trim().endsWith("\\")
              ) {
                break;
              }
            }

            ruleLines.push(j + 1);
          }
          break;
        }
      }

      return ruleLines;
    },
    [getContentString],
  );

  // Memoized content string extraction
  const contentString = useMemo(() => {
    return getContentString(snakefileContent);
  }, [snakefileContent, getContentString]);

  // Effect to handle selectedRule changes
  useEffect(() => {
    if (selectedRule && contentString) {
      const ruleLines = findRuleLines(contentString, selectedRule);
      setHighlightedLines(ruleLines);

      // Scroll to the rule within the code container
      if (ruleLines.length > 0) {
        setTimeout(() => {
          const scrollContainer = syntaxHighlighterRef.current;
          const lineElement = document.querySelector(
            `[data-line-number="${ruleLines[0]}"]`,
          );
          if (lineElement && scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const elementRect = lineElement.getBoundingClientRect();
            const scrollTop =
              scrollContainer.scrollTop +
              (elementRect.top - containerRect.top) -
              containerRect.height / 2;

            scrollContainer.scrollTo({
              top: scrollTop,
              behavior: "smooth",
            });
          }
        }, 100);
      }
    } else {
      setHighlightedLines([]);
    }
  }, [selectedRule, contentString, findRuleLines]);

  const handleCopy = async () => {
    if (!contentString) return;
    try {
      await navigator.clipboard.writeText(contentString);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleDownload = () => {
    if (!contentString) return;
    const blob = new Blob([contentString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Snakefile_${workflowId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getHighlightedContent = useMemo(() => {
    if (!contentString) return "";

    return contentString;
  }, [contentString]);

  const getLineProps = (lineNumber: number) => {
    const isHighlighted = highlightedLines.includes(lineNumber);
    return {
      style: {
        backgroundColor: isHighlighted
          ? isDarkTheme
            ? "#2d4a5a"
            : "#e6f7ff"
          : "transparent",
        display: "block",
        width: "100%",
      },
      "data-line-number": lineNumber,
    };
  };

  if (isLoading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        Loading Snakefile...
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Snakefile"
        description="Failed to load the Snakefile content. Please try again."
        type="error"
        style={{ margin: "20px" }}
      />
    );
  }

  if (!snakefileContent) {
    return (
      <Alert
        message="No Snakefile Found"
        description="No Snakefile content available for this workflow."
        type="info"
        style={{ margin: "20px" }}
      />
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        maxHeight: "100%",
      }}
    >
      {/* Fixed Header with controls */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
          backgroundColor: "#fafafa",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              Snakefile - Workflow {workflowId}
            </span>
            {selectedRule && (
              <span
                style={{
                  color: "#1890ff",
                  fontSize: "12px",
                  backgroundColor: "#e6f7ff",
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                Showing: {selectedRule}
              </span>
            )}
          </div>

          <Space>
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={handleCopy}
              size="small"
              title="Copy to clipboard"
            />
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              size="small"
              title="Download file"
            />
            <Button
              type="text"
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              size="small"
              title="Toggle theme"
            >
              {isDarkTheme ? "☀️" : "🌙"}
            </Button>
          </Space>
        </div>
      </div>

      {/* Scrollable Code content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          height: 0, // This forces the flex item to respect the parent's height
        }}
        ref={syntaxHighlighterRef}
      >
        <SyntaxHighlighter
          language="python"
          style={isDarkTheme ? oneDark : oneLight}
          showLineNumbers
          wrapLines
          lineProps={getLineProps}
          customStyle={{
            margin: 0,
            padding: "16px",
            fontSize: "13px",
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
            backgroundColor: isDarkTheme ? "#282c34" : "#fafafa",
            minHeight: "100%",
          }}
          lineNumberStyle={{
            color: isDarkTheme ? "#666" : "#999",
            fontSize: "12px",
            paddingRight: "10px",
            userSelect: "none",
            minWidth: "40px",
          }}
        >
          {getHighlightedContent}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default SnakefileViewerWithFilter;
