"""
Scene Builder API

Endpoints for multi-step scene creation with AI parsing and progress tracking.
"""

import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from services.auth import get_current_user
from services.scene_builder import get_scene_builder_service, SceneBuilderService, SceneStatus
from services.agent_relay import AgentRelayService
from models.user import User


router = APIRouter(prefix="/scene-builder", tags=["scene-builder"])


# Get agent relay service (will be set by main.py)
_agent_relay_service: Optional[AgentRelayService] = None


def set_agent_relay_service(service: AgentRelayService):
    """Set the agent relay service for scene building"""
    global _agent_relay_service
    _agent_relay_service = service


def get_agent_relay() -> AgentRelayService:
    """Get the agent relay service"""
    if _agent_relay_service is None:
        raise HTTPException(status_code=500, detail="Agent relay service not initialized")
    return _agent_relay_service


class ScenePlanRequest(BaseModel):
    """Request to create a scene plan from a prompt"""
    prompt: str


class ScenePlanResponse(BaseModel):
    """Response containing the scene plan"""
    id: str
    prompt: str
    room_type: str
    description: str
    status: str
    progress: float
    current_step: int
    total_steps: int
    objects: list
    steps: list
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None


@router.post("/plan", response_model=ScenePlanResponse)
async def create_scene_plan(
    request: ScenePlanRequest,
    current_user: User = Depends(get_current_user),
    scene_service: SceneBuilderService = Depends(get_scene_builder_service)
):
    """
    Parse a natural language prompt and create a scene building plan.
    
    This endpoint:
    1. Uses AI to parse the prompt into structured scene data
    2. Calculates optimal positions for all objects
    3. Creates a step-by-step build plan
    
    Returns the plan without executing it.
    """
    agent_relay = get_agent_relay()
    
    # Check if agent is connected
    if not agent_relay.is_agent_connected(current_user.id):
        raise HTTPException(status_code=400, detail="Agent not connected")
    
    if not agent_relay.is_mcp_connected(current_user.id):
        raise HTTPException(status_code=400, detail="MCP not connected to UE5")
    
    try:
        # Parse the prompt using AI
        parsed_scene = await scene_service.parse_scene_prompt(request.prompt)
        
        if not parsed_scene.get("objects"):
            raise HTTPException(
                status_code=400, 
                detail="Could not identify any objects in your description. Try being more specific."
            )
        
        # Create the build plan
        plan = scene_service.create_build_plan(parsed_scene, request.prompt)
        
        return scene_service.plan_to_dict(plan)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create scene plan: {str(e)}")


@router.get("/plan/{plan_id}", response_model=ScenePlanResponse)
async def get_scene_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    scene_service: SceneBuilderService = Depends(get_scene_builder_service)
):
    """Get a scene plan by ID"""
    plan = scene_service.get_plan(plan_id)
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return scene_service.plan_to_dict(plan)


@router.get("/build/{plan_id}")
async def build_scene(
    plan_id: str,
    token: str = Query(..., description="Auth token for SSE connection"),
    scene_service: SceneBuilderService = Depends(get_scene_builder_service)
):
    """
    Execute a scene build plan with real-time progress updates via SSE.
    
    This endpoint streams progress updates as each object is created.
    """
    # Validate token and get user (simplified for SSE)
    from services.auth import decode_token
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    agent_relay = get_agent_relay()
    
    # Check if agent is connected
    if not agent_relay.is_agent_connected(user_id):
        raise HTTPException(status_code=400, detail="Agent not connected")
    
    plan = scene_service.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    async def generate_progress():
        """Generator for SSE progress updates"""
        progress_queue = asyncio.Queue()
        
        async def progress_callback(data: Dict[str, Any]):
            await progress_queue.put(data)
        
        # Start build in background
        build_task = asyncio.create_task(
            scene_service.execute_build_plan(
                plan=plan,
                agent_relay_service=agent_relay,
                user_id=user_id,
                progress_callback=progress_callback
            )
        )
        
        try:
            while True:
                try:
                    # Wait for progress update with timeout
                    data = await asyncio.wait_for(progress_queue.get(), timeout=30.0)
                    
                    # Send progress event
                    yield f"data: {json.dumps({'type': 'progress', **data})}\n\n"
                    
                    # Check if build is complete
                    if data.get("completed"):
                        yield f"data: {json.dumps({'type': 'complete', 'plan_id': plan_id})}\n\n"
                        break
                        
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                    
                    # Check if task is done
                    if build_task.done():
                        break
                        
        except asyncio.CancelledError:
            build_task.cancel()
            yield f"data: {json.dumps({'type': 'cancelled'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            if not build_task.done():
                build_task.cancel()
    
    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/cancel/{plan_id}")
async def cancel_build(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    scene_service: SceneBuilderService = Depends(get_scene_builder_service)
):
    """Cancel an active scene build"""
    success = scene_service.cancel_plan(plan_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel plan - not currently building")
    
    return {"success": True, "message": "Build cancelled"}


@router.get("/templates")
async def get_scene_templates():
    """Get available scene templates"""
    return {
        "templates": [
            {
                "name": "Cozy Living Room",
                "prompt": "Create a living room with a sofa, coffee table, two lamps, and a TV",
                "room_type": "living_room",
                "object_count": 5
            },
            {
                "name": "Modern Bedroom",
                "prompt": "Create a bedroom with a bed, two nightstands with lamps, and a dresser",
                "room_type": "bedroom",
                "object_count": 5
            },
            {
                "name": "Home Office",
                "prompt": "Create an office with a desk, office chair, bookshelf, and a plant",
                "room_type": "office",
                "object_count": 4
            },
            {
                "name": "Dining Area",
                "prompt": "Create a dining room with a dining table and four chairs",
                "room_type": "dining_room",
                "object_count": 5
            },
            {
                "name": "Reading Nook",
                "prompt": "Create a reading corner with an armchair, floor lamp, bookshelf, and a small table",
                "room_type": "living_room",
                "object_count": 4
            },
            {
                "name": "Entertainment Setup",
                "prompt": "Create an entertainment area with a TV, sofa, two armchairs, and a coffee table",
                "room_type": "living_room",
                "object_count": 5
            }
        ]
    }


@router.get("/furniture-presets")
async def get_furniture_presets():
    """Get available furniture presets and their properties"""
    from services.scene_builder import FURNITURE_PRESETS
    
    presets = {}
    for name, preset in FURNITURE_PRESETS.items():
        presets[name] = {
            "type": preset.get("type", "furniture"),
            "footprint": preset.get("footprint", {}),
            "facing": preset.get("facing", "none")
        }
    
    return {"presets": presets}


@router.get("/room-layouts")
async def get_room_layouts():
    """Get available room layout configurations"""
    from services.scene_builder import ROOM_LAYOUTS
    
    layouts = {}
    for name, layout in ROOM_LAYOUTS.items():
        layouts[name] = {
            "size": layout.get("size", {}),
            "focal_point": layout.get("focal_point", ""),
            "arrangement": layout.get("arrangement", "")
        }
    
    return {"layouts": layouts}
