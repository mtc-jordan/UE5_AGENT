import React, { useState, useEffect, useRef } from 'react';

// Types
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  context_window: number;
  strengths: string[];
  best_for: string[];
  cost_tier: string;
  supports_vision: boolean;
  supports_streaming: boolean;
}

interface Provider {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  autoSelect: boolean;
  onAutoSelectChange: (enabled: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

const API_BASE = '/api';

// Provider icons and colors
const providerStyles: Record<string, { icon: string; color: string; bgColor: string }> = {
  openai: { icon: '🤖', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  anthropic: { icon: '🧠', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  google: { icon: '🔮', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  deepseek: { icon: '🔍', color: 'text-purple-400', bgColor: 'bg-purple-500/20' }
};

// Cost tier badges
const costTierStyles: Record<string, { label: string; color: string }> = {
  low: { label: '$', color: 'text-green-400' },
  medium: { label: '$$', color: 'text-yellow-400' },
  high: { label: '$$$', color: 'text-red-400' }
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  autoSelect,
  onAutoSelectChange,
  disabled = false,
  compact = false
}) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load models and providers on mount
  useEffect(() => {
    loadModels();
    loadProviders();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadModels = async () => {
    try {
      const response = await fetch(`${API_BASE}/ue5-ai/models`);
      if (response.ok) {
        const data = await response.json();
        setModels(data.models);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch(`${API_BASE}/ue5-ai/models/providers`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
      }
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const getSelectedModelInfo = (): ModelInfo | undefined => {
    return models.find(m => m.id === selectedModel);
  };

  const filteredModels = models.filter(model => {
    const matchesProvider = !selectedProvider || model.provider === selectedProvider;
    const matchesSearch = !searchQuery || 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProvider && matchesSearch;
  });

  const groupedModels = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  const selectedModelInfo = getSelectedModelInfo();

  // Compact view for inline use
  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            disabled
              ? 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800/50 border-gray-700 text-white hover:border-purple-500'
          }`}
        >
          {autoSelect ? (
            <>
              <span className="text-purple-400">✨</span>
              <span className="text-sm">Auto</span>
            </>
          ) : selectedModelInfo ? (
            <>
              <span>{providerStyles[selectedModelInfo.provider]?.icon || '🤖'}</span>
              <span className="text-sm">{selectedModelInfo.name}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">Select Model</span>
          )}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Auto-select toggle */}
            <div className="p-2 border-b border-gray-700">
              <button
                onClick={() => {
                  onAutoSelectChange(!autoSelect);
                  if (!autoSelect) setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  autoSelect
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'hover:bg-gray-800 text-gray-400'
                }`}
              >
                <span>✨</span>
                <span>Auto-select best model</span>
                {autoSelect && <span className="ml-auto">✓</span>}
              </button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Provider filter */}
            <div className="p-2 border-b border-gray-700 flex gap-1 overflow-x-auto">
              <button
                onClick={() => setSelectedProvider(null)}
                className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                  !selectedProvider
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {providers.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`px-2 py-1 text-xs rounded whitespace-nowrap flex items-center gap-1 ${
                    selectedProvider === provider.id
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <span>{provider.icon}</span>
                  <span>{provider.name}</span>
                </button>
              ))}
            </div>

            {/* Model list */}
            <div className="max-h-64 overflow-y-auto">
              {Object.entries(groupedModels).map(([provider, providerModels]) => (
                <div key={provider}>
                  <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-800/50 sticky top-0">
                    {providerStyles[provider]?.icon} {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </div>
                  {providerModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        onModelChange(model.id);
                        onAutoSelectChange(false);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 transition-colors ${
                        selectedModel === model.id && !autoSelect ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <div className="flex-1 text-left">
                        <div className="text-sm text-white">{model.name}</div>
                        <div className="text-xs text-gray-500">{model.description}</div>
                      </div>
                      <span className={`text-xs ${costTierStyles[model.cost_tier]?.color || 'text-gray-400'}`}>
                        {costTierStyles[model.cost_tier]?.label || '$'}
                      </span>
                      {selectedModel === model.id && !autoSelect && (
                        <span className="text-purple-400">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view with details
  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-purple-500/20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 to-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🧠</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Model Selection</h3>
              <p className="text-xs text-gray-400">Choose the best model for your task</p>
            </div>
          </div>
          
          {/* Auto-select toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-400">Auto-select</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={autoSelect}
                onChange={(e) => onAutoSelectChange(e.target.checked)}
                className="sr-only"
                disabled={disabled}
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${
                autoSelect ? 'bg-purple-500' : 'bg-gray-700'
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  autoSelect ? 'translate-x-5' : 'translate-x-0.5'
                } mt-0.5`} />
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Provider tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedProvider(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              !selectedProvider
                ? 'bg-purple-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Providers
          </button>
          {providers.map(provider => (
            <button
              key={provider.id}
              onClick={() => setSelectedProvider(provider.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                selectedProvider === provider.id
                  ? `${providerStyles[provider.id]?.bgColor || 'bg-purple-500/20'} ${providerStyles[provider.id]?.color || 'text-purple-400'}`
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span>{provider.icon}</span>
              <span>{provider.name}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models by name or description..."
            className="w-full px-4 py-2 pl-10 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Model grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
          {filteredModels.map(model => (
            <div
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                onAutoSelectChange(false);
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedModel === model.id && !autoSelect
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${providerStyles[model.provider]?.color || 'text-gray-400'}`}>
                    {providerStyles[model.provider]?.icon || '🤖'}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-white">{model.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{model.provider}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${costTierStyles[model.cost_tier]?.color || 'text-gray-400'}`}>
                    {costTierStyles[model.cost_tier]?.label || '$'}
                  </span>
                  {model.supports_vision && (
                    <span className="text-xs" title="Supports vision">👁️</span>
                  )}
                  {selectedModel === model.id && !autoSelect && (
                    <span className="text-purple-400">✓</span>
                  )}
                </div>
              </div>
              
              <p className="text-xs text-gray-400 mt-2 line-clamp-2">{model.description}</p>
              
              {/* Strengths */}
              <div className="flex flex-wrap gap-1 mt-2">
                {model.strengths.slice(0, 2).map((strength, i) => (
                  <span key={i} className="px-1.5 py-0.5 text-[10px] bg-gray-700 text-gray-300 rounded">
                    {strength}
                  </span>
                ))}
              </div>
              
              {/* Show details button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(showDetails === model.id ? null : model.id);
                }}
                className="mt-2 text-xs text-purple-400 hover:text-purple-300"
              >
                {showDetails === model.id ? 'Hide details' : 'Show details'}
              </button>
              
              {/* Expanded details */}
              {showDetails === model.id && (
                <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Context Window:</span>
                    <span className="text-white">{(model.context_window / 1000).toFixed(0)}K tokens</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Best for:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {model.best_for.map((task, i) => (
                        <span key={i} className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                          {task.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">All strengths:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {model.strengths.map((strength, i) => (
                        <span key={i} className="px-1.5 py-0.5 text-[10px] bg-gray-700 text-gray-300 rounded">
                          {strength}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Selected model info */}
        {selectedModelInfo && !autoSelect && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">✓</span>
              <span className="text-sm text-white font-medium">Selected: {selectedModelInfo.name}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{selectedModelInfo.description}</p>
          </div>
        )}

        {autoSelect && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">✨</span>
              <span className="text-sm text-white font-medium">Auto-select enabled</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              The best model will be automatically selected based on your task type.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;
