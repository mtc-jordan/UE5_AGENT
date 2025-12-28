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
  artist: Palette,
}

const allAgents = ['architect', 'developer', 'blueprint', 'qa', 'devops', 'artist']

const agentNames: Record<string, string> = {
  architect: 'Lead Architect',
  developer: 'C++ Developer',
  blueprint: 'Blueprint Specialist',
  qa: 'QA Engineer',
  devops: 'DevOps Engineer',
  artist: 'Technical Artist',
}

export default function Settings() {
  const { user } = useAuthStore()
  const { model, setModel, mode, setMode, activeAgents, setActiveAgents, soloAgent, setSoloAgent } = useSettingsStore()
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
    show_archived_by_default: false,
  })
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsChanged, setPrefsChanged] = useState(false)

  useEffect(() => {
    loadAgents()
    loadPreferences()
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

  const handleSaveAgent = async () => {
    if (!selectedAgent) return
    setSaving(true)
    try {
      const response = await agentsApi.update(selectedAgent.id, {
        name: selectedAgent.name,
        persona: selectedAgent.persona,
        system_prompt: selectedAgent.system_prompt,
        is_active: selectedAgent.is_active,
      })
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
                      toast.success(`Model changed to ${e.target.value === 'deepseek-chat' ? 'DeepSeek V3' : e.target.value === 'deepseek-reasoner' ? 'DeepSeek R1' : e.target.value === 'claude-3-5-sonnet' ? 'Claude 3.5 Sonnet' : 'Claude 3 Opus'}`)
                    }}
                    className="input"
                  >
                    <option value="deepseek-chat">DeepSeek V3 (Fast)</option>
                    <option value="deepseek-reasoner">DeepSeek R1 (Reasoning)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
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
                        <option value="deepseek-chat">DeepSeek V3 (Fast & Efficient)</option>
                        <option value="deepseek-reasoner">DeepSeek R1 (Advanced Reasoning)</option>
                        <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Balanced)</option>
                        <option value="claude-3-opus">Claude 3 Opus (Highest Quality)</option>
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
                                  color: agentColors[agent],
                                }}
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
                          color: agentColors[agent.key],
                        }}
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
