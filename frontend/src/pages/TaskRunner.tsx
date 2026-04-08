import React, { useEffect, useState } from 'react'
import {
  Card,
  Select,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  Divider,
} from 'antd'
import {
  PlayCircleOutlined,
  SaveOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import { Script, scriptsApi, tasksApi, templatesApi, TaskTemplate } from '../api/client'
import ParamForm from '../components/ParamForm'
import LogViewer from '../components/LogViewer'

const TaskRunner: React.FC = () => {
  const location = useLocation()
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [logs, setLogs] = useState<string[]>([])
  const [taskStatus, setTaskStatus] = useState<'pending' | 'running' | 'success' | 'failed'>('pending')
  const [isRunning, setIsRunning] = useState(false)
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false)
  const [saveForm] = Form.useForm()

  useEffect(() => {
    loadScripts()
    // If navigated from ScriptLibrary with a script
    if (location.state?.script) {
      setSelectedScript(location.state.script)
      loadTemplates(location.state.script.id)
    }
  }, [location])

  const loadScripts = async () => {
    try {
      const data = await scriptsApi.list()
      setScripts(data)
    } catch (error) {
      message.error('Failed to load scripts')
    }
  }

  const loadTemplates = async (scriptId: number) => {
    try {
      const data = await templatesApi.list(scriptId)
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates', error)
    }
  }

  const handleScriptChange = (scriptId: number) => {
    const script = scripts.find(s => s.id === scriptId)
    if (script) {
      setSelectedScript(script)
      setParams({})
      setLogs([])
      setTaskStatus('pending')
      loadTemplates(scriptId)
    }
  }

  const handleTemplateChange = (templateId: number) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setParams(template.params)
    }
  }

  const handleRun = async () => {
    if (!selectedScript) {
      message.warning('Please select a script')
      return
    }

    setIsRunning(true)
    setLogs([])
    setTaskStatus('running')

    try {
      // Create task (now starts running immediately on server)
      const { task_id } = await tasksApi.run(selectedScript.id!, params)

      // Try WebSocket first
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/tasks/ws/${task_id}/logs`
      let ws: WebSocket | null = null
      let wsConnected = false
      let pollInterval: NodeJS.Timeout | null = null

      const startPolling = () => {
        // Fallback: poll every 2 seconds
        pollInterval = setInterval(async () => {
          try {
            const task = await tasksApi.get(task_id)

            // Update logs
            const newLogs = task.stdout.split('\n').filter(line => line.trim() !== '')
            if (task.stderr) {
              newLogs.push(...task.stderr.split('\n').filter(line => line.trim() !== '').map(line => `STDERR: ${line}`))
            }
            setLogs(newLogs)

            // Check if complete
            if (task.status === 'success' || task.status === 'failed') {
              setTaskStatus(task.status)
              setIsRunning(false)
              message.success(`Task completed with status: ${task.status}`)
              if (pollInterval) clearInterval(pollInterval)
            }
          } catch (error) {
            console.error('Polling error:', error)
          }
        }, 2000)
      }

      try {
        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          wsConnected = true
        }

        ws.onmessage = event => {
          const data = JSON.parse(event.data)

          if (data.type === 'log') {
            setLogs(prev => [...prev, data.data])
          } else if (data.type === 'complete') {
            setTaskStatus(data.status)
            setIsRunning(false)
            message.success(`Task completed with status: ${data.status}`)
            if (ws) ws.close()
          } else if (data.error) {
            message.error(data.error)
            setTaskStatus('failed')
            setIsRunning(false)
            if (ws) ws.close()
          }
        }

        ws.onerror = () => {
          if (!wsConnected) {
            // WebSocket failed to connect, start polling
            console.log('WebSocket failed, falling back to polling')
            startPolling()
          } else {
            message.error('WebSocket connection error')
            setTaskStatus('failed')
            setIsRunning(false)
          }
        }

        ws.onclose = () => {
          setIsRunning(false)
          if (pollInterval) clearInterval(pollInterval)
        }

        // If WebSocket doesn't connect within 2 seconds, start polling
        setTimeout(() => {
          if (!wsConnected) {
            console.log('WebSocket timeout, falling back to polling')
            if (ws) ws.close()
            startPolling()
          }
        }, 2000)
      } catch (error) {
        // WebSocket creation failed, start polling immediately
        console.log('WebSocket creation failed, using polling')
        startPolling()
      }
    } catch (error) {
      message.error('Failed to start task')
      setTaskStatus('failed')
      setIsRunning(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!selectedScript) return

    try {
      const values = await saveForm.validateFields()
      await templatesApi.create({
        name: values.name,
        script_id: selectedScript.id!,
        params,
      })
      message.success('Template saved')
      setIsSaveModalVisible(false)
      loadTemplates(selectedScript.id!)
      saveForm.resetFields()
    } catch (error) {
      message.error('Failed to save template')
    }
  }

  const paramsSchema = selectedScript?.params_schema?.params || []

  return (
    <div style={{ padding: '24px' }}>
      <h1>Task Runner</h1>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Script Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              Select Script
            </label>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="Choose a script to run"
              value={selectedScript?.id}
              onChange={handleScriptChange}
              options={scripts.map(s => ({
                label: s.name,
                value: s.id!,
                description: s.description,
              }))}
              optionRender={option => (
                <div>
                  <div style={{ fontWeight: 'bold' }}>{option.data.label}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{option.data.description}</div>
                </div>
              )}
            />
          </div>

          {/* Template Selection */}
          {selectedScript && templates.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                Load Template (Optional)
              </label>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="Load saved parameters"
                onChange={handleTemplateChange}
                options={templates.map(t => ({ label: t.name, value: t.id! }))}
              />
            </div>
          )}

          {/* Parameters Form */}
          {selectedScript && paramsSchema.length > 0 && (
            <div>
              <Divider orientation="left">Parameters</Divider>
              <ParamForm
                schema={paramsSchema}
                initialValues={params}
                onValuesChange={setParams}
              />
            </div>
          )}

          {/* Action Buttons */}
          {selectedScript && (
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleRun}
                loading={isRunning}
                size="large"
              >
                Run Script
              </Button>
              <Button
                icon={<SaveOutlined />}
                onClick={() => setIsSaveModalVisible(true)}
                disabled={isRunning}
              >
                Save as Template
              </Button>
            </Space>
          )}
        </Space>
      </Card>

      {/* Logs Viewer */}
      {logs.length > 0 && <LogViewer logs={logs} status={taskStatus} />}

      {/* Save Template Modal */}
      <Modal
        title="Save as Template"
        open={isSaveModalVisible}
        onOk={handleSaveTemplate}
        onCancel={() => setIsSaveModalVisible(false)}
      >
        <Form form={saveForm} layout="vertical">
          <Form.Item
            name="name"
            label="Template Name"
            rules={[{ required: true, message: 'Please enter template name' }]}
          >
            <Input placeholder="My Template" prefix={<FileTextOutlined />} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TaskRunner
