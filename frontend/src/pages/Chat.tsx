import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useChatStore, useSettingsStore } from '../lib/store'
import { chatsApi, aiApi, projectsApi, preferencesApi } from '../lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  Copy,
  CheckCheck,
  RefreshCw,
  Edit3,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  Image as ImageIcon,
  X,
  Maximize2,
  Minimize2,
  Download,
  MoreHorizontal,
  Clock,
  Zap,
  Sparkles,
  AlertCircle,
  Keyboard,
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
  isEditing?: boolean
  feedback?: 'positive' | 'negative' | null
  tokens?: number
  responseTime?: number
}

interface Project {
  id: number
  name: string
  description: string
  ue_version: string
  project_path: string
}

interface Attachment {
  id: string
  name: string
  type: 'file' | 'image'
  size: number
  url?: string
  file?: File
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
  // DeepSeek Models
  { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Fast & efficient', provider: 'deepseek' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Advanced reasoning', provider: 'deepseek' },
  // Anthropic Claude Models
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Balanced', provider: 'anthropic' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Highest quality', provider: 'anthropic' },
  // Google Gemini Models
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & balanced', provider: 'google' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fastest', provider: 'google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Best reasoning', provider: 'google' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen', provider: 'google' },
]

const allAgents = ['architect', 'developer', 'blueprint', 'qa', 'devops', 'artist']

// Keyboard shortcuts
const SHORTCUTS = {
  send: { key: 'Enter', description: 'Send message' },
  newLine: { key: 'Shift+Enter', description: 'New line' },
  stop: { key: 'Escape', description: 'Stop generation' },
  newChat: { key: 'Ctrl+N', description: 'New chat' },
}

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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMessageActions, setShowMessageActions] = useState<string | null>(null)
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)
  const [tokenCount, setTokenCount] = useState(0)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isStreamingRef = useRef(false)
  const currentChatIdRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle chat switching
  useEffect(() => {
    const newChatId = chatId ? parseInt(chatId) : null
    
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
        setCurrentChat(null)
        clearMessages()
        setStreamingMessages(new Map())
      }
    }
  }, [chatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMessages])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Stop generation with Escape
      if (e.key === 'Escape' && isLoading) {
        handleStop()
      }
      // New chat with Ctrl+N
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        navigate('/chat')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoading, navigate])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const loadChat = async (id: number) => {
    if (currentChatIdRef.current !== id) return
    
    setIsLoadingChat(true)
    clearMessages()
    setStreamingMessages(new Map())
    
    try {
      const [chatRes, messagesRes] = await Promise.all([
        chatsApi.get(id),
        chatsApi.messages(id),
      ])
      
      if (currentChatIdRef.current !== id) return
      
      setCurrentChat(chatRes.data)
      
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
    } catch (error) {
      console.error('Failed to load chat:', error)
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

  const generateChatTitle = async (chatId: number, firstMessage: string) => {
    try {
      const prefsRes = await preferencesApi.get()
      if (!prefsRes.data.auto_generate_title) return

      const titleRes = await preferencesApi.generateTitle(
        firstMessage,
        project?.name
      )
      
      if (titleRes.data.title) {
        await chatsApi.update(chatId, { title: titleRes.data.title })
        
        if (currentChat && currentChat.id === chatId) {
          setCurrentChat({ ...currentChat, title: titleRes.data.title })
        }
      }
    } catch (error) {
      console.error('Failed to generate chat title:', error)
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
    setAttachments([])
    setLoading(true)
    setCurrentPhase('')
    setStreamingMessages(new Map())
    setStreamStartTime(Date.now())
    setTokenCount(0)
    isStreamingRef.current = true

    let activeChatId = currentChat?.id
    let isNewChat = false
    if (!activeChatId) {
      try {
        const response = await chatsApi.create({
          title: 'New Conversation',
          mode,
          model,
          active_agents: activeAgents,
          solo_agent: soloAgent,
        })
        activeChatId = response.data.id
        currentChatIdRef.current = activeChatId
        setCurrentChat(response.data)
        isNewChat = true
        navigate(`/chat/${activeChatId}`, { replace: true })
        
        addMessage(userMessage)
        generateChatTitle(activeChatId, messageContent)
      } catch (error) {
        console.error('Failed to create chat:', error)
        setLoading(false)
        isStreamingRef.current = false
        return
      }
    } else {
      addMessage(userMessage)
    }

    const streamingForChatId = activeChatId

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
        if (!isStreamingRef.current || currentChatIdRef.current !== streamingForChatId) break
        
        if (chunk.type === 'phase') {
          setCurrentPhase(chunk.phase || chunk.message || '')
        } else if (chunk.type === 'chunk') {
          const agent = chunk.agent || 'assistant'
          
          // Count tokens (rough estimate)
          setTokenCount(prev => prev + (chunk.content?.split(/\s+/).length || 0))
          
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
          
          setStreamingMessages(new Map(assistantMessages))
        } else if (chunk.type === 'complete') {
          const agent = chunk.agent || 'assistant'
          const completedMsg = assistantMessages.get(agent)
          if (completedMsg) {
            completedMsg.content = chunk.content || completedMsg.content
            completedMsg.responseTime = streamStartTime ? Date.now() - streamStartTime : undefined
            completedMsg.tokens = tokenCount
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
              content: `⚠️ **Error:** ${chunk.message}`,
              created_at: new Date().toISOString(),
            }
            addMessage(errorMessage)
          }
        } else if (chunk.type === 'cancelled') {
          break
        }
      }
      
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
            content: `⚠️ **Error:** ${error.message || 'Failed to get response'}`,
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
      setStreamStartTime(null)
    }
  }

  const handleStop = () => {
    isStreamingRef.current = false
    abortControllerRef.current?.abort()
    setLoading(false)
    setCurrentPhase('')
    
    streamingMessages.forEach((msg) => {
      if (msg.content) {
        addMessage({ ...msg })
      }
    })
    setStreamingMessages(new Map())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleRegenerate = async (messageIndex: number) => {
    // Find the last user message before this assistant message
    const userMessages = messages.slice(0, messageIndex).filter(m => m.role === 'user')
    if (userMessages.length === 0) return
    
    const lastUserMessage = userMessages[userMessages.length - 1]
    
    // Remove messages from this point onwards
    const newMessages = messages.slice(0, messageIndex)
    setMessages(newMessages)
    
    // Re-submit the last user message
    setInput(lastUserMessage.content)
  }

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
  }

  const handleSaveEdit = async (messageId: string) => {
    // Update the message content
    const updatedMessages = messages.map(m => 
      m.id === messageId ? { ...m, content: editContent } : m
    )
    setMessages(updatedMessages)
    setEditingMessageId(null)
    setEditContent('')
    
    // If it's a user message, we could optionally regenerate the response
  }

  const handleDeleteMessage = (messageId: string) => {
    const updatedMessages = messages.filter(m => m.id !== messageId)
    setMessages(updatedMessages)
  }

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    const updatedMessages = messages.map(m => 
      m.id === messageId ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
    )
    setMessages(updatedMessages)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      size: file.size,
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    
    setAttachments(prev => [...prev, ...newAttachments])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return ms + 'ms'
    return (ms / 1000).toFixed(1) + 's'
  }

  // Combine permanent messages with streaming messages for display
  const displayMessages = useMemo(() => {
    const combined = [...messages]
    streamingMessages.forEach((msg) => {
      combined.push(msg)
    })
    return combined
  }, [messages, streamingMessages])

  // Code block component with copy button
  const CodeBlock = ({ language, children }: { language: string; children: string }) => {
    const [copied, setCopied] = useState(false)
    
    const handleCopy = async () => {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    
    return (
      <div className="relative group my-3">
        <div className="absolute right-2 top-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-ue-muted bg-ue-bg px-2 py-1 rounded">{language}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded bg-ue-bg hover:bg-ue-border transition-colors"
            title="Copy code"
          >
            {copied ? (
              <CheckCheck className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-ue-muted" />
            )}
          </button>
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={language || 'text'}
          PreTag="div"
          className="rounded-lg !bg-[#1a1b26] !my-0 !text-sm"
          showLineNumbers
          wrapLines
        >
          {children}
        </SyntaxHighlighter>
      </div>
    )
  }

  return (
    <div className={cn(
      "h-full flex flex-col",
      isFullscreen && "fixed inset-0 z-50 bg-ue-bg"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ue-border bg-ue-surface">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-semibold flex items-center gap-2">
              {currentChat?.title || 'New Conversation'}
              {isLoading && (
                <span className="flex items-center gap-1 text-xs text-ue-accent">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Generating...
                </span>
              )}
            </h1>
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
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
                mode === 'solo' ? 'bg-ue-surface text-ue-text shadow-sm' : 'text-ue-muted hover:text-ue-text'
              )}
              title="Single agent responds"
            >
              <User className="w-4 h-4" />
              Solo
            </button>
            <button
              onClick={() => setMode('team')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
                mode === 'team' ? 'bg-ue-surface text-ue-text shadow-sm' : 'text-ue-muted hover:text-ue-text'
              )}
              title="Agents respond sequentially"
            >
              <Users className="w-4 h-4" />
              Team
            </button>
            <button
              onClick={() => setMode('roundtable')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
                mode === 'roundtable' ? 'bg-ue-accent/20 text-ue-accent border border-ue-accent/30' : 'text-ue-muted hover:text-ue-text'
              )}
              title="Agents discuss together"
            >
              <MessageCircle className="w-4 h-4" />
              Round Table
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="btn btn-secondary p-2"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Keyboard Shortcuts */}
          <div className="relative">
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="btn btn-secondary p-2"
              title="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            
            {showShortcuts && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-ue-surface border border-ue-border rounded-lg shadow-xl z-50 p-3">
                <div className="text-xs font-medium text-ue-muted uppercase tracking-wider mb-2">
                  Keyboard Shortcuts
                </div>
                <div className="space-y-2">
                  {Object.entries(SHORTCUTS).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-ue-muted">{value.description}</span>
                      <kbd className="px-2 py-1 bg-ue-bg rounded text-xs font-mono">{value.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
                    This context is automatically included in AI responses.
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
              <div className="absolute right-0 top-full mt-2 w-72 bg-ue-surface border border-ue-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                <div className="p-2">
                  {/* DeepSeek Models */}
                  <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    DeepSeek
                  </div>
                  {models.filter(m => m.provider === 'deepseek').map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id)
                        setShowSettings(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-2 rounded-md text-sm transition-colors',
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
                  
                  {/* Anthropic Claude Models */}
                  <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1 mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Anthropic
                  </div>
                  {models.filter(m => m.provider === 'anthropic').map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id)
                        setShowSettings(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-2 rounded-md text-sm transition-colors',
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
                  
                  {/* Google Gemini Models */}
                  <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1 mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Google Gemini
                  </div>
                  {models.filter(m => m.provider === 'google').map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id)
                        setShowSettings(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-2 rounded-md text-sm transition-colors',
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
                              'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
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
                              'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoadingChat ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-ue-muted">
              <Loader2 className="w-8 h-8 animate-spin text-ue-accent" />
              <span>Loading conversation...</span>
            </div>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ue-accent/20 to-ue-accent/5 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Cpu className="w-10 h-10 text-ue-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-3">UE5 AI Studio</h2>
              <p className="text-ue-muted mb-6">
                {project ? (
                  <>Start a conversation about <strong className="text-ue-text">{project.name}</strong> (UE {project.ue_version}). The AI will provide version-specific advice.</>
                ) : (
                  <>Start a conversation with our AI agents to get help with your Unreal Engine 5 project. Choose Solo mode for focused assistance or Team mode for collaborative problem-solving.</>
                )}
              </p>
              
              {/* Quick prompts */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                {[
                  { icon: Code, text: 'Help me with C++ code' },
                  { icon: Workflow, text: 'Create a Blueprint system' },
                  { icon: Palette, text: 'Material & shader help' },
                  { icon: Shield, text: 'Debug my project' },
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(prompt.text)}
                    className="flex items-center gap-2 p-3 rounded-lg bg-ue-surface border border-ue-border hover:border-ue-accent/50 transition-colors text-left text-sm"
                  >
                    <prompt.icon className="w-4 h-4 text-ue-accent" />
                    <span>{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          displayMessages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-4 group',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
              onMouseEnter={() => setShowMessageActions(message.id)}
              onMouseLeave={() => setShowMessageActions(null)}
            >
              {message.role === 'assistant' && (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
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

              <div className={cn(
                'max-w-[80%] relative',
                message.role === 'user' && 'order-first'
              )}>
                {/* Message header */}
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    {message.agent_name && (
                      <span
                        className="text-sm font-medium"
                        style={{ color: message.agent_color || '#3b82f6' }}
                      >
                        {message.agent_name}
                      </span>
                    )}
                    {message.responseTime && (
                      <span className="text-xs text-ue-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(message.responseTime)}
                      </span>
                    )}
                  </div>
                )}

                {/* Message content */}
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 shadow-sm',
                    message.role === 'user'
                      ? 'bg-ue-accent text-white rounded-tr-sm'
                      : 'bg-ue-surface border border-ue-border rounded-tl-sm'
                  )}
                >
                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-ue-bg border border-ue-border rounded-lg p-2 text-sm resize-none"
                        rows={4}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-3 py-1 text-sm text-ue-muted hover:text-ue-text"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(message.id)}
                          className="px-3 py-1 text-sm bg-ue-accent text-white rounded-md hover:bg-ue-accent/90"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown
                      className={cn(
                        'prose prose-sm max-w-none',
                        message.role === 'user' ? 'prose-invert' : 'prose-invert'
                      )}
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          const isInline = !match && !className
                          const content = String(children).replace(/\n$/, '')
                          
                          return !isInline ? (
                            <CodeBlock language={match?.[1] || 'text'}>
                              {content}
                            </CodeBlock>
                          ) : (
                            <code className="bg-ue-bg/50 px-1.5 py-0.5 rounded text-ue-accent font-mono text-sm" {...props}>
                              {children}
                            </code>
                          )
                        },
                        table({ children }) {
                          return (
                            <div className="overflow-x-auto my-3">
                              <table className="min-w-full border border-ue-border rounded-lg overflow-hidden">
                                {children}
                              </table>
                            </div>
                          )
                        },
                        th({ children }) {
                          return (
                            <th className="bg-ue-bg px-3 py-2 text-left text-sm font-medium border-b border-ue-border">
                              {children}
                            </th>
                          )
                        },
                        td({ children }) {
                          return (
                            <td className="px-3 py-2 text-sm border-b border-ue-border">
                              {children}
                            </td>
                          )
                        },
                        a({ href, children }) {
                          return (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-ue-accent hover:underline"
                            >
                              {children}
                            </a>
                          )
                        },
                        blockquote({ children }) {
                          return (
                            <blockquote className="border-l-4 border-ue-accent/50 pl-4 my-3 italic text-ue-muted">
                              {children}
                            </blockquote>
                          )
                        },
                      }}
                    >
                      {message.content || ''}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Message actions */}
                {showMessageActions === message.id && !editingMessageId && (
                  <div className={cn(
                    'absolute flex items-center gap-1 mt-1',
                    message.role === 'user' ? 'right-0' : 'left-0'
                  )}>
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="p-1.5 rounded-md hover:bg-ue-surface border border-transparent hover:border-ue-border transition-colors"
                      title="Copy message"
                    >
                      {copiedMessageId === message.id ? (
                        <CheckCheck className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-ue-muted" />
                      )}
                    </button>
                    
                    {message.role === 'assistant' && (
                      <>
                        <button
                          onClick={() => handleRegenerate(index)}
                          className="p-1.5 rounded-md hover:bg-ue-surface border border-transparent hover:border-ue-border transition-colors"
                          title="Regenerate response"
                        >
                          <RefreshCw className="w-4 h-4 text-ue-muted" />
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, 'positive')}
                          className={cn(
                            'p-1.5 rounded-md hover:bg-ue-surface border border-transparent hover:border-ue-border transition-colors',
                            message.feedback === 'positive' && 'text-green-500'
                          )}
                          title="Good response"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(message.id, 'negative')}
                          className={cn(
                            'p-1.5 rounded-md hover:bg-ue-surface border border-transparent hover:border-ue-border transition-colors',
                            message.feedback === 'negative' && 'text-red-500'
                          )}
                          title="Poor response"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    
                    {message.role === 'user' && (
                      <button
                        onClick={() => handleEditMessage(message)}
                        className="p-1.5 rounded-md hover:bg-ue-surface border border-transparent hover:border-ue-border transition-colors"
                        title="Edit message"
                      >
                        <Edit3 className="w-4 h-4 text-ue-muted" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4 text-ue-muted hover:text-red-500" />
                    </button>
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ue-accent to-ue-accent/70 flex items-center justify-center flex-shrink-0 text-white font-medium shadow-sm">
                  U
                </div>
              )}
            </div>
          ))
        )}

        {/* Streaming indicator */}
        {isLoading && streamingMessages.size === 0 && (
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-ue-accent/20 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-ue-accent" />
            </div>
            <div className="bg-ue-surface border border-ue-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-ue-muted">
                <Sparkles className="w-4 h-4 animate-pulse text-ue-accent" />
                <span>{currentPhase || 'Thinking...'}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-ue-border bg-ue-surface/50">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 bg-ue-bg rounded-lg px-3 py-2 text-sm"
              >
                {attachment.type === 'image' ? (
                  <ImageIcon className="w-4 h-4 text-ue-accent" />
                ) : (
                  <Paperclip className="w-4 h-4 text-ue-muted" />
                )}
                <span className="max-w-[150px] truncate">{attachment.name}</span>
                <span className="text-xs text-ue-muted">{formatFileSize(attachment.size)}</span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="p-0.5 hover:bg-ue-border rounded"
                >
                  <X className="w-3 h-3 text-ue-muted" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-ue-border bg-ue-surface">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          {/* File upload button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/*,.pdf,.txt,.md,.cpp,.h,.py,.js,.ts,.json"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary p-2.5 flex-shrink-0"
            title="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={project ? `Ask about ${project.name}...` : "Ask about UE5 development... (Shift+Enter for new line)"}
              className="input w-full resize-none min-h-[44px] max-h-[200px] py-3 pr-12"
              disabled={isLoading || isLoadingChat}
              rows={1}
            />
            <div className="absolute right-3 bottom-3 text-xs text-ue-muted">
              {input.length > 0 && `${input.length}`}
            </div>
          </div>
          
          {/* Send/Stop button */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="btn bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 flex items-center gap-2 px-4 py-2.5"
            >
              <StopCircle className="w-5 h-5" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoadingChat}
              className="btn btn-primary flex items-center gap-2 px-4 py-2.5"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          )}
        </form>
        
        {/* Input hints */}
        <div className="flex items-center justify-between mt-2 text-xs text-ue-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {models.find(m => m.id === model)?.name}
            </span>
            <span>•</span>
            <span>{mode === 'solo' ? agentNames[soloAgent] : `${activeAgents.length} agents`}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-ue-bg rounded text-[10px]">Enter</kbd>
            <span>to send</span>
            <span className="mx-1">•</span>
            <kbd className="px-1.5 py-0.5 bg-ue-bg rounded text-[10px]">Shift+Enter</kbd>
            <span>for new line</span>
          </div>
        </div>
      </div>
    </div>
  )
}
