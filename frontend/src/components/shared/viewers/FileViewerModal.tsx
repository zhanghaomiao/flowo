import React from 'react';

import { Button, Modal } from 'antd';

import { CodeViewer } from './CodeViewer';
import type { FileViewerModalProps } from './types';

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  visible,
  onClose,
  title,
  fileContent,
  fileFormat = 'yaml',
}) => {
  return (
    <Modal
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
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
      styles={{ body: { height: '75vh', padding: '16px', top: 20 } }}
    >
      <CodeViewer content={fileContent} fileFormat={fileFormat} />
    </Modal>
  );
};
