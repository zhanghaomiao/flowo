import {
  CloseOutlined,
  FileOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Button, Col, Empty, Modal, Row, Tooltip } from 'antd';
import React, { useEffect, useState } from 'react';

import { TextViewer } from './TextViewer';
import type { MultiFileViewerProps } from './types';

// Get file format for viewer
const getFileFormat = (filePath: string | null): string => {
  if (!filePath) return 'yaml';

  const extension = filePath.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'log':
      return 'log';
    case 'py':
      return 'python';
    case 'md':
      return 'md';
    default:
      return 'yaml';
  }
};

// Get file name from path
const getFileName = (filePath: string): string => {
  return filePath.split('/').pop() || filePath;
};

export const MultiFileViewer: React.FC<MultiFileViewerProps> = ({
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

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
  };

  const selectedContent = selectedFile ? fileContent[selectedFile] : '';

  return (
    <Modal
      title={`Files Viewer${workflowId ? ` - Workflow ${workflowId}` : ''}${jobId ? ` - Job ${jobId}` : ''}`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          <CloseOutlined />
          Close
        </Button>,
      ]}
      width={1200}
      styles={{ body: { height: '70vh', padding: 0 } }}
    >
      {filePaths.length === 0 ? (
        <Empty description="No files to display" />
      ) : (
        <Row style={{ height: '100%' }}>
          {/* File List Sidebar */}
          <Col span={6} style={{ borderRight: '1px solid #d9d9d9', padding: '16px' }}>
            <div style={{ marginBottom: '16px' }}>
              <strong>Files ({filePaths.length})</strong>
            </div>
            <div style={{ maxHeight: 'calc(80vh - 100px)', overflowY: 'auto' }}>
              {filePaths.map((filePath) => (
                <div
                  key={filePath}
                  onClick={() => handleFileSelect(filePath)}
                  style={{
                    padding: '8px 12px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    backgroundColor: selectedFile === filePath ? '#e6f7ff' : 'transparent',
                    borderRadius: '4px',
                    border: selectedFile === filePath ? '1px solid #1890ff' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <FileTextOutlined />
                  <Tooltip title={filePath}>
                    <span style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {getFileName(filePath)}
                    </span>
                  </Tooltip>
                </div>
              ))}
            </div>
          </Col>

          {/* File Content */}
          <Col span={18} style={{ padding: '16px', height: '100%' }}>
            {selectedFile ? (
              <div style={{ height: '100%' }}>
                <div style={{
                  marginBottom: '16px',
                  padding: '8px 12px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px'
                }}>
                  <FileOutlined style={{ marginRight: '8px' }} />
                  <strong>{getFileName(selectedFile)}</strong>
                </div>
                <div style={{ height: 'calc(100% - 60px)' }}>
                  <TextViewer
                    content={selectedContent}
                    fileName={getFileName(selectedFile)}
                    fileFormat={getFileFormat(selectedFile)}
                    showFileName={false}
                  />
                </div>
              </div>
            ) : (
              <Empty description="Select a file to view" />
            )}
          </Col>
        </Row>
      )}
    </Modal>
  );
};