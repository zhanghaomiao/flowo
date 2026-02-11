import React from 'react';

import { Image } from 'antd';

import type { FileViewerProps } from './types';

export const ImageViewer: React.FC<FileViewerProps> = ({
  src,
  fileName,
  fullscreen = false,
}) => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#fafafa',
    }}
  >
    <Image
      src={src}
      alt={fileName || 'Image'}
      style={{
        maxWidth: '100%',
        maxHeight: fullscreen ? '85vh' : '400px', // 控制图片最大高度
        objectFit: 'contain',
      }}
    />
  </div>
);
