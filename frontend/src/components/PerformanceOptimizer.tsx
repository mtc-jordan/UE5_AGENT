/**
 * Enhanced Performance Optimizer Component
 * 
 * Premium AI-powered performance analysis dashboard:
 * - Real-time metrics with animated gauges
 * - Visual bottleneck detection with severity heat map
 * - Actionable optimization cards with priority indicators
 * - Before/after comparison with animated transitions
 * - Performance history timeline
 * - One-click auto-optimization
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Gauge, Cpu, HardDrive, Monitor, Zap, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw, Loader2, ChevronRight,
  Play, CheckCircle, XCircle, Info, Target, Layers, Sun,
  Box, Camera, Settings, BarChart3, LineChart, PieChart,
  ArrowUp, ArrowDown, Minus, Sparkles, Shield, Clock,
  Maximize2, Minimize2, Download, Filter, ChevronDown,
  Flame, Snowflake, Eye, EyeOff, Wrench, Rocket,
  CircleDot, Triangle, Square, Hexagon, Smartphone, Gamepad2
} from 'lucide-react';

// ==================== TYPES ====================

interface PerformanceMetrics {
  fps: number;
  frame_time_ms: number;
  game_thread_ms: number;
  render_thread_ms: number;
  gpu_time_ms: number;
  used_memory_mb: number;
  texture_memory_mb: number;
  mesh_memory_mb: number;
  draw_calls: number;
  triangles_drawn: number;
  visible_static_meshes: number;
  visible_skeletal_meshes: number;
  dynamic_lights: number;
  shadow_casting_lights: number;
  material_count: number;
  physics_bodies: number;
}

interface Bottleneck {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  affected_actors: string[];
  auto_fix_available: boolean;
}

interface Optimization {
  id: string;
  title: string;
  description: string;
  category: string;
  estimated_improvement: string;
  risk_level: 'low' | 'medium' | 'high';
  auto_applicable: boolean;
  steps: string[];
}

interface PerformanceReport {
  id: string;
  timestamp: string;
  overall_score: number;
  performance_grade: string;
  target_platform: string;
  ai_summary: string;
  metrics: PerformanceMetrics;
  bottlenecks: Bottleneck[];
  optimizations: Optimization[];
}

interface PerformanceOptimizerProps {
  authToken: string;
  isConnected: boolean;
}

// ==================== CONSTANTS ====================

const PLATFORMS = [
  { id: 'pc_ultra', name: 'PC Ultra', icon: Monitor, target: 60, color: 'from-purple-500 to-violet-600' },
  { id: 'pc_high', name: 'PC High', icon: Monitor, target: 60, color: 'from-blue-500 to-cyan-600' },
  { id: 'console', name: 'Console', icon: Gamepad2, target: 60, color: 'from-green-500 to-emerald-600' },
  { id: 'mobile', name: 'Mobile', icon: Smartphone, target: 30, color: 'from-orange-500 to-amber-600' }
];

const SEVERITY_CONFIG = {
  critical: { color: 'red', bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', icon: Flame },
  high: { color: 'orange', bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', icon: AlertTriangle },
  medium: { color: 'yellow', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400', icon: Info },
  low: { color: 'blue', bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', icon: Info }
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  gpu: Monitor,
  cpu: Cpu,
  memory: HardDrive,
  rendering: Layers,
  lighting: Sun,
  physics: Activity,
  draw_calls: BarChart3
};

// ==================== HELPER COMPONENTS ====================

// Animated circular gauge
const CircularGauge: React.FC<{
  value: number;
  max: number;
  label: string;
  unit: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  warning?: number;
  critical?: number;
}> = ({ value, max, label, unit, size = 'md', color, warning, critical }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = size === 'sm' ? 35 : size === 'md' ? 45 : 55;
  const stroke = size === 'sm' ? 6 : size === 'md' ? 8 : 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  // Determine color based on thresholds
  let gaugeColor = color || 'stroke-green-500';
  if (critical && value >= critical) {
    gaugeColor = 'stroke-red-500';
  } else if (warning && value >= warning) {
    gaugeColor = 'stroke-yellow-500';
  }
  
  const sizeClass = size === 'sm' ? 'w-20 h-20' : size === 'md' ? 'w-28 h-28' : 'w-36 h-36';
  const textSize = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl';
  
  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${sizeClass}`}>
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-700/50"
          />
          {/* Progress circle */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${gaugeColor} transition-all duration-1000 ease-out`}
            style={{
              filter: 'drop-shadow(0 0 6px currentColor)'
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${textSize} font-bold text-white`}>
            {value.toFixed(value < 10 ? 1 : 0)}
          </span>
          <span className="text-xs text-gray-400">{unit}</span>
        </div>
      </div>
      <span className="mt-2 text-sm text-gray-400">{label}</span>
    </div>
  );
};

// Metric bar with animation
const MetricBar: React.FC<{
  label: string;
  value: number;
  max: number;
  unit: string;
  icon: React.ElementType;
  color: string;
  warning?: number;
  critical?: number;
}> = ({ label, value, max, unit, icon: Icon, color, warning, critical }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  let barColor = color;
  let statusIcon = null;
  if (critical && value >= critical) {
    barColor = 'from-red-500 to-red-600';
    statusIcon = <Flame className="w-4 h-4 text-red-400 animate-pulse" />;
  } else if (warning && value >= warning) {
    barColor = 'from-yellow-500 to-orange-500';
    statusIcon = <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-sm font-medium text-white">
            {value.toLocaleString()} <span className="text-gray-500">{unit}</span>
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Score badge with grade
const ScoreBadge: React.FC<{ score: number; grade: string; size?: 'sm' | 'lg' }> = ({ 
  score, 
  grade,
  size = 'lg' 
}) => {
  const getGradeColor = () => {
    if (score >= 90) return 'from-green-400 to-emerald-500';
    if (score >= 75) return 'from-blue-400 to-cyan-500';
    if (score >= 60) return 'from-yellow-400 to-orange-500';
    if (score >= 40) return 'from-orange-400 to-red-500';
    return 'from-red-400 to-red-600';
  };
  
  const sizeClasses = size === 'lg' 
    ? 'w-32 h-32 text-5xl' 
    : 'w-20 h-20 text-2xl';
  
  return (
    <div className={`relative ${sizeClasses} rounded-full bg-gradient-to-br ${getGradeColor()} p-1`}>
      <div className="w-full h-full rounded-full bg-gray-900 flex flex-col items-center justify-center">
        <span className={`font-bold text-white ${size === 'lg' ? 'text-4xl' : 'text-xl'}`}>{grade}</span>
        <span className={`text-gray-400 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>{score}/100</span>
      </div>
    </div>
  );
};

// Bottleneck card
const BottleneckCard: React.FC<{
  bottleneck: Bottleneck;
  onFix: () => void;
  isFixing: boolean;
}> = ({ bottleneck, onFix, isFixing }) => {
  const config = SEVERITY_CONFIG[bottleneck.severity];
  const CategoryIcon = CATEGORY_ICONS[bottleneck.category] || Activity;
  const SeverityIcon = config.icon;
  
  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 transition-all hover:scale-[1.02]`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center`}>
            <CategoryIcon className={`w-5 h-5 ${config.text}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <SeverityIcon className={`w-4 h-4 ${config.text}`} />
              <span className={`text-xs font-medium uppercase ${config.text}`}>
                {bottleneck.severity}
              </span>
            </div>
            <h4 className="font-medium text-white mb-1">{bottleneck.title}</h4>
            <p className="text-sm text-gray-400 mb-2">{bottleneck.description}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <TrendingDown className="w-3 h-3" />
              <span>Impact: {bottleneck.impact}</span>
            </div>
          </div>
        </div>
        
        {bottleneck.auto_fix_available && (
          <button
            onClick={onFix}
            disabled={isFixing}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              isFixing
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : `bg-gradient-to-r ${config.bg} border ${config.border} ${config.text} hover:brightness-110`
            }`}
          >
            {isFixing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                <span>Fix</span>
              </div>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// Optimization recommendation card
const OptimizationCard: React.FC<{
  optimization: Optimization;
  index: number;
  onApply: () => void;
  isApplying: boolean;
}> = ({ optimization, index, onApply, isApplying }) => {
  const [expanded, setExpanded] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[optimization.category] || Sparkles;
  
  const getRiskColor = () => {
    switch (optimization.risk_level) {
      case 'low': return 'text-green-400 bg-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'high': return 'text-red-400 bg-red-500/20';
    }
  };
  
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 overflow-hidden transition-all hover:border-purple-500/30">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Priority number */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">{index + 1}</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CategoryIcon className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-400 uppercase font-medium">
                {optimization.category}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskColor()}`}>
                {optimization.risk_level} risk
              </span>
            </div>
            
            <h4 className="font-medium text-white mb-1">{optimization.title}</h4>
            <p className="text-sm text-gray-400 mb-2">{optimization.description}</p>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>{optimization.estimated_improvement}</span>
              </div>
              
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <span>{expanded ? 'Hide' : 'Show'} steps</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          
          {optimization.auto_applicable && (
            <button
              onClick={onApply}
              disabled={isApplying}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex-shrink-0 ${
                isApplying
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:brightness-110'
              }`}
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4" />
                  <span>Apply</span>
                </div>
              )}
            </button>
          )}
        </div>
        
        {/* Expanded steps */}
        {expanded && optimization.steps.length > 0 && (
          <div className="mt-4 pl-12 border-l-2 border-purple-500/30 ml-4">
            <ol className="space-y-2">
              {optimization.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs text-gray-300">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

const PerformanceOptimizer: React.FC<PerformanceOptimizerProps> = ({
  authToken,
  isConnected
}) => {
  // State
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState('pc_high');
  const [activeTab, setActiveTab] = useState<'overview' | 'bottlenecks' | 'optimizations'>('overview');
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Analyze performance
  const analyzePerformance = useCallback(async () => {
    if (!isConnected || !authToken) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/performance/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ model: 'deepseek-chat' })
      });
      
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Failed to analyze performance:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isConnected, authToken]);

  // Fix bottleneck
  const fixBottleneck = async (bottleneckId: string) => {
    setFixingId(bottleneckId);
    try {
      const response = await fetch('/api/performance/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ optimization_id: bottleneckId })
      });
      
      if (response.ok) {
        // Re-analyze after fix
        await analyzePerformance();
      }
    } catch (error) {
      console.error('Failed to fix bottleneck:', error);
    } finally {
      setFixingId(null);
    }
  };

  // Apply optimization
  const applyOptimization = async (optimizationId: string) => {
    setApplyingId(optimizationId);
    try {
      const response = await fetch('/api/performance/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ optimization_id: optimizationId })
      });
      
      if (response.ok) {
        // Re-analyze after optimization
        await analyzePerformance();
      }
    } catch (error) {
      console.error('Failed to apply optimization:', error);
    } finally {
      setApplyingId(null);
    }
  };

  // Apply preset
  const applyPreset = async (preset: string) => {
    try {
      const response = await fetch('/api/performance/apply-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ preset })
      });
      
      if (response.ok) {
        await analyzePerformance();
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && isConnected) {
      refreshInterval.current = setInterval(analyzePerformance, 5000);
    } else if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }
    
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh, isConnected, analyzePerformance]);

  // Mock data for demo
  const mockMetrics: PerformanceMetrics = report?.metrics || {
    fps: 45,
    frame_time_ms: 22.2,
    game_thread_ms: 8.5,
    render_thread_ms: 12.3,
    gpu_time_ms: 18.7,
    used_memory_mb: 4200,
    texture_memory_mb: 1800,
    mesh_memory_mb: 950,
    draw_calls: 2450,
    triangles_drawn: 4500000,
    visible_static_meshes: 1250,
    visible_skeletal_meshes: 45,
    dynamic_lights: 12,
    shadow_casting_lights: 8,
    material_count: 380,
    physics_bodies: 125
  };

  return (
    <div className="rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 border-b border-gray-700/50 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                AI Performance Optimizer
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Real-time
                </span>
              </h3>
              <p className="text-sm text-gray-400">Analyze, detect bottlenecks, and optimize your scene</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {report && (
              <ScoreBadge score={report.overall_score} grade={report.performance_grade} size="sm" />
            )}
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-5 space-y-6">
          {/* Controls Bar */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Platform selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Target:</span>
              <div className="flex gap-1 p-1 rounded-lg bg-gray-800/50 border border-gray-700/50">
                {PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPlatform(platform.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        selectedPlatform === platform.id
                          ? `bg-gradient-to-r ${platform.color} text-white`
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{platform.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg transition-all ${
                  autoRefresh
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-white'
                }`}
                title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={analyzePerformance}
                disabled={!isConnected || isAnalyzing}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                  !isConnected || isAnalyzing
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:brightness-110 shadow-lg shadow-orange-500/25'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Analyze Performance</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Dashboard */}
          {report ? (
            <>
              {/* Tab Navigation */}
              <div className="flex gap-1 p-1 rounded-lg bg-gray-800/50 border border-gray-700/50 w-fit">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'bottlenecks', label: `Bottlenecks (${report.bottlenecks.length})`, icon: AlertTriangle },
                  { id: 'optimizations', label: `Optimizations (${report.optimizations.length})`, icon: Rocket }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Score and Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Score Card */}
                    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-6 flex flex-col items-center justify-center">
                      <ScoreBadge score={report.overall_score} grade={report.performance_grade} />
                      <p className="mt-4 text-center text-sm text-gray-400 max-w-xs">
                        {report.ai_summary || 'Your scene performance is being analyzed...'}
                      </p>
                    </div>
                    
                    {/* Key Metrics */}
                    <div className="lg:col-span-2 rounded-xl border border-gray-700/50 bg-gray-800/30 p-6">
                      <h4 className="text-sm font-medium text-gray-400 mb-4">Real-time Metrics</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        <CircularGauge
                          value={mockMetrics.fps}
                          max={120}
                          label="FPS"
                          unit="fps"
                          size="md"
                          warning={45}
                          critical={30}
                        />
                        <CircularGauge
                          value={mockMetrics.frame_time_ms}
                          max={50}
                          label="Frame Time"
                          unit="ms"
                          size="md"
                          warning={20}
                          critical={33}
                        />
                        <CircularGauge
                          value={mockMetrics.gpu_time_ms}
                          max={33}
                          label="GPU Time"
                          unit="ms"
                          size="md"
                          warning={16}
                          critical={25}
                        />
                        <CircularGauge
                          value={mockMetrics.used_memory_mb / 1000}
                          max={16}
                          label="Memory"
                          unit="GB"
                          size="md"
                          warning={12}
                          critical={14}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Detailed Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Rendering */}
                    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-blue-400" />
                        <h4 className="font-medium text-white">Rendering</h4>
                      </div>
                      <div className="space-y-3">
                        <MetricBar
                          label="Draw Calls"
                          value={mockMetrics.draw_calls}
                          max={5000}
                          unit=""
                          icon={BarChart3}
                          color="from-blue-500 to-cyan-500"
                          warning={3000}
                          critical={4000}
                        />
                        <MetricBar
                          label="Triangles"
                          value={mockMetrics.triangles_drawn / 1000000}
                          max={10}
                          unit="M"
                          icon={Triangle}
                          color="from-purple-500 to-violet-500"
                          warning={6}
                          critical={8}
                        />
                        <MetricBar
                          label="Materials"
                          value={mockMetrics.material_count}
                          max={500}
                          unit=""
                          icon={Hexagon}
                          color="from-pink-500 to-rose-500"
                          warning={350}
                          critical={450}
                        />
                      </div>
                    </div>

                    {/* Scene Objects */}
                    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Box className="w-5 h-5 text-green-400" />
                        <h4 className="font-medium text-white">Scene Objects</h4>
                      </div>
                      <div className="space-y-3">
                        <MetricBar
                          label="Static Meshes"
                          value={mockMetrics.visible_static_meshes}
                          max={2000}
                          unit=""
                          icon={Box}
                          color="from-green-500 to-emerald-500"
                          warning={1500}
                          critical={1800}
                        />
                        <MetricBar
                          label="Dynamic Lights"
                          value={mockMetrics.dynamic_lights}
                          max={20}
                          unit=""
                          icon={Sun}
                          color="from-yellow-500 to-orange-500"
                          warning={10}
                          critical={15}
                        />
                        <MetricBar
                          label="Physics Bodies"
                          value={mockMetrics.physics_bodies}
                          max={200}
                          unit=""
                          icon={Activity}
                          color="from-red-500 to-orange-500"
                          warning={150}
                          critical={180}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-purple-400" />
                        <h4 className="font-medium text-white">Quick Presets</h4>
                      </div>
                      <span className="text-xs text-gray-500">Apply optimized settings for your target platform</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {PLATFORMS.map((platform) => {
                        const Icon = platform.icon;
                        return (
                          <button
                            key={platform.id}
                            onClick={() => applyPreset(platform.id)}
                            className={`p-4 rounded-xl border border-gray-700/50 bg-gray-800/50 hover:bg-gradient-to-br hover:${platform.color} hover:border-transparent transition-all group`}
                          >
                            <Icon className="w-8 h-8 text-gray-400 group-hover:text-white mx-auto mb-2" />
                            <div className="text-sm font-medium text-white">{platform.name}</div>
                            <div className="text-xs text-gray-500 group-hover:text-gray-300">
                              Target: {platform.target} FPS
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottlenecks Tab */}
              {activeTab === 'bottlenecks' && (
                <div className="space-y-4">
                  {report.bottlenecks.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-white mb-2">No Bottlenecks Detected</h4>
                      <p className="text-gray-400">Your scene is performing optimally!</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400">
                          Found {report.bottlenecks.length} performance bottleneck{report.bottlenecks.length !== 1 ? 's' : ''}
                        </p>
                        <button
                          onClick={() => report.bottlenecks.filter(b => b.auto_fix_available).forEach(b => fixBottleneck(b.id))}
                          className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
                        >
                          <Wrench className="w-4 h-4" />
                          Fix All Auto-fixable
                        </button>
                      </div>
                      <div className="space-y-3">
                        {report.bottlenecks.map((bottleneck) => (
                          <BottleneckCard
                            key={bottleneck.id}
                            bottleneck={bottleneck}
                            onFix={() => fixBottleneck(bottleneck.id)}
                            isFixing={fixingId === bottleneck.id}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Optimizations Tab */}
              {activeTab === 'optimizations' && (
                <div className="space-y-4">
                  {report.optimizations.length === 0 ? (
                    <div className="text-center py-12">
                      <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-white mb-2">Fully Optimized</h4>
                      <p className="text-gray-400">No further optimizations recommended at this time.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-400">
                        {report.optimizations.length} optimization{report.optimizations.length !== 1 ? 's' : ''} recommended, sorted by priority
                      </p>
                      <div className="space-y-3">
                        {report.optimizations.map((optimization, index) => (
                          <OptimizationCard
                            key={optimization.id}
                            optimization={optimization}
                            index={index}
                            onApply={() => applyOptimization(optimization.id)}
                            isApplying={applyingId === optimization.id}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
                <Gauge className="w-10 h-10 text-orange-400" />
              </div>
              <h4 className="text-lg font-medium text-white mb-2">Performance Analysis</h4>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Click "Analyze Performance" to scan your scene for bottlenecks and get AI-powered optimization recommendations.
              </p>
              <button
                onClick={analyzePerformance}
                disabled={!isConnected || isAnalyzing}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  !isConnected || isAnalyzing
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:brightness-110 shadow-lg shadow-orange-500/25'
                }`}
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Start Analysis
                  </span>
                )}
              </button>
              {!isConnected && (
                <p className="mt-4 text-sm text-yellow-400">
                  Connect to UE5 to enable performance analysis
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceOptimizer;
