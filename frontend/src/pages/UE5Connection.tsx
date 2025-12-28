/**
 * UE5 Connection Hub - Comprehensive UE5 Integration Center
 * 
 * A unified hub for:
 * - Real-time UE5 connection monitoring
 * - Downloads (Agent & MCP Bridge Plugin)
 * - Setup guides and installation instructions
 * - 101 MCP Tools browser with AI command interface
 * - Troubleshooting and support
 * 
 * Supports: Unreal Engine 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi, WifiOff, RefreshCw, Settings, Play, Square, Search,
  ChevronRight, ChevronDown, Box, Camera, Map, FolderOpen,
  GitBranch, Palette, Zap, Film, Volume2, Mountain, Puzzle,
  MousePointer, Terminal, Star, StarOff, CheckCircle,
  XCircle, AlertCircle, Send, Loader2, Copy,
  LayoutGrid, List,
  Activity, Monitor, Save, Undo, Redo, X,
  ArrowRight, Sparkles, History, BookOpen, Command,
  Download, Package, Plug, Shield, ExternalLink, Check,
  FileCode, HelpCircle, AlertTriangle,
  Globe, Power, PowerOff,
  Gauge, Layers, Wrench, Target, Crosshair
} from 'lucide-react';
import { MCP_TOOLS, MCP_CATEGORIES, QUICK_ACTIONS, MCPTool } from '../data/mcpTools';

// ==================== TYPES ====================

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

interface DownloadItem {
  filename: string;
  name: string;
  version: string;
  description: string;
  size: string;
  category: 'agent' | 'plugin';
  platform: string[];
  available: boolean;
  download_url: string | null;
}

// ==================== CONSTANTS ====================

const UE5_VERSIONS = ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'];

const TABS = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'tools', label: 'MCP Tools', icon: Wrench },
  { id: 'ai', label: 'AI Commands', icon: Sparkles },
  { id: 'setup', label: 'Setup Guide', icon: BookOpen },
  { id: 'troubleshoot', label: 'Help', icon: HelpCircle },
] as const;

type TabId = typeof TABS[number]['id'];

// Icon mapping for tool categories
const iconMap: Record<string, React.FC<any>> = {
  Box, Camera, Map, FolderOpen, GitBranch, Palette, Zap, Film,
  Volume2, Mountain, Puzzle, MousePointer, Play, Settings, Save,
  Undo, Redo, X, Square, Layers, Target, Crosshair
};

const getIcon = (name: string) => iconMap[name] || Box;

// ==================== UTILITY COMPONENTS ====================

// Copy to clipboard hook
function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

// Code Block Component
function CodeBlock({ code }: { code: string }) {
  const { copied, copy } = useCopyToClipboard();
  const id = `code-${code.slice(0, 20)}`;
  return (
    <div className="relative group">
      <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{code}</code>
      </pre>
      <button
        onClick={() => copy(code, id)}
        className="absolute top-2 right-2 p-2 bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700"
        title="Copy to clipboard"
      >
        {copied === id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
      </button>
    </div>
  );
}

// Collapsible Section
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-white">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 text-xs bg-blue-600 rounded-full">{badge}</span>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {isOpen && <div className="p-4 bg-gray-900/50">{children}</div>}
    </div>
  );
}

// Step Component for guides
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
        {number}
      </div>
      <div className="flex-1 pb-6">
        <h4 className="font-medium text-white mb-2">{title}</h4>
        <div className="text-gray-400 text-sm space-y-2">{children}</div>
      </div>
    </div>
  );
}

// Status Badge
function StatusBadge({ status, size = 'md' }: { status: 'connected' | 'disconnected' | 'connecting' | 'error'; size?: 'sm' | 'md' }) {
  const configs = {
    connected: { color: 'bg-green-500', text: 'Connected', icon: CheckCircle },
    disconnected: { color: 'bg-gray-500', text: 'Disconnected', icon: WifiOff },
    connecting: { color: 'bg-yellow-500', text: 'Connecting...', icon: Loader2 },
    error: { color: 'bg-red-500', text: 'Error', icon: XCircle },
  };
  const config = configs[status];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';
  
  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full ${config.color} text-white font-medium`}>
      <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} ${status === 'connecting' ? 'animate-spin' : ''}`} />
      {config.text}
    </span>
  );
}

// ==================== MAIN COMPONENT ====================

export default function UE5Connection() {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    host: 'localhost',
    port: 3000,
    version: '',
    uptime: 0,
    lastPing: 0
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // UE5 status
  const [ue5Status, setUe5Status] = useState<UE5Status | null>(null);

  // Downloads state
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

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
  const [aiSuggestions] = useState<string[]>([
    'Spawn 10 cubes in a circle',
    'Delete all static mesh actors',
    'Set the sun position to sunset',
    'Create a blueprint for a rotating platform',
    'Add point lights around the selected actor'
  ]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showSettings, setShowSettings] = useState(false);
  

  const resultRef = useRef<HTMLDivElement>(null);

  // ==================== EFFECTS ====================

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

  // Load downloads on mount
  useEffect(() => {
    loadDownloads();
  }, []);

  // ==================== API FUNCTIONS ====================

  const loadDownloads = async () => {
    try {
      setLoadingDownloads(true);
      const response = await fetch('/api/downloads');
      if (response.ok) {
        const data = await response.json();
        setDownloads(data.downloads);
      }
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoadingDownloads(false);
    }
  };

  const handleDownload = async (item: DownloadItem) => {
    if (!item.download_url) return;
    try {
      setDownloading(item.filename);
      const link = document.createElement('a');
      link.href = item.download_url;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(null);
    }
  };

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
      
      setExecutionHistory(prev => [result, ...prev.slice(0, 49)]);
      
      if (resultRef.current) {
        resultRef.current.scrollIntoView({ behavior: 'smooth' });
      }
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
      setExecutionHistory(prev => [result, ...prev.slice(0, 49)]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Process AI command
  const processAiCommand = async () => {
    if (!aiCommand.trim()) return;
    
    setIsAiProcessing(true);
    setAiResponse(null);
    
    try {
      const response = await fetch('/api/mcp/ai-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: aiCommand })
      });
      
      const data = await response.json();
      setAiResponse(data.response || 'Command processed successfully');
      
      if (data.tools_executed) {
        data.tools_executed.forEach((exec: any) => {
          setExecutionHistory(prev => [{
            id: crypto.randomUUID(),
            tool: exec.tool,
            params: exec.params,
            result: exec.result,
            success: exec.success,
            error: exec.error,
            timestamp: new Date(),
            duration: exec.duration || 0
          }, ...prev.slice(0, 49)]);
        });
      }
    } catch (error: any) {
      setAiResponse(`Error: ${error.message}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Toggle favorite
  const toggleFavorite = (toolName: string) => {
    setFavorites(prev => 
      prev.includes(toolName) 
        ? prev.filter(f => f !== toolName)
        : [...prev, toolName]
    );
  };



  // ==================== RENDER SECTIONS ====================

  // Overview Tab
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Connection Status Hero */}
      <div className={`rounded-2xl p-6 ${connectionStatus.connected ? 'bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-700/50' : 'bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${connectionStatus.connected ? 'bg-green-600' : 'bg-gray-700'}`}>
              {connectionStatus.connected ? <Wifi className="w-8 h-8 text-white" /> : <WifiOff className="w-8 h-8 text-gray-400" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {connectionStatus.connected ? 'Connected to UE5' : 'Not Connected'}
              </h2>
              <p className="text-gray-400">
                {connectionStatus.connected 
                  ? `${connectionStatus.host}:${connectionStatus.port} • MCP Bridge v${connectionStatus.version}`
                  : 'Connect to your Unreal Engine 5 editor to start'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {connectionStatus.connected ? (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <PowerOff className="w-4 h-4" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {/* Connection Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Host</label>
            <input
              type="text"
              value={connectionStatus.host}
              onChange={(e) => setConnectionStatus(prev => ({ ...prev, host: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="localhost"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Port</label>
            <input
              type="number"
              value={connectionStatus.port}
              onChange={(e) => setConnectionStatus(prev => ({ ...prev, port: parseInt(e.target.value) || 3000 }))}
              className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="3000"
            />
          </div>
        </div>

        {connectionError && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2 text-red-300">
            <AlertCircle className="w-4 h-4" />
            {connectionError}
          </div>
        )}
      </div>

      {/* UE5 Status Cards */}
      {connectionStatus.connected && ue5Status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm">Project</span>
            </div>
            <p className="text-white font-medium truncate">{ue5Status.projectName || 'Unknown'}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Map className="w-4 h-4" />
              <span className="text-sm">Level</span>
            </div>
            <p className="text-white font-medium truncate">{ue5Status.levelName || 'None'}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-sm">FPS</span>
            </div>
            <p className="text-white font-medium">{ue5Status.fps || 0}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Box className="w-4 h-4" />
              <span className="text-sm">Actors</span>
            </div>
            <p className="text-white font-medium">{ue5Status.actorCount || 0}</p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Wrench className="w-8 h-8 text-blue-400" />
            <span className="text-3xl font-bold text-white">101</span>
          </div>
          <p className="text-gray-300">MCP Tools Available</p>
          <p className="text-sm text-gray-500 mt-1">15 categories</p>
        </div>
        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <Star className="w-8 h-8 text-purple-400" />
            <span className="text-3xl font-bold text-white">{favorites.length}</span>
          </div>
          <p className="text-gray-300">Favorite Tools</p>
          <p className="text-sm text-gray-500 mt-1">Quick access</p>
        </div>
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <History className="w-8 h-8 text-green-400" />
            <span className="text-3xl font-bold text-white">{executionHistory.length}</span>
          </div>
          <p className="text-gray-300">Commands Executed</p>
          <p className="text-sm text-gray-500 mt-1">This session</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.slice(0, 8).map((action) => (
            <button
              key={action.name}
              onClick={() => executeTool(action.tool, action.params)}
              disabled={!connectionStatus.connected || isExecuting}
              className="p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <p className="text-white font-medium text-sm">{action.name}</p>
              <p className="text-gray-400 text-xs mt-1 truncate">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Execution History */}
      {executionHistory.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Recent Executions
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {executionHistory.slice(0, 5).map((exec) => (
              <div
                key={exec.id}
                className={`p-3 rounded-lg border ${exec.success ? 'bg-green-900/20 border-green-700/50' : 'bg-red-900/20 border-red-700/50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {exec.success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-white font-medium">{exec.tool}</span>
                  </div>
                  <span className="text-xs text-gray-500">{exec.duration}ms</span>
                </div>
                {exec.error && <p className="text-red-400 text-sm mt-1">{exec.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Downloads Tab
  const renderDownloads = () => (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-900/50 via-purple-900/50 to-blue-900/50 border border-blue-700/30 rounded-2xl p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
            <Download className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Downloads & Installation</h2>
            <p className="text-gray-300">Get the tools you need to connect UE5 AI Studio to your editor</p>
          </div>
        </div>

        {/* Quick Start Steps */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { num: 1, title: 'Download', desc: 'Get Agent & Plugin' },
            { num: 2, title: 'Install Plugin', desc: 'Add to UE5 project' },
            { num: 3, title: 'Run Agent', desc: 'Start desktop app' },
            { num: 4, title: 'Connect', desc: 'Control UE5 with AI!' },
          ].map((step, i) => (
            <div key={step.num} className="text-center">
              <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-bold ${i === 3 ? 'bg-green-600' : 'bg-blue-600'}`}>
                {i === 3 ? <CheckCircle className="w-5 h-5" /> : step.num}
              </div>
              <p className="text-white font-medium mt-2">{step.title}</p>
              <p className="text-gray-400 text-xs">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* System Requirements */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Desktop Agent Requirements</h3>
          </div>
          <ul className="space-y-2 text-gray-300 text-sm">
            {[
              { label: 'OS', value: 'Windows 10/11, macOS 10.15+, Ubuntu 20.04+' },
              { label: 'RAM', value: '4GB minimum, 8GB recommended' },
              { label: 'Storage', value: '200MB free space' },
              { label: 'Network', value: 'Internet connection required' },
              { label: 'Dependencies', value: 'Node.js 18+ (bundled)' },
            ].map((req) => (
              <li key={req.label} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>{req.label}:</strong> {req.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Plug className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold text-white">MCP Bridge Plugin Requirements</h3>
          </div>
          <ul className="space-y-2 text-gray-300 text-sm">
            {[
              { label: 'Engine', value: 'Unreal Engine 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7' },
              { label: 'OS', value: 'Windows 10/11 or macOS 12+' },
              { label: 'Visual Studio', value: '2019 or 2022 (Windows)' },
              { label: 'Xcode', value: '14+ (macOS)' },
              { label: 'Project Type', value: 'C++ or Blueprint (with C++ enabled)' },
            ].map((req) => (
              <li key={req.label} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span><strong>{req.label}:</strong> {req.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Download Cards */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-green-400" />
          Available Downloads
        </h3>
        <button
          onClick={loadDownloads}
          disabled={loadingDownloads}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loadingDownloads ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loadingDownloads ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {downloads.map((item) => {
            const isAgent = item.category === 'agent';
            const gradientClass = isAgent ? 'from-blue-600 to-purple-600' : 'from-green-600 to-teal-600';
            const Icon = isAgent ? Monitor : Plug;

            return (
              <div key={item.filename} className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-all">
                <div className={`bg-gradient-to-r ${gradientClass} p-6`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white">{item.name}</h4>
                      <p className="text-white/80 text-sm">Version {item.version}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-gray-300">{item.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Package className="w-4 h-4" />
                      <span>Size: {item.size}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Globe className="w-4 h-4" />
                      <span>{item.platform.join(', ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.available ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-sm">Available for download</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 text-sm">Coming soon</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => handleDownload(item)}
                    disabled={!item.available || downloading === item.filename}
                    className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                      item.available
                        ? `bg-gradient-to-r ${gradientClass} hover:opacity-90 text-white`
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {downloading === item.filename ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>Download {isAgent ? 'Agent' : 'Plugin'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supported UE5 Versions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Supported Unreal Engine Versions
        </h3>
        <div className="flex flex-wrap gap-3">
          {UE5_VERSIONS.map((version) => (
            <span
              key={version}
              className="px-4 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg text-white font-medium"
            >
              UE {version}
            </span>
          ))}
        </div>
        <p className="text-gray-400 text-sm mt-4">
          The MCP Bridge plugin is compatible with all listed versions. For best results, use the latest stable release of Unreal Engine.
        </p>
      </div>
    </div>
  );

  // MCP Tools Tab
  const renderTools = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 101 MCP tools..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All ({MCP_TOOLS.length})
        </button>
        {MCP_CATEGORIES.map((cat) => {
          const count = MCP_TOOLS.filter(t => t.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Favorites Section */}
      {favorites.length > 0 && !selectedCategory && !searchQuery && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            Favorite Tools
          </h3>
          <div className="flex flex-wrap gap-2">
            {favorites.map((favName) => {
              const tool = MCP_TOOLS.find(t => t.name === favName);
              if (!tool) return null;
              return (
                <button
                  key={favName}
                  onClick={() => setSelectedTool(tool)}
                  className="px-3 py-1.5 bg-yellow-600/20 border border-yellow-600/30 rounded-lg text-yellow-300 text-sm hover:bg-yellow-600/30 transition-colors"
                >
                  {tool.displayName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tools Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
        {filteredTools.map((tool) => {
          const isFavorite = favorites.includes(tool.name);
          
          if (viewMode === 'list') {
            return (
              <div
                key={tool.name}
                onClick={() => setSelectedTool(tool)}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-blue-500 cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    {React.createElement(getIcon(MCP_CATEGORIES.find(c => c.id === tool.category)?.icon || 'Box'), { className: 'w-5 h-5 text-blue-400' })}
                  </div>
                  <div>
                    <p className="text-white font-medium">{tool.displayName}</p>
                    <p className="text-gray-400 text-sm">{tool.description}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(tool.name); }}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {isFavorite ? <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /> : <StarOff className="w-5 h-5 text-gray-500" />}
                </button>
              </div>
            );
          }

          return (
            <div
              key={tool.name}
              onClick={() => setSelectedTool(tool)}
              className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-blue-500 cursor-pointer transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  {React.createElement(getIcon(MCP_CATEGORIES.find(c => c.id === tool.category)?.icon || 'Box'), { className: 'w-5 h-5 text-blue-400 group-hover:text-white' })}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(tool.name); }}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  {isFavorite ? <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> : <StarOff className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100" />}
                </button>
              </div>
              <h4 className="text-white font-medium text-sm mb-1">{tool.displayName}</h4>
              <p className="text-gray-400 text-xs line-clamp-2">{tool.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {tool.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-400">{tag}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No tools found matching your search</p>
        </div>
      )}

      {/* Tool Detail Modal */}
      {selectedTool && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  {React.createElement(getIcon(MCP_CATEGORIES.find(c => c.id === selectedTool.category)?.icon || 'Box'), { className: 'w-6 h-6 text-white' })}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedTool.displayName}</h3>
                  <p className="text-gray-400 text-sm">{selectedTool.name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTool(null)} className="p-2 hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-gray-300">{selectedTool.description}</p>
              
              {/* Parameters */}
              {selectedTool.parameters.length > 0 && (
                <div>
                  <h4 className="text-white font-medium mb-3">Parameters</h4>
                  <div className="space-y-3">
                    {selectedTool.parameters.map((param) => (
                      <div key={param.name} className="bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white font-medium">{param.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-gray-700 rounded">{param.type}</span>
                            {param.required && <span className="text-xs px-2 py-0.5 bg-red-600 rounded">required</span>}
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm">{param.description}</p>
                        <input
                          type={param.type === 'number' ? 'number' : param.type === 'boolean' ? 'checkbox' : 'text'}
                          placeholder={param.default !== undefined ? String(param.default) : `Enter ${param.name}`}
                          value={toolParams[param.name] || ''}
                          onChange={(e) => setToolParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                          className="mt-2 w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <button
                onClick={() => {
                  executeTool(selectedTool.name, toolParams);
                  setSelectedTool(null);
                  setToolParams({});
                }}
                disabled={!connectionStatus.connected || isExecuting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                Execute Tool
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // AI Commands Tab
  const renderAiCommands = () => (
    <div className="space-y-6">
      {/* AI Command Input */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-700/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Command Interface</h2>
            <p className="text-gray-400">Describe what you want to do in natural language</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={aiCommand}
            onChange={(e) => setAiCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                processAiCommand();
              }
            }}
            placeholder="e.g., 'Spawn 10 cubes in a circle pattern at the center of the level'"
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
            rows={3}
          />
          <button
            onClick={processAiCommand}
            disabled={!aiCommand.trim() || isAiProcessing || !connectionStatus.connected}
            className="absolute bottom-3 right-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Execute
          </button>
        </div>

        {!connectionStatus.connected && (
          <p className="text-yellow-400 text-sm mt-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Connect to UE5 to use AI commands
          </p>
        )}
      </div>

      {/* AI Response */}
      {aiResponse && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Response
          </h3>
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-gray-300 whitespace-pre-wrap">{aiResponse}</p>
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Command className="w-5 h-5 text-blue-400" />
          Command Suggestions
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          {aiSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setAiCommand(suggestion)}
              className="p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg text-left transition-colors"
            >
              <p className="text-white text-sm">{suggestion}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-green-400" />
            Execution History
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {executionHistory.map((exec) => (
              <div
                key={exec.id}
                className={`p-4 rounded-lg border ${exec.success ? 'bg-green-900/20 border-green-700/50' : 'bg-red-900/20 border-red-700/50'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {exec.success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-white font-medium">{exec.tool}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{exec.duration}ms</span>
                    <span>{exec.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
                {Object.keys(exec.params).length > 0 && (
                  <div className="text-xs text-gray-400 mb-2">
                    Params: {JSON.stringify(exec.params)}
                  </div>
                )}
                {exec.error && <p className="text-red-400 text-sm">{exec.error}</p>}
                {exec.result && (
                  <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2 mt-2 overflow-x-auto">
                    {JSON.stringify(exec.result, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Setup Guide Tab
  const renderSetupGuide = () => (
    <div className="space-y-6">
      {/* Agent Installation */}
      <CollapsibleSection title="Desktop Agent Installation" icon={Monitor} defaultOpen badge="Step 1">
        <div className="space-y-6">
          <CollapsibleSection title="Windows Installation" icon={Monitor} defaultOpen>
            <div className="space-y-4">
              <Step number={1} title="Download and Extract">
                <p>Download the ZIP file and extract it to a folder of your choice (e.g., <code className="bg-gray-800 px-2 py-1 rounded">C:\UE5-AI-Studio-Agent</code>)</p>
              </Step>
              <Step number={2} title="Install Dependencies">
                <p>Open Command Prompt in the extracted folder and run:</p>
                <CodeBlock code="npm install" />
              </Step>
              <Step number={3} title="Configure Connection">
                <p>Edit the <code className="bg-gray-800 px-2 py-1 rounded">config.json</code> file:</p>
                <CodeBlock code={`{
  "platformUrl": "https://your-ue5-ai-studio-url.com",
  "mcpPort": 3000,
  "autoConnect": true
}`} />
              </Step>
              <Step number={4} title="Start the Agent">
                <CodeBlock code="npm start" />
              </Step>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="macOS Installation" icon={Monitor}>
            <div className="space-y-4">
              <Step number={1} title="Download and Extract">
                <CodeBlock code="unzip UE5-AI-Studio-Agent-1.1.0.zip -d ~/Applications/UE5-AI-Studio-Agent" />
              </Step>
              <Step number={2} title="Install and Run">
                <CodeBlock code={`cd ~/Applications/UE5-AI-Studio-Agent
npm install
npm start`} />
              </Step>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Linux Installation" icon={Terminal}>
            <div className="space-y-4">
              <Step number={1} title="Download, Extract, and Run">
                <CodeBlock code={`unzip UE5-AI-Studio-Agent-1.1.0.zip -d ~/ue5-ai-agent
cd ~/ue5-ai-agent
npm install
npm start`} />
              </Step>
            </div>
          </CollapsibleSection>
        </div>
      </CollapsibleSection>

      {/* Plugin Installation */}
      <CollapsibleSection title="MCP Bridge Plugin Installation" icon={Plug} badge="Step 2">
        <div className="space-y-4">
          <Step number={1} title="Download and Extract the Plugin">
            <p>Download the MCP Bridge Plugin ZIP file and extract it.</p>
          </Step>
          <Step number={2} title="Copy to Your Project">
            <p>Copy the <code className="bg-gray-800 px-2 py-1 rounded">UE5MCPBridge</code> folder to your project's Plugins directory:</p>
            <CodeBlock code={`YourProject/
├── Content/
├── Source/
└── Plugins/
    └── UE5MCPBridge/    <-- Copy here
        ├── Source/
        ├── Resources/
        └── UE5MCPBridge.uplugin`} />
          </Step>
          <Step number={3} title="Regenerate Project Files">
            <p><strong>Windows:</strong> Right-click your .uproject file → "Generate Visual Studio project files"</p>
            <p><strong>macOS:</strong> Right-click your .uproject file → "Generate Xcode project files"</p>
          </Step>
          <Step number={4} title="Enable the Plugin">
            <p>Open your project in UE5 → Edit → Plugins → Search "MCP Bridge" → Enable → Restart</p>
          </Step>
          <Step number={5} title="Configure MCP Settings">
            <p>Edit → Project Settings → Plugins → MCP Bridge</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>MCP Server Port (default: 3000)</li>
              <li>Auto-start server on editor launch</li>
              <li>Enable/disable specific tool categories</li>
            </ul>
          </Step>
        </div>
      </CollapsibleSection>

      {/* MCP Tools Overview */}
      <CollapsibleSection title="Available MCP Tools (101 Tools)" icon={Wrench} badge="101">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {MCP_CATEGORIES.map((cat) => {
            const count = MCP_TOOLS.filter(t => t.category === cat.id).length;
            return (
              <div key={cat.id} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium text-sm">{cat.name}</span>
                  <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">{count}</span>
                </div>
                <p className="text-gray-400 text-xs">{cat.description}</p>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );

  // Troubleshooting Tab
  const renderTroubleshooting = () => {
    const issues = [
      {
        title: 'Agent cannot connect to the platform',
        solutions: [
          'Verify the platformUrl in config.json is correct',
          'Check if the platform server is running and accessible',
          'Ensure your firewall allows outbound connections',
          'Try disabling VPN if you\'re using one',
        ],
      },
      {
        title: 'MCP Bridge plugin not appearing in UE5',
        solutions: [
          'Ensure the plugin is in the correct Plugins folder',
          'Regenerate project files after adding the plugin',
          'Check the Output Log for any plugin loading errors',
          'Verify you\'re using a compatible UE5 version (5.1-5.7)',
        ],
      },
      {
        title: 'Agent shows "Connection Lost" frequently',
        solutions: [
          'Check your internet connection stability',
          'Increase the reconnection timeout in config.json',
          'Enable "autoReconnect" option in settings',
          'Check if the platform server has rate limiting enabled',
        ],
      },
      {
        title: 'MCP tools not executing in UE5',
        solutions: [
          'Ensure the MCP server is running (check status in plugin settings)',
          'Verify the agent is connected to both platform and UE5',
          'Check if the specific tool category is enabled',
          'Look for error messages in the UE5 Output Log',
        ],
      },
      {
        title: 'Plugin compilation errors',
        solutions: [
          'Ensure you have the correct Visual Studio/Xcode version installed',
          'Clean and rebuild the project',
          'Check if all plugin dependencies are present',
          'Verify your project is a C++ project (not Blueprint-only)',
        ],
      },
    ];

    return (
      <div className="space-y-6">
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="w-8 h-8 text-yellow-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Troubleshooting Guide</h2>
              <p className="text-gray-400">Common issues and their solutions</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {issues.map((issue, index) => (
            <CollapsibleSection key={index} title={issue.title} icon={AlertTriangle}>
              <ul className="space-y-2">
                {issue.solutions.map((solution, sIndex) => (
                  <li key={sIndex} className="flex items-start gap-2 text-gray-300 text-sm">
                    <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>{solution}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          ))}
        </div>

        {/* Additional Resources */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Additional Resources
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <a
              href="https://github.com/mtc-jordan/UE5_AGENT"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FileCode className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-white font-medium">GitHub Repository</div>
                <div className="text-gray-400 text-sm">Source code & issues</div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
            </a>
            <a
              href="https://docs.unrealengine.com/5.0/en-US/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <BookOpen className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-white font-medium">UE5 Documentation</div>
                <div className="text-gray-400 text-sm">Official Unreal docs</div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
            </a>
            <a
              href="#"
              className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-white font-medium">Support</div>
                <div className="text-gray-400 text-sm">Get help from our team</div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
                <Plug className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">UE5 Connection Hub</h1>
                <p className="text-gray-400">Comprehensive UE5 integration center</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge status={isConnecting ? 'connecting' : connectionStatus.connected ? 'connected' : 'disconnected'} />
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'downloads' && renderDownloads()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'ai' && renderAiCommands()}
        {activeTab === 'setup' && renderSetupGuide()}
        {activeTab === 'troubleshoot' && renderTroubleshooting()}
      </div>
    </div>
  );
}
