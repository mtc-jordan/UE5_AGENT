/**
 * UE5 Connection Hub - Premium UI/UX Design
 * 
 * Features:
 * - Glassmorphism design with blur effects
 * - Smooth animations and micro-interactions
 * - Gradient accents and glow effects
 * - Real-time connection visualization
 * - Responsive and accessible design
 * 
 * Supports: Unreal Engine 5.1 - 5.7
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../lib/store';
import {
  WifiOff, RefreshCw, Settings, Play, Square, Search,
  ChevronDown, Box, Camera, Map, FolderOpen,
  GitBranch, Palette, Zap, Film, Volume2, Mountain, Puzzle,
  MousePointer, Terminal, Star, StarOff, CheckCircle,
  XCircle, Loader2, Copy,
  LayoutGrid, List, Key, Trash2, Plus, Eye, EyeOff,
  Monitor, Save, Undo, Redo, X,
  ArrowRight, Sparkles, History, BookOpen,
  Download, Package, Plug, Shield, ExternalLink, Check,
  HelpCircle,
  Globe, Cloud, CloudOff, Cpu,
  Gauge, Layers, Wrench, Target, Crosshair,
  Rocket} from 'lucide-react';
import { MCP_TOOLS, MCP_CATEGORIES, QUICK_ACTIONS, MCPTool } from '../data/mcpTools';
import ViewportPreview from '../components/ViewportPreview';
import SceneBuilder from '../components/SceneBuilder';
import ActionTimeline from '../components/ActionTimeline';
import BlueprintMaterialAssistant from '../components/BlueprintMaterialAssistant';
import TextureGenerator from '../components/TextureGenerator';
import EnhancedAIChat from '../components/EnhancedAIChat';
import EnhancedConnectionStatus from '../components/EnhancedConnectionStatus';
import SceneAnalyzer from '../components/SceneAnalyzer';
import SceneQuickActions from '../components/SceneQuickActions';
import PerformanceOptimizer from '../components/PerformanceOptimizer';
import AssetManager from '../components/AssetManager';
import VoiceControl from '../components/VoiceControl';
import LightingWizard from '../components/LightingWizard';
import AnimationAssistant from '../components/AnimationAssistant';
import CollaborationPanel from '../components/CollaborationPanel';
import AISceneGenerator from '../components/AISceneGenerator';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AdvancedAIFeatures from '../components/AdvancedAIFeatures';
import CommandFeedback, { CommandExecution, ExecutionStep } from '../components/CommandFeedback';
import CommandTemplates, { WorkflowStep } from '../components/CommandTemplates';
import ErrorRecovery, { UndoAction, SceneContext } from '../components/ErrorRecovery';
import { ParsedCommand } from '../lib/voiceCommandParser';

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
}

interface Screenshot {
  id: string;
  filename: string;
  timestamp: string;
  width: number;
  height: number;
  file_path: string;
  base64_data?: string;
  context?: string;
  tool_name?: string;
  is_before: boolean;
  paired_screenshot_id?: string;
}

interface BeforeAfterPair {
  id: string;
  before: Screenshot;
  after: Screenshot;
  tool_name: string;
  tool_params: Record<string, any>;
  created_at: string;
}

// ==================== CONSTANTS ====================

const UE5_VERSIONS = ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'];

const TABS = [
  { id: 'overview', label: 'Overview', icon: Gauge, gradient: 'from-blue-500 to-cyan-500' },
  { id: 'tokens', label: 'Tokens', icon: Key, gradient: 'from-amber-500 to-orange-500' },
  { id: 'downloads', label: 'Downloads', icon: Download, gradient: 'from-green-500 to-emerald-500' },
  { id: 'tools', label: 'MCP Tools', icon: Wrench, gradient: 'from-purple-500 to-pink-500' },
  { id: 'ai', label: 'AI Commands', icon: Sparkles, gradient: 'from-violet-500 to-purple-500' },
  { id: 'setup', label: 'Setup', icon: BookOpen, gradient: 'from-sky-500 to-blue-500' },
  { id: 'help', label: 'Help', icon: HelpCircle, gradient: 'from-rose-500 to-red-500' },
] as const;

type TabId = typeof TABS[number]['id'];

// Icon map for dynamic icon rendering (used in MCP tool categories)
const _iconMap: Record<string, React.FC<any>> = {
  Box, Camera, Map, FolderOpen, GitBranch, Palette, Zap, Film,
  Volume2, Mountain, Puzzle, MousePointer, Play, Settings, Save,
  Undo, Redo, X, Square, Layers, Target, Crosshair
};
void _iconMap; // Suppress unused variable warning

// ==================== ANIMATED COMPONENTS ====================

// Animated gradient background
const AnimatedBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-500" />
  </div>
);

// Glowing orb for connection status
const StatusOrb = ({ connected, size = 'md' }: { connected: boolean; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };
  
  return (
    <div className="relative">
      <div className={`${sizeClasses[size]} rounded-full ${connected ? 'bg-green-500' : 'bg-gray-500'}`}>
        {connected && (
          <>
            <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-green-500 animate-ping opacity-75`} />
            <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-green-400 blur-sm`} />
          </>
        )}
      </div>
    </div>
  );
};

// Glass card component
const GlassCard = ({ 
  children, 
  className = '', 
  hover = true,
  glow = false,
  glowColor = 'blue'
}: { 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
  glow?: boolean;
  glowColor?: 'blue' | 'green' | 'purple' | 'amber' | 'red';
}) => {
  const glowColors = {
    blue: 'shadow-blue-500/20',
    green: 'shadow-green-500/20',
    purple: 'shadow-purple-500/20',
    amber: 'shadow-amber-500/20',
    red: 'shadow-red-500/20'
  };

  return (
    <div className={`
      relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl
      ${hover ? 'hover:bg-white/10 hover:border-white/20 transition-all duration-300' : ''}
      ${glow ? `shadow-2xl ${glowColors[glowColor]}` : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

// Animated connection line
const ConnectionLine = ({ active, label }: { active: boolean; label: string }) => (
  <div className="flex flex-col items-center mx-2">
    <div className="relative h-1 w-16 md:w-24 bg-gray-700 rounded-full overflow-hidden">
      {active && (
        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-400">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
    <span className={`text-xs mt-1 ${active ? 'text-green-400' : 'text-gray-500'}`}>
      {label}
    </span>
  </div>
);

// Stat card with animation
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subtext,
  gradient,
  delay: _delay = 0
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  subtext?: string;
  gradient: string;
  delay?: number;
}) => {
  void _delay; // Reserved for future animation delay
  return (
  <GlassCard className="p-5 group" hover>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-400 text-sm mb-1">{label}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </GlassCard>
  );
};

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
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const { copied, copy } = useCopyToClipboard();
  const id = `code-${code.slice(0, 20)}`;
  
  return (
    <div className="relative group">
      <div className="absolute top-2 left-3 text-xs text-gray-500 font-mono">{language}</div>
      <pre className="bg-gray-950/80 backdrop-blur border border-gray-800 rounded-xl p-4 pt-8 overflow-x-auto">
        <code className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{code}</code>
      </pre>
      <button
        onClick={() => copy(code, id)}
        className="absolute top-2 right-2 p-2 bg-gray-800/80 backdrop-blur rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-700"
        title="Copy to clipboard"
      >
        {copied === id ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4 text-gray-400" />
        )}
      </button>
    </div>
  );
}

// Collapsible Section with animation
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
  gradient = 'from-blue-500 to-cyan-500'
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  gradient?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <GlassCard className="overflow-hidden" hover={false}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-white">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs bg-white/10 rounded-full text-gray-300">{badge}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 pt-0 border-t border-white/5">{children}</div>
      </div>
    </GlassCard>
  );
}

// Step Component for guides
function Step({ number, title, children, isLast = false }: { number: number; title: string; children: React.ReactNode; isLast?: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/25">
          {number}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-gradient-to-b from-blue-500/50 to-transparent mt-2" />}
      </div>
      <div className="flex-1 pb-8">
        <h4 className="font-semibold text-white mb-2">{title}</h4>
        <div className="text-gray-400 text-sm space-y-3">{children}</div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function UE5Connection() {
  // Auth state from zustand store
  const { token: authToken } = useAuthStore();

  // Agent connection state
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    connected: false,
    mcp_connected: false,
    mcp_tools_count: 0,
    commands_executed: 0
  });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Token management state
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenDescription, setNewTokenDescription] = useState('');
  const [newTokenExpiresDays, setNewTokenExpiresDays] = useState<number | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Downloads state
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [_loadingDownloads, setLoadingDownloads] = useState(true);
  void _loadingDownloads; // Used for loading state display
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
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([
    'Create a cube at position 0, 0, 100',
    'Take a screenshot of the viewport',
    'Start playing the game',
    'Get all actors in the current level',
    'Save the current level'
  ]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiToolCalls, setAiToolCalls] = useState<Array<{id: string; name: string; arguments: any}>>([]);
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant' | 'system'; content: string; timestamp?: Date; toolCalls?: any[]; toolResults?: any[]; screenshot?: Screenshot; beforeAfter?: BeforeAfterPair; modelUsed?: {id: string; name: string; provider: string}; isStreaming?: boolean}>>([]);
  
  // AI Model selection state
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [autoSelectModel, setAutoSelectModel] = useState(false);

  // Viewport Preview state
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [beforeAfterPairs, setBeforeAfterPairs] = useState<BeforeAfterPair[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);;

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [aiSubTab, setAiSubTab] = useState<'chat' | 'scene' | 'assets' | 'lighting' | 'advanced'>('chat');

  // Command Feedback & Error Recovery state
  const [currentExecution, setCurrentExecution] = useState<CommandExecution | null>(null);
  const [commandExecutions, setCommandExecutions] = useState<CommandExecution[]>([]);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [failedCommand, setFailedCommand] = useState<string | null>(null);
  const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
  const [redoHistory, setRedoHistory] = useState<UndoAction[]>([]);
  const [sceneContext, setSceneContext] = useState<SceneContext | undefined>(undefined);

  const resultRef = useRef<HTMLDivElement>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ==================== EFFECTS ====================

  useEffect(() => {
    const savedFavorites = localStorage.getItem('ue5_mcp_favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ue5_mcp_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    loadAgentStatus();
    loadDownloads();
    loadTokens();

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
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAgentStatus(data);
      }
    } catch (error) {
      console.error('Failed to load agent status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  const loadTokens = async () => {
    try {
      setIsLoadingTokens(true);
      const response = await fetch('/api/agent/tokens', {
        headers: {
          'Authorization': `Bearer ${authToken}`
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
    if (!newTokenName.trim()) {
      alert('Please enter a token name');
      return;
    }

    try {
      setIsCreatingToken(true);
      
      if (!authToken) {
        alert('You must be logged in to create tokens. Please log in first.');
        return;
      }
      
      const response = await fetch('/api/agent/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
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
        setShowCreateToken(false);
        loadTokens();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Failed to create token: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to create token:', error);
      alert(`Failed to create token: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setIsCreatingToken(false);
    }
  };

  const revokeToken = async (tokenId: number) => {
    if (!confirm('Are you sure you want to revoke this token? Any connected agent will be disconnected.')) {
      return;
    }

    try {
      const response = await fetch(`/api/agent/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
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

  const filteredTools = MCP_TOOLS.filter(tool => {
    const matchesSearch = searchQuery === '' ||
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const executeTool = async (toolName: string, params: Record<string, any> = {}) => {
    if (!agentStatus.mcp_connected) {
      alert('MCP is not connected. Please ensure UE5 is running with the MCP plugin.');
      return;
    }

    setIsExecuting(true);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
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
        success: data.success !== false,
        error: data.error,
        timestamp: new Date(),
        duration
      };

      setExecutionHistory(prev => [result, ...prev.slice(0, 49)]);
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

  const processAiCommand = async (messageOverride?: string, modelOverride?: string) => {
    const commandToProcess = messageOverride || aiCommand;
    const modelToUse = modelOverride || selectedModel;
    
    if (!commandToProcess.trim()) return;

    setIsAiProcessing(true);
    setAiResponse(null);
    setAiToolCalls([]);

    // Add user message to chat history
    const userMessage = { role: 'user' as const, content: commandToProcess, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/ue5-ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          messages: [...chatHistory, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: autoSelectModel ? null : modelToUse,
          auto_select_model: autoSelectModel,
          execute_tools: true,
          auto_capture: autoCapture
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || response.statusText);
      }

      const data = await response.json();
      
      // Set AI response text
      setAiResponse(data.content || 'Command processed successfully');

      // Track tool calls
      if (data.tool_calls && data.tool_calls.length > 0) {
        setAiToolCalls(data.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name || tc.name,
          arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : tc.arguments
        })));
      }

      // Add tool results to execution history
      if (data.tool_results && data.tool_results.length > 0) {
        const startTime = Date.now();
        data.tool_results.forEach((tr: any, index: number) => {
          setExecutionHistory(prev => [{
            id: crypto.randomUUID(),
            tool: tr.tool_name,
            params: data.tool_calls?.[index]?.function?.arguments 
              ? JSON.parse(data.tool_calls[index].function.arguments) 
              : {},
            result: tr.result,
            success: tr.success,
            error: tr.error,
            timestamp: new Date(),
            duration: Date.now() - startTime
          }, ...prev.slice(0, 49)]);
        });
      }

      // Handle screenshot from response
      if (data.screenshot) {
        setScreenshots(prev => [data.screenshot, ...prev.slice(0, 49)]);
      }

      // Handle before/after pair from response
      if (data.before_after) {
        setBeforeAfterPairs(prev => [data.before_after, ...prev.slice(0, 19)]);
        // Also add individual screenshots
        setScreenshots(prev => [
          data.before_after.after,
          data.before_after.before,
          ...prev.slice(0, 47)
        ]);
      }

      // Add assistant message to chat history with screenshot info
      setChatHistory(prev => [...prev, {
        role: 'assistant' as const,
        content: data.content || '',
        timestamp: new Date(),
        toolCalls: data.tool_calls,
        toolResults: data.tool_results,
        screenshot: data.screenshot,
        beforeAfter: data.before_after,
        modelUsed: data.model_used
      }]);

      // Clear input after successful execution
      setAiCommand('');

    } catch (error: any) {
      setAiResponse(`Error: ${error.message}`);
      setChatHistory(prev => [...prev, {
        role: 'assistant' as const,
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Manual screenshot capture
  const captureScreenshot = async () => {
    if (!agentStatus.mcp_connected) return;
    
    setIsCapturing(true);
    try {
      const response = await fetch('/api/viewport/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          context: 'Manual capture',
          resolution_x: 1280,
          resolution_y: 720
        })
      });

      if (response.ok) {
        const screenshot = await response.json();
        setScreenshots(prev => [screenshot, ...prev.slice(0, 49)]);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  // Load existing screenshots
  const loadScreenshots = async () => {
    try {
      const [screenshotsRes, pairsRes] = await Promise.all([
        fetch('/api/viewport/screenshots?limit=20', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch('/api/viewport/pairs?limit=10', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ]);

      if (screenshotsRes.ok) {
        const data = await screenshotsRes.json();
        setScreenshots(data);
      }

      if (pairsRes.ok) {
        const data = await pairsRes.json();
        setBeforeAfterPairs(data);
      }
    } catch (error) {
      console.error('Failed to load screenshots:', error);
    }
  };

  // Delete a screenshot
  const deleteScreenshot = async (id: string) => {
    try {
      const response = await fetch(`/api/viewport/screenshot/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        // Remove from local state
        setScreenshots(prev => prev.filter(s => s.id !== id));
        // Also remove any pairs that include this screenshot
        setBeforeAfterPairs(prev => prev.filter(
          p => p.before.id !== id && p.after.id !== id
        ));
      }
    } catch (error) {
      console.error('Failed to delete screenshot:', error);
    }
  };

  // Fetch AI suggestions based on input
  const fetchAiSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) return;
    
    try {
      const response = await fetch(`/api/ue5-ai/suggestions?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setAiSuggestions(data.suggestions);
        }
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, [authToken]);

  // Debounced suggestion fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (aiCommand.trim().length >= 3) {
        fetchAiSuggestions(aiCommand);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [aiCommand, fetchAiSuggestions]);

  const toggleFavorite = (toolName: string) => {
    setFavorites(prev =>
      prev.includes(toolName)
        ? prev.filter(f => f !== toolName)
        : [...prev, toolName]
    );
  };

  // ==================== RENDER SECTIONS ====================

  // Overview Tab - Hero Section with Connection Visualization
  const renderOverview = () => (
    <div className="space-y-8">
      {/* Enhanced Connection Status */}
      <EnhancedConnectionStatus agentStatus={agentStatus} />

      {/* Scene Quick Actions - Auto-Fix & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SceneQuickActions
          authToken={authToken || ''}
          isConnected={agentStatus.mcp_connected}
          onExecuteCommand={(cmd) => {
            // Parse command and execute appropriate tool
            if (cmd.toLowerCase().includes('light')) {
              executeTool('spawn_actor', { actor_type: 'DirectionalLight', location: { x: 0, y: 0, z: 500 } });
            } else if (cmd.toLowerCase().includes('camera')) {
              executeTool('spawn_actor', { actor_type: 'CameraActor', location: { x: 0, y: -500, z: 200 } });
            }
          }}
          onNavigateToAnalyzer={() => setActiveTab('ai')}
        />
        
        {/* Quick Stats Summary */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Cloud}
          label="Cloud Status"
          value={agentStatus.connected ? 'Online' : 'Offline'}
          subtext={agentStatus.connected ? 'Agent connected' : 'Waiting for agent'}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={Plug}
          label="MCP Bridge"
          value={agentStatus.mcp_connected ? 'Active' : 'Inactive'}
          subtext={agentStatus.mcp_connected ? `Port 55557` : 'Not connected'}
          gradient="from-purple-500 to-pink-500"
        />
        <StatCard
          icon={Terminal}
          label="Commands"
          value={agentStatus.commands_executed}
          subtext="Total executed"
          gradient="from-amber-500 to-orange-500"
        />
        <StatCard
          icon={Wrench}
          label="MCP Tools"
          value="101"
          subtext="15 categories"
          gradient="from-green-500 to-emerald-500"
        />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <GlassCard className="p-6" hover={false}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Actions</h3>
            <p className="text-sm text-gray-400">Common operations at your fingertips</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.slice(0, 8).map((action) => (
            <button
              key={action.name}
              onClick={() => executeTool(action.tool, action.params || {})}
              disabled={!agentStatus.mcp_connected || isExecuting}
              className={`p-4 rounded-xl text-left transition-all group ${
                agentStatus.mcp_connected
                  ? 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20'
                  : 'bg-gray-900/50 border border-gray-800 opacity-50 cursor-not-allowed'
              }`}
            >
              <h4 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors">{action.name}</h4>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{action.description}</p>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Execution Results - Show in Overview tab */}
      {executionHistory.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                <History className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-medium text-white">Execution Results</h4>
            </div>
            <button
              onClick={() => setExecutionHistory([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {executionHistory.slice(0, 10).map((exec) => (
              <div
                key={exec.id}
                className={`rounded-xl border overflow-hidden ${
                  exec.success
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                {/* Header */}
                <div className={`px-4 py-2 flex items-center justify-between ${
                  exec.success ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  <div className="flex items-center gap-2">
                    {exec.success ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="font-medium text-white text-sm">{exec.tool}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {exec.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      exec.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {exec.duration}ms
                    </span>
                  </div>
                </div>
                
                {/* Response */}
                <div className="px-4 py-3">
                  {exec.error ? (
                    <div>
                      <div className="text-xs text-red-400 mb-1">Error:</div>
                      <pre className="text-xs text-red-300 font-mono bg-red-500/10 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                        {exec.error}
                      </pre>
                    </div>
                  ) : exec.result ? (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Response:</div>
                      <pre className="text-xs text-green-300 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto max-h-32 overflow-y-auto">
                        {typeof exec.result === 'string' 
                          ? exec.result 
                          : JSON.stringify(exec.result, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">No response data</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Getting Started (when not connected) */}
      {!agentStatus.connected && (
        <GlassCard className="p-6 border-blue-500/30" hover={false} glow glowColor="blue">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Get Started in 4 Steps</h3>
              <p className="text-sm text-gray-400">Connect your UE5 editor to the cloud</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { num: 1, title: 'Create Token', desc: 'Generate an agent token', icon: Key, gradient: 'from-amber-500 to-orange-500' },
              { num: 2, title: 'Download Agent', desc: 'Get the desktop app', icon: Download, gradient: 'from-green-500 to-emerald-500' },
              { num: 3, title: 'Install Plugin', desc: 'Add MCP Bridge to UE5', icon: Plug, gradient: 'from-purple-500 to-pink-500' },
              { num: 4, title: 'Connect!', desc: 'Start controlling UE5', icon: Rocket, gradient: 'from-blue-500 to-cyan-500' },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center flex-shrink-0`}>
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Step {step.num}</span>
                  </div>
                  <h4 className="font-medium text-white">{step.title}</h4>
                  <p className="text-xs text-gray-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );

  // Tokens Tab
  const renderTokens = () => (
    <div className="space-y-6">
      <GlassCard className="p-6" hover={false}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Agent Tokens</h3>
              <p className="text-sm text-gray-400">Secure authentication for your desktop agents</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateToken(!showCreateToken)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl text-white text-sm font-medium transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          >
            <Plus className="w-4 h-4" />
            Create Token
          </button>
        </div>

        {/* Create Token Form */}
        {showCreateToken && (
          <div className="mb-6 p-5 bg-white/5 rounded-xl border border-white/10">
            {createdToken ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-400 mb-3">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Token Created Successfully!</span>
                </div>
                <p className="text-sm text-gray-400">
                  Copy this token now. It won't be shown again!
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={createdToken}
                      readOnly
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-gray-300 pr-20"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-800 rounded-lg"
                    >
                      {showToken ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(createdToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-800 rounded-lg"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCreatedToken(null);
                    setShowCreateToken(false);
                    setShowToken(false);
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token Name *</label>
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g., Home PC, Work Laptop"
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
                  <input
                    type="text"
                    value={newTokenDescription}
                    onChange={(e) => setNewTokenDescription(e.target.value)}
                    placeholder="e.g., Main development machine"
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Expiration</label>
                  <select
                    value={newTokenExpiresDays || ''}
                    onChange={(e) => setNewTokenExpiresDays(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"
                  >
                    <option value="">Never expires</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={createToken}
                    disabled={!newTokenName.trim() || isCreatingToken}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl text-white text-sm font-medium transition-all"
                  >
                    {isCreatingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Create Token
                  </button>
                  <button
                    onClick={() => setShowCreateToken(false)}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm transition-colors"
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 font-medium">No tokens created yet</p>
              <p className="text-sm text-gray-500">Create a token to connect your desktop agent</p>
            </div>
          ) : (
            tokens.map((token) => (
              <div
                key={token.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  token.is_revoked
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    token.is_revoked ? 'bg-red-500/20' : 'bg-white/10'
                  }`}>
                    <Key className={`w-5 h-5 ${token.is_revoked ? 'text-red-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{token.name}</h4>
                      {token.is_revoked && (
                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">Revoked</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      <span className="font-mono">{token.token_prefix}...</span>
                      <span className="mx-2">•</span>
                      Created {new Date(token.created_at).toLocaleDateString()}
                    </p>
                    {token.last_used_at && (
                      <p className="text-xs text-gray-600 mt-1">
                        Last used: {new Date(token.last_used_at).toLocaleString()}
                        {token.last_ip && ` from ${token.last_ip}`}
                      </p>
                    )}
                  </div>
                </div>
                {!token.is_revoked && (
                  <button
                    onClick={() => revokeToken(token.id)}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 transition-colors"
                    title="Revoke token"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </GlassCard>

      {/* Security Notice */}
      <GlassCard className="p-5 border-amber-500/20" hover={false}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-medium text-amber-400 mb-2">Security Best Practices</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Create separate tokens for each machine</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Revoke tokens immediately if compromised</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Use expiration dates for temporary access</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400" /> Never share tokens or commit to version control</li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  );

  // Downloads Tab
  const renderDownloads = () => (
    <div className="space-y-6">
      {/* Hero */}
      <GlassCard className="p-8 relative overflow-hidden" hover={false} glow glowColor="green">
        <AnimatedBackground />
        <div className="relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Downloads & Installation</h2>
            <p className="text-gray-400">Get the tools you need to connect UE5 AI Studio to your editor</p>
          </div>

          {/* Steps */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { num: 1, label: 'Download', sub: 'Get Agent & Plugin', gradient: 'from-blue-500 to-cyan-500' },
              { num: 2, label: 'Install Plugin', sub: 'Add to UE5 project', gradient: 'from-purple-500 to-pink-500' },
              { num: 3, label: 'Run Agent', sub: 'Start desktop app', gradient: 'from-amber-500 to-orange-500' },
              { num: 4, label: 'Connect', sub: 'Control UE5 with AI!', gradient: 'from-green-500 to-emerald-500' },
            ].map((step, i) => (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
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
      </GlassCard>

      {/* Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Monitor className="w-4 h-4 text-white" />
            </div>
            <h4 className="font-medium text-white">Desktop Agent Requirements</h4>
          </div>
          <ul className="text-sm text-gray-400 space-y-2">
            {[
              'OS: Windows 10/11, macOS 10.15+, Ubuntu 20.04+',
              'RAM: 4GB minimum, 8GB recommended',
              'Storage: 200MB free space',
              'Network: Internet connection required',
              'Dependencies: Node.js 18+ (bundled)'
            ].map((req, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Plug className="w-4 h-4 text-white" />
            </div>
            <h4 className="font-medium text-white">MCP Bridge Plugin Requirements</h4>
          </div>
          <ul className="text-sm text-gray-400 space-y-2">
            {[
              'Engine: Unreal Engine 5.1 - 5.7',
              'OS: Windows 10/11 or macOS 12+',
              'Visual Studio: 2019 or 2022 (Windows)',
              'Xcode: 14+ (macOS)',
              'Project Type: C++ or Blueprint (with C++ enabled)'
            ].map((req, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {downloads.map((item) => (
          <GlassCard 
            key={item.filename} 
            className="p-6" 
            glow 
            glowColor={item.category === 'agent' ? 'blue' : 'purple'}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${
                item.category === 'agent' ? 'from-blue-500 to-cyan-500' : 'from-purple-500 to-pink-500'
              } flex items-center justify-center shadow-lg`}>
                {item.category === 'agent' ? (
                  <Cpu className="w-7 h-7 text-white" />
                ) : (
                  <Plug className="w-7 h-7 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-white">{item.name}</h4>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    item.category === 'agent' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    v{item.version}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{item.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {item.size}
              </span>
              <span>{item.platform.join(' • ')}</span>
            </div>

            <button
              onClick={() => handleDownload(item)}
              disabled={!item.available || downloading === item.filename}
              className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                item.available
                  ? item.category === 'agent'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {downloading === item.filename ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              Download {item.category === 'agent' ? 'Agent' : 'Plugin'}
            </button>
          </GlassCard>
        ))}
      </div>

      {/* Supported UE Versions */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <h4 className="font-medium text-white">Supported Unreal Engine Versions</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {UE5_VERSIONS.map((version) => (
            <span
              key={version}
              className="px-4 py-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl text-orange-400 text-sm font-medium"
            >
              UE {version}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );

  // MCP Tools Tab
  const renderTools = () => (
    <div className="space-y-6">
      {/* Search and Filter */}
      <GlassCard className="p-4" hover={false}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 101 MCP tools..."
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-3 rounded-xl transition-all ${
                viewMode === 'grid' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-3 rounded-xl transition-all ${
                viewMode === 'list' 
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            !selectedCategory 
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
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
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === cat.id 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Tools Grid/List */}
      <div className={viewMode === 'grid' 
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' 
        : 'space-y-2'
      }>
        {filteredTools.map((tool) => (
          <GlassCard
            key={tool.name}
            className={`cursor-pointer group ${viewMode === 'grid' ? 'p-4' : 'p-3'}`}
          >
            <div 
              onClick={() => setSelectedTool(tool)}
              className={viewMode === 'list' ? 'flex items-center gap-4' : ''}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors">
                  {tool.displayName}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(tool.name);
                  }}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                >
                  {favorites.includes(tool.name) ? (
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ) : (
                    <StarOff className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">{tool.description}</p>
              <div className="flex flex-wrap gap-1">
                {tool.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-xs bg-white/5 rounded-lg text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Tool Detail Modal */}
      {selectedTool && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="max-w-2xl w-full max-h-[80vh] overflow-y-auto" hover={false}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedTool.displayName}</h3>
                </div>
                <button
                  onClick={() => setSelectedTool(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-gray-400 mb-6">{selectedTool.description}</p>

              {selectedTool.parameters.length > 0 && (
                <div className="space-y-4 mb-6">
                  <h4 className="font-medium text-white">Parameters</h4>
                  {selectedTool.parameters.map((param) => (
                    <div key={param.name}>
                      <label className="block text-sm text-gray-400 mb-2">
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
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
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
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all"
                >
                  {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  Execute
                </button>
                <button
                  onClick={() => {
                    setSelectedTool(null);
                    setToolParams({});
                  }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );

  // AI Commands Sub-tabs configuration
  const AI_SUB_TABS = [
    { id: 'chat' as const, label: 'Chat & Voice', icon: Terminal, gradient: 'from-violet-500 to-purple-500', description: 'AI chat and voice commands' },
    { id: 'scene' as const, label: 'Scene Tools', icon: Box, gradient: 'from-blue-500 to-cyan-500', description: 'Build and analyze scenes' },
    { id: 'assets' as const, label: 'Assets', icon: Palette, gradient: 'from-green-500 to-emerald-500', description: 'Materials, textures & blueprints' },
    { id: 'lighting' as const, label: 'Lighting & Animation', icon: Zap, gradient: 'from-amber-500 to-orange-500', description: 'Lighting presets and animations' },
    { id: 'advanced' as const, label: 'Advanced', icon: Rocket, gradient: 'from-rose-500 to-red-500', description: 'Analytics, collaboration & more' },
  ];

  // AI Commands Tab
  const renderAiCommands = () => (
    <div className="space-y-6">
      {/* Sub-navigation Pills */}
      <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
        {AI_SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = aiSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAiSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                isActive
                  ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Actions Bar */}
      <GlassCard className="p-4" hover={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-white">Quick Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Screenshot', icon: Camera, action: () => captureScreenshot() },
              { label: 'Analyze Scene', icon: Search, action: () => setAiSubTab('scene') },
              { label: 'New Light', icon: Zap, action: () => setAiSubTab('lighting') },
              { label: 'Generate Texture', icon: Palette, action: () => setAiSubTab('assets') },
            ].map((action, i) => (
              <button
                key={i}
                onClick={action.action}
                disabled={!agentStatus.mcp_connected}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs text-gray-300 hover:text-white transition-all border border-white/10 hover:border-white/20"
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Tool Calls in Progress - Always visible when executing */}
      {aiToolCalls.length > 0 && isAiProcessing && (
        <GlassCard className="p-5 border-cyan-500/20">
          <div className="flex items-center gap-2 text-cyan-400 mb-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Executing Tools...</span>
          </div>
          <div className="space-y-2">
            {aiToolCalls.map((tc) => (
              <div key={tc.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <div>
                  <span className="text-white font-mono text-sm">{tc.name}</span>
                  <pre className="text-xs text-gray-500 mt-1">
                    {JSON.stringify(tc.arguments, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Chat & Voice Tab Content */}
      {aiSubTab === 'chat' && (
        <div className="space-y-6">
          {/* Voice Control Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Voice Control Panel */}
            <div className="lg:col-span-1">
              <VoiceControl
                onCommand={(command, parsedCommand) => {
                  let commandToExecute = command;
                  if (parsedCommand) {
                    commandToExecute = `[Voice Command - ${parsedCommand.category}] ${command}`;
                    setAiCommand(commandToExecute);
                    setChatHistory(prev => [...prev, {
                      role: 'assistant' as const,
                      content: `🎙️ Voice command recognized: "${command}" → ${parsedCommand.category}/${parsedCommand.action}`,
                      timestamp: new Date()
                    }]);
                  } else {
                    setAiCommand(command);
                  }
                  processAiCommand(commandToExecute);
                }}
                isProcessing={isAiProcessing}
                isConnected={agentStatus.mcp_connected}
              />
            </div>
            
            {/* Enhanced AI Chat Interface */}
            <div className="lg:col-span-2 h-[600px]">
              <EnhancedAIChat
                chatHistory={chatHistory}
                onSendMessage={(message, model) => {
                  setAiCommand(message);
                  setSelectedModel(model);
                  processAiCommand(message, model);
                }}
                onClearHistory={() => setChatHistory([])}
                isProcessing={isAiProcessing}
                isConnected={agentStatus.mcp_connected}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                autoSelectModel={autoSelectModel}
                onAutoSelectChange={setAutoSelectModel}
              />
            </div>
          </div>

          {/* Real-Time Command Feedback */}
          <CommandFeedback
            executions={commandExecutions}
            currentExecution={currentExecution || undefined}
            onCaptureScreenshot={captureScreenshot}
            onRetry={(executionId) => {
              const exec = commandExecutions.find(e => e.id === executionId);
              if (exec) {
                setAiCommand(exec.command);
                processAiCommand(exec.command);
              }
            }}
            onCancel={() => {
              setCurrentExecution(null);
              setIsAiProcessing(false);
            }}
            isConnected={agentStatus.mcp_connected}
          />

          {/* Error Recovery & Suggestions */}
          <ErrorRecovery
            error={currentError || undefined}
            command={failedCommand || undefined}
            sceneContext={sceneContext}
            undoHistory={undoHistory}
            redoHistory={redoHistory}
            onRetry={(modifiedCommand) => {
              setCurrentError(null);
              const commandToExecute = modifiedCommand || failedCommand || aiCommand;
              if (modifiedCommand) {
                setAiCommand(modifiedCommand);
              }
              processAiCommand(commandToExecute);
            }}
            onUndo={() => {
              if (undoHistory.length > 0) {
                const action = undoHistory[undoHistory.length - 1];
                setUndoHistory(prev => prev.slice(0, -1));
                setRedoHistory(prev => [...prev, action]);
                if (action.undoCommand) {
                  setAiCommand(action.undoCommand);
                  processAiCommand(action.undoCommand);
                }
              }
            }}
            onRedo={() => {
              if (redoHistory.length > 0) {
                const action = redoHistory[redoHistory.length - 1];
                setRedoHistory(prev => prev.slice(0, -1));
                setUndoHistory(prev => [...prev, action]);
                setAiCommand(action.command);
                processAiCommand(action.command);
              }
            }}
            onDismiss={() => {
              setCurrentError(null);
              setFailedCommand(null);
            }}
            onApplySuggestion={(suggestion) => {
              if (suggestion.autoFix) {
                setAiCommand(suggestion.autoFix);
                processAiCommand(suggestion.autoFix);
              }
            }}
            isConnected={agentStatus.mcp_connected}
          />

          {/* Viewport Preview */}
          {agentStatus.mcp_connected && (
            <ViewportPreview
              screenshots={screenshots}
              pairs={beforeAfterPairs}
              onCapture={captureScreenshot}
              onRefresh={loadScreenshots}
              isCapturing={isCapturing}
              autoCapture={autoCapture}
              onToggleAutoCapture={setAutoCapture}
              onDeleteScreenshot={deleteScreenshot}
            />
          )}

          {/* Execution History */}
          {executionHistory.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                    <History className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="font-medium text-white">Execution Results</h4>
                </div>
                <button
                  onClick={() => setExecutionHistory([])}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto" ref={resultRef}>
                {executionHistory.slice(0, 10).map((exec) => (
                  <div
                    key={exec.id}
                    className={`rounded-xl border overflow-hidden ${
                      exec.success
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className={`px-4 py-2 flex items-center justify-between ${
                      exec.success ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      <div className="flex items-center gap-2">
                        {exec.success ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="font-medium text-white text-sm">{exec.tool}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        exec.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {exec.duration}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Scene Tools Tab Content */}
      {aiSubTab === 'scene' && (
        <div className="space-y-6">
          {/* Scene Builder */}
          <SceneBuilder
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
            onSceneBuilt={(plan) => {
              loadScreenshots();
              setChatHistory(prev => [...prev, {
                role: 'assistant' as const,
                content: `Scene built successfully! Created ${plan.objects.length} objects: ${plan.objects.map(o => o.name).join(', ')}`,
                timestamp: new Date()
              }]);
            }}
          />

          {/* AI Scene Generator */}
          <AISceneGenerator
            onGenerate={(plan) => {
              loadScreenshots();
              setChatHistory(prev => [...prev, {
                role: 'assistant' as const,
                content: `AI Scene generated: "${plan.name}" with ${plan.totalObjects} objects. Style: ${plan.style}, Mood: ${plan.mood}`,
                timestamp: new Date()
              }]);
            }}
            onCancel={() => {
              setChatHistory(prev => [...prev, {
                role: 'assistant' as const,
                content: 'Scene generation cancelled.',
                timestamp: new Date()
              }]);
            }}
          />

          {/* Scene Analyzer */}
          <SceneAnalyzer
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
            onExecuteCommand={(command) => {
              setAiCommand(command);
              processAiCommand(command);
            }}
          />

          {/* Scene Quick Actions */}
          <SceneQuickActions
            onExecuteAction={(action) => {
              setAiCommand(action);
              processAiCommand(action);
            }}
            isConnected={agentStatus.mcp_connected}
          />

          {/* Action Timeline (Undo/Redo) */}
          <ActionTimeline
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
            onActionUndone={(action) => {
              loadScreenshots();
              setChatHistory(prev => [...prev, {
                role: 'assistant' as const,
                content: `Undone: ${action.description}`,
                timestamp: new Date()
              }]);
            }}
            onActionRedone={(action) => {
              loadScreenshots();
              setChatHistory(prev => [...prev, {
                role: 'assistant' as const,
                content: `Redone: ${action.description}`,
                timestamp: new Date()
              }]);
            }}
          />
        </div>
      )}

      {/* Assets Tab Content */}
      {aiSubTab === 'assets' && (
        <div className="space-y-6">
          {/* Blueprint & Material Assistant */}
          <BlueprintMaterialAssistant
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
            onAssetCreated={(asset) => {
              loadScreenshots();
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `Created ${asset.graph.asset_type}: ${asset.graph.name}`,
                timestamp: new Date().toISOString()
              }]);
            }}
          />

          {/* AI Texture Generator */}
          <TextureGenerator
            onTextureGenerated={(texture) => {
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `Generated PBR texture: ${texture.prompt}`,
                timestamp: new Date().toISOString()
              }]);
            }}
            onApplyToActor={(_texture, actorName) => {
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `Applied texture to actor: ${actorName}`,
                timestamp: new Date().toISOString()
              }]);
            }}
          />

          {/* Asset Manager */}
          <AssetManager
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
          />
        </div>
      )}

      {/* Lighting & Animation Tab Content */}
      {aiSubTab === 'lighting' && (
        <div className="space-y-6">
          {/* Lighting Wizard */}
          <LightingWizard
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
            onLightingApplied={(preset) => {
              loadScreenshots();
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `Applied lighting preset: ${preset.name} - ${preset.description}`,
                timestamp: new Date().toISOString()
              }]);
            }}
          />

          {/* Animation Assistant */}
          <AnimationAssistant
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
            onAnimationApplied={(animation) => {
              loadScreenshots();
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `Playing animation: ${animation.name} (${animation.duration.toFixed(1)}s)`,
                timestamp: new Date().toISOString()
              }]);
            }}
          />

          {/* Performance Optimizer */}
          <PerformanceOptimizer
            authToken={authToken || ''}
            isConnected={agentStatus.mcp_connected}
          />
        </div>
      )}

      {/* Advanced Tab Content */}
      {aiSubTab === 'advanced' && (
        <div className="space-y-6">
          {/* Command Templates & Workflow Presets */}
          <CommandTemplates
            onExecuteTemplate={(template, params) => {
              // Build command from template
              let command = template.template;
              template.parameters.forEach(param => {
                const value = params[param.name] || param.defaultValue || '';
                command = command.replace(`{{${param.name}}}`, String(value));
              });
              setAiCommand(command);
              processAiCommand(command);
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `Executing template: ${template.name}`,
                timestamp: new Date().toISOString()
              }]);
            }}
            onExecuteWorkflow={async (workflow) => {
              setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: `Starting workflow: ${workflow.name} (${workflow.steps.length} steps)`,
                timestamp: new Date().toISOString()
              }]);
              
              for (const step of workflow.steps) {
                setAiCommand(step.command);
                await processAiCommand(step.command);
                if (step.waitForCompletion) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              setChatHistory(prev => [...prev, {
                role: 'assistant' as const,
                content: `Workflow completed`,
                timestamp: new Date()
              }]);
            }}
            onSaveTemplate={(template) => {
              console.log('Save template:', template);
            }}
            onDeleteTemplate={(templateId) => {
              console.log('Delete template:', templateId);
            }}
            onSaveWorkflow={(workflow) => {
              console.log('Save workflow:', workflow);
            }}
            onDeleteWorkflow={(workflowId) => {
              console.log('Delete workflow:', workflowId);
            }}
            onImportWorkflows={(workflows) => {
              console.log('Import workflows:', workflows);
            }}
            isConnected={agentStatus.mcp_connected}
          />

          {/* Advanced AI Features */}
          <AdvancedAIFeatures
            onExecuteCommand={(cmd) => console.log('Execute command:', cmd)}
            onExecuteChain={(chain) => console.log('Execute chain:', chain)}
            onExecuteMacro={(macro) => console.log('Execute macro:', macro)}
          />

          {/* Real-time Collaboration */}
          <CollaborationPanel
            isConnected={agentStatus.mcp_connected}
            currentUserId="user_1"
            currentUserName="You"
            onShareViewport={() => console.log('Share viewport')}
            onFollowUser={(userId) => console.log('Follow user:', userId)}
            onLockActor={(actorId) => console.log('Lock actor:', actorId)}
            onUnlockActor={(actorId) => console.log('Unlock actor:', actorId)}
            onSendChat={(message) => console.log('Send chat:', message)}
          />

          {/* Analytics Dashboard */}
          <AnalyticsDashboard
            onExport={(format) => console.log('Export analytics:', format)}
          />

          {/* Full Execution History */}
          {executionHistory.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                <History className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-medium text-white">Execution Results</h4>
            </div>
            <button
              onClick={() => setExecutionHistory([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto" ref={resultRef}>
            {executionHistory.slice(0, 20).map((exec) => (
              <div
                key={exec.id}
                className={`rounded-xl border overflow-hidden ${
                  exec.success
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                {/* Header */}
                <div className={`px-4 py-2 flex items-center justify-between ${
                  exec.success ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  <div className="flex items-center gap-2">
                    {exec.success ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="font-medium text-white text-sm">{exec.tool}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {exec.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      exec.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {exec.duration}ms
                    </span>
                  </div>
                </div>
                
                {/* Parameters (if any) */}
                {Object.keys(exec.params).length > 0 && (
                  <div className="px-4 py-2 border-b border-white/5">
                    <div className="text-xs text-gray-500 mb-1">Parameters:</div>
                    <pre className="text-xs text-gray-300 font-mono bg-black/20 rounded-lg p-2 overflow-x-auto">
                      {JSON.stringify(exec.params, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Response */}
                <div className="px-4 py-3">
                  {exec.error ? (
                    <div>
                      <div className="text-xs text-red-400 mb-1">Error:</div>
                      <pre className="text-xs text-red-300 font-mono bg-red-500/10 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                        {exec.error}
                      </pre>
                    </div>
                  ) : exec.result ? (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Response:</div>
                      <pre className="text-xs text-green-300 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto">
                        {typeof exec.result === 'string' 
                          ? exec.result 
                          : JSON.stringify(exec.result, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">No response data</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
          )}
        </div>
      )}
    </div>
  );

  // Setup Guide Tab
  const renderSetup = () => (
    <div className="space-y-6">
      <CollapsibleSection title="Desktop Agent Installation" icon={Monitor} defaultOpen gradient="from-blue-500 to-cyan-500" badge="Step 1">
        <div className="space-y-4">
          <CollapsibleSection title="Windows" icon={Monitor} gradient="from-blue-500 to-cyan-500">
            <Step number={1} title="Download and Extract">
              <p>Download the ZIP file and extract it to a folder (e.g., <code className="px-2 py-0.5 bg-white/10 rounded text-blue-400">C:\UE5-AI-Studio-Agent</code>)</p>
            </Step>
            <Step number={2} title="Install Dependencies">
              <p>Open Command Prompt in the extracted folder and run:</p>
              <CodeBlock code="npm install" />
            </Step>
            <Step number={3} title="Configure Connection">
              <p>Edit <code className="px-2 py-0.5 bg-white/10 rounded text-blue-400">config.json</code>:</p>
              <CodeBlock code={`{
  "platformUrl": "https://your-ue5-ai-studio-url.com",
  "token": "YOUR_AGENT_TOKEN_HERE",
  "mcpPort": 55557,
  "autoConnect": true
}`} language="json" />
            </Step>
            <Step number={4} title="Start the Agent" isLast>
              <CodeBlock code="npm start" />
            </Step>
          </CollapsibleSection>

          <CollapsibleSection title="macOS" icon={Monitor} gradient="from-gray-500 to-gray-600">
            <Step number={1} title="Download and Extract">
              <p>Download the ZIP file and extract it to Applications or preferred location</p>
            </Step>
            <Step number={2} title="Install and Run" isLast>
              <CodeBlock code={`cd ~/ue5-ai-agent
npm install
npm start`} />
            </Step>
          </CollapsibleSection>

          <CollapsibleSection title="Linux" icon={Terminal} gradient="from-orange-500 to-red-500">
            <Step number={1} title="Download and Extract">
              <CodeBlock code={`wget https://your-platform/downloads/agent.zip
unzip agent.zip -d ~/ue5-ai-agent
cd ~/ue5-ai-agent`} />
            </Step>
            <Step number={2} title="Install and Run" isLast>
              <CodeBlock code={`npm install
npm start`} />
            </Step>
          </CollapsibleSection>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="MCP Bridge Plugin Installation" icon={Plug} gradient="from-purple-500 to-pink-500" badge="Step 2">
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
          <p>Open your project in UE5. The plugin should appear in Edit → Plugins. Enable it and restart.</p>
        </Step>
        <Step number={4} title="Verify Connection" isLast>
          <p>Check the Output Log for "MCP Server started on port 55557"</p>
        </Step>
      </CollapsibleSection>

      <CollapsibleSection title="Available MCP Tools" icon={Wrench} gradient="from-green-500 to-emerald-500" badge="101 Tools">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {MCP_CATEGORIES.map((cat) => {
            const count = MCP_TOOLS.filter(t => t.category === cat.id).length;
            return (
              <div key={cat.id} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{count}</span>
                <p className="text-xs text-gray-400 mt-1">{cat.name}</p>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );

  // Help Tab
  const renderHelp = () => (
    <div className="space-y-6">
      <GlassCard className="p-6" hover={false}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Troubleshooting Guide</h3>
            <p className="text-gray-400">Common issues and their solutions</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              title: 'Agent cannot connect to the platform',
              icon: CloudOff,
              solutions: [
                'Verify your agent token is valid and not expired',
                'Check that the platform URL in config.json is correct',
                'Ensure your firewall allows outbound WebSocket connections',
                'Try regenerating a new token from the Tokens tab'
              ]
            },
            {
              title: 'MCP Bridge plugin not appearing in UE5',
              icon: Plug,
              solutions: [
                'Verify the plugin is in the correct Plugins folder',
                'Regenerate project files after adding the plugin',
                'Check the Output Log for compilation errors',
                'Ensure your UE5 version is supported (5.1-5.7)'
              ]
            },
            {
              title: 'Agent shows "Connection Lost" frequently',
              icon: WifiOff,
              solutions: [
                'Check your internet connection stability',
                'Verify no VPN or proxy is interfering',
                'The agent will automatically reconnect',
                'Check server status at the platform dashboard'
              ]
            },
            {
              title: 'MCP tools not executing in UE5',
              icon: XCircle,
              solutions: [
                'Verify the MCP server is running (check Output Log)',
                'Ensure the agent is connected to MCP (green status)',
                'Check that port 55557 is not blocked',
                'Restart the UE5 editor if the plugin becomes unresponsive'
              ]
            }
          ].map((issue, i) => (
            <CollapsibleSection key={i} title={issue.title} icon={issue.icon} gradient="from-rose-500 to-red-500">
              <ul className="text-sm text-gray-400 space-y-2">
                {issue.solutions.map((solution, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    {solution}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          ))}
        </div>
      </GlassCard>

      {/* Resources */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h4 className="font-medium text-white">Additional Resources</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: GitBranch, title: 'GitHub', desc: 'Source code & issues', href: 'https://github.com/mtc-jordan/UE5_AGENT' },
            { icon: BookOpen, title: 'UE5 Docs', desc: 'Official documentation', href: 'https://docs.unrealengine.com' },
            { icon: HelpCircle, title: 'Support', desc: 'Get help from our team', href: '#' }
          ].map((resource, i) => (
            <a
              key={i}
              href={resource.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all group"
            >
              <resource.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
              <div className="flex-1">
                <span className="text-white font-medium">{resource.title}</span>
                <p className="text-xs text-gray-500">{resource.desc}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
            </a>
          ))}
        </div>
      </GlassCard>
    </div>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="h-full overflow-y-auto bg-gray-950 text-white">
      {/* Custom CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-gray-950/80 border-b border-white/10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Plug className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  UE5 Connection Hub
                </h1>
                <p className="text-gray-500 text-sm">Comprehensive UE5 integration center</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <StatusOrb connected={agentStatus.connected && agentStatus.mcp_connected} />
                <span className="text-sm text-gray-400">
                  {agentStatus.connected && agentStatus.mcp_connected 
                    ? 'Connected' 
                    : agentStatus.connected 
                      ? 'Partial' 
                      : 'Offline'}
                </span>
              </div>
              <button
                onClick={loadAgentStatus}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
                title="Refresh status"
              >
                <RefreshCw className={`w-5 h-5 text-gray-400 ${isLoadingStatus ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pb-0">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-t-xl transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white/10 text-white border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : ''}`} />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tokens' && renderTokens()}
        {activeTab === 'downloads' && renderDownloads()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'ai' && renderAiCommands()}
        {activeTab === 'setup' && renderSetup()}
        {activeTab === 'help' && renderHelp()}
      </div>
    </div>
  );
}
