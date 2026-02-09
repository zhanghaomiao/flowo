import {
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FolderOutlined,
  Html5Outlined,
  TableOutlined, // 增加 CSV 图标
} from '@ant-design/icons';
import React from 'react';
import type { AntdTreeNode, FileSizeThresholds, FileTypes } from './types';

// =================================================================
// Configuration
// =================================================================

// File size thresholds (in bytes)
export const FILE_SIZE_THRESHOLDS: FileSizeThresholds = {
  default: {
    PREVIEW_WARNING: 10 * 1024 * 1024, // 10MB
    PREVIEW_BLOCK: 50 * 1024 * 1024,   // 50MB
    DOWNLOAD_WARNING: 100 * 1024 * 1024, // 100MB
  },
  pdf: {
    PREVIEW_WARNING: 25 * 1024 * 1024,
    PREVIEW_BLOCK: 100 * 1024 * 1024,
    DOWNLOAD_WARNING: 200 * 1024 * 1024,
  },
  html: {
    PREVIEW_WARNING: 20 * 1024 * 1024,
    PREVIEW_BLOCK: 75 * 1024 * 1024,
    DOWNLOAD_WARNING: 150 * 1024 * 1024,
  },
  image: {
    PREVIEW_WARNING: 15 * 1024 * 1024,
    PREVIEW_BLOCK: 60 * 1024 * 1024,
    DOWNLOAD_WARNING: 120 * 1024 * 1024,
  },
};

// Supported file extensions
export const FILE_TYPES: FileTypes = {
  images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'],
  pdfs: ['pdf'],
  html: ['html', 'htm'],
  text: ['txt', 'log', 'md', 'rst', 'json', 'yaml', 'yml', 'xml', 'js', 'ts', 'css'],
  csv: ['csv', 'tsv'],
};

export const ALL_SUPPORTED_EXTENSIONS = [
  ...FILE_TYPES.images,
  ...FILE_TYPES.pdfs,
  ...FILE_TYPES.html,
  ...FILE_TYPES.text,
  ...FILE_TYPES.csv,
];
const FILE_SERVER_BASE_URL = '/files';

// =================================================================
// Helpers
// =================================================================

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const isSupportedFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ALL_SUPPORTED_EXTENSIONS.includes(ext);
};

export const getFileTypeCategory = (filename: string): string => {
  const ext = getFileExtension(filename);
  if (FILE_TYPES.images.includes(ext)) return 'image';
  if (FILE_TYPES.pdfs.includes(ext)) return 'pdf';
  if (FILE_TYPES.html.includes(ext)) return 'html';
  if (FILE_TYPES.text.includes(ext)) return 'text';
  if (FILE_TYPES.csv.includes(ext)) return 'csv';
  return 'unknown';
};

export const getFileIcon = (filename: string): React.ReactNode => {
  const category = getFileTypeCategory(filename);
  switch (category) {
    case 'image':
      return <FileImageOutlined />;
    case 'pdf':
      return <FilePdfOutlined />;
    case 'html':
      return <Html5Outlined />;
    case 'text':
      return <FileTextOutlined />;
    case 'csv':
      return <TableOutlined />;
    default:
      return <FileOutlined />;
  }
};

export const formatFileSize = (bytes: number | null): string => {
  if (bytes === null || bytes === undefined) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// =================================================================
// Threshold Logic
// =================================================================

export const getFileThresholds = (filename: string) => {
  const category = getFileTypeCategory(filename);
  switch (category) {
    case 'pdf': return FILE_SIZE_THRESHOLDS.pdf;
    case 'html': return FILE_SIZE_THRESHOLDS.html;
    case 'image': return FILE_SIZE_THRESHOLDS.image;
    default: return FILE_SIZE_THRESHOLDS.default;
  }
};

export const isFileTooLargeForPreview = (fileSize: number | null, filename: string): boolean => {
  if (fileSize === null) return false;
  const thresholds = getFileThresholds(filename);
  return fileSize > thresholds.PREVIEW_BLOCK;
};

export const shouldShowPreviewWarning = (fileSize: number | null, filename: string): boolean => {
  if (fileSize === null) return false;
  const thresholds = getFileThresholds(filename);
  return fileSize > thresholds.PREVIEW_WARNING;
};

export const shouldShowDownloadWarning = (fileSize: number | null, filename: string): boolean => {
  if (fileSize === null) return false;
  const thresholds = getFileThresholds(filename);
  return fileSize > thresholds.DOWNLOAD_WARNING;
};

// =================================================================
// Tree Data Transformers (Core Logic)
// =================================================================

// 递归更新树结构：找到目标 Key，插入 Children
export const updateTreeData = (
  list: AntdTreeNode[],
  key: React.Key,
  children: AntdTreeNode[]
): AntdTreeNode[] => {
  return list.map((node) => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeData(node.children, key, children),
      };
    }
    return node;
  });
};

export const transformApiNodeToTreeNode = (item: any): AntdTreeNode => {
  const isLeaf = item.isLeaf !== undefined ? item.isLeaf : !item.is_dir;

  let fileUrl: string | undefined = undefined;

  if (isLeaf) {
    fileUrl = `${FILE_SERVER_BASE_URL}${item.url}`;
  }

  return {
    title: item.title,
    key: item.key,
    isLeaf: isLeaf,
    icon: isLeaf ? getFileIcon(item.title) : <FolderOutlined />,
    children: isLeaf ? undefined : [],
    type: isLeaf ? 'file' : 'directory',
    fullPath: item.key,
    nodeData: item,
    fileExtension: getFileExtension(item.title),
    url: fileUrl,
  };
};