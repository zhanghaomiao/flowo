import { Button, Modal } from "antd";
import React from "react";

import FileContent from "./FileContent";

interface FileViewerProps {
  visible: boolean;
  onClose: () => void;
  fileContent: string;
  fileFormat?: "log" | "yaml" | "json" | "python";
  title: string;
}

const FileViewer: React.FC<FileViewerProps> = ({
  visible,
  onClose,
  fileContent,
  fileFormat = "yaml",
  title,
}) => {
  return (
    <Modal
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{title}</span>
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
      styles={{ body: { height: "75vh", padding: "16px", top: 20 } }}
    >
      <FileContent fileContent={fileContent} fileFormat={fileFormat} />
    </Modal>
  );
};

export default FileViewer;
