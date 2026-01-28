/**
 * useCollaboration Hook
 * Manages collaboration WebSocket connection and state
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CollaborationClient,
  UserPresence,
  CursorUpdate,
  TypingStatus,
  PresenceUpdate,
  CursorPosition,
  Selection,
} from '../lib/collaboration-api';

interface UseCollaborationOptions {
  token: string;
  autoConnect?: boolean;
}

interface UseCollaborationReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;

  // User presence
  users: UserPresence[];
  currentUser: UserPresence | null;

  // Cursor tracking
  cursors: Map<number, CursorUpdate>;
  typingUsers: Set<number>;

  // Methods
  connect: () => Promise<void>;
  disconnect: () => void;
  updateCursor: (fileId: number, filePath: string, position: CursorPosition, selection?: Selection) => void;
  updateTypingStatus: (isTyping: boolean) => void;
  changeFile: (fileId: number | null, filePath: string | null) => void;
}

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationReturn {
  const { token, autoConnect = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [cursors, setCursors] = useState<Map<number, CursorUpdate>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  const clientRef = useRef<CollaborationClient | null>(null);
  const currentUserRef = useRef<UserPresence | null>(null);

  // Initialize client
  useEffect(() => {
    if (!token) return;

    clientRef.current = new CollaborationClient(token);

    // Register message handlers
    const client = clientRef.current;

    // Handle presence updates
    client.on('presence_full', (message: { users: UserPresence[] }) => {
      setUsers(message.users);
    });

    client.on('presence_update', (message: PresenceUpdate) => {
      setUsers((prevUsers) => {
        if (message.event === 'joined') {
          return [...prevUsers, message.user];
        } else if (message.event === 'left') {
          return prevUsers.filter((u) => u.user_id !== message.user.user_id);
        } else if (message.event === 'file_changed') {
          return prevUsers.map((u) =>
            u.user_id === message.user.user_id ? message.user : u
          );
        }
        return prevUsers;
      });
    });

    // Handle cursor updates
    client.on('cursor_update', (message: CursorUpdate) => {
      setCursors((prevCursors) => {
        const newCursors = new Map(prevCursors);
        newCursors.set(message.user_id, message);
        return newCursors;
      });
    });

    // Handle typing status
    client.on('typing_status', (message: TypingStatus) => {
      setTypingUsers((prevTyping) => {
        const newTyping = new Set(prevTyping);
        if (message.is_typing) {
          newTyping.add(message.user_id);
        } else {
          newTyping.delete(message.user_id);
        }
        return newTyping;
      });
    });

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    // Cleanup
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [token, autoConnect]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!clientRef.current || isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      await clientRef.current.connect();
      setIsConnected(true);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to connect to collaboration:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      setIsConnected(false);
    }
  }, []);

  // Update cursor position
  const updateCursor = useCallback(
    (fileId: number, filePath: string, position: CursorPosition, selection?: Selection) => {
      if (clientRef.current && isConnected) {
        clientRef.current.updateCursor(fileId, filePath, position, selection);
      }
    },
    [isConnected]
  );

  // Update typing status
  const updateTypingStatus = useCallback(
    (isTyping: boolean) => {
      if (clientRef.current && isConnected) {
        clientRef.current.updateTypingStatus(isTyping);
      }
    },
    [isConnected]
  );

  // Change file
  const changeFile = useCallback(
    (fileId: number | null, filePath: string | null) => {
      if (clientRef.current && isConnected) {
        clientRef.current.changeFile(fileId, filePath);
      }
    },
    [isConnected]
  );

  // Get current user
  const currentUser = users.find((u) => {
    // Assuming the first user in the list is the current user
    // You may need to adjust this logic based on your authentication
    return true; // Placeholder
  }) || null;

  return {
    isConnected,
    isConnecting,
    error,
    users,
    currentUser,
    cursors,
    typingUsers,
    connect,
    disconnect,
    updateCursor,
    updateTypingStatus,
    changeFile,
  };
}
