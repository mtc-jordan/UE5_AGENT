/**
 * Model Comparison API Client
 * 
 * Handles all comparison-related API calls.
 */

import { api } from './api'

// Types

export interface ModelInfo {
  id: string
  name: string
  provider: string
  color: string
  icon: string
  description: string
  available: boolean
}

export interface ComparisonResult {
  id: number
  session_id: number
  model_id: string
  provider: string
  response: string | null
  error: string | null
  status: 'pending' | 'streaming' | 'completed' | 'failed'
  response_time_ms: number | null
  total_time_ms: number | null
  token_count: number | null
  user_rating: number | null
  is_winner: boolean
  started_at: string | null
  completed_at: string | null
}

export interface ComparisonSession {
  id: number
  user_id: number
  title: string
  prompt: string
  system_prompt: string | null
  models: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  is_saved: boolean
  is_favorite: boolean
  tags: string[]
  created_at: string
  completed_at: string | null
  results: ComparisonResult[]
}

export interface CreateComparisonRequest {
  prompt: string
  models: string[]
  system_prompt?: string
  title?: string
}

export interface UpdateSessionRequest {
  title?: string
  is_saved?: boolean
  is_favorite?: boolean
  tags?: string[]
}

export interface RateResultRequest {
  rating: number
  is_winner?: boolean
}

export interface ComparisonStats {
  total_comparisons: number
  completed_comparisons: number
  model_wins: Record<string, number>
  model_avg_ratings: Record<string, number>
  favorite_model: string | null
}

export interface StreamEvent {
  type: 'start' | 'chunk' | 'complete' | 'error' | 'done'
  model?: string
  session_id?: number
  model_info?: ModelInfo
  content?: string
  response?: string
  metrics?: {
    response_time_ms: number | null
    total_time_ms: number | null
    token_count: number | null
  }
  error?: string
}

// API Functions

/**
 * Get available models for comparison
 */
export async function getAvailableModels(): Promise<{
  models: ModelInfo[]
  providers: Record<string, { name: string; models: ModelInfo[] }>
  total: number
}> {
  const response = await api.get('/comparison/models')
  return response.data
}

/**
 * Create a new comparison session
 */
export async function createComparison(
  request: CreateComparisonRequest
): Promise<ComparisonSession> {
  const response = await api.post('/comparison/create', request)
  return response.data
}

/**
 * Run a comparison session (non-streaming)
 */
export async function runComparison(sessionId: number): Promise<ComparisonSession> {
  const response = await api.post(`/comparison/run/${sessionId}`)
  return response.data
}

/**
 * Run a comparison session with streaming
 */
export function runComparisonStream(
  sessionId: number,
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void
): () => void {
  const token = localStorage.getItem('token')
  const eventSource = new EventSource(
    `/api/comparison/run/${sessionId}/stream`,
    {
      // Note: EventSource doesn't support custom headers
      // We'll need to use fetch with ReadableStream instead
    }
  )
  
  // Use fetch with streaming instead for auth support
  const controller = new AbortController()
  
  fetch(`/api/comparison/run/${sessionId}/stream`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream'
    },
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }
      
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          onComplete?.()
          break
        }
        
        buffer += decoder.decode(value, { stream: true })
        
        // Parse SSE events
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6)) as StreamEvent
              onEvent(event)
            } catch (e) {
              console.error('Failed to parse event:', line)
            }
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        onError?.(error)
      }
    })
  
  // Return cleanup function
  return () => controller.abort()
}

/**
 * Quick comparison - create and run in one step
 */
export async function quickComparison(
  request: CreateComparisonRequest
): Promise<ComparisonSession> {
  const response = await api.post('/comparison/quick', request)
  return response.data
}

/**
 * List comparison sessions
 */
export async function listSessions(options?: {
  limit?: number
  offset?: number
  saved_only?: boolean
  favorites_only?: boolean
}): Promise<{
  sessions: ComparisonSession[]
  total: number
  limit: number
  offset: number
}> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.offset) params.set('offset', options.offset.toString())
  if (options?.saved_only) params.set('saved_only', 'true')
  if (options?.favorites_only) params.set('favorites_only', 'true')
  
  const response = await api.get(`/comparison/sessions?${params}`)
  return response.data
}

/**
 * Get a specific comparison session
 */
export async function getSession(sessionId: number): Promise<ComparisonSession> {
  const response = await api.get(`/comparison/sessions/${sessionId}`)
  return response.data
}

/**
 * Update a comparison session
 */
export async function updateSession(
  sessionId: number,
  request: UpdateSessionRequest
): Promise<ComparisonSession> {
  const response = await api.patch(`/comparison/sessions/${sessionId}`, request)
  return response.data
}

/**
 * Delete a comparison session
 */
export async function deleteSession(sessionId: number): Promise<void> {
  await api.delete(`/comparison/sessions/${sessionId}`)
}

/**
 * Rate a comparison result
 */
export async function rateResult(
  resultId: number,
  request: RateResultRequest
): Promise<ComparisonResult> {
  const response = await api.post(`/comparison/results/${resultId}/rate`, request)
  return response.data
}

/**
 * Get comparison statistics
 */
export async function getComparisonStats(): Promise<ComparisonStats> {
  const response = await api.get('/comparison/stats')
  return response.data
}

// Helper functions

/**
 * Get provider color
 */
export function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    deepseek: '#0066FF',
    anthropic: '#FF6B35',
    google: '#34A853'
  }
  return colors[provider] || '#666666'
}

/**
 * Get provider name
 */
export function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic',
    google: 'Google'
  }
  return names[provider] || provider
}

/**
 * Format response time
 */
export function formatResponseTime(ms: number | null): string {
  if (ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format token count
 */
export function formatTokenCount(count: number | null): string {
  if (count === null) return '-'
  if (count < 1000) return count.toString()
  return `${(count / 1000).toFixed(1)}k`
}
