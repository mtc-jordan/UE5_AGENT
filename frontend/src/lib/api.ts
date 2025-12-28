import axios from 'axios'
import { useAuthStore } from './store'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }),
  me: () => api.get('/auth/me'),
}

// Projects API
export const projectsApi = {
  list: () => api.get('/projects'),
  create: (data: { name: string; description?: string; ue_version?: string; project_path?: string }) =>
    api.post('/projects', data),
  get: (id: number) => api.get(`/projects/${id}`),
  getChats: (id: number) => api.get(`/projects/${id}/chats`),
  update: (id: number, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
}

// Chats API
export const chatsApi = {
  list: (params?: { projectId?: number; includeArchived?: boolean; search?: string }) =>
    api.get('/chats', { 
      params: {
        project_id: params?.projectId,
        include_archived: params?.includeArchived,
        search: params?.search
      }
    }),
  create: (data: any) => api.post('/chats', data),
  get: (id: number) => api.get(`/chats/${id}`),
  update: (id: number, data: any) => api.patch(`/chats/${id}`, data),
  delete: (id: number) => api.delete(`/chats/${id}`),
  // Chat management
  pin: (id: number) => api.post(`/chats/${id}/pin`),
  unpin: (id: number) => api.post(`/chats/${id}/unpin`),
  archive: (id: number) => api.post(`/chats/${id}/archive`),
  unarchive: (id: number) => api.post(`/chats/${id}/unarchive`),
  duplicate: (id: number) => api.post(`/chats/${id}/duplicate`),
  // Messages
  messages: (chatId: number) => api.get(`/chats/${chatId}/messages`),
  addMessage: (chatId: number, content: string, attachments?: any[]) =>
    api.post(`/chats/${chatId}/messages`, { content, attachments }),
  clearMessages: (chatId: number) => api.delete(`/chats/${chatId}/messages`),
}

// Agents API
export const agentsApi = {
  list: () => api.get('/agents'),
  defaults: () => api.get('/agents/defaults'),
  create: (data: any) => api.post('/agents', data),
  update: (id: number, data: any) => api.patch(`/agents/${id}`, data),
  delete: (id: number) => api.delete(`/agents/${id}`),
  resetDefaults: () => api.post('/agents/reset-defaults'),
}

// MCP API
export const mcpApi = {
  connections: () => api.get('/mcp/connections'),
  create: (data: { name: string; endpoint: string; project_id?: number }) =>
    api.post('/mcp/connections', data),
  connect: (id: number) => api.post(`/mcp/connections/${id}/connect`),
  disconnect: (id: number) => api.post(`/mcp/connections/${id}/disconnect`),
  delete: (id: number) => api.delete(`/mcp/connections/${id}`),
  tools: (id: number) => api.get(`/mcp/connections/${id}/tools`),
  callTool: (id: number, toolName: string, args: any) =>
    api.post(`/mcp/connections/${id}/call`, { tool_name: toolName, arguments: args }),
}

// AI API with improved streaming
export const aiApi = {
  models: () => api.get('/ai/models'),
  agents: () => api.get('/ai/agents'),
  chat: async function* (data: {
    message: string
    chat_id?: number
    mode: 'solo' | 'team' | 'roundtable'
    active_agents: string[]
    solo_agent: string
    model: string
    attachments?: any[]
  }) {
    const token = useAuthStore.getState().token
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonData = line.slice(6).trim()
                if (jsonData && jsonData !== '[DONE]') {
                  try {
                    yield JSON.parse(jsonData)
                  } catch (e) {
                    console.warn('Failed to parse final chunk:', jsonData)
                  }
                }
              }
            }
          }
          break
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete lines
        const lines = buffer.split('\n')
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue
          
          if (trimmedLine.startsWith('data: ')) {
            const jsonData = trimmedLine.slice(6).trim()
            
            if (jsonData === '[DONE]') {
              clearTimeout(timeoutId)
              return
            }
            
            if (jsonData) {
              try {
                const parsed = JSON.parse(jsonData)
                yield parsed
              } catch (e) {
                console.warn('Failed to parse SSE data:', jsonData, e)
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  },
}

// Preferences API
export const preferencesApi = {
  get: () => api.get('/preferences'),
  update: (data: {
    auto_generate_title?: boolean
    default_chat_mode?: 'solo' | 'team'
    default_model?: string
    default_solo_agent?: string
    default_active_agents?: string[]
    auto_pin_project_chats?: boolean
    title_format?: string
    sidebar_collapsed?: boolean
    show_archived_by_default?: boolean
  }) => api.patch('/preferences', data),
  generateTitle: (message: string, projectName?: string) =>
    api.post('/preferences/generate-title', { message, project_name: projectName }),
}

export { api }
export default api
