import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  is_admin: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)

interface Chat {
  id: number
  title: string
  mode: 'solo' | 'team'
  model: string
  active_agents: string[]
  solo_agent: string
  project_id?: number | null
  is_pinned?: boolean
  is_archived?: boolean
  created_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  agent?: string
  agent_name?: string
  agent_color?: string
  content: string
  created_at: string
}

interface ChatState {
  chats: Chat[]
  currentChat: Chat | null
  currentChatId: number | null
  messages: Message[]
  messagesCache: Record<number, Message[]>
  isLoading: boolean
  setChats: (chats: Chat[]) => void
  setCurrentChat: (chat: Chat | null) => void
  updateChat: (chat: Chat) => void
  removeChat: (chatId: number) => void
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  addMessage: (message: Message) => void
  updateLastMessage: (content: string) => void
  setLoading: (loading: boolean) => void
  clearMessages: () => void
  cacheMessages: (chatId: number, messages: Message[]) => void
  getCachedMessages: (chatId: number) => Message[] | undefined
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChat: null,
  currentChatId: null,
  messages: [],
  messagesCache: {},
  isLoading: false,
  setChats: (chats) => set({ chats }),
  updateChat: (updatedChat) => set((state) => ({
    chats: state.chats.map((c) => c.id === updatedChat.id ? updatedChat : c),
    currentChat: state.currentChat?.id === updatedChat.id ? updatedChat : state.currentChat
  })),
  removeChat: (chatId) => set((state) => ({
    chats: state.chats.filter((c) => c.id !== chatId),
    currentChat: state.currentChat?.id === chatId ? null : state.currentChat,
    currentChatId: state.currentChatId === chatId ? null : state.currentChatId
  })),
  setCurrentChat: (chat) => {
    const state = get()
    // Cache current messages before switching (only if switching to a different chat)
    if (state.currentChatId && state.currentChatId !== chat?.id && state.messages.length > 0) {
      set((s) => ({
        messagesCache: {
          ...s.messagesCache,
          [state.currentChatId!]: s.messages
        }
      }))
    }
    // Set new chat - only clear messages if switching to a different chat
    if (state.currentChatId !== chat?.id) {
      set({ 
        currentChat: chat, 
        currentChatId: chat?.id || null,
        messages: [] 
      })
    } else {
      // Same chat, just update the chat object (e.g., title change)
      set({ currentChat: chat })
    }
  },
  setMessages: (messages) => set((state) => {
    const newMessages = typeof messages === 'function' ? messages(state.messages) : messages
    // Also update cache if we have a current chat
    if (state.currentChatId) {
      return {
        messages: newMessages,
        messagesCache: {
          ...state.messagesCache,
          [state.currentChatId]: newMessages
        }
      }
    }
    return { messages: newMessages }
  }),
  addMessage: (message) => set((state) => {
    const newMessages = [...state.messages, message]
    // Also update cache if we have a current chat
    if (state.currentChatId) {
      return {
        messages: newMessages,
        messagesCache: {
          ...state.messagesCache,
          [state.currentChatId]: newMessages
        }
      }
    }
    return { messages: newMessages }
  }),
  updateLastMessage: (content) => set((state) => {
    const messages = [...state.messages]
    if (messages.length > 0) {
      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        content: messages[messages.length - 1].content + content
      }
    }
    // Also update cache if we have a current chat
    if (state.currentChatId) {
      return {
        messages,
        messagesCache: {
          ...state.messagesCache,
          [state.currentChatId]: messages
        }
      }
    }
    return { messages }
  }),
  setLoading: (isLoading) => set({ isLoading }),
  clearMessages: () => set({ messages: [] }),
  cacheMessages: (chatId, messages) => set((state) => ({
    messagesCache: {
      ...state.messagesCache,
      [chatId]: messages
    }
  })),
  getCachedMessages: (chatId) => get().messagesCache[chatId],
}))

interface SettingsState {
  mode: 'solo' | 'team' | 'roundtable'
  model: string
  activeAgents: string[]
  soloAgent: string
  setMode: (mode: 'solo' | 'team' | 'roundtable') => void
  setModel: (model: string) => void
  setActiveAgents: (agents: string[]) => void
  setSoloAgent: (agent: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'team',
      model: 'deepseek-chat',
      activeAgents: ['architect', 'developer', 'blueprint', 'qa'],
      soloAgent: 'architect',
      setMode: (mode) => set({ mode }),
      setModel: (model) => set({ model }),
      setActiveAgents: (activeAgents) => set({ activeAgents }),
      setSoloAgent: (soloAgent) => set({ soloAgent }),
    }),
    {
      name: 'settings-storage',
    }
  )
)
