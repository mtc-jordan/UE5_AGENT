/**
 * UE5 AI Studio - Plugins Page
 * =============================
 * 
 * Plugin marketplace and management page.
 * 
 * Version: 2.2.0
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Star,
  Download,
  Play,
  Trash2,
  Eye,
  Package,
  Code,
  Clock,
  TrendingUp,
  Zap,
  Grid,
  List,
  ChevronDown} from 'lucide-react';
import {
  pluginsApi,
  marketplaceApi,
  installationApi,
  templatesApi,
  PluginListItem,
  PluginTemplate,
  PluginCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS} from '../lib/plugin-api';

// =============================================================================
// COMPONENTS
// =============================================================================

interface PluginCardProps {
  plugin: PluginListItem;
  isInstalled?: boolean;
  isOwned?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onEdit?: () => void;
  onExecute?: () => void;
  onView?: () => void;
}

function PluginCard({
  plugin,
  isInstalled,
  isOwned,
  onInstall,
  onUninstall,
  onEdit,
  onExecute,
  onView
}: PluginCardProps) {
  const successRate = plugin.execution_count > 0
    ? Math.round((plugin.execution_count - (plugin.execution_count * 0.1)) / plugin.execution_count * 100)
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-all p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {CATEGORY_ICONS[plugin.category] || '⚙️'}
          </div>
          <div>
            <h3 className="font-semibold text-white">{plugin.name}</h3>
            <span className="text-xs text-gray-400">
              {CATEGORY_LABELS[plugin.category]}
            </span>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded text-xs ${
          plugin.status === 'active' ? 'bg-green-500/20 text-green-400' :
          plugin.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {plugin.status}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
        {plugin.description || 'No description provided'}
      </p>

      {/* Tags */}
      {plugin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {plugin.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
            >
              {tag}
            </span>
          ))}
          {plugin.tags.length > 3 && (
            <span className="text-xs text-gray-500">
              +{plugin.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
        <div className="flex items-center gap-1">
          <Play className="w-3 h-3" />
          <span>{plugin.execution_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400" />
          <span>{plugin.rating.toFixed(1)}</span>
          <span className="text-gray-500">({plugin.rating_count})</span>
        </div>
        {plugin.visibility === 'public' && (
          <div className="flex items-center gap-1 text-blue-400">
            <Eye className="w-3 h-3" />
            <span>Public</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isOwned ? (
          <>
            <button
              onClick={onEdit}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center justify-center gap-1"
            >
              <Code className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onExecute}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              <Play className="w-4 h-4" />
            </button>
          </>
        ) : isInstalled ? (
          <>
            <button
              onClick={onExecute}
              className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center justify-center gap-1"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
            <button
              onClick={onUninstall}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onView}
              className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center justify-center gap-1"
            >
              <Eye className="w-4 h-4" />
              View
            </button>
            <button
              onClick={onInstall}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: PluginTemplate;
  onUse: () => void;
}

function TemplateCard({ template, onUse }: TemplateCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-all p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {CATEGORY_ICONS[template.category] || '📋'}
          </div>
          <div>
            <h3 className="font-semibold text-white">{template.name}</h3>
            <span className="text-xs text-gray-400">
              {CATEGORY_LABELS[template.category]}
            </span>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded text-xs ${
          template.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
          template.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {template.difficulty}
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
        {template.description || 'No description'}
      </p>

      <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>~{template.estimated_time_minutes} min</span>
        </div>
      </div>

      <button
        onClick={onUse}
        className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm flex items-center justify-center gap-1"
      >
        <Plus className="w-4 h-4" />
        Use Template
      </button>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

type TabType = 'my-plugins' | 'marketplace' | 'installed' | 'templates';

export default function PluginsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('my-plugins');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PluginCategory | ''>('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'rating'>('popular');
  
  // Data
  const [myPlugins, setMyPlugins] = useState<PluginListItem[]>([]);
  const [marketplacePlugins, setMarketplacePlugins] = useState<PluginListItem[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);
  const [templates, setTemplates] = useState<PluginTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showNewPluginDialog, setShowNewPluginDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PluginTemplate | null>(null);
  const [newPluginName, setNewPluginName] = useState('');

  // Load data based on active tab
  useEffect(() => {
    loadData();
  }, [activeTab, searchQuery, categoryFilter, sortBy]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'my-plugins':
          const plugins = await pluginsApi.list({
            search: searchQuery || undefined,
            category: categoryFilter || undefined
          });
          setMyPlugins(plugins);
          break;

        case 'marketplace':
          const marketplace = await marketplaceApi.list({
            search: searchQuery || undefined,
            category: categoryFilter || undefined,
            sort_by: sortBy
          });
          setMarketplacePlugins(marketplace);
          break;

        case 'installed':
          const installed = await installationApi.list(false);
          setInstalledPlugins(installed);
          break;

        case 'templates':
          const tmpl = await templatesApi.list(categoryFilter || undefined);
          setTemplates(tmpl);
          break;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (pluginId: number) => {
    try {
      await installationApi.install(pluginId);
      loadData();
    } catch (error) {
      console.error('Failed to install plugin:', error);
    }
  };

  const handleUninstall = async (pluginId: number) => {
    try {
      await installationApi.uninstall(pluginId);
      loadData();
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !newPluginName.trim()) return;

    try {
      const plugin = await templatesApi.createFromTemplate(
        selectedTemplate.id,
        newPluginName.trim()
      );
      setShowTemplateDialog(false);
      setSelectedTemplate(null);
      setNewPluginName('');
      navigate(`/plugins/${plugin.id}/edit`);
    } catch (error) {
      console.error('Failed to create from template:', error);
    }
  };

  const handleCreateNew = () => {
    navigate('/plugins/new');
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Package className="w-7 h-7 text-purple-400" />
              Plugins
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Create, manage, and discover custom Python tools
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Plugin
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 w-fit">
          {[
            { id: 'my-plugins', label: 'My Plugins', icon: Code },
            { id: 'marketplace', label: 'Marketplace', icon: TrendingUp },
            { id: 'installed', label: 'Installed', icon: Download },
            { id: 'templates', label: 'Templates', icon: Zap }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as PluginCategory | '')}
              className="appearance-none px-4 py-2 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Sort (marketplace only) */}
          {activeTab === 'marketplace' && (
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none px-4 py-2 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="popular">Most Popular</option>
                <option value="recent">Most Recent</option>
                <option value="rating">Highest Rated</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* View Mode */}
          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-700' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-700' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-2'
          }>
            {/* My Plugins */}
            {activeTab === 'my-plugins' && (
              <>
                {myPlugins.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">
                      No plugins yet
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Create your first plugin or start from a template
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={handleCreateNew}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        New Plugin
                      </button>
                      <button
                        onClick={() => setActiveTab('templates')}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Browse Templates
                      </button>
                    </div>
                  </div>
                ) : (
                  myPlugins.map(plugin => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      isOwned
                      onEdit={() => navigate(`/plugins/${plugin.id}/edit`)}
                      onExecute={() => navigate(`/plugins/${plugin.id}/run`)}
                    />
                  ))
                )}
              </>
            )}

            {/* Marketplace */}
            {activeTab === 'marketplace' && (
              <>
                {marketplacePlugins.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">
                      No plugins found
                    </h3>
                    <p className="text-sm text-gray-500">
                      Try adjusting your search or filters
                    </p>
                  </div>
                ) : (
                  marketplacePlugins.map(plugin => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      onInstall={() => handleInstall(plugin.id)}
                      onView={() => navigate(`/plugins/${plugin.id}`)}
                    />
                  ))
                )}
              </>
            )}

            {/* Installed */}
            {activeTab === 'installed' && (
              <>
                {installedPlugins.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Download className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">
                      No installed plugins
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Browse the marketplace to find plugins
                    </p>
                    <button
                      onClick={() => setActiveTab('marketplace')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2 mx-auto"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Browse Marketplace
                    </button>
                  </div>
                ) : (
                  installedPlugins.map(inst => (
                    <PluginCard
                      key={inst.id}
                      plugin={inst.plugin}
                      isInstalled
                      onExecute={() => navigate(`/plugins/${inst.plugin_id}/run`)}
                      onUninstall={() => handleUninstall(inst.plugin_id)}
                    />
                  ))
                )}
              </>
            )}

            {/* Templates */}
            {activeTab === 'templates' && (
              <>
                {templates.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">
                      No templates available
                    </h3>
                    <p className="text-sm text-gray-500">
                      Templates will be added soon
                    </p>
                  </div>
                ) : (
                  templates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onUse={() => {
                        setSelectedTemplate(template);
                        setShowTemplateDialog(true);
                      }}
                    />
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Template Dialog */}
      {showTemplateDialog && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">
              Create from Template
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Creating plugin from: <strong>{selectedTemplate.name}</strong>
            </p>
            <input
              type="text"
              placeholder="Plugin name"
              value={newPluginName}
              onChange={(e) => setNewPluginName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTemplateDialog(false);
                  setSelectedTemplate(null);
                  setNewPluginName('');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFromTemplate}
                disabled={!newPluginName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
