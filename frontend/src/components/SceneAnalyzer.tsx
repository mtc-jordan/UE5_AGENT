/**
 * Scene Analyzer Component
 * 
 * AI-powered scene understanding and analysis:
 * - Scene composition analysis
 * - Issue detection with severity levels
 * - Smart recommendations
 * - Complexity metrics visualization
 * - Interactive actor list
 */

import React, { useState} from 'react';
import {
  Eye, Scan, AlertTriangle, AlertCircle, Info, CheckCircle,
  Lightbulb, Box, Camera, Sun, Sparkles, Layers, Activity,
  ChevronDown, ChevronRight, RefreshCw, Loader2, Zap,
  BarChart3, PieChart, Cpu, Triangle, Palette,
  Play, XCircle, TrendingUp,
  Search, Grid3X3, List} from 'lucide-react';

interface SceneMetrics {
  total_actors: number;
  static_meshes: number;
  skeletal_meshes: number;
  lights: number;
  cameras: number;
  particle_systems: number;
  blueprints: number;
  total_triangles: number;
  total_materials: number;
  scene_bounds_min: [number, number, number];
  scene_bounds_max: [number, number, number];
  scene_center: [number, number, number];
  complexity_score: number;
  performance_prediction: string;
  actors_by_type: Record<string, number>;
}

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

interface ActorInfo {
  name: string;
  type: string;
  class_name: string;
  location: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  is_visible: boolean;
  has_collision: boolean;
  material_count: number;
  triangle_count: number;
  tags: string[];
}

interface SceneAnalysis {
  id: string;
  timestamp: string;
  project_name: string;
  level_name: string;
  description: string;
  summary: string;
  metrics: SceneMetrics;
  actors: ActorInfo[];
  issues: SceneIssue[];
  recommendations: SceneRecommendation[];
  ai_insights: string;
  scene_type: string;
  mood: string;
}

interface SceneAnalyzerProps {
  authToken: string;
  isConnected: boolean;
  onExecuteCommand?: (command: string) => void;
}

const SceneAnalyzer: React.FC<SceneAnalyzerProps> = ({
  authToken,
  isConnected,
  onExecuteCommand
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'recommendations' | 'actors'>('overview');
  const [actorSearch, setActorSearch] = useState('');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [actorView, setActorView] = useState<'list' | 'grid'>('list');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const analyzeScene = async () => {
    if (!isConnected) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/scene-analyzer/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          include_screenshot: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze scene');
      }
      
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoFix = async (issue: SceneIssue) => {
    if (!issue.auto_fix_command || !onExecuteCommand) return;
    onExecuteCommand(issue.auto_fix_command);
  };

  const handleApplyRecommendation = (rec: SceneRecommendation) => {
    if (!rec.action_prompt || !onExecuteCommand) return;
    onExecuteCommand(rec.action_prompt);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/20 border-red-500/30';
      case 'error': return 'text-orange-500 bg-orange-500/20 border-orange-500/30';
      case 'warning': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
      case 'info': return 'text-blue-500 bg-blue-500/20 border-blue-500/30';
      default: return 'text-gray-500 bg-gray-500/20 border-gray-500/30';
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

  const getPerformanceColor = (prediction: string) => {
    switch (prediction) {
      case 'Excellent': return 'text-green-400';
      case 'Good': return 'text-emerald-400';
      case 'Moderate': return 'text-yellow-400';
      case 'Heavy': return 'text-orange-400';
      case 'Very Heavy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getComplexityGradient = (score: number) => {
    if (score < 30) return 'from-green-500 to-emerald-500';
    if (score < 50) return 'from-emerald-500 to-yellow-500';
    if (score < 70) return 'from-yellow-500 to-orange-500';
    if (score < 85) return 'from-orange-500 to-red-500';
    return 'from-red-500 to-rose-500';
  };

  const filteredActors = analysis?.actors.filter(actor => {
    const matchesSearch = actor.name.toLowerCase().includes(actorSearch.toLowerCase()) ||
                         actor.type.toLowerCase().includes(actorSearch.toLowerCase());
    const matchesFilter = actorFilter === 'all' || actor.type.toLowerCase().includes(actorFilter.toLowerCase());
    return matchesSearch && matchesFilter;
  }) || [];

  const toggleIssue = (id: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIssues(newExpanded);
  };

  // Render Overview Tab
  const renderOverview = () => {
    if (!analysis) return null;
    const { metrics } = analysis;

    return (
      <div className="space-y-6">
        {/* Scene Summary Card */}
        <div className="p-5 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-xl border border-purple-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                  {analysis.scene_type}
                </span>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                  {analysis.mood}
                </span>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">{analysis.description}</p>
            </div>
          </div>
        </div>

        {/* Complexity Score */}
        <div className="p-5 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Scene Complexity
            </h4>
            <span className={`font-bold ${getPerformanceColor(metrics.performance_prediction)}`}>
              {metrics.performance_prediction}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden mb-2">
            <div 
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getComplexityGradient(metrics.complexity_score)} rounded-full transition-all duration-1000`}
              style={{ width: `${metrics.complexity_score}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow-lg">
                {metrics.complexity_score.toFixed(0)}%
              </span>
            </div>
          </div>
          
          <p className="text-xs text-gray-500">
            Based on actor count, triangle count, lights, and dynamic elements
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard 
            icon={<Box className="w-5 h-5" />}
            label="Total Actors"
            value={metrics.total_actors}
            color="blue"
          />
          <MetricCard 
            icon={<Layers className="w-5 h-5" />}
            label="Static Meshes"
            value={metrics.static_meshes}
            color="cyan"
          />
          <MetricCard 
            icon={<Sun className="w-5 h-5" />}
            label="Lights"
            value={metrics.lights}
            color="yellow"
          />
          <MetricCard 
            icon={<Camera className="w-5 h-5" />}
            label="Cameras"
            value={metrics.cameras}
            color="purple"
          />
          <MetricCard 
            icon={<Triangle className="w-5 h-5" />}
            label="Triangles"
            value={formatNumber(metrics.total_triangles)}
            color="green"
          />
          <MetricCard 
            icon={<Palette className="w-5 h-5" />}
            label="Materials"
            value={metrics.total_materials}
            color="pink"
          />
          <MetricCard 
            icon={<Sparkles className="w-5 h-5" />}
            label="Particles"
            value={metrics.particle_systems}
            color="orange"
          />
          <MetricCard 
            icon={<Cpu className="w-5 h-5" />}
            label="Blueprints"
            value={metrics.blueprints}
            color="emerald"
          />
        </div>

        {/* Actor Type Distribution */}
        {Object.keys(metrics.actors_by_type).length > 0 && (
          <div className="p-5 bg-white/5 rounded-xl border border-white/10">
            <h4 className="font-medium text-white flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-purple-400" />
              Actor Distribution
            </h4>
            <div className="space-y-2">
              {Object.entries(metrics.actors_by_type)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-400 truncate">{type}</span>
                        <span className="text-sm text-white font-medium">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                          style={{ width: `${(count / metrics.total_actors) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* AI Insights */}
        {analysis.ai_insights && (
          <div className="p-5 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
            <h4 className="font-medium text-white flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              AI Insights
            </h4>
            <p className="text-gray-300 text-sm leading-relaxed">{analysis.ai_insights}</p>
          </div>
        )}
      </div>
    );
  };

  // Render Issues Tab
  const renderIssues = () => {
    if (!analysis) return null;
    const { issues } = analysis;

    if (issues.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-2">No Issues Found</h4>
          <p className="text-gray-400 text-sm">Your scene looks great! No problems detected.</p>
        </div>
      );
    }

    // Group issues by severity
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const errorIssues = issues.filter(i => i.severity === 'error');
    const warningIssues = issues.filter(i => i.severity === 'warning');
    const infoIssues = issues.filter(i => i.severity === 'info');

    return (
      <div className="space-y-4">
        {/* Issues Summary */}
        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-400">
              {criticalIssues.length + errorIssues.length}
            </span>
            <span className="text-sm text-gray-400">Critical/Error</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-xs font-bold text-yellow-400">
              {warningIssues.length}
            </span>
            <span className="text-sm text-gray-400">Warnings</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
              {infoIssues.length}
            </span>
            <span className="text-sm text-gray-400">Info</span>
          </div>
        </div>

        {/* Issues List */}
        <div className="space-y-3">
          {issues.map((issue) => (
            <div 
              key={issue.id}
              className={`rounded-xl border overflow-hidden ${getSeverityColor(issue.severity)}`}
            >
              <button
                onClick={() => toggleIssue(issue.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
              >
                {getSeverityIcon(issue.severity)}
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-white truncate">{issue.title}</h5>
                  <p className="text-xs text-gray-400 truncate">{issue.category}</p>
                </div>
                {issue.auto_fix_available && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                    Auto-fix
                  </span>
                )}
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedIssues.has(issue.id) ? 'rotate-90' : ''}`} />
              </button>
              
              {expandedIssues.has(issue.id) && (
                <div className="px-4 pb-4 border-t border-white/10">
                  <p className="text-sm text-gray-300 mt-3 mb-3">{issue.description}</p>
                  
                  {issue.affected_actors.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-500">Affected actors:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {issue.affected_actors.slice(0, 5).map((actor, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white/10 text-gray-300 text-xs rounded">
                            {actor}
                          </span>
                        ))}
                        {issue.affected_actors.length > 5 && (
                          <span className="px-2 py-0.5 bg-white/10 text-gray-400 text-xs rounded">
                            +{issue.affected_actors.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-300">{issue.suggestion}</p>
                    </div>
                  </div>
                  
                  {issue.auto_fix_available && issue.auto_fix_command && (
                    <button
                      onClick={() => handleAutoFix(issue)}
                      className="mt-3 w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      Apply Auto-Fix
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Recommendations Tab
  const renderRecommendations = () => {
    if (!analysis) return null;
    const { recommendations } = analysis;

    if (recommendations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-2">No Recommendations</h4>
          <p className="text-gray-400 text-sm">Your scene is well optimized!</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {recommendations.map((rec, index) => (
          <div 
            key={rec.id}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                rec.priority >= 4 ? 'bg-purple-500/20 text-purple-400' :
                rec.priority >= 3 ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                <span className="text-sm font-bold">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="font-medium text-white">{rec.title}</h5>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    rec.category === 'lighting' ? 'bg-yellow-500/20 text-yellow-400' :
                    rec.category === 'performance' ? 'bg-red-500/20 text-red-400' :
                    rec.category === 'materials' ? 'bg-pink-500/20 text-pink-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {rec.category}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{rec.description}</p>
                
                {rec.action_prompt && (
                  <button
                    onClick={() => handleApplyRecommendation(rec)}
                    className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm flex items-center gap-2 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Apply
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-1.5 h-4 rounded-full ${
                      i < rec.priority ? 'bg-purple-500' : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Actors Tab
  const renderActors = () => {
    if (!analysis) return null;

    const actorTypes = [...new Set(analysis.actors.map(a => a.type))];

    return (
      <div className="space-y-4">
        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
              placeholder="Search actors..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            {actorTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="flex items-center bg-white/5 rounded-lg border border-white/10">
            <button
              onClick={() => setActorView('list')}
              className={`p-2 rounded-l-lg ${actorView === 'list' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActorView('grid')}
              className={`p-2 rounded-r-lg ${actorView === 'grid' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-gray-500">
          Showing {filteredActors.length} of {analysis.actors.length} actors
        </p>

        {/* Actor List/Grid */}
        {actorView === 'list' ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredActors.map((actor, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                  <Box className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-white text-sm truncate">{actor.name}</h5>
                  <p className="text-xs text-gray-500 truncate">{actor.type}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>({actor.location[0].toFixed(0)}, {actor.location[1].toFixed(0)}, {actor.location[2].toFixed(0)})</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
            {filteredActors.map((actor, index) => (
              <div 
                key={index}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-2">
                  <Box className="w-4 h-4 text-cyan-400" />
                </div>
                <h5 className="font-medium text-white text-xs truncate">{actor.name}</h5>
                <p className="text-xs text-gray-500 truncate">{actor.type}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-white">Scene Understanding</h3>
            <p className="text-xs text-gray-400">AI-powered scene analysis & recommendations</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-white/10">
          {/* Analyze Button */}
          {!analysis && (
            <div className="py-8 flex flex-col items-center">
              <button
                onClick={analyzeScene}
                disabled={!isConnected || isAnalyzing}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl text-white font-medium flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Scene...
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    Analyze Current Scene
                  </>
                )}
              </button>
              {!isConnected && (
                <p className="text-yellow-400 text-sm mt-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Connect to UE5 to analyze the scene
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-1 mt-4 mb-4 p-1 bg-white/5 rounded-lg">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'issues', label: `Issues (${analysis.issues.length})`, icon: AlertTriangle },
                  { id: 'recommendations', label: 'Tips', icon: Lightbulb },
                  { id: 'actors', label: 'Actors', icon: Box }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Re-analyze Button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={analyzeScene}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 text-sm flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  Re-analyze
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'issues' && renderIssues()}
              {activeTab === 'recommendations' && renderRecommendations()}
              {activeTab === 'actors' && renderActors()}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}> = ({ icon, label, value, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
    cyan: 'from-cyan-500/20 to-teal-500/20 text-cyan-400',
    yellow: 'from-yellow-500/20 to-amber-500/20 text-yellow-400',
    purple: 'from-purple-500/20 to-violet-500/20 text-purple-400',
    green: 'from-green-500/20 to-emerald-500/20 text-green-400',
    pink: 'from-pink-500/20 to-rose-500/20 text-pink-400',
    orange: 'from-orange-500/20 to-amber-500/20 text-orange-400',
    emerald: 'from-emerald-500/20 to-green-500/20 text-emerald-400'
  };

  return (
    <div className={`p-4 bg-gradient-to-br ${colorClasses[color]} rounded-xl border border-white/10`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
};

// Helper function
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default SceneAnalyzer;
