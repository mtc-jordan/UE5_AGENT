/**
 * WebSocket Client for Real-time Collaboration.
 * 
 * Handles WebSocket connection, reconnection, and event handling.
 */

import { create } from 'zustand'

// Event types matching backend
export enum EventType {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
  
  // Room events
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  
  // Chat events
  MESSAGE = 'message',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_DELIVERED = 'message_delivered',
  MESSAGE_READ = 'message_read',
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  
  // Presence events
  PRESENCE_UPDATE = 'presence_update',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USERS_ONLINE = 'users_online',
  
  // Workspace events
  FILE_UPDATE = 'file_update',
  FILE_LOCKED = 'file_locked',
  FILE_UNLOCKED = 'file_unlocked',
  CURSOR_UPDATE = 'cursor_update',
  
  // Notification events
  NOTIFICATION = 'notification'}

export interface WebSocketMessage {
  type: EventType | string
  payload: Record<string, any>
  timestamp: string
  sender_id?: number
  room?: string
}

export interface OnlineUser {
  user_id: number
  username: string
  status?: string
  last_seen?: string
}

export interface TypingUser {
  user_id: number
  username: string
}

// WebSocket store state
interface WebSocketState {
  socket: WebSocket | null
  connected: boolean
  connecting: boolean
  reconnectAttempts: number
  onlineUsers: OnlineUser[]
  typingUsers: Map<number, TypingUser[]> // chatId -> users
  currentRooms: Set<string>
  lastError: string | null
  
  // Actions
  connect: (token: string) => void
  disconnect: () => void
  send: (message: Partial<WebSocketMessage>) => void
  joinRoom: (room: string) => void
  leaveRoom: (room: string) => void
  startTyping: (chatId: number) => void
  stopTyping: (chatId: number) => void
  markMessagesRead: (chatId: number, messageIds: number[]) => void
}

// Event handlers registry
type EventHandler = (message: WebSocketMessage) => void
const eventHandlers: Map<string, Set<EventHandler>> = new Map()

export const registerEventHandler = (eventType: string, handler: EventHandler) => {
  if (!eventHandlers.has(eventType)) {
    eventHandlers.set(eventType, new Set())
  }
  eventHandlers.get(eventType)!.add(handler)
  
  // Return unsubscribe function
  return () => {
    eventHandlers.get(eventType)?.delete(handler)
  }
}

// WebSocket store
export const useWebSocketStore = create<WebSocketState>((set, get) => {
  let pingInterval: NodeJS.Timeout | null = null
  let reconnectTimeout: NodeJS.Timeout | null = null
  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY = 3000
  const PING_INTERVAL = 30000
  
  const clearTimers = () => {
    if (pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }
  
  const handleMessage = (event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      
      // Handle internal events
      switch (message.type) {
        case EventType.CONNECT:
          set({ connected: true, connecting: false, reconnectAttempts: 0 })
          break
          
        case EventType.PONG:
          // Heartbeat response received
          break
          
        case EventType.USERS_ONLINE:
          set({ onlineUsers: message.payload.users || [] })
          break
          
        case EventType.USER_JOINED:
          set(state => ({
            onlineUsers: [
              ...state.onlineUsers.filter(u => u.user_id !== message.payload.user_id),
              { user_id: message.payload.user_id, username: message.payload.username }
            ]
          }))
          break
          
        case EventType.USER_LEFT:
          set(state => ({
            onlineUsers: state.onlineUsers.filter(u => u.user_id !== message.payload.user_id)
          }))
          break
          
        case EventType.PRESENCE_UPDATE:
          set(state => ({
            onlineUsers: state.onlineUsers.map(u =>
              u.user_id === message.payload.user_id
                ? { ...u, status: message.payload.status }
                : u
            )
          }))
          break
          
        case EventType.TYPING_START:
        case EventType.TYPING_STOP:
          if (message.payload.chat_id) {
            const chatId = message.payload.chat_id
            const typingUsers = message.payload.typing_users || []
            set(state => {
              const newTypingUsers = new Map(state.typingUsers)
              newTypingUsers.set(chatId, typingUsers)
              return { typingUsers: newTypingUsers }
            })
          }
          break
          
        case EventType.ROOM_JOINED:
          set(state => {
            const newRooms = new Set(state.currentRooms)
            newRooms.add(message.payload.room)
            return { currentRooms: newRooms }
          })
          break
          
        case EventType.ROOM_LEFT:
          set(state => {
            const newRooms = new Set(state.currentRooms)
            newRooms.delete(message.payload.room)
            return { currentRooms: newRooms }
          })
          break
          
        case EventType.ERROR:
          set({ lastError: message.payload.message })
          console.error('WebSocket error:', message.payload.message)
          break
      }
      
      // Call registered handlers
      const handlers = eventHandlers.get(message.type)
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message)
          } catch (e) {
            console.error('Error in event handler:', e)
          }
        })
      }
      
      // Also call wildcard handlers
      const wildcardHandlers = eventHandlers.get('*')
      if (wildcardHandlers) {
        wildcardHandlers.forEach(handler => {
          try {
            handler(message)
          } catch (e) {
            console.error('Error in wildcard handler:', e)
          }
        })
      }
      
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e)
    }
  }
  
  const attemptReconnect = (token: string) => {
    const { reconnectAttempts } = get()
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached')
      set({ connecting: false, lastError: 'Connection failed after multiple attempts' })
      return
    }
    
    set({ reconnectAttempts: reconnectAttempts + 1 })
    
    reconnectTimeout = setTimeout(() => {
      console.log(`Reconnection attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`)
      get().connect(token)
    }, RECONNECT_DELAY * (reconnectAttempts + 1))
  }
  
  return {
    socket: null,
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
    onlineUsers: [],
    typingUsers: new Map(),
    currentRooms: new Set(),
    lastError: null,
    
    connect: (token: string) => {
      const {  connecting, connected } = get()
      
      if (connecting || connected) {
        return
      }
      
      set({ connecting: true, lastError: null })
      
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/api/ws/connect?token=${encodeURIComponent(token)}`
      
      try {
        const ws = new WebSocket(wsUrl)
        
        ws.onopen = () => {
          console.log('WebSocket connected')
          set({ socket: ws, connected: true, connecting: false, reconnectAttempts: 0 })
          
          // Start ping interval
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: EventType.PING, payload: {} }))
            }
          }, PING_INTERVAL)
        }
        
        ws.onmessage = handleMessage
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          set({ lastError: 'Connection error' })
        }
        
        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          clearTimers()
          set({ socket: null, connected: false, connecting: false })
          
          // Attempt reconnect if not intentional close
          if (event.code !== 1000 && event.code !== 4001) {
            attemptReconnect(token)
          }
        }
        
        set({ socket: ws })
        
      } catch (e) {
        console.error('Failed to create WebSocket:', e)
        set({ connecting: false, lastError: 'Failed to connect' })
      }
    },
    
    disconnect: () => {
      const { socket } = get()
      clearTimers()
      
      if (socket) {
        socket.close(1000, 'User disconnected')
      }
      
      set({
        socket: null,
        connected: false,
        connecting: false,
        reconnectAttempts: 0,
        onlineUsers: [],
        typingUsers: new Map(),
        currentRooms: new Set()
      })
    },
    
    send: (message: Partial<WebSocketMessage>) => {
      const {  connected } = get()
      
      if (!socket || !connected) {
        console.warn('Cannot send message: not connected')
        return
      }
      
      const fullMessage: WebSocketMessage = {
        type: message.type || 'unknown',
        payload: message.payload || {},
        timestamp: new Date().toISOString(),
        ...message
      }
      
      socket.send(JSON.stringify(fullMessage))
    },
    
    joinRoom: (room: string) => {
      get().send({
        type: EventType.JOIN_ROOM,
        payload: { room }
      })
    },
    
    leaveRoom: (room: string) => {
      get().send({
        type: EventType.LEAVE_ROOM,
        payload: { room }
      })
    },
    
    startTyping: (chatId: number) => {
      get().send({
        type: EventType.TYPING_START,
        payload: { chat_id: chatId, room: `chat:${chatId}` }
      })
    },
    
    stopTyping: (chatId: number) => {
      get().send({
        type: EventType.TYPING_STOP,
        payload: { chat_id: chatId, room: `chat:${chatId}` }
      })
    },
    
    markMessagesRead: (chatId: number, messageIds: number[]) => {
      get().send({
        type: EventType.MESSAGE_READ,
        payload: { chat_id: chatId, message_ids: messageIds }
      })
    }
  }
})

// Custom hooks for specific features
export const useOnlineUsers = () => {
  return useWebSocketStore(state => state.onlineUsers)
}

export const useTypingUsers = (chatId: number) => {
  return useWebSocketStore(state => state.typingUsers.get(chatId) || [])
}

export const useWebSocketConnection = () => {
  return useWebSocketStore(state => ({
    connected: state.connected,
    connecting: state.connecting,
    error: state.lastError
  }))
}
