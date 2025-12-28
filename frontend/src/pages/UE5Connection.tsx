import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wifi, WifiOff, RefreshCw, Settings, Play, Square, Search,
  ChevronRight, ChevronDown, Box, Camera, Map, FolderOpen,
  GitBranch, Palette, Zap, Film, Volume2, Mountain, Puzzle,
  MousePointer, Terminal, Star, StarOff, Clock, CheckCircle,
  XCircle, AlertCircle, Send, Loader2, Copy, Trash2, Filter,
  LayoutGrid, List, Maximize2, Minimize2, Info, Code, Eye,
  Activity, Cpu, HardDrive, Monitor, Save, Undo, Redo, X,
  ArrowRight, Sparkles, History, Heart, BookOpen, Command
} from 'lucide-react';
import { MCP_TOOLS, MCP_CATEGORIES, QUICK_ACTIONS, MCPTool, MCPToolParameter } from '../data/mcpTools';

// Types
interface ConnectionStatus {
  connected: boolean;
  host: string;
  port: number;
  version: string;
  uptime: number;
  lastPing: number;
}

interface ExecutionResult {
  id: string;
  tool: string;
  params: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
  timestamp: Date;
  duration: number;
}

interface UE5Status {
  projectName: string;
  levelName: string;
  actorCount: number;
  fps: number;
  memoryUsage: number;
  isPIERunning: boolean;
}

// Icon mapping
const iconMap: Record<string, React.FC<any>> = {
  Box, Camera, Map, FolderOpen, GitBranch, Palette, Zap, Film,
  Volume2, Mountain, Puzzle, MousePointer, Play, Settings, Save,
  Undo, Redo, X, Square
};

const getIcon = (name: string) => iconMap[name] || Box;

export default function UE5Connection() {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    host: 'localhost',
    port: 8080,
    version: '',
    uptime: 0,
    lastPing: 0
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // UE5 status
  const [ue5Status, setUe5Status] = useState<UE5Status | null>(null);

  // Tool browser state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolParams, setToolParams] = useState<Record<string, any>>({});

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  // AI Assistant state
  const [aiCommand, setAiCommand] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'tools' | 'quick' | 'history' | 'ai'>('tools');
  const [showSettings, setShowSettings] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const resultRef = useRef<HTMLDivElement>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('ue5_mcp_favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('ue5_mcp_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Filter tools based on search and category
  const filteredTools = MCP_TOOLS.filter(tool => {
    const matchesSearch = searchQuery === '' ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Connect to MCP server
  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      const response = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: connectionStatus.host,
          port: connectionStatus.port
        })
      });
      
      if (!response.ok) throw new Error('Failed to connect');
      
      const data = await response.json();
      setConnectionStatus(prev => ({
        ...prev,
        connected: true,
        version: data.version || 'Unknown',
        uptime: 0,
        lastPing: Date.now()
      }));
      
      // Fetch UE5 status
      fetchUE5Status();
    } catch (error: any) {
      setConnectionError(error.message || 'Connection failed');
      setConnectionStatus(prev => ({ ...prev, connected: false }));
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from MCP server
  const handleDisconnect = async () => {
    try {
      await fetch('/api/mcp/disconnect', { method: 'POST' });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
    setConnectionStatus(prev => ({ ...prev, connected: false }));
    setUe5Status(null);
  };

  // Fetch UE5 status
  const fetchUE5Status = async () => {
    try {
      const response = await fetch('/api/mcp/status');
      if (response.ok) {
        const data = await response.json();
        setUe5Status(data);
      }
    } catch (error) {
      console.error('Failed to fetch UE5 status:', error);
    }
  };

  // Execute a tool
  const executeTool = async (toolName: string, params: Record<string, any>) => {
    setIsExecuting(true);
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, params })
      });
      
      const data = await response.json();
      const duration = Date.now() - startTime;
      
      const result: ExecutionResult = {
        id: crypto.randomUUID(),
        tool: toolName,
        params,
        result: data.result,
        success: response.ok && !data.error,
        error: data.error,
        timestamp: new Date(),
        duration
      };
      
      setExecutionHistory(prev => [result, ...prev.slice(0, 99)]);
      
      // Refresh UE5 status after execution
      if (connectionStatus.connected) {
        fetchUE5Status();
      }
      
      return result;
    } catch (error: any) {
      const result: ExecutionResult = {
        id: crypto.randomUUID(),
        tool: toolName,
        params,
        result: null,
        success: false,
        error: error.message,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
      
      setExecutionHistory(prev => [result, ...prev.slice(0, 99)]);
      return result;
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle tool selection
  const handleToolSelect = (tool: MCPTool) => {
    setSelectedTool(tool);
    // Initialize params with defaults
    const defaultParams: Record<string, any> = {};
    tool.parameters.forEach(param => {
      if (param.default !== undefined) {
        defaultParams[param.name] = param.default;
      }
    });
    setToolParams(defaultParams);
  };

  // Handle tool execution
  const handleExecute = async () => {
    if (!selectedTool) return;
    await executeTool(selectedTool.name, toolParams);
  };

  // Toggle favorite
  const toggleFavorite = (toolName: string) => {
    setFavorites(prev =>
      prev.includes(toolName)
        ? prev.filter(f => f !== toolName)
        : [...prev, toolName]
    );
  };

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Handle AI command
  const handleAiCommand = async () => {
    if (!aiCommand.trim()) return;
    
    setIsAiProcessing(true);
    try {
      const response = await fetch('/api/mcp/ai-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: aiCommand })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.tool && data.params) {
          await executeTool(data.tool, data.params);
        }
        setAiSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('AI command error:', error);
    } finally {
      setIsAiProcessing(false);
      setAiCommand('');
    }
  };

  // Quick action execution
  const executeQuickAction = async (action: typeof QUICK_ACTIONS[0]) => {
    await executeTool(action.tool, action.params);
  };

  // Render parameter input
  const renderParamInput = (param: MCPToolParameter) => {
    const value = toolParams[param.name] ?? '';
    
    if (param.enum) {
      return (
        <select
          value={value}
          onChange={(e) => setToolParams(prev => ({ ...prev, [param.name]: e.target.value }))}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select {param.name}</option>
          {param.enum.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    
    if (param.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setToolParams(prev => ({ ...prev, [param.name]: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-gray-300">{value ? 'True' : 'False'}</span>
        </label>
      );
    }
    
    if (param.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => setToolParams(prev => ({ ...prev, [param.name]: parseFloat(e.target.value) || 0 }))}
          placeholder={param.description}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      );
    }
    
    if (param.type === 'array') {
      return (
        <input
          type="text"
          value={Array.isArray(value) ? value.join(', ') : value}
          onChange={(e) => setToolParams(prev => ({ ...prev, [param.name]: e.target.value.split(',').map(s => s.trim()) }))}
          placeholder="Comma-separated values"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      );
    }
    
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setToolParams(prev => ({ ...prev, [param.name]: e.target.value }))}
        placeholder={param.description}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connectionStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <h1 className="text-xl font-bold">UE5 Connection</h1>
            </div>
            <span className="text-gray-400 text-sm">
              {connectionStatus.connected ? `Connected to ${connectionStatus.host}:${connectionStatus.port}` : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {connectionStatus.connected ? (
              <>
                <button
                  onClick={fetchUE5Status}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Refresh Status"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <WifiOff className="w-4 h-4" />
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {connectionError && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {connectionError}
          </div>
        )}
      </div>

      {/* UE5 Status Bar */}
      {connectionStatus.connected && ue5Status && (
        <div className="bg-gray-800/50 border-b border-gray-700 px-6 py-3">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">Project:</span>
              <span className="text-white font-medium">{ue5Status.projectName || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-green-400" />
              <span className="text-gray-400">Level:</span>
              <span className="text-white font-medium">{ue5Status.levelName || 'None'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-purple-400" />
              <span className="text-gray-400">Actors:</span>
              <span className="text-white font-medium">{ue5Status.actorCount || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400">FPS:</span>
              <span className="text-white font-medium">{ue5Status.fps || '--'}</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-orange-400" />
              <span className="text-gray-400">Memory:</span>
              <span className="text-white font-medium">{ue5Status.memoryUsage ? `${ue5Status.memoryUsage.toFixed(1)} GB` : '--'}</span>
            </div>
            {ue5Status.isPIERunning && (
              <div className="flex items-center gap-2 text-green-400">
                <Play className="w-4 h-4" />
                <span>PIE Running</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex h-[calc(100vh-120px)]">
        {/* Left Panel - Tool Browser */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {[
              { id: 'tools', label: 'Tools', icon: Box },
              { id: 'quick', label: 'Quick', icon: Zap },
              { id: 'history', label: 'History', icon: History },
              { id: 'ai', label: 'AI', icon: Sparkles }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'tools' && (
              <div className="p-4 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 101 tools..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* View Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {filteredTools.length} tools
                  </span>
                  <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-2">
                  {MCP_CATEGORIES.map(category => {
                    const CategoryIcon = getIcon(category.icon);
                    const isExpanded = expandedCategories.has(category.id);
                    const categoryTools = filteredTools.filter(t => t.category === category.id);
                    
                    if (categoryTools.length === 0 && searchQuery) return null;
                    
                    return (
                      <div key={category.id} className="bg-gray-700/50 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            <CategoryIcon className="w-4 h-4" style={{ color: category.color }} />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-white">{category.name}</div>
                            <div className="text-xs text-gray-400">{categoryTools.length} tools</div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="px-2 pb-2 space-y-1">
                            {categoryTools.map(tool => (
                              <button
                                key={tool.name}
                                onClick={() => handleToolSelect(tool)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                                  selectedTool?.name === tool.name
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-gray-600 text-gray-300'
                                }`}
                              >
                                <span className="flex-1 text-sm truncate">{tool.displayName}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(tool.name);
                                  }}
                                  className="p-1 hover:bg-gray-500 rounded"
                                >
                                  {favorites.includes(tool.name) ? (
                                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                  ) : (
                                    <StarOff className="w-3 h-3 text-gray-500" />
                                  )}
                                </button>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'quick' && (
              <div className="p-4 space-y-4">
                <h3 className="text-sm font-medium text-gray-400">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map(action => {
                    const ActionIcon = getIcon(action.icon);
                    return (
                      <button
                        key={action.id}
                        onClick={() => executeQuickAction(action)}
                        disabled={!connectionStatus.connected || isExecuting}
                        className="flex flex-col items-center gap-2 p-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <ActionIcon className="w-6 h-6 text-blue-400" />
                        <span className="text-sm text-white">{action.name}</span>
                      </button>
                    );
                  })}
                </div>

                {favorites.length > 0 && (
                  <>
                    <h3 className="text-sm font-medium text-gray-400 mt-6">Favorites</h3>
                    <div className="space-y-1">
                      {favorites.map(toolName => {
                        const tool = MCP_TOOLS.find(t => t.name === toolName);
                        if (!tool) return null;
                        return (
                          <button
                            key={toolName}
                            onClick={() => handleToolSelect(tool)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                          >
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm text-white">{tool.displayName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-4 space-y-2">
                {executionHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No execution history</p>
                  </div>
                ) : (
                  executionHistory.map(result => (
                    <div
                      key={result.id}
                      className={`p-3 rounded-lg border ${
                        result.success
                          ? 'bg-green-900/20 border-green-800'
                          : 'bg-red-900/20 border-red-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {result.success ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-sm font-medium text-white">{result.tool}</span>
                        <span className="text-xs text-gray-400 ml-auto">{result.duration}ms</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="p-4 space-y-4">
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-white">AI Assistant</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-4">
                    Describe what you want to do in natural language, and AI will execute the right tools.
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={aiCommand}
                      onChange={(e) => setAiCommand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAiCommand()}
                      placeholder="e.g., Spawn a cube at position 0,0,100"
                      className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleAiCommand}
                      disabled={!aiCommand.trim() || isAiProcessing || !connectionStatus.connected}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-purple-400 hover:text-purple-300 disabled:opacity-50"
                    >
                      {isAiProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-400">Example Commands</h4>
                  {[
                    'Spawn a cube at the origin',
                    'Take a screenshot',
                    'Select all actors in the level',
                    'Play the game in editor',
                    'Create a new Blueprint called MyActor',
                    'Apply physics to the selected actor'
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setAiCommand(example)}
                      className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Tool Details & Execution */}
        <div className="flex-1 flex flex-col">
          {selectedTool ? (
            <>
              {/* Tool Header */}
              <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white">{selectedTool.displayName}</h2>
                      <button
                        onClick={() => toggleFavorite(selectedTool.name)}
                        className="p-1 hover:bg-gray-700 rounded"
                      >
                        {favorites.includes(selectedTool.name) ? (
                          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        ) : (
                          <StarOff className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <p className="text-gray-400 mt-1">{selectedTool.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedTool(null)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                    {selectedTool.category}
                  </span>
                  {selectedTool.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tool Parameters */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl space-y-6">
                  {selectedTool.parameters.length > 0 ? (
                    <>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-400" />
                        Parameters
                      </h3>
                      <div className="space-y-4">
                        {selectedTool.parameters.map(param => (
                          <div key={param.name} className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-white">
                              {param.name}
                              {param.required && <span className="text-red-400">*</span>}
                              <span className="text-xs text-gray-500 font-normal">({param.type})</span>
                            </label>
                            {renderParamInput(param)}
                            <p className="text-xs text-gray-400">{param.description}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>This tool has no parameters</p>
                    </div>
                  )}

                  {/* Execute Button */}
                  <div className="pt-4 border-t border-gray-700">
                    <button
                      onClick={handleExecute}
                      disabled={!connectionStatus.connected || isExecuting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Execute Tool
                        </>
                      )}
                    </button>
                    {!connectionStatus.connected && (
                      <p className="text-center text-sm text-yellow-400 mt-2">
                        Connect to UE5 to execute tools
                      </p>
                    )}
                  </div>

                  {/* Last Result */}
                  {executionHistory.length > 0 && executionHistory[0].tool === selectedTool.name && (
                    <div className="mt-6" ref={resultRef}>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                        <Terminal className="w-5 h-5 text-gray-400" />
                        Last Result
                      </h3>
                      <div className={`p-4 rounded-lg border ${
                        executionHistory[0].success
                          ? 'bg-green-900/20 border-green-800'
                          : 'bg-red-900/20 border-red-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {executionHistory[0].success ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                          <span className={executionHistory[0].success ? 'text-green-400' : 'text-red-400'}>
                            {executionHistory[0].success ? 'Success' : 'Failed'}
                          </span>
                          <span className="text-gray-400 text-sm ml-auto">
                            {executionHistory[0].duration}ms
                          </span>
                        </div>
                        <pre className="text-sm text-gray-300 overflow-x-auto bg-gray-900/50 p-3 rounded">
                          {JSON.stringify(executionHistory[0].result || executionHistory[0].error, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Welcome Screen */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-lg">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Command className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">UE5 MCP Control Center</h2>
                <p className="text-gray-400 mb-6">
                  Control Unreal Engine 5 with 101 powerful tools. Browse categories, search for specific tools, or use AI to execute commands naturally.
                </p>
                
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-3xl font-bold text-blue-400">101</div>
                    <div className="text-sm text-gray-400">Tools</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-3xl font-bold text-purple-400">14</div>
                    <div className="text-sm text-gray-400">Categories</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-3xl font-bold text-green-400">
                      {connectionStatus.connected ? 'ON' : 'OFF'}
                    </div>
                    <div className="text-sm text-gray-400">Status</div>
                  </div>
                </div>

                {!connectionStatus.connected && (
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Wifi className="w-5 h-5" />
                    )}
                    {isConnecting ? 'Connecting...' : 'Connect to UE5'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Connection Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Host</label>
                <input
                  type="text"
                  value={connectionStatus.host}
                  onChange={(e) => setConnectionStatus(prev => ({ ...prev, host: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
                <input
                  type="number"
                  value={connectionStatus.port}
                  onChange={(e) => setConnectionStatus(prev => ({ ...prev, port: parseInt(e.target.value) || 8080 }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  if (connectionStatus.connected) {
                    handleDisconnect();
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
