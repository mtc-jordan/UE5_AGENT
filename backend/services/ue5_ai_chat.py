"""
UE5 AI Chat Service - Natural Language to MCP Tool Execution

This service implements AI-powered chat that converts natural language commands
into MCP tool calls for controlling Unreal Engine 5.

Architecture:
- Uses OpenAI-compatible API with function calling
- Supports streaming responses for real-time feedback
- Maintains conversation context for multi-turn interactions
- Executes MCP tools through the agent relay system

Best Practices Applied:
- Clear tool descriptions with examples
- Strict JSON schema for parameters
- System prompt with UE5 context
- Error handling with informative messages
"""

import json
import logging
import asyncio
import os
from typing import AsyncGenerator, Optional, List, Dict, Any
from openai import AsyncOpenAI
from dataclasses import dataclass
from enum import Enum

# Import API key management from settings
from api.api_keys import get_api_key

logger = logging.getLogger(__name__)


class ToolCategory(str, Enum):
    ACTOR = "actor"
    SELECTION = "selection"
    VIEWPORT = "viewport"
    PIE = "pie"
    LEVEL = "level"
    BLUEPRINT = "blueprint"
    MATERIAL = "material"
    PHYSICS = "physics"
    ANIMATION = "animation"
    AUDIO = "audio"
    ASSET = "asset"
    COMPONENT = "component"
    EDITOR = "editor"
    LANDSCAPE = "landscape"
    BOOKMARK = "bookmark"


@dataclass
class ToolCall:
    """Represents a tool call from the AI model"""
    id: str
    name: str
    arguments: Dict[str, Any]


@dataclass
class ChatMessage:
    """Represents a chat message"""
    role: str  # 'user', 'assistant', 'system', 'tool'
    content: str
    tool_calls: Optional[List[ToolCall]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


# System prompt for UE5 AI Assistant
UE5_SYSTEM_PROMPT = """You are an AI assistant that helps users control Unreal Engine 5 through natural language commands.

## Your Capabilities
You have access to 101 MCP (Model Context Protocol) tools that can control various aspects of UE5:

### Actor Management
- spawn_actor: Create new actors (cubes, spheres, lights, cameras, etc.)
- delete_actor: Remove actors from the level
- set_actor_property: Modify actor location, rotation, scale, or other properties
- get_actor_properties: Query actor information
- duplicate_actor: Clone existing actors
- rename_actor: Change actor names
- set_actor_visibility: Show/hide actors
- find_actors_by_tag: Search actors by tags

### Selection & Focus
- select_actor: Select an actor by name
- get_selected_actors: Get currently selected actors
- deselect_all: Clear selection
- focus_on_actor: Focus viewport on an actor

### Viewport & Camera
- set_viewport_camera: Set camera position and rotation
- get_viewport_camera: Get current camera state
- take_screenshot: Capture viewport image
- set_viewport_mode: Change viewport rendering mode

### Play in Editor (PIE)
- start_pie: Start playing the game in editor
- stop_pie: Stop the game

### Level Management
- save_current_level: Save the current level
- open_level: Open a different level
- get_current_level: Get current level info

### Blueprint Operations
- create_blueprint: Create new blueprints
- open_blueprint: Open blueprint editor
- compile_blueprint: Compile a blueprint
- add_blueprint_component: Add components to blueprints

### Material Operations
- create_material: Create new materials
- apply_material_to_actor: Apply material to an actor
- set_material_parameter: Modify material parameters

### Physics & Collision
- set_simulate_physics: Enable/disable physics simulation
- set_collision_enabled: Enable/disable collision
- apply_force: Apply physics force to an actor

### Animation & Audio
- play_animation: Play animations on actors
- play_sound_at_location: Play sounds in 3D space

## Guidelines
1. When the user asks to perform an action, identify the appropriate tool(s)
2. Extract parameters from the user's request (locations, names, values)
3. If information is missing, ask for clarification or use sensible defaults
4. After executing tools, summarize what was done
5. For complex tasks, break them into multiple tool calls
6. Be helpful and explain what you're doing

## Common Patterns
- "Create a cube at 0,0,100" → spawn_actor with class_name="StaticMeshActor", location
- "Move the cube to 500,0,0" → set_actor_property with property="location"
- "Start the game" → start_pie
- "Take a screenshot" → take_screenshot
- "Select all actors" → This requires multiple select_actor calls or get_actor_list first

## Important Notes
- Locations use UE5 coordinate system (X=forward, Y=right, Z=up)
- Rotations are in degrees (pitch, yaw, roll)
- Actor names are case-sensitive
- Always confirm destructive actions before executing
"""


# MCP Tools as OpenAI Function Definitions
MCP_TOOLS_DEFINITIONS = [
    # Actor Management
    {
        "type": "function",
        "function": {
            "name": "spawn_actor",
            "description": "Spawn a new actor in the level at the specified location. Use this to create cubes, spheres, lights, cameras, and other objects.",
            "parameters": {
                "type": "object",
                "properties": {
                    "class_name": {
                        "type": "string",
                        "description": "The actor class to spawn. Common values: StaticMeshActor (for shapes), PointLight, SpotLight, DirectionalLight, CameraActor, PlayerStart",
                        "enum": ["StaticMeshActor", "PointLight", "SpotLight", "DirectionalLight", "CameraActor", "PlayerStart", "TriggerBox", "Character", "Pawn"]
                    },
                    "location_x": {
                        "type": "number",
                        "description": "X coordinate (forward/backward axis)"
                    },
                    "location_y": {
                        "type": "number",
                        "description": "Y coordinate (left/right axis)"
                    },
                    "location_z": {
                        "type": "number",
                        "description": "Z coordinate (up/down axis)"
                    },
                    "rotation_pitch": {
                        "type": "number",
                        "description": "Pitch rotation in degrees (default: 0)"
                    },
                    "rotation_yaw": {
                        "type": "number",
                        "description": "Yaw rotation in degrees (default: 0)"
                    },
                    "rotation_roll": {
                        "type": "number",
                        "description": "Roll rotation in degrees (default: 0)"
                    }
                },
                "required": ["class_name", "location_x", "location_y", "location_z"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_actor",
            "description": "Delete an actor from the level by its name",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "The name of the actor to delete"
                    }
                },
                "required": ["actor_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_actor_property",
            "description": "Set an actor's location, rotation, or scale",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "The name of the actor to modify"
                    },
                    "property": {
                        "type": "string",
                        "description": "The property to set",
                        "enum": ["location", "rotation", "scale"]
                    },
                    "x": {
                        "type": "number",
                        "description": "X value"
                    },
                    "y": {
                        "type": "number",
                        "description": "Y value"
                    },
                    "z": {
                        "type": "number",
                        "description": "Z value"
                    }
                },
                "required": ["actor_name", "property", "x", "y", "z"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_actor_properties",
            "description": "Get the properties (location, rotation, scale) of an actor",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "The name of the actor to query"
                    }
                },
                "required": ["actor_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_actor_list",
            "description": "Get a list of all actors in the current level",
            "parameters": {
                "type": "object",
                "properties": {
                    "class_filter": {
                        "type": "string",
                        "description": "Optional filter by actor class"
                    },
                    "name_filter": {
                        "type": "string",
                        "description": "Optional filter by actor name (partial match)"
                    }
                },
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "duplicate_actor",
            "description": "Create a duplicate copy of an existing actor",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "The name of the actor to duplicate"
                    },
                    "offset_x": {
                        "type": "number",
                        "description": "X offset from original position (default: 100)"
                    },
                    "offset_y": {
                        "type": "number",
                        "description": "Y offset from original position (default: 0)"
                    },
                    "offset_z": {
                        "type": "number",
                        "description": "Z offset from original position (default: 0)"
                    }
                },
                "required": ["actor_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "rename_actor",
            "description": "Rename an actor in the level",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "Current name of the actor"
                    },
                    "new_name": {
                        "type": "string",
                        "description": "New name for the actor"
                    }
                },
                "required": ["actor_name", "new_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_actor_visibility",
            "description": "Show or hide an actor in the level",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "Name of the actor"
                    },
                    "visible": {
                        "type": "boolean",
                        "description": "True to show, False to hide"
                    }
                },
                "required": ["actor_name", "visible"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Selection & Focus
    {
        "type": "function",
        "function": {
            "name": "select_actor",
            "description": "Select an actor in the editor by name",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "Name of the actor to select"
                    }
                },
                "required": ["actor_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_selected_actors",
            "description": "Get the list of currently selected actors",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "deselect_all",
            "description": "Clear the current selection (deselect all actors)",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "focus_on_actor",
            "description": "Focus the viewport camera on a specific actor",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "Name of the actor to focus on"
                    }
                },
                "required": ["actor_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Viewport & Camera
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Take a screenshot of the current viewport",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Filename for the screenshot (default: auto-generated)"
                    }
                },
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_viewport_camera",
            "description": "Set the viewport camera position and rotation",
            "parameters": {
                "type": "object",
                "properties": {
                    "location_x": {"type": "number", "description": "Camera X position"},
                    "location_y": {"type": "number", "description": "Camera Y position"},
                    "location_z": {"type": "number", "description": "Camera Z position"},
                    "rotation_pitch": {"type": "number", "description": "Camera pitch in degrees"},
                    "rotation_yaw": {"type": "number", "description": "Camera yaw in degrees"},
                    "rotation_roll": {"type": "number", "description": "Camera roll in degrees"}
                },
                "required": ["location_x", "location_y", "location_z"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_viewport_camera",
            "description": "Get the current viewport camera position and rotation",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Play in Editor
    {
        "type": "function",
        "function": {
            "name": "start_pie",
            "description": "Start Play In Editor (PIE) - begins playing the game in the editor",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "stop_pie",
            "description": "Stop Play In Editor (PIE) - stops the game",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Level Management
    {
        "type": "function",
        "function": {
            "name": "save_current_level",
            "description": "Save the current level",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_level",
            "description": "Open a level by name or path",
            "parameters": {
                "type": "object",
                "properties": {
                    "level_name": {
                        "type": "string",
                        "description": "Name or path of the level to open"
                    }
                },
                "required": ["level_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_level",
            "description": "Get information about the current level",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_project_info",
            "description": "Get information about the current UE5 project",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Blueprint Operations
    {
        "type": "function",
        "function": {
            "name": "create_blueprint",
            "description": "Create a new Blueprint class",
            "parameters": {
                "type": "object",
                "properties": {
                    "blueprint_name": {
                        "type": "string",
                        "description": "Name for the new Blueprint"
                    },
                    "parent_class": {
                        "type": "string",
                        "description": "Parent class (default: Actor)"
                    }
                },
                "required": ["blueprint_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_blueprint",
            "description": "Open a Blueprint in the editor",
            "parameters": {
                "type": "object",
                "properties": {
                    "blueprint_name": {
                        "type": "string",
                        "description": "Name of the Blueprint to open"
                    }
                },
                "required": ["blueprint_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compile_blueprint",
            "description": "Compile a Blueprint",
            "parameters": {
                "type": "object",
                "properties": {
                    "blueprint_name": {
                        "type": "string",
                        "description": "Name of the Blueprint to compile"
                    }
                },
                "required": ["blueprint_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Material Operations
    {
        "type": "function",
        "function": {
            "name": "create_material",
            "description": "Create a new material",
            "parameters": {
                "type": "object",
                "properties": {
                    "material_name": {
                        "type": "string",
                        "description": "Name for the new material"
                    }
                },
                "required": ["material_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "apply_material_to_actor",
            "description": "Apply a material to an actor",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "Name of the actor"
                    },
                    "material_name": {
                        "type": "string",
                        "description": "Name or path of the material to apply"
                    }
                },
                "required": ["actor_name", "material_name"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Physics
    {
        "type": "function",
        "function": {
            "name": "set_simulate_physics",
            "description": "Enable or disable physics simulation on an actor",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "Name of the actor"
                    },
                    "enable": {
                        "type": "boolean",
                        "description": "True to enable physics, False to disable"
                    }
                },
                "required": ["actor_name", "enable"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_collision_enabled",
            "description": "Enable or disable collision on an actor",
            "parameters": {
                "type": "object",
                "properties": {
                    "actor_name": {
                        "type": "string",
                        "description": "Name of the actor"
                    },
                    "enable": {
                        "type": "boolean",
                        "description": "True to enable collision, False to disable"
                    }
                },
                "required": ["actor_name", "enable"],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    # Editor Utilities
    {
        "type": "function",
        "function": {
            "name": "undo",
            "description": "Undo the last action in the editor",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "redo",
            "description": "Redo the last undone action in the editor",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False
            },
            "strict": True
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_console_command",
            "description": "Execute a console command in UE5",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The console command to execute"
                    }
                },
                "required": ["command"],
                "additionalProperties": False
            },
            "strict": True
        }
    }
]


class UE5AIChatService:
    """
    AI Chat Service for UE5 control via natural language.
    
    Uses OpenAI-compatible API with function calling to convert
    natural language commands into MCP tool calls.
    Supports multiple AI providers: OpenAI, DeepSeek, Google Gemini.
    """
    
    def __init__(self):
        self.model = "gpt-4.1-mini"  # Default model for function calling
        self.tools = MCP_TOOLS_DEFINITIONS
        self.system_prompt = UE5_SYSTEM_PROMPT
        
        # Model to provider mapping
        self.model_providers = {
            "deepseek-chat": "deepseek",
            "deepseek-reasoner": "deepseek",
            "gpt-4.1-mini": "openai",
            "gpt-4.1-nano": "openai",
            "gpt-4o": "openai",
            "gpt-4o-mini": "openai",
            "gemini-2.5-flash": "google",
            "gemini-2.5-flash-lite": "google",
            "gemini-2.5-pro": "google",
            "gemini-2.0-flash": "google",
            "claude-3-5-sonnet": "anthropic",
            "claude-3-opus": "anthropic",
            "claude-3-haiku": "anthropic",
        }
        
        # Provider base URLs
        self.provider_base_urls = {
            "openai": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            "deepseek": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
            "google": os.getenv("GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"),
            "anthropic": os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1"),
        }
        
        # Cache for clients (created on demand)
        self._clients: Dict[str, AsyncOpenAI] = {}
    
    def _get_client_for_model(self, model: str) -> AsyncOpenAI:
        """
        Get the appropriate client for the given model.
        Uses API keys from Settings page configuration.
        """
        provider = self.model_providers.get(model, "openai")
        logger.info(f"Model selection: model='{model}' -> provider='{provider}'")
        logger.info(f"Available model mappings: {list(self.model_providers.keys())}")
        
        # Check if we already have a client for this provider
        if provider in self._clients:
            return self._clients[provider]
        
        # Get API key from Settings (stored in .api_keys.json) or environment
        api_key = get_api_key(provider)
        
        if not api_key:
            logger.warning(f"No API key found for provider {provider}, falling back to default OpenAI")
            # Fall back to default OpenAI client
            if "openai" not in self._clients:
                self._clients["openai"] = AsyncOpenAI()
            return self._clients["openai"]
        
        logger.info(f"Found API key for provider {provider}: {api_key[:10]}...{api_key[-4:]}")
        
        # Create client with the appropriate base URL and API key
        base_url = self.provider_base_urls.get(provider)
        
        # Special handling for Anthropic (doesn't use OpenAI-compatible API for tool calling)
        # For now, we'll use OpenAI-compatible providers only
        if provider == "anthropic":
            logger.warning(f"Anthropic models don't support OpenAI-compatible tool calling, falling back to OpenAI")
            if "openai" not in self._clients:
                openai_key = get_api_key("openai")
                self._clients["openai"] = AsyncOpenAI(api_key=openai_key) if openai_key else AsyncOpenAI()
            return self._clients["openai"]
        
        # Create and cache the client
        self._clients[provider] = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        logger.info(f"Created new client for provider {provider} with base URL {base_url}")
        return self._clients[provider]
    
    async def chat(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        execute_tools: bool = True,
        tool_executor: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Process a chat message and optionally execute tool calls.
        
        Args:
            messages: List of chat messages (user, assistant, tool)
            model: Optional model override (uses default if not specified)
            execute_tools: Whether to automatically execute tool calls
            tool_executor: Async function to execute MCP tools
            
        Returns:
            Dict with response content, tool_calls, and execution results
        """
        # Determine which model to use
        model_to_use = model or self.model
        
        # Get the appropriate client for this model
        client = self._get_client_for_model(model_to_use)
        
        # Prepare messages with system prompt
        full_messages = [
            {"role": "system", "content": self.system_prompt}
        ] + messages
        
        try:
            # Call the AI model with tools
            response = await client.chat.completions.create(
                model=model_to_use,
                messages=full_messages,
                tools=self.tools,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=2048
            )
            
            message = response.choices[0].message
            
            result = {
                "content": message.content or "",
                "tool_calls": [],
                "tool_results": [],
                "finish_reason": response.choices[0].finish_reason
            }
            
            # Process tool calls if present
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    tc = {
                        "id": tool_call.id,
                        "name": tool_call.function.name,
                        "arguments": json.loads(tool_call.function.arguments)
                    }
                    result["tool_calls"].append(tc)
                    
                    # Execute the tool if requested
                    if execute_tools and tool_executor:
                        try:
                            tool_result = await tool_executor(
                                tc["name"],
                                tc["arguments"]
                            )
                            result["tool_results"].append({
                                "tool_call_id": tc["id"],
                                "tool_name": tc["name"],
                                "result": tool_result,
                                "success": True
                            })
                        except Exception as e:
                            result["tool_results"].append({
                                "tool_call_id": tc["id"],
                                "tool_name": tc["name"],
                                "error": str(e),
                                "success": False
                            })
            
            return result
            
        except Exception as e:
            logger.error(f"AI chat error: {e}")
            return {
                "content": f"I encountered an error: {str(e)}",
                "tool_calls": [],
                "tool_results": [],
                "error": str(e)
            }
    
    async def chat_stream(
        self,
        messages: List[Dict[str, Any]],
        tool_executor: Optional[callable] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream chat response with tool execution.
        
        Yields chunks of the response as they arrive, including
        tool calls and their results.
        """
        full_messages = [
            {"role": "system", "content": self.system_prompt}
        ] + messages
        
        try:
            # First, get tool calls (non-streaming for reliability)
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                tools=self.tools,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=2048
            )
            
            message = response.choices[0].message
            
            # If there are tool calls, execute them
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    tc = {
                        "id": tool_call.id,
                        "name": tool_call.function.name,
                        "arguments": json.loads(tool_call.function.arguments)
                    }
                    
                    # Yield tool call info
                    yield {
                        "type": "tool_call",
                        "tool_call": tc
                    }
                    
                    # Execute the tool
                    if tool_executor:
                        try:
                            tool_result = await tool_executor(
                                tc["name"],
                                tc["arguments"]
                            )
                            yield {
                                "type": "tool_result",
                                "tool_call_id": tc["id"],
                                "tool_name": tc["name"],
                                "result": tool_result,
                                "success": True
                            }
                            
                            # Add tool result to messages for follow-up
                            full_messages.append({
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [{
                                    "id": tc["id"],
                                    "type": "function",
                                    "function": {
                                        "name": tc["name"],
                                        "arguments": json.dumps(tc["arguments"])
                                    }
                                }]
                            })
                            full_messages.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": json.dumps(tool_result)
                            })
                            
                        except Exception as e:
                            yield {
                                "type": "tool_result",
                                "tool_call_id": tc["id"],
                                "tool_name": tc["name"],
                                "error": str(e),
                                "success": False
                            }
                
                # Get follow-up response after tool execution
                follow_up = await self.client.chat.completions.create(
                    model=self.model,
                    messages=full_messages,
                    temperature=0.7,
                    max_tokens=1024,
                    stream=True
                )
                
                async for chunk in follow_up:
                    if chunk.choices[0].delta.content:
                        yield {
                            "type": "content",
                            "content": chunk.choices[0].delta.content
                        }
            else:
                # No tool calls, just stream the content
                if message.content:
                    yield {
                        "type": "content",
                        "content": message.content
                    }
            
            yield {"type": "done"}
            
        except Exception as e:
            logger.error(f"AI chat stream error: {e}")
            yield {
                "type": "error",
                "error": str(e)
            }
    
    async def get_tool_suggestion(self, partial_command: str) -> List[Dict[str, Any]]:
        """
        Get AI-powered suggestions for partial commands.
        """
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a UE5 command assistant. Given a partial command, suggest 3-5 complete commands the user might want. Return only a JSON array of strings."},
                    {"role": "user", "content": f"Suggest completions for: {partial_command}"}
                ],
                temperature=0.5,
                max_tokens=256
            )
            
            content = response.choices[0].message.content
            # Try to parse as JSON
            try:
                suggestions = json.loads(content)
                if isinstance(suggestions, list):
                    return suggestions[:5]
            except:
                pass
            
            return []
            
        except Exception as e:
            logger.error(f"Suggestion error: {e}")
            return []


# Singleton instance
_ue5_ai_chat_service = None


def get_ue5_ai_chat_service() -> UE5AIChatService:
    """Get or create the UE5 AI Chat service singleton."""
    global _ue5_ai_chat_service
    if _ue5_ai_chat_service is None:
        _ue5_ai_chat_service = UE5AIChatService()
    return _ue5_ai_chat_service
