/**
 * Advanced AI Features Component for UE5 AI Agent
 * 
 * Features:
 * - Multi-step command chaining
 * - Context-aware suggestions
 * - Learning from user patterns
 * - Custom command macros
 * - AI-powered debugging
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Sparkles, Link2, Brain, Lightbulb, Bug, Play,
  Plus, ChevronDown,
  Clock, Zap, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, GitBranch,
  Code, Wand2, RotateCcw, FastForward,
  Circle, StopCircle, Maximize2, Minimize2, Search,
  Star, StarOff, Activity,
  ArrowRight
} from 'lucide-react';

// ==================== TYPES ====================

interface CommandStep {
  id: string;
  type: 'action' | 'condition' | 'loop' | 'delay' | 'variable';
  command: string;
  parameters: Record<string, any>;
  description?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  duration?: number;
}

interface CommandChain {
  id: string;
  name: string;
  description: string;
  steps: CommandStep[];
  createdAt: string;
  lastRun?: string;
  runCount: number;
  isFavorite: boolean;
  tags: string[];
}

interface Suggestion {
  id: string;
  command: string;
  description: string;
  confidence: number;
  context: string;
  category: string;
  usageCount: number;
}

interface Macro {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  commands: string[];
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  isFavorite: boolean;
}

interface DebugIssue {
  id: string;
  type: 'error' | 'warning' | 'performance' | 'suggestion';
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  autoFix?: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

interface UserPattern {
  pattern: string;
  frequency: number;
  lastUsed: string;
  context: string[];
}

// ==================== SAMPLE DATA ====================

const SAMPLE_CHAINS: CommandChain[] = [
  {
    id: '1',
    name: 'Scene Setup Workflow',
    description: 'Complete scene setup with lighting, props, and camera',
    steps: [
      { id: '1-1', type: 'action', command: 'Clear scene', parameters: {}, status: 'completed' },
      { id: '1-2', type: 'action', command: 'Spawn floor plane', parameters: { size: 1000 }, status: 'completed' },
      { id: '1-3', type: 'action', command: 'Add sky sphere', parameters: {}, status: 'completed' },
      { id: '1-4', type: 'action', command: 'Setup three-point lighting', parameters: {}, status: 'pending' },
      { id: '1-5', type: 'action', command: 'Place camera', parameters: { position: [0, -500, 200] }, status: 'pending' },
    ],
    createdAt: '2024-12-28T10:00:00Z',
    lastRun: '2024-12-29T08:30:00Z',
    runCount: 15,
    isFavorite: true,
    tags: ['setup', 'lighting', 'camera']
  },
  {
    id: '2',
    name: 'Character Import Pipeline',
    description: 'Import and setup character with animations',
    steps: [
      { id: '2-1', type: 'action', command: 'Import FBX model', parameters: { path: '/Content/Characters/' }, status: 'pending' },
      { id: '2-2', type: 'action', command: 'Apply skeleton', parameters: {}, status: 'pending' },
      { id: '2-3', type: 'action', command: 'Import animations', parameters: {}, status: 'pending' },
      { id: '2-4', type: 'action', command: 'Setup animation blueprint', parameters: {}, status: 'pending' },
      { id: '2-5', type: 'action', command: 'Create material instances', parameters: {}, status: 'pending' },
    ],
    createdAt: '2024-12-27T14:00:00Z',
    runCount: 8,
    isFavorite: false,
    tags: ['character', 'import', 'animation']
  },
  {
    id: '3',
    name: 'Performance Optimization',
    description: 'Analyze and optimize scene performance',
    steps: [
      { id: '3-1', type: 'action', command: 'Analyze scene', parameters: {}, status: 'pending' },
      { id: '3-2', type: 'condition', command: 'Check if FPS < 60', parameters: { threshold: 60 }, status: 'pending' },
      { id: '3-3', type: 'action', command: 'Generate LODs', parameters: {}, status: 'pending' },
      { id: '3-4', type: 'action', command: 'Optimize textures', parameters: {}, status: 'pending' },
      { id: '3-5', type: 'action', command: 'Merge static meshes', parameters: {}, status: 'pending' },
    ],
    createdAt: '2024-12-26T09:00:00Z',
    runCount: 23,
    isFavorite: true,
    tags: ['performance', 'optimization', 'LOD']
  },
];

const SAMPLE_SUGGESTIONS: Suggestion[] = [
  { id: '1', command: 'Add point light above selection', description: 'Based on your recent lighting work', confidence: 92, context: 'lighting', category: 'lighting', usageCount: 45 },
  { id: '2', command: 'Apply PBR material to mesh', description: 'You often apply materials after spawning', confidence: 87, context: 'material', category: 'material', usageCount: 38 },
  { id: '3', command: 'Duplicate and arrange in grid', description: 'Common pattern for prop placement', confidence: 85, context: 'scene', category: 'scene', usageCount: 32 },
  { id: '4', command: 'Save current level', description: 'You haven\'t saved in 15 minutes', confidence: 95, context: 'workflow', category: 'general', usageCount: 120 },
  { id: '5', command: 'Run performance analysis', description: 'Scene complexity increased significantly', confidence: 78, context: 'performance', category: 'performance', usageCount: 25 },
];

const SAMPLE_MACROS: Macro[] = [
  { id: '1', name: 'Quick Save & Screenshot', description: 'Save level and capture viewport', shortcut: 'Ctrl+Shift+S', commands: ['Save level', 'Take screenshot'], createdAt: '2024-12-25T10:00:00Z', lastUsed: '2024-12-29T09:00:00Z', usageCount: 67, isFavorite: true },
  { id: '2', name: 'Reset Transform', description: 'Reset position, rotation, and scale', shortcut: 'Ctrl+R', commands: ['Set position to 0,0,0', 'Set rotation to 0,0,0', 'Set scale to 1,1,1'], createdAt: '2024-12-24T14:00:00Z', usageCount: 45, isFavorite: true },
  { id: '3', name: 'Spawn Light Rig', description: 'Create standard 3-point lighting', commands: ['Spawn key light', 'Spawn fill light', 'Spawn back light', 'Adjust intensities'], createdAt: '2024-12-23T11:00:00Z', usageCount: 23, isFavorite: false },
  { id: '4', name: 'Material Preview Setup', description: 'Setup scene for material preview', commands: ['Spawn preview sphere', 'Add neutral lighting', 'Position camera'], createdAt: '2024-12-22T16:00:00Z', usageCount: 18, isFavorite: false },
];

const SAMPLE_DEBUG_ISSUES: DebugIssue[] = [
  { id: '1', type: 'performance', title: 'High Draw Call Count', description: 'Scene has 3,500+ draw calls which may impact performance', location: 'Level: MainLevel', suggestion: 'Consider merging static meshes or using instancing', autoFix: true, severity: 'high', timestamp: '2024-12-29T10:30:00Z' },
  { id: '2', type: 'warning', title: 'Missing Collision', description: '12 meshes are missing collision data', location: 'Folder: /Props/', suggestion: 'Generate simple collision for these meshes', autoFix: true, severity: 'medium', timestamp: '2024-12-29T10:28:00Z' },
  { id: '3', type: 'error', title: 'Broken Material Reference', description: 'Material M_OldWood references missing texture', location: 'Material: M_OldWood', suggestion: 'Reassign texture or use fallback', autoFix: false, severity: 'high', timestamp: '2024-12-29T10:25:00Z' },
  { id: '4', type: 'suggestion', title: 'Texture Optimization', description: '8 textures could be compressed without quality loss', location: 'Various textures', suggestion: 'Apply BC7 compression to these textures', autoFix: true, severity: 'low', timestamp: '2024-12-29T10:20:00Z' },
];

// ==================== SUB-COMPONENTS ====================

const StepTypeIcon: React.FC<{ type: CommandStep['type'] }> = ({ type }) => {
  switch (type) {
    case 'action': return <Play className="w-3 h-3" />;
    case 'condition': return <GitBranch className="w-3 h-3" />;
    case 'loop': return <RotateCcw className="w-3 h-3" />;
    case 'delay': return <Clock className="w-3 h-3" />;
    case 'variable': return <Code className="w-3 h-3" />;
    default: return <Zap className="w-3 h-3" />;
  }
};

const StatusBadge: React.FC<{ status?: CommandStep['status'] }> = ({ status }) => {
  const config = {
    pending: { color: 'bg-gray-500/20 text-gray-400', icon: <Clock className="w-3 h-3" /> },
    running: { color: 'bg-blue-500/20 text-blue-400', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    completed: { color: 'bg-green-500/20 text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
    failed: { color: 'bg-red-500/20 text-red-400', icon: <XCircle className="w-3 h-3" /> },
    skipped: { color: 'bg-yellow-500/20 text-yellow-400', icon: <FastForward className="w-3 h-3" /> }};
  
  const { color, icon } = config[status || 'pending'];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${color}`}>
      {icon}
      {status || 'pending'}
    </span>
  );
};

const SeverityBadge: React.FC<{ severity: DebugIssue['severity'] }> = ({ severity }) => {
  const config = {
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30'};
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border ${config[severity]}`}>
      {severity}
    </span>
  );
};

// ==================== MAIN COMPONENT ====================

interface AdvancedAIFeaturesProps {
  onExecuteCommand?: (command: string) => void;
  onExecuteChain?: (chain: CommandChain) => void;
  onExecuteMacro?: (macro: Macro) => void;
}

const AdvancedAIFeatures: React.FC<AdvancedAIFeaturesProps> = ({
  onExecuteCommand,
  onExecuteChain,
  onExecuteMacro}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'chains' | 'suggestions' | 'macros' | 'debug'>('chains');
  const [chains, setChains] = useState<CommandChain[]>(SAMPLE_CHAINS);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(SAMPLE_SUGGESTIONS);
  const [macros, setMacros] = useState<Macro[]>(SAMPLE_MACROS);
  const [debugIssues, setDebugIssues] = useState<DebugIssue[]>(SAMPLE_DEBUG_ISSUES);
  const [selectedChain, setSelectedChain] = useState<CommandChain | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedCommands, setRecordedCommands] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ setShowCreateChain] = useState(false);
  const [showCreateMacro, setShowCreateMacro] = useState(false);
  const [ setNewChainName] = useState('');
  const [newMacroName, setNewMacroName] = useState('');
  const [runningChain, setRunningChain] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Filter items based on search
  const filteredChains = useMemo(() => 
    chains.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [chains, searchQuery]);
  
  const filteredMacros = useMemo(() =>
    macros.filter(m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase())
    ), [macros, searchQuery]);
  
  // Run command chain
  const runChain = useCallback(async (chain: CommandChain) => {
    setRunningChain(chain.id);
    setCurrentStepIndex(0);
    
    const updatedSteps = [...chain.steps];
    
    for (let i = 0; i < updatedSteps.length; i++) {
      setCurrentStepIndex(i);
      updatedSteps[i].status = 'running';
      setChains(prev => prev.map(c => c.id === chain.id ? { ...c, steps: [...updatedSteps] } : c));
      
      // Simulate execution
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      
      // Random success/failure for demo
      const success = Math.random() > 0.1;
      updatedSteps[i].status = success ? 'completed' : 'failed';
      updatedSteps[i].duration = Math.floor(Math.random() * 500) + 200;
      
      if (!success) {
        updatedSteps[i].error = 'Simulated error for demonstration';
        break;
      }
      
      setChains(prev => prev.map(c => c.id === chain.id ? { ...c, steps: [...updatedSteps] } : c));
    }
    
    setRunningChain(null);
    onExecuteChain?.(chain);
  }, [onExecuteChain]);
  
  // Toggle macro recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      if (recordedCommands.length > 0) {
        setShowCreateMacro(true);
      }
    } else {
      setIsRecording(true);
      setRecordedCommands([]);
    }
  }, [isRecording, recordedCommands]);
  
  // Create new macro from recorded commands
  const createMacroFromRecording = useCallback(() => {
    if (newMacroName && recordedCommands.length > 0) {
      const newMacro: Macro = {
        id: Date.now().toString(),
        name: newMacroName,
        description: `Recorded macro with ${recordedCommands.length} commands`,
        commands: recordedCommands,
        createdAt: new Date().toISOString(),
        usageCount: 0,
        isFavorite: false};
      setMacros(prev => [newMacro, ...prev]);
      setShowCreateMacro(false);
      setNewMacroName('');
      setRecordedCommands([]);
    }
  }, [newMacroName, recordedCommands]);
  
  // Execute macro
  const executeMacro = useCallback((macro: Macro) => {
    macro.commands.forEach((cmd, i) => {
      setTimeout(() => {
        onExecuteCommand?.(cmd);
      }, i * 500);
    });
    
    setMacros(prev => prev.map(m => 
      m.id === macro.id 
        ? { ...m, usageCount: m.usageCount + 1, lastUsed: new Date().toISOString() }
        : m
    ));
    
    onExecuteMacro?.(macro);
  }, [onExecuteCommand, onExecuteMacro]);
  
  // Apply debug fix
  const applyFix = useCallback((issue: DebugIssue) => {
    setDebugIssues(prev => prev.filter(i => i.id !== issue.id));
    // In real implementation, this would execute the fix
    console.log('Applying fix for:', issue.title);
  }, []);
  
  // Toggle favorite
  const toggleChainFavorite = useCallback((chainId: string) => {
    setChains(prev => prev.map(c => 
      c.id === chainId ? { ...c, isFavorite: !c.isFavorite } : c
    ));
  }, []);
  
  const toggleMacroFavorite = useCallback((macroId: string) => {
    setMacros(prev => prev.map(m => 
      m.id === macroId ? { ...m, isFavorite: !m.isFavorite } : m
    ));
  }, []);
  
  // Collapsed view
  if (!isExpanded) {
    return (
      <div 
        className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-white/10 p-4 cursor-pointer hover:border-purple-500/50 transition-all"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Advanced AI Features</h3>
              <p className="text-xs text-gray-400">{chains.length} chains • {macros.length} macros • {debugIssues.length} issues</p>
            </div>
          </div>
          <Maximize2 className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                Advanced AI Features
                <span className="px-2 py-0.5 text-[10px] font-medium bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                  AI-Powered
                </span>
              </h3>
              <p className="text-xs text-gray-400">Command chaining, smart suggestions, macros & debugging</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400">Recording ({recordedCommands.length})</span>
              </div>
            )}
            
            {/* Record button */}
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                isRecording 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
              title={isRecording ? 'Stop recording' : 'Record macro'}
            >
              {isRecording ? <StopCircle className="w-4 h-4" /> : <Circle className="w-4 h-4 fill-current" />}
            </button>
            
            {/* Minimize */}
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Minimize2 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { id: 'chains', label: 'Command Chains', icon: <Link2 className="w-4 h-4" />, count: chains.length },
            { id: 'suggestions', label: 'Smart Suggestions', icon: <Lightbulb className="w-4 h-4" />, count: suggestions.length },
            { id: 'macros', label: 'Macros', icon: <Zap className="w-4 h-4" />, count: macros.length },
            { id: 'debug', label: 'AI Debug', icon: <Bug className="w-4 h-4" />, count: debugIssues.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-purple-500/30' : 'bg-white/10'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        
        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {/* Command Chains Tab */}
        {activeTab === 'chains' && (
          <div className="space-y-3">
            {/* Create new chain button */}
            <button
              onClick={() => setShowCreateChain(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-gray-400 hover:text-purple-300"
            >
              <Plus className="w-4 h-4" />
              Create New Command Chain
            </button>
            
            {/* Chain list */}
            {filteredChains.map(chain => (
              <div
                key={chain.id}
                className={`rounded-xl border transition-all ${
                  selectedChain?.id === chain.id 
                    ? 'bg-purple-500/10 border-purple-500/30' 
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Chain header */}
                <div 
                  className="p-3 cursor-pointer"
                  onClick={() => setSelectedChain(selectedChain?.id === chain.id ? null : chain)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
                        <Link2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{chain.name}</h4>
                          {chain.isFavorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{chain.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-gray-500">{chain.steps.length} steps</span>
                          <span className="text-gray-600">•</span>
                          <span className="text-[10px] text-gray-500">Run {chain.runCount}x</span>
                          {chain.tags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-gray-400">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleChainFavorite(chain.id); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {chain.isFavorite 
                          ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          : <StarOff className="w-4 h-4 text-gray-500" />
                        }
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); runChain(chain); }}
                        disabled={runningChain !== null}
                        className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        {runningChain === chain.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${selectedChain?.id === chain.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
                
                {/* Expanded steps */}
                {selectedChain?.id === chain.id && (
                  <div className="px-3 pb-3 border-t border-white/10 mt-2 pt-3">
                    <div className="space-y-2">
                      {chain.steps.map((step, idx) => (
                        <div 
                          key={step.id}
                          className={`flex items-center gap-3 p-2 rounded-lg ${
                            runningChain === chain.id && idx === currentStepIndex
                              ? 'bg-blue-500/20 border border-blue-500/30'
                              : 'bg-white/5'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                            step.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            step.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            step.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-white/10 text-gray-400'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <StepTypeIcon type={step.type} />
                              <span className="text-sm text-white">{step.command}</span>
                            </div>
                            {step.duration && (
                              <span className="text-[10px] text-gray-500">{step.duration}ms</span>
                            )}
                          </div>
                          <StatusBadge status={step.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Smart Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <Brain className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-white">AI is learning your patterns</p>
                <p className="text-xs text-gray-400">Suggestions improve as you work</p>
              </div>
            </div>
            
            {suggestions.map(suggestion => (
              <div
                key={suggestion.id}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group"
                onClick={() => onExecuteCommand?.(suggestion.command)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/20">
                      <Lightbulb className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white group-hover:text-purple-300 transition-colors">
                        {suggestion.command}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">{suggestion.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300">
                          {suggestion.category}
                        </span>
                        <span className="text-[10px] text-gray-500">Used {suggestion.usageCount}x</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                          style={{ width: `${suggestion.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{suggestion.confidence}%</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Macros Tab */}
        {activeTab === 'macros' && (
          <div className="space-y-3">
            {/* Create macro button */}
            <button
              onClick={() => setShowCreateMacro(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-gray-400 hover:text-purple-300"
            >
              <Plus className="w-4 h-4" />
              Create New Macro
            </button>
            
            {/* Macro list */}
            {filteredMacros.map(macro => (
              <div
                key={macro.id}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                      <Zap className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white">{macro.name}</h4>
                        {macro.isFavorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                        {macro.shortcut && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-gray-400 font-mono">
                            {macro.shortcut}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{macro.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-gray-500">{macro.commands.length} commands</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-[10px] text-gray-500">Used {macro.usageCount}x</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleMacroFavorite(macro.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {macro.isFavorite 
                        ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        : <StarOff className="w-4 h-4 text-gray-500" />
                      }
                    </button>
                    <button
                      onClick={() => executeMacro(macro)}
                      className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Command preview */}
                <div className="mt-3 p-2 rounded-lg bg-black/20 border border-white/5">
                  <div className="flex flex-wrap gap-1">
                    {macro.commands.map((cmd, idx) => (
                      <React.Fragment key={idx}>
                        <span className="px-2 py-1 rounded bg-white/10 text-xs text-gray-300">{cmd}</span>
                        {idx < macro.commands.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-gray-600 self-center" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* AI Debug Tab */}
        {activeTab === 'debug' && (
          <div className="space-y-3">
            {/* Scan button */}
            <button
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 hover:border-purple-500/50 transition-all text-purple-300"
            >
              <Bug className="w-4 h-4" />
              Scan for Issues
            </button>
            
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { type: 'error', count: debugIssues.filter(i => i.type === 'error').length, color: 'red' },
                { type: 'warning', count: debugIssues.filter(i => i.type === 'warning').length, color: 'yellow' },
                { type: 'performance', count: debugIssues.filter(i => i.type === 'performance').length, color: 'orange' },
                { type: 'suggestion', count: debugIssues.filter(i => i.type === 'suggestion').length, color: 'blue' },
              ].map(item => (
                <div key={item.type} className={`p-2 rounded-lg bg-${item.color}-500/10 border border-${item.color}-500/20 text-center`}>
                  <div className={`text-lg font-bold text-${item.color}-400`}>{item.count}</div>
                  <div className="text-[10px] text-gray-400 capitalize">{item.type}s</div>
                </div>
              ))}
            </div>
            
            {/* Issue list */}
            {debugIssues.map(issue => (
              <div
                key={issue.id}
                className="p-3 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      issue.type === 'error' ? 'bg-red-500/20 border-red-500/20' :
                      issue.type === 'warning' ? 'bg-yellow-500/20 border-yellow-500/20' :
                      issue.type === 'performance' ? 'bg-orange-500/20 border-orange-500/20' :
                      'bg-blue-500/20 border-blue-500/20'
                    } border`}>
                      {issue.type === 'error' ? <XCircle className="w-4 h-4 text-red-400" /> :
                       issue.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-400" /> :
                       issue.type === 'performance' ? <Activity className="w-4 h-4 text-orange-400" /> :
                       <Lightbulb className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white">{issue.title}</h4>
                        <SeverityBadge severity={issue.severity} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{issue.description}</p>
                      {issue.location && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          <span className="text-gray-600">Location:</span> {issue.location}
                        </p>
                      )}
                      {issue.suggestion && (
                        <p className="text-xs text-purple-300 mt-2 flex items-start gap-1">
                          <Wand2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {issue.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {issue.autoFix && (
                    <button
                      onClick={() => applyFix(issue)}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-xs flex items-center gap-1"
                    >
                      <Wand2 className="w-3 h-3" />
                      Auto-Fix
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Create Macro Modal */}
      {showCreateMacro && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Macro</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Macro Name</label>
                <input
                  type="text"
                  value={newMacroName}
                  onChange={(e) => setNewMacroName(e.target.value)}
                  placeholder="My Custom Macro"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>
              
              {recordedCommands.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Recorded Commands ({recordedCommands.length})</label>
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5 max-h-32 overflow-y-auto">
                    {recordedCommands.map((cmd, idx) => (
                      <div key={idx} className="text-xs text-gray-300 py-1">
                        {idx + 1}. {cmd}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowCreateMacro(false); setRecordedCommands([]); }}
                className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createMacroFromRecording}
                disabled={!newMacroName}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Create Macro
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Voice Commands Footer */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Sparkles className="w-3 h-3" />
          <span>Voice:</span>
          <span className="text-gray-400">"Run scene setup chain"</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">"Create macro"</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">"Debug scene"</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">"Show suggestions"</span>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAIFeatures;
