import React from 'react';

import type { TreeDataNode } from '../../api/api';

export interface ResultViewerProps {
  workflowId: string;
  initialMaxDepth?: number;
  selectedRule?: string;
}

export interface AntdTreeNode {
  title: string;
  key: string;
  icon: React.ReactNode;
  children?: AntdTreeNode[];
  isLeaf: boolean;
  fullPath: string;
  type: 'file' | 'directory';
  fileExtension: string;
  nodeData: TreeDataNode & { fileSize?: number | null };
  loadData?: () => Promise<void>;
}

export interface SelectedNodeData {
  title: string;
  key: string;
  icon: React.ReactNode;
  children?: AntdTreeNode[];
  isLeaf: boolean;
  fullPath: string;
  type: 'file' | 'directory';
  fileExtension: string;
  nodeData: TreeDataNode & { fileSize?: number | null };
}

export interface TreeSelectInfo {
  event: 'select';
  selected: boolean;
  node: SelectedNodeData;
  selectedNodes: SelectedNodeData[];
  nativeEvent: MouseEvent;
}

export interface FileSizeThresholds {
  default: {
    PREVIEW_WARNING: number;
    PREVIEW_BLOCK: number;
    DOWNLOAD_WARNING: number;
  };
  pdf: {
    PREVIEW_WARNING: number;
    PREVIEW_BLOCK: number;
    DOWNLOAD_WARNING: number;
  };
  html: {
    PREVIEW_WARNING: number;
    PREVIEW_BLOCK: number;
    DOWNLOAD_WARNING: number;
  };
  image: {
    PREVIEW_WARNING: number;
    PREVIEW_BLOCK: number;
    DOWNLOAD_WARNING: number;
  };
}

export interface FileTypes {
  images: string[];
  pdfs: string[];
  html: string[];
  text: string[];
  csv: string[];
}
