/**
 * React Hooks for Real-time Features.
 * 
 * Provides easy-to-use hooks for WebSocket-based real-time functionality.
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useAuthStore } from '../lib/store'
import {
  useWebSocketStore,
  registerEventHandler,
  EventType,
  WebSocketMessage,
  TypingUser
} from '../lib/websocket'

/**
 * Hook to manage WebSocket connection lifecycle.
 * Automatically connects when authenticated and disconnects on logout.
 */
export const useWebSocketConnection = () => {
  const { token, isAuthenticated } = useAuthStore()
  const { connect, disconnect, connected, connecting } = useWebSocketStore()
  
  useEffect(() => {
    if (isAuthenticated && token && !connected && !connecting) {
      connect(token)
    }
    
    return () => {
      // Don't disconnect on unmount, only on logout
    }
  }, [isAuthenticated, token, connected, connecting, connect])
  
  // Disconnect on logout
  useEffect(() => {
    if (!isAuthenticated && connected) {
      disconnect()
    }
  }, [isAuthenticated, connected, disconnect])
  
  return { connected, connecting }
}

/**
 * Hook to join/leave a chat room and receive real-time updates.
 */
export const useChatRoom = (chatId: number | null) => {
  const { joinRoom, leaveRoom, connected } = useWebSocketStore()
  const [messages, setMessages] = useState<any[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  
  useEffect(() => {
    if (!chatId || !connected) return
    
    const room = `chat:${chatId}`
    joinRoom(room)
    
    // Register message handler
    const unsubMessage = registerEventHandler(EventType.MESSAGE, (msg) => {
      if (msg.payload.chat_id === chatId) {
        if (msg.payload.type === 'complete') {
          setMessages(prev => [...prev, msg.payload.message])
        }
      }
    })
    
    // Register typing handler
    const unsubTyping = registerEventHandler(EventType.TYPING_START, (msg) => {
      if (msg.payload.chat_id === chatId) {
        setTypingUsers(msg.payload.typing_users || [])
      }
    })
    
    const unsubTypingStop = registerEventHandler(EventType.TYPING_STOP, (msg) => {
      if (msg.payload.chat_id === chatId) {
        setTypingUsers(msg.payload.typing_users || [])
      }
    })
    
    return () => {
      leaveRoom(room)
      unsubMessage()
      unsubTyping()
      unsubTypingStop()
    }
  }, [chatId, connected, joinRoom, leaveRoom])
  
  return { messages, typingUsers }
}

/**
 * Hook for typing indicator with debouncing.
 */
export const useTypingIndicator = (chatId: number | null) => {
  const { startTyping, stopTyping, connected } = useWebSocketStore()
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)
  
  const handleTyping = useCallback(() => {
    if (!chatId || !connected) return
    
    // Start typing if not already
    if (!isTypingRef.current) {
      isTypingRef.current = true
      startTyping(chatId)
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false
        stopTyping(chatId)
      }
    }, 3000) // Stop after 3 seconds of no typing
  }, [chatId, connected, startTyping, stopTyping])
  
  const handleStopTyping = useCallback(() => {
    if (!chatId || !connected) return
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    if (isTypingRef.current) {
      isTypingRef.current = false
      stopTyping(chatId)
    }
  }, [chatId, connected, stopTyping])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (isTypingRef.current && chatId) {
        stopTyping(chatId)
      }
    }
  }, [chatId, stopTyping])
  
  return { handleTyping, handleStopTyping }
}

/**
 * Hook for online users presence.
 */
export const useOnlineUsers = () => {
  const onlineUsers = useWebSocketStore(state => state.onlineUsers)
  
  const isUserOnline = useCallback((userId: number) => {
    return onlineUsers.some(u => u.user_id === userId)
  }, [onlineUsers])
  
  return { onlineUsers, isUserOnline }
}

/**
 * Hook to subscribe to specific WebSocket events.
 */
export const useWebSocketEvent = (
  eventType: EventType | string,
  handler: (message: WebSocketMessage) => void,
  deps: any[] = []
) => {
  useEffect(() => {
    const unsubscribe = registerEventHandler(eventType, handler)
    return unsubscribe
  }, [eventType, ...deps])
}

/**
 * Hook for real-time notifications.
 */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([])
  
  useWebSocketEvent(EventType.NOTIFICATION, (msg) => {
    setNotifications(prev => [msg.payload, ...prev].slice(0, 50)) // Keep last 50
  })
  
  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])
  
  const dismissNotification = useCallback((index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index))
  }, [])
  
  return { notifications, clearNotifications, dismissNotification }
}

/**
 * Hook for workspace file updates.
 */
export const useWorkspaceUpdates = (workspaceId: number | null) => {
  const { joinRoom, leaveRoom, connected } = useWebSocketStore()
  const [fileUpdates, setFileUpdates] = useState<any[]>([])
  
  useEffect(() => {
    if (!workspaceId || !connected) return
    
    const room = `workspace:${workspaceId}`
    joinRoom(room)
    
    const unsubFileUpdate = registerEventHandler(EventType.FILE_UPDATE, (msg) => {
      if (msg.payload.workspace_id === workspaceId) {
        setFileUpdates(prev => [...prev, msg.payload])
      }
    })
    
    return () => {
      leaveRoom(room)
      unsubFileUpdate()
    }
  }, [workspaceId, connected, joinRoom, leaveRoom])
  
  return { fileUpdates }
}

/**
 * Hook for AI response streaming.
 */
export const useAIResponseStream = (chatId: number | null) => {
  const [streamingAgent, setStreamingAgent] = useState<string | null>(null)
  const [streamContent, setStreamContent] = useState<string>('')
  
  useWebSocketEvent(EventType.TYPING_START, (msg) => {
    if (msg.payload.chat_id === chatId && msg.payload.is_ai) {
      setStreamingAgent(msg.payload.agent)
      setStreamContent('')
    }
  }, [chatId])
  
  useWebSocketEvent(EventType.MESSAGE, (msg) => {
    if (msg.payload.chat_id === chatId && msg.payload.type === 'chunk') {
      setStreamContent(prev => prev + msg.payload.content)
    } else if (msg.payload.chat_id === chatId && msg.payload.type === 'complete') {
      setStreamingAgent(null)
      setStreamContent('')
    }
  }, [chatId])
  
  useWebSocketEvent(EventType.TYPING_STOP, (msg) => {
    if (msg.payload.chat_id === chatId && msg.payload.is_ai) {
      setStreamingAgent(null)
    }
  }, [chatId])
  
  return { streamingAgent, streamContent, isStreaming: !!streamingAgent }
}
