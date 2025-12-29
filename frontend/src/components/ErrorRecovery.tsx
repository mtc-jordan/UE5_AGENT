/**
 * Intelligent Error Recovery & Suggestions
 * 
 * Features:
 * - Smart error analysis with plain language explanations
 * - Auto-suggested fixes based on common error patterns
 * - Retry with modifications button
 * - Context-aware suggestions based on scene state
 * - Undo/Redo with preview
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Lightbulb,
  ChevronDown, ChevronRight, Zap, ArrowRight, Eye, EyeOff,
  Wand2, Target, HelpCircle, Copy,
  Undo2, Redo2, History, Shield, Bug, Wrench, Info
} from 'lucide-react';

// Types
interface ErrorPattern {
  id: string;
  pattern: RegExp;
  category: 'connection' | 'permission' | 'resource' | 'syntax' | 'state' | 'unknown';
  title: string;
  explanation: string;
  suggestions: ErrorSuggestion[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ErrorSuggestion {
  id: string;
  title: string;
  description: string;
  action: 'retry' | 'modify' | 'manual' | 'skip' | 'undo';
  autoFix?: string; // Modified command to try
  confidence: number; // 0-100
}

interface ErrorAnalysis {
  originalError: string;
  category: ErrorPattern['category'];
  title: string;
  explanation: string;
  suggestions: ErrorSuggestion[];
  severity: ErrorPattern['severity'];
  relatedDocs?: string;
  timestamp: Date;
}

interface UndoAction {
  id: string;
  command: string;
  description: string;
  timestamp: Date;
  canUndo: boolean;
  undoCommand?: string;
  preview?: {
    before: any;
    after: any;
  };
}

interface SceneContext {
  selectedActors: string[];
  actorCount: number;
  hasUnsavedChanges: boolean;
  currentLevel: string;
  playMode: boolean;
}

interface ErrorRecoveryProps {
  error?: string;
  command?: string;
  sceneContext?: SceneContext;
  undoHistory: UndoAction[];
  redoHistory: UndoAction[];
  onRetry: (modifiedCommand?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDismiss: () => void;
  onApplySuggestion: (suggestion: ErrorSuggestion) => void;
  isConnected: boolean;
}

// Error patterns database
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    id: 'connection-lost',
    pattern: /connection|disconnect|timeout|unreachable/i,
    category: 'connection',
    title: 'Connection Lost',
    explanation: 'The connection to Unreal Engine was interrupted. This can happen if UE5 crashed, the MCP bridge stopped, or there was a network issue.',
    suggestions: [
      { id: 'retry-connection', title: 'Retry Connection', description: 'Attempt to reconnect to UE5', action: 'retry', confidence: 80 },
      { id: 'check-ue5', title: 'Check UE5 Status', description: 'Verify that Unreal Engine is running and responsive', action: 'manual', confidence: 90 },
      { id: 'restart-bridge', title: 'Restart MCP Bridge', description: 'Restart the MCP bridge plugin in UE5', action: 'manual', confidence: 70 },
    ],
    severity: 'high',
  },
  {
    id: 'actor-not-found',
    pattern: /actor.*not found|no actor|invalid actor|actor.*does not exist/i,
    category: 'resource',
    title: 'Actor Not Found',
    explanation: 'The specified actor could not be found in the current level. It may have been deleted, renamed, or the name was misspelled.',
    suggestions: [
      { id: 'select-actor', title: 'Select Actor First', description: 'Select the target actor in the viewport before running the command', action: 'manual', confidence: 85 },
      { id: 'list-actors', title: 'List Available Actors', description: 'Get a list of all actors in the current level', action: 'modify', autoFix: 'List all actors in the current level', confidence: 75 },
      { id: 'check-spelling', title: 'Check Actor Name', description: 'Verify the actor name is spelled correctly', action: 'manual', confidence: 60 },
    ],
    severity: 'medium',
  },
  {
    id: 'no-selection',
    pattern: /no.*select|nothing.*select|selection.*empty|no actors selected/i,
    category: 'state',
    title: 'No Selection',
    explanation: 'The command requires one or more actors to be selected, but nothing is currently selected in the viewport.',
    suggestions: [
      { id: 'select-all', title: 'Select All Actors', description: 'Select all actors in the current level', action: 'modify', autoFix: 'Select all actors in the level', confidence: 70 },
      { id: 'select-by-type', title: 'Select by Type', description: 'Select all actors of a specific type', action: 'modify', autoFix: 'Select all StaticMeshActors', confidence: 65 },
      { id: 'manual-select', title: 'Select Manually', description: 'Click on an actor in the UE5 viewport to select it', action: 'manual', confidence: 95 },
    ],
    severity: 'low',
  },
  {
    id: 'permission-denied',
    pattern: /permission|access denied|unauthorized|forbidden/i,
    category: 'permission',
    title: 'Permission Denied',
    explanation: 'The operation was blocked due to insufficient permissions. This might be a read-only asset or a protected system object.',
    suggestions: [
      { id: 'check-readonly', title: 'Check Read-Only Status', description: 'Verify the asset is not marked as read-only', action: 'manual', confidence: 80 },
      { id: 'checkout-asset', title: 'Checkout Asset', description: 'If using source control, checkout the asset first', action: 'manual', confidence: 70 },
      { id: 'duplicate-modify', title: 'Duplicate and Modify', description: 'Create a copy of the asset and modify the copy instead', action: 'modify', autoFix: 'Duplicate the selected asset and modify the copy', confidence: 60 },
    ],
    severity: 'medium',
  },
  {
    id: 'invalid-parameter',
    pattern: /invalid.*param|wrong.*type|expected.*got|type mismatch|invalid value/i,
    category: 'syntax',
    title: 'Invalid Parameter',
    explanation: 'One or more parameters provided to the command are invalid or of the wrong type.',
    suggestions: [
      { id: 'check-params', title: 'Review Parameters', description: 'Check that all parameter values are valid', action: 'manual', confidence: 85 },
      { id: 'use-defaults', title: 'Use Default Values', description: 'Try the command with default parameter values', action: 'modify', confidence: 70 },
      { id: 'show-help', title: 'Show Command Help', description: 'Display help information for this command', action: 'manual', confidence: 60 },
    ],
    severity: 'medium',
  },
  {
    id: 'play-mode-active',
    pattern: /play.*mode|PIE|simulation|game.*running/i,
    category: 'state',
    title: 'Play Mode Active',
    explanation: 'Some operations cannot be performed while Play-in-Editor (PIE) mode is active.',
    suggestions: [
      { id: 'stop-play', title: 'Stop Play Mode', description: 'Stop the current play session before executing', action: 'modify', autoFix: 'Stop play mode and then execute the original command', confidence: 90 },
      { id: 'wait-stop', title: 'Wait for Stop', description: 'Wait until play mode ends naturally', action: 'manual', confidence: 50 },
    ],
    severity: 'low',
  },
  {
    id: 'asset-not-found',
    pattern: /asset.*not found|missing.*asset|failed.*load.*asset|cannot find asset/i,
    category: 'resource',
    title: 'Asset Not Found',
    explanation: 'The referenced asset could not be found in the project. It may have been moved, renamed, or deleted.',
    suggestions: [
      { id: 'search-asset', title: 'Search for Asset', description: 'Search the content browser for the asset', action: 'manual', confidence: 80 },
      { id: 'fix-reference', title: 'Fix Reference', description: 'Update the asset reference to the correct path', action: 'manual', confidence: 70 },
      { id: 'create-asset', title: 'Create New Asset', description: 'Create a new asset if the original is missing', action: 'modify', confidence: 50 },
    ],
    severity: 'medium',
  },
  {
    id: 'blueprint-compile-error',
    pattern: /blueprint.*error|compile.*fail|node.*error|blueprint.*broken/i,
    category: 'syntax',
    title: 'Blueprint Compile Error',
    explanation: 'The blueprint failed to compile due to errors in the node graph.',
    suggestions: [
      { id: 'open-blueprint', title: 'Open Blueprint Editor', description: 'Open the blueprint to see detailed error messages', action: 'manual', confidence: 90 },
      { id: 'recompile', title: 'Force Recompile', description: 'Try recompiling the blueprint', action: 'retry', confidence: 60 },
      { id: 'check-nodes', title: 'Check Node Connections', description: 'Verify all nodes are properly connected', action: 'manual', confidence: 75 },
    ],
    severity: 'high',
  },
];

// Glass Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}> = ({ children, className = '', hover = true }) => (
  <div className={`
    bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10
    ${hover ? 'hover:bg-white/[0.07] hover:border-white/20' : ''}
    transition-all duration-300 ${className}
  `}>
    {children}
  </div>
);

// Severity Badge Component
const SeverityBadge: React.FC<{ severity: ErrorPattern['severity'] }> = ({ severity }) => {
  const config = {
    low: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Low' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Medium' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'High' },
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Critical' },
  };
  const { bg, text, label } = config[severity];

  return (
    <span className={`px-2 py-0.5 ${bg} ${text} text-xs rounded-full font-medium`}>
      {label}
    </span>
  );
};

// Category Icon Component
const CategoryIcon: React.FC<{ category: ErrorPattern['category']; className?: string }> = ({ category, className = 'w-5 h-5' }) => {
  switch (category) {
    case 'connection':
      return <Zap className={`${className} text-yellow-400`} />;
    case 'permission':
      return <Shield className={`${className} text-red-400`} />;
    case 'resource':
      return <Target className={`${className} text-blue-400`} />;
    case 'syntax':
      return <Bug className={`${className} text-purple-400`} />;
    case 'state':
      return <Info className={`${className} text-cyan-400`} />;
    default:
      return <HelpCircle className={`${className} text-gray-400`} />;
  }
};

// Suggestion Card Component
const SuggestionCard: React.FC<{
  suggestion: ErrorSuggestion;
  onApply: () => void;
  isApplying: boolean;
}> = ({ suggestion, onApply, isApplying }) => {
  const getActionIcon = () => {
    switch (suggestion.action) {
      case 'retry':
        return <RefreshCw className="w-4 h-4" />;
      case 'modify':
        return <Wand2 className="w-4 h-4" />;
      case 'manual':
        return <Wrench className="w-4 h-4" />;
      case 'skip':
        return <ArrowRight className="w-4 h-4" />;
      case 'undo':
        return <Undo2 className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getActionLabel = () => {
    switch (suggestion.action) {
      case 'retry':
        return 'Retry';
      case 'modify':
        return 'Apply Fix';
      case 'manual':
        return 'View Guide';
      case 'skip':
        return 'Skip';
      case 'undo':
        return 'Undo';
      default:
        return 'Apply';
    }
  };

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white">{suggestion.title}</span>
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              suggestion.confidence >= 80 ? 'bg-green-500/20 text-green-400' :
              suggestion.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {suggestion.confidence}% match
            </span>
          </div>
          <p className="text-sm text-gray-400">{suggestion.description}</p>
          {suggestion.autoFix && (
            <div className="mt-2 p-2 bg-black/30 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Suggested command:</p>
              <code className="text-xs text-cyan-400">{suggestion.autoFix}</code>
            </div>
          )}
        </div>
        <button
          onClick={onApply}
          disabled={isApplying}
          className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            suggestion.action === 'modify' || suggestion.action === 'retry'
              ? 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          } ${isApplying ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isApplying ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            getActionIcon()
          )}
          {getActionLabel()}
        </button>
      </div>
    </div>
  );
};

// Undo/Redo Panel Component
const UndoRedoPanel: React.FC<{
  undoHistory: UndoAction[];
  redoHistory: UndoAction[];
  onUndo: () => void;
  onRedo: () => void;
}> = ({ undoHistory, redoHistory, onUndo, onRedo }) => {
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-white">Action History</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={undoHistory.length === 0}
            className={`p-2 rounded-lg transition-colors ${
              undoHistory.length > 0
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
            }`}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={redoHistory.length === 0}
            className={`p-2 rounded-lg transition-colors ${
              redoHistory.length > 0
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
            }`}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>

      {/* Quick info */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{undoHistory.length} undoable actions</span>
        <span>{redoHistory.length} redoable actions</span>
      </div>

      {/* Expanded history */}
      {expanded && (
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {undoHistory.length === 0 && redoHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No actions in history</p>
          ) : (
            <>
              {/* Redo stack (future) */}
              {redoHistory.map((action) => (
                <div
                  key={action.id}
                  className="p-2 bg-white/5 rounded-lg opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{action.description}</span>
                    <span className="text-xs text-gray-600">{action.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}

              {/* Current position indicator */}
              {(undoHistory.length > 0 || redoHistory.length > 0) && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-cyan-500/30" />
                  <span className="text-xs text-cyan-400">Current</span>
                  <div className="flex-1 h-px bg-cyan-500/30" />
                </div>
              )}

              {/* Undo stack (past) */}
              {undoHistory.map((action) => (
                <div
                  key={action.id}
                  className={`p-2 rounded-lg transition-colors ${
                    showPreview === action.id ? 'bg-white/10 border border-white/20' : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onMouseEnter={() => action.preview && setShowPreview(action.id)}
                  onMouseLeave={() => setShowPreview(null)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{action.description}</span>
                      {action.canUndo && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Undoable</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {action.preview && (
                        <button
                          onClick={() => setShowPreview(showPreview === action.id ? null : action.id)}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          {showPreview === action.id ? <EyeOff className="w-3 h-3 text-gray-400" /> : <Eye className="w-3 h-3 text-gray-400" />}
                        </button>
                      )}
                      <span className="text-xs text-gray-600">{action.timestamp.toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Preview */}
                  {showPreview === action.id && action.preview && (
                    <div className="mt-2 p-2 bg-black/30 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500 mb-1">Before:</p>
                          <pre className="text-gray-400 overflow-x-auto">{JSON.stringify(action.preview.before, null, 2)}</pre>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">After:</p>
                          <pre className="text-cyan-400 overflow-x-auto">{JSON.stringify(action.preview.after, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Context-Aware Suggestions Component
const ContextSuggestions: React.FC<{
  context?: SceneContext;
  onApplySuggestion: (command: string) => void;
}> = ({ context, onApplySuggestion }) => {
  if (!context) return null;

  const suggestions: { condition: boolean; title: string; description: string; command: string }[] = [
    {
      condition: context.selectedActors.length === 0,
      title: 'No actors selected',
      description: 'Select actors to perform operations on them',
      command: 'Select all visible actors',
    },
    {
      condition: context.hasUnsavedChanges,
      title: 'Unsaved changes detected',
      description: 'Save your level to prevent data loss',
      command: 'Save the current level',
    },
    {
      condition: context.playMode,
      title: 'Play mode is active',
      description: 'Some operations require stopping play mode',
      command: 'Stop play mode',
    },
    {
      condition: context.actorCount > 1000,
      title: 'Large scene detected',
      description: 'Consider optimizing for better performance',
      command: 'Analyze scene performance',
    },
  ];

  const activeSuggestions = suggestions.filter((s) => s.condition);

  if (activeSuggestions.length === 0) return null;

  return (
    <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-5 h-5 text-cyan-400" />
        <span className="font-medium text-white">Context-Aware Suggestions</span>
      </div>
      <div className="space-y-2">
        {activeSuggestions.map((suggestion, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
          >
            <div>
              <p className="text-sm text-white">{suggestion.title}</p>
              <p className="text-xs text-gray-400">{suggestion.description}</p>
            </div>
            <button
              onClick={() => onApplySuggestion(suggestion.command)}
              className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm transition-colors"
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Error Recovery Component
const ErrorRecovery: React.FC<ErrorRecoveryProps> = ({
  error,
  command,
  sceneContext,
  undoHistory,
  redoHistory,
  onRetry,
  onUndo,
  onRedo,
  onDismiss,
  onApplySuggestion,
  isConnected
}) => {
  const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Analyze error when it changes
  useEffect(() => {
    if (!error) {
      setAnalysis(null);
      return;
    }

    // Find matching error pattern
    const matchedPattern = ERROR_PATTERNS.find((pattern) => pattern.pattern.test(error));

    if (matchedPattern) {
      setAnalysis({
        originalError: error,
        category: matchedPattern.category,
        title: matchedPattern.title,
        explanation: matchedPattern.explanation,
        suggestions: matchedPattern.suggestions,
        severity: matchedPattern.severity,
        timestamp: new Date(),
      });
    } else {
      // Generic error analysis
      setAnalysis({
        originalError: error,
        category: 'unknown',
        title: 'Unknown Error',
        explanation: 'An unexpected error occurred. The error message may provide more details about what went wrong.',
        suggestions: [
          { id: 'retry', title: 'Retry Command', description: 'Try executing the command again', action: 'retry', confidence: 50 },
          { id: 'undo', title: 'Undo Last Action', description: 'Revert the last successful action', action: 'undo', confidence: 40 },
          { id: 'report', title: 'Report Issue', description: 'Report this error for investigation', action: 'manual', confidence: 30 },
        ],
        severity: 'medium',
        timestamp: new Date(),
      });
    }
  }, [error]);

  const handleApplySuggestion = async (suggestion: ErrorSuggestion) => {
    setIsApplying(true);
    try {
      if (suggestion.action === 'retry') {
        onRetry();
      } else if (suggestion.action === 'modify' && suggestion.autoFix) {
        onRetry(suggestion.autoFix);
      } else if (suggestion.action === 'undo') {
        onUndo();
      } else {
        onApplySuggestion(suggestion);
      }
    } finally {
      setIsApplying(false);
    }
  };

  const copyErrorToClipboard = () => {
    if (error) {
      navigator.clipboard.writeText(error);
    }
  };

  return (
    <GlassCard className="p-5" hover={false}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Error Recovery</h3>
            <p className="text-xs text-gray-400">Intelligent error analysis & suggestions</p>
          </div>
        </div>
        {!isConnected && (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">Disconnected</span>
        )}
      </div>

      {/* Error Analysis */}
      {analysis && (
        <div className="space-y-4">
          {/* Error header */}
          <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CategoryIcon category={analysis.category} className="w-6 h-6 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-white">{analysis.title}</h4>
                    <SeverityBadge severity={analysis.severity} />
                  </div>
                  <p className="text-sm text-gray-300">{analysis.explanation}</p>
                </div>
              </div>
              <button
                onClick={onDismiss}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Original error */}
            <div className="mt-3 pt-3 border-t border-red-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Original error:</span>
                <button
                  onClick={copyErrorToClipboard}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="w-3 h-3 text-gray-500" />
                </button>
              </div>
              <code className="text-xs text-red-400 font-mono block p-2 bg-black/30 rounded-lg overflow-x-auto">
                {analysis.originalError}
              </code>
            </div>

            {/* Failed command */}
            {command && (
              <div className="mt-2">
                <span className="text-xs text-gray-500">Failed command:</span>
                <code className="text-xs text-gray-400 font-mono block p-2 bg-black/30 rounded-lg overflow-x-auto mt-1">
                  {command}
                </code>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              <span className="font-medium text-white">Suggested Fixes</span>
              <span className="text-xs text-gray-500">({analysis.suggestions.length} available)</span>
            </div>
            <div className="space-y-2">
              {analysis.suggestions
                .sort((a, b) => b.confidence - a.confidence)
                .map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={() => handleApplySuggestion(suggestion)}
                    isApplying={isApplying}
                  />
                ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => onRetry()}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Original
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 text-sm transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* No error state */}
      {!analysis && (
        <div className="space-y-4">
          {/* Context suggestions */}
          <ContextSuggestions
            context={sceneContext}
            onApplySuggestion={(cmd) => onRetry(cmd)}
          />

          {/* Undo/Redo panel */}
          <UndoRedoPanel
            undoHistory={undoHistory}
            redoHistory={redoHistory}
            onUndo={onUndo}
            onRedo={onRedo}
          />

          {/* Empty state */}
          {!sceneContext && undoHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-gray-400 mb-1">No errors detected</p>
              <p className="text-sm text-gray-500">Everything is running smoothly</p>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default ErrorRecovery;
export type { ErrorAnalysis, ErrorSuggestion, UndoAction, SceneContext };
