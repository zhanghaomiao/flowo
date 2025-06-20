import "./ResultViewer.css";

import {
  CodeOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FolderOutlined,
  FullscreenOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
  Image,
  InputNumber,
  message,
  Modal,
  Space,
  Spin,
  Splitter,
  Tag,
  Tree,
  Typography,
} from "antd";
import React, { useState } from "react";

import type { TreeDataNode } from "../../api/api";
import { constructApiUrl } from "../../api/client";
import { useOutPutsTree } from "../../hooks/useQueries";

const { Text, Paragraph } = Typography;

interface ResultViewerProps {
  workflowId: string;
  initialMaxDepth?: number;
}

interface AntdTreeNode {
  title: string;
  key: string;
  icon: React.ReactNode;
  children?: AntdTreeNode[];
  isLeaf: boolean;
  fullPath: string;
  type: "file" | "directory";
  fileExtension: string;
  nodeData: TreeDataNode;
}

interface SelectedNodeData {
  title: string;
  key: string;
  icon: React.ReactNode;
  children?: AntdTreeNode[];
  isLeaf: boolean;
  fullPath: string;
  type: "file" | "directory";
  fileExtension: string;
  nodeData: TreeDataNode;
}

interface TreeSelectInfo {
  event: "select";
  selected: boolean;
  node: SelectedNodeData;
  selectedNodes: SelectedNodeData[];
  nativeEvent: MouseEvent;
}

// File type configuration based on Caddyfile
const FILE_TYPES = {
  images: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico"],
  pdfs: ["pdf"],
  html: ["html", "htm"],
  text: ["txt", "log", "md"],
  json: ["json"],
};

const ALL_SUPPORTED_EXTENSIONS = [
  ...FILE_TYPES.images,
  ...FILE_TYPES.pdfs,
  ...FILE_TYPES.html,
  ...FILE_TYPES.text,
  ...FILE_TYPES.json,
];

// Get file extension from filename
const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

// Check if file is supported
const isSupportedFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ALL_SUPPORTED_EXTENSIONS.includes(ext);
};

// Get file type category
const getFileTypeCategory = (filename: string): string => {
  const ext = getFileExtension(filename);
  if (FILE_TYPES.images.includes(ext)) return "image";
  if (FILE_TYPES.pdfs.includes(ext)) return "pdf";
  if (FILE_TYPES.html.includes(ext)) return "html";
  if (FILE_TYPES.text.includes(ext)) return "text";
  if (FILE_TYPES.json.includes(ext)) return "json";
  return "unknown";
};

// Get appropriate icon for file type
const getFileIcon = (filename: string) => {
  const category = getFileTypeCategory(filename);
  switch (category) {
    case "image":
      return <FileImageOutlined />;
    case "pdf":
      return <FilePdfOutlined />;
    case "html":
      return <CodeOutlined />;
    case "text":
      return <FileTextOutlined />;
    case "json":
      return <CodeOutlined />;
    default:
      return <FileOutlined />;
  }
};

// Filter tree nodes to only include supported files and directories containing them
const filterSupportedFiles = (nodes: TreeDataNode[]): TreeDataNode[] => {
  return nodes
    .map((node) => {
      if (node.isLeaf) {
        // For files, only include if supported
        return isSupportedFile(node.title || "") ? node : null;
      } else {
        // For directories, recursively filter children
        const filteredChildren = node.children
          ? filterSupportedFiles(node.children)
          : [];
        // Only include directory if it has supported files
        if (filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      }
    })
    .filter(Boolean) as TreeDataNode[];
};

// Convert API TreeDataNode to Antd Tree format with filtering
const convertToAntdTreeData = (
  nodes: TreeDataNode[],
  parentPath = "",
): AntdTreeNode[] => {
  const filteredNodes = filterSupportedFiles(nodes);

  return filteredNodes.map((node) => {
    const fullPath = parentPath ? `${parentPath}/${node.title}` : node.title;
    const fileExtension = node.isLeaf ? getFileExtension(node.title || "") : "";

    return {
      title: node.title || "",
      key: node.key || "",
      icon: node.isLeaf ? getFileIcon(node.title || "") : <FolderOutlined />,
      children: node.children
        ? convertToAntdTreeData(node.children, fullPath)
        : undefined,
      isLeaf: node.isLeaf || false,
      fullPath,
      type: node.isLeaf ? "file" : "directory",
      fileExtension,
      nodeData: node, // Store original node data for preview
    };
  });
};

// Image Preview Component
const ImagePreview: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <div
    style={{
      textAlign: "center",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <Image
      src={src}
      alt={alt}
      style={{ maxWidth: "60%", maxHeight: "60%" }}
      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Yk1RUG8A+1CC4iIOcnkcIaYAjhvQ=="
    />
  </div>
);

// Text Preview Component
const TextPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading text file:", error);
        setContent("Error loading file content");
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return (
    <div style={{ maxHeight: "400px", overflow: "auto" }}>
      <Paragraph>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>
          {content}
        </pre>
      </Paragraph>
    </div>
  );
};

// JSON Preview Component
const JsonPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.json())
      .then((json) => {
        setContent(json);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading JSON file:", error);
        setContent({ error: "Failed to load JSON content" });
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return (
    <div style={{ maxHeight: "400px", overflow: "auto" }}>
      <pre
        style={{
          fontSize: "12px",
          background: "#f5f5f5",
          padding: "8px",
          borderRadius: "4px",
        }}
      >
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
};

// PDF Preview Component
const PdfPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "calc(100vh - 450px)" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "none" }}
      title="PDF Preview"
    />
  </div>
);

// HTML Preview Component
const HtmlPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "calc(100vh - 450px)" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "1px solid #d9d9d9" }}
      title="HTML Preview"
    />
  </div>
);

// Enhanced components for fullscreen display
const FullscreenImagePreview: React.FC<{ src: string; alt: string }> = ({
  src,
  alt,
}) => (
  <div style={{ textAlign: "center", height: "100%" }}>
    <Image
      src={src}
      alt={alt}
      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAE..."
    />
  </div>
);

const FullscreenTextPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading text file:", error);
        setContent("Error loading file content");
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <Paragraph>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: "14px",
            fontFamily: "monospace",
          }}
        >
          {content}
        </pre>
      </Paragraph>
    </div>
  );
};

const FullscreenJsonPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.json())
      .then((json) => {
        setContent(json);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading JSON file:", error);
        setContent({ error: "Failed to load JSON content" });
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <pre
        style={{
          fontSize: "14px",
          background: "#f5f5f5",
          padding: "16px",
          borderRadius: "4px",
          fontFamily: "monospace",
        }}
      >
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
};

const FullscreenPdfPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "100%" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "none" }}
      title="PDF Preview"
    />
  </div>
);

const FullscreenHtmlPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "100%" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "1px solid #d9d9d9" }}
      title="HTML Preview"
    />
  </div>
);

// Enhanced render function for fullscreen
const renderFullscreenPreview = (nodeData: SelectedNodeData) => {
  const { fullPath, fileExtension } = nodeData;
  const fileUrl = constructApiUrl(`/files/${fullPath}`);
  const category = getFileTypeCategory(nodeData.nodeData.title || "");

  switch (category) {
    case "image":
      return (
        <FullscreenImagePreview
          src={fileUrl}
          alt={nodeData.nodeData.title || ""}
        />
      );
    case "text":
      return <FullscreenTextPreview src={fileUrl} />;
    case "json":
      return <FullscreenJsonPreview src={fileUrl} />;
    case "pdf":
      return <FullscreenPdfPreview src={fileUrl} />;
    case "html":
      return <FullscreenHtmlPreview src={fileUrl} />;
    default:
      return (
        <Alert
          message="Preview Not Available"
          description={`Fullscreen preview for ${fileExtension} files is not supported yet.`}
          type="info"
          showIcon
        />
      );
  }
};

export const ResultViewer: React.FC<ResultViewerProps> = ({
  workflowId,
  initialMaxDepth = 2,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);
  const [maxDepth, setMaxDepth] = useState<number>(initialMaxDepth);
  const [selectedNodeData, setSelectedNodeData] =
    useState<SelectedNodeData | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState<boolean>(false);

  const {
    data: outputsTree,
    isLoading,
    error,
    refetch,
  } = useOutPutsTree(workflowId, maxDepth);

  const handleExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue);
    setAutoExpandParent(false);
  };

  const handleSelect = (
    selectedKeysValue: React.Key[],
    info: TreeSelectInfo,
  ) => {
    setSelectedKeys(selectedKeysValue);
    if (info.node) {
      setSelectedNodeData(info.node);
    }
  };

  const handleDepthChange = (value: number | null) => {
    if (value && value >= 1 && value <= 10) {
      setMaxDepth(value);
    }
  };

  const handleFullscreenOpen = () => {
    setIsFullscreenOpen(true);
  };

  const handleFullscreenClose = () => {
    setIsFullscreenOpen(false);
  };

  const handleDownload = (fullPath: string, filename: string) => {
    try {
      // Add download query parameter to force Content-Disposition: attachment
      const downloadUrl = constructApiUrl(`/files/${fullPath}?download=true`);

      // Use direct link approach for download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success(`Downloading ${filename}`);
    } catch (error) {
      console.error("Download failed:", error);
      message.error(`Failed to download ${filename}`);
    }
  };

  const renderFilePreview = (nodeData: SelectedNodeData) => {
    const { fullPath, type, fileExtension } = nodeData;

    if (type !== "file") return null;

    const fileUrl = constructApiUrl(`/files/${fullPath}`);
    const category = getFileTypeCategory(nodeData.nodeData.title || "");

    switch (category) {
      case "image":
        return (
          <ImagePreview src={fileUrl} alt={nodeData.nodeData.title || ""} />
        );
      case "text":
        return <TextPreview src={fileUrl} />;
      case "json":
        return <JsonPreview src={fileUrl} />;
      case "pdf":
        return <PdfPreview src={fileUrl} />;
      case "html":
        return <HtmlPreview src={fileUrl} />;
      default:
        return (
          <Alert
            message="Preview Not Available"
            description={`Preview for ${fileExtension} files is not supported yet.`}
            type="info"
            showIcon
          />
        );
    }
  };

  const renderPreview = () => {
    if (!selectedNodeData) {
      return (
        <Empty
          image={<EyeOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />}
          description="Select a file to preview"
        />
      );
    }

    const { nodeData, fullPath, type } = selectedNodeData;
    const hasChildren = nodeData.children && nodeData.children.length > 0;

    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text strong style={{ fontSize: "16px" }}>
            {getFileIcon(nodeData.title || "")} {nodeData.title}
          </Text>

          {type === "file" && (
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(fullPath, nodeData.title || "")}
                size="small"
              >
                Download
              </Button>
              <Button
                icon={<FullscreenOutlined />}
                onClick={handleFullscreenOpen}
                size="small"
              >
                Full Screen
              </Button>
            </Space>
          )}
        </div>

        {/* File Preview */}
        {type === "file" && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                marginTop: 8,
                border: "1px solid #f0f0f0",
                borderRadius: "4px",
                padding: "8px",
              }}
            >
              {renderFilePreview(selectedNodeData)}
            </div>
          </div>
        )}

        {/* Directory Contents */}
        {type === "directory" && hasChildren && nodeData.children && (
          <div>
            <Text strong>Contents:</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {nodeData.children.slice(0, 10).map((child: TreeDataNode) => (
                <li key={child.key} style={{ marginBottom: 4 }}>
                  {child.isLeaf ? (
                    getFileIcon(child.title || "")
                  ) : (
                    <FolderOutlined />
                  )}{" "}
                  {child.title}
                  {child.isLeaf && (
                    <Tag style={{ marginLeft: 8 }}>
                      {getFileTypeCategory(child.title || "")}
                    </Tag>
                  )}
                </li>
              ))}
              {nodeData.children.length > 10 && (
                <li style={{ color: "#888" }}>
                  ... and {nodeData.children.length - 10} more items
                </li>
              )}
            </ul>
          </div>
        )}
      </Space>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ textAlign: "center", padding: "50px" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px" }}>Loading workflow outputs...</div>
        </div>
      );
    }

    if (error) {
      return (
        <Alert
          message="Error Loading Outputs"
          description={
            error instanceof Error
              ? error.message
              : "Failed to load workflow outputs"
          }
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      );
    }

    if (!outputsTree || outputsTree.length === 0) {
      return (
        <Alert
          message="No Outputs Found"
          description="This workflow has no output files or the outputs are not yet available."
          type="info"
          showIcon
        />
      );
    }

    const treeData = convertToAntdTreeData(outputsTree);

    if (treeData.length === 0) {
      return (
        <Alert
          message="No Supported Files Found"
          description={`No supported file types found. Supported types: ${ALL_SUPPORTED_EXTENSIONS.join(", ")}`}
          type="warning"
          showIcon
        />
      );
    }

    return (
      <Splitter style={{ height: "100%" }}>
        <Splitter.Panel defaultSize="30%" min="20%" max="40%">
          <Card
            style={{
              height: "100%",
              overflow: "auto",
              background: "#fafafa",
              border: "none",
            }}
          >
            <Tree
              showIcon
              onExpand={handleExpand}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onSelect={handleSelect}
              selectedKeys={selectedKeys}
              treeData={treeData}
              style={{
                overflow: "auto",
                background: "#fafafa",
              }}
            />
          </Card>
        </Splitter.Panel>
        <Splitter.Panel>
          <Card
            style={{
              height: "100%",
              padding: "2px",
              overflow: "auto",
              background: "#fafafa",
              borderRadius: "4px",
              border: "1px solid #f0f0f0",
            }}
          >
            {renderPreview()}
          </Card>
        </Splitter.Panel>
      </Splitter>
    );
  };

  return (
    <div style={{ height: "100%" }}>
      {/* Header Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
        }}
      >
        <Space>
          <Text>Depth Level:</Text>
          <InputNumber
            min={1}
            max={10}
            value={maxDepth}
            onChange={handleDepthChange}
            style={{ width: 80 }}
            size="small"
          />
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Space>
        <Text type="secondary" style={{ fontSize: "12px" }}>
          Showing: {ALL_SUPPORTED_EXTENSIONS.join(", ")}
        </Text>
      </div>

      {/* Content */}
      {renderContent()}

      {/* Fullscreen Modal */}
      <Modal
        title={
          selectedNodeData
            ? `${selectedNodeData.nodeData.title}`
            : "File Preview"
        }
        open={isFullscreenOpen}
        onCancel={handleFullscreenClose}
        width="90vw"
        style={{ top: 20 }}
        footer={[
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() =>
              selectedNodeData &&
              handleDownload(
                selectedNodeData.fullPath,
                selectedNodeData.nodeData.title || "",
              )
            }
          >
            Download
          </Button>,
          <Button key="close" onClick={handleFullscreenClose}>
            Close
          </Button>,
        ]}
      >
        <div style={{ height: "80vh", overflow: "auto" }}>
          {selectedNodeData &&
            selectedNodeData.type === "file" &&
            renderFullscreenPreview(selectedNodeData)}
        </div>
      </Modal>
    </div>
  );
};
