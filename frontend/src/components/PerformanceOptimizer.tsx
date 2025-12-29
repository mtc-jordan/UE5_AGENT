import React, { useState, useEffect, useCallback } from 'react';

// ==================== TYPES ====================

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  gpuTime: number;
  cpuTime: number;
  drawCalls: number;
  triangles: number;
  memoryUsed: number;
  memoryTotal: number;
  textureMemory: number;
  meshMemory: number;
}

interface Bottleneck {
  id: string;
  category: 'gpu' | 'cpu' | 'memory' | 'rendering' | 'lighting' | 'physics';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  autoFixable: boolean;
  fixAction?: string;
}

interface Optimization {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  estimatedImprovement: string;
  risk: 'low' | 'medium' | 'high';
  steps: string[];
  autoApplicable: boolean;
}

interface PerformanceAnalysis {
  metrics: PerformanceMetrics;
  score: number;
  grade: string;
  bottlenecks: Bottleneck[];
  optimizations: Optimization[];
  timestamp: string;
}

interface Props {
  authToken: string;
  isConnected: boolean;
}

// ==================== HELPER COMPONENTS ====================

// Circular Gauge Component using design tokens
const CircularGauge: React.FC<{
  value: number;
  max: number;
  label: string;
  unit: string;
  warningThreshold: number;
  criticalThreshold: number;
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
}> = ({ value, max, label, unit, warningThreshold, criticalThreshold, size = 'md', inverted = false }) => {
  const sizes = {
    sm: { width: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-xs' },
    md: { width: 100, strokeWidth: 8, fontSize: 'text-xl', labelSize: 'text-xs' },
    lg: { width: 120, strokeWidth: 10, fontSize: 'text-2xl', labelSize: 'text-sm' }
  };
  
  const { width, strokeWidth, fontSize, labelSize } = sizes[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const offset = circumference - (percentage * circumference);
  
  // Determine color based on thresholds
  let status: 'success' | 'warning' | 'error' = 'success';
  if (inverted) {
    if (value <= criticalThreshold) status = 'error';
    else if (value <= warningThreshold) status = 'warning';
  } else {
    if (value >= criticalThreshold) status = 'error';
    else if (value >= warningThreshold) status = 'warning';
  }
  
  const colors = {
    success: { stroke: 'var(--color-success-500)', glow: 'var(--shadow-glow-green)', text: 'text-emerald-400' },
    warning: { stroke: 'var(--color-warning-500)', glow: 'var(--shadow-glow-orange)', text: 'text-yellow-400' },
    error: { stroke: 'var(--color-error-500)', glow: 'var(--shadow-glow-red)', text: 'text-red-400' }
  };
  
  const color = colors[status];
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width, height: width }}>
        {/* Background track */}
        <svg className="transform -rotate-90" width={width} height={width}>
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="var(--gauge-track-color)"
            strokeWidth={strokeWidth}
          />
          {/* Value arc */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset var(--duration-slowest) var(--ease-out), stroke var(--duration-normal) var(--ease-in-out)',
              filter: `drop-shadow(0 0 var(--gauge-glow-blur) ${color.stroke})`
            }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${fontSize} ${color.text}`}>
            {value.toFixed(value < 10 ? 1 : 0)}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{unit}</span>
        </div>
      </div>
      <span className={`${labelSize} text-gray-400 font-medium`}>{label}</span>
    </div>
  );
};

// Metric Bar Component
const MetricBar: React.FC<{
  label: string;
  value: number;
  max: number;
  unit: string;
  warningThreshold: number;
  criticalThreshold: number;
  icon: string;
}> = ({ label, value, max, unit, warningThreshold, criticalThreshold, icon }) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  let status: 'success' | 'warning' | 'error' = 'success';
  if (value >= criticalThreshold) status = 'error';
  else if (value >= warningThreshold) status = 'warning';
  
  const gradients = {
    success: 'var(--gradient-success)',
    warning: 'var(--gradient-warning)',
    error: 'var(--gradient-error)'
  };
  
  const textColors = {
    success: 'text-emerald-400',
    warning: 'text-yellow-400',
    error: 'text-red-400'
  };
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${textColors[status]}`}>
          {value.toLocaleString()} {unit}
        </span>
      </div>
      <div 
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--metric-bar-bg)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            background: gradients[status],
            boxShadow: status !== 'success' ? `0 0 10px ${status === 'error' ? 'var(--color-error-500)' : 'var(--color-warning-500)'}` : 'none',
            transition: 'width var(--duration-slow) var(--ease-out)'
          }}
        />
      </div>
    </div>
  );
};

// Score Badge Component
const ScoreBadge: React.FC<{ score: number; grade: string; size?: 'sm' | 'lg' }> = ({ score, grade, size = 'lg' }) => {
  const gradeColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    'A': { bg: 'from-emerald-500/20 to-green-600/20', border: 'border-emerald-500/50', text: 'text-emerald-400', glow: 'shadow-glow-green' },
    'B': { bg: 'from-cyan-500/20 to-blue-600/20', border: 'border-cyan-500/50', text: 'text-cyan-400', glow: 'shadow-glow-blue' },
    'C': { bg: 'from-yellow-500/20 to-orange-600/20', border: 'border-yellow-500/50', text: 'text-yellow-400', glow: 'shadow-glow-orange' },
    'D': { bg: 'from-orange-500/20 to-red-600/20', border: 'border-orange-500/50', text: 'text-orange-400', glow: 'shadow-glow-orange' },
    'F': { bg: 'from-red-500/20 to-red-700/20', border: 'border-red-500/50', text: 'text-red-400', glow: 'shadow-glow-red' }
  };
  
  const colors = gradeColors[grade] || gradeColors['F'];
  const sizeClasses = size === 'lg' 
    ? 'w-32 h-32 text-5xl' 
    : 'w-20 h-20 text-3xl';
  
  return (
    <div 
      className={`${sizeClasses} rounded-full bg-gradient-to-br ${colors.bg} border-2 ${colors.border} 
        flex flex-col items-center justify-center ${colors.glow} transition-all hover:scale-105`}
      style={{ transition: 'var(--transition-transform)' }}
    >
      <span className={`font-bold ${colors.text}`}>{grade}</span>
      <span className="text-xs text-gray-400 font-medium">{score}/100</span>
    </div>
  );
};

// Bottleneck Card Component
const BottleneckCard: React.FC<{
  bottleneck: Bottleneck;
  onFix: (id: string) => void;
  isFixing: boolean;
}> = ({ bottleneck, onFix, isFixing }) => {
  const severityConfig = {
    critical: { 
      icon: '🔥', 
      class: 'severity-critical',
      borderClass: 'border-l-red-500'
    },
    high: { 
      icon: '⚠️', 
      class: 'severity-high',
      borderClass: 'border-l-orange-500'
    },
    medium: { 
      icon: '📊', 
      class: 'severity-medium',
      borderClass: 'border-l-yellow-500'
    },
    low: { 
      icon: 'ℹ️', 
      class: 'severity-low',
      borderClass: 'border-l-blue-500'
    }
  };
  
  const categoryIcons: Record<string, string> = {
    gpu: '🎮',
    cpu: '💻',
    memory: '🧠',
    rendering: '🖼️',
    lighting: '💡',
    physics: '⚡'
  };
  
  const config = severityConfig[bottleneck.severity];
  
  return (
    <div 
      className={`glass-card-light p-4 border-l-4 ${config.borderClass} hover:scale-[1.02] cursor-pointer`}
      style={{ transition: 'var(--transition-transform)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{config.icon}</span>
            <span className="text-lg">{categoryIcons[bottleneck.category]}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${config.class}`}>
              {bottleneck.severity}
            </span>
          </div>
          <h4 className="font-semibold text-white mb-1">{bottleneck.title}</h4>
          <p className="text-sm text-gray-400 mb-2">{bottleneck.description}</p>
          <p className="text-xs text-gray-500">
            <span className="text-orange-400">Impact:</span> {bottleneck.impact}
          </p>
        </div>
        
        {bottleneck.autoFixable && (
          <button
            onClick={() => onFix(bottleneck.id)}
            disabled={isFixing}
            className="btn-gradient-performance px-4 py-2 rounded-lg text-sm font-medium 
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isFixing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fixing...
              </>
            ) : (
              <>
                <span>🔧</span>
                Fix
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// Optimization Card Component
const OptimizationCard: React.FC<{
  optimization: Optimization;
  onApply: (id: string) => void;
  isApplying: boolean;
}> = ({ optimization, onApply, isApplying }) => {
  const [expanded, setExpanded] = useState(false);
  
  const riskColors = {
    low: 'text-emerald-400 bg-emerald-500/20',
    medium: 'text-yellow-400 bg-yellow-500/20',
    high: 'text-red-400 bg-red-500/20'
  };
  
  return (
    <div 
      className="glass-card p-4 hover:border-orange-500/30"
      style={{ transition: 'var(--transition-all)' }}
    >
      <div className="flex items-start gap-4">
        {/* Priority Badge */}
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg text-white flex-shrink-0"
          style={{ background: 'var(--gradient-performance)' }}
        >
          {optimization.priority}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-white">{optimization.title}</h4>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskColors[optimization.risk]}`}>
              {optimization.risk} risk
            </span>
          </div>
          
          <p className="text-sm text-gray-400 mb-3">{optimization.description}</p>
          
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-400">
              📈 Est. improvement: <strong>{optimization.estimatedImprovement}</strong>
            </span>
            <span className="text-gray-500">
              📁 {optimization.category}
            </span>
          </div>
          
          {/* Expandable Steps */}
          {optimization.steps.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                style={{ transition: 'var(--transition-colors)' }}
              >
                <span style={{ 
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'var(--transition-transform)',
                  display: 'inline-block'
                }}>▶</span>
                {expanded ? 'Hide steps' : `Show ${optimization.steps.length} steps`}
              </button>
              
              {expanded && (
                <ol className="mt-2 space-y-1 pl-4 text-sm text-gray-400 list-decimal animate-fade-in-up">
                  {optimization.steps.map((step, idx) => (
                    <li key={idx} className="pl-1">{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
        
        {/* Apply Button */}
        {optimization.autoApplicable && (
          <button
            onClick={() => onApply(optimization.id)}
            disabled={isApplying}
            className="btn-gradient-performance px-4 py-2 rounded-lg text-sm font-medium 
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
          >
            {isApplying ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Applying...
              </>
            ) : (
              <>
                <span>🚀</span>
                Apply
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// Platform Preset Button
const PresetButton: React.FC<{
  name: string;
  icon: string;
  target: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ name, icon, target, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all
      ${isActive 
        ? 'bg-gradient-to-br from-orange-500/20 to-red-600/20 border-orange-500/50 glow-orange' 
        : 'glass-card-light border-transparent hover:border-gray-600'
      }`}
    style={{ transition: 'var(--transition-all)' }}
  >
    <span className="text-2xl">{icon}</span>
    <span className="text-sm font-medium text-white">{name}</span>
    <span className="text-xs text-gray-500">{target}</span>
  </button>
);

// ==================== MAIN COMPONENT ====================

const PerformanceOptimizer: React.FC<Props> = ({ authToken, isConnected }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'bottlenecks' | 'optimizations'>('overview');
  const [analysis, setAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Fetch performance analysis
  const fetchAnalysis = useCallback(async () => {
    if (!authToken || !isConnected) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/performance/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to fetch performance analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [authToken, isConnected]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && isConnected) {
      const interval = setInterval(fetchAnalysis, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isConnected, fetchAnalysis]);

  // Handle bottleneck fix
  const handleFix = async (bottleneckId: string) => {
    if (!authToken) return;
    
    setIsFixing(bottleneckId);
    try {
      const response = await fetch('/api/performance/optimize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bottleneck_id: bottleneckId })
      });
      
      if (response.ok) {
        await fetchAnalysis();
      }
    } catch (error) {
      console.error('Failed to fix bottleneck:', error);
    } finally {
      setIsFixing(null);
    }
  };

  // Handle optimization apply
  const handleApply = async (optimizationId: string) => {
    if (!authToken) return;
    
    setIsApplying(optimizationId);
    try {
      const response = await fetch('/api/performance/optimize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ optimization_id: optimizationId })
      });
      
      if (response.ok) {
        await fetchAnalysis();
      }
    } catch (error) {
      console.error('Failed to apply optimization:', error);
    } finally {
      setIsApplying(null);
    }
  };

  // Handle preset apply
  const handlePresetApply = async (preset: string) => {
    if (!authToken) return;
    
    setActivePreset(preset);
    try {
      const response = await fetch('/api/performance/apply-preset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ preset })
      });
      
      if (response.ok) {
        await fetchAnalysis();
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
  };

  // Default metrics for demo
  const metrics = analysis?.metrics || {
    fps: 45,
    frameTime: 22.2,
    gpuTime: 18.5,
    cpuTime: 12.3,
    drawCalls: 2500,
    triangles: 5200000,
    memoryUsed: 4200,
    memoryTotal: 8192,
    textureMemory: 1800,
    meshMemory: 1200
  };

  const score = analysis?.score || 72;
  const grade = analysis?.grade || 'C';

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer border-b"
        style={{ 
          background: 'var(--gradient-performance-subtle)',
          borderColor: 'var(--border-primary)'
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--gradient-performance)' }}
          >
            <span className="text-xl">📊</span>
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              AI Performance Optimizer
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400">
                Real-time
              </span>
            </h3>
            <p className="text-sm text-gray-400">Analyze and optimize scene performance</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAutoRefresh(!autoRefresh);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all
              ${autoRefresh 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' 
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
          >
            <svg 
              className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Auto
          </button>
          
          {/* Analyze button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchAnalysis();
            }}
            disabled={isAnalyzing || !isConnected}
            className="btn-gradient-performance px-4 py-1.5 rounded-lg text-sm font-medium 
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <span>🔍</span>
                Analyze
              </>
            )}
          </button>
          
          {/* Collapse toggle */}
          <span 
            className="text-gray-400 transition-transform"
            style={{ 
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'var(--transition-transform)'
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-5">
          {!isConnected ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔌</div>
              <p className="text-gray-400">Connect to UE5 to analyze performance</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-gray-800/50 mb-6">
                {(['overview', 'bottlenecks', 'optimizations'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all
                      ${activeTab === tab 
                        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                  >
                    {tab === 'bottlenecks' && analysis?.bottlenecks.length ? (
                      <span className="flex items-center justify-center gap-2">
                        {tab}
                        <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-400 text-xs">
                          {analysis.bottlenecks.length}
                        </span>
                      </span>
                    ) : tab === 'optimizations' && analysis?.optimizations.length ? (
                      <span className="flex items-center justify-center gap-2">
                        {tab}
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-400 text-xs">
                          {analysis.optimizations.length}
                        </span>
                      </span>
                    ) : (
                      tab
                    )}
                  </button>
                ))}
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in-up">
                  {/* Key Metrics with Gauges */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <CircularGauge
                        value={metrics.fps}
                        max={120}
                        label="FPS"
                        unit="fps"
                        warningThreshold={45}
                        criticalThreshold={30}
                        size="lg"
                        inverted
                      />
                      <CircularGauge
                        value={metrics.frameTime}
                        max={50}
                        label="Frame Time"
                        unit="ms"
                        warningThreshold={22}
                        criticalThreshold={33}
                        size="md"
                      />
                      <CircularGauge
                        value={metrics.gpuTime}
                        max={33}
                        label="GPU Time"
                        unit="ms"
                        warningThreshold={16}
                        criticalThreshold={25}
                        size="md"
                      />
                      <CircularGauge
                        value={(metrics.memoryUsed / metrics.memoryTotal) * 100}
                        max={100}
                        label="Memory"
                        unit="%"
                        warningThreshold={70}
                        criticalThreshold={90}
                        size="md"
                      />
                    </div>
                    
                    {/* Score Badge */}
                    <ScoreBadge score={score} grade={grade} size="lg" />
                  </div>

                  {/* Detailed Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card-light p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Rendering</h4>
                      <MetricBar
                        label="Draw Calls"
                        value={metrics.drawCalls}
                        max={5000}
                        unit=""
                        warningThreshold={3000}
                        criticalThreshold={4500}
                        icon="🎨"
                      />
                      <MetricBar
                        label="Triangles"
                        value={metrics.triangles / 1000000}
                        max={10}
                        unit="M"
                        warningThreshold={5}
                        criticalThreshold={8}
                        icon="📐"
                      />
                    </div>
                    
                    <div className="glass-card-light p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Memory</h4>
                      <MetricBar
                        label="Texture Memory"
                        value={metrics.textureMemory}
                        max={4096}
                        unit="MB"
                        warningThreshold={2500}
                        criticalThreshold={3500}
                        icon="🖼️"
                      />
                      <MetricBar
                        label="Mesh Memory"
                        value={metrics.meshMemory}
                        max={2048}
                        unit="MB"
                        warningThreshold={1200}
                        criticalThreshold={1800}
                        icon="📦"
                      />
                    </div>
                  </div>

                  {/* Platform Presets */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                      Platform Presets
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      <PresetButton
                        name="PC Ultra"
                        icon="🖥️"
                        target="60+ FPS"
                        isActive={activePreset === 'pc_ultra'}
                        onClick={() => handlePresetApply('pc_ultra')}
                      />
                      <PresetButton
                        name="PC High"
                        icon="💻"
                        target="60 FPS"
                        isActive={activePreset === 'pc_high'}
                        onClick={() => handlePresetApply('pc_high')}
                      />
                      <PresetButton
                        name="Console"
                        icon="🎮"
                        target="60 FPS"
                        isActive={activePreset === 'console'}
                        onClick={() => handlePresetApply('console')}
                      />
                      <PresetButton
                        name="Mobile"
                        icon="📱"
                        target="30 FPS"
                        isActive={activePreset === 'mobile'}
                        onClick={() => handlePresetApply('mobile')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottlenecks Tab */}
              {activeTab === 'bottlenecks' && (
                <div className="space-y-4 animate-fade-in-up">
                  {analysis?.bottlenecks && analysis.bottlenecks.length > 0 ? (
                    analysis.bottlenecks.map((bottleneck) => (
                      <BottleneckCard
                        key={bottleneck.id}
                        bottleneck={bottleneck}
                        onFix={handleFix}
                        isFixing={isFixing === bottleneck.id}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">✅</div>
                      <p className="text-gray-400">No bottlenecks detected</p>
                      <p className="text-sm text-gray-500 mt-1">Your scene is performing well!</p>
                    </div>
                  )}
                </div>
              )}

              {/* Optimizations Tab */}
              {activeTab === 'optimizations' && (
                <div className="space-y-4 animate-fade-in-up">
                  {analysis?.optimizations && analysis.optimizations.length > 0 ? (
                    analysis.optimizations.map((optimization) => (
                      <OptimizationCard
                        key={optimization.id}
                        optimization={optimization}
                        onApply={handleApply}
                        isApplying={isApplying === optimization.id}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">🎉</div>
                      <p className="text-gray-400">No optimizations needed</p>
                      <p className="text-sm text-gray-500 mt-1">Your scene is already optimized!</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceOptimizer;
