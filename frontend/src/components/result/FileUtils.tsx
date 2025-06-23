import {
  CodeOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  Html5Outlined,
} from "@ant-design/icons";
import React from "react";

import type { FileSizeThresholds, FileTypes } from "./types";

// File size thresholds (in bytes) - different limits for different file types
export const FILE_SIZE_THRESHOLDS: FileSizeThresholds = {
  default: {
    PREVIEW_WARNING: 10 * 1024 * 1024, // 10MB - show warning for preview
    PREVIEW_BLOCK: 50 * 1024 * 1024, // 50MB - block preview entirely
    DOWNLOAD_WARNING: 100 * 1024 * 1024, // 100MB - show warning for download
  },
  pdf: {
    PREVIEW_WARNING: 25 * 1024 * 1024, // 25MB - PDFs can be larger
    PREVIEW_BLOCK: 100 * 1024 * 1024, // 100MB - block preview entirely
    DOWNLOAD_WARNING: 200 * 1024 * 1024, // 200MB - show warning for download
  },
  html: {
    PREVIEW_WARNING: 20 * 1024 * 1024, // 20MB - HTML files can be larger
    PREVIEW_BLOCK: 75 * 1024 * 1024, // 75MB - block preview entirely
    DOWNLOAD_WARNING: 150 * 1024 * 1024, // 150MB - show warning for download
  },
  image: {
    PREVIEW_WARNING: 15 * 1024 * 1024, // 15MB - images can be moderately larger
    PREVIEW_BLOCK: 60 * 1024 * 1024, // 60MB - block preview entirely
    DOWNLOAD_WARNING: 120 * 1024 * 1024, // 120MB - show warning for download
  },
};

// File type configuration based on Caddyfile
export const FILE_TYPES: FileTypes = {
  images: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico"],
  pdfs: ["pdf"],
  html: ["html", "htm"],
  text: ["txt", "log", "md"],
  json: ["json"],
};

export const ALL_SUPPORTED_EXTENSIONS = [
  ...FILE_TYPES.images,
  ...FILE_TYPES.pdfs,
  ...FILE_TYPES.html,
  ...FILE_TYPES.text,
  ...FILE_TYPES.json,
];

// Get file extension from filename
export const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

// Check if file is supported
export const isSupportedFile = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ALL_SUPPORTED_EXTENSIONS.includes(ext);
};

// Get file type category
export const getFileTypeCategory = (filename: string): string => {
  const ext = getFileExtension(filename);
  if (FILE_TYPES.images.includes(ext)) return "image";
  if (FILE_TYPES.pdfs.includes(ext)) return "pdf";
  if (FILE_TYPES.html.includes(ext)) return "html";
  if (FILE_TYPES.text.includes(ext)) return "text";
  if (FILE_TYPES.json.includes(ext)) return "json";
  return "unknown";
};

// Get appropriate icon for file type
export const getFileIcon = (filename: string): React.ReactNode => {
  const category = getFileTypeCategory(filename);
  switch (category) {
    case "image":
      return <FileImageOutlined />;
    case "pdf":
      return <FilePdfOutlined />;
    case "html":
      return <Html5Outlined />;
    case "text":
      return <FileTextOutlined />;
    case "json":
      return <CodeOutlined />;
    default:
      return <FileOutlined />;
  }
};

// Format file size for display
export const formatFileSize = (bytes: number | null): string => {
  if (bytes === null || bytes === undefined) return "Unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Get file type specific thresholds
export const getFileThresholds = (filename: string) => {
  const category = getFileTypeCategory(filename);
  switch (category) {
    case "pdf":
      return FILE_SIZE_THRESHOLDS.pdf;
    case "html":
      return FILE_SIZE_THRESHOLDS.html;
    case "image":
      return FILE_SIZE_THRESHOLDS.image;
    default:
      return FILE_SIZE_THRESHOLDS.default;
  }
};

// Check if file is too large for preview
export const isFileTooLargeForPreview = (
  fileSize: number | null,
  filename: string,
): boolean => {
  if (fileSize === null) return false;
  const thresholds = getFileThresholds(filename);
  return fileSize > thresholds.PREVIEW_BLOCK;
};

// Check if file should show preview warning
export const shouldShowPreviewWarning = (
  fileSize: number | null,
  filename: string,
): boolean => {
  if (fileSize === null) return false;
  const thresholds = getFileThresholds(filename);
  return fileSize > thresholds.PREVIEW_WARNING;
};

// Check if file should show download warning
export const shouldShowDownloadWarning = (
  fileSize: number | null,
  filename: string,
): boolean => {
  if (fileSize === null) return false;
  const thresholds = getFileThresholds(filename);
  return fileSize > thresholds.DOWNLOAD_WARNING;
};
