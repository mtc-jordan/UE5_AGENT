/**
 * ActionTimeline Component
 * 
 * Visual history of all AI actions with undo/redo capability.
 * Features:
 * - Timeline of executed commands
 * - Preview thumbnails for each state
 * - One-click undo to any previous state
 * - Batch undo for multi-step operations
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  History,
  Undo2,
  Redo2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Image,
  Layers,
  Move,
  Palette,
  Code,
  Box,
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Rewind,
  FastForward
} from 'lucide-react';

// Types
interface ActionRecord {
  id: string;
  action_type: string;
  tool_name: string;
  tool_params: Record<string, any>;
  description: string;
  timestamp: string;
  status: 'executed' | 'undone' | 'failed';
  before_screenshot?: string;
  after_screenshot?: string;
  group_id?: string;
  group_name?: string;
  group_order?: number;
  can_undo: boolean;
  error?: string;
}

interface ActionTimelineProps {
  authToken: string;
  isConnected: boolean;
  onActionUndone?: (action: ActionRecord) => void;
  onActionRedone?: (action: ActionRecord) => void;
}

// Action type icons
const ACTION_ICONS: Record<string, React.ElementType> = {
  spawn: Box,
  delete: Trash2,
  transform: Move,
  property: Code,
  material: Palette,
  blueprint: Code,
  scene: Layers,
  other: History
};

// Status colors
const STATUS_COLORS = {
  executed: 'bg-green-500/20 text-green-400 border-green-500/30',
  undone: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30'
};

// Preview Modal Component
const PreviewModal: React.FC<{
  action: ActionRecord;
  onClose: () => void;
  onUndo: () => void;
}> = ({ action, onClose, onUndo }) => {
  const [showBefore, setShowBefore] = useState(true);
  const [zoom, setZoom] = useState(1);
  
  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setShowBefore(true);
      else if (e.key === 'ArrowRight') setShowBefore(false);
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      else if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  const hasScreenshots = action.before_screenshot || action.after_screenshot;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-2xl border border-white/10 max-w-4xl w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {React.createElement(ACTION_ICONS[action.action_type] || History, {
              className: "w-5 h-5 text-purple-400"
            })}
            <div>
              <h3 className="text-white font-medium">{action.description}</h3>
              <p className="text-white/40 text-sm">
                {new Date(action.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {action.can_undo && action.status === 'executed' && (
              <button
                onClick={onUndo}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
              >
                <Undo2 className="w-4 h-4" />
                Undo
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {hasScreenshots ? (
            <div className="space-y-4">
              {/* Toggle buttons */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowBefore(true)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    showBefore 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Rewind className="w-4 h-4" />
                    Before
                  </span>
                </button>
                <button
                  onClick={() => setShowBefore(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    !showBefore 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    After
                    <FastForward className="w-4 h-4" />
                  </span>
                </button>
              </div>
              
              {/* Image */}
              <div className="relative bg-black/50 rounded-xl overflow-hidden" style={{ height: '400px' }}>
                {(showBefore ? action.before_screenshot : action.after_screenshot) ? (
                  <img
                    src={`data:image/png;base64,${showBefore ? action.before_screenshot : action.after_screenshot}`}
                    alt={showBefore ? 'Before' : 'After'}
                    className="w-full h-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40">
                    <div className="text-center">
                      <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No screenshot available</p>
                    </div>
                  </div>
                )}
                
                {/* Zoom controls */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/60 rounded-lg p-1">
                  <button
                    onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                    className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-white/60 text-sm min-w-[3rem] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                    className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Label */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-medium ${
                  showBefore ? 'bg-blue-500/80 text-white' : 'bg-green-500/80 text-white'
                }`}>
                  {showBefore ? 'BEFORE' : 'AFTER'}
                </div>
              </div>
              
              {/* Keyboard hints */}
              <div className="flex items-center justify-center gap-4 text-white/40 text-xs">
                <span>← → Switch view</span>
                <span>+ - Zoom</span>
                <span>Esc Close</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-white/40">
              <Image className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p>No preview available for this action</p>
            </div>
          )}
          
          {/* Action details */}
          <div className="mt-4 p-3 bg-white/5 rounded-xl">
            <h4 className="text-white/60 text-sm mb-2">Action Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-white/40">Tool:</span>
                <span className="text-white ml-2">{action.tool_name}</span>
              </div>
              <div>
                <span className="text-white/40">Type:</span>
                <span className="text-white ml-2 capitalize">{action.action_type}</span>
              </div>
              <div>
                <span className="text-white/40">Status:</span>
                <span className={`ml-2 capitalize ${
                  action.status === 'executed' ? 'text-green-400' :
                  action.status === 'undone' ? 'text-gray-400' : 'text-red-400'
                }`}>{action.status}</span>
              </div>
              {action.group_name && (
                <div>
                  <span className="text-white/40">Group:</span>
                  <span className="text-white ml-2">{action.group_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Timeline Item Component
const TimelineItem: React.FC<{
  action: ActionRecord;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onUndo: () => void;
  isUndoing: boolean;
}> = ({ action, isLast, onSelect, onUndo, isUndoing }) => {
  const Icon = ACTION_ICONS[action.action_type] || History;
  const isUndone = action.status === 'undone';
  const isFailed = action.status === 'failed';
  
  return (
    <div className={`relative flex gap-3 ${isUndone ? 'opacity-50' : ''}`}>
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isUndone ? 'bg-gray-500/20' :
          isFailed ? 'bg-red-500/20' :
          'bg-purple-500/20'
        }`}>
          <Icon className={`w-5 h-5 ${
            isUndone ? 'text-gray-400' :
            isFailed ? 'text-red-400' :
            'text-purple-400'
          }`} />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 my-1 ${
            isUndone ? 'bg-gray-700' : 'bg-purple-500/30'
          }`} />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 pb-4">
        <div 
          className={`
            p-3 rounded-xl border cursor-pointer transition-all
            ${isUndone ? 'bg-gray-800/50 border-gray-700' :
              isFailed ? 'bg-red-500/10 border-red-500/30' :
              'bg-white/5 border-white/10 hover:border-purple-500/50 hover:bg-white/10'}
          `}
          onClick={onSelect}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${
                isUndone ? 'text-gray-400' : 'text-white'
              }`}>
                {action.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3 text-white/40" />
                <span className="text-white/40 text-xs">
                  {new Date(action.timestamp).toLocaleTimeString()}
                </span>
                {action.group_name && (
                  <>
                    <span className="text-white/20">•</span>
                    <span className="text-purple-400 text-xs">{action.group_name}</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Thumbnail */}
            {action.after_screenshot && (
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-black/50 flex-shrink-0">
                <img
                  src={`data:image/png;base64,${action.after_screenshot}`}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          
          {/* Status and actions */}
          <div className="flex items-center justify-between mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[action.status]}`}>
              {action.status === 'executed' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
              {action.status === 'undone' && <Undo2 className="w-3 h-3 inline mr-1" />}
              {action.status === 'failed' && <XCircle className="w-3 h-3 inline mr-1" />}
              {action.status.toUpperCase()}
            </span>
            
            {action.can_undo && action.status === 'executed' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUndo();
                }}
                disabled={isUndoing}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors text-xs disabled:opacity-50"
              >
                {isUndoing ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Undo2 className="w-3 h-3" />
                )}
                Undo
              </button>
            )}
          </div>
          
          {action.error && (
            <div className="mt-2 p-2 bg-red-500/10 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {action.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main ActionTimeline Component
export const ActionTimeline: React.FC<ActionTimelineProps> = ({
  authToken,
  isConnected,
  onActionUndone,
  onActionRedone
}) => {
  // State
  const [isExpanded, setIsExpanded] = useState(true);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [ setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionRecord | null>(null);
  const [undoingAction, setUndoingAction] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showUndoneActions, setShowUndoneActions] = useState(true);
  
  // Refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Load action history
  const loadHistory = useCallback(async () => {
    if (!authToken) return;
    
    try {
      const response = await fetch(`/api/action-history?include_undone=${showUndoneActions}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActions(data.actions || []);
        setCanUndo(data.can_undo || false);
        setCanRedo(data.can_redo || false);
      }
    } catch (err) {
      console.error('Failed to load action history:', err);
    }
  }, [authToken, showUndoneActions]);
  
  // Poll for updates
  useEffect(() => {
    loadHistory();
    
    pollIntervalRef.current = setInterval(loadHistory, 5000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadHistory]);
  
  // Undo action
  const handleUndo = async (actionId?: string) => {
    if (!authToken) return;
    
    setUndoingAction(actionId || 'latest');
    setError(null);
    
    try {
      const url = actionId 
        ? `/api/action-history/undo/${actionId}`
        : '/api/action-history/undo';
        
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        await loadHistory();
        
        if (onActionUndone && data.action) {
          onActionUndone(data.action);
        }
      } else {
        const error = await response.json();
        setError(error.detail || 'Failed to undo action');
      }
    } catch (err) {
      setError('Failed to undo action');
    } finally {
      setUndoingAction(null);
    }
  };
  
  // Redo action
  const handleRedo = async () => {
    if (!authToken) return;
    
    setError(null);
    
    try {
      const response = await fetch('/api/action-history/redo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        await loadHistory();
        
        if (onActionRedone && data.action) {
          onActionRedone(data.action);
        }
      } else {
        const error = await response.json();
        setError(error.detail || 'Failed to redo action');
      }
    } catch (err) {
      setError('Failed to redo action');
    }
  };
  
  // Undo to specific action
  const handleUndoTo = async (actionId: string) => {
    if (!authToken) return;
    
    setUndoingAction(actionId);
    setError(null);
    
    try {
      const response = await fetch(`/api/action-history/undo-to/${actionId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        await loadHistory();
        setSelectedAction(null);
      } else {
        const error = await response.json();
        setError(error.detail || 'Failed to undo actions');
      }
    } catch (err) {
      setError('Failed to undo actions');
    } finally {
      setUndoingAction(null);
    }
  };
  
  // Clear history
  const handleClearHistory = async () => {
    if (!authToken || !confirm('Clear all action history? This cannot be undone.')) return;
    
    try {
      const response = await fetch('/api/action-history/clear', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        setActions([]);
        setCanUndo(false);
        setCanRedo(false);
      }
    } catch (err) {
      setError('Failed to clear history');
    }
  };
  
  // Group actions by group_id
  const groupedActions = actions.reduce((acc, action) => {
    const groupKey = action.group_id || action.id;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(action);
    return acc;
  }, {} as Record<string, ActionRecord[]>);
  
  const executedCount = actions.filter(a => a.status === 'executed').length;
  const undoneCount = actions.filter(a => a.status === 'undone').length;
  
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-amber-500/20">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                Action Timeline
                {actions.length > 0 && (
                  <span className="px-2 py-0.5 bg-white/10 text-white/60 text-xs rounded-full">
                    {executedCount} actions
                  </span>
                )}
              </h3>
              <p className="text-white/60 text-sm">Visual history with undo/redo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick undo/redo buttons */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUndo();
              }}
              disabled={!canUndo || !isConnected}
              className={`p-2 rounded-lg transition-all ${
                canUndo && isConnected
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRedo();
              }}
              disabled={!canRedo || !isConnected}
              className={`p-2 rounded-lg transition-all ${
                canRedo && isConnected
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/60" />
            )}
          </div>
        </div>
      </div>
      
      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Connection warning */}
          {!isConnected && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Connect to UE5 to enable undo/redo functionality
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </span>
              <button onClick={() => setError(null)} className="hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-white/60 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUndoneActions}
                  onChange={(e) => setShowUndoneActions(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
                />
                Show undone actions
              </label>
            </div>
            
            {actions.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          
          {/* Timeline */}
          {actions.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto pr-2 -mr-2">
              {actions.map((action, index) => (
                <TimelineItem
                  key={action.id}
                  action={action}
                  isFirst={index === 0}
                  isLast={index === actions.length - 1}
                  onSelect={() => setSelectedAction(action)}
                  onUndo={() => handleUndo(action.id)}
                  isUndoing={undoingAction === action.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-white/40">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No actions recorded yet</p>
              <p className="text-sm mt-1">AI actions will appear here</p>
            </div>
          )}
          
          {/* Stats */}
          {actions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-white/40">
                  <span className="text-green-400">{executedCount}</span> executed
                </span>
                {undoneCount > 0 && (
                  <span className="text-white/40">
                    <span className="text-gray-400">{undoneCount}</span> undone
                  </span>
                )}
              </div>
              <button
                onClick={loadHistory}
                className="flex items-center gap-1 text-white/40 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Preview Modal */}
      {selectedAction && (
        <PreviewModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onUndo={() => {
            handleUndo(selectedAction.id);
            setSelectedAction(null);
          }}
        />
      )}
    </div>
  );
};

export default ActionTimeline;
