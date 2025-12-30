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
  { 
    id: 'opensource', 
    name: 'Open-Source', 
    icon: '🌐', 
    color: '#8B5CF6',
    description: 'Freely modifiable, deployable on your hardware',
    apiKeyName: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    freeAccessDetails: 'Direct Download: Weights are open-source (Apache/MIT license). Hosted via Hugging Face, Ollama, or Perplexity.',
    docsUrl: 'https://ollama.ai/docs'
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
    id: 'deepseek-v3.2-speciale',
    name: 'DeepSeek V3.2 Speciale',
    provider: 'deepseek',
    description: 'Enhanced version with specialized capabilities',
    costTier: '$',
    capabilities: { vision: false, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['complex_tasks', 'code', 'blueprint'],
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
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    provider: 'deepseek',
    description: 'Specialized for code generation and analysis',
    costTier: '$',
    capabilities: { vision: false, reasoning: true, fast: true, creative: false, code: true, longContext: true },
    recommended_for: ['code', 'blueprint', 'cpp_development', 'debugging'],
    contextWindow: '128K',
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
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    description: 'Latest frontier model with advanced reasoning',
    costTier: '$$$',
    capabilities: { vision: true, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['complex_tasks', 'creative_generation', 'architecture', 'reasoning'],
    contextWindow: '128K',
    isNew: true,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    description: 'Efficient version of GPT-5 for speed & cost',
    costTier: '$$',
    capabilities: { vision: true, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['general', 'code', 'fast_generation'],
    freeAccessInfo: 'Limited free credits in coding tools like Cursor',
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
  
  // ==================== Open-Source Models ====================
  {
    id: 'llama-3-405b',
    name: 'Llama 3 405B',
    provider: 'opensource',
    description: 'Meta\'s largest open-source model',
    costTier: 'free',
    capabilities: { vision: false, reasoning: true, fast: false, creative: true, code: true, longContext: true },
    recommended_for: ['complex_tasks', 'reasoning', 'code', 'architecture'],
    freeAccessInfo: 'Open-source (Apache license). Run locally or via Hugging Face.',
    contextWindow: '128K',
  },
  {
    id: 'llama-3-70b',
    name: 'Llama 3 70B',
    provider: 'opensource',
    description: 'Balanced size and capability',
    costTier: 'free',
    capabilities: { vision: false, reasoning: true, fast: true, creative: true, code: true, longContext: true },
    recommended_for: ['general', 'code', 'ue5_development'],
    freeAccessInfo: 'Open-source. Run locally with Ollama.',
    contextWindow: '128K',
  },
  {
    id: 'llama-3-8b',
    name: 'Llama 3 8B',
    provider: 'opensource',
    description: 'Lightweight, runs on consumer hardware',
    costTier: 'free',
    capabilities: { vision: false, reasoning: false, fast: true, creative: false, code: true, longContext: false },
    recommended_for: ['fast_generation', 'simple_tasks', 'local_development'],
    freeAccessInfo: 'Open-source. Runs on 8GB+ VRAM.',
    contextWindow: '8K',
  },
  {
    id: 'qwen3-coder-480b',
    name: 'Qwen3 Coder 480B',
    provider: 'opensource',
    description: 'Specialized for code generation',
    costTier: 'free',
    capabilities: { vision: false, reasoning: true, fast: false, creative: false, code: true, longContext: true },
    recommended_for: ['code', 'blueprint', 'cpp_development', 'debugging'],
    freeAccessInfo: 'Open-source. Available via Qwen Code tools.',
    contextWindow: '128K',
    isNew: true,
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    provider: 'opensource',
    description: 'Efficient small model for local use',
    costTier: 'free',
    capabilities: { vision: false, reasoning: false, fast: true, creative: false, code: true, longContext: false },
    recommended_for: ['fast_generation', 'local_development', 'simple_tasks'],
    freeAccessInfo: 'Open-source (Apache). Runs on consumer GPUs.',
    contextWindow: '32K',
  },
  {
    id: 'mistral-8x7b',
    name: 'Mistral 8x7B (Mixtral)',
    provider: 'opensource',
    description: 'Mixture of experts for better performance',
    costTier: 'free',
    capabilities: { vision: false, reasoning: true, fast: true, creative: true, code: true, longContext: false },
    recommended_for: ['general', 'code', 'ue5_development'],
    freeAccessInfo: 'Open-source. Available via Ollama or Perplexity.',
    contextWindow: '32K',
  },
  {
    id: 'mistral-devstral-24b',
    name: 'Mistral Devstral 24B',
    provider: 'opensource',
    description: 'Fine-tuned for development tasks',
    costTier: 'free',
    capabilities: { vision: false, reasoning: true, fast: true, creative: false, code: true, longContext: true },
    recommended_for: ['code', 'blueprint', 'debugging', 'cpp_development'],
    freeAccessInfo: 'Open-source. Specialized for coding.',
    contextWindow: '64K',
    isNew: true,
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
  code: ['deepseek-coder-v2', 'qwen3-coder-480b', 'claude-4-sonnet', 'gpt-4.1-mini'],
  cpp_development: ['deepseek-coder-v2', 'qwen3-coder-480b', 'mistral-devstral-24b'],
  blueprint: ['deepseek-reasoner', 'claude-4-sonnet', 'gemini-2.5-pro'],
  debugging: ['deepseek-coder-v2', 'qwen3-coder-480b', 'claude-4-sonnet'],
  
  // Creative tasks
  creative: ['claude-4-opus', 'gpt-5', 'gemini-3-pro'],
  creative_generation: ['claude-4-opus', 'gpt-5', 'gemini-3-pro'],
  material_design: ['claude-4-opus', 'gpt-4o', 'gemini-3-pro'],
  
  // Speed-focused
  fast: ['gemini-3-flash', 'gpt-4.1-nano', 'claude-4-haiku', 'mistral-7b'],
  fast_generation: ['gpt-4.1-nano', 'claude-4-haiku', 'deepseek-chat', 'llama-3-8b'],
  simple_tasks: ['gpt-4.1-nano', 'claude-4-haiku', 'mistral-7b'],
  
  // Reasoning tasks
  reasoning: ['deepseek-reasoner', 'gpt-5', 'claude-4-opus', 'gemini-2.5-pro'],
  complex_analysis: ['deepseek-reasoner', 'gpt-5', 'claude-4-opus'],
  architecture: ['deepseek-reasoner', 'gpt-5', 'claude-4-opus', 'llama-3-405b'],
  
  // UE5 specific
  ue5_development: ['deepseek-chat', 'claude-4-sonnet', 'gemini-2.5-flash', 'llama-3-70b'],
  scene_building: ['gemini-2.5-flash', 'claude-4-sonnet', 'deepseek-chat'],
  vision_tasks: ['gpt-4o', 'gemini-3-pro', 'claude-4-opus'],
  
  // Analysis
  prompt_analysis: ['gpt-4.1-mini', 'claude-4-sonnet', 'gemini-2.5-flash'],
  
  // Local/Privacy
  local_development: ['llama-3-70b', 'llama-3-8b', 'mistral-7b', 'mistral-8x7b'],
};

// UE5 Development Guide - Which model to use
export const UE5_MODEL_GUIDE = {
  daily_use: {
    title: 'Main Development & Daily Use',
    description: 'Start with DeepSeek-V3.2 - most generous free tier for a top-tier model, excellent for coding.',
    recommended: ['deepseek-chat', 'gemini-2.5-flash'],
  },
  specialized_coding: {
    title: 'Specialized Coding Tasks',
    description: 'For code-specific tasks, use Qwen3-Coder-480B or Mistral Devstral 24B.',
    recommended: ['qwen3-coder-480b', 'deepseek-coder-v2', 'mistral-devstral-24b'],
  },
  complex_reasoning: {
    title: 'Complex Reasoning on a Budget',
    description: 'Use daily free messages for Claude or limited GPT-5 credits for complex problems.',
    recommended: ['claude-4-sonnet', 'gpt-5-mini', 'deepseek-reasoner'],
  },
  full_control: {
    title: 'Full Control & Privacy',
    description: 'Download open-source models and run locally. Free with no limits but requires setup.',
    recommended: ['llama-3-70b', 'mistral-8x7b', 'llama-3-8b'],
  },
};
