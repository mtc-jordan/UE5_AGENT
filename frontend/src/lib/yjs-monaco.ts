/**
 * Yjs Monaco Binding for Collaborative Editing
 * Integrates Yjs CRDT with Monaco Editor for real-time collaboration
 */
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import type * as Monaco from 'monaco-editor';


export interface YjsCollaborationOptions {
  fileId: number;
  token: string;
  editor: Monaco.editor.IStandaloneCodeEditor;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onSynced?: () => void;
  onError?: (error: Error) => void;
}


export class YjsCollaboration {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private binding: MonacoBinding;
  private ytext: Y.Text;
  
  constructor(options: YjsCollaborationOptions) {
    const { fileId, token, editor, onConnected, onDisconnected, onSynced, onError } = options;
    
    // Create Yjs document
    this.doc = new Y.Doc();
    
    // Get shared text type
    this.ytext = this.doc.getText('content');
    
    // Get WebSocket URL
    const wsUrl = this.getWebSocketUrl(fileId, token);
    
    // Create WebSocket provider
    this.provider = new WebsocketProvider(
      wsUrl,
      `file-${fileId}`,
      this.doc,
      {
        connect: true,
        params: { token }
      }
    );
    
    // Create Monaco binding
    this.binding = new MonacoBinding(
      this.ytext,
      editor.getModel()!,
      new Set([editor]),
      this.provider.awareness
    );
    
    // Setup event listeners
    this.provider.on('status', (event: { status: string }) => {
      console.log('Yjs provider status:', event.status);
      
      if (event.status === 'connected') {
        onConnected?.();
      } else if (event.status === 'disconnected') {
        onDisconnected?.();
      }
    });
    
    this.provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        console.log('Yjs document synced');
        onSynced?.();
      }
    });
    
    this.provider.on('connection-error', (error: Error) => {
      console.error('Yjs connection error:', error);
      onError?.(error);
    });
    
    // Log initial state
    console.log(`Yjs collaboration initialized for file ${fileId}`);
  }
  
  /**
   * Get WebSocket URL for Yjs sync
   */
  private getWebSocketUrl(fileId: number, token: string): string {
    // Get base URL from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // For development, use backend port
    const backendHost = host.includes('5173') 
      ? host.replace('5173', '8000')
      : host;
    
    return `${protocol}//${backendHost}/api/yjs/sync/${fileId}?token=${token}`;
  }
  
  /**
   * Get current text content
   */
  getContent(): string {
    return this.ytext.toString();
  }
  
  /**
   * Set text content (replaces entire content)
   */
  setContent(content: string): void {
    this.doc.transact(() => {
      this.ytext.delete(0, this.ytext.length);
      this.ytext.insert(0, content);
    });
  }
  
  /**
   * Get number of connected users
   */
  getConnectedUsers(): number {
    return this.provider.awareness.getStates().size;
  }
  
  /**
   * Get awareness state (cursor positions, selections, etc.)
   */
  getAwarenessStates(): Map<number, any> {
    return this.provider.awareness.getStates();
  }
  
  /**
   * Set local awareness state (cursor, selection, user info)
   */
  setAwarenessState(state: any): void {
    this.provider.awareness.setLocalState(state);
  }
  
  /**
   * Check if document is synced
   */
  isSynced(): boolean {
    return this.provider.synced;
  }
  
  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.provider.wsconnected;
  }
  
  /**
   * Disconnect and cleanup
   */
  destroy(): void {
    console.log('Destroying Yjs collaboration');
    
    // Destroy binding
    this.binding.destroy();
    
    // Disconnect provider
    this.provider.disconnect();
    this.provider.destroy();
    
    // Destroy document
    this.doc.destroy();
  }
}


/**
 * Hook for using Yjs collaboration in React components
 */
export function useYjsCollaboration(
  editor: Monaco.editor.IStandaloneCodeEditor | null,
  fileId: number | null,
  token: string
): {
  collaboration: YjsCollaboration | null;
  isConnected: boolean;
  isSynced: boolean;
  connectedUsers: number;
} {
  const [collaboration, setCollaboration] = React.useState<YjsCollaboration | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isSynced, setIsSynced] = React.useState(false);
  const [connectedUsers, setConnectedUsers] = React.useState(0);
  
  React.useEffect(() => {
    if (!editor || !fileId) {
      return;
    }
    
    // Create collaboration instance
    const collab = new YjsCollaboration({
      fileId,
      token,
      editor,
      onConnected: () => {
        setIsConnected(true);
        console.log('Connected to Yjs server');
      },
      onDisconnected: () => {
        setIsConnected(false);
        console.log('Disconnected from Yjs server');
      },
      onSynced: () => {
        setIsSynced(true);
        console.log('Document synced');
      },
      onError: (error) => {
        console.error('Yjs error:', error);
      }
    });
    
    setCollaboration(collab);
    
    // Update connected users count periodically
    const interval = setInterval(() => {
      if (collab) {
        setConnectedUsers(collab.getConnectedUsers());
      }
    }, 1000);
    
    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      collab.destroy();
      setCollaboration(null);
    };
  }, [editor, fileId, token]);
  
  return {
    collaboration,
    isConnected,
    isSynced,
    connectedUsers
  };
}


// Import React for the hook
import * as React from 'react';
