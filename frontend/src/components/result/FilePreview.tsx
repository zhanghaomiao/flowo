import { Alert, Image, Spin, Typography } from "antd";
import React, { useState } from "react";

import { constructApiUrl } from "../../api/client";
import {
  formatFileSize,
  getFileExtension,
  getFileTypeCategory,
  isFileTooLargeForPreview,
  shouldShowPreviewWarning,
} from "./FileUtils";
import type { SelectedNodeData } from "./types";
import FileContent from "../code/FileContent";

const { Paragraph } = Typography;

// Image Preview Component
export const ImagePreview: React.FC<{ src: string; alt: string }> = ({
  src,
  alt,
}) => (
  <div
    style={{
      textAlign: "center",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <Image
      src={src}
      alt={alt}
      style={{ maxWidth: "60%", maxHeight: "60%" }}
      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Yk1RUG8A+1CC4iIOcnkcIaYAjhvQ=="
    />
  </div>
);

// Text Preview Component
export const TextPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading text file:", error);
        setContent("Error loading file content");
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return <FileContent fileContent={content} showFileName={false} />;
};

// JSON Preview Component
export const JsonPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.json())
      .then((json) => {
        setContent(json);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading JSON file:", error);
        setContent({ error: "Failed to load JSON content" });
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return (
    <div style={{ maxHeight: "400px", overflow: "auto" }}>
      <pre
        style={{
          fontSize: "12px",
          background: "#f5f5f5",
          padding: "8px",
          borderRadius: "4px",
        }}
      >
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
};

// PDF Preview Component
export const PdfPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "calc(100vh - 450px)" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "none" }}
      title="PDF Preview"
    />
  </div>
);

// HTML Preview Component
export const HtmlPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "calc(100vh - 350px)" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "1px solid #d9d9d9" }}
      title="HTML Preview"
    />
  </div>
);

// Enhanced components for fullscreen display
export const FullscreenImagePreview: React.FC<{ src: string; alt: string }> = ({
  src,
  alt,
}) => (
  <div style={{ textAlign: "center", height: "100%" }}>
    <Image
      src={src}
      alt={alt}
      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAE..."
    />
  </div>
);

export const FullscreenTextPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading text file:", error);
        setContent("Error loading file content");
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return <FileContent fileContent={content} showFileName={false} />;
};

export const FullscreenJsonPreview: React.FC<{ src: string }> = ({ src }) => {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  React.useEffect(() => {
    fetch(src)
      .then((response) => response.json())
      .then((json) => {
        setContent(json);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading JSON file:", error);
        setContent({ error: "Failed to load JSON content" });
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <pre
        style={{
          fontSize: "14px",
          background: "#f5f5f5",
          padding: "16px",
          borderRadius: "4px",
          fontFamily: "monospace",
        }}
      >
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
};

export const FullscreenPdfPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "100%" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "none" }}
      title="PDF Preview"
    />
  </div>
);

export const FullscreenHtmlPreview: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ height: "100%" }}>
    <iframe
      src={src}
      style={{ width: "100%", height: "100%", border: "1px solid #d9d9d9" }}
      title="HTML Preview"
    />
  </div>
);

// Main file preview component with size checks
export const FilePreview: React.FC<{ nodeData: SelectedNodeData }> = ({
  nodeData,
}) => {
  const { fullPath, type, nodeData: data } = nodeData;

  if (type !== "file") return null;

  const fileUrl = constructApiUrl(`/files/${fullPath}`);
  const category = getFileTypeCategory(data.title || "");
  const fileSize = data.fileSize || 0;

  // Check if file is too large for preview
  if (isFileTooLargeForPreview(fileSize, data.title || "")) {
    return (
      <Alert
        message="File Too Large for Preview"
        description={`This file (${formatFileSize(fileSize)}) is too large to preview safely. Please download it instead.`}
        type="warning"
        showIcon
      />
    );
  }

  // Show warning for large files
  if (shouldShowPreviewWarning(fileSize, data.title || "")) {
    return (
      <div>
        <Alert
          message="Large File Warning"
          description={`This file is ${formatFileSize(fileSize)}. Preview may take time to load.`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        {renderPreviewContent(category, fileUrl, data.title || "")}
      </div>
    );
  }

  return renderPreviewContent(category, fileUrl, data.title || "");
};

// Render preview content based on file type
const renderPreviewContent = (
  category: string,
  fileUrl: string,
  title: string,
) => {
  switch (category) {
    case "image":
      return <ImagePreview src={fileUrl} alt={title} />;
    case "text":
      return <TextPreview src={fileUrl} />;
    case "json":
      return <JsonPreview src={fileUrl} />;
    case "pdf":
      return <PdfPreview src={fileUrl} />;
    case "html":
      return <HtmlPreview src={fileUrl} />;
    default:
      return (
        <Alert
          message="Preview Not Available"
          description={`Preview for ${getFileExtension(title)} files is not supported yet.`}
          type="info"
          showIcon
        />
      );
  }
};

// Enhanced render function for fullscreen
export const renderFullscreenPreview = (nodeData: SelectedNodeData) => {
  const { fullPath, nodeData: data } = nodeData;
  const fileUrl = constructApiUrl(`/files/${fullPath}`);
  const category = getFileTypeCategory(data.title || "");
  const fileSize = data.fileSize || 0;

  // Check if file is too large for preview
  if (isFileTooLargeForPreview(fileSize, data.title || "")) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Alert
          message="File Too Large for Preview"
          description={`This file (${formatFileSize(fileSize)}) is too large to preview safely. Please download it instead.`}
          type="warning"
          showIcon
          style={{ maxWidth: "500px" }}
        />
      </div>
    );
  }

  // Show warning for large files
  if (shouldShowPreviewWarning(fileSize, data.title || "")) {
    return (
      <div>
        <Alert
          message="Large File Warning"
          description={`This file is ${formatFileSize(fileSize)}. Preview may take time to load.`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        {renderFullscreenContent(category, fileUrl, data.title || "")}
      </div>
    );
  }

  return renderFullscreenContent(category, fileUrl, data.title || "");
};

const renderFullscreenContent = (
  category: string,
  fileUrl: string,
  title: string,
) => {
  switch (category) {
    case "image":
      return <FullscreenImagePreview src={fileUrl} alt={title} />;
    case "text":
      return <FullscreenTextPreview src={fileUrl} />;
    case "json":
      return <FullscreenJsonPreview src={fileUrl} />;
    case "pdf":
      return <FullscreenPdfPreview src={fileUrl} />;
    case "html":
      return <FullscreenHtmlPreview src={fileUrl} />;
    default:
      return (
        <Alert
          message="Preview Not Available"
          description={`Fullscreen preview for ${getFileExtension(title)} files is not supported yet.`}
          type="info"
          showIcon
        />
      );
  }
};
