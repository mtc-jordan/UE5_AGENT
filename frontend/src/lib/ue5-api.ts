/**
 * UE5 MCP Bridge API Client
 * Frontend client for communicating with UE5 via MCP bridge
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface UE5CommandRequest {
  tool_name: string;
  parameters: Record<string, any>;
  category?: string;
}

export interface UE5CommandResponse {
  success: boolean;
  command: string;
  category: string;
  result?: any;
  error?: string;
  execution_time_ms?: number;
  timestamp?: string;
}

/**
 * Execute a UE5 command via MCP bridge
 */
export async function executeUE5Command(
  request: UE5CommandRequest
): Promise<UE5CommandResponse> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}/api/ue5/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`UE5 command failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get UE5 command execution history
 */
export async function getUE5CommandHistory(
  limit: number = 50
): Promise<UE5CommandResponse[]> {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}/api/ue5/history?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get history: ${response.statusText}`);
  }

  return response.json();
}

// ==================== ACTOR COMMANDS ====================

export async function spawnActor(
  actorClass: string,
  location: { x: number; y: number; z: number },
  rotation?: { pitch: number; yaw: number; roll: number },
  scale?: { x: number; y: number; z: number },
  name?: string
): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'spawn_actor',
    parameters: {
      actor_class: actorClass,
      location,
      rotation,
      scale,
      actor_name: name
    },
    category: 'actor'
  });
}

export async function deleteActor(actorName: string): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'delete_actor',
    parameters: { actor_name: actorName },
    category: 'actor'
  });
}

export async function selectActor(
  actorName: string,
  addToSelection: boolean = false
): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'select_actor',
    parameters: {
      actor_name: actorName,
      add_to_selection: addToSelection
    },
    category: 'actor'
  });
}

export async function setActorTransform(
  actorName: string,
  location?: { x: number; y: number; z: number },
  rotation?: { pitch: number; yaw: number; roll: number },
  scale?: { x: number; y: number; z: number }
): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'set_actor_transform',
    parameters: {
      actor_name: actorName,
      location,
      rotation,
      scale
    },
    category: 'actor'
  });
}

export async function getSelectedActors(): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'get_selected_actors',
    parameters: {},
    category: 'actor'
  });
}

// ==================== LEVEL COMMANDS ====================

export async function saveLevel(): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'save_current_level',
    parameters: {},
    category: 'scene'
  });
}

export async function playInEditor(): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'play_in_editor',
    parameters: {},
    category: 'scene'
  });
}

export async function stopPlay(): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'stop_play_in_editor',
    parameters: {},
    category: 'scene'
  });
}

export async function undo(): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'undo',
    parameters: {},
    category: 'scene'
  });
}

export async function redo(): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'redo',
    parameters: {},
    category: 'scene'
  });
}

export async function takeScreenshot(
  filename?: string,
  resolution?: { width: number; height: number }
): Promise<UE5CommandResponse> {
  const params: any = {};
  
  if (filename) {
    params.filename = filename;
  }
  
  if (resolution) {
    params.resolution_x = resolution.width;
    params.resolution_y = resolution.height;
  }
  
  return executeUE5Command({
    tool_name: 'take_screenshot',
    parameters: params,
    category: 'viewport'
  });
}

// ==================== LIGHTING COMMANDS ====================

export async function setTimeOfDay(
  time: number,
  animate: boolean = false,
  duration: number = 2.0
): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'set_sun_position',
    parameters: {
      time_of_day: time,
      animate,
      duration
    },
    category: 'lighting'
  });
}

export async function setSunProperties(
  intensity: number = 1.0,
  color: string = '#FFFFFF',
  timeOfDay?: number
): Promise<UE5CommandResponse> {
  const params: any = { intensity, color };
  
  if (timeOfDay !== undefined) {
    params.time_of_day = timeOfDay;
  }
  
  return executeUE5Command({
    tool_name: 'set_directional_light',
    parameters: params,
    category: 'lighting'
  });
}

// ==================== ANIMATION COMMANDS ====================

export async function playAnimation(
  actorName: string,
  animationAsset: string,
  loop: boolean = false,
  playRate: number = 1.0
): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'play_animation',
    parameters: {
      actor_name: actorName,
      animation_asset: animationAsset,
      looping: loop,
      play_rate: playRate
    },
    category: 'animation'
  });
}

export async function stopAnimation(actorName: string): Promise<UE5CommandResponse> {
  return executeUE5Command({
    tool_name: 'stop_animation',
    parameters: { actor_name: actorName },
    category: 'animation'
  });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse location string to coordinates
 * Examples: "100 200 50", "0,0,0", "x:100 y:200 z:50"
 */
export function parseLocation(locationStr: string): { x: number; y: number; z: number } {
  // Remove common prefixes
  locationStr = locationStr.replace(/[xyz]:/gi, '');
  
  // Split by space or comma
  const parts = locationStr.split(/[\s,]+/).map(p => parseFloat(p.trim()));
  
  if (parts.length >= 3) {
    return { x: parts[0], y: parts[1], z: parts[2] };
  }
  
  // Default to origin
  return { x: 0, y: 0, z: 0 };
}

/**
 * Parse rotation string to Euler angles
 */
export function parseRotation(rotationStr: string): { pitch: number; yaw: number; roll: number } {
  // Remove common prefixes
  rotationStr = rotationStr.replace(/[pyr]:/gi, '').replace(/pitch|yaw|roll/gi, '');
  
  // Split by space or comma
  const parts = rotationStr.split(/[\s,]+/).map(p => parseFloat(p.trim()));
  
  if (parts.length >= 3) {
    return { pitch: parts[0], yaw: parts[1], roll: parts[2] };
  }
  
  // Default to no rotation
  return { pitch: 0, yaw: 0, roll: 0 };
}

/**
 * Parse scale string to scale vector
 */
export function parseScale(scaleStr: string): { x: number; y: number; z: number } {
  // Remove common prefixes
  scaleStr = scaleStr.replace(/[xyz]:/gi, '');
  
  // Split by space or comma
  const parts = scaleStr.split(/[\s,]+/).map(p => parseFloat(p.trim()));
  
  if (parts.length === 1) {
    // Uniform scale
    return { x: parts[0], y: parts[0], z: parts[0] };
  } else if (parts.length >= 3) {
    return { x: parts[0], y: parts[1], z: parts[2] };
  }
  
  // Default to unit scale
  return { x: 1, y: 1, z: 1 };
}
