import React, { useState, useEffect, useRef } from 'react';
import { AI_MODELS, AI_PROVIDERS, MODEL_GROUPS, getModelById, DEFAULT_MODEL } from '../config/models';
import { 
  ChevronDown, Search, Sparkles, Zap, Brain, Code, Eye, 
  Clock, Star, Check, Info, X
} from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  autoSelect: boolean;
  onAutoSelectChange: (enabled: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

// Provider icons, colors, and branding
const providerStyles: Record<string, { 
  icon: string; 
  color: string; 
  bgColor: string; 
  gradient: string;
  borderColor: string;
}> = {
  openai: { 
    icon: '🤖', 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/20',
    gradient: 'from-green-500 to-emerald-600',
    borderColor: 'border-green-500/30'
  },
  anthropic: { 
    icon: '🧠', 
    color: 'text-orange-400', 
    bgColor: 'bg-orange-500/20',
    gradient: 'from-orange-500 to-amber-600',
    borderColor: 'border-orange-500/30'
  },
  google: { 
    icon: '🔮', 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20',
    gradient: 'from-blue-500 to-cyan-600',
    borderColor: 'border-blue-500/30'
  },
  deepseek: { 
    icon: '🔍', 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20',
    gradient: 'from-purple-500 to-violet-600',
    borderColor: 'border-purple-500/30'
  }
};

// Cost tier badges with improved styling
const costTierStyles: Record<string, { label: string; color: string; bgColor: string }> = {
  'free': { label: 'FREE', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  '$': { label: '$', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  '$$': { label: '$$', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  '$$$': { label: '$$$', color: 'text-red-400', bgColor: 'bg-red-500/20' }
};

// Capability icons
const capabilityIcons: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  vision: { icon: <Eye className="w-3 h-3" />, label: 'Vision', color: 'text-blue-400 bg-blue-500/20' },
  reasoning: { icon: <Brain className="w-3 h-3" />, label: 'Reasoning', color: 'text-purple-400 bg-purple-500/20' },
  fast: { icon: <Zap className="w-3 h-3" />, label: 'Fast', color: 'text-yellow-400 bg-yellow-500/20' },
  code: { icon: <Code className="w-3 h-3" />, label: 'Code', color: 'text-green-400 bg-green-500/20' },
  creative: { icon: <Sparkles className="w-3 h-3" />, label: 'Creative', color: 'text-pink-400 bg-pink-500/20' },
  longContext: { icon: <Clock className="w-3 h-3" />, label: 'Long Context', color: 'text-cyan-400 bg-cyan-500/20' }
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
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Get current model info
  const currentModel = getModelById(selectedModel) || getModelById(DEFAULT_MODEL);
  const currentProvider = currentModel ? AI_PROVIDERS.find(p => p.id === currentModel.provider) : null;
  const currentProviderStyle = currentProvider ? providerStyles[currentProvider.id] : providerStyles.deepseek;

  // Filter models based on search and provider
  const filteredModels = AI_MODELS.filter(model => {
    const matchesSearch = searchQuery === '' || 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = !selectedProvider || model.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  // Group filtered models by provider
  const groupedModels = MODEL_GROUPS.map(group => ({
    ...group,
    models: filteredModels.filter(m => m.provider === group.id)
  })).filter(group => group.models.length > 0);

  // Count models per provider
  const modelCounts = AI_PROVIDERS.reduce((acc, provider) => {
    acc[provider.id] = AI_MODELS.filter(m => m.provider === provider.id).length;
    return acc;
  }, {} as Record<string, number>);

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
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
            disabled 
              ? 'bg-gray-800/50 border-gray-700 cursor-not-allowed opacity-50'
              : isOpen
                ? 'bg-gray-800 border-purple-500/50 shadow-lg shadow-purple-500/10'
                : 'bg-gray-800/50 border-gray-700 hover:border-purple-500/30 hover:bg-gray-800'
          }`}
        >
          {autoSelect ? (
            <>
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm text-gray-200 font-medium">Auto</span>
            </>
          ) : (
            <>
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${currentProviderStyle.gradient} flex items-center justify-center text-sm`}>
                {currentProviderStyle.icon}
              </div>
              <span className="text-sm text-gray-200 font-medium max-w-[120px] truncate">
                {currentModel?.name || 'Select Model'}
              </span>
            </>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fade-in">
            {/* Header with Auto-select */}
            <div className="p-4 border-b border-gray-700/50 bg-gradient-to-r from-purple-500/10 to-violet-500/10">
              <button 
                onClick={() => onAutoSelectChange(!autoSelect)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  autoSelect 
                    ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30' 
                    : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  autoSelect 
                    ? 'bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/30' 
                    : 'bg-gray-700'
                }`}>
                  <Sparkles className={`w-5 h-5 ${autoSelect ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${autoSelect ? 'text-yellow-400' : 'text-white'}`}>
                      Auto-Select Model
                    </span>
                    {autoSelect && <Check className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <p className="text-xs text-gray-400">AI chooses the best model for each task</p>
                </div>
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-gray-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Provider filter tabs */}
            <div className="flex gap-1 p-2 border-b border-gray-700/50 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setSelectedProvider(null)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  !selectedProvider 
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                    : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-800 hover:text-gray-300'
                }`}
              >
                All ({AI_MODELS.length})
              </button>
              {AI_PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id === selectedProvider ? null : provider.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedProvider === provider.id 
                      ? `${providerStyles[provider.id].bgColor} ${providerStyles[provider.id].color} border ${providerStyles[provider.id].borderColor}` 
                      : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-800 hover:text-gray-300'
                  }`}
                >
                  <span>{provider.icon}</span>
                  <span>{provider.name}</span>
                  <span className="opacity-60">({modelCounts[provider.id]})</span>
                </button>
              ))}
            </div>

            {/* Model list */}
            <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {groupedModels.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No models found</p>
                </div>
              ) : (
                groupedModels.map(group => (
                  <div key={group.id}>
                    {/* Provider header */}
                    <div className={`sticky top-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider ${providerStyles[group.id].color} ${providerStyles[group.id].bgColor} backdrop-blur-sm flex items-center gap-2`}>
                      <span>{group.icon}</span>
                      <span>{group.name}</span>
                      <span className="opacity-60">({group.models.length})</span>
                    </div>
                    
                    {/* Models */}
                    {group.models.map(model => {
                      const isSelected = selectedModel === model.id;
                      const isHovered = hoveredModel === model.id;
                      
                      return (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(model.id)}
                          onMouseEnter={() => setHoveredModel(model.id)}
                          onMouseLeave={() => setHoveredModel(null)}
                          className={`w-full px-4 py-3 text-left transition-all duration-150 ${
                            isSelected 
                              ? 'bg-purple-500/15 border-l-2 border-purple-500' 
                              : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                                  {model.name}
                                </span>
                                {model.isNew && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full">
                                    NEW
                                  </span>
                                )}
                                {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1">{model.description}</p>
                              
                              {/* Capabilities - show on hover or selection */}
                              {(isHovered || isSelected) && (
                                <div className="flex flex-wrap gap-1 mt-2 animate-fade-in">
                                  {Object.entries(model.capabilities).map(([key, value]) => {
                                    if (!value || !capabilityIcons[key]) return null;
                                    const cap = capabilityIcons[key];
                                    return (
                                      <span 
                                        key={key}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded ${cap.color}`}
                                      >
                                        {cap.icon}
                                        <span>{cap.label}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            
                            {/* Cost & Context */}
                            <div className="flex flex-col items-end gap-1">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${costTierStyles[model.costTier]?.bgColor} ${costTierStyles[model.costTier]?.color}`}>
                                {costTierStyles[model.costTier]?.label || model.costTier}
                              </span>
                              {model.contextWindow && (
                                <span className="text-[10px] text-gray-500">{model.contextWindow}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-700/50 bg-gray-800/30">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{filteredModels.length} models available</span>
                <a 
                  href="/settings" 
                  className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Info className="w-3 h-3" />
                  <span>Manage API Keys</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view for settings/dedicated pages
  return (
    <div ref={dropdownRef} className="space-y-6">
      {/* Auto-select card */}
      <div className={`p-5 rounded-2xl border transition-all duration-300 ${
        autoSelect 
          ? 'bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/30 shadow-lg shadow-yellow-500/10' 
          : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
      }`}>
        <button 
          onClick={() => onAutoSelectChange(!autoSelect)}
          className="w-full flex items-center gap-4"
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            autoSelect 
              ? 'bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/30' 
              : 'bg-gray-700'
          }`}>
            <Sparkles className={`w-7 h-7 ${autoSelect ? 'text-white' : 'text-gray-400'}`} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-semibold ${autoSelect ? 'text-yellow-400' : 'text-white'}`}>
                Auto-Select Model
              </span>
              {autoSelect && (
                <span className="px-2 py-0.5 text-xs font-bold bg-yellow-500/20 text-yellow-400 rounded-full">
                  ENABLED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Automatically choose the best model based on your task type, complexity, and requirements
            </p>
          </div>
          <div className={`w-12 h-7 rounded-full transition-all duration-300 ${
            autoSelect ? 'bg-yellow-500' : 'bg-gray-700'
          }`}>
            <div className={`w-5 h-5 mt-1 rounded-full bg-white shadow-lg transition-all duration-300 ${
              autoSelect ? 'ml-6' : 'ml-1'
            }`} />
          </div>
        </button>
      </div>

      {/* Model selection */}
      {!autoSelect && (
        <div className="space-y-4">
          {/* Search and filter */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search models by name, description, or capability..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
            <select
              value={selectedProvider || ''}
              onChange={(e) => setSelectedProvider(e.target.value || null)}
              className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="">All Providers</option>
              {AI_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.icon} {provider.name} ({modelCounts[provider.id]})
                </option>
              ))}
            </select>
          </div>

          {/* Provider quick filters */}
          <div className="flex gap-2 flex-wrap">
            {AI_PROVIDERS.map(provider => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id === selectedProvider ? null : provider.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                  selectedProvider === provider.id
                    ? `${providerStyles[provider.id].bgColor} ${providerStyles[provider.id].color} ${providerStyles[provider.id].borderColor}`
                    : 'bg-gray-800/30 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                <span className="text-lg">{provider.icon}</span>
                <span className="font-medium">{provider.name}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  selectedProvider === provider.id ? 'bg-white/20' : 'bg-gray-700'
                }`}>
                  {modelCounts[provider.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Model grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModels.map(model => {
              const style = providerStyles[model.provider];
              const isSelected = selectedModel === model.id;

              return (
                <button
                  key={model.id}
                  onClick={() => onModelChange(model.id)}
                  disabled={disabled}
                  className={`p-5 rounded-2xl border text-left transition-all duration-200 ${
                    isSelected 
                      ? `bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/50 shadow-xl shadow-purple-500/10` 
                      : 'bg-gray-800/30 border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-lg shadow-lg`}>
                        {style.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                            {model.name}
                          </h4>
                          {model.isNew && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{model.contextWindow} context</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{model.description}</p>
                  
                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {Object.entries(model.capabilities).map(([key, value]) => {
                      if (!value || !capabilityIcons[key]) return null;
                      const cap = capabilityIcons[key];
                      return (
                        <span 
                          key={key}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg ${cap.color}`}
                        >
                          {cap.icon}
                          <span>{cap.label}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${costTierStyles[model.costTier]?.bgColor} ${costTierStyles[model.costTier]?.color}`}>
                      {costTierStyles[model.costTier]?.label || model.costTier}
                    </span>
                    {model.freeAccessInfo && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Free tier
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredModels.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-400 mb-2">No models found</h4>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
