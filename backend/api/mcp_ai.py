"""
MCP AI Command API - Natural language interface for UE5 control
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import re
import httpx

from core.config import settings

router = APIRouter(prefix="/mcp", tags=["MCP AI"])

# Tool mapping for AI command parsing
TOOL_KEYWORDS = {
    # Actor operations
    "spawn": {"tool": "spawn_actor", "params": ["class_name", "location", "rotation"]},
    "create actor": {"tool": "spawn_actor", "params": ["class_name", "location", "rotation"]},
    "delete": {"tool": "delete_actor", "params": ["actor_name"]},
    "remove": {"tool": "delete_actor", "params": ["actor_name"]},
    "move": {"tool": "set_actor_transform", "params": ["actor_name", "location"]},
    "rotate": {"tool": "set_actor_transform", "params": ["actor_name", "rotation"]},
    "scale": {"tool": "set_actor_transform", "params": ["actor_name", "scale"]},
    "rename": {"tool": "rename_actor", "params": ["actor_name", "new_name"]},
    "duplicate": {"tool": "duplicate_actor", "params": ["actor_name"]},
    "copy": {"tool": "duplicate_actor", "params": ["actor_name"]},
    
    # Selection
    "select": {"tool": "select_actor", "params": ["actor_name"]},
    "select all": {"tool": "select_all_actors", "params": []},
    "deselect": {"tool": "deselect_all", "params": []},
    "clear selection": {"tool": "deselect_all", "params": []},
    
    # Viewport
    "screenshot": {"tool": "take_screenshot", "params": ["filename"]},
    "capture": {"tool": "take_screenshot", "params": ["filename"]},
    "focus": {"tool": "focus_actor", "params": ["actor_name"]},
    "look at": {"tool": "focus_actor", "params": ["actor_name"]},
    
    # Play in Editor
    "play": {"tool": "start_pie", "params": []},
    "start game": {"tool": "start_pie", "params": []},
    "stop": {"tool": "stop_pie", "params": []},
    "stop game": {"tool": "stop_pie", "params": []},
    
    # Level
    "save level": {"tool": "save_current_level", "params": []},
    "save": {"tool": "save_current_level", "params": []},
    "load level": {"tool": "load_level", "params": ["level_name"]},
    "open level": {"tool": "load_level", "params": ["level_name"]},
    "new level": {"tool": "create_new_level", "params": ["level_name"]},
    
    # Blueprint
    "create blueprint": {"tool": "create_blueprint", "params": ["blueprint_name", "parent_class"]},
    "compile": {"tool": "compile_blueprint", "params": ["blueprint_name"]},
    "open blueprint": {"tool": "open_blueprint", "params": ["blueprint_name"]},
    
    # Material
    "create material": {"tool": "create_material", "params": ["material_name"]},
    "apply material": {"tool": "apply_material", "params": ["actor_name", "material_name"]},
    
    # Physics
    "enable physics": {"tool": "set_simulate_physics", "params": ["actor_name", "enable"]},
    "disable physics": {"tool": "set_simulate_physics", "params": ["actor_name", "enable"]},
    "add collision": {"tool": "set_collision_enabled", "params": ["actor_name", "enable"]},
    
    # Animation
    "play animation": {"tool": "play_animation", "params": ["actor_name", "animation_name"]},
    "stop animation": {"tool": "stop_animation", "params": ["actor_name"]},
    
    # Audio
    "play sound": {"tool": "play_sound_2d", "params": ["sound_name"]},
    "stop sound": {"tool": "stop_all_sounds", "params": []},
}

# Common actor classes
ACTOR_CLASSES = {
    "cube": "StaticMeshActor",
    "sphere": "StaticMeshActor",
    "cylinder": "StaticMeshActor",
    "cone": "StaticMeshActor",
    "plane": "StaticMeshActor",
    "light": "PointLight",
    "point light": "PointLight",
    "spot light": "SpotLight",
    "directional light": "DirectionalLight",
    "camera": "CameraActor",
    "player start": "PlayerStart",
    "trigger": "TriggerBox",
    "character": "Character",
    "pawn": "Pawn",
}


class AICommandRequest(BaseModel):
    command: str
    context: Optional[Dict[str, Any]] = None


class AICommandResponse(BaseModel):
    tool: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    suggestions: List[str] = []
    explanation: str = ""
    success: bool = False
    error: Optional[str] = None


def parse_location(text: str) -> Optional[Dict[str, float]]:
    """Parse location from text like '0,0,100' or 'x=0 y=0 z=100' or 'origin'"""
    if "origin" in text.lower():
        return {"x": 0, "y": 0, "z": 0}
    
    # Try comma-separated format
    match = re.search(r'(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)', text)
    if match:
        return {"x": float(match.group(1)), "y": float(match.group(2)), "z": float(match.group(3))}
    
    # Try x=, y=, z= format
    x_match = re.search(r'x\s*=\s*(-?\d+(?:\.\d+)?)', text, re.IGNORECASE)
    y_match = re.search(r'y\s*=\s*(-?\d+(?:\.\d+)?)', text, re.IGNORECASE)
    z_match = re.search(r'z\s*=\s*(-?\d+(?:\.\d+)?)', text, re.IGNORECASE)
    
    if x_match or y_match or z_match:
        return {
            "x": float(x_match.group(1)) if x_match else 0,
            "y": float(y_match.group(1)) if y_match else 0,
            "z": float(z_match.group(1)) if z_match else 0
        }
    
    return None


def parse_command_simple(command: str) -> Optional[Dict[str, Any]]:
    """Simple rule-based command parsing"""
    command_lower = command.lower().strip()
    
    # Check for matching keywords
    for keyword, mapping in TOOL_KEYWORDS.items():
        if keyword in command_lower:
            tool = mapping["tool"]
            params = {}
            
            # Parse specific parameters based on tool
            if tool == "spawn_actor":
                # Find actor class
                for actor_name, actor_class in ACTOR_CLASSES.items():
                    if actor_name in command_lower:
                        params["class_name"] = actor_class
                        params["mesh_type"] = actor_name.capitalize()
                        break
                
                # Find location
                location = parse_location(command)
                if location:
                    params["location"] = location
                else:
                    params["location"] = {"x": 0, "y": 0, "z": 0}
                
                params["rotation"] = {"pitch": 0, "yaw": 0, "roll": 0}
                
            elif tool == "take_screenshot":
                # Generate filename
                import datetime
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                params["filename"] = f"Screenshot_{timestamp}.png"
                
            elif tool in ["start_pie", "stop_pie", "save_current_level", "deselect_all", "select_all_actors"]:
                # No params needed
                pass
                
            elif tool == "set_simulate_physics":
                params["enable"] = "enable" in command_lower or "add" in command_lower
                # Try to find actor name
                words = command.split()
                for i, word in enumerate(words):
                    if word.lower() in ["to", "on", "for"]:
                        if i + 1 < len(words):
                            params["actor_name"] = words[i + 1]
                            break
            
            return {"tool": tool, "params": params}
    
    return None


@router.post("/ai-command", response_model=AICommandResponse)
async def execute_ai_command(request: AICommandRequest):
    """
    Parse and execute a natural language command for UE5
    """
    command = request.command.strip()
    
    if not command:
        raise HTTPException(status_code=400, detail="Command cannot be empty")
    
    # First try simple rule-based parsing
    result = parse_command_simple(command)
    
    if result and result.get("tool"):
        # Return the parsed tool and params for the frontend to execute
        return AICommandResponse(
            tool=result["tool"],
            params=result.get("params", {}),
            explanation=f"Parsed command: {result['tool']}",
            success=True,
            suggestions=[]
        )
    
    # Could not parse command - provide suggestions
    return AICommandResponse(
        tool=None,
        params=None,
        explanation="Could not understand the command. Try one of the suggestions below.",
        success=False,
        suggestions=[
            "Spawn a cube at 0,0,100",
            "Take a screenshot",
            "Play the game",
            "Stop the game",
            "Select all actors",
            "Save the level"
        ]
    )


@router.get("/ai-suggestions")
async def get_ai_suggestions(query: str = ""):
    """
    Get AI-powered command suggestions based on partial input
    """
    suggestions = [
        "Spawn a cube at the origin",
        "Spawn a sphere at 0,0,200",
        "Take a screenshot",
        "Play the game in editor",
        "Stop the game",
        "Select all actors",
        "Save the current level",
        "Create a new Blueprint called MyActor",
        "Enable physics on the selected actor",
        "Focus on the player start",
        "Delete the selected actor",
        "Duplicate the selected actor"
    ]
    
    if query:
        query_lower = query.lower()
        suggestions = [s for s in suggestions if query_lower in s.lower()]
    
    return {"suggestions": suggestions[:5]}
