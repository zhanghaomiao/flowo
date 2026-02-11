// Shared types for file viewers
export interface FileViewerProps {
  src?: string; // File URL
  content?: string; // Direct content
  fileName?: string;
  fileFormat?: string;
  fullscreen?: boolean;
  showFileName?: boolean;
}

export interface FileViewerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  fileContent: string;
  fileFormat?: string;
}

export interface MultiFileViewerProps {
  visible: boolean;
  onClose: () => void;
  fileContent: { [path: string]: string };
  workflowId?: string;
  jobId?: number;
}

// File type categories
export type FileTypeCategory =
  | 'text'
  | 'image'
  | 'pdf'
  | 'html'
  | 'csv'
  | 'other';
