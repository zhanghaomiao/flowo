// Main component
export { ResultViewer } from "./ResultViewer";

// File preview components
export {
  FilePreview,
  ImagePreview,
  TextPreview,
  JsonPreview,
  PdfPreview,
  HtmlPreview,
  FullscreenImagePreview,
  FullscreenTextPreview,
  FullscreenJsonPreview,
  FullscreenPdfPreview,
  FullscreenHtmlPreview,
  renderFullscreenPreview,
} from "./FilePreview";

// File tree utilities
export { convertToAntdTreeData, filterSupportedFiles } from "./FileTree";

// File utilities
export {
  FILE_SIZE_THRESHOLDS,
  FILE_TYPES,
  ALL_SUPPORTED_EXTENSIONS,
  getFileExtension,
  isSupportedFile,
  getFileTypeCategory,
  getFileIcon,
  formatFileSize,
  isFileTooLargeForPreview,
  shouldShowPreviewWarning,
} from "./FileUtils";

// Types
export type {
  ResultViewerProps,
  AntdTreeNode,
  SelectedNodeData,
  TreeSelectInfo,
  FileSizeThresholds,
  FileTypes,
} from "./types";
