import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParamSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'output_path'
  default?: string | number | boolean
  required?: boolean
  description?: string
  enum_values?: string[]
}

export interface Script {
  id?: number
  name: string
  description?: string
  file_path: string
  tags: string[]
  params_schema: { params: ParamSchema[] }
  created_at?: string
  updated_at?: string
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed'

export interface TaskRun {
  id?: number
  script_id: number
  template_id?: number
  params: Record<string, unknown>
  status: TaskStatus
  stdout: string
  stderr: string
  started_at?: string
  finished_at?: string
  duration_ms?: number
}

export interface TaskTemplate {
  id?: number
  name: string
  script_id: number
  params: Record<string, unknown>
  created_at?: string
}

export interface EnvVar {
  id?: number
  key: string
  description?: string
  created_at?: string
  has_value?: boolean
}

export interface EnvVarCreate {
  key: string
  value: string
  description?: string
}

// ─── Scripts API ──────────────────────────────────────────────────────────────

export const scriptsApi = {
  list: (tag?: string) =>
    api.get<Script[]>('/scripts', { params: tag ? { tag } : undefined }).then(r => r.data),
  get: (id: number) => api.get<Script>(`/scripts/${id}`).then(r => r.data),
  create: (data: Script) => api.post<Script>('/scripts', data).then(r => r.data),
  update: (id: number, data: Script) => api.put<Script>(`/scripts/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/scripts/${id}`).then(r => r.data),
  upload: async (file: File): Promise<{ filename: string; file_path: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await axios.post('/api/scripts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

// ─── Tasks API ────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: (scriptId?: number, status?: TaskStatus) =>
    api.get<TaskRun[]>('/tasks', { params: { script_id: scriptId, status } }).then(r => r.data),
  get: (id: number) => api.get<TaskRun>(`/tasks/${id}`).then(r => r.data),
  run: (scriptId: number, params: Record<string, unknown>, templateId?: number) =>
    api.post<{ task_id: number; status: string }>('/tasks/run', {
      script_id: scriptId,
      params,
      template_id: templateId,
    }).then(r => r.data),
  delete: (id: number) => api.delete(`/tasks/${id}`).then(r => r.data),
  uploadFile: async (file: File): Promise<{ file_path: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await axios.post('/api/tasks/upload-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

// ─── Templates API ────────────────────────────────────────────────────────────

export const templatesApi = {
  list: (scriptId?: number) =>
    api.get<TaskTemplate[]>('/templates', { params: scriptId ? { script_id: scriptId } : undefined }).then(r => r.data),
  get: (id: number) => api.get<TaskTemplate>(`/templates/${id}`).then(r => r.data),
  create: (data: TaskTemplate) => api.post<TaskTemplate>('/templates', data).then(r => r.data),
  delete: (id: number) => api.delete(`/templates/${id}`).then(r => r.data),
}

// ─── Envs API ─────────────────────────────────────────────────────────────────

export const envsApi = {
  list: () => api.get<EnvVar[]>('/envs').then(r => r.data),
  reveal: (id: number) => api.get<{ key: string; value: string }>(`/envs/${id}/reveal`).then(r => r.data),
  create: (data: EnvVarCreate) => api.post<EnvVar>('/envs', data).then(r => r.data),
  update: (id: number, data: EnvVarCreate) => api.put<EnvVar>(`/envs/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/envs/${id}`).then(r => r.data),
}

export default api
