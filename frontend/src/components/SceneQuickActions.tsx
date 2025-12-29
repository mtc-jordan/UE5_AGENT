/**
 * Scene Quick Actions Component
 * 
 * Provides quick access to:
 * - Auto-fix detected issues
 * - Smart recommendations
 * - Scene health status
 * 
 * Designed to be displayed on the main UE5 Connection Hub
 */

import React, { useState, useEffect } from 'react';
import {
  Zap, AlertTriangle, AlertCircle, CheckCircle, Lightbulb,
  RefreshCw, Loader2, ChevronRight, Play, Shield,
  Sun, Camera, Box, Layers, Activity,
  XCircle, Info, ArrowRight
} from 'lucide-react';

interface SceneIssue {
  id: string;
  category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  affected_actors: string[];
  suggestion: string;
  auto_fix_available: boolean;
  auto_fix_command?: string;
}

interface SceneRecommendation {
  id: string;
  title: string;
  description: string;
  priority: number;
  category: string;
  action_prompt?: string;
}

interface QuickStats {
  total_actors: number;
  lights: number;
  meshes: number;
  cameras: number;
  project_name: string;
  level_name: string;
}

interface SceneQuickActionsProps {
  authToken: string;
  isConnected: boolean;
  onExecuteCommand?: (command: string) => void;
  onNavigateToAnalyzer?: () => void;
}

const SceneQuickActions: React.FC<SceneQuickActionsProps> = ({
  authToken,
  isConnected,
  onExecuteCommand,
  onNavigateToAnalyzer
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [issues, setIssues] = useState<SceneIssue[]>([]);
  const [recommendations, setRecommendations] = useState<SceneRecommendation[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  // Fetch quick stats on mount and when connection changes
  useEffect(() => {
    if (isConnected) {
      fetchQuickStats();
    }
  }, [isConnected]);

  const fetchQuickStats = async () => {
    try {
      const response = await fetch('/api/scene-analyzer/quick-stats', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.connected && data.stats) {
          setQuickStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch quick stats:', err);
    }
  };

  const runQuickAnalysis = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/scene-analyzer/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          include_screenshot: false,
          model: 'deepseek-chat'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
        setRecommendations(data.recommendations || []);
        setLastAnalysis(new Date().toLocaleTimeString());
        
        // Update quick stats from analysis
        if (data.metrics) {
          setQuickStats({
            total_actors: data.metrics.total_actors,
            lights: data.metrics.lights,
            meshes: data.metrics.static_meshes,
            cameras: data.metrics.cameras,
            project_name: data.project_name || 'Unknown',
            level_name: data.level_name || 'Unknown'
          });
        }
      }
    } catch (err) {
      console.error('Quick analysis failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyAutoFix = async (issue: SceneIssue) => {
    if (!issue.auto_fix_command || !onExecuteCommand) return;
    
    setApplyingFix(issue.id);
    try {
      onExecuteCommand(issue.auto_fix_command);
      // Remove the issue from the list after applying fix
      setTimeout(() => {
        setIssues(prev => prev.filter(i => i.id !== issue.id));
        setApplyingFix(null);
      }, 1000);
    } catch (err) {
      setApplyingFix(null);
    }
  };

  const applyRecommendation = (rec: SceneRecommendation) => {
    if (!rec.action_prompt || !onExecuteCommand) return;
    onExecuteCommand(rec.action_prompt);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'error': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'info': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const criticalCount = issues.filter(i => i.severity === 'critical' || i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const autoFixableCount = issues.filter(i => i.auto_fix_available).length;

  // Health score based on issues
  const healthScore = issues.length === 0 ? 100 : 
    Math.max(0, 100 - (criticalCount * 25) - (warningCount * 10));

  const getHealthColor = () => {
    if (healthScore >= 80) return 'text-green-400';
    if (healthScore >= 60) return 'text-yellow-400';
    if (healthScore >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthLabel = () => {
    if (healthScore >= 80) return 'Excellent';
    if (healthScore >= 60) return 'Good';
    if (healthScore >= 40) return 'Needs Attention';
    return 'Critical Issues';
  };

  return (
    <div className="space-y-4">
      {/* Scene Health Overview */}
      <div className="p-4 bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Scene Health</h3>
              <p className="text-xs text-gray-400">
                {lastAnalysis ? `Last checked: ${lastAnalysis}` : 'Run analysis to check'}
              </p>
            </div>
          </div>
          <button
            onClick={runQuickAnalysis}
            disabled={!isConnected || isLoading}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 border border-white/10 rounded-lg text-sm text-gray-300 flex items-center gap-2 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Health Score */}
        {issues.length > 0 || lastAnalysis ? (
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-2xl font-bold ${getHealthColor()}`}>{healthScore}%</span>
                <span className={`text-sm ${getHealthColor()}`}>{getHealthLabel()}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    healthScore >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    healthScore >= 60 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                    healthScore >= 40 ? 'bg-gradient-to-r from-orange-500 to-amber-500' :
                    'bg-gradient-to-r from-red-500 to-rose-500'
                  }`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick Stats */}
        {quickStats && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <Box className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{quickStats.total_actors}</div>
              <div className="text-xs text-gray-500">Actors</div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <Layers className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{quickStats.meshes}</div>
              <div className="text-xs text-gray-500">Meshes</div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <Sun className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{quickStats.lights}</div>
              <div className="text-xs text-gray-500">Lights</div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg text-center">
              <Camera className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{quickStats.cameras}</div>
              <div className="text-xs text-gray-500">Cameras</div>
            </div>
          </div>
        )}

        {/* Issue Summary */}
        {issues.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {criticalCount} Critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {warningCount} Warnings
                </span>
              )}
            </div>
            {autoFixableCount > 0 && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {autoFixableCount} Auto-fixable
              </span>
            )}
          </div>
        )}

        {!isConnected && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Connect to UE5 to analyze your scene
          </div>
        )}
      </div>

      {/* Quick Fixes */}
      {issues.filter(i => i.auto_fix_available).length > 0 && (
        <div className="p-4 bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-400" />
              <h4 className="font-medium text-white">Quick Fixes</h4>
            </div>
            <span className="text-xs text-gray-500">One-click solutions</span>
          </div>
          
          <div className="space-y-2">
            {issues.filter(i => i.auto_fix_available).slice(0, 3).map((issue) => (
              <div 
                key={issue.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium text-white truncate">{issue.title}</h5>
                    <p className="text-xs text-gray-400 truncate">{issue.suggestion}</p>
                  </div>
                </div>
                <button
                  onClick={() => applyAutoFix(issue)}
                  disabled={applyingFix === issue.id}
                  className="ml-3 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 text-xs font-medium flex items-center gap-1.5 transition-colors flex-shrink-0"
                >
                  {applyingFix === issue.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  Fix
                </button>
              </div>
            ))}
          </div>

          {issues.filter(i => i.auto_fix_available).length > 3 && (
            <button
              onClick={onNavigateToAnalyzer}
              className="mt-3 w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              View all {issues.filter(i => i.auto_fix_available).length} fixes
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Smart Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-4 bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              <h4 className="font-medium text-white">Recommendations</h4>
            </div>
            <span className="text-xs text-gray-500">AI suggestions</span>
          </div>
          
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div 
                key={rec.id}
                className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    rec.priority >= 4 ? 'bg-purple-500/20 text-purple-400' :
                    rec.priority >= 3 ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-sm font-medium text-white truncate">{rec.title}</h5>
                    <p className="text-xs text-gray-400 truncate">{rec.description}</p>
                  </div>
                </div>
                {rec.action_prompt && (
                  <button
                    onClick={() => applyRecommendation(rec)}
                    className="ml-3 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-xs font-medium flex items-center gap-1.5 transition-colors flex-shrink-0"
                  >
                    <Play className="w-3 h-3" />
                    Apply
                  </button>
                )}
              </div>
            ))}
          </div>

          {recommendations.length > 3 && (
            <button
              onClick={onNavigateToAnalyzer}
              className="mt-3 w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              View all {recommendations.length} recommendations
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* View Full Analysis Button */}
      {(issues.length > 0 || recommendations.length > 0) && (
        <button
          onClick={onNavigateToAnalyzer}
          className="w-full px-4 py-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 rounded-xl text-cyan-400 font-medium flex items-center justify-center gap-2 transition-all"
        >
          <Activity className="w-5 h-5" />
          Open Full Scene Analysis
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Empty State */}
      {!isLoading && issues.length === 0 && recommendations.length === 0 && lastAnalysis && (
        <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-1">Scene Looks Great!</h4>
          <p className="text-sm text-gray-400">No issues detected. Your scene is well optimized.</p>
        </div>
      )}
    </div>
  );
};

export default SceneQuickActions;
