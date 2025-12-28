import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore, useChatStore } from '../lib/store'
import { chatsApi, projectsApi } from '../lib/api'
import { useEffect, useState, useRef } from 'react'
import { useWebSocketConnection } from '../hooks/useRealtime'
import ConnectionStatus from './ConnectionStatus'
import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  Plug,
  Settings,
  LogOut,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Cpu,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Copy,
  Search,
  X,
  Files,
  Package,
  Scale,
  Shield,
  CreditCard,
  Download,
} from 'lucide-react'
import { cn, truncate } from '../lib/utils'

interface Project {
  id: number
  name: string
  ue_version: string
  chat_count: number
}

interface Chat {
  id: number
  title: string
  project_id: number | null
  is_pinned: boolean
  is_archived: boolean
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { chats, setChats, setCurrentChat, updateChat, removeChat } = useChatStore()
  const [collapsed, setCollapsed] = useState(false)
  
  // Initialize WebSocket connection
  const { connected: wsConnected } = useWebSocketConnection()
  const [projects, setProjects] = useState<Project[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ chatId: number; x: number; y: number } | null>(null)
  const [editingChatId, setEditingChatId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadChats()
    loadProjects()
  }, [showArchived])

  useEffect(() => {
    // Close context menu on click outside
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingChatId])

  const loadChats = async () => {
    try {
      const response = await chatsApi.list({ 
        includeArchived: showArchived,
        search: searchQuery || undefined
      })
      setChats(response.data)
    } catch (error) {
      console.error('Failed to load chats:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const response = await projectsApi.list()
      setProjects(response.data)
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const handleNewChat = async (projectId?: number) => {
    try {
      const response = await chatsApi.create({
        title: 'New Conversation',
        mode: 'team',
        model: 'deepseek-chat',
        project_id: projectId,
      })
      setChats([response.data, ...chats])
      setCurrentChat(response.data)
      navigate(`/chat/${response.data.id}`)
    } catch (error) {
      console.error('Failed to create chat:', error)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, chatId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ chatId, x: e.clientX, y: e.clientY })
  }

  const handleRename = (chat: Chat) => {
    setEditingChatId(chat.id)
    setEditTitle(chat.title)
    setContextMenu(null)
  }

  const handleRenameSubmit = async (chatId: number) => {
    if (!editTitle.trim()) {
      setEditingChatId(null)
      return
    }
    try {
      const response = await chatsApi.update(chatId, { title: editTitle.trim() })
      updateChat(response.data)
    } catch (error) {
      console.error('Failed to rename chat:', error)
    }
    setEditingChatId(null)
  }

  const handlePin = async (chatId: number, isPinned: boolean) => {
    try {
      const response = isPinned 
        ? await chatsApi.unpin(chatId)
        : await chatsApi.pin(chatId)
      updateChat(response.data)
      loadChats() // Reload to get correct order
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
    setContextMenu(null)
  }

  const handleArchive = async (chatId: number, isArchived: boolean) => {
    try {
      const response = isArchived
        ? await chatsApi.unarchive(chatId)
        : await chatsApi.archive(chatId)
      if (!showArchived && !isArchived) {
        removeChat(chatId)
      } else {
        updateChat(response.data)
      }
    } catch (error) {
      console.error('Failed to toggle archive:', error)
    }
    setContextMenu(null)
  }

  const handleDuplicate = async (chatId: number) => {
    try {
      const response = await chatsApi.duplicate(chatId)
      setChats([response.data, ...chats])
      navigate(`/chat/${response.data.id}`)
    } catch (error) {
      console.error('Failed to duplicate chat:', error)
    }
    setContextMenu(null)
  }

  const handleDelete = async (chatId: number) => {
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return
    }
    try {
      await chatsApi.delete(chatId)
      removeChat(chatId)
      // Navigate away if we're on the deleted chat
      if (location.pathname === `/chat/${chatId}`) {
        navigate('/chat')
      }
    } catch (error) {
      console.error('Failed to delete chat:', error)
    }
    setContextMenu(null)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const toggleProject = (projectId: number) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  // Filter and group chats
  const filteredChats = chats.filter((c: Chat) => 
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const pinnedChats = filteredChats.filter((c: Chat) => c.is_pinned && !c.project_id)
  const regularChats = filteredChats.filter((c: Chat) => !c.is_pinned && !c.is_archived && !c.project_id)
  const archivedChats = filteredChats.filter((c: Chat) => c.is_archived && !c.project_id)
  const projectChats = (projectId: number) => filteredChats.filter((c: Chat) => c.project_id === projectId && !c.is_archived)

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/compare', icon: Scale, label: 'Compare' },
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/workspace', icon: Files, label: 'Workspace' },
    { path: '/plugins', icon: Package, label: 'Plugins' },
    { path: '/ue5', icon: Plug, label: 'UE Connection' },
    { path: '/admin/roles', icon: Shield, label: 'Admin' },
    { path: '/pricing', icon: CreditCard, label: 'Pricing' },
    { path: '/downloads', icon: Download, label: 'Downloads' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  const renderChatItem = (chat: Chat, size: 'sm' | 'xs' = 'sm') => {
    const isEditing = editingChatId === chat.id
    const textSize = size === 'sm' ? 'text-sm' : 'text-xs'
    const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-3 h-3'
    
    if (isEditing) {
      return (
        <div key={chat.id} className="px-2 py-1">
          <input
            ref={editInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => handleRenameSubmit(chat.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit(chat.id)
              if (e.key === 'Escape') setEditingChatId(null)
            }}
            className="w-full px-2 py-1 text-sm bg-ue-bg border border-ue-accent rounded focus:outline-none"
          />
        </div>
      )
    }

    return (
      <div
        key={chat.id}
        className="group relative"
        onContextMenu={(e) => handleContextMenu(e, chat.id)}
      >
        <NavLink
          to={`/chat/${chat.id}`}
          className={({ isActive }) =>
            cn('sidebar-item', textSize, isActive && 'active', 'pr-8')
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            {chat.is_pinned && <Pin className="w-3 h-3 text-ue-accent flex-shrink-0" />}
            <MessageSquare className={cn(iconSize, 'flex-shrink-0')} />
            <span className="truncate">{truncate(chat.title, size === 'sm' ? 20 : 18)}</span>
          </div>
        </NavLink>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleContextMenu(e, chat.id)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-ue-border rounded transition-opacity"
        >
          <MoreHorizontal className="w-4 h-4 text-ue-muted" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-ue-bg">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-ue-surface border-r border-ue-border transition-all duration-300 relative',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-ue-border">
          <div className="w-8 h-8 bg-ue-accent rounded-lg flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg">UE5 AI Studio</span>
          )}
        </div>

        {/* Connection Status */}
        {!collapsed && (
          <div className="px-3 py-2 border-b border-ue-border">
            <ConnectionStatus showLabel={true} />
          </div>
        )}

        {/* New Chat Button */}
        <div className="p-3 space-y-2">
          <button
            onClick={() => handleNewChat()}
            className={cn(
              'btn btn-primary w-full flex items-center justify-center gap-2',
              collapsed && 'px-2'
            )}
          >
            <Plus className="w-5 h-5" />
            {!collapsed && <span>New Chat</span>}
          </button>
          
          {/* Search */}
          {!collapsed && (
            <div className="relative">
              {showSearch ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      loadChats()
                    }}
                    placeholder="Search chats..."
                    className="flex-1 px-3 py-1.5 text-sm bg-ue-bg border border-ue-border rounded focus:border-ue-accent focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setShowSearch(false)
                      setSearchQuery('')
                      loadChats()
                    }}
                    className="p-1.5 text-ue-muted hover:text-ue-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ue-muted hover:text-ue-text hover:bg-ue-bg rounded transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>Search chats...</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn('sidebar-item', isActive && 'active', collapsed && 'justify-center px-2')
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}

          {/* Pinned Chats */}
          {!collapsed && pinnedChats.length > 0 && (
            <div className="mt-6">
              <div className="px-3 py-2 text-xs font-medium text-ue-muted uppercase tracking-wider flex items-center gap-1">
                <Pin className="w-3 h-3" />
                Pinned
              </div>
              <div className="space-y-0.5">
                {pinnedChats.map((chat: Chat) => renderChatItem(chat))}
              </div>
            </div>
          )}

          {/* Projects with Chats */}
          {!collapsed && projects.length > 0 && (
            <div className="mt-6">
              <div className="px-3 py-2 text-xs font-medium text-ue-muted uppercase tracking-wider">
                Projects
              </div>
              <div className="space-y-1">
                {projects.map((project) => {
                  const pChats = projectChats(project.id)
                  const isExpanded = expandedProjects.has(project.id)
                  
                  return (
                    <div key={project.id}>
                      <button
                        onClick={() => toggleProject(project.id)}
                        className="sidebar-item w-full justify-between group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderKanban className="w-4 h-4 flex-shrink-0 text-ue-success" />
                          <span className="truncate text-sm">{truncate(project.name, 15)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-ue-muted">{pChats.length}</span>
                          <ChevronDown 
                            className={cn(
                              'w-4 h-4 text-ue-muted transition-transform',
                              isExpanded && 'rotate-180'
                            )} 
                          />
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-0.5 border-l border-ue-border pl-2">
                          <button
                            onClick={() => handleNewChat(project.id)}
                            className="sidebar-item text-xs w-full text-ue-muted hover:text-ue-text"
                          >
                            <Plus className="w-3 h-3" />
                            <span>New chat</span>
                          </button>
                          
                          {pChats.slice(0, 5).map((chat: Chat) => renderChatItem(chat, 'xs'))}
                          
                          {pChats.length > 5 && (
                            <NavLink
                              to="/projects"
                              className="sidebar-item text-xs text-ue-muted"
                            >
                              <span>+{pChats.length - 5} more...</span>
                            </NavLink>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Chats */}
          {!collapsed && regularChats.length > 0 && (
            <div className="mt-6">
              <div className="px-3 py-2 text-xs font-medium text-ue-muted uppercase tracking-wider">
                Recent Chats
              </div>
              <div className="space-y-0.5">
                {regularChats.slice(0, 10).map((chat: Chat) => renderChatItem(chat))}
              </div>
            </div>
          )}

          {/* Archived Toggle */}
          {!collapsed && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="sidebar-item w-full text-ue-muted hover:text-ue-text"
              >
                <Archive className="w-4 h-4" />
                <span className="text-sm">{showArchived ? 'Hide' : 'Show'} Archived</span>
                {archivedChats.length > 0 && (
                  <span className="ml-auto text-xs bg-ue-border px-1.5 py-0.5 rounded">
                    {archivedChats.length}
                  </span>
                )}
              </button>
              
              {showArchived && archivedChats.length > 0 && (
                <div className="mt-2 space-y-0.5 opacity-60">
                  {archivedChats.map((chat: Chat) => renderChatItem(chat))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-ue-border">
          <div
            className={cn(
              'flex items-center gap-3',
              collapsed && 'justify-center'
            )}
          >
            <div className="w-8 h-8 bg-ue-accent/20 rounded-full flex items-center justify-center text-ue-accent font-medium">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.username}</div>
                <div className="text-xs text-ue-muted truncate">{user?.email}</div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-ue-muted hover:text-ue-error transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-20 -right-3 w-6 h-6 bg-ue-surface border border-ue-border rounded-full flex items-center justify-center text-ue-muted hover:text-ue-text transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-ue-surface border border-ue-border rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const chat = chats.find((c: Chat) => c.id === contextMenu.chatId)
            if (!chat) return null
            
            return (
              <>
                <button
                  onClick={() => handleRename(chat)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-ue-bg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Rename
                </button>
                <button
                  onClick={() => handlePin(chat.id, chat.is_pinned)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-ue-bg transition-colors"
                >
                  {chat.is_pinned ? (
                    <>
                      <PinOff className="w-4 h-4" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="w-4 h-4" />
                      Pin to top
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDuplicate(chat.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-ue-bg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => handleArchive(chat.id, chat.is_archived)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-ue-bg transition-colors"
                >
                  {chat.is_archived ? (
                    <>
                      <ArchiveRestore className="w-4 h-4" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      Archive
                    </>
                  )}
                </button>
                <div className="border-t border-ue-border my-1" />
                <button
                  onClick={() => handleDelete(chat.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ue-error hover:bg-ue-error/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )
          })()}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
