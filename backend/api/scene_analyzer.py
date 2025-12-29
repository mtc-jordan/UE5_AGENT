"""
Scene Analyzer API Endpoints

Provides endpoints for AI-powered scene analysis:
- Analyze current scene
- Get scene description
- Retrieve analysis history
- Apply auto-fixes
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio

from services.scene_analyzer import scene_analyzer_service, SceneAnalysis
from services.agent_relay import agent_relay
from services.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/api/scene-analyzer", tags=["scene-analyzer"])


class AnalyzeRequest(BaseModel):
    """Request to analyze the current scene"""
    include_screenshot: bool = False
    model: str = "deepseek-chat"


class DescribeRequest(BaseModel):
    """Request to get scene description"""
    model: str = "deepseek-chat"


class AutoFixRequest(BaseModel):
    """Request to apply an auto-fix"""
    issue_id: str
    analysis_id: str


@router.post("/analyze")
async def analyze_scene(
    request: AnalyzeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Analyze the current UE5 scene
    
    Returns comprehensive analysis including:
    - Scene metrics and composition
    - Detected issues with severity levels
    - AI-generated recommendations
    - Actor information
    """
    try:
        # Get scene data from UE5 via agent
        scene_data = await get_scene_data_from_ue5(current_user.id)
        
        if not scene_data:
            raise HTTPException(
                status_code=503,
                detail="Could not retrieve scene data from UE5. Make sure the agent is connected."
            )
        
        # Get screenshot if requested
        screenshot_base64 = None
        if request.include_screenshot:
            screenshot_base64 = await get_viewport_screenshot(current_user.id)
        
        # Perform analysis
        analysis = await scene_analyzer_service.analyze_scene(
            scene_data=scene_data,
            screenshot_base64=screenshot_base64,
            model=request.model
        )
        
        return scene_analyzer_service.analysis_to_dict(analysis)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/describe")
async def describe_scene(
    request: DescribeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Get a natural language description of the current scene
    """
    try:
        scene_data = await get_scene_data_from_ue5(current_user.id)
        
        if not scene_data:
            raise HTTPException(
                status_code=503,
                detail="Could not retrieve scene data from UE5"
            )
        
        description = await scene_analyzer_service.get_scene_description(
            scene_data=scene_data,
            model=request.model
        )
        
        return {"description": description}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a previously generated analysis by ID
    """
    analysis = scene_analyzer_service.get_analysis(analysis_id)
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return scene_analyzer_service.analysis_to_dict(analysis)


@router.get("/history")
async def get_analysis_history(current_user: User = Depends(get_current_user)):
    """
    Get list of all previous analyses
    """
    return scene_analyzer_service.get_all_analyses()


@router.post("/auto-fix")
async def apply_auto_fix(
    request: AutoFixRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Apply an auto-fix for a detected issue
    """
    try:
        # Get the analysis
        analysis = scene_analyzer_service.get_analysis(request.analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Find the issue
        issue = None
        for i in analysis.issues:
            if i.id == request.issue_id:
                issue = i
                break
        
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        
        if not issue.auto_fix_available or not issue.auto_fix_command:
            raise HTTPException(status_code=400, detail="Auto-fix not available for this issue")
        
        # Execute the auto-fix command via agent
        result = await execute_command_via_agent(current_user.id, issue.auto_fix_command)
        
        return {
            "success": True,
            "issue_id": request.issue_id,
            "command": issue.auto_fix_command,
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick-stats")
async def get_quick_stats(current_user: User = Depends(get_current_user)):
    """
    Get quick scene statistics without full analysis
    """
    try:
        scene_data = await get_scene_data_from_ue5(current_user.id)
        
        if not scene_data:
            return {
                "connected": False,
                "stats": None
            }
        
        actors = scene_data.get("actors", [])
        
        # Quick categorization
        lights = sum(1 for a in actors if "light" in a.get("type", "").lower())
        meshes = sum(1 for a in actors if "mesh" in a.get("type", "").lower())
        cameras = sum(1 for a in actors if "camera" in a.get("type", "").lower())
        
        return {
            "connected": True,
            "stats": {
                "total_actors": len(actors),
                "lights": lights,
                "meshes": meshes,
                "cameras": cameras,
                "project_name": scene_data.get("project_name", "Unknown"),
                "level_name": scene_data.get("level_name", "Unknown")
            }
        }
        
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }


# Helper functions

async def get_scene_data_from_ue5(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Get scene data from UE5 via the agent
    """
    try:
        # Use the agent relay to execute get_actors_in_level tool
        result = await agent_relay.execute_tool(
            user_id=user_id,
            tool_name="get_actors_in_level",
            parameters={}
        )
        
        if not result or not result.get("success"):
            return None
        
        # Parse the result
        tool_result = result.get("result", {})
        
        # The result might be a string or dict depending on the MCP tool
        if isinstance(tool_result, str):
            import json
            try:
                tool_result = json.loads(tool_result)
            except:
                # If it's just a list of actor names
                actors = [{"name": name, "type": "Unknown"} for name in tool_result.split("\n") if name.strip()]
                tool_result = {"actors": actors}
        
        # Get project info
        project_result = await agent_relay.execute_tool(
            user_id=user_id,
            tool_name="get_project_info",
            parameters={}
        )
        
        project_info = {}
        if project_result and project_result.get("success"):
            proj_data = project_result.get("result", {})
            if isinstance(proj_data, str):
                import json
                try:
                    proj_data = json.loads(proj_data)
                except:
                    proj_data = {}
            project_info = proj_data
        
        # Combine data
        scene_data = {
            "actors": tool_result.get("actors", []) if isinstance(tool_result, dict) else [],
            "project_name": project_info.get("project_name", "Unknown"),
            "level_name": project_info.get("level_name", project_info.get("current_level", "Unknown")),
            "engine_version": project_info.get("engine_version", "5.x")
        }
        
        return scene_data
        
    except Exception as e:
        print(f"Error getting scene data: {e}")
        return None


async def get_viewport_screenshot(user_id: int) -> Optional[str]:
    """
    Get a viewport screenshot as base64
    """
    try:
        result = await agent_relay.execute_tool(
            user_id=user_id,
            tool_name="take_screenshot",
            parameters={"filename": "scene_analysis_temp.png"}
        )
        
        if result and result.get("success"):
            # The result should contain base64 data
            return result.get("result", {}).get("base64_data")
        
        return None
        
    except Exception:
        return None


async def execute_command_via_agent(user_id: int, command: str) -> Dict[str, Any]:
    """
    Execute a command via the agent
    """
    try:
        # Parse the command to determine which tool to use
        command_lower = command.lower()
        
        if "spawn_actor" in command_lower or "directionallight" in command_lower:
            # Spawn a light
            result = await agent_relay.execute_tool(
                user_id=user_id,
                tool_name="spawn_actor",
                parameters={
                    "actor_type": "DirectionalLight",
                    "location": {"x": 0, "y": 0, "z": 500},
                    "rotation": {"pitch": -45, "yaw": 0, "roll": 0}
                }
            )
        elif "camera" in command_lower:
            result = await agent_relay.execute_tool(
                user_id=user_id,
                tool_name="spawn_actor",
                parameters={
                    "actor_type": "CameraActor",
                    "location": {"x": 0, "y": -500, "z": 200}
                }
            )
        else:
            result = {"success": False, "error": "Unknown command"}
        
        return result
        
    except Exception as e:
        return {"success": False, "error": str(e)}
