/**
 * UE5 API Service
 * ================
 * 
 * Frontend service for communicating with UE5 through the backend API.
 * Provides typed interfaces for all UE5 operations including:
 * - Lighting control
 * - Animation playback
 * - Actor management
 * - Scene operations
 */

const API_BASE = '/api';

// ==================== TYPES ====================

export interface LightingSettings {
  time_of_day: number;
  sun_intensity: number;
  sun_color: string;
  sky_intensity: number;
  sky_color: string;
  ambient_intensity: number;
  ambient_color: string;
  fog_density: number;
  fog_color: string;
  shadow_intensity: number;
  bloom_intensity: number;
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  hdri_asset?: string;
  additional_lights?: AdditionalLight[];
}

export interface AdditionalLight {
  type: 'point' | 'spot' | 'directional' | 'rect';
  position: { x: number; y: number; z: number };
  rotation?: { pitch: number; yaw: number; roll: number };
  intensity: number;
  color: string;
  radius?: number;
  inner_cone_angle?: number;
  outer_cone_angle?: number;
}

export interface AnimationInfo {
  id: string;
  name: string;
  path: string;
  category: string;
  duration: number;
  frame_count: number;
  fps: number;
  skeleton: string;
  tags: string[];
  is_looping: boolean;
  has_root_motion: boolean;
  thumbnail?: string;
}

export interface PlayAnimationRequest {
  animation_path: string;
  actor_id?: string;
  loop?: boolean;
  speed?: number;
  start_time?: number;
  blend_in?: number;
  blend_out?: number;
}

export interface BlendSample {
  animation_path: string;
  position_x: number;
  position_y?: number;
}

export interface CreateBlendSpaceRequest {
  name: string;
  blend_type: '1D' | '2D';
  axis_x_name: string;
  axis_x_min: number;
  axis_x_max: number;
  axis_y_name?: string;
  axis_y_min?: number;
  axis_y_max?: number;
  samples: BlendSample[];
}

export interface MontageSection {
  name: string;
  start_time: number;
  animation_path: string;
}

export interface CreateMontageRequest {
  name: string;
  skeleton: string;
  sections: MontageSection[];
  notifies?: { name: string; time: number; notify_type: string }[];
}

export interface ActorLock {
  actor_id: string;
  actor_name: string;
  user_id: number;
  user_name: string;
  user_color: string;
  locked_at: string;
  expires_at?: string;
}

export interface CollaborationUser {
  user_id: number;
  user_name: string;
  user_color: string;
  joined_at: string;
}

export interface SessionState {
  session_id: string;
  project_id: string;
  users: CollaborationUser[];
  locks: ActorLock[];
  selections: Record<number, string[]>;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Helper function for API requests
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// ==================== LIGHTING API ====================

export const lightingApi = {
  /**
   * Apply a lighting preset
   */
  applyPreset: async (presetId: string, settings: LightingSettings): Promise<CommandResult> => {
    return apiRequest('/lighting/apply', {
      method: 'POST',
      body: JSON.stringify({ preset_id: presetId, settings }),
    });
  },

  /**
   * Apply custom lighting settings
   */
  applyCustom: async (settings: LightingSettings): Promise<CommandResult> => {
    return apiRequest('/lighting/apply-custom', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    });
  },

  /**
   * Set time of day
   */
  setTimeOfDay: async (
    time: number,
    animate: boolean = false,
    duration: number = 2.0
  ): Promise<CommandResult> => {
    return apiRequest('/lighting/time-of-day', {
      method: 'POST',
      body: JSON.stringify({ time, animate, duration }),
    });
  },

  /**
   * Set HDRI sky
   */
  setHDRI: async (
    hdriAsset: string,
    intensity: number = 1.0,
    rotation: number = 0
  ): Promise<CommandResult> => {
    return apiRequest('/lighting/hdri', {
      method: 'POST',
      body: JSON.stringify({
        hdri_asset: hdriAsset,
        intensity,
        rotation,
      }),
    });
  },

  /**
   * Get AI lighting suggestions
   */
  getSuggestions: async (
    sceneDescription?: string,
    mood?: string
  ): Promise<{ suggestions: LightingSettings[] }> => {
    return apiRequest('/lighting/suggest', {
      method: 'POST',
      body: JSON.stringify({
        scene_description: sceneDescription,
        mood,
      }),
    });
  },

  /**
   * Get available presets
   */
  getPresets: async (): Promise<{ presets: Array<{ id: string; name: string; category: string }> }> => {
    return apiRequest('/lighting/presets');
  },
};

// ==================== ANIMATION API ====================

export const animationApi = {
  /**
   * Get animation library
   */
  getLibrary: async (
    category?: string,
    skeleton?: string,
    search?: string
  ): Promise<AnimationInfo[]> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (skeleton) params.append('skeleton', skeleton);
    if (search) params.append('search', search);
    
    return apiRequest(`/animation/library?${params}`);
  },

  /**
   * Play an animation
   */
  play: async (request: PlayAnimationRequest): Promise<CommandResult> => {
    return apiRequest('/animation/play', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Stop animation
   */
  stop: async (actorId?: string, blendOut: number = 0.25): Promise<CommandResult> => {
    return apiRequest('/animation/stop', {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId, blend_out: blendOut }),
    });
  },

  /**
   * Set animation speed
   */
  setSpeed: async (speed: number, actorId?: string): Promise<CommandResult> => {
    const params = new URLSearchParams({ speed: speed.toString() });
    if (actorId) params.append('actor_id', actorId);
    
    return apiRequest(`/animation/set-speed?${params}`, {
      method: 'POST',
    });
  },

  /**
   * Create a blend space
   */
  createBlendSpace: async (request: CreateBlendSpaceRequest): Promise<CommandResult> => {
    return apiRequest('/animation/blend-space/create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Create an animation montage
   */
  createMontage: async (request: CreateMontageRequest): Promise<CommandResult> => {
    return apiRequest('/animation/montage/create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Retarget an animation
   */
  retarget: async (
    sourceAnimation: string,
    sourceSkeleton: string,
    targetSkeleton: string,
    outputPath?: string
  ): Promise<CommandResult> => {
    return apiRequest('/animation/retarget', {
      method: 'POST',
      body: JSON.stringify({
        source_animation: sourceAnimation,
        source_skeleton: sourceSkeleton,
        target_skeleton: targetSkeleton,
        output_path: outputPath,
      }),
    });
  },

  /**
   * Get AI animation suggestions
   */
  getSuggestions: async (context: string): Promise<{ suggestions: AnimationInfo[] }> => {
    return apiRequest('/animation/suggest', {
      method: 'POST',
      body: JSON.stringify({ context }),
    });
  },
};

// ==================== COLLABORATION API ====================

export const collaborationApi = {
  /**
   * Create a collaboration session
   */
  createSession: async (projectId: string): Promise<{ session_id: string }> => {
    return apiRequest('/collaboration/sessions', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    });
  },

  /**
   * Get session state
   */
  getSession: async (sessionId: string): Promise<SessionState> => {
    return apiRequest(`/collaboration/sessions/${sessionId}`);
  },

  /**
   * Lock an actor
   */
  lockActor: async (
    sessionId: string,
    actorId: string,
    actorName: string
  ): Promise<{ success: boolean; lock?: ActorLock; error?: string }> => {
    return apiRequest(`/collaboration/sessions/${sessionId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId, actor_name: actorName }),
    });
  },

  /**
   * Unlock an actor
   */
  unlockActor: async (
    sessionId: string,
    actorId: string
  ): Promise<{ success: boolean; error?: string }> => {
    return apiRequest(`/collaboration/sessions/${sessionId}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId }),
    });
  },

  /**
   * Send a chat message
   */
  sendChat: async (sessionId: string, message: string): Promise<CommandResult> => {
    return apiRequest(`/collaboration/sessions/${sessionId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Get activity feed
   */
  getActivities: async (
    sessionId: string,
    limit: number = 50
  ): Promise<{ activities: Array<{ type: string; user: string; timestamp: string; data: unknown }> }> => {
    return apiRequest(`/collaboration/sessions/${sessionId}/activities?limit=${limit}`);
  },
};

// ==================== WEBSOCKET CONNECTION ====================

export class CollaborationWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private userId: number;
  private userName: string;
  private userColor: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(
    sessionId: string,
    userId: number,
    userName: string,
    userColor: string
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.userName = userName;
    this.userColor = userColor;
  }

  /**
   * Connect to the collaboration WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const token = localStorage.getItem('token');
      
      const url = `${protocol}//${host}/api/collaboration/ws/${this.sessionId}?token=${token}&user_name=${encodeURIComponent(this.userName)}&user_color=${encodeURIComponent(this.userColor)}`;
      
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Collaboration WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = (event) => {
        console.log('Collaboration WebSocket closed:', event.code, event.reason);
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch(console.error);
          }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        }
      };

      this.ws.onerror = (error) => {
        console.error('Collaboration WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
    });
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message through the WebSocket
   */
  send(type: string, data: Record<string, unknown> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Lock an actor
   */
  lockActor(actorId: string, actorName: string): void {
    this.send('lock', { actor_id: actorId, actor_name: actorName });
  }

  /**
   * Unlock an actor
   */
  unlockActor(actorId: string): void {
    this.send('unlock', { actor_id: actorId });
  }

  /**
   * Update selection
   */
  updateSelection(actorIds: string[]): void {
    this.send('selection', { actors: actorIds });
  }

  /**
   * Send a ping
   */
  ping(): void {
    this.send('ping');
  }

  /**
   * Register an event handler
   */
  on(event: string, handler: (data: unknown) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler
   */
  off(event: string, handler: (data: unknown) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (e) {
        console.error('Error in event handler:', e);
      }
    });
    
    // Also emit to wildcard handlers
    this.handlers.get('*')?.forEach((handler) => {
      try {
        handler({ event, data });
      } catch (e) {
        console.error('Error in wildcard handler:', e);
      }
    });
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ==================== SCENE API ====================

export const sceneApi = {
  /**
   * Spawn an actor
   */
  spawnActor: async (
    actorClass: string,
    location: { x: number; y: number; z: number },
    rotation?: { pitch: number; yaw: number; roll: number },
    scale?: { x: number; y: number; z: number },
    name?: string
  ): Promise<CommandResult> => {
    return apiRequest('/scene/spawn', {
      method: 'POST',
      body: JSON.stringify({
        actor_class: actorClass,
        location,
        rotation,
        scale,
        name,
      }),
    });
  },

  /**
   * Delete an actor
   */
  deleteActor: async (actorName: string): Promise<CommandResult> => {
    return apiRequest('/scene/delete', {
      method: 'POST',
      body: JSON.stringify({ actor_name: actorName }),
    });
  },

  /**
   * Get selected actors
   */
  getSelectedActors: async (): Promise<{ actors: string[] }> => {
    return apiRequest('/scene/selected');
  },

  /**
   * Select an actor
   */
  selectActor: async (actorName: string, addToSelection: boolean = false): Promise<CommandResult> => {
    return apiRequest('/scene/select', {
      method: 'POST',
      body: JSON.stringify({ actor_name: actorName, add_to_selection: addToSelection }),
    });
  },

  /**
   * Save the current level
   */
  saveLevel: async (): Promise<CommandResult> => {
    return apiRequest('/scene/save', { method: 'POST' });
  },

  /**
   * Play in editor
   */
  playInEditor: async (): Promise<CommandResult> => {
    return apiRequest('/scene/play', { method: 'POST' });
  },

  /**
   * Stop play in editor
   */
  stopPlay: async (): Promise<CommandResult> => {
    return apiRequest('/scene/stop', { method: 'POST' });
  },

  /**
   * Undo
   */
  undo: async (): Promise<CommandResult> => {
    return apiRequest('/scene/undo', { method: 'POST' });
  },

  /**
   * Redo
   */
  redo: async (): Promise<CommandResult> => {
    return apiRequest('/scene/redo', { method: 'POST' });
  },

  /**
   * Take a screenshot
   */
  takeScreenshot: async (
    filename?: string,
    resolution?: { width: number; height: number }
  ): Promise<{ success: boolean; path: string }> => {
    return apiRequest('/viewport/screenshot', {
      method: 'POST',
      body: JSON.stringify({ filename, resolution }),
    });
  },
};

// ==================== EXPORT DEFAULT ====================

export default {
  lighting: lightingApi,
  animation: animationApi,
  collaboration: collaborationApi,
  scene: sceneApi,
  CollaborationWebSocket,
};
