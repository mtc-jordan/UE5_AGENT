/**
 * UE5 Connection Hub - Comprehensive UE5 Integration Center
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    UE5 AI Studio Cloud                          │
 * │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
 * │  │   Web UI    │───▶│   Backend   │◀──▶│  Agent Relay        │ │
 * │  │  (React)    │    │  (FastAPI)  │    │  (WebSocket Server) │ │
 * │  └─────────────┘    └─────────────┘    └──────────┬──────────┘ │  
 * └──────────────────────────────────────────────────│─────────────┘
 *                                                     │
 *                                                     │ WebSocket (JWT Auth)
 *                                                     ▼
 *                               UE5 AI Studio Agent (Electron)
 *                                                     │
 *                                                     │ TCP (JSON-RPC)
 *                                                     ▼
 *                               UE5 MCP Server Plugin (Port 55557)
 * 
 * Supports: Unreal Engine 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wifi, WifiOff, RefreshCw, Settings, Play, Square, Search,
  ChevronRight, ChevronDown, Box, Camera, Map, FolderOpen,
  GitBranch, Palette, Zap, Film, Volume2, Mountain, Puzzle,
  MousePointer, Terminal, Star, StarOff, CheckCircle,
  XCircle, AlertCircle, Send, Loader2, Copy,
  LayoutGrid, List, Key, Trash2, Plus, Eye, EyeOff,
  Activity, Monitor, Save, Undo, Redo, X, Clock,
  ArrowRight, Sparkles, History, BookOpen, Command,
  Download, Package, Plug, Shield, ExternalLink, Check,
  FileCode, HelpCircle, AlertTriangle, Server, Link2,
  Globe, Power, PowerOff, Cloud, CloudOff, Cpu,
  Gauge, Layers, Wrench, Target, Crosshair
} from 'lucide-react';
import { MCP_TOOLS, MCP_CATEGORIES, QUICK_ACTIONS, MCPTool } from '../data/mcpTools';

// ==================== TYPES ====================

interface AgentStatus {
  connected: boolean;
  connection_id?: string;
  connected_at?: string;
  agent_version?: string;
  agent_platform?: string;
  agent_hostname?: string;
  mcp_connected: boolean;
  mcp_host?: string;
  mcp_project_name?: string;
  mcp_engine_version?: string;
  mcp_tools_count: number;
  commands_executed: number;
  last_command_at?: string;
}

interface AgentToken {
  id: number;
  name: string;
  token_prefix: string;
  description?: string;
  is_active: boolean;
  is_revoked: boolean;
  last_used_at?: string;
  last_ip?: string;
  expires_at?: string;
  created_at: string;
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
  ue_versions?: string[];
}

// ==================== CONSTANTS ====================

const UE5_VERSIONS = ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'];

const TABS = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'tokens', label: 'Agent Tokens', icon: Key },
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

function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

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

// Connection Status Badge with dual status
function ConnectionStatusBadge({ 
  cloudConnected, 
  mcpConnected 
}: { 
  cloudConnected: boolean; 
  mcpConnected: boolean;
}) {
  if (cloudConnected && mcpConnected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 text-white font-medium text-sm">
        <CheckCircle className="w-4 h-4" />
        Fully Connected
      </span>
    );
  } else if (cloudConnected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500 text-white font-medium text-sm">
        <AlertCircle className="w-4 h-4" />
        Agent Connected (No MCP)
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-500 text-white font-medium text-sm">
        <WifiOff className="w-4 h-4" />
        Disconnected
      </span>
    );
  }
}

// ==================== MAIN COMPONENT ====================

export default function UE5Connection() {
  // Agent connection state
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    connected: false,
    mcp_connected: false,
    mcp_tools_count: 0,
    commands_executed: 0
  });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Token management state
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenDescription, setNewTokenDescription] = useState('');
  const [newTokenExpiresDays, setNewTokenExpiresDays] = useState<number | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);

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

  const resultRef = useRef<HTMLDivElement>(null);
  const statusPollRef = useRef<NodeJS.Timeout | null>(null);

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

  // Load initial data
  useEffect(() => {
    loadAgentStatus();
    loadDownloads();
    loadTokens();

    // Poll agent status every 5 seconds
    statusPollRef.current = setInterval(loadAgentStatus, 5000);

    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
      }
    };
  }, []);

  // ==================== API FUNCTIONS ====================

  const loadAgentStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAgentStatus(data);
        setStatusError(null);
      } else if (response.status === 401) {
        setStatusError('Authentication required');
      }
    } catch (error) {
      console.error('Failed to load agent status:', error);
      setStatusError('Failed to connect to server');
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const loadTokens = async () => {
    try {
      setIsLoadingTokens(true);
      const response = await fetch('/api/agent/tokens', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTokens(data);
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const createToken = async () => {
    if (!newTokenName.trim()) return;

    try {
      setIsCreatingToken(true);
      const response = await fetch('/api/agent/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newTokenName,
          description: newTokenDescription || null,
          expires_days: newTokenExpiresDays
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedToken(data.token);
        setNewTokenName('');
        setNewTokenDescription('');
        setNewTokenExpiresDays(null);
        loadTokens();
      }
    } catch (error) {
      console.error('Failed to create token:', error);
    } finally {
      setIsCreatingToken(false);
    }
  };

  const revokeToken = async (tokenId: number) => {
    if (!confirm('Are you sure you want to revoke this token? Any agent using it will be disconnected.')) {
      return;
    }

    try {
      const response = await fetch(`/api/agent/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        loadTokens();
        loadAgentStatus();
      }
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }
  };

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

  // Execute a tool through the agent
  const executeTool = async (toolName: string, params: Record<string, any>) => {
    if (!agentStatus.connected || !agentStatus.mcp_connected) {
      alert('Agent must be connected to UE5 to execute tools');
      return;
    }

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tool_name: toolName,
          parameters: params,
          timeout: 30
        })
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      const result: ExecutionResult = {
        id: crypto.randomUUID(),
        tool: toolName,
        params,
        result: data.result,
        success: data.success,
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
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

  // Overview Tab with Architecture Diagram
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Connection Architecture Diagram */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-400" />
          Connection Architecture
        </h3>
        
        <div className="flex flex-col lg:flex-row items-center justify-center gap-4 py-6">
          {/* Cloud Section */}
          <div className="flex flex-col items-center">
            <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center ${
              true ? 'bg-blue-600' : 'bg-gray-700'
            }`}>
              <Cloud className="w-10 h-10 text-white mb-1" />
              <span className="text-xs text-white/80">Cloud</span>
            </div>
            <span className="text-sm text-gray-400 mt-2">UE5 AI Studio</span>
          </div>

          {/* Arrow 1 */}
          <div className="flex flex-col items-center">
            <div className={`w-20 h-1 ${agentStatus.connected ? 'bg-green-500' : 'bg-gray-600'}`}></div>
            <span className={`text-xs mt-1 ${agentStatus.connected ? 'text-green-400' : 'text-gray-500'}`}>
              {agentStatus.connected ? 'WebSocket ✓' : 'WebSocket'}
            </span>
          </div>

          {/* Agent Section */}
          <div className="flex flex-col items-center">
            <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center ${
              agentStatus.connected ? 'bg-green-600' : 'bg-gray-700'
            }`}>
              <Cpu className="w-10 h-10 text-white mb-1" />
              <span className="text-xs text-white/80">Agent</span>
            </div>
            <span className="text-sm text-gray-400 mt-2">
              {agentStatus.agent_hostname || 'Desktop Agent'}
            </span>
            {agentStatus.agent_version && (
              <span className="text-xs text-gray-500">v{agentStatus.agent_version}</span>
            )}
          </div>

          {/* Arrow 2 */}
          <div className="flex flex-col items-center">
            <div className={`w-20 h-1 ${agentStatus.mcp_connected ? 'bg-green-500' : 'bg-gray-600'}`}></div>
            <span className={`text-xs mt-1 ${agentStatus.mcp_connected ? 'text-green-400' : 'text-gray-500'}`}>
              {agentStatus.mcp_connected ? 'MCP ✓' : 'MCP'}
            </span>
          </div>

          {/* UE5 Section */}
          <div className="flex flex-col items-center">
            <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center ${
              agentStatus.mcp_connected ? 'bg-purple-600' : 'bg-gray-700'
            }`}>
              <Box className="w-10 h-10 text-white mb-1" />
              <span className="text-xs text-white/80">UE5</span>
            </div>
            <span className="text-sm text-gray-400 mt-2">
              {agentStatus.mcp_project_name || 'Unreal Engine'}
            </span>
            {agentStatus.mcp_engine_version && (
              <span className="text-xs text-gray-500">v{agentStatus.mcp_engine_version}</span>
            )}
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex justify-center mt-4">
          <ConnectionStatusBadge 
            cloudConnected={agentStatus.connected} 
            mcpConnected={agentStatus.mcp_connected} 
          />
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cloud Connection */}
        <div className={`rounded-xl p-4 border ${
          agentStatus.connected 
            ? 'bg-green-900/20 border-green-700/50' 
            : 'bg-gray-800/50 border-gray-700'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              agentStatus.connected ? 'bg-green-600' : 'bg-gray-700'
            }`}>
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-white">Cloud Connection</h4>
              <p className={`text-sm ${agentStatus.connected ? 'text-green-400' : 'text-gray-500'}`}>
                {agentStatus.connected ? 'Agent Online' : 'Agent Offline'}
              </p>
            </div>
          </div>
          {agentStatus.connected && agentStatus.connected_at && (
            <p className="text-xs text-gray-500">
              Connected: {new Date(agentStatus.connected_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* MCP Connection */}
        <div className={`rounded-xl p-4 border ${
          agentStatus.mcp_connected 
            ? 'bg-purple-900/20 border-purple-700/50' 
            : 'bg-gray-800/50 border-gray-700'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              agentStatus.mcp_connected ? 'bg-purple-600' : 'bg-gray-700'
            }`}>
              <Plug className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-white">MCP Bridge</h4>
              <p className={`text-sm ${agentStatus.mcp_connected ? 'text-purple-400' : 'text-gray-500'}`}>
                {agentStatus.mcp_connected ? `${agentStatus.mcp_host || 'Connected'}` : 'Not Connected'}
              </p>
            </div>
          </div>
          {agentStatus.mcp_connected && (
            <p className="text-xs text-gray-500">
              {agentStatus.mcp_tools_count} tools available
            </p>
          )}
        </div>

        {/* Commands Executed */}
        <div className="rounded-xl p-4 border bg-gray-800/50 border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-600">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-white">Commands</h4>
              <p className="text-2xl font-bold text-blue-400">{agentStatus.commands_executed}</p>
            </div>
          </div>
          {agentStatus.last_command_at && (
            <p className="text-xs text-gray-500">
              Last: {new Date(agentStatus.last_command_at).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* MCP Tools */}
        <div className="rounded-xl p-4 border bg-gray-800/50 border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-600">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-white">MCP Tools</h4>
              <p className="text-2xl font-bold text-orange-400">101</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">15 categories</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.name}
              onClick={() => executeTool(action.name, action.params || {})}
              disabled={!agentStatus.mcp_connected || isExecuting}
              className={`p-4 rounded-lg border text-left transition-all ${
                agentStatus.mcp_connected
                  ? 'bg-gray-800/50 border-gray-600 hover:border-blue-500 hover:bg-gray-800'
                  : 'bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed'
              }`}
            >
              <h4 className="font-medium text-white text-sm">{action.displayName}</h4>
              <p className="text-xs text-gray-500 mt-1">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      {!agentStatus.connected && (
        <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Getting Started
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">1</div>
              <div>
                <h4 className="font-medium text-white">Create Token</h4>
                <p className="text-sm text-gray-400">Generate an agent token in the Tokens tab</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">2</div>
              <div>
                <h4 className="font-medium text-white">Download Agent</h4>
                <p className="text-sm text-gray-400">Get the desktop agent from Downloads</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">3</div>
              <div>
                <h4 className="font-medium text-white">Install Plugin</h4>
                <p className="text-sm text-gray-400">Add MCP Bridge to your UE5 project</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">4</div>
              <div>
                <h4 className="font-medium text-white">Connect!</h4>
                <p className="text-sm text-gray-400">Run agent and start controlling UE5</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Tokens Tab
  const renderTokens = () => (
    <div className="space-y-6">
      {/* Create Token Section */}
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-400" />
            Agent Tokens
          </h3>
          <button
            onClick={() => setShowCreateToken(!showCreateToken)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Token
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Generate tokens to authenticate your desktop agent with the cloud platform. Each token can be used by one agent at a time.
        </p>

        {/* Create Token Form */}
        {showCreateToken && (
          <div className="bg-gray-900/50 rounded-lg p-4 mb-6 border border-gray-600">
            <h4 className="font-medium text-white mb-4">New Agent Token</h4>
            
            {createdToken ? (
              <div className="space-y-4">
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Token Created Successfully!</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Copy this token now. It won't be shown again!
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={createdToken}
                      readOnly
                      className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono text-gray-300"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdToken);
                      }}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCreatedToken(null);
                    setShowCreateToken(false);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Token Name *</label>
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g., Home PC, Work Laptop"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={newTokenDescription}
                    onChange={(e) => setNewTokenDescription(e.target.value)}
                    placeholder="e.g., Main development machine"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Expiration (optional)</label>
                  <select
                    value={newTokenExpiresDays || ''}
                    onChange={(e) => setNewTokenExpiresDays(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Never expires</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={createToken}
                    disabled={!newTokenName.trim() || isCreatingToken}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
                  >
                    {isCreatingToken ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Create Token
                  </button>
                  <button
                    onClick={() => setShowCreateToken(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Token List */}
        <div className="space-y-3">
          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tokens created yet</p>
              <p className="text-sm">Create a token to connect your desktop agent</p>
            </div>
          ) : (
            tokens.map((token) => (
              <div
                key={token.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  token.is_revoked
                    ? 'bg-red-900/10 border-red-800/50'
                    : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    token.is_revoked ? 'bg-red-900/50' : 'bg-gray-700'
                  }`}>
                    <Key className={`w-5 h-5 ${token.is_revoked ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{token.name}</h4>
                      {token.is_revoked && (
                        <span className="px-2 py-0.5 text-xs bg-red-600 rounded-full">Revoked</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {token.token_prefix}... • Created {new Date(token.created_at).toLocaleDateString()}
                    </p>
                    {token.last_used_at && (
                      <p className="text-xs text-gray-600">
                        Last used: {new Date(token.last_used_at).toLocaleString()}
                        {token.last_ip && ` from ${token.last_ip}`}
                      </p>
                    )}
                  </div>
                </div>
                {!token.is_revoked && (
                  <button
                    onClick={() => revokeToken(token.id)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 rounded-lg text-red-400 text-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-700/50">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-400">Security Best Practices</h4>
            <ul className="text-sm text-gray-400 mt-2 space-y-1">
              <li>• Create separate tokens for each machine/agent</li>
              <li>• Revoke tokens immediately if compromised</li>
              <li>• Use expiration dates for temporary access</li>
              <li>• Never share tokens or commit them to version control</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  // Downloads Tab
  const renderDownloads = () => (
    <div className="space-y-6">
      {/* Quick Start Workflow */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-2xl p-6 border border-blue-700/30">
        <div className="flex items-center gap-3 mb-6">
          <Download className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-xl font-bold text-white">Downloads & Installation</h3>
            <p className="text-gray-400">Get the tools you need to connect UE5 AI Studio to your editor</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 py-4">
          {[
            { num: 1, label: 'Download', sub: 'Get Agent & Plugin' },
            { num: 2, label: 'Install Plugin', sub: 'Add to UE5 project' },
            { num: 3, label: 'Run Agent', sub: 'Start desktop app' },
            { num: 4, label: 'Connect', sub: 'Control UE5 with AI!' },
          ].map((step, i) => (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                  step.num === 4 ? 'bg-green-600' : 'bg-blue-600'
                }`}>
                  {step.num}
                </div>
                <span className="text-white font-medium mt-2">{step.label}</span>
                <span className="text-gray-500 text-xs">{step.sub}</span>
              </div>
              {i < 3 && <ArrowRight className="w-6 h-6 text-gray-600 hidden md:block" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
          <h4 className="font-medium text-white mb-3 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            Desktop Agent Requirements
          </h4>
          <ul className="text-sm text-gray-400 space-y-1">
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> OS: Windows 10/11, macOS 10.15+, Ubuntu 20.04+</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> RAM: 4GB minimum, 8GB recommended</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Storage: 200MB free space</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Network: Internet connection required</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Dependencies: Node.js 18+ (bundled)</li>
          </ul>
        </div>
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
          <h4 className="font-medium text-white mb-3 flex items-center gap-2">
            <Plug className="w-4 h-4 text-purple-400" />
            MCP Bridge Plugin Requirements
          </h4>
          <ul className="text-sm text-gray-400 space-y-1">
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Engine: Unreal Engine 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> OS: Windows 10/11 or macOS 12+</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Visual Studio: 2019 or 2022 (Windows)</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Xcode: 14+ (macOS)</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Project Type: C++ or Blueprint (with C++ enabled)</li>
          </ul>
        </div>
      </div>

      {/* Download Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-green-400" />
            Available Downloads
          </h3>
          <button
            onClick={loadDownloads}
            disabled={loadingDownloads}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDownloads ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {downloads.map((item) => (
            <div
              key={item.filename}
              className={`rounded-xl p-5 border ${
                item.category === 'agent'
                  ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-700/50'
                  : 'bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-700/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  item.category === 'agent' ? 'bg-blue-600' : 'bg-purple-600'
                }`}>
                  {item.category === 'agent' ? (
                    <Cpu className="w-6 h-6 text-white" />
                  ) : (
                    <Plug className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-white">{item.name}</h4>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      item.category === 'agent' ? 'bg-blue-600' : 'bg-purple-600'
                    }`}>
                      Version {item.version}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{item.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Size: {item.size}
                    </span>
                    <span>{item.platform.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.available ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Available for download
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <AlertCircle className="w-3 h-3" />
                        Coming soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDownload(item)}
                disabled={!item.available || downloading === item.filename}
                className={`w-full mt-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  item.available
                    ? item.category === 'agent'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {downloading === item.filename ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download {item.category === 'agent' ? 'Agent' : 'Plugin'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Supported UE Versions */}
      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-orange-400" />
          Supported Unreal Engine Versions
        </h4>
        <div className="flex flex-wrap gap-2">
          {UE5_VERSIONS.map((version) => (
            <span
              key={version}
              className="px-3 py-1.5 bg-orange-600/20 border border-orange-600/50 rounded-lg text-orange-400 text-sm font-medium"
            >
              UE {version}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          The MCP Bridge plugin is compatible with all listed versions. For best results, use the latest stable release of Unreal Engine.
        </p>
      </div>
    </div>
  );

  // MCP Tools Tab
  const renderTools = () => (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 101 MCP tools..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 rounded-lg ${viewMode === 'grid' ? 'bg-blue-600' : 'bg-gray-800'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-lg ${viewMode === 'list' ? 'bg-blue-600' : 'bg-gray-800'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All ({MCP_TOOLS.length})
        </button>
        {MCP_CATEGORIES.map((cat) => {
          const count = MCP_TOOLS.filter(t => t.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Tools Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' : 'space-y-2'}>
        {filteredTools.map((tool) => (
          <div
            key={tool.name}
            onClick={() => setSelectedTool(tool)}
            className={`cursor-pointer transition-all ${
              viewMode === 'grid'
                ? 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg p-4'
                : 'bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg p-3 flex items-center gap-4'
            }`}
          >
            <div className={viewMode === 'grid' ? '' : 'flex-1'}>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-white text-sm">{tool.displayName}</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(tool.name);
                  }}
                  className="opacity-50 hover:opacity-100"
                >
                  {favorites.includes(tool.name) ? (
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ) : (
                    <StarOff className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{tool.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {tool.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-700 rounded text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tool Detail Modal */}
      {selectedTool && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-gray-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">{selectedTool.displayName}</h3>
                <button
                  onClick={() => setSelectedTool(null)}
                  className="p-2 hover:bg-gray-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-400 mb-6">{selectedTool.description}</p>

              {/* Parameters */}
              {selectedTool.parameters.length > 0 && (
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-white">Parameters</h4>
                  {selectedTool.parameters.map((param) => (
                    <div key={param.name}>
                      <label className="block text-sm text-gray-400 mb-1">
                        {param.name}
                        {param.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={toolParams[param.name] || ''}
                        onChange={(e) => setToolParams(prev => ({
                          ...prev,
                          [param.name]: param.type === 'number' ? parseFloat(e.target.value) : e.target.value
                        }))}
                        placeholder={param.description}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    executeTool(selectedTool.name, toolParams);
                    setSelectedTool(null);
                    setToolParams({});
                  }}
                  disabled={!agentStatus.mcp_connected || isExecuting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium flex items-center justify-center gap-2"
                >
                  {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Execute
                </button>
                <button
                  onClick={() => {
                    setSelectedTool(null);
                    setToolParams({});
                  }}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // AI Commands Tab
  const renderAiCommands = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-2xl p-6 border border-purple-700/30">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-xl font-bold text-white">AI Command Interface</h3>
            <p className="text-gray-400">Describe what you want to do in natural language</p>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={aiCommand}
            onChange={(e) => setAiCommand(e.target.value)}
            placeholder="e.g., 'Spawn 10 cubes in a circle pattern at the center of the level'"
            className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 resize-none focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={processAiCommand}
            disabled={!aiCommand.trim() || isAiProcessing || !agentStatus.mcp_connected}
            className="absolute bottom-3 right-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium flex items-center gap-2"
          >
            {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Execute
          </button>
        </div>

        {!agentStatus.mcp_connected && (
          <p className="text-yellow-400 text-sm mt-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Connect to UE5 to use AI commands
          </p>
        )}
      </div>

      {/* AI Response */}
      {aiResponse && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h4 className="font-medium text-white mb-2">Response</h4>
          <p className="text-gray-400">{aiResponse}</p>
        </div>
      )}

      {/* Command Suggestions */}
      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
          <Command className="w-4 h-4 text-blue-400" />
          Command Suggestions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {aiSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setAiCommand(suggestion)}
              className="text-left p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
          <h4 className="font-medium text-white mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            Recent Executions
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto" ref={resultRef}>
            {executionHistory.slice(0, 10).map((exec) => (
              <div
                key={exec.id}
                className={`p-3 rounded-lg border ${
                  exec.success
                    ? 'bg-green-900/20 border-green-700/50'
                    : 'bg-red-900/20 border-red-700/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white text-sm">{exec.tool}</span>
                  <span className="text-xs text-gray-500">{exec.duration}ms</span>
                </div>
                {exec.error && (
                  <p className="text-xs text-red-400">{exec.error}</p>
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
      <CollapsibleSection title="Desktop Agent Installation" icon={Monitor} defaultOpen badge="Step 1">
        <CollapsibleSection title="Windows Installation" icon={Monitor} defaultOpen>
          <Step number={1} title="Download and Extract">
            <p>Download the ZIP file and extract it to a folder of your choice (e.g., <code className="bg-gray-800 px-1 rounded">C:\UE5-AI-Studio-Agent</code>)</p>
          </Step>
          <Step number={2} title="Install Dependencies">
            <p>Open Command Prompt in the extracted folder and run:</p>
            <CodeBlock code="npm install" />
          </Step>
          <Step number={3} title="Configure Connection">
            <p>Edit the <code className="bg-gray-800 px-1 rounded">config.json</code> file:</p>
            <CodeBlock code={`{
  "platformUrl": "https://your-ue5-ai-studio-url.com",
  "token": "YOUR_AGENT_TOKEN_HERE",
  "mcpPort": 55557,
  "autoConnect": true
}`} />
          </Step>
          <Step number={4} title="Start the Agent">
            <CodeBlock code="npm start" />
          </Step>
        </CollapsibleSection>

        <CollapsibleSection title="macOS Installation" icon={Monitor}>
          <Step number={1} title="Download and Extract">
            <p>Download the ZIP file and extract it to your Applications folder or preferred location</p>
          </Step>
          <Step number={2} title="Install Dependencies">
            <p>Open Terminal in the extracted folder and run:</p>
            <CodeBlock code="npm install" />
          </Step>
          <Step number={3} title="Configure and Start">
            <p>Edit config.json with your token, then run:</p>
            <CodeBlock code="npm start" />
          </Step>
        </CollapsibleSection>

        <CollapsibleSection title="Linux Installation" icon={Terminal}>
          <Step number={1} title="Download and Extract">
            <CodeBlock code={`wget https://your-platform/downloads/agent.zip
unzip agent.zip -d ~/ue5-ai-agent
cd ~/ue5-ai-agent`} />
          </Step>
          <Step number={2} title="Install and Run">
            <CodeBlock code={`npm install
npm start`} />
          </Step>
        </CollapsibleSection>
      </CollapsibleSection>

      <CollapsibleSection title="MCP Bridge Plugin Installation" icon={Plug} badge="Step 2">
        <Step number={1} title="Extract Plugin">
          <p>Extract the plugin ZIP to your project's Plugins folder:</p>
          <CodeBlock code={`YourProject/
├── Content/
├── Source/
└── Plugins/
    └── UE5MCPBridge/
        ├── Source/
        ├── Resources/
        └── UE5MCPBridge.uplugin`} />
        </Step>
        <Step number={2} title="Regenerate Project Files">
          <p>Right-click your .uproject file and select "Generate Visual Studio project files"</p>
        </Step>
        <Step number={3} title="Build and Enable">
          <p>Open your project in UE5. The plugin should appear in Edit → Plugins. Enable it and restart the editor.</p>
        </Step>
        <Step number={4} title="Verify Connection">
          <p>The MCP server starts automatically on port 55557. Check the Output Log for "MCP Server started on port 55557"</p>
        </Step>
      </CollapsibleSection>

      <CollapsibleSection title="Available MCP Tools (101 Tools)" icon={Wrench} badge="101">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {MCP_CATEGORIES.map((cat) => {
            const count = MCP_TOOLS.filter(t => t.category === cat.id).length;
            return (
              <div key={cat.id} className="bg-gray-800/50 rounded-lg p-3 text-center">
                <span className="text-2xl font-bold text-blue-400">{count}</span>
                <p className="text-xs text-gray-400 mt-1">{cat.name}</p>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );

  // Troubleshooting Tab
  const renderTroubleshooting = () => (
    <div className="space-y-6">
      <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-xl font-bold text-white">Troubleshooting Guide</h3>
            <p className="text-gray-400">Common issues and their solutions</p>
          </div>
        </div>

        <div className="space-y-3">
          <CollapsibleSection title="Agent cannot connect to the platform" icon={AlertTriangle}>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Verify your agent token is valid and not expired</li>
              <li>• Check that the platform URL in config.json is correct</li>
              <li>• Ensure your firewall allows outbound WebSocket connections</li>
              <li>• Try regenerating a new token from the Tokens tab</li>
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="MCP Bridge plugin not appearing in UE5" icon={AlertTriangle}>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Verify the plugin is in the correct Plugins folder</li>
              <li>• Regenerate project files after adding the plugin</li>
              <li>• Check the Output Log for compilation errors</li>
              <li>• Ensure your UE5 version is supported (5.1-5.7)</li>
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="Agent shows 'Connection Lost' frequently" icon={AlertTriangle}>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Check your internet connection stability</li>
              <li>• Verify no VPN or proxy is interfering</li>
              <li>• The agent will automatically reconnect</li>
              <li>• Check server status at the platform dashboard</li>
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="MCP tools not executing in UE5" icon={AlertTriangle}>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Verify the MCP server is running (check Output Log)</li>
              <li>• Ensure the agent is connected to MCP (green status)</li>
              <li>• Check that port 55557 is not blocked</li>
              <li>• Restart the UE5 editor if the plugin becomes unresponsive</li>
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="Plugin compilation errors" icon={AlertTriangle}>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Ensure Visual Studio 2019/2022 is installed (Windows)</li>
              <li>• Verify Xcode 14+ is installed (macOS)</li>
              <li>• Check that your project has C++ enabled</li>
              <li>• Try cleaning and rebuilding the project</li>
            </ul>
          </CollapsibleSection>
        </div>
      </div>

      {/* Additional Resources */}
      <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-400" />
          Additional Resources
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="https://github.com/mtc-jordan/UE5_AGENT"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700 transition-colors"
          >
            <GitBranch className="w-5 h-5 text-gray-400" />
            <div>
              <span className="text-white font-medium">GitHub Repository</span>
              <p className="text-xs text-gray-500">Source code & issues</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
          </a>
          <a
            href="https://docs.unrealengine.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-gray-400" />
            <div>
              <span className="text-white font-medium">UE5 Documentation</span>
              <p className="text-xs text-gray-500">Official Unreal docs</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
          </a>
          <a
            href="#"
            className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700 transition-colors"
          >
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <div>
              <span className="text-white font-medium">Support</span>
              <p className="text-xs text-gray-500">Get help from our team</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
          </a>
        </div>
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Plug className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">UE5 Connection Hub</h1>
              <p className="text-gray-400 text-sm">Comprehensive UE5 integration center</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatusBadge 
              cloudConnected={agentStatus.connected} 
              mcpConnected={agentStatus.mcp_connected} 
            />
            <button
              onClick={loadAgentStatus}
              className="p-2 hover:bg-gray-700 rounded-lg"
              title="Refresh status"
            >
              <RefreshCw className={`w-5 h-5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 px-6">
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
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tokens' && renderTokens()}
        {activeTab === 'downloads' && renderDownloads()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'ai' && renderAiCommands()}
        {activeTab === 'setup' && renderSetupGuide()}
        {activeTab === 'troubleshoot' && renderTroubleshooting()}
      </div>
    </div>
  );
}
