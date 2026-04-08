import React, { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Space, Select, message } from 'antd'
import { EyeOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { TaskRun, tasksApi, scriptsApi, Script, TaskStatus } from '../api/client'
import LogViewer from '../components/LogViewer'

const TaskHistory: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRun[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskRun | null>(null)
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false)
  const [filterScriptId, setFilterScriptId] = useState<number | undefined>()
  const [filterStatus, setFilterStatus] = useState<TaskStatus | undefined>()

  const loadTasks = async () => {
    setLoading(true)
    try {
      const data = await tasksApi.list(filterScriptId, filterStatus)
      setTasks(data)
    } catch (error) {
      message.error('Failed to load task history')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadScripts = async () => {
    try {
      const data = await scriptsApi.list()
      setScripts(data)
    } catch (error) {
      console.error('Failed to load scripts', error)
    }
  }

  useEffect(() => {
    loadScripts()
  }, [])

  useEffect(() => {
    loadTasks()
  }, [filterScriptId, filterStatus])

  const handleViewDetails = (task: TaskRun) => {
    setSelectedTask(task)
    setIsDetailModalVisible(true)
  }

  const handleDelete = (task: TaskRun) => {
    Modal.confirm({
      title: 'Delete Task',
      content: 'Are you sure you want to delete this task run?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await tasksApi.delete(task.id!)
          message.success('Task deleted')
          loadTasks()
        } catch (error) {
          message.error('Failed to delete task')
        }
      },
    })
  }

  const getStatusTag = (status: TaskStatus) => {
    const colors: Record<TaskStatus, string> = {
      pending: 'default',
      running: 'processing',
      success: 'success',
      failed: 'error',
    }
    return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>
  }

  const getScriptName = (scriptId: number) => {
    return scripts.find(s => s.id === scriptId)?.name || `Script #${scriptId}`
  }

  const columns: ColumnsType<TaskRun> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Script',
      dataIndex: 'script_id',
      key: 'script_id',
      render: scriptId => getScriptName(scriptId),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: status => getStatusTag(status),
    },
    {
      title: 'Parameters',
      dataIndex: 'params',
      key: 'params',
      render: params => (
        <span style={{ fontSize: 12, color: '#666' }}>
          {Object.keys(params).length > 0
            ? Object.entries(params)
                .slice(0, 2)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ') + (Object.keys(params).length > 2 ? '...' : '')
            : 'No params'}
        </span>
      ),
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: startedAt => (startedAt ? new Date(startedAt).toLocaleString() : '-'),
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 120,
      render: durationMs => (durationMs ? `${(durationMs / 1000).toFixed(2)}s` : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            View
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Task History</h1>
        <Space>
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder="Filter by script"
            value={filterScriptId}
            onChange={setFilterScriptId}
            options={scripts.map(s => ({ label: s.name, value: s.id }))}
          />
          <Select
            allowClear
            style={{ width: 150 }}
            placeholder="Filter by status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Running', value: 'running' },
              { label: 'Success', value: 'success' },
              { label: 'Failed', value: 'failed' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadTasks}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={tasks}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      {/* Detail Modal */}
      <Modal
        title={`Task #${selectedTask?.id} Details`}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedTask && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>Script:</strong> {getScriptName(selectedTask.script_id)}
              <br />
              <strong>Status:</strong> {getStatusTag(selectedTask.status)}
              <br />
              <strong>Started:</strong>{' '}
              {selectedTask.started_at ? new Date(selectedTask.started_at).toLocaleString() : '-'}
              <br />
              <strong>Duration:</strong>{' '}
              {selectedTask.duration_ms ? `${(selectedTask.duration_ms / 1000).toFixed(2)}s` : '-'}
            </div>

            <div style={{ marginBottom: 16 }}>
              <strong>Parameters:</strong>
              <pre
                style={{
                  backgroundColor: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4,
                  marginTop: 8,
                }}
              >
                {JSON.stringify(selectedTask.params, null, 2)}
              </pre>
            </div>

            {(selectedTask.stdout || selectedTask.stderr) && (
              <LogViewer
                logs={[
                  ...(selectedTask.stdout ? selectedTask.stdout.split('\n') : []),
                  ...(selectedTask.stderr
                    ? selectedTask.stderr.split('\n').map(l => `STDERR: ${l}`)
                    : []),
                ]}
                status={selectedTask.status}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TaskHistory
