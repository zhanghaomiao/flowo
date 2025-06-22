import "./ResultViewer.css";

import {
  DownloadOutlined,
  EyeOutlined,
  FolderOutlined,
  FullscreenOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
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
import React, { useState, useCallback } from "react";

import { constructApiUrl } from "../../api/client";
import {
  useWorkflowDetail,
  useCaddyDirectoryTree,
  useLazyDirectoryLoad,
} from "../../hooks/useQueries";
import { FilePreview, renderFullscreenPreview } from "./FilePreview";
import { convertToAntdTreeData } from "./FileTree";
import {
  ALL_SUPPORTED_EXTENSIONS,
  formatFileSize,
  getFileIcon,
  getFileTypeCategory,
  isFileTooLargeForPreview,
} from "./FileUtils";
import type {
  ResultViewerProps,
  SelectedNodeData,
  TreeSelectInfo,
  AntdTreeNode,
} from "./types";

const { Text } = Typography;

export const ResultViewer: React.FC<ResultViewerProps> = ({
  workflowId,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(false);
  const [selectedNodeData, setSelectedNodeData] =
    useState<SelectedNodeData | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState<boolean>(false);
  const [loadedDirectories, setLoadedDirectories] = useState<Set<string>>(new Set());

  // Local tree state to manage the complete tree data
  const [treeData, setTreeData] = useState<AntdTreeNode[]>([]);

  // Get workflow detail to get the directory
  const {
    data: workflowDetail,
    isLoading: isWorkflowLoading,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useWorkflowDetail(workflowId);

  // Get initial directory tree from Caddy server (only root level)
  const {
    data: outputsTree,
    isLoading: isTreeLoading,
    error: treeError,
    refetch: refetchTree,
  } = useCaddyDirectoryTree(workflowDetail?.directory || null);

  // Lazy loading mutation
  const lazyLoadMutation = useLazyDirectoryLoad();
  const working_path = workflowDetail?.directory?.replace(import.meta.env.VITE_FLOWO_WORKING_PATH, '');

  const isLoading = isWorkflowLoading || isTreeLoading;
  const error = workflowError || treeError;
  const refetch = () => {
    refetchWorkflow();
    refetchTree();
  };

  // Function to update tree node with new children
  const updateTreeNode = useCallback((path: string, newChildren: AntdTreeNode[]) => {
    setTreeData(prevTreeData => {
      const updateNode = (nodes: AntdTreeNode[]): AntdTreeNode[] => {
        return nodes.map(node => {
          if (node.fullPath === path) {
            // Update this node with new children
            return {
              ...node,
              children: newChildren,
            };
          } else if (node.children) {
            // Recursively update children
            return {
              ...node,
              children: updateNode(node.children),
            };
          }
          return node;
        });
      };

      return updateNode(prevTreeData);
    });
  }, []);

  // Handle lazy loading when a directory is expanded
  const handleLoadData = useCallback(async (node: AntdTreeNode) => {
    if (node.type === "directory" && !loadedDirectories.has(node.fullPath)) {
      try {
        const newChildren = await lazyLoadMutation.mutateAsync(node.fullPath);
        setLoadedDirectories(prev => new Set(prev).add(node.fullPath));

        // Convert the new children to AntdTreeNode format and update the tree
        const convertedChildren = convertToAntdTreeData(newChildren, node.fullPath, handleLoadData);
        updateTreeNode(node.fullPath, convertedChildren);
      } catch (error) {
        console.error("Failed to load directory:", error);
        message.error(`Failed to load directory: ${node.title}`);
      }
    }
  }, [lazyLoadMutation, loadedDirectories, updateTreeNode]);

  // Update tree data when initial data loads
  React.useEffect(() => {
    if (outputsTree && outputsTree.length > 0) {
      const initialTreeData = convertToAntdTreeData(outputsTree, working_path, handleLoadData);
      setTreeData(initialTreeData);
    }
  }, [outputsTree, working_path]);

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

  const handleFullscreenOpen = () => {
    setIsFullscreenOpen(true);
  };

  const handleFullscreenClose = () => {
    setIsFullscreenOpen(false);
  };

  const handleDownload = (fullPath: string, filename: string) => {
    try {
      const downloadUrl = constructApiUrl(`/files/${fullPath}?download=true`);
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
    const fileSize = (nodeData as any).fileSize;

    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <Text strong style={{ fontSize: "16px" }}>
              {getFileIcon(nodeData.title || "")} {nodeData.title}
            </Text>
            {fileSize && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                ({formatFileSize(fileSize)})
              </Text>
            )}
          </div>

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
              {!isFileTooLargeForPreview(fileSize) && (
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={handleFullscreenOpen}
                  size="small"
                >
                  Full Screen
                </Button>
              )}
            </Space>
          )}
        </div>

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
              <FilePreview nodeData={selectedNodeData} />
            </div>
          </div>
        )}

        {type === "directory" && hasChildren && nodeData.children && (
          <div>
            <Text strong>Contents:</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {nodeData.children.slice(0, 10).map((child: any) => (
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
                  {child.fileSize && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      ({formatFileSize(child.fileSize)})
                    </Text>
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

    if (!workflowDetail?.directory) {
      return (
        <Alert
          message="No Output Directory Found"
          description="This workflow has no output directory or the directory is not yet available."
          type="info"
          showIcon
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
              loadData={handleLoadData}
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
        }}
      >
        <Button
          type="text"
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
          loading={isLoading}
        >
          Refresh
        </Button>
        <Text type="secondary" style={{ fontSize: "12px" }}>
          Showing: {ALL_SUPPORTED_EXTENSIONS.join(", ")}
        </Text>
      </div>

      {renderContent()}

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
