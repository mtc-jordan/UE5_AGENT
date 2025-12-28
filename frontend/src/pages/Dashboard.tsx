import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useChatStore } from '../lib/store'
import { projectsApi, chatsApi, mcpApi } from '../lib/api'
import {
  MessageSquare,
  FolderKanban,
  Plug,
  Plus,
  ArrowRight,
  Cpu,
  Code,
  Workflow,
  Shield,
} from 'lucide-react'
import { formatDate } from '../lib/utils'

interface Project {
  id: number
  name: string
  description: string
  ue_version: string
  created_at: string
}

interface MCPConnection {
  id: number
  name: string
  status: string
  endpoint: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { chats, setChats, setCurrentChat } = useChatStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [connections, setConnections] = useState<MCPConnection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [chatsRes, projectsRes, connectionsRes] = await Promise.all([
        chatsApi.list(),
        projectsApi.list(),
        mcpApi.connections(),
      ])
      setChats(chatsRes.data)
      setProjects(projectsRes.data)
      setConnections(connectionsRes.data)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = async () => {
    try {
      const response = await chatsApi.create({
        title: 'New Conversation',
        mode: 'team',
        model: 'deepseek-chat',
      })
      setChats([response.data, ...chats])
      setCurrentChat(response.data)
      navigate(`/chat/${response.data.id}`)
    } catch (error) {
      console.error('Failed to create chat:', error)
    }
  }

  const agents = [
    { key: 'architect', name: 'Lead Architect', icon: Cpu, color: 'text-agent-architect' },
    { key: 'developer', name: 'C++ Developer', icon: Code, color: 'text-agent-developer' },
    { key: 'blueprint', name: 'Blueprint Specialist', icon: Workflow, color: 'text-agent-blueprint' },
    { key: 'qa', name: 'QA Engineer', icon: Shield, color: 'text-agent-qa' },
  ]

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-ue-muted mt-1">
            Your AI-powered Unreal Engine 5 development assistant
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleNewChat}
            className="card hover:border-ue-accent transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-ue-accent/10 rounded-xl flex items-center justify-center group-hover:bg-ue-accent/20 transition-colors">
                <MessageSquare className="w-6 h-6 text-ue-accent" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">New Chat</div>
                <div className="text-sm text-ue-muted">Start a conversation</div>
              </div>
              <Plus className="w-5 h-5 text-ue-muted group-hover:text-ue-accent transition-colors" />
            </div>
          </button>

          <button
            onClick={() => navigate('/projects')}
            className="card hover:border-ue-accent transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-ue-success/10 rounded-xl flex items-center justify-center group-hover:bg-ue-success/20 transition-colors">
                <FolderKanban className="w-6 h-6 text-ue-success" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">Projects</div>
                <div className="text-sm text-ue-muted">{projects.length} projects</div>
              </div>
              <ArrowRight className="w-5 h-5 text-ue-muted group-hover:text-ue-success transition-colors" />
            </div>
          </button>

          <button
            onClick={() => navigate('/ue5')}
            className="card hover:border-ue-accent transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-ue-warning/10 rounded-xl flex items-center justify-center group-hover:bg-ue-warning/20 transition-colors">
                <Plug className="w-6 h-6 text-ue-warning" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">UE5 Connection</div>
                <div className="text-sm text-ue-muted">
                  {connections.filter((c) => c.status === 'connected').length} connected
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-ue-muted group-hover:text-ue-warning transition-colors" />
            </div>
          </button>
        </div>

        {/* AI Agents */}
        <div>
          <h2 className="text-lg font-semibold mb-4">AI Agents</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agents.map((agent) => (
              <div key={agent.key} className="card">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-ue-bg flex items-center justify-center ${agent.color}`}>
                    <agent.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="text-xs text-ue-muted capitalize">{agent.key}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Chats */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Conversations</h2>
            <button
              onClick={() => navigate('/chat')}
              className="text-sm text-ue-accent hover:underline"
            >
              View all
            </button>
          </div>
          
          {chats.length === 0 ? (
            <div className="card text-center py-8">
              <MessageSquare className="w-12 h-12 text-ue-muted mx-auto mb-3" />
              <p className="text-ue-muted">No conversations yet</p>
              <button
                onClick={handleNewChat}
                className="btn btn-primary mt-4"
              >
                Start your first chat
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {chats.slice(0, 5).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className="card hover:border-ue-accent transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{chat.title}</div>
                      <div className="text-sm text-ue-muted">
                        {chat.mode === 'team' ? 'Team Mode' : 'Solo Mode'} • {chat.model}
                      </div>
                    </div>
                    <div className="text-sm text-ue-muted">
                      {formatDate(chat.created_at)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
