import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useChatStore, useSettingsStore } from '../lib/store'
import { chatsApi, aiApi, projectsApi, preferencesApi } from '../lib/api'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Send,
  Loader2,
  StopCircle,
  Users,
  User,
  Settings2,
  ChevronDown,
  Check,
  Cpu,
  Code,
  Workflow,
  Shield,
  Server,
  Palette,
  FolderKanban,
  GitBranch,
  Info,
  MessageCircle,
} from 'lucide-react'
import { cn, agentColors } from '../lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  agent?: string
  agent_name?: string
  agent_color?: string
  content: string
  created_at: string
}

interface Project {
  id: number
  name: string
  description: string
  ue_version: string
  project_path: string
}

const agentIcons: Record<string, any> = {
  architect: Cpu,
  developer: Code,
  blueprint: Workflow,
  qa: Shield,
  devops: Server,
  artist: Palette,
}

const agentNames: Record<string, string> = {
  architect: 'Lead Architect',
  developer: 'C++ Developer',
  blueprint: 'Blueprint Specialist',
  qa: 'QA Engineer',
  devops: 'DevOps Engineer',
  artist: 'Technical Artist',
}

const models = [
  { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Fast & efficient' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Advanced reasoning' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Balanced' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Highest quality' },
]

const allAgents = ['architect', 'developer', 'blueprint', 'qa', 'devops', 'artist']

export default function Chat() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { 
    currentChat, 
    setCurrentChat, 
    messages, 
    setMessages, 
    addMessage, 
    isLoading, 
    setLoading,
    clearMessages,
    cacheMessages,
    getCachedMessages
  } = useChatStore()
  const { mode, setMode, model, setModel, activeAgents, setActiveAgents, soloAgent, setSoloAgent } = useSettingsStore()
  
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showAgentSelector, setShowAgentSelector] = useState(false)
  const [currentPhase, setCurrentPhase] = useState('')
  const [streamingMessages, setStreamingMessages] = useState<Map<string, Message>>(new Map())
  const [isLoadingChat, setIsLoadingChat] = useState(false)
  const [project, setProject] = useState<Project | null>(null)
  const [showProjectInfo, setShowProjectInfo] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isStreamingRef = useRef(false)
  const currentChatIdRef = useRef<number | null>(null)

  // Handle chat switching
  useEffect(() => {
    const newChatId = chatId ? parseInt(chatId) : null
    
    // If switching to a different chat, cancel any ongoing streaming
    if (currentChatIdRef.current !== newChatId) {
      if (isStreamingRef.current) {
        isStreamingRef.current = false
        abortControllerRef.current?.abort()
        setLoading(false)
        setCurrentPhase('')
        setStreamingMessages(new Map())
      }
      
      currentChatIdRef.current = newChatId
      setProject(null)
      
      if (newChatId) {
        loadChat(newChatId)
      } else {
        // New chat - clear everything
        setCurrentChat(null)
        clearMessages()
        setStreamingMessages(new Map())
      }
    }
  }, [chatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMessages])

  const loadChat = async (id: number) => {
    // Check if we're still on the same chat
    if (currentChatIdRef.current !== id) return
    
    setIsLoadingChat(true)
    
    // Clear current messages immediately to prevent showing old chat
    clearMessages()
    setStreamingMessages(new Map())
    
    try {
      const [chatRes, messagesRes] = await Promise.all([
        chatsApi.get(id),
        chatsApi.messages(id),
      ])
      
      // Check again if we're still on the same chat (user might have switched)
      if (currentChatIdRef.current !== id) return
      
      setCurrentChat(chatRes.data)
      
      // Load project if linked
      if (chatRes.data.project_id) {
        try {
          const projectRes = await projectsApi.get(chatRes.data.project_id)
          setProject(projectRes.data)
        } catch (e) {
          console.error('Failed to load project:', e)
        }
      }
      
      const loadedMessages = messagesRes.data.map((m: any) => ({
        ...m,
        id: m.id.toString(),
        agent_name: m.agent ? agentNames[m.agent] : undefined,
        agent_color: m.agent ? agentColors[m.agent] : undefined,
      }))
      
      setMessages(loadedMessages)
      cacheMessages(id, loadedMessages)
      
      // Note: We no longer override user's current settings when loading a chat
      // The user's selected model/mode in the UI should be used for the next message
      // The chat's stored settings are just historical record of what was used
    } catch (error) {
      console.error('Failed to load chat:', error)
      // Only navigate away if we're still on this chat
      if (currentChatIdRef.current === id) {
        navigate('/chat')
      }
    } finally {
      setIsLoadingChat(false)
    }
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Auto-generate chat title based on first message
  const generateChatTitle = async (chatId: number, firstMessage: string) => {
    try {
      // Check user preferences for auto-title generation
      const prefsRes = await preferencesApi.get()
      if (!prefsRes.data.auto_generate_title) return

      // Generate title using AI
      const titleRes = await preferencesApi.generateTitle(
        firstMessage,
        project?.name
      )
      
      if (titleRes.data.title) {
        // Update the chat title
        await chatsApi.update(chatId, { title: titleRes.data.title })
        
        // Update local state
        if (currentChat && currentChat.id === chatId) {
          setCurrentChat({ ...currentChat, title: titleRes.data.title })
        }
      }
    } catch (error) {
      console.error('Failed to generate chat title:', error)
      // Silently fail - the default title will remain
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    const messageContent = input.trim()
    setInput('')
    setLoading(true)
    setCurrentPhase('')
    setStreamingMessages(new Map())
    isStreamingRef.current = true

    // Create chat if needed
    let activeChatId = currentChat?.id
    let isNewChat = false
    if (!activeChatId) {
      try {
        const response = await chatsApi.create({
          title: 'New Conversation', // Temporary title
          mode,
          model,
          active_agents: activeAgents,
          solo_agent: soloAgent,
        })
        activeChatId = response.data.id
        currentChatIdRef.current = activeChatId
        // Important: Set current chat which also sets currentChatId in store
        // This ensures addMessage will cache messages for this chat
        setCurrentChat(response.data)
        isNewChat = true
        navigate(`/chat/${activeChatId}`, { replace: true })
        
        // Now add the user message AFTER the chat is created and currentChatId is set
        addMessage(userMessage)
        
        // Auto-generate title in background
        generateChatTitle(activeChatId, messageContent)
      } catch (error) {
        console.error('Failed to create chat:', error)
        setLoading(false)
        isStreamingRef.current = false
        return
      }
    } else {
      // Existing chat - add message immediately
      addMessage(userMessage)
    }

    // Store the chat ID we're streaming for
    const streamingForChatId = activeChatId

    // Stream AI response
    try {
      abortControllerRef.current = new AbortController()
      
      const assistantMessages = new Map<string, Message>()
      
      for await (const chunk of aiApi.chat({
        message: userMessage.content,
        chat_id: activeChatId,
        mode,
        active_agents: activeAgents,
        solo_agent: soloAgent,
        model,
      })) {
        // Check if streaming was cancelled or chat changed
        if (!isStreamingRef.current || currentChatIdRef.current !== streamingForChatId) break
        
        if (chunk.type === 'phase') {
          setCurrentPhase(chunk.phase || chunk.message || '')
        } else if (chunk.type === 'chunk') {
          const agent = chunk.agent || 'assistant'
          
          if (!assistantMessages.has(agent)) {
            const newMessage: Message = {
              id: `${Date.now()}-${agent}`,
              role: 'assistant',
              agent,
              agent_name: chunk.agent_name || agentNames[agent],
              agent_color: chunk.agent_color || agentColors[agent],
              content: '',
              created_at: new Date().toISOString(),
            }
            assistantMessages.set(agent, newMessage)
          }
          
          const msg = assistantMessages.get(agent)!
          msg.content += chunk.content || ''
          
          // Update streaming messages state - create new Map to trigger re-render
          setStreamingMessages(new Map(assistantMessages))
        } else if (chunk.type === 'complete') {
          // Message complete for this agent - move to permanent messages
          const agent = chunk.agent || 'assistant'
          const completedMsg = assistantMessages.get(agent)
          if (completedMsg) {
            // Update with final content
            completedMsg.content = chunk.content || completedMsg.content
            // Only add if we're still on the same chat
            if (currentChatIdRef.current === streamingForChatId) {
              addMessage({ ...completedMsg })
            }
            assistantMessages.delete(agent)
            setStreamingMessages(new Map(assistantMessages))
          }
        } else if (chunk.type === 'error') {
          if (currentChatIdRef.current === streamingForChatId) {
            const errorMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: `Error: ${chunk.message}`,
              created_at: new Date().toISOString(),
            }
            addMessage(errorMessage)
          }
        } else if (chunk.type === 'cancelled') {
          // Stream was cancelled
          break
        }
      }
      
      // Move any remaining streaming messages to permanent messages
      if (currentChatIdRef.current === streamingForChatId) {
        assistantMessages.forEach((msg) => {
          if (msg.content) {
            addMessage({ ...msg })
          }
        })
      }
      setStreamingMessages(new Map())
      
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.message !== 'Request timed out') {
        console.error('Chat error:', error)
        if (currentChatIdRef.current === streamingForChatId) {
          const errorMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Error: ${error.message || 'Failed to get response'}`,
            created_at: new Date().toISOString(),
          }
          addMessage(errorMessage)
        }
      }
    } finally {
      setLoading(false)
      setCurrentPhase('')
      setStreamingMessages(new Map())
      abortControllerRef.current = null
      isStreamingRef.current = false
    }
  }

  const handleStop = () => {
    isStreamingRef.current = false
    abortControllerRef.current?.abort()
    setLoading(false)
    setCurrentPhase('')
    
    // Move any streaming messages to permanent messages
    streamingMessages.forEach((msg) => {
      if (msg.content) {
        addMessage({ ...msg })
      }
    })
    setStreamingMessages(new Map())
  }

  const toggleAgent = (agent: string) => {
    if (activeAgents.includes(agent)) {
      if (activeAgents.length > 1) {
        setActiveAgents(activeAgents.filter((a) => a !== agent))
      }
    } else {
      setActiveAgents([...activeAgents, agent])
    }
  }

  // Combine permanent messages with streaming messages for display
  const displayMessages = [...messages]
  streamingMessages.forEach((msg) => {
    displayMessages.push(msg)
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ue-border bg-ue-surface">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-semibold">
              {currentChat?.title || 'New Conversation'}
            </h1>
            {/* Project Badge */}
            {project && (
              <Link 
                to="/projects"
                className="flex items-center gap-1.5 text-xs text-ue-muted hover:text-ue-accent transition-colors mt-0.5"
              >
                <FolderKanban className="w-3 h-3" />
                <span>{project.name}</span>
                <span className="text-ue-border">•</span>
                <GitBranch className="w-3 h-3" />
                <span>UE {project.ue_version}</span>
              </Link>
            )}
          </div>
          
          {/* Mode Toggle */}
          <div className="flex items-center bg-ue-bg rounded-lg p-1">
            <button
              onClick={() => setMode('solo')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                mode === 'solo' ? 'bg-ue-surface text-ue-text' : 'text-ue-muted hover:text-ue-text'
              )}
              title="Single agent responds"
            >
              <User className="w-4 h-4" />
              Solo
            </button>
            <button
              onClick={() => setMode('team')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                mode === 'team' ? 'bg-ue-surface text-ue-text' : 'text-ue-muted hover:text-ue-text'
              )}
              title="Agents respond sequentially"
            >
              <Users className="w-4 h-4" />
              Team
            </button>
            <button
              onClick={() => setMode('roundtable')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                mode === 'roundtable' ? 'bg-ue-accent/20 text-ue-accent border border-ue-accent/30' : 'text-ue-muted hover:text-ue-text'
              )}
              title="Agents discuss together and synthesize a recommendation"
            >
              <MessageCircle className="w-4 h-4" />
              Round Table
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Project Info Button */}
          {project && (
            <div className="relative">
              <button
                onClick={() => setShowProjectInfo(!showProjectInfo)}
                className={cn(
                  'btn btn-secondary flex items-center gap-2',
                  showProjectInfo && 'bg-ue-accent/10 text-ue-accent'
                )}
              >
                <Info className="w-4 h-4" />
                Context
              </button>
              
              {showProjectInfo && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-ue-surface border border-ue-border rounded-lg shadow-xl z-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderKanban className="w-5 h-5 text-ue-success" />
                    <span className="font-semibold">Project Context</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ue-muted">Project:</span>
                      <span className="font-medium">{project.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ue-muted">UE Version:</span>
                      <span className="font-medium">{project.ue_version}</span>
                    </div>
                    {project.project_path && (
                      <div>
                        <span className="text-ue-muted">Path:</span>
                        <div className="mt-1 text-xs bg-ue-bg px-2 py-1 rounded font-mono truncate">
                          {project.project_path}
                        </div>
                      </div>
                    )}
                    {project.description && (
                      <div>
                        <span className="text-ue-muted">Description:</span>
                        <p className="mt-1 text-xs">{project.description}</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-ue-muted border-t border-ue-border pt-3">
                    This context is automatically included in AI responses for version-appropriate advice.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              {models.find((m) => m.id === model)?.name || 'Select Model'}
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-ue-surface border border-ue-border rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1">
                    Model
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id)
                        setShowSettings(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-2 rounded-md text-sm',
                        model === m.id ? 'bg-ue-accent/10 text-ue-accent' : 'hover:bg-ue-bg'
                      )}
                    >
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-ue-muted">{m.description}</div>
                      </div>
                      {model === m.id && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Agent Selector */}
          <div className="relative">
            <button
              onClick={() => setShowAgentSelector(!showAgentSelector)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Agents ({mode === 'solo' ? 1 : activeAgents.length})
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showAgentSelector && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-ue-surface border border-ue-border rounded-lg shadow-xl z-50">
                <div className="p-2">
                  {mode === 'solo' ? (
                    <>
                      <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1">
                        Select Agent
                      </div>
                      {allAgents.map((agent) => {
                        const Icon = agentIcons[agent]
                        return (
                          <button
                            key={agent}
                            onClick={() => {
                              setSoloAgent(agent)
                              setShowAgentSelector(false)
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm',
                              soloAgent === agent ? 'bg-ue-accent/10 text-ue-accent' : 'hover:bg-ue-bg'
                            )}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${agentColors[agent]}20` }}
                            >
                              <Icon className="w-4 h-4" style={{ color: agentColors[agent] }} />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium">{agentNames[agent]}</div>
                            </div>
                            {soloAgent === agent && <Check className="w-4 h-4" />}
                          </button>
                        )
                      })}
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1">
                        Active Agents
                      </div>
                      {allAgents.map((agent) => {
                        const Icon = agentIcons[agent]
                        const isActive = activeAgents.includes(agent)
                        return (
                          <button
                            key={agent}
                            onClick={() => toggleAgent(agent)}
                            className={cn(
                              'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm',
                              isActive ? 'bg-ue-accent/10' : 'hover:bg-ue-bg'
                            )}
                          >
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center transition-opacity',
                                !isActive && 'opacity-40'
                              )}
                              style={{ backgroundColor: `${agentColors[agent]}20` }}
                            >
                              <Icon className="w-4 h-4" style={{ color: agentColors[agent] }} />
                            </div>
                            <div className="flex-1 text-left">
                              <div className={cn('font-medium', !isActive && 'text-ue-muted')}>
                                {agentNames[agent]}
                              </div>
                            </div>
                            <div
                              className={cn(
                                'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                isActive
                                  ? 'bg-ue-accent border-ue-accent'
                                  : 'border-ue-border'
                              )}
                            >
                              {isActive && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingChat ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-3 text-ue-muted">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading chat...</span>
            </div>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-ue-accent/20 flex items-center justify-center mx-auto mb-4">
                <Cpu className="w-8 h-8 text-ue-accent" />
              </div>
              <h2 className="text-xl font-semibold mb-2">UE5 AI Studio</h2>
              <p className="text-ue-muted">
                {project ? (
                  <>Start a conversation about <strong>{project.name}</strong> (UE {project.ue_version}). The AI will provide version-specific advice.</>
                ) : (
                  <>Start a conversation with our AI agents to get help with your Unreal Engine 5 project. Choose Solo mode for focused assistance or Team mode for collaborative problem-solving.</>
                )}
              </p>
            </div>
          </div>
        ) : (
          displayMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: message.agent_color
                      ? `${message.agent_color}20`
                      : 'rgba(59, 130, 246, 0.2)',
                  }}
                >
                  {message.agent && agentIcons[message.agent] ? (
                    (() => {
                      const Icon = agentIcons[message.agent]
                      return (
                        <Icon
                          className="w-5 h-5"
                          style={{ color: message.agent_color || '#3b82f6' }}
                        />
                      )
                    })()
                  ) : (
                    <Cpu className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              )}

              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-3',
                  message.role === 'user'
                    ? 'bg-ue-accent text-white'
                    : 'bg-ue-surface border border-ue-border'
                )}
              >
                {message.role === 'assistant' && message.agent_name && (
                  <div
                    className="text-xs font-medium mb-1"
                    style={{ color: message.agent_color || '#3b82f6' }}
                  >
                    {message.agent_name}
                  </div>
                )}
                <ReactMarkdown
                  className="prose prose-invert prose-sm max-w-none"
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const isInline = !match && !className
                      return !isInline ? (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match?.[1] || 'text'}
                          PreTag="div"
                          className="rounded-md !bg-ue-bg !my-2"
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className="bg-ue-bg px-1 py-0.5 rounded text-ue-accent" {...props}>
                          {children}
                        </code>
                      )
                    },
                  }}
                >
                  {message.content || ''}
                </ReactMarkdown>
              </div>

              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-lg bg-ue-accent/20 flex items-center justify-center flex-shrink-0 text-ue-accent font-medium">
                  U
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && streamingMessages.size === 0 && (
          <div className="flex items-center gap-3 text-ue-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{currentPhase || 'Thinking...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-ue-border bg-ue-surface">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={project ? `Ask about ${project.name}...` : "Ask about UE5 development..."}
            className="input flex-1"
            disabled={isLoading || isLoadingChat}
          />
          
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="btn btn-secondary flex items-center gap-2"
            >
              <StopCircle className="w-5 h-5" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoadingChat}
              className="btn btn-primary flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
