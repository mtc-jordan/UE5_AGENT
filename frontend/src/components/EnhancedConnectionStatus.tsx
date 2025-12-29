/**
 * Enhanced Connection Status Component
 * 
 * Visual representation of the connection pipeline:
 * Platform → Agent → UE5
 * 
 * Features:
 * - Animated connection visualization
 * - Real-time status updates
 * - Connection details on hover
 * - Responsive design
 */

import React from 'react';
import { 
  Globe, Cpu, Gamepad2, Wifi, WifiOff, 
  CheckCircle, AlertCircle, Loader2, Clock,
  Server, Plug, Zap
} from 'lucide-react';

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

interface EnhancedConnectionStatusProps {
  agentStatus: AgentStatus;
  className?: string;
}

const EnhancedConnectionStatus: React.FC<EnhancedConnectionStatusProps> = ({
  agentStatus,
  className = '',
}) => {
  const isFullyConnected = agentStatus.connected && agentStatus.mcp_connected;
  const isPartiallyConnected = agentStatus.connected && !agentStatus.mcp_connected;

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeSince = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-white/10 ${className}`}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl transition-all duration-1000 ${
          isFullyConnected ? 'bg-green-500/20 animate-pulse' : 
          isPartiallyConnected ? 'bg-yellow-500/20 animate-pulse' : 
          'bg-gray-500/10'
        }`} />
        <div className={`absolute -bottom-20 -left-20 w-40 h-40 rounded-full blur-3xl transition-all duration-1000 ${
          isFullyConnected ? 'bg-emerald-500/20 animate-pulse' : 
          isPartiallyConnected ? 'bg-amber-500/20 animate-pulse' : 
          'bg-gray-500/10'
        }`} style={{ animationDelay: '500ms' }} />
      </div>

      <div className="relative z-10 p-6">
        {/* Connection Pipeline */}
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-6">
          {/* Platform Node */}
          <div className="flex flex-col items-center group">
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 transform group-hover:scale-105 transition-all">
                <Globe className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-gray-900 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            </div>
            <span className="text-white font-medium mt-2 text-sm md:text-base">Platform</span>
            <span className="text-xs text-gray-400">Cloud</span>
          </div>

          {/* Connection Line 1 */}
          <div className="flex flex-col items-center">
            <div className={`relative h-1.5 w-12 md:w-20 rounded-full overflow-hidden ${
              agentStatus.connected ? 'bg-green-500/30' : 'bg-gray-700'
            }`}>
              {agentStatus.connected && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-400" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
                </>
              )}
            </div>
            <span className={`text-xs mt-1 ${agentStatus.connected ? 'text-green-400' : 'text-gray-500'}`}>
              WebSocket
            </span>
          </div>

          {/* Agent Node */}
          <div className="flex flex-col items-center group">
            <div className="relative">
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transform group-hover:scale-105 transition-all ${
                agentStatus.connected 
                  ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/30' 
                  : 'bg-gray-700/50 border border-gray-600'
              }`}>
                <Cpu className={`w-7 h-7 md:w-8 md:h-8 ${agentStatus.connected ? 'text-white' : 'text-gray-500'}`} />
              </div>
              {agentStatus.connected ? (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-gray-900 flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              ) : (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-600 border-2 border-gray-900 flex items-center justify-center">
                  <WifiOff className="w-3 h-3 text-gray-400" />
                </div>
              )}
            </div>
            <span className={`font-medium mt-2 text-sm md:text-base ${agentStatus.connected ? 'text-white' : 'text-gray-500'}`}>
              Agent
            </span>
            <span className="text-xs text-gray-400">
              {agentStatus.agent_hostname || 'Desktop'}
            </span>
          </div>

          {/* Connection Line 2 */}
          <div className="flex flex-col items-center">
            <div className={`relative h-1.5 w-12 md:w-20 rounded-full overflow-hidden ${
              agentStatus.mcp_connected ? 'bg-green-500/30' : 'bg-gray-700'
            }`}>
              {agentStatus.mcp_connected && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-400" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" style={{ animationDelay: '500ms' }} />
                </>
              )}
            </div>
            <span className={`text-xs mt-1 ${agentStatus.mcp_connected ? 'text-green-400' : 'text-gray-500'}`}>
              MCP
            </span>
          </div>

          {/* UE5 Node */}
          <div className="flex flex-col items-center group">
            <div className="relative">
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transform group-hover:scale-105 transition-all ${
                agentStatus.mcp_connected 
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30' 
                  : 'bg-gray-700/50 border border-gray-600'
              }`}>
                <Gamepad2 className={`w-7 h-7 md:w-8 md:h-8 ${agentStatus.mcp_connected ? 'text-white' : 'text-gray-500'}`} />
              </div>
              {agentStatus.mcp_connected ? (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-gray-900 flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              ) : (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gray-600 border-2 border-gray-900 flex items-center justify-center">
                  <Plug className="w-3 h-3 text-gray-400" />
                </div>
              )}
            </div>
            <span className={`font-medium mt-2 text-sm md:text-base ${agentStatus.mcp_connected ? 'text-white' : 'text-gray-500'}`}>
              Unreal
            </span>
            <span className="text-xs text-gray-400">
              {agentStatus.mcp_engine_version || 'Engine 5'}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center mb-6">
          {isFullyConnected ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full animate-pulse">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping" />
              </div>
              <span className="text-green-400 font-medium text-sm">Fully Connected</span>
            </div>
          ) : isPartiallyConnected ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-medium text-sm">Agent Connected • Waiting for UE5</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-500/20 border border-gray-500/30 rounded-full">
              <WifiOff className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 font-medium text-sm">Disconnected</span>
            </div>
          )}
        </div>

        {/* Project Info */}
        {agentStatus.mcp_connected && agentStatus.mcp_project_name && (
          <div className="text-center mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Currently Editing</p>
            <p className="text-xl font-bold text-white">{agentStatus.mcp_project_name}</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className={`w-4 h-4 ${agentStatus.connected ? 'text-green-400' : 'text-gray-500'}`} />
              <span className="text-xs text-gray-400">Agent</span>
            </div>
            <p className={`text-lg font-bold ${agentStatus.connected ? 'text-white' : 'text-gray-500'}`}>
              {agentStatus.connected ? 'Online' : 'Offline'}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Plug className={`w-4 h-4 ${agentStatus.mcp_connected ? 'text-purple-400' : 'text-gray-500'}`} />
              <span className="text-xs text-gray-400">MCP</span>
            </div>
            <p className={`text-lg font-bold ${agentStatus.mcp_connected ? 'text-white' : 'text-gray-500'}`}>
              {agentStatus.mcp_connected ? 'Active' : 'Inactive'}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-gray-400">Commands</span>
            </div>
            <p className="text-lg font-bold text-white">{agentStatus.commands_executed}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400">Tools</span>
            </div>
            <p className="text-lg font-bold text-white">{agentStatus.mcp_tools_count}</p>
          </div>
        </div>

        {/* Connection Details */}
        {agentStatus.connected && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Connected at:</span>
                <span className="text-gray-300 ml-2">{formatTime(agentStatus.connected_at)}</span>
              </div>
              <div>
                <span className="text-gray-500">Agent version:</span>
                <span className="text-gray-300 ml-2">{agentStatus.agent_version || 'Unknown'}</span>
              </div>
              {agentStatus.last_command_at && (
                <div>
                  <span className="text-gray-500">Last command:</span>
                  <span className="text-gray-300 ml-2">{getTimeSince(agentStatus.last_command_at)}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Platform:</span>
                <span className="text-gray-300 ml-2">{agentStatus.agent_platform || 'Unknown'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedConnectionStatus;
