import React from 'react';
import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';

import type { FileViewerProps } from './types';

export const MarkdownViewer: React.FC<FileViewerProps> = (props) => {
  const { content } = props;
  const fileContent = content || '';

  return (
    <div
      style={{
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
      }}
    >
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="markdown-body">
          <style>{`
            .markdown-body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
              font-size: 14px;
              line-height: 1.6;
              word-wrap: break-word;
              color: #24292f;
              padding: 16px 24px;
            }
            .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              font-weight: 600;
              line-height: 1.25;
            }
            .markdown-body h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
            .markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
            .markdown-body h3 { font-size: 1.25em; }
            .markdown-body p { margin-top: 0; margin-bottom: 1em; }
            .markdown-body a { color: #0969da; text-decoration: none; }
            .markdown-body a:hover { text-decoration: underline; }
            .markdown-body code {
              padding: 0.2em 0.4em;
              margin: 0;
              font-size: 85%;
              background-color: rgba(175, 184, 193, 0.2);
              border-radius: 6px;
              font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
            }
            .markdown-body pre {
              padding: 16px;
              overflow: auto;
              font-size: 85%;
              line-height: 1.45;
              background-color: #f6f8fa;
              border-radius: 6px;
              margin-bottom: 1em;
            }
            .markdown-body pre code {
              padding: 0;
              margin: 0;
              background-color: transparent;
              border: 0;
              font-size: 100%;
            }
            .markdown-body ul, .markdown-body ol {
              padding-left: 2em;
              margin-bottom: 1em;
            }
            .markdown-body blockquote {
              padding: 0 1em;
              color: #57606a;
              border-left: 0.25em solid #d0d7de;
              margin: 0 0 1em 0;
            }
            .markdown-body table {
              border-spacing: 0;
              border-collapse: collapse;
              margin-bottom: 1em;
              width: 100%;
            }
            .markdown-body table th, .markdown-body table td {
              padding: 6px 13px;
              border: 1px solid #d0d7de;
            }
            .markdown-body table tr {
              background-color: #fff;
              border-top: 1px solid #d0d7de;
            }
            .markdown-body table tr:nth-child(2n) {
              background-color: #f6f8fa;
            }
            .markdown-body img {
              max-width: 100%;
              box-sizing: content-box;
              background-color: #fff;
            }
          `}</style>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fileContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default MarkdownViewer;
