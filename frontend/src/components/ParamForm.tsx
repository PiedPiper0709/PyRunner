import React, { useState } from 'react'
import { Form, Input, InputNumber, Switch, Select, Upload, Button, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { ParamSchema, tasksApi } from '../api/client'
import type { UploadFile } from 'antd'

interface ParamFormProps {
  schema: ParamSchema[]
  initialValues?: Record<string, unknown>
  onValuesChange?: (values: Record<string, unknown>) => void
}

const ParamForm: React.FC<ParamFormProps> = ({ schema, initialValues, onValuesChange }) => {
  const [form] = Form.useForm()
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadFile>>({})

  const handleValuesChange = (_: unknown, allValues: Record<string, unknown>) => {
    onValuesChange?.(allValues)
  }

  const handleFileUpload = async (paramName: string, file: File) => {
    try {
      const result = await tasksApi.uploadFile(file)
      message.success(`File uploaded: ${file.name}`)
      form.setFieldsValue({ [paramName]: result.file_path })
      setUploadedFiles(prev => ({
        ...prev,
        [paramName]: {
          uid: '-1',
          name: file.name,
          status: 'done',
        }
      }))
      return false
    } catch (error) {
      message.error('Failed to upload file')
      console.error(error)
      return false
    }
  }

  const renderFormItem = (param: ParamSchema) => {
    const commonProps = {
      label: param.name,
      name: param.name,
      rules: [{ required: param.required, message: `${param.name} is required` }],
      tooltip: param.description,
      initialValue: initialValues?.[param.name] ?? param.default,
    }

    switch (param.type) {
      case 'boolean':
        return (
          <Form.Item {...commonProps} valuePropName="checked">
            <Switch />
          </Form.Item>
        )

      case 'number':
        return (
          <Form.Item {...commonProps}>
            <InputNumber style={{ width: '100%' }} placeholder={`Enter ${param.name}`} />
          </Form.Item>
        )

      case 'select':
        return (
          <Form.Item {...commonProps}>
            <Select
              placeholder={`Select ${param.name}`}
              options={param.enum_values?.map(v => ({ label: v, value: v }))}
            />
          </Form.Item>
        )

      case 'file':
        return (
          <Form.Item {...commonProps}>
            <Upload
              maxCount={1}
              fileList={uploadedFiles[param.name] ? [uploadedFiles[param.name]] : []}
              beforeUpload={(file) => {
                handleFileUpload(param.name, file)
                return false
              }}
              onRemove={() => {
                setUploadedFiles(prev => {
                  const newFiles = { ...prev }
                  delete newFiles[param.name]
                  return newFiles
                })
                form.setFieldsValue({ [param.name]: '' })
              }}
            >
              <Button icon={<UploadOutlined />}>Upload File</Button>
            </Upload>
            <Input type="hidden" />
          </Form.Item>
        )

      case 'output_path':
        return (
          <Form.Item {...commonProps} tooltip={param.description || 'Output file path (e.g., /path/to/output.xlsx)'}>
            <Input placeholder="/path/to/output.xlsx" />
          </Form.Item>
        )

      default: // 'string'
        return (
          <Form.Item {...commonProps}>
            <Input placeholder={`Enter ${param.name}`} />
          </Form.Item>
        )
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
      initialValues={initialValues}
    >
      {schema.map(param => (
        <div key={param.name}>{renderFormItem(param)}</div>
      ))}
    </Form>
  )
}

export default ParamForm
