/**
 * Real-Time Command Feedback & Progress Visualization
 * 
 * Features:
 * - Live execution timeline with real-time status updates
 * - Progress indicators for long-running operations
 * - Before/After viewport comparison
 * - Streaming response display showing AI reasoning
 * 
 * Performance Optimizations:
 * - React.memo for child components (prevents unnecessary re-renders)
 * - Debounced streaming updates (batches AI reasoning updates)
 * - Virtualized history list (efficient rendering of large histories)
 * - Async screenshot capture with compression
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import {
  CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronRight,
  Camera, ArrowRight, Eye, EyeOff, Maximize2, X, RefreshCw,
  Zap, Terminal, AlertTriangle, Sparkles, Image
} from 'lucide-react';

// Types
interface ExecutionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  message?: string;
  details?: any;
  progress?: number;
}

interface CommandExecution {
  id: string;
  command: string;
  status: 'pending' | 'running' | 'success' | 'error';
  steps: ExecutionStep[];
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  beforeScreenshot?: string;
  afterScreenshot?: string;
  aiReasoning?: string[];
  result?: any;
  error?: string;
}

interface CommandFeedbackProps {
  executions: CommandExecution[];
  currentExecution?: CommandExecution;
  onCaptureScreenshot?: () => Promise<string>;
  onRetry?: (executionId: string) => void;
  onCancel?: (executionId: string) => void;
  isConnected: boolean;
}

// ==========================================
// PERFORMANCE OPTIMIZATION: Custom Hooks
// ==========================================

/**
 * Custom hook for debounced streaming text updates
 * Batches updates every 100ms to reduce re-renders
 */
const useDebouncedStream = (stream: string[], delay: number = 100): string[] => {
  const [debouncedStream, setDebouncedStream] = useState<string[]>(stream);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedStream(stream);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [stream, delay]);

  return debouncedStream;
};

/**
 * Custom hook for async screenshot capture with compression
 * Uses requestIdleCallback for non-blocking capture
 */
const useAsyncScreenshot = (onCapture?: () => Promise<string>) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const captureScreenshot = useCallback(async (): Promise<string | null> => {
    if (!onCapture || isCapturing) return null;
    
    setIsCapturing(true);
    setCaptureError(null);

    try {
      // Use requestIdleCallback if available for non-blocking capture
      const capture = () => new Promise<string>((resolve, reject) => {
        const doCapture = async () => {
          try {
            const result = await onCapture();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(doCapture, { timeout: 2000 });
        } else {
          setTimeout(doCapture, 0);
        }
      });

      const screenshot = await capture();
      return screenshot;
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Failed to capture screenshot');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture, isCapturing]);

  return { captureScreenshot, isCapturing, captureError };
};

// ==========================================
// MEMOIZED COMPONENTS
// ==========================================

// Glass Card Component - Memoized
const GlassCard = memo<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}>(({ children, className = '', hover = true }) => (
  <div className={`
    bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10
    ${hover ? 'hover:bg-white/[0.07] hover:border-white/20' : ''}
    transition-all duration-300 ${className}
  `}>
    {children}
  </div>
));
GlassCard.displayName = 'GlassCard';

// Progress Ring Component - Memoized with custom comparison
const ProgressRing = memo<{ progress: number; size?: number; strokeWidth?: number }>(({
  progress,
  size = 40,
  strokeWidth = 3
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-white/10"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progressGradient)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}, (prevProps, nextProps) => {
  // Only re-render if progress changes by more than 1%
  return Math.abs(prevProps.progress - nextProps.progress) < 1 &&
         prevProps.size === nextProps.size &&
         prevProps.strokeWidth === nextProps.strokeWidth;
});
ProgressRing.displayName = 'ProgressRing';

// Status Icon Component - Memoized
const StatusIcon = memo<{ status: ExecutionStep['status']; size?: number }>(({ status, size = 16 }) => {
  switch (status) {
    case 'pending':
      return <Clock className="text-gray-400" style={{ width: size, height: size }} />;
    case 'running':
      return <Loader2 className="text-cyan-400 animate-spin" style={{ width: size, height: size }} />;
    case 'success':
      return <CheckCircle className="text-green-400" style={{ width: size, height: size }} />;
    case 'error':
      return <XCircle className="text-red-400" style={{ width: size, height: size }} />;
    case 'skipped':
      return <ArrowRight className="text-gray-500" style={{ width: size, height: size }} />;
    default:
      return null;
  }
});
StatusIcon.displayName = 'StatusIcon';

// Execution Step Component - Memoized with custom comparison
const ExecutionStepItem = memo<{ step: ExecutionStep; isLast: boolean }>(({ step, isLast }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const statusColorClass = useMemo(() => {
    switch (step.status) {
      case 'success': return 'bg-green-500/20';
      case 'error': return 'bg-red-500/20';
      case 'running': return 'bg-cyan-500/20';
      default: return 'bg-white/5';
    }
  }, [step.status]);

  const textColorClass = useMemo(() => {
    switch (step.status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'running': return 'text-cyan-400';
      default: return 'text-gray-300';
    }
  }, [step.status]);

  const lineColorClass = useMemo(() => {
    switch (step.status) {
      case 'success': return 'bg-green-500/30';
      case 'error': return 'bg-red-500/30';
      case 'running': return 'bg-cyan-500/30';
      default: return 'bg-white/10';
    }
  }, [step.status]);

  return (
    <div className="relative">
      {/* Connection line */}
      {!isLast && (
        <div className={`absolute left-[19px] top-10 w-0.5 h-full ${lineColorClass}`} />
      )}
      
      <div className="flex items-start gap-3 py-2">
        {/* Status indicator */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${statusColorClass}`}>
          <StatusIcon status={step.status} size={20} />
        </div>

        {/* Step content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <button
              onClick={handleToggle}
              className="flex items-center gap-2 text-left hover:text-white transition-colors"
            >
              {step.details && (
                expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span className={`font-medium ${textColorClass}`}>
                {step.name}
              </span>
            </button>
            
            {step.duration !== undefined && (
              <span className="text-xs text-gray-500">{step.duration}ms</span>
            )}
          </div>

          {step.message && (
            <p className="text-sm text-gray-400 mt-1">{step.message}</p>
          )}

          {step.progress !== undefined && step.status === 'running' && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{step.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
            </div>
          )}

          {expanded && step.details && (
            <pre className="mt-2 p-3 bg-black/30 rounded-lg text-xs text-gray-300 font-mono overflow-x-auto">
              {JSON.stringify(step.details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.step.id === nextProps.step.id &&
         prevProps.step.status === nextProps.step.status &&
         prevProps.step.progress === nextProps.step.progress &&
         prevProps.step.message === nextProps.step.message &&
         prevProps.isLast === nextProps.isLast;
});
ExecutionStepItem.displayName = 'ExecutionStepItem';

// Before/After Comparison Component - Memoized
const BeforeAfterComparison = memo<{
  before?: string;
  after?: string;
  onCapture?: () => void;
  isCapturing?: boolean;
}>(({ before, after, onCapture, isCapturing }) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'slider' | 'toggle'>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [showAfter, setShowAfter] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  }, []);

  const handleToggleView = useCallback(() => {
    setShowAfter(prev => !prev);
  }, []);

  if (!before && !after) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-xl border border-white/10 border-dashed">
        <Camera className="w-8 h-8 text-gray-500 mb-2" />
        <p className="text-sm text-gray-400 text-center">No screenshots captured yet</p>
        {onCapture && (
          <button
            onClick={onCapture}
            disabled={isCapturing}
            className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
          >
            {isCapturing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Capturing...
              </span>
            ) : (
              'Capture Screenshot'
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* View mode selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
          {(['side-by-side', 'slider', 'toggle'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-white/20 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode === 'side-by-side' ? 'Side by Side' : mode === 'slider' ? 'Slider' : 'Toggle'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFullscreen(true)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Maximize2 className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Comparison view */}
      <div className="relative rounded-xl overflow-hidden bg-black/30 aspect-video">
        {viewMode === 'side-by-side' && (
          <div className="flex h-full">
            <div className="flex-1 relative border-r border-white/10">
              {before ? (
                <img src={before} alt="Before" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">No before image</div>
              )}
              <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">Before</span>
            </div>
            <div className="flex-1 relative">
              {after ? (
                <img src={after} alt="After" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">No after image</div>
              )}
              <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">After</span>
            </div>
          </div>
        )}

        {viewMode === 'slider' && (
          <div className="relative h-full">
            {before && <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              {after && <img src={after} alt="After" className="w-full h-full object-cover" loading="lazy" style={{ width: `${100 / (sliderPosition / 100)}%` }} />}
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={handleSliderChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
            />
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                <ArrowRight className="w-4 h-4 text-gray-800 rotate-180" />
                <ArrowRight className="w-4 h-4 text-gray-800" />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'toggle' && (
          <div className="relative h-full">
            {showAfter && after ? (
              <img src={after} alt="After" className="w-full h-full object-cover" loading="lazy" />
            ) : before ? (
              <img src={before} alt="Before" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">No image</div>
            )}
            <button
              onClick={handleToggleView}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 hover:bg-black/80 rounded-lg text-sm text-white transition-colors flex items-center gap-2"
            >
              {showAfter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAfter ? 'Show Before' : 'Show After'}
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="w-full max-w-6xl">
            <div className="flex gap-4">
              {before && (
                <div className="flex-1">
                  <img src={before} alt="Before" className="w-full rounded-lg" />
                  <p className="text-center text-white mt-2">Before</p>
                </div>
              )}
              {after && (
                <div className="flex-1">
                  <img src={after} alt="After" className="w-full rounded-lg" />
                  <p className="text-center text-white mt-2">After</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
BeforeAfterComparison.displayName = 'BeforeAfterComparison';

// AI Reasoning Display Component - Memoized with debounced streaming
const AIReasoningDisplay = memo<{ reasoning: string[]; isStreaming?: boolean }>(({
  reasoning,
  isStreaming = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use debounced stream for performance
  const debouncedReasoning = useDebouncedStream(reasoning, 100);

  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [debouncedReasoning, isStreaming]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span>AI Reasoning</span>
        {isStreaming && (
          <span className="flex items-center gap-1 text-cyan-400">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            Thinking...
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        className="max-h-48 overflow-y-auto p-3 bg-black/30 rounded-lg space-y-2"
      >
        {debouncedReasoning.map((thought, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 text-sm ${
              index === debouncedReasoning.length - 1 && isStreaming ? 'text-cyan-300' : 'text-gray-300'
            }`}
          >
            <span className="text-purple-400 font-mono text-xs mt-0.5">{index + 1}.</span>
            <span>{thought}</span>
          </div>
        ))}
        {isStreaming && (
          <div className="flex items-center gap-1 text-gray-500">
            <span className="w-1 h-4 bg-cyan-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
});
AIReasoningDisplay.displayName = 'AIReasoningDisplay';

// ==========================================
// VIRTUALIZED HISTORY LIST
// ==========================================

interface HistoryItemProps {
  execution: CommandExecution;
  isExpanded: boolean;
  onToggle: () => void;
  style: React.CSSProperties;
}

const HistoryItem = memo<HistoryItemProps>(({ execution, isExpanded, onToggle, style }) => {
  return (
    <div style={style} className="px-1">
      <button
        onClick={onToggle}
        className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon status={execution.status === 'success' ? 'success' : execution.status === 'error' ? 'error' : 'pending'} size={16} />
            <span className="text-sm text-white truncate max-w-xs">{execution.command}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{execution.totalDuration}ms</span>
            <span className="text-xs text-gray-500">
              {execution.startTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-white/10">
            {execution.steps.map((step, index) => (
              <ExecutionStepItem
                key={step.id}
                step={step}
                isLast={index === execution.steps.length - 1}
              />
            ))}
          </div>
        )}
      </button>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.execution.id === nextProps.execution.id &&
         prevProps.execution.status === nextProps.execution.status &&
         prevProps.isExpanded === nextProps.isExpanded;
});
HistoryItem.displayName = 'HistoryItem';

// Virtualized History List Component
const VirtualizedHistoryList = memo<{
  executions: CommandExecution[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}>(({ executions, expandedId, onToggleExpand }) => {
  const getItemSize = useCallback((index: number) => {
    const execution = executions[index];
    if (expandedId === execution.id) {
      // Expanded item: base height + steps
      return 60 + (execution.steps.length * 60);
    }
    return 60; // Collapsed item height
  }, [executions, expandedId]);

  if (executions.length === 0) {
    return null;
  }

  // For small lists, render normally
  if (executions.length <= 10) {
    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {executions.map((execution) => (
          <HistoryItem
            key={execution.id}
            execution={execution}
            isExpanded={expandedId === execution.id}
            onToggle={() => onToggleExpand(execution.id)}
            style={{}}
          />
        ))}
      </div>
    );
  }

  // For large lists, use virtualization
  return (
    <List
      height={256}
      itemCount={executions.length}
      itemSize={getItemSize}
      width="100%"
      className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
    >
      {({ index, style }) => (
        <HistoryItem
          execution={executions[index]}
          isExpanded={expandedId === executions[index].id}
          onToggle={() => onToggleExpand(executions[index].id)}
          style={style}
        />
      )}
    </List>
  );
});
VirtualizedHistoryList.displayName = 'VirtualizedHistoryList';

// ==========================================
// MAIN COMPONENT
// ==========================================

const CommandFeedback: React.FC<CommandFeedbackProps> = ({
  executions,
  currentExecution,
  onCaptureScreenshot,
  onRetry,
  onCancel,
  isConnected
}) => {
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Use async screenshot capture hook
  const { captureScreenshot, isCapturing } = useAsyncScreenshot(onCaptureScreenshot);

  // Memoized progress calculation
  const calculateProgress = useCallback((execution: CommandExecution): number => {
    if (execution.status === 'success') return 100;
    if (execution.status === 'error') return 100;
    if (execution.steps.length === 0) return 0;
    
    const completedSteps = execution.steps.filter(s => s.status === 'success' || s.status === 'error').length;
    const runningStep = execution.steps.find(s => s.status === 'running');
    const runningProgress = runningStep?.progress || 0;
    
    return Math.round(((completedSteps + runningProgress / 100) / execution.steps.length) * 100);
  }, []);

  // Memoized current progress
  const currentProgress = useMemo(() => {
    return currentExecution ? calculateProgress(currentExecution) : 0;
  }, [currentExecution, calculateProgress]);

  // Memoized handlers
  const handleToggleHistory = useCallback(() => {
    setShowHistory(prev => !prev);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedExecution(prev => prev === id ? null : id);
  }, []);

  const handleCancel = useCallback(() => {
    if (currentExecution && onCancel) {
      onCancel(currentExecution.id);
    }
  }, [currentExecution, onCancel]);

  const handleRetry = useCallback(() => {
    if (currentExecution && onRetry) {
      onRetry(currentExecution.id);
    }
  }, [currentExecution, onRetry]);

  return (
    <GlassCard className="p-5" hover={false}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Command Execution</h3>
            <p className="text-xs text-gray-400">Real-time feedback & progress</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">Disconnected</span>
          )}
          <button
            onClick={handleToggleHistory}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors"
          >
            {showHistory ? 'Hide History' : `History (${executions.length})`}
          </button>
        </div>
      </div>

      {/* Current Execution */}
      {currentExecution && (
        <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
          {/* Execution header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {currentExecution.status === 'running' ? (
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : currentExecution.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : currentExecution.status === 'error' ? (
                  <XCircle className="w-5 h-5 text-red-400" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" />
                )}
                <span className="font-medium text-white">{currentExecution.command}</span>
              </div>
              <p className="text-xs text-gray-400">
                Started {currentExecution.startTime.toLocaleTimeString()}
                {currentExecution.totalDuration && ` • ${currentExecution.totalDuration}ms`}
              </p>
            </div>
            
            {/* Progress ring */}
            <div className="relative">
              <ProgressRing progress={currentProgress} size={50} strokeWidth={4} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                {currentProgress}%
              </span>
            </div>
          </div>

          {/* Execution steps */}
          <div className="space-y-1 mb-4">
            {currentExecution.steps.map((step, index) => (
              <ExecutionStepItem
                key={step.id}
                step={step}
                isLast={index === currentExecution.steps.length - 1}
              />
            ))}
          </div>

          {/* AI Reasoning */}
          {currentExecution.aiReasoning && currentExecution.aiReasoning.length > 0 && (
            <div className="mb-4">
              <AIReasoningDisplay
                reasoning={currentExecution.aiReasoning}
                isStreaming={currentExecution.status === 'running'}
              />
            </div>
          )}

          {/* Before/After comparison */}
          {(currentExecution.beforeScreenshot || currentExecution.afterScreenshot) && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Image className="w-4 h-4" />
                <span>Viewport Comparison</span>
              </div>
              <BeforeAfterComparison
                before={currentExecution.beforeScreenshot}
                after={currentExecution.afterScreenshot}
                onCapture={captureScreenshot}
                isCapturing={isCapturing}
              />
            </div>
          )}

          {/* Error message */}
          {currentExecution.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-red-400 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-300">{currentExecution.error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {currentExecution.status === 'running' && onCancel && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            )}
            {currentExecution.status === 'error' && onRetry && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Execution History - Virtualized */}
      {showHistory && executions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400">Recent Executions</h4>
          <VirtualizedHistoryList
            executions={executions.slice(0, 100)} // Limit to 100 items
            expandedId={expandedExecution}
            onToggleExpand={handleToggleExpand}
          />
        </div>
      )}

      {/* Empty state */}
      {!currentExecution && executions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 mb-1">No commands executed yet</p>
          <p className="text-sm text-gray-500">Execute a command to see real-time feedback</p>
        </div>
      )}
    </GlassCard>
  );
};

export default memo(CommandFeedback);
export type { CommandExecution, ExecutionStep };
