import React, { useState, useEffect, useRef } from 'react'
import { Modal, Alert, Button, Space, Typography } from 'antd'
import { ReloadOutlined, ClearOutlined, DownloadOutlined } from '@ant-design/icons'
import { useLogSSE } from '../../hooks/useSSE'

const { Text } = Typography

interface LiveLogViewerProps {
  visible: boolean
  onClose: () => void
  workflowId: string
}

const LiveLogViewer: React.FC<LiveLogViewerProps> = ({
  visible,
  onClose,
  workflowId,
}) => {
  const [logLines, setLogLines] = useState<string[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const isAutoScrollingRef = useRef(false) // Flag to prevent scroll detection during auto-scroll
  const lastScrollTopRef = useRef(0) // Track last scroll position to detect direction

  const {
    status,
    error,
    isConnected,
    reconnect,
    disconnect,
    retryCount,
  } = useLogSSE(workflowId, {
    enabled: visible, // Only connect when modal is visible
    onLogLine: (logLine: string) => {
      setLogLines(prev => [...prev, logLine])
    }
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      isAutoScrollingRef.current = true // Set flag before auto-scrolling

      // Simple and reliable auto-scroll
      setTimeout(() => {
        if (logContainerRef.current && autoScroll) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight

          // Update last scroll position to current position
          lastScrollTopRef.current = logContainerRef.current.scrollTop
        }

        // Clear flag after a short delay
        setTimeout(() => {
          isAutoScrollingRef.current = false
        }, 50)
      }, 10)
    }
  }, [logLines, autoScroll])

  // Clear logs when modal opens
  useEffect(() => {
    if (visible) {
      setLogLines([])
    }
  }, [visible])

  const handleClose = () => {
    setLogLines([])
    disconnect()
    onClose()
  }

  const handleClearLogs = () => {
    setLogLines([])
  }

  const handleDownloadLogs = () => {
    const logContent = logLines.join('\n')
    const blob = new Blob([logContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow-${workflowId}-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleScrollChange = () => {
    // Ignore scroll events during auto-scrolling
    if (isAutoScrollingRef.current) {
      return
    }

    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current
      const lastScrollTop = lastScrollTopRef.current

      // Simple logic: detect scroll direction
      if (scrollTop < lastScrollTop) {
        // User scrolled UP - disable auto-scroll
        if (autoScroll) {
          console.log('🚫 User scrolled up - disabling auto-scroll')
          setAutoScroll(false)
        }
      } else if (scrollTop > lastScrollTop) {
        // User scrolled DOWN - check if near bottom
        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
        if (!autoScroll && distanceFromBottom < 50) {
          console.log('✅ User scrolled near bottom - re-enabling auto-scroll')
          setAutoScroll(true)
        }
      }

      // Update last scroll position
      lastScrollTopRef.current = scrollTop

      // Simple debug info
      console.log('Scroll:', {
        direction: scrollTop > lastScrollTop ? '↓' : scrollTop < lastScrollTop ? '↑' : '-',
        autoScroll,
        distanceFromBottom: Math.round(scrollHeight - (scrollTop + clientHeight))
      })
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Live Workflow Logs - {workflowId}</span>
            <span style={{
              fontSize: '12px',
              color: isConnected ? '#52c41a' : '#ff4d4f',
              fontWeight: 'normal'
            }}>
              {isConnected ? '🟢 Live' : '🔴 Disconnected'}
            </span>
            {retryCount > 0 && (
              <span style={{ fontSize: '12px', color: '#faad14' }}>
                (Retry {retryCount})
              </span>
            )}
          </div>
          <Space size="small" style={{ marginRight: '16px' }}>
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClearLogs}
              title="Clear logs"
            />
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownloadLogs}
              disabled={logLines.length === 0}
              title="Download logs"
            />
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={reconnect}
              title="Reconnect"
            />
          </Space>
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={1000}
      footer={null}
      destroyOnClose={true}
    >
      <div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
        {/* Status indicators */}
        {error && (
          <Alert
            message="SSE Connection Error"
            description={error}
            type="error"
            style={{ marginBottom: '16px' }}
            showIcon
            action={
              <Button size="small" onClick={reconnect}>
                Retry
              </Button>
            }
          />
        )}

        {status === 'connecting' && (
          <Alert
            message="Connecting to live logs..."
            type="info"
            style={{ marginBottom: '16px' }}
            showIcon
          />
        )}

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <div style={{
            position: 'absolute',
            bottom: '80px',
            right: '24px',
            zIndex: 1000,
            backgroundColor: '#1890ff',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
            onClick={() => {
              setAutoScroll(true)
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
              }
            }}
          >
            ↓ Scroll to bottom
          </div>
        )}

        {/* Log content */}
        <div
          ref={logContainerRef}
          onScroll={handleScrollChange}
          style={{
            flex: 1,
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: '16px',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", consolas, "source-code-pro", monospace',
            fontSize: '12px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            lineHeight: '1.4',
          }}
        >
          {logLines.length > 0 ? (
            logLines.map((line, index) => (
              <div key={index} style={{ marginBottom: '2px' }}>
                {line}
              </div>
            ))
          ) : (
            <Text type="secondary" style={{ color: '#888' }}>
              {isConnected ? 'Waiting for logs...' : 'Not connected to log stream'}
            </Text>
          )}
        </div>

        {/* Status bar */}
        <div style={{
          padding: '8px 0',
          borderTop: '1px solid #d9d9d9',
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            {logLines.length} lines | Status: {status}
          </span>
          <span>
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </Modal>
  )
}

export default LiveLogViewer 