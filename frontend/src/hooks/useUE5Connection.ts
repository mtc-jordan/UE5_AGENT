/**
 * useUE5Connection Hook
 * =====================
 * 
 * React hook for managing UE5 connection status and executing commands.
 * Provides:
 * - Connection status monitoring
 * - Command execution with error handling
 * - Automatic reconnection
 * - Toast notifications for feedback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { lightingApi, animationApi, sceneApi, CollaborationWebSocket } from '../lib/ue5Api';
import type { LightingSettings, PlayAnimationRequest, SessionState, ActorLock } from '../lib/ue5Api';

// Connection status types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UE5ConnectionState {
  status: ConnectionStatus;
  agentConnected: boolean;
  mcpConnected: boolean;
  projectName: string | null;
  engineVersion: string | null;
  toolsCount: number;
  lastError: string | null;
  lastCommandTime: Date | null;
}

export interface CommandFeedback {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  details?: string;
  timestamp: Date;
}

interface UseUE5ConnectionOptions {
  onFeedback?: (feedback: CommandFeedback) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useUE5Connection(options: UseUE5ConnectionOptions = {}) {
  const { onFeedback, autoReconnect = true, reconnectInterval = 5000 } = options;

  const [state, setState] = useState<UE5ConnectionState>({
    status: 'disconnected',
    agentConnected: false,
    mcpConnected: false,
    projectName: null,
    engineVersion: null,
    toolsCount: 0,
    lastError: null,
    lastCommandTime: null,
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  // Send feedback notification
  const sendFeedback = useCallback((feedback: Omit<CommandFeedback, 'timestamp'>) => {
    const fullFeedback = { ...feedback, timestamp: new Date() };
    onFeedback?.(fullFeedback);
  }, [onFeedback]);

  // Check connection status
  const checkConnection = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, status: 'connecting' }));
      
      const response = await fetch('/api/agent/status');
      if (!response.ok) throw new Error('Failed to get agent status');
      
      const data = await response.json();
      
      setState({
        status: data.mcp_connected ? 'connected' : 'disconnected',
        agentConnected: data.agent_connected || false,
        mcpConnected: data.mcp_connected || false,
        projectName: data.project_name || null,
        engineVersion: data.engine_version || null,
        toolsCount: data.tools_count || 0,
        lastError: null,
        lastCommandTime: state.lastCommandTime,
      });

      if (data.mcp_connected) {
        sendFeedback({
          type: 'success',
          message: 'Connected to UE5',
          details: `Project: ${data.project_name || 'Unknown'}`,
        });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [sendFeedback, state.lastCommandTime]);

  // Auto-reconnect effect
  useEffect(() => {
    checkConnection();

    if (autoReconnect) {
      reconnectTimer.current = setInterval(checkConnection, reconnectInterval);
    }

    return () => {
      if (reconnectTimer.current) {
        clearInterval(reconnectTimer.current);
      }
    };
  }, [autoReconnect, reconnectInterval, checkConnection]);

  // Generic command executor with error handling
  const executeCommand = useCallback(async <T>(
    commandFn: () => Promise<T>,
    successMessage: string,
    errorMessage: string
  ): Promise<T | null> => {
    if (state.status !== 'connected') {
      sendFeedback({
        type: 'warning',
        message: 'Not connected to UE5',
        details: 'Please ensure the UE5 agent is running and connected.',
      });
      return null;
    }

    setIsExecuting(true);
    try {
      const result = await commandFn();
      setState(prev => ({ ...prev, lastCommandTime: new Date() }));
      sendFeedback({
        type: 'success',
        message: successMessage,
      });
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, lastError: errorMsg }));
      sendFeedback({
        type: 'error',
        message: errorMessage,
        details: errorMsg,
      });
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, [state.status, sendFeedback]);

  // ==================== LIGHTING COMMANDS ====================

  const applyLightingPreset = useCallback(async (presetId: string, settings: LightingSettings) => {
    return executeCommand(
      () => lightingApi.applyPreset(presetId, settings),
      `Applied lighting preset: ${presetId}`,
      'Failed to apply lighting preset'
    );
  }, [executeCommand]);

  const setTimeOfDay = useCallback(async (time: number, animate = false) => {
    const timeStr = `${Math.floor(time)}:${Math.round((time % 1) * 60).toString().padStart(2, '0')}`;
    return executeCommand(
      () => lightingApi.setTimeOfDay(time, animate),
      `Set time to ${timeStr}`,
      'Failed to set time of day'
    );
  }, [executeCommand]);

  const setHDRI = useCallback(async (hdriAsset: string, intensity = 1.0) => {
    return executeCommand(
      () => lightingApi.setHDRI(hdriAsset, intensity),
      `Applied HDRI: ${hdriAsset}`,
      'Failed to set HDRI'
    );
  }, [executeCommand]);

  // ==================== ANIMATION COMMANDS ====================

  const playAnimation = useCallback(async (request: PlayAnimationRequest) => {
    const animName = request.animation_path.split('/').pop() || 'animation';
    return executeCommand(
      () => animationApi.play(request),
      `Playing animation: ${animName}`,
      'Failed to play animation'
    );
  }, [executeCommand]);

  const stopAnimation = useCallback(async (actorId?: string) => {
    return executeCommand(
      () => animationApi.stop(actorId),
      'Animation stopped',
      'Failed to stop animation'
    );
  }, [executeCommand]);

  const setAnimationSpeed = useCallback(async (speed: number, actorId?: string) => {
    return executeCommand(
      () => animationApi.setSpeed(speed, actorId),
      `Animation speed set to ${speed}x`,
      'Failed to set animation speed'
    );
  }, [executeCommand]);

  // ==================== SCENE COMMANDS ====================

  const spawnActor = useCallback(async (
    actorClass: string,
    location: { x: number; y: number; z: number },
    rotation?: { pitch: number; yaw: number; roll: number },
    scale?: { x: number; y: number; z: number }
  ) => {
    return executeCommand(
      () => sceneApi.spawnActor(actorClass, location, rotation, scale),
      `Spawned actor: ${actorClass}`,
      'Failed to spawn actor'
    );
  }, [executeCommand]);

  const deleteActor = useCallback(async (actorName: string) => {
    return executeCommand(
      () => sceneApi.deleteActor(actorName),
      `Deleted actor: ${actorName}`,
      'Failed to delete actor'
    );
  }, [executeCommand]);

  const saveLevel = useCallback(async () => {
    return executeCommand(
      () => sceneApi.saveLevel(),
      'Level saved',
      'Failed to save level'
    );
  }, [executeCommand]);

  const playInEditor = useCallback(async () => {
    return executeCommand(
      () => sceneApi.playInEditor(),
      'Started Play in Editor',
      'Failed to start PIE'
    );
  }, [executeCommand]);

  const stopPlay = useCallback(async () => {
    return executeCommand(
      () => sceneApi.stopPlay(),
      'Stopped Play in Editor',
      'Failed to stop PIE'
    );
  }, [executeCommand]);

  const undo = useCallback(async () => {
    return executeCommand(
      () => sceneApi.undo(),
      'Undo successful',
      'Failed to undo'
    );
  }, [executeCommand]);

  const redo = useCallback(async () => {
    return executeCommand(
      () => sceneApi.redo(),
      'Redo successful',
      'Failed to redo'
    );
  }, [executeCommand]);

  const takeScreenshot = useCallback(async (filename?: string) => {
    return executeCommand(
      () => sceneApi.takeScreenshot(filename),
      'Screenshot captured',
      'Failed to take screenshot'
    );
  }, [executeCommand]);

  return {
    // State
    state,
    isExecuting,
    isConnected: state.status === 'connected',

    // Connection
    checkConnection,
    reconnect: checkConnection,

    // Lighting
    applyLightingPreset,
    setTimeOfDay,
    setHDRI,

    // Animation
    playAnimation,
    stopAnimation,
    setAnimationSpeed,

    // Scene
    spawnActor,
    deleteActor,
    saveLevel,
    playInEditor,
    stopPlay,
    undo,
    redo,
    takeScreenshot,
  };
}

// ==================== COLLABORATION HOOK ====================

interface UseCollaborationOptions {
  sessionId: string;
  userId: number;
  userName: string;
  userColor: string;
  onUserJoined?: (user: { user_id: number; user_name: string }) => void;
  onUserLeft?: (user: { user_id: number; user_name: string }) => void;
  onActorLocked?: (lock: ActorLock) => void;
  onActorUnlocked?: (data: { actor_id: string; actor_name: string }) => void;
  onSelectionChanged?: (data: { user_id: number; selected_actors: string[] }) => void;
}

export function useCollaboration(options: UseCollaborationOptions) {
  const {
    sessionId,
    userId,
    userName,
    userColor,
    onUserJoined,
    onUserLeft,
    onActorLocked,
    onActorUnlocked,
    onSelectionChanged,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [locks, setLocks] = useState<Map<string, ActorLock>>(new Map());
  const wsRef = useRef<CollaborationWebSocket | null>(null);

  // Connect to collaboration session
  const connect = useCallback(async () => {
    if (wsRef.current?.isConnected) return;

    const ws = new CollaborationWebSocket(sessionId, userId, userName, userColor);

    // Register event handlers
    ws.on('session_state', (data: any) => {
      setSessionState(data.state);
      const lockMap = new Map<string, ActorLock>();
      data.state?.locks?.forEach((lock: ActorLock) => {
        lockMap.set(lock.actor_id, lock);
      });
      setLocks(lockMap);
    });

    ws.on('user_joined', (data: any) => {
      onUserJoined?.(data);
    });

    ws.on('user_left', (data: any) => {
      onUserLeft?.(data);
      // Remove locks from departed user
      setLocks(prev => {
        const newLocks = new Map(prev);
        for (const [actorId, lock] of newLocks) {
          if (lock.user_id === data.user_id) {
            newLocks.delete(actorId);
          }
        }
        return newLocks;
      });
    });

    ws.on('actor_locked', (data: any) => {
      const lock = data.lock as ActorLock;
      setLocks(prev => new Map(prev).set(lock.actor_id, lock));
      onActorLocked?.(lock);
    });

    ws.on('actor_unlocked', (data: any) => {
      setLocks(prev => {
        const newLocks = new Map(prev);
        newLocks.delete(data.actor_id);
        return newLocks;
      });
      onActorUnlocked?.(data);
    });

    ws.on('selection_changed', (data: any) => {
      onSelectionChanged?.(data);
    });

    ws.on('disconnected', () => {
      setIsConnected(false);
    });

    try {
      await ws.connect();
      wsRef.current = ws;
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect to collaboration session:', error);
    }
  }, [sessionId, userId, userName, userColor, onUserJoined, onUserLeft, onActorLocked, onActorUnlocked, onSelectionChanged]);

  // Disconnect from collaboration session
  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  // Lock an actor
  const lockActor = useCallback((actorId: string, actorName: string) => {
    wsRef.current?.lockActor(actorId, actorName);
  }, []);

  // Unlock an actor
  const unlockActor = useCallback((actorId: string) => {
    wsRef.current?.unlockActor(actorId);
  }, []);

  // Update selection
  const updateSelection = useCallback((actorIds: string[]) => {
    wsRef.current?.updateSelection(actorIds);
  }, []);

  // Check if an actor is locked
  const isActorLocked = useCallback((actorId: string) => {
    return locks.has(actorId);
  }, [locks]);

  // Get lock info for an actor
  const getActorLock = useCallback((actorId: string) => {
    return locks.get(actorId);
  }, [locks]);

  // Check if current user owns the lock
  const isLockOwner = useCallback((actorId: string) => {
    const lock = locks.get(actorId);
    return lock?.user_id === userId;
  }, [locks, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    sessionState,
    locks: Array.from(locks.values()),
    connect,
    disconnect,
    lockActor,
    unlockActor,
    updateSelection,
    isActorLocked,
    getActorLock,
    isLockOwner,
  };
}

export default useUE5Connection;
