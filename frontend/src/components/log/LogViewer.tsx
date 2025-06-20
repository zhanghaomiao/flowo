import { Alert, Modal, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";

import { useWorkflowLogs } from "../../hooks/useQueries";

const { Text } = Typography;

interface LogViewerProps {
  visible: boolean;
  onClose: () => void;
  workflowId: string;
}

// Define the log response structure based on the error message
interface LogResponse {
  workflow_id: string;
  log_file: string;
  content: string;
  message: string;
}

const LogViewer: React.FC<LogViewerProps> = ({
  visible,
  onClose,
  workflowId,
}) => {
  const [logContent, setLogContent] = useState<string>("");

  const {
    data: staticLogs,
    isLoading,
    error,
  } = useWorkflowLogs(workflowId, visible);

  // Initialize log content when modal opens or data changes
  useEffect(() => {
    if (visible && staticLogs) {
      const logResponse = staticLogs as LogResponse;
      if (logResponse.content) {
        setLogContent(logResponse.content);
      } else {
        setLogContent(logResponse.message || "No log content available");
      }
    } else if (visible && !staticLogs) {
      setLogContent("");
    }
  }, [visible, staticLogs]);

  const handleClose = () => {
    setLogContent("");
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Workflow Logs - {workflowId}</span>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={null}
    >
      <div
        style={{ height: "500px", display: "flex", flexDirection: "column" }}
      >
        {error && (
          <Alert
            message="Error Loading Logs"
            description={
              error instanceof Error ? error.message : "Unknown error"
            }
            type="error"
            style={{ marginBottom: "16px" }}
            showIcon
          />
        )}

        {/* Log content */}
        {isLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              backgroundColor: "#1e1e1e",
              color: "#d4d4d4",
              padding: "16px",
              fontFamily:
                'Monaco, Menlo, "Ubuntu Mono", consolas, "source-code-pro", monospace',
              fontSize: "12px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
            }}
          >
            {logContent || (
              <Text type="secondary" style={{ color: "#888" }}>
                No logs available...
              </Text>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default LogViewer;
