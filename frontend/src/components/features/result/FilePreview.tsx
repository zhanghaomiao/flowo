import { client } from '@/client/client.gen';
import { useQuery } from '@tanstack/react-query';
import { Alert, Spin, Result } from 'antd';
import React, { useMemo } from 'react';

import {
  TextViewer,
  ImageViewer,
  TableViewer,
  IframeViewer,
} from '@/components/shared/viewers';
import {
  formatFileSize,
  getFileExtension,
  getFileTypeCategory,
  isFileTooLargeForPreview,
  shouldShowPreviewWarning,
} from './FileUtils';
import type { SelectedNodeData } from './types';


interface FilePreviewProps {
  nodeData: SelectedNodeData | null; // 允许为 null
  fullscreen?: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ nodeData, fullscreen = false }) => {
  if (!nodeData || nodeData.type !== 'file') {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#999'
      }}>
        Select a file to preview
      </div>
    );
  }

  const { fullPath, nodeData: data } = nodeData;
  const title = data.title || '';
  const fileSize = data.fileSize || 0;

  // 2. 构造 URL (使用 useMemo 防止不必要的重算)
  const fileUrl = useMemo(() => client.buildUrl({
    url: `/files/${fullPath}`,
  }), [fullPath]);

  const category = getFileTypeCategory(title as string);
  const extension = getFileExtension(title as string);

  // 3. 检查文件大小限制
  if (isFileTooLargeForPreview(fileSize, title as string)) {
    return (
      <Alert
        message="File Too Large"
        description={`This file (${formatFileSize(fileSize)}) is too large to preview. Please download it.`}
        type="warning"
        showIcon
      />
    );
  }

  // 4. 渲染具体的查看器
  const renderContent = () => {
    switch (category) {
      case 'image':
        return <ImageViewer src={fileUrl} fullscreen={fullscreen} />;
      case 'text':
        // For text files, we need to fetch content first
        return <TextFileViewer src={fileUrl} extension={extension} />;
      case 'pdf':
      case 'html':
        return <IframeViewer src={fileUrl} fileName={title as string} />;
      case 'csv':
        return <TableViewer src={fileUrl} fullscreen={fullscreen} />;
      default:
        return (
          <Result
            status="info"
            title="Preview Not Available"
            subTitle={`Preview for .${extension} files is not supported yet.`}
          />
        );
    }
  };

  // Text file viewer that fetches content
  const TextFileViewer: React.FC<{ src: string; extension: string }> = ({ src, extension }) => {
    const { data, isLoading, isError } = useQuery({
      queryKey: ['fileContent', src],
      queryFn: async () => {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Failed to load file');
        return response.text();
      },
      staleTime: 1000 * 60 * 10, // 缓存 10 分钟
      retry: 1
    });

    if (isLoading) {
      return <div style={{ textAlign: 'center', padding: 50 }}><Spin tip="Loading content..." /></div>;
    }

    if (isError) {
      return <Result status="error" title="Failed to load file content" />;
    }

    return (
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <TextViewer
          content={data || ''}
          fileFormat={extension}
        />
      </div>
    );
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: fullscreen ? 0 : '8px'
    }}>
      {shouldShowPreviewWarning(fileSize, title as string) && (
        <Alert
          message="Large File"
          description={`Loading ${formatFileSize(fileSize)} file...`}
          type="warning"
          banner
          closable
          style={{ marginBottom: 8 }}
        />
      )}

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {renderContent()}
      </div>
    </div>
  );
};