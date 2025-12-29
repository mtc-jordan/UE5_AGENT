import React, { useState, useEffect, useRef } from 'react';
import { AI_MODELS, AI_PROVIDERS, MODEL_GROUPS, getModelById, DEFAULT_MODEL, type AIModel, type AIProvider } from '../config/models';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  autoSelect: boolean;
  onAutoSelectChange: (enabled: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

// Provider icons and colors
const providerStyles: Record<string, { icon: string; color: string; bgColor: string }> = {
  openai: { icon: '🤖', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  anthropic: { icon: '🧠', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  google: { icon: '🔮', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  deepseek: { icon: '🔍', color: 'text-purple-400', bgColor: 'bg-purple-500/20' }
};

// Cost tier badges
const costTierStyles: Record<string, { label: string; color: string }> = {
  '$': { label: '$', color: 'text-green-400' },
  '$$': { label: '$$', color: 'text-yellow-400' },
  '$$$': { label: '$$$', color: 'text-red-400' }
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  autoSelect,
  onAutoSelectChange,
  disabled = false,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Get current model info
  const currentModel = getModelById(selectedModel) || getModelById(DEFAULT_MODEL);
  const currentProvider = currentModel ? AI_PROVIDERS.find(p => p.id === currentModel.provider) : null;
  const currentProviderStyle = currentProvider ? providerStyles[currentProvider.id] : providerStyles.deepseek;

  // Filter models based on search and provider
  const filteredModels = AI_MODELS.filter(model => {
    const matchesSearch = searchQuery === '' || 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = !selectedProvider || model.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  // Group filtered models by provider
  const groupedModels = MODEL_GROUPS.map(group => ({
    ...group,
    models: filteredModels.filter(m => m.provider === group.id)
  })).filter(group => group.models.length > 0);

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Compact view for inline usage
  if (compact) {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            disabled 
              ? 'bg-gray-800/50 border-gray-700 cursor-not-allowed opacity-50'
              : 'bg-gray-800/50 border-gray-700 hover:border-purple-500/50 hover:bg-gray-800'
          }`}
        >
          {autoSelect ? (
            <>
              <span className="text-yellow-400">✨</span>
              <span className="text-xs text-gray-300">Auto</span>
            </>
          ) : (
            <>
              <span>{currentProviderStyle.icon}</span>
              <span className="text-xs text-gray-300 max-w-[100px] truncate">
                {currentModel?.name || 'Select Model'}
              </span>
            </>
          )}
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Auto-select toggle */}
            <div className="p-3 border-b border-gray-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${autoSelect ? 'bg-purple-500' : 'bg-gray-700'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoSelect ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-white">Auto-select</span>
                  <p className="text-xs text-gray-400">Let AI choose the best model</p>
                </div>
                <span className="text-yellow-400">✨</span>
              </label>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Provider filter */}
            <div className="flex gap-1 p-2 border-b border-gray-700 overflow-x-auto">
              <button
                onClick={() => setSelectedProvider(null)}
                className={`px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
                  !selectedProvider ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {AI_PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id === selectedProvider ? null : provider.id)}
                  className={`px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors flex items-center gap-1 ${
                    selectedProvider === provider.id 
                      ? `${providerStyles[provider.id].bgColor} ${providerStyles[provider.id].color}` 
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <span>{provider.icon}</span>
                  {provider.name}
                </button>
              ))}
            </div>

            {/* Model list */}
            <div className="max-h-64 overflow-y-auto">
              {groupedModels.map(group => (
                <div key={group.id}>
                  <div className={`px-3 py-1.5 text-xs font-medium ${providerStyles[group.id].color} ${providerStyles[group.id].bgColor}`}>
                    {group.icon} {group.name}
                  </div>
                  {group.models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      onMouseEnter={() => setShowDetails(model.id)}
                      onMouseLeave={() => setShowDetails(null)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors ${
                        selectedModel === model.id ? 'bg-purple-500/10 border-l-2 border-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white">{model.name}</span>
                            {model.capabilities.vision && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">👁️</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{model.description}</p>
                        </div>
                        <span className={`text-xs ${costTierStyles[model.costTier].color}`}>
                          {costTierStyles[model.costTier].label}
                        </span>
                      </div>
                      
                      {/* Details tooltip */}
                      {showDetails === model.id && (
                        <div className="mt-2 p-2 bg-gray-800 rounded-lg text-xs">
                          <div className="flex flex-wrap gap-1">
                            {model.capabilities.fast && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">Fast</span>}
                            {model.capabilities.reasoning && <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">Reasoning</span>}
                            {model.capabilities.creative && <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded">Creative</span>}
                            {model.capabilities.code && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Code</span>}
                          </div>
                        </div>
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

  // Full view for settings/dedicated pages
  return (
    <div ref={dropdownRef} className="space-y-4">
      {/* Auto-select toggle */}
      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
        <label className="flex items-center gap-4 cursor-pointer">
          <div className={`relative w-12 h-6 rounded-full transition-colors ${autoSelect ? 'bg-purple-500' : 'bg-gray-700'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${autoSelect ? 'translate-x-7' : 'translate-x-1'}`} />
          </div>
          <div className="flex-1">
            <span className="text-white font-medium">Auto-select Model</span>
            <p className="text-sm text-gray-400">Automatically choose the best model based on your task</p>
          </div>
          <span className="text-2xl">✨</span>
        </label>
      </div>

      {/* Model selection */}
      {!autoSelect && (
        <div className="space-y-3">
          {/* Search and filter */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <select
              value={selectedProvider || ''}
              onChange={(e) => setSelectedProvider(e.target.value || null)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">All Providers</option>
              {AI_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.icon} {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredModels.map(model => {
              const provider = AI_PROVIDERS.find(p => p.id === model.provider);
              const style = providerStyles[model.provider];
              const isSelected = selectedModel === model.id;

              return (
                <button
                  key={model.id}
                  onClick={() => onModelChange(model.id)}
                  disabled={disabled}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? 'bg-purple-500/10 border-purple-500 shadow-lg shadow-purple-500/20' 
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-lg ${style.bgColor} flex items-center justify-center text-lg`}>
                        {style.icon}
                      </span>
                      <div>
                        <h4 className="text-white font-medium">{model.name}</h4>
                        <p className="text-xs text-gray-500">{provider?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {model.capabilities.vision && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">👁️ Vision</span>
                      )}
                      <span className={`text-sm font-medium ${costTierStyles[model.costTier].color}`}>
                        {costTierStyles[model.costTier].label}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-3">{model.description}</p>
                  
                  <div className="flex flex-wrap gap-1">
                    {model.capabilities.fast && <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full">⚡ Fast</span>}
                    {model.capabilities.reasoning && <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full">🧠 Reasoning</span>}
                    {model.capabilities.creative && <span className="text-xs px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded-full">🎨 Creative</span>}
                    {model.capabilities.code && <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">💻 Code</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
