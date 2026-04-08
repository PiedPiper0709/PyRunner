import React from 'react'
import { Form, Input, InputNumber, Switch, Select } from 'antd'
import { ParamSchema } from '../api/client'

interface ParamFormProps {
  schema: ParamSchema[]
  initialValues?: Record<string, unknown>
  onValuesChange?: (values: Record<string, unknown>) => void
}

const ParamForm: React.FC<ParamFormProps> = ({ schema, initialValues, onValuesChange }) => {
  const [form] = Form.useForm()

  const handleValuesChange = (_: unknown, allValues: Record<string, unknown>) => {
    onValuesChange?.(allValues)
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
