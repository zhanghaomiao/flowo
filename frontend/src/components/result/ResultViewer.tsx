import {
  EyeOutlined,
  FileOutlined,
  FolderOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Row,
  Space,
  Spin,
  Tag,
  Tree,
  Typography,
} from "antd";
import React, { useState } from "react";

import type { TreeDataNode } from "../../api/api";
import { useOutPutsTree } from "../../hooks/useQueries";

const { Title, Text } = Typography;

interface ResultViewerProps {
  workflowId: string;
  initialMaxDepth?: number;
}

interface ExtendedTreeDataNode extends TreeDataNode {
  fullPath?: string;
  size?: number;
  type?: "file" | "directory";
}

// Convert API TreeDataNode to Antd Tree format
const convertToAntdTreeData = (
  nodes: TreeDataNode[],
  parentPath = "",
): any[] => {
  return nodes.map((node) => {
    const fullPath = parentPath ? `${parentPath}/${node.title}` : node.title;
    return {
      title: node.title,
      key: node.key,
      icon: node.isLeaf ? <FileOutlined /> : <FolderOutlined />,
      children: node.children
        ? convertToAntdTreeData(node.children, fullPath)
        : undefined,
      isLeaf: node.isLeaf,
      fullPath,
      type: node.isLeaf ? "file" : "directory",
      nodeData: node, // Store original node data for preview
    };
  });
};

export const ResultViewer: React.FC<ResultViewerProps> = ({
  workflowId,
  initialMaxDepth = 2,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);
  const [maxDepth, setMaxDepth] = useState<number>(initialMaxDepth);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);

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

  const handleSelect = (selectedKeysValue: React.Key[], info: any) => {
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

  const renderPreview = () => {
    if (!selectedNodeData) {
      return (
        <Empty
          image={<EyeOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />}
          description="Select a file or folder to preview"
        />
      );
    }

    const { nodeData, fullPath, type } = selectedNodeData;
    const hasChildren = nodeData.children && nodeData.children.length > 0;

    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          <Text strong style={{ fontSize: "16px" }}>
            {nodeData.icon ||
              (type === "file" ? <FileOutlined /> : <FolderOutlined />)}{" "}
            {nodeData.title}
          </Text>
          <br />
          <Text type="secondary">Path: {fullPath}</Text>
        </div>

        <div>
          <Tag color={type === "file" ? "blue" : "green"}>
            {type === "file" ? "File" : "Directory"}
          </Tag>
          {!nodeData.isLeaf && hasChildren && (
            <Tag color="orange">{nodeData.children.length} item(s)</Tag>
          )}
        </div>

        {type === "directory" && hasChildren && (
          <div>
            <Text strong>Contents:</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {nodeData.children.slice(0, 10).map((child: TreeDataNode) => (
                <li key={child.key} style={{ marginBottom: 4 }}>
                  {child.isLeaf ? <FileOutlined /> : <FolderOutlined />}{" "}
                  {child.title}
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

        <div style={{ fontSize: "12px", color: "#888", marginTop: 16 }}>
          <Text type="secondary">Key: {nodeData.key}</Text>
        </div>
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

    return (
      <Row gutter={8} style={{ height: "100%", overflow: "hidden" }}>
        <Col span={8} style={{ height: "100%", overflow: "auto" }}>
          <Card
            style={{
              height: "95%",
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
        </Col>
        <Col span={16}>
          <Card
            style={{
              flex: 1,
              height: "100%",
              padding: "12px",
              overflow: "auto",
              background: "#fafafa",
              borderRadius: "4px",
              border: "1px solid #f0f0f0",
            }}
          >
            {renderPreview()}
          </Card>
        </Col>
      </Row>
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
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
};
