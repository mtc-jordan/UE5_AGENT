/**
 * Centralized AI Model Configuration
 * 
 * This file defines all available AI models used across the application.
 * Import this configuration in any component that needs model selection.
 */

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  costTier: '$' | '$$' | '$$$';
  capabilities: {
    vision: boolean;
    reasoning: boolean;
    fast: boolean;
    creative: boolean;
    code: boolean;
  };
  recommended_for: string[];
}

export interface AIProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// AI Providers
export const AI_PROVIDERS: AIProvider[] = [
  { id: 'deepseek', name: 'DeepSeek', icon: '🔍', color: '#4F46E5' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', color: '#D97706' },
  { id: 'google', name: 'Google', icon: '🔮', color: '#059669' },
  { id: 'openai', name: 'OpenAI', icon: '🤖', color: '#10B981' },
];

// All Available AI Models
export const AI_MODELS: AIModel[] = [
  // DeepSeek Models
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    description: 'Fast & efficient for general tasks',
    costTier: '$',
    capabilities: { vision: false, reasoning: true, fast: true, creative: true, code: true },
    recommended_for: ['general', 'code', 'fast_generation'],
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    description: 'Advanced reasoning capabilities',
    costTier: '$$',
    capabilities: { vision: false, reasoning: true, fast: false, creative: true, code: true },
    recommended_for: ['reasoning', 'complex_analysis', 'blueprint'],
  },
  
  // Anthropic Models
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Balanced performance and quality',
    costTier: '$$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true },
    recommended_for: ['general', 'code', 'creative', 'prompt_analysis'],
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Highest quality output',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true },
    recommended_for: ['creative_generation', 'complex_tasks', 'material_design'],
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fast and cost-effective',
    costTier: '$',
    capabilities: { vision: true, reasoning: false, fast: true, creative: false, code: true },
    recommended_for: ['fast_generation', 'simple_tasks'],
  },
  
  // Google Gemini Models
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Balanced speed and quality',
    costTier: '$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true },
    recommended_for: ['general', 'prompt_analysis', 'scene_building'],
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    description: 'Fastest response times',
    costTier: '$',
    capabilities: { vision: false, reasoning: false, fast: true, creative: false, code: false },
    recommended_for: ['fast_generation', 'simple_queries'],
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Best reasoning capabilities',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true },
    recommended_for: ['creative_generation', 'complex_analysis', 'blueprint'],
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Previous generation, still capable',
    costTier: '$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true },
    recommended_for: ['general', 'code'],
  },
  
  // OpenAI Models (if available)
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Efficient and capable',
    costTier: '$',
    capabilities: { vision: false, reasoning: true, fast: true, creative: true, code: true },
    recommended_for: ['general', 'prompt_analysis', 'code'],
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'Ultra-fast responses',
    costTier: '$',
    capabilities: { vision: false, reasoning: false, fast: true, creative: false, code: true },
    recommended_for: ['fast_generation', 'simple_tasks'],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Multimodal capabilities',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true },
    recommended_for: ['creative_generation', 'vision_tasks', 'material_design'],
  },
];

// Model groups by provider
export const MODEL_GROUPS = AI_PROVIDERS.map(provider => ({
  ...provider,
  models: AI_MODELS.filter(m => m.provider === provider.id),
}));

// Get model by ID
export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === id);
}

// Get provider by ID
export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}

// Get recommended models for a task
export function getRecommendedModels(taskType: string): AIModel[] {
  return AI_MODELS.filter(m => m.recommended_for.includes(taskType));
}

// Get models by capability
export function getModelsByCapability(capability: keyof AIModel['capabilities']): AIModel[] {
  return AI_MODELS.filter(m => m.capabilities[capability]);
}

// Default model
export const DEFAULT_MODEL = 'deepseek-chat';

// Task type to model recommendations
export const TASK_MODEL_RECOMMENDATIONS: Record<string, string[]> = {
  general: ['deepseek-chat', 'claude-3-5-sonnet', 'gemini-2.5-flash'],
  code: ['deepseek-chat', 'claude-3-5-sonnet', 'gpt-4.1-mini'],
  creative: ['claude-3-opus', 'gpt-4o', 'gemini-2.5-pro'],
  fast: ['gemini-2.5-flash-lite', 'gpt-4.1-nano', 'claude-3-haiku'],
  reasoning: ['deepseek-reasoner', 'gemini-2.5-pro', 'claude-3-opus'],
  prompt_analysis: ['gpt-4.1-mini', 'claude-3-5-sonnet', 'gemini-2.5-flash'],
  creative_generation: ['claude-3-opus', 'gpt-4o', 'gemini-2.5-pro'],
  fast_generation: ['gpt-4.1-nano', 'claude-3-haiku', 'deepseek-chat'],
  material_design: ['claude-3-opus', 'gpt-4o', 'gemini-2.5-pro'],
  blueprint: ['deepseek-reasoner', 'claude-3-5-sonnet', 'gemini-2.5-pro'],
  scene_building: ['gemini-2.5-flash', 'claude-3-5-sonnet', 'deepseek-chat'],
};
