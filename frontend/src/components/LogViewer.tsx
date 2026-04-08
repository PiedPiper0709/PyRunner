import React, { useEffect, useRef } from 'react'
import { Card, Progress } from 'antd'

interface LogViewerProps {
  logs: string[]
  status?: 'running' | 'success' | 'failed' | 'pending'
  progress?: number
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, status, progress }) => {
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return '#1890ff'
      case 'success':
        return '#52c41a'
      case 'failed':
        return '#ff4d4f'
      default:
        return '#d9d9d9'
    }
  }

  const getProgressStatus = () => {
    if (status === 'success') return 'success'
    if (status === 'failed') return 'exception'
    return 'active'
  }

  const displayProgress = progress !== undefined ? progress : (status === 'success' ? 100 : 0)

  return (
    <Card
      title="Execution Logs"
      extra={
        status && (
          <span style={{ color: getStatusColor(), fontWeight: 'bold' }}>
            {status.toUpperCase()}
          </span>
        )
      }
      style={{ marginTop: 16 }}
    >
      {/* Progress Bar */}
      {(status === 'running' || status === 'success' || status === 'failed') && (
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={displayProgress}
            status={getProgressStatus()}
            strokeColor={status === 'running' && progress === undefined ? undefined : getStatusColor()}
          />
        </div>
      )}

      <div
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: '12px',
          borderRadius: '4px',
          fontFamily: 'Monaco, Menlo, "Courier New", monospace',
          fontSize: '13px',
          height: '400px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#888' }}>Waiting for output...</div>
        ) : (
          logs.map((line, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '2px',
                color: line.startsWith('STDERR:') ? '#f48771' : '#d4d4d4',
              }}
            >
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </Card>
  )
}

export default LogViewer
