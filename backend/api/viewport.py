"""
Viewport Preview API
Endpoints for capturing and retrieving UE5 viewport screenshots.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.auth import get_current_user
from services.viewport_preview import get_viewport_preview_service, ViewportPreviewService
from services.agent_relay import AgentRelayService
from models.user import User


router = APIRouter(prefix="/viewport", tags=["viewport"])


# Get agent relay service (will be set by main.py)
_agent_relay_service: Optional[AgentRelayService] = None


def set_agent_relay_service(service: AgentRelayService):
    """Set the agent relay service for viewport capture"""
    global _agent_relay_service
    _agent_relay_service = service


def get_agent_relay() -> AgentRelayService:
    """Get the agent relay service"""
    if _agent_relay_service is None:
        raise HTTPException(status_code=500, detail="Agent relay service not initialized")
    return _agent_relay_service


class CaptureRequest(BaseModel):
    """Request to capture a screenshot"""
    context: Optional[str] = None
    resolution_x: int = 1280
    resolution_y: int = 720


class CaptureBeforeAfterRequest(BaseModel):
    """Request to capture before/after screenshots"""
    tool_name: str
    tool_params: Dict[str, Any] = {}


class ScreenshotResponse(BaseModel):
    """Screenshot response"""
    id: str
    filename: str
    timestamp: str
    width: int
    height: int
    file_path: str
    base64_data: Optional[str] = None
    context: Optional[str] = None
    tool_name: Optional[str] = None
    is_before: bool = False
    paired_screenshot_id: Optional[str] = None


class BeforeAfterResponse(BaseModel):
    """Before/after pair response"""
    id: str
    before: ScreenshotResponse
    after: ScreenshotResponse
    tool_name: str
    tool_params: Dict[str, Any]
    created_at: str


@router.post("/capture", response_model=ScreenshotResponse)
async def capture_screenshot(
    request: CaptureRequest,
    current_user: User = Depends(get_current_user),
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """
    Capture a screenshot of the current UE5 viewport.
    
    Returns the screenshot metadata and optionally base64 data.
    """
    agent_relay = get_agent_relay()
    
    # Check if agent is connected
    if not agent_relay.is_agent_connected(current_user.id):
        raise HTTPException(status_code=400, detail="Agent not connected")
    
    if not agent_relay.is_mcp_connected(current_user.id):
        raise HTTPException(status_code=400, detail="MCP not connected to UE5")
    
    screenshot = await viewport_service.capture_screenshot(
        user_id=current_user.id,
        agent_relay_service=agent_relay,
        context=request.context,
        resolution_x=request.resolution_x,
        resolution_y=request.resolution_y
    )
    
    if not screenshot:
        raise HTTPException(status_code=500, detail="Failed to capture screenshot")
    
    return viewport_service.to_dict(screenshot)


@router.post("/capture-before")
async def capture_before(
    tool_name: str,
    current_user: User = Depends(get_current_user),
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """
    Capture a 'before' screenshot before executing a transformation tool.
    Call this before executing the tool, then call /capture-after after.
    """
    agent_relay = get_agent_relay()
    
    if not agent_relay.is_agent_connected(current_user.id):
        raise HTTPException(status_code=400, detail="Agent not connected")
    
    screenshot = await viewport_service.capture_before(
        user_id=current_user.id,
        agent_relay_service=agent_relay,
        tool_name=tool_name
    )
    
    if not screenshot:
        raise HTTPException(status_code=500, detail="Failed to capture before screenshot")
    
    return viewport_service.to_dict(screenshot)


@router.post("/capture-after", response_model=BeforeAfterResponse)
async def capture_after(
    request: CaptureBeforeAfterRequest,
    current_user: User = Depends(get_current_user),
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """
    Capture an 'after' screenshot and create a before/after comparison pair.
    Call this after executing the tool.
    """
    agent_relay = get_agent_relay()
    
    if not agent_relay.is_agent_connected(current_user.id):
        raise HTTPException(status_code=400, detail="Agent not connected")
    
    pair = await viewport_service.capture_after(
        user_id=current_user.id,
        agent_relay_service=agent_relay,
        tool_name=request.tool_name,
        tool_params=request.tool_params
    )
    
    if not pair:
        raise HTTPException(status_code=500, detail="Failed to capture after screenshot or create pair")
    
    return viewport_service.pair_to_dict(pair)


@router.get("/screenshots", response_model=List[ScreenshotResponse])
async def get_screenshots(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """Get recent screenshots for the current user"""
    screenshots = viewport_service.get_user_screenshots(current_user.id, limit)
    return [viewport_service.to_dict(s) for s in screenshots]


@router.get("/screenshots/{screenshot_id}", response_model=ScreenshotResponse)
async def get_screenshot(
    screenshot_id: str,
    current_user: User = Depends(get_current_user),
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """Get a specific screenshot by ID"""
    screenshot = viewport_service.get_screenshot(screenshot_id)
    
    if not screenshot:
        raise HTTPException(status_code=404, detail="Screenshot not found")
    
    if screenshot.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return viewport_service.to_dict(screenshot)


@router.get("/pairs", response_model=List[BeforeAfterResponse])
async def get_before_after_pairs(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """Get recent before/after comparison pairs for the current user"""
    pairs = viewport_service.get_user_pairs(current_user.id, limit)
    return [viewport_service.pair_to_dict(p) for p in pairs]


@router.get("/pairs/{pair_id}", response_model=BeforeAfterResponse)
async def get_before_after_pair(
    pair_id: str,
    current_user: User = Depends(get_current_user),
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """Get a specific before/after pair by ID"""
    pair = viewport_service.get_before_after_pair(pair_id)
    
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")
    
    if pair.before.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return viewport_service.pair_to_dict(pair)


@router.get("/transform-tools")
async def get_transform_tools(
    viewport_service: ViewportPreviewService = Depends(get_viewport_preview_service)
):
    """Get list of tools that trigger before/after comparison"""
    return {
        "tools": list(viewport_service.transform_tools),
        "description": "These tools will automatically capture before/after screenshots when auto-capture is enabled"
    }
