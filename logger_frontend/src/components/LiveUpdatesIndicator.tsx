import React from 'react'
import { Badge, Button, Space } from 'antd'
import { WifiOutlined } from '@ant-design/icons'

interface LiveUpdatesIndicatorProps {
  isConnected: boolean
  retryCount?: number
  onReconnect?: () => void
  showReconnectButton?: boolean
}

const LiveUpdatesIndicator: React.FC<LiveUpdatesIndicatorProps> = ({
  isConnected,
  retryCount = 0,
  onReconnect,
  showReconnectButton = true
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Badge
        status={isConnected ? 'success' : 'error'}
        text={
          <span style={{ fontSize: '12px', color: '#666' }}>
            <WifiOutlined style={{ marginRight: '4px' }} />
            {isConnected ? 'Live Updates' : `Disconnected${retryCount > 0 ? ` (${retryCount} retries)` : ''}`}
          </span>
        }
      />
      {!isConnected && showReconnectButton && onReconnect && (
        <Button
          type="link"
          size="small"
          onClick={onReconnect}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Reconnect SSE
        </Button>
      )}
    </div>
  )
}

export default LiveUpdatesIndicator 