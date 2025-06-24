import { Button, Modal } from "antd";
import React from "react";

import FileContent from "./FileContent";

interface FileViewerProps {
  visible: boolean;
  onClose: () => void;
  fileContent: string;
  workflowId?: string | null;
  jobId?: number | null;
  fileFormat?: "log" | "yaml" | "json";
}

const FileViewer: React.FC<FileViewerProps> = ({
  visible,
  onClose,
  fileContent,
  workflowId,
  jobId,
  fileFormat = "yaml",
}) => {
  return (
    <Modal
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {fileFormat === "yaml" && (
            <span>Snakefile - Workflow {workflowId}</span>
          )}
          {fileFormat === "log" && <span>Log - Workflow {workflowId}</span>}
          {jobId && <span>Job - {jobId} Details</span>}
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={1000}
      styles={{ body: { padding: "16px", top: 20 } }}
    >
      <FileContent fileContent={fileContent} fileFormat={fileFormat} />
    </Modal>
  );
};

export default FileViewer;
