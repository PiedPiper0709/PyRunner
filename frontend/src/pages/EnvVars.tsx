import React, { useEffect, useState } from 'react'
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { EnvVar, EnvVarCreate, envsApi } from '../api/client'
import type { ColumnsType } from 'antd/es/table'

const EnvVars: React.FC = () => {
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEnvVar, setSelectedEnvVar] = useState<EnvVar | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()

  const loadEnvVars = async () => {
    setLoading(true)
    try {
      const data = await envsApi.list()
      setEnvVars(data)
    } catch (error) {
      message.error('Failed to load environment variables')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEnvVars()
  }, [])

  const handleCreate = () => {
    form.resetFields()
    setSelectedEnvVar(null)
    setIsModalVisible(true)
  }

  const handleEdit = (envVar: EnvVar) => {
    setSelectedEnvVar(envVar)
    form.setFieldsValue({
      key: envVar.key,
      value: '', // Value is empty for security, user can choose to update or leave blank
      description: envVar.description,
    })
    setIsModalVisible(true)
  }

  const handleDelete = async (envVar: EnvVar) => {
    try {
      await envsApi.delete(envVar.id!)
      message.success('Environment variable deleted')
      loadEnvVars()
    } catch (error) {
      message.error('Failed to delete environment variable')
      console.error(error)
    }
  }

  const handleReveal = async (envVar: EnvVar) => {
    try {
      const data = await envsApi.reveal(envVar.id!)
      Modal.info({
        title: 'Environment Variable Value',
        content: (
          <div>
            <p><strong>Key:</strong> {data.key}</p>
            <p><strong>Value:</strong></p>
            <Input.TextArea
              value={data.value}
              readOnly
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        ),
        width: 600,
      })
    } catch (error) {
      message.error('Failed to reveal value')
      console.error(error)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const envVarData: EnvVarCreate = {
        key: values.key,
        value: values.value,
        description: values.description,
      }

      if (selectedEnvVar?.id) {
        // When editing, if value is empty, don't update it
        if (!values.value) {
          delete envVarData.value
        }
        await envsApi.update(selectedEnvVar.id, envVarData)
        message.success('Environment variable updated')
      } else {
        await envsApi.create(envVarData)
        message.success('Environment variable created')
      }

      setIsModalVisible(false)
      loadEnvVars()
    } catch (error) {
      message.error('Failed to save environment variable')
      console.error(error)
    }
  }

  const columns: ColumnsType<EnvVar> = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (text) => <code style={{ fontSize: 13 }}>{text}</code>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || <span style={{ color: '#999' }}>No description</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleReveal(record)}
          >
            Reveal
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Environment Variable"
            description={`Are you sure you want to delete "${record.key}"?`}
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Environment Variables</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          New Env Var
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={envVars}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: 'No environment variables yet. Create your first one!',
        }}
      />

      <Modal
        title={selectedEnvVar ? 'Edit Environment Variable' : 'New Environment Variable'}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="key"
            label="Key"
            rules={[
              { required: true, message: 'Please enter the key' },
              { pattern: /^[A-Z_][A-Z0-9_]*$/, message: 'Key must be uppercase with underscores (e.g., API_KEY)' },
            ]}
            tooltip="Environment variable name (e.g., API_KEY, DATABASE_URL)"
          >
            <Input
              placeholder="API_KEY"
              disabled={!!selectedEnvVar}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="value"
            label="Value"
            rules={[
              { required: !selectedEnvVar, message: 'Please enter the value' },
            ]}
            tooltip={selectedEnvVar ? 'Leave empty to keep the current value' : 'The secret value to store'}
          >
            <Input.TextArea
              rows={3}
              placeholder={selectedEnvVar ? 'Leave empty to keep current value' : 'Enter the secret value'}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            tooltip="Optional description of what this variable is used for"
          >
            <Input.TextArea
              rows={2}
              placeholder="Description of what this environment variable is used for"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default EnvVars
