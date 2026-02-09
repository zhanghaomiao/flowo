import React from 'react';

import type { FileViewerProps } from './types';

export const IframeViewer: React.FC<FileViewerProps> = ({
  src,
  fileName
}) => (
  <div style={{ height: '100%', width: '100%' }}>
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      title={fileName || 'Document'}
    />
  </div>
);