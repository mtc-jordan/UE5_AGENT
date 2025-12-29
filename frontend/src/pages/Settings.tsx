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
  ExternalLink,
  Zap,
  Bot,
  Brain,
  Sliders,
  Bell,
  Lock,
  ChevronRight,
  CircleDot,
  Wand2,
  Users,
  Monitor,
  Moon,
  Sun,
  Globe,
  HelpCircle,
  LogOut,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info
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
  artist: Palette
}

const allAgents = ['architect', 'developer', 'blueprint', 'qa', 'devops', 'artist']

const agentNames: Record<string, string> = {
  architect: 'Lead Architect',
  developer: 'C++ Developer',
  blueprint: 'Blueprint Specialist',
  qa: 'QA Engineer',
  devops: 'DevOps Engineer',
  artist: 'Technical Artist'
}

type SettingsCategory = 'account' | 'ai-models' | 'chat' | 'agents' | 'appearance' | 'notifications'

const settingsCategories = [
  { id: 'account' as const, label: 'Account', icon: User, description: 'Profile and account settings' },
  { id: 'ai-models' as const, label: 'AI Models', icon: Brain, description: 'Model selection and API keys' },
  { id: 'chat' as const, label: 'Chat Preferences', icon: MessageSquare, description: 'Default chat behavior' },
  { id: 'agents' as const, label: 'AI Agents', icon: Bot, description: 'Customize AI agents' },
  { id: 'appearance' as const, label: 'Appearance', icon: Palette, description: 'Theme and display' },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell, description: 'Alert preferences' },
]

const apiProviders = [
  { 
    id: 'openai' as const, 
    name: 'OpenAI', 
    description: 'GPT-4, GPT-3.5, DALL-E',
    color: 'emerald',
    icon: '🤖',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  { 
    id: 'deepseek' as const, 
    name: 'DeepSeek', 
    description: 'DeepSeek V3, DeepSeek R1',
    color: 'blue',
    icon: '🔮',
    docsUrl: 'https://platform.deepseek.com/api_keys'
  },
  { 
    id: 'anthropic' as const, 
    name: 'Anthropic', 
    description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    color: 'orange',
    icon: '🧠',
    docsUrl: 'https://console.anthropic.com/settings/keys'
  },
  { 
    id: 'google' as const, 
    name: 'Google Gemini', 
    description: 'Gemini 2.5 Flash, Gemini Pro',
    color: 'purple',
    icon: '✨',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  },
]

export default function Settings() {
  const { user } = useAuthStore()
  const { model, setModel, mode, setMode, setActiveAgents, setSoloAgent } = useSettingsStore()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('account')
  
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
    show_archived_by_default: false
  })
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
  const [testingApiKey, setTestingApiKey] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{
    provider: string;
    success: boolean;
    message: string;
    latency?: number;
    models?: string[];
  } | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [expandedApiKey, setExpandedApiKey] = useState<string | null>(null)

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
          setApiKeys(prev => ({ ...prev, [provider]: '' }))
          toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved successfully!`)
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

  const handleTestApiKey = async (provider: 'openai' | 'deepseek' | 'anthropic' | 'google') => {
    setTestingApiKey(provider)
    const startTime = Date.now()
    
    try {
      const response = await fetch(`/api/settings/api-keys/test/${provider}`)
      const latency = Date.now() - startTime
      
      if (response.ok) {
        const data = await response.json()
        setTestResults({
          provider,
          success: data.valid,
          message: data.valid ? 'Connection successful! API key is valid.' : (data.error || 'API key validation failed'),
          latency,
          models: data.models
        })
        setShowTestModal(true)
        
        if (data.valid) {
          toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API connection successful!`)
        } else {
          toast.error(data.error || 'API key validation failed')
        }
      } else {
        setTestResults({
          provider,
          success: false,
          message: 'Failed to test API connection',
          latency
        })
        setShowTestModal(true)
        toast.error('Failed to test API connection')
      }
    } catch (error) {
      const latency = Date.now() - startTime
      setTestResults({
        provider,
        success: false,
        message: 'Network error: Could not reach the server',
        latency
      })
      setShowTestModal(true)
      toast.error('Network error: Could not reach the server')
    } finally {
      setTestingApiKey(null)
    }
  }

  const handleSaveAgent = async () => {
    if (!selectedAgent) return
    setSaving(true)
    try {
      await agentsApi.update(selectedAgent.id, {
        name: selectedAgent.name,
        persona: selectedAgent.persona,
        system_prompt: selectedAgent.system_prompt
      })
      toast.success('Agent settings saved!')
      loadAgents()
    } catch (error) {
      console.error('Failed to save agent:', error)
      toast.error('Failed to save agent settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    setPrefsSaving(true)
    try {
      await preferencesApi.update(preferences)
      toast.success('Preferences saved!')
      setPrefsChanged(false)
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Failed to save preferences')
    } finally {
      setPrefsSaving(false)
    }
  }

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
    setPrefsChanged(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'configured':
      case 'valid':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      case 'testing':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
      case 'invalid':
        return 'text-red-400 bg-red-500/10 border-red-500/30'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'configured':
      case 'valid':
        return <CheckCircle2 className="w-4 h-4" />
      case 'testing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'invalid':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <CircleDot className="w-4 h-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'configured':
      case 'valid':
        return 'Connected'
      case 'testing':
        return 'Testing...'
      case 'invalid':
        return 'Invalid'
      default:
        return 'Not configured'
    }
  }

  // Render Account Settings
  const renderAccountSettings = () => (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-ue-accent/20 to-purple-500/20 px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-ue-accent to-purple-500 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-ue-surface border-2 border-ue-border flex items-center justify-center hover:bg-ue-accent/20 transition-colors">
                <Palette className="w-4 h-4 text-ue-muted" />
              </button>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user?.username || 'User'}</h2>
              <p className="text-ue-muted">{user?.email || 'user@example.com'}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-ue-accent/20 text-ue-accent border border-ue-accent/30">
                  Pro Plan
                </span>
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ue-muted mb-2">Display Name</label>
              <input
                type="text"
                value={user?.username || ''}
                className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white placeholder-ue-muted focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ue-muted mb-2">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white placeholder-ue-muted focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all"
                placeholder="your@email.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <button className="flex items-center gap-3 p-4 bg-ue-surface border border-ue-border rounded-xl hover:bg-ue-accent/10 hover:border-ue-accent/30 transition-all group">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-left">
            <div className="font-medium text-white group-hover:text-ue-accent transition-colors">Change Password</div>
            <div className="text-xs text-ue-muted">Update your security</div>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-ue-surface border border-ue-border rounded-xl hover:bg-ue-accent/10 hover:border-ue-accent/30 transition-all group">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <div className="font-medium text-white group-hover:text-ue-accent transition-colors">Language</div>
            <div className="text-xs text-ue-muted">English (US)</div>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-ue-surface border border-ue-border rounded-xl hover:bg-red-500/10 hover:border-red-500/30 transition-all group">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-left">
            <div className="font-medium text-white group-hover:text-red-400 transition-colors">Sign Out</div>
            <div className="text-xs text-ue-muted">End your session</div>
          </div>
        </button>
      </div>
    </div>
  )

  // Render AI Models Settings
  const renderAIModelsSettings = () => (
    <div className="space-y-6">
      {/* Current Model Selection */}
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ue-accent to-purple-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Active AI Model</h3>
            <p className="text-sm text-ue-muted">Select your preferred AI model for conversations</p>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ue-muted mb-2">Model</label>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                toast.success(`Model changed successfully`)
              }}
              className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all appearance-none cursor-pointer"
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
            <label className="block text-sm font-medium text-ue-muted mb-2">Mode</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as 'solo' | 'team' | 'roundtable')
                toast.success(`Mode changed successfully`)
              }}
              className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all appearance-none cursor-pointer"
            >
              <option value="solo">Solo Mode (Single Agent)</option>
              <option value="team">Team Mode (Sequential)</option>
              <option value="roundtable">Round Table (Collaborative)</option>
            </select>
          </div>
        </div>

        {mode === 'roundtable' && (
          <div className="mt-4 p-4 bg-ue-accent/10 border border-ue-accent/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-ue-accent mt-0.5" />
              <div>
                <p className="text-sm font-medium text-ue-accent">Round Table Mode</p>
                <p className="text-xs text-ue-muted mt-1">Agents discuss together, build on each other's ideas, and provide a synthesized recommendation.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Keys Configuration */}
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-ue-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Key className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">API Keys</h3>
                <p className="text-sm text-ue-muted">Connect your AI provider accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-ue-muted">
              <Lock className="w-3.5 h-3.5" />
              <span>Encrypted & Secure</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-ue-border">
          {apiProviders.map((provider) => {
            const status = apiKeyStatus[provider.id]
            const isExpanded = expandedApiKey === provider.id
            
            return (
              <div key={provider.id} className="group">
                <button
                  onClick={() => setExpandedApiKey(isExpanded ? null : provider.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-ue-bg/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{provider.icon}</div>
                    <div className="text-left">
                      <div className="font-medium text-white">{provider.name}</div>
                      <div className="text-xs text-ue-muted">{provider.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                      getStatusColor(status)
                    )}>
                      {getStatusIcon(status)}
                      <span>{getStatusText(status)}</span>
                    </div>
                    <ChevronRight className={cn(
                      "w-5 h-5 text-ue-muted transition-transform",
                      isExpanded && "rotate-90"
                    )} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <input
                          type={apiKeyVisibility[provider.id] ? 'text' : 'password'}
                          value={apiKeys[provider.id]}
                          onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                          placeholder={status === 'configured' ? '••••••••••••••••••••••••' : `Enter your ${provider.name} API key`}
                          className="w-full px-4 py-3 pr-12 bg-ue-bg border border-ue-border rounded-xl text-white placeholder-ue-muted focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all font-mono text-sm"
                        />
                        <button
                          onClick={() => toggleApiKeyVisibility(provider.id)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ue-muted hover:text-white transition-colors"
                        >
                          {apiKeyVisibility[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleSaveApiKey(provider.id)}
                        disabled={savingApiKey === provider.id || !apiKeys[provider.id].trim()}
                        className="px-5 py-3 bg-ue-accent hover:bg-ue-accent/80 disabled:bg-ue-accent/30 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                      >
                        {savingApiKey === provider.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-ue-accent hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Get API Key
                      </a>
                      
                      {status === 'configured' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestApiKey(provider.id)}
                            disabled={testingApiKey === provider.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          >
                            {testingApiKey === provider.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Zap className="w-3.5 h-3.5" />
                            )}
                            Test
                          </button>
                          <button
                            onClick={() => handleDeleteApiKey(provider.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // Render Chat Preferences
  const renderChatPreferences = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Chat Behavior</h3>
            <p className="text-sm text-ue-muted">Configure default chat settings</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Toggle Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-ue-bg rounded-xl">
              <div className="flex items-center gap-3">
                <Wand2 className="w-5 h-5 text-ue-accent" />
                <div>
                  <div className="font-medium text-white">Auto-generate Titles</div>
                  <div className="text-xs text-ue-muted">Automatically create chat titles from content</div>
                </div>
              </div>
              <button
                onClick={() => updatePreference('auto_generate_title', !preferences.auto_generate_title)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  preferences.auto_generate_title ? "bg-ue-accent" : "bg-ue-border"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  preferences.auto_generate_title ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-ue-bg rounded-xl">
              <div className="flex items-center gap-3">
                <Pin className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-medium text-white">Auto-pin Project Chats</div>
                  <div className="text-xs text-ue-muted">Automatically pin chats linked to projects</div>
                </div>
              </div>
              <button
                onClick={() => updatePreference('auto_pin_project_chats', !preferences.auto_pin_project_chats)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  preferences.auto_pin_project_chats ? "bg-ue-accent" : "bg-ue-border"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  preferences.auto_pin_project_chats ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-ue-bg rounded-xl">
              <div className="flex items-center gap-3">
                <Archive className="w-5 h-5 text-orange-400" />
                <div>
                  <div className="font-medium text-white">Show Archived by Default</div>
                  <div className="text-xs text-ue-muted">Display archived chats in the sidebar</div>
                </div>
              </div>
              <button
                onClick={() => updatePreference('show_archived_by_default', !preferences.show_archived_by_default)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  preferences.show_archived_by_default ? "bg-ue-accent" : "bg-ue-border"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  preferences.show_archived_by_default ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>

          {/* Default Settings */}
          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-ue-border">
            <div>
              <label className="block text-sm font-medium text-ue-muted mb-2">Default Chat Mode</label>
              <select
                value={preferences.default_chat_mode}
                onChange={(e) => updatePreference('default_chat_mode', e.target.value)}
                className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all"
              >
                <option value="solo">Solo Mode</option>
                <option value="team">Team Mode</option>
                <option value="roundtable">Round Table</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ue-muted mb-2">Default Solo Agent</label>
              <select
                value={preferences.default_solo_agent}
                onChange={(e) => updatePreference('default_solo_agent', e.target.value)}
                className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all"
              >
                {allAgents.map(agent => (
                  <option key={agent} value={agent}>{agentNames[agent]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title Format */}
          <div className="pt-4 border-t border-ue-border">
            <label className="block text-sm font-medium text-ue-muted mb-2">Title Format</label>
            <input
              type="text"
              value={preferences.title_format}
              onChange={(e) => updatePreference('title_format', e.target.value)}
              className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white placeholder-ue-muted focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all font-mono text-sm"
              placeholder="{topic}"
            />
            <p className="text-xs text-ue-muted mt-2">Use {'{topic}'} as a placeholder for the auto-generated topic</p>
          </div>

          {/* Save Button */}
          {prefsChanged && (
            <div className="flex justify-end pt-4 border-t border-ue-border">
              <button
                onClick={handleSavePreferences}
                disabled={prefsSaving}
                className="px-6 py-3 bg-ue-accent hover:bg-ue-accent/80 disabled:bg-ue-accent/30 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                {prefsSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Render Agents Settings
  const renderAgentsSettings = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-ue-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Agents</h3>
              <p className="text-sm text-ue-muted">Customize agent personalities and behaviors</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ue-border">
          {/* Agent List */}
          <div className="p-4 space-y-2">
            {agents.map((agent) => {
              const Icon = agentIcons[agent.key] || Bot
              const colors = agentColors[agent.key] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' }
              
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                    selectedAgent?.id === agent.id
                      ? `${colors.bg} ${colors.border} border`
                      : "hover:bg-ue-bg"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors.bg)}>
                    <Icon className={cn("w-5 h-5", colors.text)} />
                  </div>
                  <div className="text-left">
                    <div className={cn("font-medium", selectedAgent?.id === agent.id ? colors.text : "text-white")}>
                      {agent.name}
                    </div>
                    <div className="text-xs text-ue-muted truncate max-w-[120px]">{agent.persona}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Agent Editor */}
          <div className="md:col-span-2 p-6">
            {selectedAgent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-2">Agent Name</label>
                  <input
                    type="text"
                    value={selectedAgent.name}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, name: e.target.value })}
                    className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-2">Persona</label>
                  <input
                    type="text"
                    value={selectedAgent.persona}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, persona: e.target.value })}
                    className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-2">System Prompt</label>
                  <textarea
                    value={selectedAgent.system_prompt}
                    onChange={(e) => setSelectedAgent({ ...selectedAgent, system_prompt: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-3 bg-ue-bg border border-ue-border rounded-xl text-white placeholder-ue-muted focus:outline-none focus:ring-2 focus:ring-ue-accent/50 focus:border-ue-accent transition-all resize-none font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveAgent}
                    disabled={saving}
                    className="px-6 py-3 bg-ue-accent hover:bg-ue-accent/80 disabled:bg-ue-accent/30 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Agent
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-ue-muted">
                Select an agent to edit
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Default Active Agents */}
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Default Active Agents</h3>
        <p className="text-sm text-ue-muted mb-4">Select which agents are active by default in Team Mode</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {allAgents.map(agent => {
            const Icon = agentIcons[agent] || Bot
            const colors = agentColors[agent] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' }
            const isActive = preferences.default_active_agents.includes(agent)
            
            return (
              <button
                key={agent}
                onClick={() => {
                  const newAgents = isActive
                    ? preferences.default_active_agents.filter(a => a !== agent)
                    : [...preferences.default_active_agents, agent]
                  updatePreference('default_active_agents', newAgents)
                }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                  isActive
                    ? `${colors.bg} ${colors.border}`
                    : "bg-ue-bg border-ue-border hover:border-ue-muted"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors.bg)}>
                  <Icon className={cn("w-4 h-4", colors.text)} />
                </div>
                <span className={cn("font-medium", isActive ? colors.text : "text-white")}>
                  {agentNames[agent]}
                </span>
                {isActive && <Check className={cn("w-4 h-4 ml-auto", colors.text)} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  // Render Appearance Settings
  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Theme</h3>
            <p className="text-sm text-ue-muted">Customize the look and feel</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button className="p-4 bg-ue-bg border-2 border-ue-accent rounded-xl flex flex-col items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-[#1a1a2e] border border-ue-border flex items-center justify-center">
              <Moon className="w-6 h-6 text-ue-accent" />
            </div>
            <span className="font-medium text-ue-accent">Dark</span>
          </button>
          <button className="p-4 bg-ue-bg border border-ue-border rounded-xl flex flex-col items-center gap-3 hover:border-ue-muted transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <Sun className="w-6 h-6 text-yellow-500" />
            </div>
            <span className="font-medium text-ue-muted group-hover:text-white transition-colors">Light</span>
          </button>
          <button className="p-4 bg-ue-bg border border-ue-border rounded-xl flex flex-col items-center gap-3 hover:border-ue-muted transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a1a2e] to-white border border-ue-border flex items-center justify-center">
              <Monitor className="w-6 h-6 text-ue-muted" />
            </div>
            <span className="font-medium text-ue-muted group-hover:text-white transition-colors">System</span>
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Accent Color</h3>
        <div className="flex gap-3">
          {['#00d9ff', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map(color => (
            <button
              key={color}
              className={cn(
                "w-10 h-10 rounded-xl transition-transform hover:scale-110",
                color === '#00d9ff' && "ring-2 ring-offset-2 ring-offset-ue-surface ring-white"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-ue-accent" />
            <div>
              <div className="font-medium text-white">Compact Sidebar</div>
              <div className="text-xs text-ue-muted">Collapse sidebar to icons only</div>
            </div>
          </div>
          <button
            onClick={() => updatePreference('sidebar_collapsed', !preferences.sidebar_collapsed)}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors",
              preferences.sidebar_collapsed ? "bg-ue-accent" : "bg-ue-border"
            )}
          >
            <div className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              preferences.sidebar_collapsed ? "left-7" : "left-1"
            )} />
          </button>
        </div>
      </div>
    </div>
  )

  // Render Notifications Settings
  const renderNotificationsSettings = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-ue-surface to-ue-bg border border-ue-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
            <p className="text-sm text-ue-muted">Control how you receive alerts</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { icon: MessageSquare, title: 'Chat Notifications', desc: 'Get notified about new messages', enabled: true },
            { icon: Users, title: 'Collaboration Alerts', desc: 'Updates from team members', enabled: true },
            { icon: Zap, title: 'System Updates', desc: 'Important platform announcements', enabled: false },
            { icon: HelpCircle, title: 'Tips & Tutorials', desc: 'Helpful suggestions and guides', enabled: false },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-ue-bg rounded-xl">
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-ue-accent" />
                <div>
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="text-xs text-ue-muted">{item.desc}</div>
                </div>
              </div>
              <button
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors",
                  item.enabled ? "bg-ue-accent" : "bg-ue-border"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  item.enabled ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeCategory) {
      case 'account':
        return renderAccountSettings()
      case 'ai-models':
        return renderAIModelsSettings()
      case 'chat':
        return renderChatPreferences()
      case 'agents':
        return renderAgentsSettings()
      case 'appearance':
        return renderAppearanceSettings()
      case 'notifications':
        return renderNotificationsSettings()
      default:
        return renderAccountSettings()
    }
  }

  return (
    <div className="min-h-screen bg-ue-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-ue-bg/80 backdrop-blur-xl border-b border-ue-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ue-accent to-purple-500 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-sm text-ue-muted">Manage your account and preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {settingsCategories.map((category) => {
                const Icon = category.icon
                const isActive = activeCategory === category.id
                
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                      isActive
                        ? "bg-ue-accent/10 text-ue-accent border border-ue-accent/30"
                        : "text-ue-muted hover:text-white hover:bg-ue-surface"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{category.label}</div>
                      <div className="text-xs opacity-70">{category.description}</div>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Test Results Modal */}
      {showTestModal && testResults && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-ue-surface border border-ue-border rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-ue-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-ue-accent" />
                  <h3 className="text-lg font-semibold text-white">API Connection Test</h3>
                </div>
                <button
                  onClick={() => setShowTestModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-ue-bg flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-ue-muted" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className={cn(
                "p-4 rounded-xl border",
                testResults.success
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              )}>
                <div className="flex items-center gap-3">
                  {testResults.success ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  )}
                  <div>
                    <div className={cn(
                      "font-semibold",
                      testResults.success ? "text-emerald-400" : "text-red-400"
                    )}>
                      {testResults.success ? 'Connection Successful' : 'Connection Failed'}
                    </div>
                    <div className="text-sm text-ue-muted capitalize">{testResults.provider} API</div>
                  </div>
                </div>
                <p className="text-sm text-ue-muted mt-3">{testResults.message}</p>
              </div>

              {testResults.latency && (
                <div className="flex items-center justify-between p-3 bg-ue-bg rounded-xl">
                  <span className="text-sm text-ue-muted">Response Time</span>
                  <span className="font-mono text-white">{testResults.latency}ms</span>
                </div>
              )}

              {testResults.models && testResults.models.length > 0 && (
                <div className="p-3 bg-ue-bg rounded-xl">
                  <div className="text-sm text-ue-muted mb-2">Available Models</div>
                  <div className="flex flex-wrap gap-2">
                    {testResults.models.slice(0, 5).map((model, i) => (
                      <span key={i} className="px-2 py-1 text-xs bg-ue-surface rounded-lg text-white">
                        {model}
                      </span>
                    ))}
                    {testResults.models.length > 5 && (
                      <span className="px-2 py-1 text-xs bg-ue-surface rounded-lg text-ue-muted">
                        +{testResults.models.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setShowTestModal(false)}
                className="w-full py-3 bg-ue-accent hover:bg-ue-accent/80 text-white rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
