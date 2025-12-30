/**
 * Centralized AI Model Configuration
 * 
 * This file defines all available AI models used across the application.
 * Import this configuration in any component that needs model selection.
 * 
 * Updated: December 2025
 * Includes: DeepSeek, Google Gemini, OpenAI, Anthropic Claude, Open-Source models
 */

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  costTier: 'free' | '$' | '$$' | '$$$';
  capabilities: {
    vision: boolean;
    reasoning: boolean;
    fast: boolean;
    creative: boolean;
    code: boolean;
    longContext: boolean;
  };
  recommended_for: string[];
  freeAccessInfo?: string;
  contextWindow?: string;
  isNew?: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  apiKeyName: string;
  baseUrl: string;
  freeAccessDetails: string;
  docsUrl: string;
}

// AI Providers with comprehensive information
export const AI_PROVIDERS: AIProvider[] = [
  { 
    id: 'deepseek', 
    name: 'DeepSeek', 
    icon: '🔍', 
    color: '#4F46E5',
    description: 'Reasoning-first & coding-specialist models',
    apiKeyName: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    freeAccessDetails: 'Official App/Web Chat: Fully free for DeepSeek-V3.2 with unlimited use. DeepThink (R1) feature may have usage limits.',
    docsUrl: 'https://platform.deepseek.com/docs'
  },
  { 
    id: 'google', 
    name: 'Google Gemini', 
    icon: '🔮', 
    color: '#4285F4',
    description: 'Multimodal models; Pro for depth, Flash for speed',
    apiKeyName: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    freeAccessDetails: 'Google AI Studio: Free tier with daily request limits. Gemini CLI offers 100 daily requests for Gemini 2.5 Pro for free.',
    docsUrl: 'https://ai.google.dev/docs'
  },
  { 
    id: 'openai', 
    name: 'OpenAI', 
    icon: '🤖', 
    color: '#10B981',
    description: 'Frontier reasoning; mini for speed & cost-efficiency',
    apiKeyName: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    freeAccessDetails: 'Official Free Tier: Limited access to GPT-4o mini. Coding tools like Cursor offer limited GPT-5/GPT-4.1 credits.',
    docsUrl: 'https://platform.openai.com/docs'
  },
  { 
    id: 'anthropic', 
    name: 'Anthropic Claude', 
    icon: '🧠', 
    color: '#D97706',
    description: 'Strong reasoning, long-context analysis',
    apiKeyName: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    freeAccessDetails: 'Official Chat: ~30-50 free messages/day. Coding tools like Rovo, Kilo, Warp offer free credits for Sonnet/Opus.',
    docsUrl: 'https://docs.anthropic.com'
  },

];

// All Available AI Models - Updated December 2025
export const AI_MODELS: AIModel[] = [
  // ==================== DeepSeek Models ====================
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    description: 'Latest flagship model with excellent reasoning and coding',
    costTier: 'free',
    capabilities: { vision: false, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['general', 'code', 'fast_generation', 'ue5_development'],
    freeAccessInfo: 'Fully free with unlimited use in official chat',
    contextWindow: '128K',
    isNew: true,
  },

  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1-0528',
    provider: 'deepseek',
    description: 'Advanced reasoning with DeepThink technology',
    costTier: '$$',
    capabilities: { vision: false, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['reasoning', 'complex_analysis', 'blueprint', 'architecture'],
    freeAccessInfo: 'DeepThink feature may have usage limits',
    contextWindow: '128K',
    isNew: true,
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: 'deepseek',
    description: 'Specialized for code generation, completion, and analysis',
    costTier: '$',
    capabilities: { vision: false, reasoning: true, fast: true, creative: false, code: true, longContext: true },
    recommended_for: ['code', 'blueprint', 'cpp_development', 'debugging'],
    contextWindow: '128K',
    isNew: true,
  },

  // ==================== Google Gemini Models ====================
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    description: 'Latest flagship with advanced multimodal capabilities',
    costTier: '$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['creative_generation', 'complex_analysis', 'vision_tasks', 'material_design'],
    contextWindow: '1M',
    isNew: true,
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    description: 'Fast multimodal model for quick tasks',
    costTier: '$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['general', 'fast_generation', 'scene_building'],
    contextWindow: '1M',
    isNew: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Best reasoning capabilities with long context',
    costTier: '$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['creative_generation', 'complex_analysis', 'blueprint', 'architecture'],
    freeAccessInfo: '100 daily requests free via Gemini CLI',
    contextWindow: '1M',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Balanced speed and quality',
    costTier: '$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['general', 'prompt_analysis', 'scene_building', 'ue5_development'],
    freeAccessInfo: 'Free tier with daily limits in AI Studio',
    contextWindow: '1M',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Previous generation, still very capable',
    costTier: '$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: false },
    recommended_for: ['general', 'code', 'fast_generation'],
    contextWindow: '128K',
  },
  
  // ==================== OpenAI Models ====================
  {
    id: 'gpt-5.2-chat',
    name: 'GPT-5.2 Chat',
    provider: 'openai',
    description: 'Latest GPT-5.2 with chain-of-thought reasoning and tool use',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['complex_tasks', 'reasoning', 'architecture', 'ue5_development'],
    contextWindow: '128K',
    isNew: true,
  },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    provider: 'openai',
    description: 'GPT-5.2 Pro for complex multi-step tasks',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['complex_tasks', 'creative_generation', 'architecture', 'reasoning'],
    contextWindow: '128K',
    isNew: true,
  },
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex Max',
    provider: 'openai',
    description: 'Specialized for code generation with apply_patch and shell tools',
    costTier: '$$',
    capabilities: { vision: false, reasoning: true, fast: true, creative: false, code: true, longContext: true },
    recommended_for: ['code', 'blueprint', 'cpp_development', 'debugging'],
    contextWindow: '128K',
    isNew: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Multimodal capabilities with vision',
    costTier: '$$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['creative_generation', 'vision_tasks', 'material_design', 'scene_building'],
    contextWindow: '128K',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective multimodal',
    costTier: '$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: false },
    recommended_for: ['general', 'fast_generation', 'simple_tasks'],
    freeAccessInfo: 'Limited free access in official tier',
    contextWindow: '128K',
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Efficient and capable for most tasks',
    costTier: '$',
    capabilities: { vision: false, reasoning: true, fast: true, creative: true, code: true, longContext: false },
    recommended_for: ['general', 'prompt_analysis', 'code', 'ue5_development'],
    contextWindow: '128K',
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'Ultra-fast responses for simple tasks',
    costTier: '$',
    capabilities: { vision: false, reasoning: false, fast: true, creative: false, code: true, longContext: false },
    recommended_for: ['fast_generation', 'simple_tasks', 'quick_queries'],
    contextWindow: '32K',
  },
  
  // ==================== Anthropic Claude Models ====================
  {
    id: 'claude-4-sonnet',
    name: 'Claude 4 Sonnet 4.5',
    provider: 'anthropic',
    description: 'Latest balanced model with excellent reasoning',
    costTier: '$$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['general', 'code', 'creative', 'prompt_analysis', 'ue5_development'],
    freeAccessInfo: '~30-50 free messages/day in official chat',
    contextWindow: '200K',
    isNew: true,
  },
  {
    id: 'claude-4-opus',
    name: 'Claude 4 Opus',
    provider: 'anthropic',
    description: 'Highest quality output for complex tasks',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['creative_generation', 'complex_tasks', 'material_design', 'architecture'],
    freeAccessInfo: 'Free credits in tools like Rovo, Kilo, Warp',
    contextWindow: '200K',
    isNew: true,
  },
  {
    id: 'claude-4-haiku',
    name: 'Claude 4 Haiku 4.5',
    provider: 'anthropic',
    description: 'Fast and cost-effective for quick tasks',
    costTier: '$',
    capabilities: { vision: true, reasoning: false, fast: true, creative: false, code: true, longContext: false },
    recommended_for: ['fast_generation', 'simple_tasks', 'quick_queries'],
    contextWindow: '200K',
    isNew: true,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Previous gen, still excellent for most tasks',
    costTier: '$$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['general', 'code', 'creative', 'prompt_analysis'],
    contextWindow: '200K',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Previous flagship, excellent for complex tasks',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['creative_generation', 'complex_tasks', 'material_design'],
    contextWindow: '200K',
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

// Get free models
export function getFreeModels(): AIModel[] {
  return AI_MODELS.filter(m => m.costTier === 'free' || m.freeAccessInfo);
}

// Get new models
export function getNewModels(): AIModel[] {
  return AI_MODELS.filter(m => m.isNew);
}

// Default model
export const DEFAULT_MODEL = 'deepseek-chat';

// Task type to model recommendations - Updated for UE5 development
export const TASK_MODEL_RECOMMENDATIONS: Record<string, string[]> = {
  // General tasks
  general: ['deepseek-chat', 'claude-4-sonnet', 'gemini-2.5-flash', 'gpt-4o-mini'],
  
  // Coding tasks
  code: ['gpt-5.1-codex', 'deepseek-chat', 'claude-4-sonnet', 'gpt-4.1-mini'],
  cpp_development: ['gpt-5.1-codex', 'deepseek-chat', 'claude-4-sonnet', 'deepseek-reasoner'],
  blueprint: ['deepseek-reasoner', 'gpt-5.2-chat', 'claude-4-sonnet', 'gemini-2.5-pro'],
  debugging: ['gpt-5.1-codex', 'deepseek-chat', 'claude-4-sonnet', 'gemini-2.5-flash'],
  
  // Creative tasks
  creative: ['gpt-5.2-pro', 'claude-4-opus', 'gpt-4o', 'gemini-2.5-pro'],
  creative_generation: ['gpt-5.2-pro', 'claude-4-opus', 'gpt-4o', 'gemini-2.5-pro'],
  material_design: ['claude-4-opus', 'gpt-4o', 'gemini-2.5-pro'],
  
  // Speed-focused
  fast: ['gemini-2.5-flash', 'gpt-4.1-nano', 'claude-4-haiku'],
  fast_generation: ['gpt-4.1-nano', 'claude-4-haiku', 'deepseek-chat'],
  simple_tasks: ['gpt-4.1-nano', 'claude-4-haiku', 'gemini-2.5-flash'],
  
  // Reasoning tasks
  reasoning: ['gpt-5.2-chat', 'deepseek-reasoner', 'claude-4-opus', 'gemini-2.5-pro'],
  complex_analysis: ['gpt-5.2-pro', 'deepseek-reasoner', 'claude-4-opus', 'gemini-2.5-pro'],
  architecture: ['gpt-5.2-chat', 'deepseek-reasoner', 'claude-4-opus', 'gemini-2.5-pro'],
  
  // UE5 specific
  ue5_development: ['deepseek-chat', 'gpt-5.2-chat', 'claude-4-sonnet', 'gemini-2.5-flash'],
  scene_building: ['gemini-2.5-flash', 'claude-4-sonnet', 'deepseek-chat'],
  vision_tasks: ['gpt-4o', 'gemini-2.5-pro', 'claude-4-opus'],
  
  // Analysis
  prompt_analysis: ['gpt-4.1-mini', 'claude-4-sonnet', 'gemini-2.5-flash'],
};

// UE5 Development Guide - Which model to use
export const UE5_MODEL_GUIDE = {
  daily_use: {
    title: 'Main Development & Daily Use',
    description: 'Start with DeepSeek V3 - excellent for coding and general UE5 development.',
    recommended: ['deepseek-chat', 'gemini-2.5-flash'],
  },
  specialized_coding: {
    title: 'Specialized Coding Tasks',
    description: 'For complex code tasks, use DeepSeek Reasoner or Claude Sonnet.',
    recommended: ['deepseek-reasoner', 'claude-4-sonnet', 'gemini-2.5-pro'],
  },
  complex_reasoning: {
    title: 'Complex Reasoning',
    description: 'Use DeepSeek R1 for reasoning or Claude Opus for complex problems.',
    recommended: ['deepseek-reasoner', 'claude-4-opus', 'gemini-2.5-pro'],
  },
  fast_tasks: {
    title: 'Fast & Simple Tasks',
    description: 'Use fast models for quick queries and simple tasks.',
    recommended: ['claude-4-haiku', 'gemini-2.5-flash', 'gpt-4.1-nano'],
  },
};
