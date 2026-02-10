import { LoadingOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import React, { useMemo } from 'react';

export type ConnectionStatus = 'OFF' | 'CONNECTING' | 'ONLINE' | 'ERROR';

interface LiveUpdatesIndicatorProps {
  status: ConnectionStatus;
  retryCount?: number;
  onReconnect?: () => void;
}

const LiveUpdatesIndicator: React.FC<LiveUpdatesIndicatorProps> = ({
  status,
  retryCount = 0,
  onReconnect,
}) => {
  // 配置不同状态下的 颜色、提示文字、鼠标手势
  const config = useMemo(() => {
    switch (status) {
      case 'ONLINE':
        return {
          color: '#52c41a', // 绿色
          tooltip: 'Live Updates: Active',
          cursor: 'default',
          glow: true, // 是否发光
        };
      case 'CONNECTING':
        return {
          color: '#1890ff', // 蓝色
          tooltip: 'Connecting to server...',
          cursor: 'wait',
          glow: false,
        };
      case 'ERROR':
        return {
          color: '#ff4d4f', // 红色
          tooltip: `Connection Lost${retryCount > 0 ? ` (Retried ${retryCount} times)` : ''}. Click to retry.`,
          cursor: 'pointer', // 提示可点击
          glow: false,
        };
      case 'OFF':
      default:
        return {
          color: '#d9d9d9', // 灰色
          tooltip: 'Live Updates: Paused',
          cursor: 'default',
          glow: false,
        };
    }
  }, [status, retryCount]);

  return (
    <Tooltip title={config.tooltip} placement='bottom'>
      <div
        // 只有出错时，点击圆点才触发重连
        onClick={status === 'ERROR' ? onReconnect : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',  // 增加一点点击热区
          height: '24px',
          cursor: config.cursor,
        }}
      >
        {status === 'CONNECTING' ? (
          <LoadingOutlined style={{ color: config.color, fontSize: '14px' }} />
        ) : (
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: config.color,
              boxShadow: config.glow ? `0 0 8px ${config.color}` : 'none',
              transition: 'background-color 0.3s, box-shadow 0.3s',
            }}
          />
        )}
      </div>
    </Tooltip>
  );
};

export default LiveUpdatesIndicator;