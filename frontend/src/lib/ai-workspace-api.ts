/**
 * UE5 AI Studio - AI Workspace API Client
 * ========================================
 * 
 * Frontend API client for AI-powered workspace features.
 * 
 * Version: 1.0.0
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// =============================================================================
// TYPES
// =============================================================================

export interface ExplainCodeRequest {
  code: string;
  file_id?: number;
  model?: string;
  action?: 'explain' | 'document' | 'improve' | 'convert_ue5' | 'find_bugs';
}

export interface ExplainCodeResponse {
  action: string;
  model: string;
  explanation: string;
  code: string;
}

export interface CodeSuggestionRequest {
  file_id: number;
  cursor_position: { line: number; column: number };
  context_before: string;
  context_after: string;
  model?: string;
  num_suggestions?: number;
}

export interface CodeSuggestion {
  code: string;
  confidence: number;
  description: string;
}

export interface GenerateFileRequest {
  description: string;
  file_type: string;
  class_name?: string;
  parent_class?: string;
  model?: string;
  include_workspace_context?: boolean;
  save_to_workspace?: boolean;
  file_path?: string;
}

export interface GenerateFileResponse {
  file_type: string;
  class_name?: string;
  parent_class?: string;
  content: string;
  model: string;
  description: string;
  file_id?: number;
  saved: boolean;
}

export interface WriteFileRequest {
  file_id: number;
  content: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) return '';
  
  try {
    const parsed = JSON.parse(authStorage);
    return parsed.state?.token || '';
  } catch {
    return '';
  }
}

/**
 * Create axios instance with auth
 */
function createAxiosInstance() {
  const token = getAuthToken();
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

// =============================================================================
// AI CODE EXPLANATION
// =============================================================================

export async function explainCode(request: ExplainCodeRequest): Promise<ExplainCodeResponse> {
  const api = createAxiosInstance();
  const response = await api.post('/api/ai-workspace/explain', {
    code: request.code,
    file_id: request.file_id,
    model: request.model || 'deepseek-chat',
    action: request.action || 'explain'
  });
  return response.data;
}

// =============================================================================
// AI CODE SUGGESTIONS (Inline Assistant)
// =============================================================================

export async function getCodeSuggestions(request: CodeSuggestionRequest): Promise<CodeSuggestion[]> {
  const api = createAxiosInstance();
  const response = await api.post('/api/ai-workspace/suggest', {
    file_id: request.file_id,
    cursor_position: request.cursor_position,
    context_before: request.context_before,
    context_after: request.context_after,
    model: request.model || 'deepseek-chat',
    num_suggestions: request.num_suggestions || 3
  });
  return response.data.suggestions;
}

// =============================================================================
// AI FILE GENERATION
// =============================================================================

export async function generateFile(request: GenerateFileRequest): Promise<GenerateFileResponse> {
  const api = createAxiosInstance();
  const response = await api.post('/api/ai-workspace/generate-file', {
    description: request.description,
    file_type: request.file_type,
    class_name: request.class_name,
    parent_class: request.parent_class,
    model: request.model || 'deepseek-chat',
    include_workspace_context: request.include_workspace_context !== false,
    save_to_workspace: request.save_to_workspace || false,
    file_path: request.file_path
  });
  return response.data;
}

// =============================================================================
// FILE WRITE OPERATIONS
// =============================================================================

export async function writeFile(request: WriteFileRequest): Promise<void> {
  const api = createAxiosInstance();
  await api.post('/api/ai-workspace/write-file', request);
}

// =============================================================================
// WORKSPACE CONTEXT
// =============================================================================

export async function getWorkspaceContext(maxFiles = 50, maxSizePerFile = 10000): Promise<string> {
  const api = createAxiosInstance();
  const response = await api.get('/api/ai-workspace/context', {
    params: { max_files: maxFiles, max_size_per_file: maxSizePerFile }
  });
  return response.data.context;
}

export async function getFileContext(fileId: number): Promise<any> {
  const api = createAxiosInstance();
  const response = await api.get(`/api/ai-workspace/file-context/${fileId}`);
  return response.data;
}

export async function getRelatedFiles(fileId: number, limit = 10): Promise<any[]> {
  const api = createAxiosInstance();
  const response = await api.get(`/api/ai-workspace/related-files/${fileId}`, {
    params: { limit }
  });
  return response.data.related_files;
}

// =============================================================================
// AVAILABLE MODELS
// =============================================================================

export const AVAILABLE_MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek V3 (Fast & Smart)', icon: '🚀' },
  { value: 'deepseek-reasoner', label: 'DeepSeek R1 (Advanced Reasoning)', icon: '🧠' },
  { value: 'gpt-4', label: 'GPT-4 (OpenAI)', icon: '🤖' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet (Anthropic)', icon: '🎭' },
  { value: 'gemini-pro', label: 'Gemini Pro (Google)', icon: '✨' }
];

export const FILE_TYPES = [
  { value: 'cpp_class', label: 'C++ Class (.cpp + .h)', icon: '📘' },
  { value: 'header', label: 'C++ Header (.h)', icon: '📄' },
  { value: 'python', label: 'Python Script (.py)', icon: '🐍' },
  { value: 'blueprint', label: 'Blueprint Class', icon: '🔷' },
  { value: 'json', label: 'JSON Data (.json)', icon: '📋' },
  { value: 'xml', label: 'XML Config (.xml)', icon: '📝' }
];
