import { client } from '@/client/client.gen';
import {
  DownloadOutlined,
  EyeOutlined,
  FullscreenOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Space,
  Spin,
  Splitter,
  Tree,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useGetJobOutputsQuery, useGetDetailQuery } from '@/client/@tanstack/react-query.gen';
import { FilePreview, renderFullscreenPreview } from './FilePreview';
import {
  combineRuleOutputWithDirectoryContent,
  convertRuleOutputToTreeData,
  convertToAntdTreeData,
} from './FileTree';
import {
  ALL_SUPPORTED_EXTENSIONS,
  formatFileSize,
  getFileIcon,
  isFileTooLargeForPreview,
} from './FileUtils';
import './ResultViewer.css';
import type {
  AntdTreeNode,
  ResultViewerProps,
  SelectedNodeData,
  TreeSelectInfo,
} from './types';

const { Text } = Typography;

// Get file extension from filename
export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

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
  const [loadedDirectoryPath, setLoadedDirectoryPath] = useState<string | null>(
    null,
  );
  const [loadedDirectories, setLoadedDirectories] = useState<Set<string>>(
    new Set(),
  );

  const [loadedKeys, setLoadedKeys] = useState<React.Key[]>([]);
  const [treeData, setTreeData] = useState<AntdTreeNode[]>([]);
  const [treeHeight, setTreeHeight] = useState<number>(400);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const {
    data: workflowDetail,
    isLoading: isWorkflowLoading,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useGetDetailQuery({
    path: {
      workflow_id: workflowId,
    },
  });

  const {
    data: outputsTree,
    isLoading: isTreeLoading,
    error: treeError,
    refetch: refetchTree,
  } = useCaddyDirectoryTree(
    workflowDetail?.flowo_directory || null,
    !!workflowDetail,
  );

  const {
    data: ruleOutput,
    isLoading: isRuleOutputLoading,
    error: ruleOutputError,
    refetch: refetchRuleOutput,
  } = useGetJobOutputsQuery({
    path: {
      workflow_id: workflowId,
    },
    query: {
      rule_name: selectedRule || '',
    },
  });

  // Hook for loading directory content when rule is selected
  const {
    data: directoryContent,
    error: directoryContentError,
    refetch: refetchDirectoryContent,
    isLoading: isDirectoryContentLoading,
  } = useCaddyDirectoryTree(loadedDirectoryPath, !!loadedDirectoryPath);

  // Lazy loading mutation
  const lazyLoadMutation = useLazyDirectoryLoad();
  const isLoading =
    isWorkflowLoading || (selectedRule ? isRuleOutputLoading : isTreeLoading);
  const error = workflowError || (selectedRule ? ruleOutputError : treeError);
  const refetch = () => {
    refetchWorkflow();
    if (selectedRule) {
      refetchRuleOutput();
    } else {
      refetchTree();
    }
    if (directoryContentError) {
      refetchDirectoryContent();
    }
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
      if (node.type === 'directory' && !loadedKeys.includes(node.key)) {
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
          console.error('Failed to load directory:', error);
          message.error(`Failed to load directory: ${node.title}`);
        }
      }
    },
    [lazyLoadMutation, loadedKeys, updateTreeNode],
  );

  React.useEffect(() => {
    setSelectedKeys([]);
    setExpandedKeys([]);
    setSelectedNodeData(null);
    setLoadedDirectoryPath(null);
    setLoadedDirectories(new Set());

    if (selectedRule && ruleOutput && ruleOutput.length > 0) {
      // Use rule output data to build tree
      const validPaths = ruleOutput.filter(
        (path): path is string => path !== null,
      );

      const treeData = convertRuleOutputToTreeData(
        validPaths,
        workflowDetail?.flowo_directory,
      );

      setTreeData(treeData);
    } else if (outputsTree && outputsTree.length > 0) {
      // Use regular workflow output tree
      const initialTreeData = convertToAntdTreeData(
        outputsTree,
        workflowDetail?.flowo_directory || '',
        handleLoadData,
      );
      setTreeData(initialTreeData);
    } else {
      // Clear tree data when switching modes or when no data is available
      setTreeData([]);
    }
  }, [outputsTree, workflowDetail?.flowo_directory, selectedRule, ruleOutput]);

  // Handle combining directory content with rule output after directory is loaded
  React.useEffect(() => {
    if (
      selectedRule &&
      ruleOutput &&
      ruleOutput.length > 0 &&
      loadedDirectoryPath &&
      directoryContent &&
      directoryContent.length > 0
    ) {
      const newTreeData = combineRuleOutputWithDirectoryContent(
        treeData,
        loadedDirectoryPath,
        directoryContent,
      );

      setTreeData(newTreeData);
    }
  }, [
    directoryContent,
    loadedDirectoryPath,
    ruleOutput,
    selectedRule,
    workflowDetail?.flowo_directory,
  ]);

  // Handler for loading directory content when rule is selected
  const handleLoadDirectoryContent = useCallback(() => {
    if (
      selectedRule &&
      selectedNodeData &&
      selectedNodeData.type === 'directory'
    ) {
      const directoryPath = selectedNodeData.fullPath;
      if (loadedDirectories.has(directoryPath)) return;
      setLoadedDirectoryPath(directoryPath);
      setLoadedDirectories((prev) => new Set(prev).add(directoryPath));
    }
  }, [selectedRule, selectedNodeData, loadedDirectories]);

  React.useEffect(() => {
    setLoadedDirectories(new Set());
    setLoadedDirectoryPath(null);
  }, [selectedRule]);

  useEffect(() => {
    const updateTreeHeight = () => {
      if (treeContainerRef.current) {
        const containerHeight = treeContainerRef.current.clientHeight;
        const availableHeight = containerHeight - 100;
        setTreeHeight(Math.max(200, availableHeight));
      }
    };

    updateTreeHeight();

    window.addEventListener('resize', updateTreeHeight);

    const resizeObserver = new ResizeObserver(updateTreeHeight);
    if (treeContainerRef.current) {
      resizeObserver.observe(treeContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateTreeHeight);
      resizeObserver.disconnect();
    };
  }, []);

  const handleExpand = (expandedKeysValue: React.Key[]) => {
    // For rule output, don't need to do memory cleanup since all data is available upfront
    if (!selectedRule) {
      const collapsedKeys = expandedKeys.filter(
        (key) => !expandedKeysValue.includes(key),
      );

      if (collapsedKeys.length > 0) {
        setLoadedKeys((prev) =>
          prev.filter((key) => !collapsedKeys.includes(key)),
        );

        // Remove from our internal tracking
        setTreeData((currentTreeData) => {
          const removeCollapsedData = (
            nodes: AntdTreeNode[],
          ): AntdTreeNode[] => {
            return nodes.map((node) => {
              if (
                node.type === 'directory' &&
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
      const downloadUrl = client.buildUrl({
        url: `/files/${fullPath}?download=true`,
      });
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`Downloading ${filename}`);
    } catch (error) {
      console.error('Download failed:', error);
      message.error(`Failed to download ${filename}`);
    }
  };

  const renderPreview = () => {
    if (!selectedNodeData) {
      return (
        <Empty
          image={<EyeOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
          description="Select a file to preview"
        />
      );
    }

    const { nodeData, fullPath, type } = selectedNodeData;
    const fileSize = nodeData.fileSize ?? null;

    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <Text strong style={{ fontSize: '16px' }}>
              {getFileIcon(nodeData.title || '')} {nodeData.title}
            </Text>
            {fileSize && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                ({formatFileSize(fileSize)})
              </Text>
            )}
          </div>

          {type === 'file' && (
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(fullPath, nodeData.title || '')}
                size="small"
              >
                Download
              </Button>
              {!isFileTooLargeForPreview(fileSize, nodeData.title || '') && (
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

        {type === 'file' && (
          <div
            style={{
              marginTop: 8,
              flex: 1,
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              padding: '8px',
            }}
          >
            <FilePreview nodeData={selectedNodeData} />
          </div>
        )}
        {type === 'directory' && selectedRule && (
          <div>
            <Text strong>Contents:</Text>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={handleLoadDirectoryContent}
              loading={isDirectoryContentLoading}
              style={{ marginLeft: 8 }}
            >
              Load all contents
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading workflow outputs...</div>
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
              : 'Failed to load workflow outputs'
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

    if (selectedRule) {
      // For rule output, check if rule output data is available
      if (!ruleOutput || ruleOutput.length === 0) {
        return (
          <Alert
            message="No Rule Outputs Found"
            description="This rule has no output files or the outputs are not yet available."
            type="info"
            showIcon
          />
        );
      }
    } else {
      // For regular workflow output, check directory and tree
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
    }

    if (treeData.length === 0) {
      return (
        <Alert
          message="No Supported Files Found"
          description={`No supported file types found. Supported types: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`}
          type="warning"
          showIcon
        />
      );
    }

    return (
      <Splitter style={{ overflow: 'auto', height: '100%' }}>
        <Splitter.Panel defaultSize="30%" min="20%" max="40%">
          <Card
            style={{
              overflow: 'auto',
              background: '#fafafa',
              border: 'none',
              textAlign: 'left',
            }}
          >
            <Tree
              showIcon
              loadData={selectedRule ? undefined : handleLoadData}
              loadedKeys={selectedRule ? undefined : loadedKeys}
              onExpand={handleExpand}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onSelect={handleSelect}
              selectedKeys={selectedKeys}
              treeData={treeData}
              style={{
                overflow: 'auto',
                background: '#fafafa',
              }}
              height={treeHeight}
            />
          </Card>
        </Splitter.Panel>
        <Splitter.Panel style={{ height: '100%' }}>
          <Card
            style={{
              height: '100%',
            }}
            styles={{ body: { height: '100%' } }}
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
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 0',
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
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {selectedRule
            ? `Rule Output: ${selectedRule} - This directory tree shows the output files declared in the snakefile of this rule.`
            : `Showing: ${ALL_SUPPORTED_EXTENSIONS.join(', ')}`}
        </Text>
      </div>

      {renderContent()}

      <Modal
        title={
          selectedNodeData
            ? `${selectedNodeData.nodeData.title}`
            : 'File Preview'
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
                selectedNodeData.nodeData.title || '',
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
        <div style={{ height: '80vh', overflow: 'auto' }}>
          {selectedNodeData &&
            selectedNodeData.type === 'file' &&
            renderFullscreenPreview(selectedNodeData)}
        </div>
      </Modal>
    </div>
  );
};
