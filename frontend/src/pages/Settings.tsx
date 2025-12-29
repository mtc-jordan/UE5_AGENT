import { useState, useEffect } from 'react'
import { useAuthStore, useSettingsStore } from '../lib/store'
import { agentsApi, preferencesApi } from '../lib/api'
import { toast } from 'sonner'
import {
  Settings as SettingsIcon,
  User,
  Cpu,
  Code,
  Workflow,
  Shield,
  Server,
  Palette,
  Save,
  Loader2,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Pin,
  Archive,
  Type,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  ExternalLink
} from 'lucide-react'
import { cn, agentColors } from '../lib/utils'

interface Agent {
  id: number
  key: string
  name: string
  persona: string
  system_prompt: string
  is_active: boolean
}

interface Preferences {
  auto_generate_title: boolean
  default_chat_mode: string
  default_model: string
  default_solo_agent: string
  default_active_agents: string[]
  auto_pin_project_chats: boolean
  title_format: string
  sidebar_collapsed: boolean
  show_archived_by_default: boolean
}

const agentIcons: Record<string, any> = {
  architect: Cpu,
  developer: Code,
  blueprint: Workflow,
  qa: Shield,
  devops: Server,
  artist: Palette}

const allAgents = ['architect', 'developer', 'blueprint', 'qa', 'devops', 'artist']

const agentNames: Record<string, string> = {
  architect: 'Lead Architect',
  developer: 'C++ Developer',
  blueprint: 'Blueprint Specialist',
  qa: 'QA Engineer',
  devops: 'DevOps Engineer',
  artist: 'Technical Artist'}

export default function Settings() {
  const { user } = useAuthStore()
  const { model, setModel, mode, setMode, setActiveAgents, setSoloAgent } = useSettingsStore()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'chat' | 'agents'>('general')
  
  // Preferences state
  const [preferences, setPreferences] = useState<Preferences>({
    auto_generate_title: true,
    default_chat_mode: 'team',
    default_model: 'deepseek-chat',
    default_solo_agent: 'architect',
    default_active_agents: ['architect', 'developer', 'blueprint', 'qa'],
    auto_pin_project_chats: false,
    title_format: '{topic}',
    sidebar_collapsed: false,
    show_archived_by_default: false})
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsChanged, setPrefsChanged] = useState(false)

  // API Keys state
  const [apiKeys, setApiKeys] = useState<{
    openai: string;
    deepseek: string;
    anthropic: string;
    google: string;
  }>({
    openai: '',
    deepseek: '',
    anthropic: '',
    google: ''
  })
  const [apiKeyVisibility, setApiKeyVisibility] = useState<{
    openai: boolean;
    deepseek: boolean;
    anthropic: boolean;
    google: boolean;
  }>({
    openai: false,
    deepseek: false,
    anthropic: false,
    google: false
  })
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    openai: 'unconfigured' | 'configured' | 'testing' | 'valid' | 'invalid';
    deepseek: 'unconfigured' | 'configured' | 'testing' | 'valid' | 'invalid';
    anthropic: 'unconfigured' | 'configured' | 'testing' | 'valid' | 'invalid';
    google: 'unconfigured' | 'configured' | 'testing' | 'valid' | 'invalid';
  }>({
    openai: 'unconfigured',
    deepseek: 'unconfigured',
    anthropic: 'unconfigured',
    google: 'unconfigured'
  })
  const [savingApiKey, setSavingApiKey] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
    loadPreferences()
    loadApiKeys()
  }, [])

  const loadAgents = async () => {
    try {
      const response = await agentsApi.list()
      setAgents(response.data)
      if (response.data.length > 0) {
        setSelectedAgent(response.data[0])
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPreferences = async () => {
    try {
      const response = await preferencesApi.get()
      setPreferences(response.data)
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      setPrefsLoading(false)
    }
  }

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/settings/api-keys')
      if (response.ok) {
        const data = await response.json()
        // Only show masked versions, never the actual keys
        setApiKeyStatus({
          openai: data.openai ? 'configured' : 'unconfigured',
          deepseek: data.deepseek ? 'configured' : 'unconfigured',
          anthropic: data.anthropic ? 'configured' : 'unconfigured',
          google: data.google ? 'configured' : 'unconfigured'
        })
      }
    } catch (error) {
      console.error('Failed to load API keys status:', error)
    }
  }

  const handleSaveApiKey = async (provider: 'openai' | 'deepseek' | 'anthropic' | 'google') => {
    const key = apiKeys[provider]
    if (!key.trim()) {
      toast.error('Please enter an API key')
      return
    }

    setSavingApiKey(provider)
    setApiKeyStatus(prev => ({ ...prev, [provider]: 'testing' }))

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.valid) {
          setApiKeyStatus(prev => ({ ...prev, [provider]: 'valid' }))
          setApiKeys(prev => ({ ...prev, [provider]: '' })) // Clear input after save
          toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved and validated!`)
          // After a delay, change status to configured
          setTimeout(() => {
            setApiKeyStatus(prev => ({ ...prev, [provider]: 'configured' }))
          }, 2000)
        } else {
          setApiKeyStatus(prev => ({ ...prev, [provider]: 'invalid' }))
          toast.error(data.error || 'API key validation failed')
        }
      } else {
        setApiKeyStatus(prev => ({ ...prev, [provider]: 'invalid' }))
        toast.error('Failed to save API key')
      }
    } catch (error) {
      console.error('Failed to save API key:', error)
      setApiKeyStatus(prev => ({ ...prev, [provider]: 'invalid' }))
      toast.error('Failed to save API key')
    } finally {
      setSavingApiKey(null)
    }
  }

  const handleDeleteApiKey = async (provider: 'openai' | 'deepseek' | 'anthropic' | 'google') => {
    if (!confirm(`Are you sure you want to delete the ${provider} API key?`)) return

    try {
      const response = await fetch(`/api/settings/api-keys/${provider}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setApiKeyStatus(prev => ({ ...prev, [provider]: 'unconfigured' }))
        toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key deleted`)
      } else {
        toast.error('Failed to delete API key')
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
      toast.error('Failed to delete API key')
    }
  }

  const toggleApiKeyVisibility = (provider: 'openai' | 'deepseek' | 'anthropic' | 'google') => {
    setApiKeyVisibility(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'configured':
      case 'valid':
        return <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Configured</span>
      case 'testing':
        return <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Testing...</span>
      case 'invalid':
        return <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 flex items-center gap-1"><X className="w-3 h-3" /> Invalid</span>
      default:
        return <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-400">Not Configured</span>
    }
  }

  const handleSaveAgent = async () => {
    if (!selectedAgent) return
    setSaving(true)
    try {
      const response = await agentsApi.update(selectedAgent.id, {
        name: selectedAgent.name,
        persona: selectedAgent.persona,
        system_prompt: selectedAgent.system_prompt,
        is_active: selectedAgent.is_active})
      setAgents(agents.map((a) => (a.id === selectedAgent.id ? response.data : a)))
    } catch (error) {
      console.error('Failed to save agent:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleResetAgents = async () => {
    if (!confirm('Reset all agents to default settings?')) return
    setLoading(true)
    try {
      await agentsApi.resetDefaults()
      await loadAgents()
    } catch (error) {
      console.error('Failed to reset agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrefsChange = (key: keyof Preferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
    setPrefsChanged(true)
  }

  const handleSavePreferences = async () => {
    setPrefsSaving(true)
    try {
      await preferencesApi.update(preferences)
      
      // Also update local settings store to sync immediately
      setModel(preferences.default_model)
      setMode(preferences.default_chat_mode as 'solo' | 'team')
      setActiveAgents(preferences.default_active_agents)
      setSoloAgent(preferences.default_solo_agent)
      
      setPrefsChanged(false)
      toast.success('Preferences saved successfully! New chats will use these settings.')
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Failed to save preferences. Please try again.')
    } finally {
      setPrefsSaving(false)
    }
  }

  const toggleAgent = (agentKey: string) => {
    const current = preferences.default_active_agents
    if (current.includes(agentKey)) {
      if (current.length > 1) {
        handlePrefsChange('default_active_agents', current.filter(a => a !== agentKey))
      }
    } else {
      handlePrefsChange('default_active_agents', [...current, agentKey])
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-ue-muted mt-1">Customize your AI assistant and chat preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-ue-bg rounded-lg p-1">
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'general'
                ? 'bg-ue-surface text-ue-text'
                : 'text-ue-muted hover:text-ue-text'
            )}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'chat'
                ? 'bg-ue-surface text-ue-text'
                : 'text-ue-muted hover:text-ue-text'
            )}
          >
            Chat Defaults
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={cn(
              'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'agents'
                ? 'bg-ue-surface text-ue-text'
                : 'text-ue-muted hover:text-ue-text'
            )}
          >
            Agent Customization
          </button>
        </div>

        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Profile */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile
              </h2>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    value={user?.username || ''}
                    className="input"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="input"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Quick Settings */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Quick Settings
              </h2>
              <div className="bg-ue-accent/10 border border-ue-accent/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-ue-accent">
                  ✓ Changes apply immediately to all new messages in any chat.
                </p>
              </div>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-1.5">
                    Current Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value)
                      const modelNames: Record<string, string> = {
                        'deepseek-chat': 'DeepSeek V3',
                        'deepseek-reasoner': 'DeepSeek R1',
                        'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
                        'claude-3-opus': 'Claude 3 Opus',
                        'gemini-2.5-flash': 'Gemini 2.5 Flash',
                        'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
                        'gemini-2.5-pro': 'Gemini 2.5 Pro',
                        'gemini-2.0-flash': 'Gemini 2.0 Flash'
                      }
                      toast.success(`Model changed to ${modelNames[e.target.value] || e.target.value}`)
                    }}
                    className="input"
                  >
                    <optgroup label="DeepSeek">
                      <option value="deepseek-chat">DeepSeek V3 (Fast)</option>
                      <option value="deepseek-reasoner">DeepSeek R1 (Reasoning)</option>
                    </optgroup>
                    <optgroup label="Anthropic">
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                    </optgroup>
                    <optgroup label="Google Gemini">
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced)</option>
                      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best Reasoning)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-1.5">
                    Current Mode
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value as 'solo' | 'team' | 'roundtable')
                      const modeNames = { solo: 'Solo', team: 'Team', roundtable: 'Round Table' }
                      toast.success(`Mode changed to ${modeNames[e.target.value as keyof typeof modeNames]}`)
                    }}
                    className="input"
                  >
                    <option value="solo">Solo Mode (Single Agent)</option>
                    <option value="team">Team Mode (Sequential Agents)</option>
                    <option value="roundtable">Round Table (Collaborative Discussion)</option>
                  </select>
                  {mode === 'roundtable' && (
                    <p className="text-xs text-ue-accent mt-2">
                      🎯 Round Table: Agents discuss together, build on each other's ideas, and provide a synthesized recommendation.
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-ue-muted mt-4">
                These settings are saved in your browser. For server-side persistent defaults, use the "Chat Defaults" tab.
              </p>
            </div>

            {/* API Keys Configuration */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Keys Configuration
              </h2>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-400">
                  🔐 Configure your API keys below. Keys are stored securely and validated before saving.
                </p>
              </div>
              <div className="space-y-4">
                {/* OpenAI */}
                <div className="p-4 bg-ue-bg rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <div>
                        <div className="font-medium">OpenAI</div>
                        <div className="text-xs text-ue-muted">GPT-4, GPT-3.5, DALL-E</div>
                      </div>
                    </div>
                    {getStatusBadge(apiKeyStatus.openai)}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={apiKeyVisibility.openai ? 'text' : 'password'}
                        value={apiKeys.openai}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                        placeholder={apiKeyStatus.openai === 'configured' ? '••••••••••••••••' : 'sk-...'}
                        className="input w-full pr-10"
                      />
                      <button
                        onClick={() => toggleApiKeyVisibility('openai')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ue-muted hover:text-ue-text"
                      >
                        {apiKeyVisibility.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveApiKey('openai')}
                      disabled={savingApiKey === 'openai' || !apiKeys.openai.trim()}
                      className="btn-primary px-4 disabled:opacity-50"
                    >
                      {savingApiKey === 'openai' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    {apiKeyStatus.openai === 'configured' && (
                      <button
                        onClick={() => handleDeleteApiKey('openai')}
                        className="btn-ghost px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-ue-accent hover:underline mt-2 inline-flex items-center gap-1">
                    Get API Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* DeepSeek */}
                <div className="p-4 bg-ue-bg rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <div>
                        <div className="font-medium">DeepSeek</div>
                        <div className="text-xs text-ue-muted">DeepSeek V3, DeepSeek R1</div>
                      </div>
                    </div>
                    {getStatusBadge(apiKeyStatus.deepseek)}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={apiKeyVisibility.deepseek ? 'text' : 'password'}
                        value={apiKeys.deepseek}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, deepseek: e.target.value }))}
                        placeholder={apiKeyStatus.deepseek === 'configured' ? '••••••••••••••••' : 'sk-...'}
                        className="input w-full pr-10"
                      />
                      <button
                        onClick={() => toggleApiKeyVisibility('deepseek')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ue-muted hover:text-ue-text"
                      >
                        {apiKeyVisibility.deepseek ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveApiKey('deepseek')}
                      disabled={savingApiKey === 'deepseek' || !apiKeys.deepseek.trim()}
                      className="btn-primary px-4 disabled:opacity-50"
                    >
                      {savingApiKey === 'deepseek' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    {apiKeyStatus.deepseek === 'configured' && (
                      <button
                        onClick={() => handleDeleteApiKey('deepseek')}
                        className="btn-ghost px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-xs text-ue-accent hover:underline mt-2 inline-flex items-center gap-1">
                    Get API Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Anthropic */}
                <div className="p-4 bg-ue-bg rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                      <div>
                        <div className="font-medium">Anthropic (Claude)</div>
                        <div className="text-xs text-ue-muted">Claude 3.5 Sonnet, Claude 3 Opus</div>
                      </div>
                    </div>
                    {getStatusBadge(apiKeyStatus.anthropic)}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={apiKeyVisibility.anthropic ? 'text' : 'password'}
                        value={apiKeys.anthropic}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                        placeholder={apiKeyStatus.anthropic === 'configured' ? '••••••••••••••••' : 'sk-ant-...'}
                        className="input w-full pr-10"
                      />
                      <button
                        onClick={() => toggleApiKeyVisibility('anthropic')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ue-muted hover:text-ue-text"
                      >
                        {apiKeyVisibility.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveApiKey('anthropic')}
                      disabled={savingApiKey === 'anthropic' || !apiKeys.anthropic.trim()}
                      className="btn-primary px-4 disabled:opacity-50"
                    >
                      {savingApiKey === 'anthropic' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    {apiKeyStatus.anthropic === 'configured' && (
                      <button
                        onClick={() => handleDeleteApiKey('anthropic')}
                        className="btn-ghost px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-ue-accent hover:underline mt-2 inline-flex items-center gap-1">
                    Get API Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Google Gemini */}
                <div className="p-4 bg-ue-bg rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <div>
                        <div className="font-medium">Google Gemini</div>
                        <div className="text-xs text-ue-muted">Gemini 2.5 Flash, Gemini Pro</div>
                      </div>
                    </div>
                    {getStatusBadge(apiKeyStatus.google)}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={apiKeyVisibility.google ? 'text' : 'password'}
                        value={apiKeys.google}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, google: e.target.value }))}
                        placeholder={apiKeyStatus.google === 'configured' ? '••••••••••••••••' : 'AIza...'}
                        className="input w-full pr-10"
                      />
                      <button
                        onClick={() => toggleApiKeyVisibility('google')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ue-muted hover:text-ue-text"
                      >
                        {apiKeyVisibility.google ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSaveApiKey('google')}
                      disabled={savingApiKey === 'google' || !apiKeys.google.trim()}
                      className="btn-primary px-4 disabled:opacity-50"
                    >
                      {savingApiKey === 'google' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                    {apiKeyStatus.google === 'configured' && (
                      <button
                        onClick={() => handleDeleteApiKey('google')}
                        className="btn-ghost px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-ue-accent hover:underline mt-2 inline-flex items-center gap-1">
                    Get API Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="mt-4 p-3 bg-ue-surface/50 rounded-lg">
                <p className="text-xs text-ue-muted">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  API keys are stored securely on the server and are never exposed to the frontend. Each key is validated before being saved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chat Defaults */}
        {activeTab === 'chat' && (
          <div className="space-y-6">
            {prefsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-ue-muted" />
              </div>
            ) : (
              <>
                {/* Auto Title Generation */}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-ue-accent" />
                    Auto Title Generation
                  </h2>
                  <p className="text-sm text-ue-muted mb-4">
                    Automatically generate descriptive chat titles based on your first message using AI.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-ue-bg rounded-lg">
                      <div>
                        <div className="font-medium">Enable Auto-Title</div>
                        <div className="text-sm text-ue-muted">Generate titles automatically for new chats</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.auto_generate_title}
                          onChange={(e) => handlePrefsChange('auto_generate_title', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-ue-border rounded-full peer peer-checked:bg-ue-accent peer-focus:ring-2 peer-focus:ring-ue-accent/50 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-1.5">
                        <Type className="w-4 h-4 inline mr-1" />
                        Title Format
                      </label>
                      <select
                        value={preferences.title_format}
                        onChange={(e) => handlePrefsChange('title_format', e.target.value)}
                        className="input"
                        disabled={!preferences.auto_generate_title}
                      >
                        <option value="{topic}">Topic Only (e.g., "Vehicle Health System")</option>
                        <option value="[{date}] {topic}">Date + Topic (e.g., "[12/25] Vehicle Health System")</option>
                        <option value="{project}: {topic}">Project + Topic (e.g., "MyGame: Vehicle Health System")</option>
                        <option value="[{project}] {topic}">Bracketed Project (e.g., "[MyGame] Vehicle Health System")</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Default Chat Settings */}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Default Chat Settings
                  </h2>
                  <p className="text-sm text-ue-muted mb-4">
                    These settings will be applied to all new chats you create.
                  </p>
                  
                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-1.5">
                        Default AI Model
                      </label>
                      <select
                        value={preferences.default_model}
                        onChange={(e) => handlePrefsChange('default_model', e.target.value)}
                        className="input"
                      >
                        <optgroup label="DeepSeek">
                          <option value="deepseek-chat">DeepSeek V3 (Fast & Efficient)</option>
                          <option value="deepseek-reasoner">DeepSeek R1 (Advanced Reasoning)</option>
                        </optgroup>
                        <optgroup label="Anthropic">
                          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Balanced)</option>
                          <option value="claude-3-opus">Claude 3 Opus (Highest Quality)</option>
                        </optgroup>
                        <optgroup label="Google Gemini">
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced)</option>
                          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best Reasoning)</option>
                          <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-1.5">
                        Default Chat Mode
                      </label>
                      <select
                        value={preferences.default_chat_mode}
                        onChange={(e) => handlePrefsChange('default_chat_mode', e.target.value)}
                        className="input"
                      >
                        <option value="solo">Solo Mode - Single agent responds</option>
                        <option value="team">Team Mode - Multiple agents collaborate</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-1.5">
                        Default Solo Agent
                      </label>
                      <select
                        value={preferences.default_solo_agent}
                        onChange={(e) => handlePrefsChange('default_solo_agent', e.target.value)}
                        className="input"
                      >
                        {allAgents.map(agent => (
                          <option key={agent} value={agent}>{agentNames[agent]}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-2">
                        Default Team Agents
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {allAgents.map(agent => {
                          const Icon = agentIcons[agent] || Cpu
                          const isActive = preferences.default_active_agents.includes(agent)
                          return (
                            <button
                              key={agent}
                              onClick={() => toggleAgent(agent)}
                              className={cn(
                                'flex items-center gap-2 p-2 rounded-lg border transition-colors',
                                isActive
                                  ? 'border-ue-accent bg-ue-accent/10'
                                  : 'border-ue-border hover:border-ue-muted'
                              )}
                            >
                              <div
                                className="w-8 h-8 rounded flex items-center justify-center"
                                style={{
                                  backgroundColor: `${agentColors[agent]}20`,
                                  color: agentColors[agent]}}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <span className="text-sm">{agentNames[agent]}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Behavior */}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Pin className="w-5 h-5" />
                    Chat Behavior
                  </h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-ue-bg rounded-lg">
                      <div>
                        <div className="font-medium">Auto-Pin Project Chats</div>
                        <div className="text-sm text-ue-muted">Automatically pin chats created within projects</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.auto_pin_project_chats}
                          onChange={(e) => handlePrefsChange('auto_pin_project_chats', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-ue-border rounded-full peer peer-checked:bg-ue-accent peer-focus:ring-2 peer-focus:ring-ue-accent/50 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-ue-bg rounded-lg">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Archive className="w-4 h-4" />
                          Show Archived by Default
                        </div>
                        <div className="text-sm text-ue-muted">Display archived chats in the sidebar</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.show_archived_by_default}
                          onChange={(e) => handlePrefsChange('show_archived_by_default', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-ue-border rounded-full peer peer-checked:bg-ue-accent peer-focus:ring-2 peer-focus:ring-ue-accent/50 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSavePreferences}
                    disabled={prefsSaving || !prefsChanged}
                    className={cn(
                      'btn flex items-center gap-2',
                      prefsChanged ? 'btn-primary' : 'btn-secondary opacity-50'
                    )}
                  >
                    {prefsSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {prefsChanged ? 'Save Preferences' : 'No Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Agent Customization */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Agent List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Agents</h3>
                <button
                  onClick={handleResetAgents}
                  className="p-2 text-ue-muted hover:text-ue-text transition-colors"
                  title="Reset to defaults"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-ue-muted" />
                </div>
              ) : (
                agents.map((agent) => {
                  const Icon = agentIcons[agent.key] || Cpu
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                        selectedAgent?.id === agent.id
                          ? 'bg-ue-surface border border-ue-border'
                          : 'hover:bg-ue-surface/50'
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: `${agentColors[agent.key]}20`,
                          color: agentColors[agent.key]}}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-ue-muted capitalize">{agent.key}</div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Agent Editor */}
            <div className="col-span-2">
              {selectedAgent ? (
                <div className="card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Edit Agent</h3>
                    <button
                      onClick={handleSaveAgent}
                      disabled={saving}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Changes
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-1.5">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={selectedAgent.name}
                        onChange={(e) =>
                          setSelectedAgent({ ...selectedAgent, name: e.target.value })
                        }
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-1.5">
                        Persona
                      </label>
                      <textarea
                        value={selectedAgent.persona}
                        onChange={(e) =>
                          setSelectedAgent({ ...selectedAgent, persona: e.target.value })
                        }
                        className="input min-h-[100px] resize-none"
                        placeholder="Describe the agent's personality and expertise..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ue-muted mb-1.5">
                        System Prompt
                      </label>
                      <textarea
                        value={selectedAgent.system_prompt}
                        onChange={(e) =>
                          setSelectedAgent({ ...selectedAgent, system_prompt: e.target.value })
                        }
                        className="input min-h-[200px] resize-none font-mono text-sm"
                        placeholder="Enter the system prompt for this agent..."
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={selectedAgent.is_active}
                        onChange={(e) =>
                          setSelectedAgent({ ...selectedAgent, is_active: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-ue-border bg-ue-bg text-ue-accent focus:ring-ue-accent"
                      />
                      <label htmlFor="is_active" className="text-sm">
                        Agent is active and available for selection
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card text-center py-12">
                  <Cpu className="w-12 h-12 text-ue-muted mx-auto mb-3" />
                  <p className="text-ue-muted">Select an agent to customize</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
