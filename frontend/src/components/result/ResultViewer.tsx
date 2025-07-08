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
  message,
  Modal,
  Space,
  Spin,
  Splitter,
  Tag,
  Tree,
  Typography,
} from "antd";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { constructApiUrl } from "../../api/client";
import {
  useCaddyDirectoryTree,
  useLazyDirectoryLoad,
  useRuleOutput,
  useWorkflowDetail,
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
  AntdTreeNode,
  ResultViewerProps,
  SelectedNodeData,
  TreeSelectInfo,
} from "./types";

const { Text } = Typography;

export const ResultViewer: React.FC<ResultViewerProps> = ({
  workflowId,
  selectedRule,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(false);
  const [selectedNodeData, setSelectedNodeData] =
    useState<SelectedNodeData | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState<boolean>(false);

  const [loadedKeys, setLoadedKeys] = useState<React.Key[]>([]);
  const [treeData, setTreeData] = useState<AntdTreeNode[]>([]);
  const [treeHeight, setTreeHeight] = useState<number>(400);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const {
    data: workflowDetail,
    isLoading: isWorkflowLoading,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useWorkflowDetail(workflowId);

  const {
    data: outputsTree,
    isLoading: isTreeLoading,
    error: treeError,
    refetch: refetchTree,
  } = useCaddyDirectoryTree(workflowDetail?.flowo_directory || null);

  const {
    data: ruleOutput,
    isLoading: isRuleOutputLoading,
    error: ruleOutputError,
    refetch: refetchRuleOutput,
  } = useRuleOutput(workflowId, selectedRule || "");

  // Lazy loading mutation
  const lazyLoadMutation = useLazyDirectoryLoad();
  const isLoading = isWorkflowLoading || isTreeLoading;
  const error = workflowError || treeError;
  const refetch = () => {
    refetchWorkflow();
    refetchTree();
  };

  const updateTreeNode = useCallback(
    (path: string, newChildren: AntdTreeNode[]) => {
      setTreeData((prevTreeData) => {
        const updateNode = (nodes: AntdTreeNode[]): AntdTreeNode[] => {
          return nodes.map((node) => {
            if (node.fullPath === path) {
              return {
                ...node,
                children: newChildren,
              };
            } else if (node.children) {
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
    },
    [],
  );

  // Handle lazy loading when a directory is expanded
  const handleLoadData = useCallback(
    async (node: AntdTreeNode) => {
      if (node.type === "directory" && !loadedKeys.includes(node.key)) {
        try {
          const newChildren = await lazyLoadMutation.mutateAsync(node.fullPath);

          // Mark this node as loaded in Tree component
          setLoadedKeys((prev) => [...prev, node.key]);

          // Convert the new children to AntdTreeNode format and update the tree
          const convertedChildren = convertToAntdTreeData(
            newChildren,
            node.fullPath,
            handleLoadData,
          );
          updateTreeNode(node.fullPath, convertedChildren);
        } catch (error) {
          console.error("Failed to load directory:", error);
          message.error(`Failed to load directory: ${node.title}`);
        }
      }
    },
    [lazyLoadMutation, loadedKeys, updateTreeNode],
  );

  // Update tree data when initial data loads
  React.useEffect(() => {
    if (outputsTree && outputsTree.length > 0) {
      const initialTreeData = convertToAntdTreeData(
        outputsTree,
        workflowDetail?.flowo_directory || "",
        handleLoadData,
      );
      setTreeData(initialTreeData);
    }
  }, [outputsTree, workflowDetail?.flowo_directory]);

  useEffect(() => {
    const updateTreeHeight = () => {
      if (treeContainerRef.current) {
        const containerHeight = treeContainerRef.current.clientHeight;
        const availableHeight = containerHeight - 100;
        setTreeHeight(Math.max(200, availableHeight));
      }
    };

    updateTreeHeight();

    window.addEventListener("resize", updateTreeHeight);

    const resizeObserver = new ResizeObserver(updateTreeHeight);
    if (treeContainerRef.current) {
      resizeObserver.observe(treeContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateTreeHeight);
      resizeObserver.disconnect();
    };
  }, []);

  const handleExpand = (expandedKeysValue: React.Key[]) => {
    // Find nodes that were collapsed (were in expandedKeys but not in expandedKeysValue)
    const collapsedKeys = expandedKeys.filter(
      (key) => !expandedKeysValue.includes(key),
    );

    // Remove collapsed nodes from loadedKeys to allow re-loading
    // Also clean up the tree data to free memory
    if (collapsedKeys.length > 0) {
      // Remove from loadedKeys so Tree component will call loadData again
      setLoadedKeys((prev) =>
        prev.filter((key) => !collapsedKeys.includes(key)),
      );

      // Remove from our internal tracking
      setTreeData((currentTreeData) => {
        const removeCollapsedData = (nodes: AntdTreeNode[]): AntdTreeNode[] => {
          return nodes.map((node) => {
            if (
              node.type === "directory" &&
              collapsedKeys.includes(node.key) &&
              node.children &&
              node.children.length > 0
            ) {
              // Clear children to free memory
              return {
                ...node,
                children: [], // Reset to empty array for next load
              };
            } else if (node.children) {
              return {
                ...node,
                children: removeCollapsedData(node.children),
              };
            }
            return node;
          });
        };
        return removeCollapsedData(currentTreeData);
      });
    }

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
    const fileSize = nodeData.fileSize ?? null;

    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
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
              {!isFileTooLargeForPreview(fileSize, nodeData.title || "") && (
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
          <div
            style={{
              marginTop: 8,
              flex: 1,
              border: "1px solid #f0f0f0",
              borderRadius: "4px",
              padding: "8px",
            }}
          >
            <FilePreview nodeData={selectedNodeData} />
          </div>
        )}

        {type === "directory" && hasChildren && nodeData.children && (
          <div>
            <Text strong>Contents:</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {nodeData.children.slice(0, 10).map((child) => (
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
      </div>
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
      <Splitter style={{ overflow: "auto", height: "100%" }}>
        <Splitter.Panel defaultSize="30%" min="20%" max="40%">
          <Card
            style={{
              overflow: "auto",
              background: "#fafafa",
              border: "none",
              textAlign: "left",
            }}
          >
            <Tree
              showIcon
              loadData={handleLoadData}
              loadedKeys={loadedKeys}
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
              height={treeHeight}
            />
          </Card>
        </Splitter.Panel>
        <Splitter.Panel style={{ height: "100%" }}>
          <Card
            style={{
              height: "100%",
            }}
            styles={{ body: { height: "100%" } }}
          >
            {renderPreview()}
          </Card>
        </Splitter.Panel>
      </Splitter>
    );
  };

  return (
    <div
      ref={treeContainerRef}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
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
