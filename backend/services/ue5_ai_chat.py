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

# Import native AI clients
from services.native_ai_clients import NativeAIClientFactory, BaseAIClient

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
        
        # Model to provider mapping - Updated December 2025
        self.model_providers = {
            # DeepSeek Models
            "deepseek-chat": "deepseek",
            "deepseek-reasoner": "deepseek",
            
            # Google Gemini Models
            "gemini-3-pro": "google",
            "gemini-3-flash": "google",
            "gemini-2.5-pro": "google",
            "gemini-2.5-flash": "google",
            "gemini-2.5-flash-lite": "google",
            "gemini-2.0-flash": "google",
            
            # OpenAI Models
            "gpt-5": "openai",
            "gpt-5-mini": "openai",
            "gpt-4o": "openai",
            "gpt-4o-mini": "openai",
            "gpt-4.1-mini": "openai",
            "gpt-4.1-nano": "openai",
            
            # Anthropic Claude Models
            "claude-4-sonnet": "anthropic",
            "claude-4-opus": "anthropic",
            "claude-4-haiku": "anthropic",
            "claude-3-5-sonnet": "anthropic",
            "claude-3-opus": "anthropic",
            "claude-3-haiku": "anthropic",
            
            # Open-Source Models (via Ollama or compatible API)
            "llama-3-405b": "ollama",
            "llama-3-70b": "ollama",
            "llama-3-8b": "ollama",
            "qwen3-coder-480b": "ollama",
            "mistral-7b": "ollama",
            "mistral-8x7b": "ollama",
            "mistral-devstral-24b": "ollama",
        }
        
        # Provider base URLs
        self.provider_base_urls = {
            "openai": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            "deepseek": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
            "google": os.getenv("GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"),
            "anthropic": os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1"),
            "ollama": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        }
        
        # Cache for clients (created on demand)
        self._clients: Dict[str, AsyncOpenAI] = {}
        
        # Model ID to actual API model name mapping
        # Updated December 2025 based on official API documentation
        self.model_api_names = {
            # DeepSeek Models - API uses these exact names (verified Dec 2025)
            # https://api-docs.deepseek.com/quick_start/pricing
            "deepseek-chat": "deepseek-chat",  # DeepSeek-V3
            "deepseek-reasoner": "deepseek-reasoner",  # DeepSeek-R1
            
            # Google Gemini Models - Native API format (verified Dec 2025)
            # https://ai.google.dev/gemini-api/docs/models
            "gemini-3-pro": "gemini-2.5-pro",  # Gemini 3 Pro not yet available
            "gemini-3-flash": "gemini-2.5-flash",  # Gemini 3 Flash not yet available
            "gemini-2.5-pro": "gemini-2.5-pro",  # Stable
            "gemini-2.5-flash": "gemini-2.5-flash",  # Stable - recommended
            "gemini-2.0-flash": "gemini-2.0-flash",  # Previous gen stable
            
            # OpenAI Models - API format
            "gpt-5": "gpt-4o",  # GPT-5 not yet available, use GPT-4o
            "gpt-5-mini": "gpt-4o-mini",
            "gpt-4o": "gpt-4o",
            "gpt-4o-mini": "gpt-4o-mini",
            "gpt-4.1-mini": "gpt-4.1-mini",
            "gpt-4.1-nano": "gpt-4.1-nano",
            
            # Anthropic Claude Models - API format (verified Dec 2025)
            # https://platform.claude.com/docs/en/about-claude/models/overview
            "claude-4-sonnet": "claude-sonnet-4-5-20250929",  # Claude Sonnet 4.5
            "claude-4-opus": "claude-opus-4-5-20251101",  # Claude Opus 4.5
            "claude-4-haiku": "claude-haiku-4-5-20251001",  # Claude Haiku 4.5
            "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",  # Legacy
            "claude-3-opus": "claude-3-opus-20240229",  # Legacy
        }
    
    def _get_native_client(self, model: str) -> tuple[Optional[BaseAIClient], str, str]:
        """
        Get the native AI client for the given model.
        Uses native SDKs for each provider (OpenAI, Anthropic, Google, DeepSeek).
        
        Returns:
            Tuple of (client, api_model_name, provider)
        """
        # Get provider and API model name for the requested model
        provider = self.model_providers.get(model, "openai")
        api_model_name = self.model_api_names.get(model, model)
        
        logger.info(f"=== Native Model Routing ===")
        logger.info(f"  Requested model: '{model}'")
        logger.info(f"  Provider: '{provider}'")
        logger.info(f"  API model name: '{api_model_name}'")
        
        # Get native client from factory
        client = NativeAIClientFactory.get_client(provider)
        
        if client:
            logger.info(f"  Native {provider} client ready")
            return client, api_model_name, provider
        
        # Fallback to OpenAI if provider client not available
        logger.warning(f"No API key for {provider}, falling back to OpenAI")
        fallback_client = NativeAIClientFactory.get_client("openai")
        
        if fallback_client:
            return fallback_client, "gpt-4.1-mini", "openai"
        
        logger.error("No AI provider available - please configure API keys in Settings")
        return None, api_model_name, provider
    
    async def chat(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        execute_tools: bool = True,
        tool_executor: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Process a chat message and optionally execute tool calls.
        Uses native API clients for each provider.
        
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
        
        # Get the native client for this model
        client, api_model_name, provider = self._get_native_client(model_to_use)
        
        if not client:
            return {
                "content": "No AI provider available. Please configure API keys in Settings.",
                "tool_calls": [],
                "tool_results": [],
                "error": "no_api_key",
                "error_type": "configuration_error"
            }
        
        logger.info(f"Using native {provider} client for model '{model_to_use}' -> '{api_model_name}'")
        
        try:
            # Call the native client with tools
            response = await client.chat_with_tools(
                messages=messages,
                tools=self.tools,
                model=api_model_name,
                system_prompt=self.system_prompt
            )
            
            result = {
                "content": response.get("content", ""),
                "tool_calls": response.get("tool_calls", []),
                "tool_results": [],
                "finish_reason": response.get("finish_reason", "stop"),
                "provider": provider,
                "model": api_model_name
            }
            
            # Execute tool calls if present and requested
            if result["tool_calls"] and execute_tools and tool_executor:
                for tc in result["tool_calls"]:
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
            error_msg = str(e)
            logger.error(f"AI chat error ({provider}): {e}")
            
            # Provide more helpful error messages based on error type
            if "401" in error_msg or "Unauthorized" in error_msg or "invalid_api_key" in error_msg.lower() or "authentication" in error_msg.lower():
                user_message = f"API key error for {provider}: Please check your API key in Settings. The key may be invalid or expired."
            elif "404" in error_msg or "model_not_found" in error_msg.lower() or "not found" in error_msg.lower():
                user_message = f"Model '{api_model_name}' not found. This model may not be available yet or the name may have changed."
            elif "429" in error_msg or "rate_limit" in error_msg.lower():
                user_message = "Rate limit exceeded. Please wait a moment before trying again."
            elif "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                user_message = "Request timed out. The AI service may be experiencing high load. Please try again."
            elif "connection" in error_msg.lower() or "network" in error_msg.lower():
                user_message = "Connection error. Please check your internet connection and try again."
            else:
                user_message = f"Error from {provider}: {error_msg}"
            
            return {
                "content": user_message,
                "tool_calls": [],
                "tool_results": [],
                "error": error_msg,
                "error_type": "api_error",
                "model_used": model_to_use,
                "api_model": api_model_name,
                "provider": provider
            }
    
    async def chat_stream(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        tool_executor: Optional[callable] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream chat response with tool execution.
        Uses native API clients for each provider.
        
        Yields chunks of the response as they arrive, including
        tool calls and their results.
        """
        model_to_use = model or self.model
        client, api_model_name, provider = self._get_native_client(model_to_use)
        
        if not client:
            yield {
                "type": "error",
                "error": "No AI provider available. Please configure API keys in Settings."
            }
            return
        
        logger.info(f"Streaming with native {provider} client: {api_model_name}")
        
        try:
            # Get response with tool calls using native client
            response = await client.chat_with_tools(
                messages=messages,
                tools=self.tools,
                model=api_model_name,
                system_prompt=self.system_prompt
            )
            
            # If there are tool calls, execute them
            if response.get("tool_calls"):
                for tc in response["tool_calls"]:
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
                            
                        except Exception as e:
                            yield {
                                "type": "tool_result",
                                "tool_call_id": tc["id"],
                                "tool_name": tc["name"],
                                "error": str(e),
                                "success": False
                            }
            
            # Yield the content
            if response.get("content"):
                yield {
                    "type": "content",
                    "content": response["content"]
                }
            
            yield {"type": "done", "provider": provider, "model": api_model_name}
            
        except Exception as e:
            logger.error(f"AI chat stream error ({provider}): {e}")
            yield {
                "type": "error",
                "error": str(e),
                "provider": provider
            }
    
    async def get_tool_suggestion(self, partial_command: str, model: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get AI-powered suggestions for partial commands.
        Uses native client for the selected model.
        """
        model_to_use = model or self.model
        client, api_model_name, provider = self._get_native_client(model_to_use)
        
        if not client:
            return []
        
        try:
            # Use the native client for suggestions
            response = await client.chat_with_tools(
                messages=[{"role": "user", "content": f"Suggest completions for: {partial_command}"}],
                tools=[],  # No tools for suggestions
                model=api_model_name,
                system_prompt="You are a UE5 command assistant. Given a partial command, suggest 3-5 complete commands the user might want. Return only a JSON array of strings."
            )
            
            content = response.get("content", "")
            # Try to parse as JSON
            try:
                suggestions = json.loads(content)
                if isinstance(suggestions, list):
                    return suggestions[:5]
            except:
                pass
            
            return []
            
        except Exception as e:
            logger.error(f"Suggestion error ({provider}): {e}")
            return []


# Singleton instance
_ue5_ai_chat_service = None


def get_ue5_ai_chat_service() -> UE5AIChatService:
    """Get or create the UE5 AI Chat service singleton."""
    global _ue5_ai_chat_service
    if _ue5_ai_chat_service is None:
        _ue5_ai_chat_service = UE5AIChatService()
    return _ue5_ai_chat_service
