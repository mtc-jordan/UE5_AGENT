/**
 * Collaboration API Client
 * Handles WebSocket connection and presence/cursor tracking
 */

export interface CursorPosition {
  line: number;
  column: number;
}

export interface Selection {
  start: CursorPosition;
  end: CursorPosition;
}

export interface UserPresence {
  user_id: number;
  username: string;
  email: string;
  color: string;
  current_file_id?: number;
  current_file_path?: string;
  cursor_position?: CursorPosition;
  selection?: Selection;
  is_typing: boolean;
  last_activity: string;
}

export interface CursorUpdate {
  user_id: number;
  username: string;
  color: string;
  cursor_position?: CursorPosition;
  selection?: Selection;
}

export interface TypingStatus {
  user_id: number;
  username: string;
  is_typing: boolean;
}

export interface PresenceUpdate {
  event: 'joined' | 'left' | 'file_changed';
  user: UserPresence;
}

type MessageHandler = (message: any) => void;

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Connect to collaboration WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host.replace(/:\d+/, ':8000'); // Backend port
        const wsUrl = `${protocol}//${host}/api/workspace-collab/ws?token=${this.token}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Collaboration WebSocket connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Collaboration WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Collaboration WebSocket closed');
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send cursor update
   */
  updateCursor(fileId: number, filePath: string, cursorPosition: CursorPosition, selection?: Selection) {
    this.send({
      type: 'cursor_update',
      file_id: fileId,
      file_path: filePath,
      cursor_position: cursorPosition,
      selection,
    });
  }

  /**
   * Send typing status
   */
  updateTypingStatus(isTyping: boolean) {
    this.send({
      type: 'typing_status',
      is_typing: isTyping,
    });
  }

  /**
   * Notify file change
   */
  changeFile(fileId: number | null, filePath: string | null) {
    this.send({
      type: 'file_change',
      file_id: fileId,
      file_path: filePath,
    });
  }

  /**
   * Register message handler
   */
  on(messageType: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType)!.add(handler);
  }

  /**
   * Unregister message handler
   */
  off(messageType: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Send message to server
   */
  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: any) {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
}

/**
 * Fetch online users
 */
export async function getOnlineUsers(): Promise<UserPresence[]> {
  const response = await fetch('/api/workspace-collab/presence', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const data = await response.json();
  return data.users;
}

/**
 * Fetch users viewing a file
 */
export async function getFileViewers(fileId: number): Promise<UserPresence[]> {
  const response = await fetch(`/api/workspace-collab/presence/file/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const data = await response.json();
  return data.viewers;
}

/**
 * Fetch user presence
 */
export async function getUserPresence(userId: number): Promise<UserPresence | null> {
  const response = await fetch(`/api/workspace-collab/presence/user/${userId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!response.ok) return null;
  return await response.json();
}
