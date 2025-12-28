/**
 * UE5 AI Studio - Plugin API Client
 * ==================================
 * 
 * Frontend API client for plugin management.
 * 
 * Version: 2.2.0
 */

import { api } from './api';

// =============================================================================
// TYPES
// =============================================================================

export type PluginCategory = 
  | 'utility'
  | 'code_generation'
  | 'asset_management'
  | 'level_design'
  | 'animation'
  | 'audio'
  | 'ui_ux'
  | 'debugging'
  | 'optimization'
  | 'integration'
  | 'custom';

export type PluginStatus = 'draft' | 'active' | 'disabled' | 'deprecated';
export type PluginVisibility = 'private' | 'public' | 'shared';

export interface Plugin {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  version: string;
  category: PluginCategory;
  tags: string[];
  status: PluginStatus;
  visibility: PluginVisibility;
  code: string;
  entry_function: string;
  config_schema: Record<string, any>;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  ai_description: string | null;
  requires_mcp: boolean;
  requires_workspace: boolean;
  timeout_seconds: number;
  execution_count: number;
  success_count: number;
  error_count: number;
  avg_execution_time_ms: number;
  rating: number;
  rating_count: number;
  author_id: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PluginListItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: PluginCategory;
  tags: string[];
  status: PluginStatus;
  visibility: PluginVisibility;
  execution_count: number;
  rating: number;
  rating_count: number;
  author_id: number;
  created_at: string;
}

export interface PluginCreateRequest {
  name: string;
  code: string;
  description?: string;
  category?: PluginCategory;
  tags?: string[];
  config_schema?: Record<string, any>;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  ai_description?: string;
  ai_examples?: Record<string, any>[];
  requires_mcp?: boolean;
  requires_workspace?: boolean;
  allowed_imports?: string[];
  timeout_seconds?: number;
}

export interface PluginUpdateRequest {
  name?: string;
  code?: string;
  description?: string;
  category?: PluginCategory;
  tags?: string[];
  config_schema?: Record<string, any>;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  ai_description?: string;
  ai_examples?: Record<string, any>[];
  requires_mcp?: boolean;
  requires_workspace?: boolean;
  allowed_imports?: string[];
  timeout_seconds?: number;
}

export interface PluginInstallation {
  id: number;
  plugin_id: number;
  user_id: number;
  config: Record<string, any>;
  is_enabled: boolean;
  installed_at: string;
  last_used_at: string | null;
}

export interface PluginExecution {
  id: number;
  plugin_id: number;
  input_data: Record<string, any>;
  output_data: any;
  error_message: string | null;
  success: boolean;
  execution_time_ms: number;
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
}

export interface ExecutionResult {
  success: boolean;
  output: any;
  error: string | null;
  execution_time_ms: number;
  stdout: string;
  stderr: string;
  logs: Array<{ level: string; message: string; timestamp: number }>;
}

export interface PluginTemplate {
  id: number;
  name: string;
  description: string | null;
  category: PluginCategory;
  code: string;
  difficulty: string;
  estimated_time_minutes: number;
}

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Plugin CRUD
 */
export const pluginsApi = {
  // Create a new plugin
  create: async (data: PluginCreateRequest): Promise<Plugin> => {
    const response = await api.post('/plugins', data);
    return response.data;
  },

  // List user's plugins
  list: async (params?: {
    category?: PluginCategory;
    status?: PluginStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<PluginListItem[]> => {
    const response = await api.get('/plugins', { params });
    return response.data;
  },

  // Get plugin by ID
  get: async (id: number): Promise<Plugin> => {
    const response = await api.get(`/plugins/${id}`);
    return response.data;
  },

  // Update plugin
  update: async (id: number, data: PluginUpdateRequest): Promise<Plugin> => {
    const response = await api.put(`/plugins/${id}`, data);
    return response.data;
  },

  // Delete plugin
  delete: async (id: number): Promise<void> => {
    await api.delete(`/plugins/${id}`);
  },

  // Validate code
  validate: async (code: string, allowedImports?: string[]): Promise<ValidationResult> => {
    const response = await api.post('/plugins/validate', null, {
      params: { code, allowed_imports: allowedImports }
    });
    return response.data;
  }
};

/**
 * Marketplace
 */
export const marketplaceApi = {
  // List public plugins
  list: async (params?: {
    category?: PluginCategory;
    search?: string;
    sort_by?: 'popular' | 'recent' | 'rating';
    limit?: number;
    offset?: number;
  }): Promise<PluginListItem[]> => {
    const response = await api.get('/plugins/marketplace', { params });
    return response.data;
  },

  // Publish plugin
  publish: async (id: number): Promise<Plugin> => {
    const response = await api.post(`/plugins/${id}/publish`);
    return response.data;
  },

  // Unpublish plugin
  unpublish: async (id: number): Promise<Plugin> => {
    const response = await api.post(`/plugins/${id}/unpublish`);
    return response.data;
  },

  // Rate plugin
  rate: async (id: number, rating: number): Promise<{ message: string; new_rating: number }> => {
    const response = await api.post(`/plugins/${id}/rate`, { rating });
    return response.data;
  }
};

/**
 * Installation
 */
export const installationApi = {
  // Install plugin
  install: async (pluginId: number, config?: Record<string, any>): Promise<PluginInstallation> => {
    const response = await api.post(`/plugins/${pluginId}/install`, { config });
    return response.data;
  },

  // Uninstall plugin
  uninstall: async (pluginId: number): Promise<void> => {
    await api.delete(`/plugins/${pluginId}/install`);
  },

  // List installed plugins
  list: async (enabledOnly?: boolean): Promise<PluginInstallation[]> => {
    const response = await api.get('/plugins/installed/list', {
      params: { enabled_only: enabledOnly }
    });
    return response.data;
  },

  // Toggle plugin enabled/disabled
  toggle: async (pluginId: number, enabled: boolean): Promise<void> => {
    await api.patch(`/plugins/${pluginId}/toggle`, null, {
      params: { enabled }
    });
  }
};

/**
 * Execution
 */
export const executionApi = {
  // Execute plugin
  execute: async (
    pluginId: number,
    inputData?: Record<string, any>,
    chatId?: number
  ): Promise<ExecutionResult> => {
    const response = await api.post(`/plugins/${pluginId}/execute`, {
      input_data: inputData,
      chat_id: chatId
    });
    return response.data;
  },

  // Get execution history
  history: async (
    pluginId: number,
    limit?: number,
    offset?: number
  ): Promise<PluginExecution[]> => {
    const response = await api.get(`/plugins/${pluginId}/executions`, {
      params: { limit, offset }
    });
    return response.data;
  }
};

/**
 * Templates
 */
export const templatesApi = {
  // List templates
  list: async (category?: PluginCategory): Promise<PluginTemplate[]> => {
    const response = await api.get('/plugins/templates/list', {
      params: { category }
    });
    return response.data;
  },

  // Create from template
  createFromTemplate: async (templateId: number, name: string): Promise<Plugin> => {
    const response = await api.post(`/plugins/templates/${templateId}/create`, null, {
      params: { name }
    });
    return response.data;
  }
};

/**
 * AI Integration
 */
export const pluginAiApi = {
  // Get available plugins for AI
  getAvailable: async (): Promise<{
    plugins: Array<{
      id: number;
      name: string;
      slug: string;
      description: string;
      input_schema: Record<string, any>;
      output_schema: Record<string, any>;
      examples: any[];
      requires_mcp: boolean;
      requires_workspace: boolean;
    }>;
    formatted: string;
  }> => {
    const response = await api.get('/plugins/ai/available');
    return response.data;
  },

  // Execute plugin via AI
  execute: async (
    pluginId: number,
    inputData: Record<string, any>,
    chatId?: number
  ): Promise<any> => {
    const response = await api.post(`/plugins/ai/execute/${pluginId}`, inputData, {
      params: { chat_id: chatId }
    });
    return response.data;
  }
};

// =============================================================================
// CATEGORY HELPERS
// =============================================================================

export const CATEGORY_LABELS: Record<PluginCategory, string> = {
  utility: 'Utility',
  code_generation: 'Code Generation',
  asset_management: 'Asset Management',
  level_design: 'Level Design',
  animation: 'Animation',
  audio: 'Audio',
  ui_ux: 'UI/UX',
  debugging: 'Debugging',
  optimization: 'Optimization',
  integration: 'Integration',
  custom: 'Custom'
};

export const CATEGORY_ICONS: Record<PluginCategory, string> = {
  utility: '🔧',
  code_generation: '💻',
  asset_management: '📦',
  level_design: '🗺️',
  animation: '🎬',
  audio: '🔊',
  ui_ux: '🎨',
  debugging: '🐛',
  optimization: '⚡',
  integration: '🔗',
  custom: '⚙️'
};

export const STATUS_COLORS: Record<PluginStatus, string> = {
  draft: 'gray',
  active: 'green',
  disabled: 'yellow',
  deprecated: 'red'
};

export const VISIBILITY_LABELS: Record<PluginVisibility, string> = {
  private: 'Private',
  public: 'Public',
  shared: 'Shared'
};
