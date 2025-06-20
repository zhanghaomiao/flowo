import { CopyOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface SnakefileViewerProps {
  visible: boolean;
  onClose: () => void;
  snakefileContent: string;
  workflowId: string;
}

const SnakefileViewer: React.FC<SnakefileViewerProps> = ({
  visible,
  onClose,
  snakefileContent,
  workflowId,
}) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snakefileContent);
      // You could add a notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Snakefile - Workflow {workflowId}</span>
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={handleCopy}
            size="small"
            title="Copy to clipboard"
          />
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={800}
      styles={{ body: { padding: 0, top: 20 } }}
    >
      <div style={{ maxHeight: "70vh", overflow: "auto" }}>
        <SyntaxHighlighter
          language="yaml"
          style={oneLight}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "16px",
            fontSize: "13px",
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
          }}
          lineNumberStyle={{
            color: "#999",
            fontSize: "12px",
            paddingRight: "10px",
            userSelect: "none",
          }}
        >
          {snakefileContent}
        </SyntaxHighlighter>
      </div>
    </Modal>
  );
};

export default SnakefileViewer;
