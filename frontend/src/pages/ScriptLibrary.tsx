import React, { useEffect, useState } from 'react'
import { Card, Button, List, Tag, Space, Modal, Form, Input, message, Empty, Upload } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { Script, scriptsApi } from '../api/client'
import { useNavigate } from 'react-router-dom'
import type { UploadFile } from 'antd'

const ScriptLibrary: React.FC = () => {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const loadScripts = async () => {
    setLoading(true)
    try {
      const data = await scriptsApi.list()
      setScripts(data)
    } catch (error) {
      message.error('Failed to load scripts')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScripts()
  }, [])

  const handleCreate = () => {
    form.resetFields()
    setSelectedScript(null)
    setUploadedFile(null)
    setIsModalVisible(true)
  }

  const handleEdit = (script: Script) => {
    setSelectedScript(script)
    setUploadedFile(null)
    form.setFieldsValue({
      ...script,
      tags: script.tags.join(', '),
      params_schema: JSON.stringify(script.params_schema, null, 2),
    })
    setIsModalVisible(true)
  }

  const handleDelete = async (script: Script) => {
    Modal.confirm({
      title: 'Delete Script',
      content: `Are you sure you want to delete "${script.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await scriptsApi.delete(script.id!)
          message.success('Script deleted')
          loadScripts()
        } catch (error) {
          message.error('Failed to delete script')
        }
      },
    })
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const scriptData: Script = {
        ...values,
        tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()) : [],
        params_schema: values.params_schema ? JSON.parse(values.params_schema) : { params: [] },
      }

      if (selectedScript?.id) {
        await scriptsApi.update(selectedScript.id, scriptData)
        message.success('Script updated')
      } else {
        await scriptsApi.create(scriptData)
        message.success('Script created')
      }

      setIsModalVisible(false)
      loadScripts()
    } catch (error) {
      message.error('Failed to save script')
      console.error(error)
    }
  }

  const handleRun = (script: Script) => {
    navigate('/runner', { state: { script } })
  }

  const handleUpload = async (file: File) => {
    try {
      const result = await scriptsApi.upload(file)
      message.success(`File uploaded: ${result.filename}`)
      form.setFieldsValue({ file_path: result.file_path })
      setUploadedFile({
        uid: '-1',
        name: result.filename,
        status: 'done',
      })
      return false
    } catch (error) {
      message.error('Failed to upload file')
      console.error(error)
      return false
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Script Library</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          New Script
        </Button>
      </div>

      <List
        loading={loading}
        grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
        dataSource={scripts}
        locale={{
          emptyText: (
            <Empty
              description="No scripts yet. Create your first script!"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
        renderItem={script => (
          <List.Item>
            <Card
              hoverable
              title={script.name}
              extra={
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleRun(script)}
                  >
                    Run
                  </Button>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(script)}
                  />
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(script)}
                  />
                </Space>
              }
            >
              <p style={{ minHeight: 40 }}>{script.description || 'No description'}</p>
              <div style={{ marginTop: 8 }}>
                {script.tags.map(tag => (
                  <Tag key={tag} color="blue">
                    {tag}
                  </Tag>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
                Path: {script.file_path}
              </div>
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title={selectedScript ? 'Edit Script' : 'New Script'}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Script Name"
            rules={[{ required: true, message: 'Please enter script name' }]}
          >
            <Input placeholder="my_script" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="What does this script do?" />
          </Form.Item>

          <Form.Item label="Upload Script File" tooltip="Upload a .py file (optional)">
            <Upload
              accept=".py"
              maxCount={1}
              fileList={uploadedFile ? [uploadedFile] : []}
              beforeUpload={(file) => {
                handleUpload(file)
                return false
              }}
              onRemove={() => {
                setUploadedFile(null)
                form.setFieldsValue({ file_path: '' })
              }}
            >
              <Button icon={<UploadOutlined />}>Click or drag .py file here</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="file_path"
            label="File Path"
            rules={[{ required: true, message: 'Please enter file path' }]}
            tooltip="Relative path from scripts/ directory"
          >
            <Input placeholder="my_script.py" />
          </Form.Item>

          <Form.Item name="tags" label="Tags" tooltip="Comma-separated tags">
            <Input placeholder="api, automation" />
          </Form.Item>

          <Form.Item
            name="params_schema"
            label="Parameters Schema (JSON)"
            tooltip='Example: {"params": [{"name": "url", "type": "string", "required": true}]}'
          >
            <Input.TextArea
              rows={6}
              placeholder='{"params": []}'
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ScriptLibrary
