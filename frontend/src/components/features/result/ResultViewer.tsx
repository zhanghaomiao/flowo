import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useListFilesQuery, listFilesOptions } from '@/client/@tanstack/react-query.gen';
import { client } from '@/client/client.gen';
import {
  DownloadOutlined,
  FullscreenOutlined,
  FileOutlined
} from '@ant-design/icons';
import {
  Tree,
  Splitter,
  Card,
  Button,
  Spin,
  Empty,
  Modal,
  message,
  Typography,
  Space
} from 'antd';

import { updateTreeData, transformApiNodeToTreeNode } from './FileUtils';
import { FilePreview } from './FilePreview';
import type { AntdTreeNode, ResultViewerProps } from './types';

const { Text } = Typography;

export const ResultViewer: React.FC<ResultViewerProps> = ({ workflowId }) => {
  const queryClient = useQueryClient();

  // State
  const [treeData, setTreeData] = useState<AntdTreeNode[]>([]);
  const [loadedKeys, setLoadedKeys] = useState<Set<React.Key>>(new Set());
  const [selectedNodeData, setSelectedNodeData] = useState<AntdTreeNode | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const { data: rootFiles, isLoading } = useListFilesQuery({
    query: { workflow_id: workflowId, path: '' }
  });


  useEffect(() => {
    if (rootFiles) {
      const rootNodes = rootFiles.map(transformApiNodeToTreeNode);
      setTreeData(rootNodes);
      setLoadedKeys(new Set());
      setSelectedNodeData(null);
    }
  }, [rootFiles]);

  const onLoadData = ({ key, children }: any) => {
    return new Promise<void>(async (resolve) => {
      if ((children && children.length > 0) || loadedKeys.has(key)) {
        resolve();
        return;
      }

      try {
        const data = await queryClient.fetchQuery(
          listFilesOptions({
            query: { workflow_id: workflowId, path: key as string }
          })
        );

        const childNodes = data.map(transformApiNodeToTreeNode);
        setTreeData((origin) => updateTreeData(origin, key, childNodes));
        setLoadedKeys((prev) => new Set(prev).add(key));

        resolve();
      } catch (err) {
        console.error(err);
        message.error("Failed to load directory");
        resolve();
      }
    });
  };

  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (info.node) {
      setSelectedNodeData(info.node);
    }
  };

  const handleDownload = () => {
    if (!selectedNodeData) return;
    const url = client.buildUrl({ url: `${selectedNodeData.url}?download=true` });
    window.open(url, '_blank');
  };

  // 4. 渲染内容
  const renderContent = () => {
    if (isLoading) {
      return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    }

    if (!treeData || treeData.length === 0) {
      return <Empty description="No files found" />;
    }

    return (
      <Splitter style={{ height: '100%' }}>
        {/* 左侧：文件树 */}
        <Splitter.Panel defaultSize="30%" min="20%">
          <Card style={{ height: '100%', overflow: 'auto' }} styles={{ body: { padding: 12 } }} bordered={false}>
            <Tree
              treeData={treeData}
              loadData={onLoadData}
              onSelect={handleSelect}
              showIcon
              blockNode
              height={500} // 虚拟滚动
            />
          </Card>
        </Splitter.Panel>

        <Splitter.Panel>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 右侧头部工具栏 */}
            <div style={{
              padding: '12px',
              borderBottom: '1px solid #f0f0f0',
              background: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Text strong style={{ fontSize: 16 }}>
                {selectedNodeData ? (
                  <Space><FileOutlined /> {selectedNodeData.title}</Space>
                ) : "File Preview"}
              </Text>

              <Space>
                <Button
                  icon={<DownloadOutlined />}
                  disabled={!selectedNodeData || !selectedNodeData.isLeaf}
                  onClick={handleDownload}
                >
                  Download
                </Button>
                <Button
                  icon={<FullscreenOutlined />}
                  disabled={!selectedNodeData || !selectedNodeData.isLeaf}
                  onClick={() => setIsFullscreenOpen(true)}
                >
                  Full Screen
                </Button>
              </Space>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', padding: 16, background: '#fafafa' }}>
              <Card style={{ height: '100%' }} styles={{ body: { height: '100%', padding: 0 } }}>
                <FilePreview nodeData={selectedNodeData} />
              </Card>
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {renderContent()}
      <Modal
        open={isFullscreenOpen}
        onCancel={() => setIsFullscreenOpen(false)}
        width="95vw"
        style={{ top: 20 }}
        footer={null}
        title={selectedNodeData?.title || "Preview"}
        destroyOnHidden
        styles={{ body: { height: '85vh', padding: 0 } }}
      >
        {selectedNodeData && (
          <FilePreview nodeData={selectedNodeData} fullscreen={true} />
        )}
      </Modal>
    </div>
  );
};