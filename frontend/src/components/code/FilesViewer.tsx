import {
  CloseOutlined,
  FileOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { Button, Col, Empty, Modal, Row, Tooltip } from "antd";
import React, { useEffect, useState } from "react";

import FileContent from "./FileContent";

interface FilesViewerProps {
  visible: boolean;
  onClose: () => void;
  fileContent: { [path: string]: string };
  workflowId?: string;
  jobId?: number;
}

// Get file format for FileViewer
const getFileFormat = (filePath: string | null): "log" | "yaml" | "json" => {
  if (!filePath) return "yaml";

  const extension = filePath.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    default:
      return "yaml";
  }
};

// Get file name from path
const getFileName = (filePath: string): string => {
  return filePath.split("/").pop() || filePath;
};

const FilesViewer: React.FC<FilesViewerProps> = ({
  visible,
  onClose,
  fileContent,
  workflowId,
  jobId,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const filePaths = Object.keys(fileContent);

  useEffect(() => {
    if (visible && filePaths.length > 0 && !selectedFile) {
      setSelectedFile(filePaths[0]);
    }
  }, [visible, filePaths, selectedFile]);

  useEffect(() => {
    if (!visible) {
      setSelectedFile(null);
    }
  }, [visible]);

  const handleFileClick = (filePath: string) => {
    setSelectedFile(filePath);
  };

  const renderFileContent = () => {
    if (!selectedFile || !fileContent[selectedFile]) {
      return (
        <Empty
          description="No file content to display"
          style={{ marginTop: "50px" }}
        />
      );
    }

    return (
      <FileContent
        fileContent={fileContent[selectedFile]}
        fileName={selectedFile}
        fileFormat={getFileFormat(selectedFile)}
        showFileName={true}
      />
    );
  };

  return (
    <Modal
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <FileOutlined />
          <span>
            Files Viewer -{" "}
            {workflowId ? `Workflow ${workflowId}` : `Job ${jobId}`}
          </span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      closeIcon={<CloseOutlined />}
      styles={{ body: { height: "75vh", padding: "2px", top: 10 } }}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "16px", marginBottom: "10px" }}>
          Files ({filePaths.length})
        </span>

        {filePaths.length === 0 ? (
          <Empty description="No files to display" />
        ) : (
          <Row gutter={[8, 8]} style={{ marginBottom: "10px" }}>
            {filePaths.map((filePath) => (
              <Col key={filePath}>
                <Tooltip title={filePath} placement="top">
                  <Button
                    type={selectedFile === filePath ? "primary" : "default"}
                    size="large"
                    icon={
                      <FileTextOutlined
                        style={{ fontSize: "24px", color: "#52c41a" }}
                      />
                    }
                    onClick={() => handleFileClick(filePath)}
                    style={{
                      height: "60px",
                      width: "80px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      padding: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        textAlign: "center",
                        lineHeight: "12px",
                        maxWidth: "70px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getFileName(filePath)}
                    </div>
                  </Button>
                </Tooltip>
              </Col>
            ))}
          </Row>
        )}
        {renderFileContent()}
      </div>
    </Modal>
  );
};

export default FilesViewer;
