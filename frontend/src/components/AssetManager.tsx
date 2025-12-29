/**
 * Asset Manager Component
 * 
 * AI-driven asset management interface:
 * - Natural language search
 * - Duplicate detection
 * - Asset health monitoring
 * - Batch operations
 * - Organization suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, FolderTree, Package, AlertTriangle, Copy, Trash2,
  Move, RefreshCw, Loader2, ChevronRight, ChevronDown,
  CheckCircle, XCircle, Info, Filter, Grid, List,
  HardDrive, FileText, Image, Box, Layers, Music,
  Sparkles, Zap, FolderOpen, MoreVertical, Check,
  ArrowRight, Download, Upload, Settings, Eye,
  Maximize2, Minimize2, X, AlertCircle
} from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  path: string;
  type: string;
  size_mb: number;
  health: 'healthy' | 'warning' | 'error' | 'orphaned';
  issues: any[];
  dependency_count: number;
  referencer_count: number;
}

interface AssetIssue {
  id: string;
  asset_path: string;
  asset_name: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  issue_type: string;
  title: string;
  description: string;
  auto_fix_available: boolean;
  auto_fix_action?: string;
}

interface DuplicateGroup {
  id: string;
  similarity_score: number;
  assets: Asset[];
  total_size_mb: number;
  potential_savings_mb: number;
  recommendation: string;
}

interface OrganizationSuggestion {
  id: string;
  asset_path: string;
  current_folder: string;
  suggested_folder: string;
  reason: string;
  confidence: number;
}

interface AssetManagerProps {
  authToken: string;
  isConnected: boolean;
}

const ASSET_TYPE_ICONS: Record<string, React.ReactNode> = {
  static_mesh: <Box className="w-4 h-4" />,
  skeletal_mesh: <Layers className="w-4 h-4" />,
  material: <Sparkles className="w-4 h-4" />,
  material_instance: <Sparkles className="w-4 h-4" />,
  texture: <Image className="w-4 h-4" />,
  blueprint: <FileText className="w-4 h-4" />,
  animation: <Layers className="w-4 h-4" />,
  sound: <Music className="w-4 h-4" />,
  particle: <Sparkles className="w-4 h-4" />,
  level: <FolderTree className="w-4 h-4" />,
  other: <Package className="w-4 h-4" />
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  static_mesh: 'bg-blue-500/20 text-blue-400',
  skeletal_mesh: 'bg-purple-500/20 text-purple-400',
  material: 'bg-orange-500/20 text-orange-400',
  material_instance: 'bg-amber-500/20 text-amber-400',
  texture: 'bg-green-500/20 text-green-400',
  blueprint: 'bg-cyan-500/20 text-cyan-400',
  animation: 'bg-pink-500/20 text-pink-400',
  sound: 'bg-indigo-500/20 text-indigo-400',
  particle: 'bg-rose-500/20 text-rose-400',
  level: 'bg-emerald-500/20 text-emerald-400',
  other: 'bg-gray-500/20 text-gray-400'
};

const AssetManager: React.FC<AssetManagerProps> = ({
  authToken,
  isConnected
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [issues, setIssues] = useState<AssetIssue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [suggestions, setSuggestions] = useState<OrganizationSuggestion[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [healthSummary, setHealthSummary] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'search' | 'issues' | 'duplicates' | 'organize'>('search');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);

  const scanAssets = async () => {
    if (!isConnected) return;
    
    setIsScanning(true);
    try {
      const response = await fetch('/api/assets/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
        setIssues(data.issues || []);
        setDuplicates(data.duplicate_groups || []);
        setSuggestions(data.organization_suggestions || []);
        setStatistics(data.statistics);
        setHealthSummary(data.health_summary);
      }
    } catch (err) {
      console.error('Asset scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const searchAssets = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch('/api/assets/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          query: searchQuery,
          filters: {
            type: typeFilter,
            health: healthFilter
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Asset search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const applyFix = async (issueId: string) => {
    setApplyingFix(issueId);
    try {
      const response = await fetch(`/api/assets/fix/${issueId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        // Refresh after fix
        await scanAssets();
      }
    } catch (err) {
      console.error('Fix failed:', err);
    } finally {
      setApplyingFix(null);
    }
  };

  const batchOperation = async (operation: string) => {
    if (selectedAssets.size === 0) return;
    
    try {
      const response = await fetch('/api/assets/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          operation,
          asset_paths: Array.from(selectedAssets)
        })
      });
      
      if (response.ok) {
        setSelectedAssets(new Set());
        await scanAssets();
      }
    } catch (err) {
      console.error('Batch operation failed:', err);
    }
  };

  const toggleAssetSelection = (path: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedAssets(newSelected);
  };

  const selectAllVisible = () => {
    const visibleAssets = searchResults.length > 0 
      ? searchResults.map(r => r.asset.path)
      : assets.map(a => a.path);
    setSelectedAssets(new Set(visibleAssets));
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'orphaned': return 'text-gray-400';
      default: return 'text-gray-400';
    }
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

  const formatSize = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(mb * 1024).toFixed(0)} KB`;
  };

  const renderSearch = () => (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchAssets()}
            placeholder="Search assets... (e.g., 'find all metal materials', 'unused textures')"
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <button
          onClick={searchAssets}
          disabled={isSearching}
          className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 font-medium flex items-center gap-2"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${
            showFilters ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-gray-400'
          }`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select
              value={typeFilter || ''}
              onChange={(e) => setTypeFilter(e.target.value || null)}
              className="px-3 py-1.5 bg-white/10 border border-white/10 rounded text-sm text-white"
            >
              <option value="">All Types</option>
              <option value="static_mesh">Static Mesh</option>
              <option value="skeletal_mesh">Skeletal Mesh</option>
              <option value="material">Material</option>
              <option value="texture">Texture</option>
              <option value="blueprint">Blueprint</option>
              <option value="animation">Animation</option>
              <option value="sound">Sound</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Health</label>
            <select
              value={healthFilter || ''}
              onChange={(e) => setHealthFilter(e.target.value || null)}
              className="px-3 py-1.5 bg-white/10 border border-white/10 rounded text-sm text-white"
            >
              <option value="">All</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="orphaned">Orphaned</option>
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      {searchResults.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>{searchResults.length} results found</span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllVisible}
                className="text-purple-400 hover:text-purple-300"
              >
                Select All
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-1 hover:bg-white/10 rounded"
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-2' : 'space-y-2'}>
            {searchResults.map((result) => (
              <AssetCard
                key={result.asset.id}
                asset={result.asset}
                matchReason={result.match_reason}
                relevance={result.relevance_score}
                isSelected={selectedAssets.has(result.asset.path)}
                onToggleSelect={() => toggleAssetSelection(result.asset.path)}
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>
      ) : searchQuery ? (
        <div className="text-center py-8 text-gray-500">
          No assets found matching your search
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-purple-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-2">AI-Powered Asset Search</h4>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Use natural language to find assets. Try "find all metal materials", "show unused textures", or "large meshes over 50MB".
          </p>
        </div>
      )}
    </div>
  );

  const renderIssues = () => (
    <div className="space-y-3">
      {issues.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-1">No Issues Found</h4>
          <p className="text-sm text-gray-400">All assets are healthy!</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{issues.length} issues found</span>
            <span className="text-green-400">
              {issues.filter(i => i.auto_fix_available).length} auto-fixable
            </span>
          </div>
          
          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`p-4 rounded-xl border ${getSeverityColor(issue.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSeverityColor(issue.severity)}`}>
                      {issue.severity}
                    </span>
                    <span className="text-xs text-gray-500">{issue.issue_type}</span>
                  </div>
                  <h4 className="font-medium text-white mb-1">{issue.title}</h4>
                  <p className="text-sm text-gray-400 mb-2">{issue.description}</p>
                  <p className="text-xs text-gray-500">{issue.asset_path}</p>
                </div>
                
                {issue.auto_fix_available && (
                  <button
                    onClick={() => applyFix(issue.id)}
                    disabled={applyingFix === issue.id}
                    className="ml-4 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium flex items-center gap-2"
                  >
                    {applyingFix === issue.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Fix
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderDuplicates = () => (
    <div className="space-y-4">
      {duplicates.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
            <Copy className="w-6 h-6 text-blue-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-1">No Duplicates Found</h4>
          <p className="text-sm text-gray-400">Your project has no duplicate assets.</p>
        </div>
      ) : (
        <>
          <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Potential Savings</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatSize(duplicates.reduce((sum, d) => sum + d.potential_savings_mb, 0))}
            </p>
            <p className="text-xs text-gray-400">by removing duplicate assets</p>
          </div>
          
          {duplicates.map((group) => (
            <div key={group.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-white">
                    {group.assets.length} Similar Assets
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {Math.round(group.similarity_score * 100)}% similar
                </span>
              </div>
              
              <div className="space-y-2 mb-3">
                {group.assets.map((asset, index) => (
                  <div
                    key={asset.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      index === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {index === 0 && <Check className="w-4 h-4 text-green-400" />}
                      <span className="text-sm text-white">{asset.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{formatSize(asset.size_mb)}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{group.recommendation}</p>
                <span className="text-xs text-green-400">
                  Save {formatSize(group.potential_savings_mb)}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderOrganize = () => (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
            <FolderTree className="w-6 h-6 text-purple-400" />
          </div>
          <h4 className="text-lg font-medium text-white mb-1">Well Organized</h4>
          <p className="text-sm text-gray-400">Your assets follow the recommended folder structure.</p>
        </div>
      ) : (
        <>
          <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <FolderTree className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Organization Suggestions</span>
            </div>
            <p className="text-sm text-gray-300">
              {suggestions.length} assets could be better organized following UE5 conventions.
            </p>
          </div>
          
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white mb-2">
                    {suggestion.asset_path.split('/').pop()}
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <span className="text-gray-500">{suggestion.current_folder}</span>
                    <ArrowRight className="w-3 h-3 text-purple-400" />
                    <span className="text-purple-400">{suggestion.suggested_folder}</span>
                  </div>
                  
                  <p className="text-xs text-gray-400">{suggestion.reason}</p>
                </div>
                
                <button className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-xs font-medium flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  Move
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                Asset Manager
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">AI</span>
              </h3>
              <p className="text-xs text-gray-400">Smart asset organization and search</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Stats */}
            {statistics && (
              <div className="flex items-center gap-3 mr-4 text-xs">
                <span className="text-gray-400">
                  <span className="text-white font-medium">{assets.length}</span> assets
                </span>
                <span className="text-gray-400">
                  <span className="text-white font-medium">{formatSize(statistics.total_size_mb)}</span>
                </span>
              </div>
            )}
            
            {/* Scan Button */}
            <button
              onClick={scanAssets}
              disabled={!isConnected || isScanning}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium flex items-center gap-2"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isScanning ? 'Scanning...' : 'Scan'}
            </button>
            
            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-white/10 rounded-lg"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4 text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        {isExpanded && (
          <div className="flex gap-1 mt-4">
            {[
              { id: 'search', label: 'Search', icon: Search },
              { id: 'issues', label: 'Issues', icon: AlertTriangle, count: issues.length },
              { id: 'duplicates', label: 'Duplicates', icon: Copy, count: duplicates.length },
              { id: 'organize', label: 'Organize', icon: FolderTree, count: suggestions.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-white/10 rounded text-xs">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Batch Actions Bar */}
      {isExpanded && selectedAssets.size > 0 && (
        <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between">
          <span className="text-sm text-purple-400">
            {selectedAssets.size} assets selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => batchOperation('move')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white flex items-center gap-1"
            >
              <Move className="w-3 h-3" />
              Move
            </button>
            <button
              onClick={() => batchOperation('delete')}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs text-red-400 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
            <button
              onClick={() => setSelectedAssets(new Set())}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      
      {/* Content */}
      {isExpanded && (
        <div className="p-4 max-h-[500px] overflow-y-auto">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-400 mb-3" />
              <h4 className="text-lg font-medium text-white mb-1">Not Connected</h4>
              <p className="text-sm text-gray-400">Connect to UE5 to manage assets.</p>
            </div>
          ) : (
            <>
              {activeTab === 'search' && renderSearch()}
              {activeTab === 'issues' && renderIssues()}
              {activeTab === 'duplicates' && renderDuplicates()}
              {activeTab === 'organize' && renderOrganize()}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Asset Card Component
const AssetCard: React.FC<{
  asset: Asset;
  matchReason?: string;
  relevance?: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  viewMode: 'grid' | 'list';
}> = ({ asset, matchReason, relevance, isSelected, onToggleSelect, viewMode }) => {
  const formatSize = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(mb * 1024).toFixed(0)} KB`;
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="w-3 h-3 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
      case 'error': return <XCircle className="w-3 h-3 text-red-400" />;
      case 'orphaned': return <AlertCircle className="w-3 h-3 text-gray-400" />;
      default: return null;
    }
  };

  if (viewMode === 'grid') {
    return (
      <div
        onClick={onToggleSelect}
        className={`p-3 rounded-lg border cursor-pointer transition-all ${
          isSelected
            ? 'bg-purple-500/20 border-purple-500/50'
            : 'bg-white/5 border-white/10 hover:border-white/20'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg ${ASSET_TYPE_COLORS[asset.type] || ASSET_TYPE_COLORS.other} flex items-center justify-center mb-2`}>
          {ASSET_TYPE_ICONS[asset.type] || ASSET_TYPE_ICONS.other}
        </div>
        <p className="text-sm font-medium text-white truncate">{asset.name}</p>
        <p className="text-xs text-gray-500">{formatSize(asset.size_mb)}</p>
      </div>
    );
  }

  return (
    <div
      onClick={onToggleSelect}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'bg-purple-500/20 border-purple-500/50'
          : 'bg-white/5 border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${ASSET_TYPE_COLORS[asset.type] || ASSET_TYPE_COLORS.other} flex items-center justify-center flex-shrink-0`}>
          {ASSET_TYPE_ICONS[asset.type] || ASSET_TYPE_ICONS.other}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{asset.name}</p>
            {getHealthIcon(asset.health)}
          </div>
          <p className="text-xs text-gray-500 truncate">{asset.path}</p>
          {matchReason && (
            <p className="text-xs text-purple-400 mt-1">{matchReason}</p>
          )}
        </div>
        
        <div className="text-right flex-shrink-0">
          <p className="text-sm text-white">{formatSize(asset.size_mb)}</p>
          <p className="text-xs text-gray-500">{asset.type}</p>
        </div>
        
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetManager;
