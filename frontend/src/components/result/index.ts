// Main component
export { ResultViewer } from "./ResultViewer";

// File preview components
export {
  FilePreview,
  FullscreenHtmlPreview,
  FullscreenImagePreview,
  FullscreenJsonPreview,
  FullscreenPdfPreview,
  FullscreenTextPreview,
  HtmlPreview,
  ImagePreview,
  JsonPreview,
  PdfPreview,
  renderFullscreenPreview,
  TextPreview,
} from "./FilePreview";

// File tree utilities
export { convertToAntdTreeData, filterSupportedFiles } from "./FileTree";

// File utilities
export {
  ALL_SUPPORTED_EXTENSIONS,
  FILE_SIZE_THRESHOLDS,
  FILE_TYPES,
  formatFileSize,
  getFileExtension,
  getFileIcon,
  getFileTypeCategory,
  isFileTooLargeForPreview,
  isSupportedFile,
  shouldShowPreviewWarning,
} from "./FileUtils";

// Types
export type {
  AntdTreeNode,
  FileSizeThresholds,
  FileTypes,
  ResultViewerProps,
  SelectedNodeData,
  TreeSelectInfo,
} from "./types";
