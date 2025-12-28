// MCP Tools Data - All 101 tools from UE5 MCP Bridge v3.3.1
// Organized by category for the smart UE5 connection system

export interface MCPToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
}

export interface MCPTool {
  name: string;
  displayName: string;
  description: string;
  category: string;
  parameters: MCPToolParameter[];
  returnType: string;
  example?: string;
  tags: string[];
}

export interface MCPToolCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  tools: MCPTool[];
}

// All 101 MCP Tools organized by category
export const MCP_TOOLS: MCPTool[] = [
  // ==================== ACTOR MANAGEMENT (19 tools) ====================
  {
    name: 'get_actors_in_level',
    displayName: 'Get Actors in Level',
    description: 'Get all actors currently in the level with optional filtering',
    category: 'actor',
    parameters: [
      { name: 'class_filter', type: 'string', description: 'Filter by actor class', required: false },
      { name: 'name_filter', type: 'string', description: 'Filter by actor name', required: false }
    ],
    returnType: 'array',
    tags: ['query', 'level', 'actors']
  },
  {
    name: 'spawn_actor',
    displayName: 'Spawn Actor',
    description: 'Spawn a new actor in the level at specified location',
    category: 'actor',
    parameters: [
      { name: 'class_name', type: 'string', description: 'Actor class to spawn', required: true },
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true },
      { name: 'location_z', type: 'number', description: 'Z coordinate', required: true },
      { name: 'rotation_pitch', type: 'number', description: 'Pitch rotation', required: false, default: 0 },
      { name: 'rotation_yaw', type: 'number', description: 'Yaw rotation', required: false, default: 0 },
      { name: 'rotation_roll', type: 'number', description: 'Roll rotation', required: false, default: 0 }
    ],
    returnType: 'object',
    example: 'spawn_actor("StaticMeshActor", 0, 0, 100)',
    tags: ['create', 'spawn', 'actor']
  },
  {
    name: 'delete_actor',
    displayName: 'Delete Actor',
    description: 'Delete an actor from the level by name or ID',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor to delete', required: true }
    ],
    returnType: 'boolean',
    tags: ['delete', 'remove', 'actor']
  },
  {
    name: 'set_actor_transform',
    displayName: 'Set Actor Transform',
    description: 'Set the location, rotation, and scale of an actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'location_x', type: 'number', description: 'X coordinate', required: false },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: false },
      { name: 'location_z', type: 'number', description: 'Z coordinate', required: false },
      { name: 'rotation_pitch', type: 'number', description: 'Pitch rotation', required: false },
      { name: 'rotation_yaw', type: 'number', description: 'Yaw rotation', required: false },
      { name: 'rotation_roll', type: 'number', description: 'Roll rotation', required: false },
      { name: 'scale_x', type: 'number', description: 'X scale', required: false },
      { name: 'scale_y', type: 'number', description: 'Y scale', required: false },
      { name: 'scale_z', type: 'number', description: 'Z scale', required: false }
    ],
    returnType: 'boolean',
    tags: ['transform', 'move', 'rotate', 'scale']
  },
  {
    name: 'get_actor_transform',
    displayName: 'Get Actor Transform',
    description: 'Get the current transform of an actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true }
    ],
    returnType: 'object',
    tags: ['query', 'transform', 'location']
  },
  {
    name: 'set_actor_property',
    displayName: 'Set Actor Property',
    description: 'Set a property value on an actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'property_name', type: 'string', description: 'Name of the property', required: true },
      { name: 'property_value', type: 'string', description: 'Value to set', required: true }
    ],
    returnType: 'boolean',
    tags: ['property', 'modify', 'actor']
  },
  {
    name: 'get_actor_property',
    displayName: 'Get Actor Property',
    description: 'Get a property value from an actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'property_name', type: 'string', description: 'Name of the property', required: true }
    ],
    returnType: 'string',
    tags: ['query', 'property', 'actor']
  },
  {
    name: 'duplicate_actor',
    displayName: 'Duplicate Actor',
    description: 'Create a duplicate of an existing actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor to duplicate', required: true },
      { name: 'new_name', type: 'string', description: 'Name for the new actor', required: false },
      { name: 'offset_x', type: 'number', description: 'X offset from original', required: false, default: 100 },
      { name: 'offset_y', type: 'number', description: 'Y offset from original', required: false, default: 0 },
      { name: 'offset_z', type: 'number', description: 'Z offset from original', required: false, default: 0 }
    ],
    returnType: 'object',
    tags: ['duplicate', 'copy', 'actor']
  },
  {
    name: 'rename_actor',
    displayName: 'Rename Actor',
    description: 'Rename an actor in the level',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Current name of the actor', required: true },
      { name: 'new_name', type: 'string', description: 'New name for the actor', required: true }
    ],
    returnType: 'boolean',
    tags: ['rename', 'actor']
  },
  {
    name: 'set_actor_visibility',
    displayName: 'Set Actor Visibility',
    description: 'Show or hide an actor in the level',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'visible', type: 'boolean', description: 'Whether the actor should be visible', required: true }
    ],
    returnType: 'boolean',
    tags: ['visibility', 'show', 'hide']
  },
  {
    name: 'set_actor_mobility',
    displayName: 'Set Actor Mobility',
    description: 'Set the mobility type of an actor (Static, Stationary, Movable)',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'mobility', type: 'string', description: 'Mobility type', required: true, enum: ['Static', 'Stationary', 'Movable'] }
    ],
    returnType: 'boolean',
    tags: ['mobility', 'static', 'movable']
  },
  {
    name: 'attach_actor_to_actor',
    displayName: 'Attach Actor to Actor',
    description: 'Attach one actor as a child of another',
    category: 'actor',
    parameters: [
      { name: 'child_actor', type: 'string', description: 'Name of the child actor', required: true },
      { name: 'parent_actor', type: 'string', description: 'Name of the parent actor', required: true },
      { name: 'socket_name', type: 'string', description: 'Socket to attach to', required: false }
    ],
    returnType: 'boolean',
    tags: ['attach', 'parent', 'child', 'hierarchy']
  },
  {
    name: 'detach_actor',
    displayName: 'Detach Actor',
    description: 'Detach an actor from its parent',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor to detach', required: true }
    ],
    returnType: 'boolean',
    tags: ['detach', 'hierarchy']
  },
  {
    name: 'set_actor_label',
    displayName: 'Set Actor Label',
    description: 'Set the display label for an actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'label', type: 'string', description: 'New label', required: true }
    ],
    returnType: 'boolean',
    tags: ['label', 'display', 'actor']
  },
  {
    name: 'set_actor_tags',
    displayName: 'Set Actor Tags',
    description: 'Set tags on an actor for organization and filtering',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'tags', type: 'array', description: 'Array of tags', required: true }
    ],
    returnType: 'boolean',
    tags: ['tags', 'organize', 'filter']
  },
  {
    name: 'get_actor_bounds',
    displayName: 'Get Actor Bounds',
    description: 'Get the bounding box of an actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true }
    ],
    returnType: 'object',
    tags: ['bounds', 'size', 'query']
  },
  {
    name: 'set_static_mesh',
    displayName: 'Set Static Mesh',
    description: 'Set the static mesh for a static mesh actor',
    category: 'actor',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'mesh_path', type: 'string', description: 'Path to the static mesh asset', required: true }
    ],
    returnType: 'boolean',
    tags: ['mesh', 'static', 'asset']
  },
  {
    name: 'create_actor_group',
    displayName: 'Create Actor Group',
    description: 'Group multiple actors together',
    category: 'actor',
    parameters: [
      { name: 'actor_names', type: 'array', description: 'Array of actor names to group', required: true },
      { name: 'group_name', type: 'string', description: 'Name for the group', required: true }
    ],
    returnType: 'boolean',
    tags: ['group', 'organize', 'actors']
  },
  {
    name: 'find_actors_by_tag',
    displayName: 'Find Actors by Tag',
    description: 'Find all actors with a specific tag',
    category: 'actor',
    parameters: [
      { name: 'tag', type: 'string', description: 'Tag to search for', required: true }
    ],
    returnType: 'array',
    tags: ['search', 'find', 'tag']
  },

  // ==================== SELECTION & FOCUS (4 tools) ====================
  {
    name: 'select_actor',
    displayName: 'Select Actor',
    description: 'Select an actor in the editor',
    category: 'selection',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor to select', required: true },
      { name: 'add_to_selection', type: 'boolean', description: 'Add to current selection', required: false, default: false }
    ],
    returnType: 'boolean',
    tags: ['select', 'editor']
  },
  {
    name: 'deselect_all',
    displayName: 'Deselect All',
    description: 'Clear the current selection',
    category: 'selection',
    parameters: [],
    returnType: 'boolean',
    tags: ['deselect', 'clear', 'selection']
  },
  {
    name: 'get_selected_actors',
    displayName: 'Get Selected Actors',
    description: 'Get all currently selected actors',
    category: 'selection',
    parameters: [],
    returnType: 'array',
    tags: ['query', 'selection', 'actors']
  },
  {
    name: 'focus_on_actor',
    displayName: 'Focus on Actor',
    description: 'Focus the viewport camera on an actor',
    category: 'selection',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor to focus on', required: true }
    ],
    returnType: 'boolean',
    tags: ['focus', 'camera', 'viewport']
  },

  // ==================== VIEWPORT & CAMERA (9 tools) ====================
  {
    name: 'set_viewport_camera',
    displayName: 'Set Viewport Camera',
    description: 'Set the viewport camera position and rotation',
    category: 'viewport',
    parameters: [
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true },
      { name: 'location_z', type: 'number', description: 'Z coordinate', required: true },
      { name: 'rotation_pitch', type: 'number', description: 'Pitch rotation', required: false },
      { name: 'rotation_yaw', type: 'number', description: 'Yaw rotation', required: false },
      { name: 'rotation_roll', type: 'number', description: 'Roll rotation', required: false }
    ],
    returnType: 'boolean',
    tags: ['camera', 'viewport', 'position']
  },
  {
    name: 'get_viewport_camera',
    displayName: 'Get Viewport Camera',
    description: 'Get the current viewport camera transform',
    category: 'viewport',
    parameters: [],
    returnType: 'object',
    tags: ['query', 'camera', 'viewport']
  },
  {
    name: 'take_screenshot',
    displayName: 'Take Screenshot',
    description: 'Capture a screenshot of the viewport',
    category: 'viewport',
    parameters: [
      { name: 'filename', type: 'string', description: 'Output filename', required: true },
      { name: 'resolution_x', type: 'number', description: 'Width in pixels', required: false, default: 1920 },
      { name: 'resolution_y', type: 'number', description: 'Height in pixels', required: false, default: 1080 }
    ],
    returnType: 'string',
    tags: ['screenshot', 'capture', 'image']
  },
  {
    name: 'set_viewport_mode',
    displayName: 'Set Viewport Mode',
    description: 'Set the viewport rendering mode',
    category: 'viewport',
    parameters: [
      { name: 'mode', type: 'string', description: 'Viewport mode', required: true, enum: ['Lit', 'Unlit', 'Wireframe', 'DetailLighting', 'LightingOnly', 'PathTracing'] }
    ],
    returnType: 'boolean',
    tags: ['viewport', 'rendering', 'mode']
  },
  {
    name: 'set_viewport_realtime',
    displayName: 'Set Viewport Realtime',
    description: 'Enable or disable realtime rendering in viewport',
    category: 'viewport',
    parameters: [
      { name: 'enabled', type: 'boolean', description: 'Enable realtime', required: true }
    ],
    returnType: 'boolean',
    tags: ['viewport', 'realtime', 'rendering']
  },
  {
    name: 'set_viewport_show_flags',
    displayName: 'Set Viewport Show Flags',
    description: 'Set viewport show flags for various elements',
    category: 'viewport',
    parameters: [
      { name: 'flag_name', type: 'string', description: 'Name of the show flag', required: true },
      { name: 'enabled', type: 'boolean', description: 'Enable or disable', required: true }
    ],
    returnType: 'boolean',
    tags: ['viewport', 'flags', 'visibility']
  },
  {
    name: 'create_viewport_bookmark',
    displayName: 'Create Viewport Bookmark',
    description: 'Save current viewport position as a bookmark',
    category: 'viewport',
    parameters: [
      { name: 'bookmark_name', type: 'string', description: 'Name for the bookmark', required: true }
    ],
    returnType: 'boolean',
    tags: ['bookmark', 'save', 'camera']
  },
  {
    name: 'goto_viewport_bookmark',
    displayName: 'Go to Viewport Bookmark',
    description: 'Move viewport to a saved bookmark',
    category: 'viewport',
    parameters: [
      { name: 'bookmark_name', type: 'string', description: 'Name of the bookmark', required: true }
    ],
    returnType: 'boolean',
    tags: ['bookmark', 'goto', 'camera']
  },
  {
    name: 'list_viewport_bookmarks',
    displayName: 'List Viewport Bookmarks',
    description: 'Get all saved viewport bookmarks',
    category: 'viewport',
    parameters: [],
    returnType: 'array',
    tags: ['bookmark', 'list', 'query']
  },

  // ==================== LEVEL MANAGEMENT (3 tools) ====================
  {
    name: 'get_current_level',
    displayName: 'Get Current Level',
    description: 'Get information about the current level',
    category: 'level',
    parameters: [],
    returnType: 'object',
    tags: ['level', 'query', 'info']
  },
  {
    name: 'open_level',
    displayName: 'Open Level',
    description: 'Open a level by path',
    category: 'level',
    parameters: [
      { name: 'level_path', type: 'string', description: 'Path to the level asset', required: true }
    ],
    returnType: 'boolean',
    tags: ['level', 'open', 'load']
  },
  {
    name: 'save_current_level',
    displayName: 'Save Current Level',
    description: 'Save the current level',
    category: 'level',
    parameters: [],
    returnType: 'boolean',
    tags: ['level', 'save']
  },

  // ==================== PLAY IN EDITOR (2 tools) ====================
  {
    name: 'play_in_editor',
    displayName: 'Play in Editor',
    description: 'Start Play in Editor (PIE) session',
    category: 'pie',
    parameters: [
      { name: 'mode', type: 'string', description: 'PIE mode', required: false, enum: ['SelectedViewport', 'NewWindow', 'MobilePreview', 'VRPreview'], default: 'SelectedViewport' }
    ],
    returnType: 'boolean',
    tags: ['play', 'pie', 'test']
  },
  {
    name: 'stop_play_in_editor',
    displayName: 'Stop Play in Editor',
    description: 'Stop the current PIE session',
    category: 'pie',
    parameters: [],
    returnType: 'boolean',
    tags: ['stop', 'pie', 'test']
  },

  // ==================== ASSET MANAGEMENT (8 tools) ====================
  {
    name: 'get_asset_info',
    displayName: 'Get Asset Info',
    description: 'Get information about an asset',
    category: 'asset',
    parameters: [
      { name: 'asset_path', type: 'string', description: 'Path to the asset', required: true }
    ],
    returnType: 'object',
    tags: ['asset', 'info', 'query']
  },
  {
    name: 'find_assets',
    displayName: 'Find Assets',
    description: 'Search for assets by name or type',
    category: 'asset',
    parameters: [
      { name: 'search_query', type: 'string', description: 'Search query', required: true },
      { name: 'asset_type', type: 'string', description: 'Filter by asset type', required: false }
    ],
    returnType: 'array',
    tags: ['asset', 'search', 'find']
  },
  {
    name: 'import_asset',
    displayName: 'Import Asset',
    description: 'Import an asset from file',
    category: 'asset',
    parameters: [
      { name: 'file_path', type: 'string', description: 'Path to the file to import', required: true },
      { name: 'destination_path', type: 'string', description: 'Destination in content browser', required: true }
    ],
    returnType: 'object',
    tags: ['asset', 'import', 'file']
  },
  {
    name: 'export_asset',
    displayName: 'Export Asset',
    description: 'Export an asset to file',
    category: 'asset',
    parameters: [
      { name: 'asset_path', type: 'string', description: 'Path to the asset', required: true },
      { name: 'export_path', type: 'string', description: 'Export file path', required: true }
    ],
    returnType: 'boolean',
    tags: ['asset', 'export', 'file']
  },
  {
    name: 'delete_asset',
    displayName: 'Delete Asset',
    description: 'Delete an asset from the project',
    category: 'asset',
    parameters: [
      { name: 'asset_path', type: 'string', description: 'Path to the asset', required: true }
    ],
    returnType: 'boolean',
    tags: ['asset', 'delete', 'remove']
  },
  {
    name: 'duplicate_asset',
    displayName: 'Duplicate Asset',
    description: 'Create a copy of an asset',
    category: 'asset',
    parameters: [
      { name: 'asset_path', type: 'string', description: 'Path to the asset', required: true },
      { name: 'new_path', type: 'string', description: 'Path for the duplicate', required: true }
    ],
    returnType: 'object',
    tags: ['asset', 'duplicate', 'copy']
  },
  {
    name: 'rename_asset',
    displayName: 'Rename Asset',
    description: 'Rename an asset',
    category: 'asset',
    parameters: [
      { name: 'asset_path', type: 'string', description: 'Path to the asset', required: true },
      { name: 'new_name', type: 'string', description: 'New name for the asset', required: true }
    ],
    returnType: 'boolean',
    tags: ['asset', 'rename']
  },
  {
    name: 'get_asset_references',
    displayName: 'Get Asset References',
    description: 'Get all references to an asset',
    category: 'asset',
    parameters: [
      { name: 'asset_path', type: 'string', description: 'Path to the asset', required: true }
    ],
    returnType: 'array',
    tags: ['asset', 'references', 'dependencies']
  },

  // ==================== BLUEPRINT OPERATIONS (9 tools) ====================
  {
    name: 'create_blueprint',
    displayName: 'Create Blueprint',
    description: 'Create a new Blueprint class',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_name', type: 'string', description: 'Name for the Blueprint', required: true },
      { name: 'parent_class', type: 'string', description: 'Parent class', required: true },
      { name: 'path', type: 'string', description: 'Content browser path', required: true }
    ],
    returnType: 'object',
    tags: ['blueprint', 'create', 'class']
  },
  {
    name: 'open_blueprint',
    displayName: 'Open Blueprint',
    description: 'Open a Blueprint in the editor',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true }
    ],
    returnType: 'boolean',
    tags: ['blueprint', 'open', 'editor']
  },
  {
    name: 'compile_blueprint',
    displayName: 'Compile Blueprint',
    description: 'Compile a Blueprint',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true }
    ],
    returnType: 'object',
    tags: ['blueprint', 'compile', 'build']
  },
  {
    name: 'add_blueprint_variable',
    displayName: 'Add Blueprint Variable',
    description: 'Add a variable to a Blueprint',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true },
      { name: 'variable_name', type: 'string', description: 'Name of the variable', required: true },
      { name: 'variable_type', type: 'string', description: 'Type of the variable', required: true },
      { name: 'default_value', type: 'string', description: 'Default value', required: false }
    ],
    returnType: 'boolean',
    tags: ['blueprint', 'variable', 'add']
  },
  {
    name: 'add_blueprint_function',
    displayName: 'Add Blueprint Function',
    description: 'Add a function to a Blueprint',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true },
      { name: 'function_name', type: 'string', description: 'Name of the function', required: true },
      { name: 'return_type', type: 'string', description: 'Return type', required: false }
    ],
    returnType: 'boolean',
    tags: ['blueprint', 'function', 'add']
  },
  {
    name: 'add_blueprint_event',
    displayName: 'Add Blueprint Event',
    description: 'Add an event to a Blueprint',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true },
      { name: 'event_name', type: 'string', description: 'Name of the event', required: true }
    ],
    returnType: 'boolean',
    tags: ['blueprint', 'event', 'add']
  },
  {
    name: 'get_blueprint_variables',
    displayName: 'Get Blueprint Variables',
    description: 'Get all variables in a Blueprint',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true }
    ],
    returnType: 'array',
    tags: ['blueprint', 'variables', 'query']
  },
  {
    name: 'get_blueprint_functions',
    displayName: 'Get Blueprint Functions',
    description: 'Get all functions in a Blueprint',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true }
    ],
    returnType: 'array',
    tags: ['blueprint', 'functions', 'query']
  },
  {
    name: 'add_blueprint_component',
    displayName: 'Add Blueprint Component',
    description: 'Add a component to a Blueprint',
    category: 'blueprint',
    parameters: [
      { name: 'blueprint_path', type: 'string', description: 'Path to the Blueprint', required: true },
      { name: 'component_class', type: 'string', description: 'Component class to add', required: true },
      { name: 'component_name', type: 'string', description: 'Name for the component', required: true }
    ],
    returnType: 'boolean',
    tags: ['blueprint', 'component', 'add']
  },

  // ==================== MATERIAL OPERATIONS (7 tools) ====================
  {
    name: 'create_material',
    displayName: 'Create Material',
    description: 'Create a new material',
    category: 'material',
    parameters: [
      { name: 'material_name', type: 'string', description: 'Name for the material', required: true },
      { name: 'path', type: 'string', description: 'Content browser path', required: true }
    ],
    returnType: 'object',
    tags: ['material', 'create']
  },
  {
    name: 'set_material_parameter',
    displayName: 'Set Material Parameter',
    description: 'Set a parameter value on a material instance',
    category: 'material',
    parameters: [
      { name: 'material_path', type: 'string', description: 'Path to the material', required: true },
      { name: 'parameter_name', type: 'string', description: 'Name of the parameter', required: true },
      { name: 'value', type: 'string', description: 'Value to set', required: true }
    ],
    returnType: 'boolean',
    tags: ['material', 'parameter', 'modify']
  },
  {
    name: 'get_material_parameters',
    displayName: 'Get Material Parameters',
    description: 'Get all parameters of a material',
    category: 'material',
    parameters: [
      { name: 'material_path', type: 'string', description: 'Path to the material', required: true }
    ],
    returnType: 'array',
    tags: ['material', 'parameters', 'query']
  },
  {
    name: 'apply_material_to_actor',
    displayName: 'Apply Material to Actor',
    description: 'Apply a material to an actor',
    category: 'material',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'material_path', type: 'string', description: 'Path to the material', required: true },
      { name: 'slot_index', type: 'number', description: 'Material slot index', required: false, default: 0 }
    ],
    returnType: 'boolean',
    tags: ['material', 'apply', 'actor']
  },
  {
    name: 'create_material_instance',
    displayName: 'Create Material Instance',
    description: 'Create a material instance from a parent material',
    category: 'material',
    parameters: [
      { name: 'parent_material', type: 'string', description: 'Path to parent material', required: true },
      { name: 'instance_name', type: 'string', description: 'Name for the instance', required: true },
      { name: 'path', type: 'string', description: 'Content browser path', required: true }
    ],
    returnType: 'object',
    tags: ['material', 'instance', 'create']
  },
  {
    name: 'set_material_texture',
    displayName: 'Set Material Texture',
    description: 'Set a texture parameter on a material',
    category: 'material',
    parameters: [
      { name: 'material_path', type: 'string', description: 'Path to the material', required: true },
      { name: 'parameter_name', type: 'string', description: 'Texture parameter name', required: true },
      { name: 'texture_path', type: 'string', description: 'Path to the texture', required: true }
    ],
    returnType: 'boolean',
    tags: ['material', 'texture', 'modify']
  },
  {
    name: 'get_actor_materials',
    displayName: 'Get Actor Materials',
    description: 'Get all materials applied to an actor',
    category: 'material',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true }
    ],
    returnType: 'array',
    tags: ['material', 'actor', 'query']
  },

  // ==================== PHYSICS & COLLISION (5 tools) ====================
  {
    name: 'set_simulate_physics',
    displayName: 'Set Simulate Physics',
    description: 'Enable or disable physics simulation on an actor',
    category: 'physics',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'simulate', type: 'boolean', description: 'Enable physics', required: true }
    ],
    returnType: 'boolean',
    tags: ['physics', 'simulate', 'actor']
  },
  {
    name: 'set_collision_enabled',
    displayName: 'Set Collision Enabled',
    description: 'Enable or disable collision on an actor',
    category: 'physics',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'collision_type', type: 'string', description: 'Collision type', required: true, enum: ['NoCollision', 'QueryOnly', 'PhysicsOnly', 'QueryAndPhysics'] }
    ],
    returnType: 'boolean',
    tags: ['collision', 'physics', 'actor']
  },
  {
    name: 'set_collision_profile',
    displayName: 'Set Collision Profile',
    description: 'Set the collision profile on an actor',
    category: 'physics',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'profile_name', type: 'string', description: 'Collision profile name', required: true }
    ],
    returnType: 'boolean',
    tags: ['collision', 'profile', 'actor']
  },
  {
    name: 'apply_force',
    displayName: 'Apply Force',
    description: 'Apply a force to a physics-enabled actor',
    category: 'physics',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'force_x', type: 'number', description: 'Force X component', required: true },
      { name: 'force_y', type: 'number', description: 'Force Y component', required: true },
      { name: 'force_z', type: 'number', description: 'Force Z component', required: true }
    ],
    returnType: 'boolean',
    tags: ['physics', 'force', 'impulse']
  },
  {
    name: 'set_mass',
    displayName: 'Set Mass',
    description: 'Set the mass of a physics-enabled actor',
    category: 'physics',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'mass', type: 'number', description: 'Mass in kg', required: true }
    ],
    returnType: 'boolean',
    tags: ['physics', 'mass', 'weight']
  },

  // ==================== EDITOR UTILITIES (4 tools) ====================
  {
    name: 'execute_console_command',
    displayName: 'Execute Console Command',
    description: 'Execute a console command in the editor',
    category: 'editor',
    parameters: [
      { name: 'command', type: 'string', description: 'Console command to execute', required: true }
    ],
    returnType: 'string',
    tags: ['console', 'command', 'execute']
  },
  {
    name: 'get_editor_world',
    displayName: 'Get Editor World',
    description: 'Get information about the editor world',
    category: 'editor',
    parameters: [],
    returnType: 'object',
    tags: ['editor', 'world', 'info']
  },
  {
    name: 'undo',
    displayName: 'Undo',
    description: 'Undo the last action',
    category: 'editor',
    parameters: [],
    returnType: 'boolean',
    tags: ['undo', 'history']
  },
  {
    name: 'redo',
    displayName: 'Redo',
    description: 'Redo the last undone action',
    category: 'editor',
    parameters: [],
    returnType: 'boolean',
    tags: ['redo', 'history']
  },

  // ==================== COMPONENT OPERATIONS (5 tools) ====================
  {
    name: 'add_component',
    displayName: 'Add Component',
    description: 'Add a component to an actor',
    category: 'component',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'component_class', type: 'string', description: 'Component class to add', required: true },
      { name: 'component_name', type: 'string', description: 'Name for the component', required: false }
    ],
    returnType: 'object',
    tags: ['component', 'add', 'actor']
  },
  {
    name: 'remove_component',
    displayName: 'Remove Component',
    description: 'Remove a component from an actor',
    category: 'component',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'component_name', type: 'string', description: 'Name of the component', required: true }
    ],
    returnType: 'boolean',
    tags: ['component', 'remove', 'actor']
  },
  {
    name: 'get_actor_components',
    displayName: 'Get Actor Components',
    description: 'Get all components of an actor',
    category: 'component',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true }
    ],
    returnType: 'array',
    tags: ['component', 'query', 'actor']
  },
  {
    name: 'set_component_property',
    displayName: 'Set Component Property',
    description: 'Set a property on a component',
    category: 'component',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'component_name', type: 'string', description: 'Name of the component', required: true },
      { name: 'property_name', type: 'string', description: 'Name of the property', required: true },
      { name: 'property_value', type: 'string', description: 'Value to set', required: true }
    ],
    returnType: 'boolean',
    tags: ['component', 'property', 'modify']
  },
  {
    name: 'get_component_property',
    displayName: 'Get Component Property',
    description: 'Get a property value from a component',
    category: 'component',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'component_name', type: 'string', description: 'Name of the component', required: true },
      { name: 'property_name', type: 'string', description: 'Name of the property', required: true }
    ],
    returnType: 'string',
    tags: ['component', 'property', 'query']
  },

  // ==================== ANIMATION & SEQUENCER (8 tools) ====================
  {
    name: 'play_animation',
    displayName: 'Play Animation',
    description: 'Play an animation on a skeletal mesh actor',
    category: 'animation',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'animation_path', type: 'string', description: 'Path to the animation', required: true },
      { name: 'loop', type: 'boolean', description: 'Loop the animation', required: false, default: false }
    ],
    returnType: 'boolean',
    tags: ['animation', 'play', 'skeletal']
  },
  {
    name: 'stop_animation',
    displayName: 'Stop Animation',
    description: 'Stop animation on a skeletal mesh actor',
    category: 'animation',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true }
    ],
    returnType: 'boolean',
    tags: ['animation', 'stop', 'skeletal']
  },
  {
    name: 'create_level_sequence',
    displayName: 'Create Level Sequence',
    description: 'Create a new level sequence',
    category: 'animation',
    parameters: [
      { name: 'sequence_name', type: 'string', description: 'Name for the sequence', required: true },
      { name: 'path', type: 'string', description: 'Content browser path', required: true }
    ],
    returnType: 'object',
    tags: ['sequencer', 'create', 'cinematic']
  },
  {
    name: 'add_actor_to_sequence',
    displayName: 'Add Actor to Sequence',
    description: 'Add an actor to a level sequence',
    category: 'animation',
    parameters: [
      { name: 'sequence_path', type: 'string', description: 'Path to the sequence', required: true },
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true }
    ],
    returnType: 'boolean',
    tags: ['sequencer', 'actor', 'add']
  },
  {
    name: 'play_sequence',
    displayName: 'Play Sequence',
    description: 'Play a level sequence',
    category: 'animation',
    parameters: [
      { name: 'sequence_path', type: 'string', description: 'Path to the sequence', required: true }
    ],
    returnType: 'boolean',
    tags: ['sequencer', 'play', 'cinematic']
  },
  {
    name: 'stop_sequence',
    displayName: 'Stop Sequence',
    description: 'Stop a playing level sequence',
    category: 'animation',
    parameters: [
      { name: 'sequence_path', type: 'string', description: 'Path to the sequence', required: true }
    ],
    returnType: 'boolean',
    tags: ['sequencer', 'stop', 'cinematic']
  },
  {
    name: 'set_sequence_playback_position',
    displayName: 'Set Sequence Playback Position',
    description: 'Set the playback position of a sequence',
    category: 'animation',
    parameters: [
      { name: 'sequence_path', type: 'string', description: 'Path to the sequence', required: true },
      { name: 'time', type: 'number', description: 'Time in seconds', required: true }
    ],
    returnType: 'boolean',
    tags: ['sequencer', 'position', 'time']
  },
  {
    name: 'add_keyframe',
    displayName: 'Add Keyframe',
    description: 'Add a keyframe to a sequence track',
    category: 'animation',
    parameters: [
      { name: 'sequence_path', type: 'string', description: 'Path to the sequence', required: true },
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'property_name', type: 'string', description: 'Property to keyframe', required: true },
      { name: 'time', type: 'number', description: 'Time in seconds', required: true },
      { name: 'value', type: 'string', description: 'Value at keyframe', required: true }
    ],
    returnType: 'boolean',
    tags: ['sequencer', 'keyframe', 'animation']
  },

  // ==================== AUDIO (6 tools) ====================
  {
    name: 'play_sound_at_location',
    displayName: 'Play Sound at Location',
    description: 'Play a sound at a specific location',
    category: 'audio',
    parameters: [
      { name: 'sound_path', type: 'string', description: 'Path to the sound asset', required: true },
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true },
      { name: 'location_z', type: 'number', description: 'Z coordinate', required: true },
      { name: 'volume', type: 'number', description: 'Volume multiplier', required: false, default: 1.0 }
    ],
    returnType: 'boolean',
    tags: ['audio', 'sound', 'play']
  },
  {
    name: 'spawn_audio_component',
    displayName: 'Spawn Audio Component',
    description: 'Add an audio component to an actor',
    category: 'audio',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'sound_path', type: 'string', description: 'Path to the sound asset', required: true },
      { name: 'auto_play', type: 'boolean', description: 'Auto play on spawn', required: false, default: false }
    ],
    returnType: 'object',
    tags: ['audio', 'component', 'spawn']
  },
  {
    name: 'set_audio_volume',
    displayName: 'Set Audio Volume',
    description: 'Set the volume of an audio component',
    category: 'audio',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'component_name', type: 'string', description: 'Name of the audio component', required: true },
      { name: 'volume', type: 'number', description: 'Volume multiplier', required: true }
    ],
    returnType: 'boolean',
    tags: ['audio', 'volume', 'modify']
  },
  {
    name: 'stop_audio',
    displayName: 'Stop Audio',
    description: 'Stop audio playback on an actor',
    category: 'audio',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the actor', required: true },
      { name: 'component_name', type: 'string', description: 'Name of the audio component', required: false }
    ],
    returnType: 'boolean',
    tags: ['audio', 'stop']
  },
  {
    name: 'set_ambient_sound',
    displayName: 'Set Ambient Sound',
    description: 'Configure ambient sound settings',
    category: 'audio',
    parameters: [
      { name: 'actor_name', type: 'string', description: 'Name of the ambient sound actor', required: true },
      { name: 'sound_path', type: 'string', description: 'Path to the sound asset', required: true },
      { name: 'attenuation_radius', type: 'number', description: 'Attenuation radius', required: false }
    ],
    returnType: 'boolean',
    tags: ['audio', 'ambient', 'sound']
  },
  {
    name: 'create_sound_cue',
    displayName: 'Create Sound Cue',
    description: 'Create a new sound cue',
    category: 'audio',
    parameters: [
      { name: 'cue_name', type: 'string', description: 'Name for the sound cue', required: true },
      { name: 'path', type: 'string', description: 'Content browser path', required: true },
      { name: 'sound_waves', type: 'array', description: 'Array of sound wave paths', required: true }
    ],
    returnType: 'object',
    tags: ['audio', 'cue', 'create']
  },

  // ==================== LANDSCAPE & FOLIAGE (6 tools) ====================
  {
    name: 'create_landscape',
    displayName: 'Create Landscape',
    description: 'Create a new landscape',
    category: 'landscape',
    parameters: [
      { name: 'size_x', type: 'number', description: 'Size in X', required: true },
      { name: 'size_y', type: 'number', description: 'Size in Y', required: true },
      { name: 'sections_per_component', type: 'number', description: 'Sections per component', required: false, default: 1 },
      { name: 'quads_per_section', type: 'number', description: 'Quads per section', required: false, default: 63 }
    ],
    returnType: 'object',
    tags: ['landscape', 'terrain', 'create']
  },
  {
    name: 'sculpt_landscape',
    displayName: 'Sculpt Landscape',
    description: 'Sculpt the landscape at a location',
    category: 'landscape',
    parameters: [
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true },
      { name: 'radius', type: 'number', description: 'Brush radius', required: true },
      { name: 'strength', type: 'number', description: 'Brush strength', required: true },
      { name: 'tool', type: 'string', description: 'Sculpt tool', required: false, enum: ['Sculpt', 'Smooth', 'Flatten', 'Erosion', 'Noise'], default: 'Sculpt' }
    ],
    returnType: 'boolean',
    tags: ['landscape', 'sculpt', 'terrain']
  },
  {
    name: 'paint_landscape_layer',
    displayName: 'Paint Landscape Layer',
    description: 'Paint a landscape layer at a location',
    category: 'landscape',
    parameters: [
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true },
      { name: 'layer_name', type: 'string', description: 'Layer to paint', required: true },
      { name: 'radius', type: 'number', description: 'Brush radius', required: true },
      { name: 'strength', type: 'number', description: 'Brush strength', required: true }
    ],
    returnType: 'boolean',
    tags: ['landscape', 'paint', 'layer']
  },
  {
    name: 'add_foliage',
    displayName: 'Add Foliage',
    description: 'Add foliage instances at a location',
    category: 'landscape',
    parameters: [
      { name: 'foliage_type', type: 'string', description: 'Path to foliage type', required: true },
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true },
      { name: 'radius', type: 'number', description: 'Spawn radius', required: false, default: 100 },
      { name: 'density', type: 'number', description: 'Spawn density', required: false, default: 1.0 }
    ],
    returnType: 'number',
    tags: ['foliage', 'vegetation', 'spawn']
  },
  {
    name: 'remove_foliage',
    displayName: 'Remove Foliage',
    description: 'Remove foliage instances at a location',
    category: 'landscape',
    parameters: [
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true },
      { name: 'radius', type: 'number', description: 'Removal radius', required: true },
      { name: 'foliage_type', type: 'string', description: 'Specific foliage type to remove', required: false }
    ],
    returnType: 'number',
    tags: ['foliage', 'vegetation', 'remove']
  },
  {
    name: 'get_landscape_height',
    displayName: 'Get Landscape Height',
    description: 'Get the landscape height at a location',
    category: 'landscape',
    parameters: [
      { name: 'location_x', type: 'number', description: 'X coordinate', required: true },
      { name: 'location_y', type: 'number', description: 'Y coordinate', required: true }
    ],
    returnType: 'number',
    tags: ['landscape', 'height', 'query']
  }
];

// Tool Categories
export const MCP_CATEGORIES: MCPToolCategory[] = [
  {
    id: 'actor',
    name: 'Actor Management',
    icon: 'Box',
    description: 'Create, modify, and manage actors in the level',
    color: '#3B82F6',
    tools: MCP_TOOLS.filter(t => t.category === 'actor')
  },
  {
    id: 'selection',
    name: 'Selection & Focus',
    icon: 'MousePointer',
    description: 'Select actors and focus the viewport',
    color: '#8B5CF6',
    tools: MCP_TOOLS.filter(t => t.category === 'selection')
  },
  {
    id: 'viewport',
    name: 'Viewport & Camera',
    icon: 'Camera',
    description: 'Control viewport camera and rendering',
    color: '#EC4899',
    tools: MCP_TOOLS.filter(t => t.category === 'viewport')
  },
  {
    id: 'level',
    name: 'Level Management',
    icon: 'Map',
    description: 'Open, save, and manage levels',
    color: '#F59E0B',
    tools: MCP_TOOLS.filter(t => t.category === 'level')
  },
  {
    id: 'pie',
    name: 'Play in Editor',
    icon: 'Play',
    description: 'Control Play in Editor sessions',
    color: '#10B981',
    tools: MCP_TOOLS.filter(t => t.category === 'pie')
  },
  {
    id: 'asset',
    name: 'Asset Management',
    icon: 'FolderOpen',
    description: 'Import, export, and manage assets',
    color: '#6366F1',
    tools: MCP_TOOLS.filter(t => t.category === 'asset')
  },
  {
    id: 'blueprint',
    name: 'Blueprint Operations',
    icon: 'GitBranch',
    description: 'Create and modify Blueprints',
    color: '#0EA5E9',
    tools: MCP_TOOLS.filter(t => t.category === 'blueprint')
  },
  {
    id: 'material',
    name: 'Material Operations',
    icon: 'Palette',
    description: 'Create and apply materials',
    color: '#F97316',
    tools: MCP_TOOLS.filter(t => t.category === 'material')
  },
  {
    id: 'physics',
    name: 'Physics & Collision',
    icon: 'Zap',
    description: 'Configure physics and collision',
    color: '#EF4444',
    tools: MCP_TOOLS.filter(t => t.category === 'physics')
  },
  {
    id: 'editor',
    name: 'Editor Utilities',
    icon: 'Settings',
    description: 'Editor commands and utilities',
    color: '#64748B',
    tools: MCP_TOOLS.filter(t => t.category === 'editor')
  },
  {
    id: 'component',
    name: 'Component Operations',
    icon: 'Puzzle',
    description: 'Add and modify actor components',
    color: '#14B8A6',
    tools: MCP_TOOLS.filter(t => t.category === 'component')
  },
  {
    id: 'animation',
    name: 'Animation & Sequencer',
    icon: 'Film',
    description: 'Control animations and sequences',
    color: '#A855F7',
    tools: MCP_TOOLS.filter(t => t.category === 'animation')
  },
  {
    id: 'audio',
    name: 'Audio',
    icon: 'Volume2',
    description: 'Play and manage audio',
    color: '#22C55E',
    tools: MCP_TOOLS.filter(t => t.category === 'audio')
  },
  {
    id: 'landscape',
    name: 'Landscape & Foliage',
    icon: 'Mountain',
    description: 'Create and sculpt landscapes',
    color: '#84CC16',
    tools: MCP_TOOLS.filter(t => t.category === 'landscape')
  }
];

// Quick action presets
export const QUICK_ACTIONS = [
  {
    id: 'spawn_cube',
    name: 'Spawn Cube',
    description: 'Spawn a cube at the origin',
    tool: 'spawn_actor',
    params: { class_name: 'StaticMeshActor', location_x: 0, location_y: 0, location_z: 100 },
    icon: 'Box'
  },
  {
    id: 'take_screenshot',
    name: 'Take Screenshot',
    description: 'Capture the current viewport',
    tool: 'take_screenshot',
    params: { filename: 'screenshot.png' },
    icon: 'Camera'
  },
  {
    id: 'play_game',
    name: 'Play Game',
    description: 'Start Play in Editor',
    tool: 'play_in_editor',
    params: { mode: 'SelectedViewport' },
    icon: 'Play'
  },
  {
    id: 'stop_game',
    name: 'Stop Game',
    description: 'Stop Play in Editor',
    tool: 'stop_play_in_editor',
    params: {},
    icon: 'Square'
  },
  {
    id: 'save_level',
    name: 'Save Level',
    description: 'Save the current level',
    tool: 'save_current_level',
    params: {},
    icon: 'Save'
  },
  {
    id: 'undo',
    name: 'Undo',
    description: 'Undo last action',
    tool: 'undo',
    params: {},
    icon: 'Undo'
  },
  {
    id: 'redo',
    name: 'Redo',
    description: 'Redo last action',
    tool: 'redo',
    params: {},
    icon: 'Redo'
  },
  {
    id: 'deselect',
    name: 'Deselect All',
    description: 'Clear selection',
    tool: 'deselect_all',
    params: {},
    icon: 'X'
  }
];

export default MCP_TOOLS;
