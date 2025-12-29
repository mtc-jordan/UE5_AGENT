"""
Animation Assistant API Endpoints
=================================

Provides endpoints for AI-assisted animation management in UE5:
- Animation library browsing
- Animation playback control
- Blend space management
- Animation montage creation
- Retargeting operations
- AI animation suggestions
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

# from services.auth import get_current_user
# from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/animation", tags=["animation"])

# Store agent relay service reference
_agent_relay = None

def set_agent_relay_service(relay):
    """Set the agent relay service for MCP communication."""
    global _agent_relay
    _agent_relay = relay


# ==================== SCHEMAS ====================

class AnimationInfo(BaseModel):
    """Animation information."""
    id: str
    name: str
    path: str
    category: str
    duration: float = Field(..., description="Duration in seconds")
    frame_count: int
    fps: int = 30
    skeleton: str
    tags: List[str] = []
    is_looping: bool = False
    has_root_motion: bool = False
    thumbnail: Optional[str] = None


class PlayAnimationRequest(BaseModel):
    """Request to play an animation."""
    animation_path: str = Field(..., description="Path to the animation asset")
    actor_id: Optional[str] = Field(None, description="Target actor ID (uses selected if not specified)")
    loop: bool = Field(False, description="Whether to loop the animation")
    speed: float = Field(1.0, ge=0.1, le=5.0, description="Playback speed multiplier")
    start_time: float = Field(0.0, ge=0, description="Start time in seconds")
    blend_in: float = Field(0.25, ge=0, le=2.0, description="Blend in duration")
    blend_out: float = Field(0.25, ge=0, le=2.0, description="Blend out duration")


class StopAnimationRequest(BaseModel):
    """Request to stop animation playback."""
    actor_id: Optional[str] = Field(None, description="Target actor ID")
    blend_out: float = Field(0.25, ge=0, le=2.0, description="Blend out duration")


class BlendSample(BaseModel):
    """A sample point in a blend space."""
    animation_path: str
    position_x: float
    position_y: Optional[float] = None


class CreateBlendSpaceRequest(BaseModel):
    """Request to create a blend space."""
    name: str = Field(..., description="Blend space name")
    blend_type: str = Field("2D", description="1D or 2D blend space")
    axis_x_name: str = Field("Speed", description="X axis parameter name")
    axis_x_min: float = Field(0.0, description="X axis minimum value")
    axis_x_max: float = Field(1.0, description="X axis maximum value")
    axis_y_name: Optional[str] = Field("Direction", description="Y axis parameter name (2D only)")
    axis_y_min: Optional[float] = Field(-180.0, description="Y axis minimum value")
    axis_y_max: Optional[float] = Field(180.0, description="Y axis maximum value")
    samples: List[BlendSample] = Field([], description="Initial blend samples")


class MontageSection(BaseModel):
    """A section in an animation montage."""
    name: str
    start_time: float
    animation_path: str


class AnimationNotify(BaseModel):
    """An animation notify event."""
    name: str
    time: float
    notify_type: str = Field("event", description="event, state, or sound")
    payload: Optional[Dict[str, Any]] = None


class CreateMontageRequest(BaseModel):
    """Request to create an animation montage."""
    name: str = Field(..., description="Montage name")
    skeleton: str = Field(..., description="Target skeleton asset")
    sections: List[MontageSection] = Field([], description="Montage sections")
    notifies: List[AnimationNotify] = Field([], description="Animation notifies")


class RetargetRequest(BaseModel):
    """Request to retarget an animation."""
    source_animation: str = Field(..., description="Source animation path")
    source_skeleton: str = Field(..., description="Source skeleton path")
    target_skeleton: str = Field(..., description="Target skeleton path")
    output_path: Optional[str] = Field(None, description="Output animation path")
    bone_mapping: Optional[Dict[str, str]] = Field(None, description="Custom bone mapping overrides")


class AnimationResponse(BaseModel):
    """Response from animation operations."""
    success: bool
    message: str
    animation_path: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AnimationSuggestion(BaseModel):
    """AI-generated animation suggestion."""
    animation_path: str
    name: str
    confidence: float
    reasoning: str
    category: str


# ==================== ENDPOINTS ====================

@router.get("/library", response_model=List[AnimationInfo])
async def get_animation_library(
    category: Optional[str] = None,
    skeleton: Optional[str] = None,
    search: Optional[str] = None,

):
    """
    Get the animation library from the UE5 project.
    
    Optionally filter by category, skeleton, or search query.
    """
    global _agent_relay
    
    if not _agent_relay:
        # Return sample data if not connected
        return get_sample_animations(category, skeleton, search)
    
    try:
        result = await _agent_relay.execute_mcp_tool(
            "get_animation_library",
            {
                "category": category,
                "skeleton": skeleton,
                "search": search
            }
        )
        
        animations = []
        for anim in result.get("animations", []):
            animations.append(AnimationInfo(
                id=anim.get("id", ""),
                name=anim.get("name", ""),
                path=anim.get("path", ""),
                category=anim.get("category", "other"),
                duration=anim.get("duration", 1.0),
                frame_count=anim.get("frame_count", 30),
                fps=anim.get("fps", 30),
                skeleton=anim.get("skeleton", ""),
                tags=anim.get("tags", []),
                is_looping=anim.get("is_looping", False),
                has_root_motion=anim.get("has_root_motion", False),
                thumbnail=anim.get("thumbnail")
            ))
        
        return animations
        
    except Exception as e:
        logger.error(f"Failed to get animation library: {e}")
        return get_sample_animations(category, skeleton, search)


@router.post("/play", response_model=AnimationResponse)
async def play_animation(
    request: PlayAnimationRequest,

):
    """
    Play an animation on the selected actor or specified actor.
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        result = await _agent_relay.execute_mcp_tool(
            "play_animation",
            {
                "animation": request.animation_path,
                "actor_id": request.actor_id,
                "loop": request.loop,
                "play_rate": request.speed,
                "start_position": request.start_time,
                "blend_in_time": request.blend_in,
                "blend_out_time": request.blend_out
            }
        )
        
        return AnimationResponse(
            success=True,
            message=f"Playing animation: {request.animation_path}",
            animation_path=request.animation_path,
            data={"loop": request.loop, "speed": request.speed}
        )
        
    except Exception as e:
        logger.error(f"Failed to play animation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to play animation: {str(e)}"
        )


@router.post("/stop", response_model=AnimationResponse)
async def stop_animation(
    request: StopAnimationRequest,

):
    """
    Stop animation playback on the selected or specified actor.
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        result = await _agent_relay.execute_mcp_tool(
            "stop_animation",
            {
                "actor_id": request.actor_id,
                "blend_out_time": request.blend_out
            }
        )
        
        return AnimationResponse(
            success=True,
            message="Animation stopped"
        )
        
    except Exception as e:
        logger.error(f"Failed to stop animation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop animation: {str(e)}"
        )


class SetSpeedRequest(BaseModel):
    """Request to set animation speed."""
    speed: float = Field(..., ge=0.1, le=5.0)
    actor_id: Optional[str] = None

@router.post("/set-speed", response_model=AnimationResponse)
async def set_animation_speed(
    request: SetSpeedRequest
):
    """
    Set the playback speed of the current animation.
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        result = await _agent_relay.execute_mcp_tool(
            "set_animation_speed",
            {
                "actor_id": request.actor_id,
                "play_rate": request.speed
            }
        )
        
        return AnimationResponse(
            success=True,
            message=f"Animation speed set to {request.speed}x",
            data={"speed": request.speed}
        )
        
    except Exception as e:
        logger.error(f"Failed to set animation speed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set animation speed: {str(e)}"
        )


@router.post("/blend-space/create", response_model=AnimationResponse)
async def create_blend_space(
    request: CreateBlendSpaceRequest,

):
    """
    Create a new blend space asset.
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        samples = [
            {
                "animation": s.animation_path,
                "x": s.position_x,
                "y": s.position_y
            }
            for s in request.samples
        ]
        
        result = await _agent_relay.execute_mcp_tool(
            "create_blend_space",
            {
                "name": request.name,
                "type": request.blend_type,
                "axis_x": {
                    "name": request.axis_x_name,
                    "min": request.axis_x_min,
                    "max": request.axis_x_max
                },
                "axis_y": {
                    "name": request.axis_y_name,
                    "min": request.axis_y_min,
                    "max": request.axis_y_max
                } if request.blend_type == "2D" else None,
                "samples": samples
            }
        )
        
        return AnimationResponse(
            success=True,
            message=f"Blend space '{request.name}' created",
            data={"blend_space_path": result.get("path")}
        )
        
    except Exception as e:
        logger.error(f"Failed to create blend space: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create blend space: {str(e)}"
        )


@router.post("/montage/create", response_model=AnimationResponse)
async def create_montage(
    request: CreateMontageRequest,

):
    """
    Create a new animation montage.
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        sections = [
            {
                "name": s.name,
                "start_time": s.start_time,
                "animation": s.animation_path
            }
            for s in request.sections
        ]
        
        notifies = [
            {
                "name": n.name,
                "time": n.time,
                "type": n.notify_type,
                "payload": n.payload
            }
            for n in request.notifies
        ]
        
        result = await _agent_relay.execute_mcp_tool(
            "create_animation_montage",
            {
                "name": request.name,
                "skeleton": request.skeleton,
                "sections": sections,
                "notifies": notifies
            }
        )
        
        return AnimationResponse(
            success=True,
            message=f"Animation montage '{request.name}' created",
            data={"montage_path": result.get("path")}
        )
        
    except Exception as e:
        logger.error(f"Failed to create montage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create montage: {str(e)}"
        )


@router.post("/retarget", response_model=AnimationResponse)
async def retarget_animation(
    request: RetargetRequest,

):
    """
    Retarget an animation from one skeleton to another.
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        result = await _agent_relay.execute_mcp_tool(
            "retarget_animation",
            {
                "source_animation": request.source_animation,
                "source_skeleton": request.source_skeleton,
                "target_skeleton": request.target_skeleton,
                "output_path": request.output_path,
                "bone_mapping": request.bone_mapping
            }
        )
        
        return AnimationResponse(
            success=True,
            message=f"Animation retargeted successfully",
            animation_path=result.get("output_path"),
            data={"source": request.source_animation, "target_skeleton": request.target_skeleton}
        )
        
    except Exception as e:
        logger.error(f"Failed to retarget animation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retarget animation: {str(e)}"
        )


@router.post("/suggest", response_model=List[AnimationSuggestion])
async def get_animation_suggestions(
    context: Optional[str] = None,
    action_type: Optional[str] = None,
    current_animation: Optional[str] = None,

):
    """
    Get AI-powered animation suggestions based on context.
    """
    suggestions = []
    
    # Context-based suggestions
    if action_type:
        action_lower = action_type.lower()
        
        if "walk" in action_lower or "move" in action_lower:
            suggestions.extend([
                AnimationSuggestion(
                    animation_path="/Game/Animations/Locomotion/Walk",
                    name="Walk",
                    confidence=0.95,
                    reasoning="Standard walking animation for movement",
                    category="locomotion"
                ),
                AnimationSuggestion(
                    animation_path="/Game/Animations/Locomotion/WalkSlow",
                    name="Walk Slow",
                    confidence=0.8,
                    reasoning="Slower walking variant for careful movement",
                    category="locomotion"
                ),
            ])
        elif "run" in action_lower or "sprint" in action_lower:
            suggestions.extend([
                AnimationSuggestion(
                    animation_path="/Game/Animations/Locomotion/Run",
                    name="Run",
                    confidence=0.95,
                    reasoning="Standard running animation",
                    category="locomotion"
                ),
                AnimationSuggestion(
                    animation_path="/Game/Animations/Locomotion/Sprint",
                    name="Sprint",
                    confidence=0.85,
                    reasoning="Fast sprinting animation",
                    category="locomotion"
                ),
            ])
        elif "attack" in action_lower or "combat" in action_lower:
            suggestions.extend([
                AnimationSuggestion(
                    animation_path="/Game/Animations/Combat/SwordAttack",
                    name="Sword Attack",
                    confidence=0.9,
                    reasoning="Basic melee attack animation",
                    category="combat"
                ),
                AnimationSuggestion(
                    animation_path="/Game/Animations/Combat/SwordCombo",
                    name="Sword Combo",
                    confidence=0.85,
                    reasoning="Multi-hit combo attack",
                    category="combat"
                ),
            ])
        elif "idle" in action_lower or "stand" in action_lower:
            suggestions.extend([
                AnimationSuggestion(
                    animation_path="/Game/Animations/Locomotion/Idle",
                    name="Idle",
                    confidence=0.95,
                    reasoning="Standard idle stance",
                    category="locomotion"
                ),
            ])
    
    # Blend suggestions based on current animation
    if current_animation:
        if "Idle" in current_animation:
            suggestions.append(AnimationSuggestion(
                animation_path="/Game/Animations/Locomotion/Walk",
                name="Walk",
                confidence=0.9,
                reasoning="Natural transition from idle to movement",
                category="locomotion"
            ))
        elif "Walk" in current_animation:
            suggestions.append(AnimationSuggestion(
                animation_path="/Game/Animations/Locomotion/Run",
                name="Run",
                confidence=0.85,
                reasoning="Speed up from walk to run",
                category="locomotion"
            ))
    
    # Default suggestions if none matched
    if not suggestions:
        suggestions = [
            AnimationSuggestion(
                animation_path="/Game/Animations/Locomotion/Idle",
                name="Idle",
                confidence=0.7,
                reasoning="Default idle animation",
                category="locomotion"
            ),
            AnimationSuggestion(
                animation_path="/Game/Animations/Locomotion/Walk",
                name="Walk",
                confidence=0.65,
                reasoning="Basic movement animation",
                category="locomotion"
            ),
        ]
    
    return suggestions[:5]  # Return top 5 suggestions


@router.get("/categories")
async def get_animation_categories(

):
    """Get available animation categories."""
    return {
        "categories": [
            {"id": "locomotion", "name": "Locomotion", "description": "Walking, running, jumping"},
            {"id": "combat", "name": "Combat", "description": "Attacks, blocks, dodges"},
            {"id": "emotes", "name": "Emotes", "description": "Expressions and gestures"},
            {"id": "interactions", "name": "Interactions", "description": "Object interactions"},
            {"id": "abilities", "name": "Abilities", "description": "Special abilities and magic"},
            {"id": "cinematic", "name": "Cinematic", "description": "Cutscene animations"},
        ]
    }


@router.get("/skeletons")
async def get_available_skeletons(

):
    """Get available skeleton assets."""
    global _agent_relay
    
    if not _agent_relay:
        # Return sample data
        return {
            "skeletons": [
                {"path": "/Game/Characters/Mannequin/SK_Mannequin", "name": "SK_Mannequin"},
                {"path": "/Game/Characters/MetaHuman/SK_MetaHuman", "name": "SK_MetaHuman"},
                {"path": "/Game/Characters/Enemy/SK_Enemy", "name": "SK_Enemy"},
            ]
        }
    
    try:
        result = await _agent_relay.execute_mcp_tool("get_skeleton_assets", {})
        return {"skeletons": result.get("skeletons", [])}
    except Exception as e:
        logger.error(f"Failed to get skeletons: {e}")
        return {"skeletons": []}


# ==================== HELPER FUNCTIONS ====================

def get_sample_animations(
    category: Optional[str] = None,
    skeleton: Optional[str] = None,
    search: Optional[str] = None
) -> List[AnimationInfo]:
    """Return sample animations for demo/offline mode."""
    
    sample_animations = [
        AnimationInfo(id="1", name="Idle", path="/Game/Animations/Locomotion/Idle", category="locomotion", duration=2.0, frame_count=60, fps=30, skeleton="SK_Mannequin", tags=["idle", "standing", "loop"], is_looping=True, has_root_motion=False),
        AnimationInfo(id="2", name="Walk", path="/Game/Animations/Locomotion/Walk", category="locomotion", duration=1.0, frame_count=30, fps=30, skeleton="SK_Mannequin", tags=["walk", "movement", "loop"], is_looping=True, has_root_motion=True),
        AnimationInfo(id="3", name="Run", path="/Game/Animations/Locomotion/Run", category="locomotion", duration=0.8, frame_count=24, fps=30, skeleton="SK_Mannequin", tags=["run", "sprint", "movement", "loop"], is_looping=True, has_root_motion=True),
        AnimationInfo(id="4", name="Jump", path="/Game/Animations/Locomotion/Jump", category="locomotion", duration=1.5, frame_count=45, fps=30, skeleton="SK_Mannequin", tags=["jump", "air"], is_looping=False, has_root_motion=True),
        AnimationInfo(id="5", name="Crouch Idle", path="/Game/Animations/Locomotion/CrouchIdle", category="locomotion", duration=2.0, frame_count=60, fps=30, skeleton="SK_Mannequin", tags=["crouch", "stealth", "loop"], is_looping=True, has_root_motion=False),
        AnimationInfo(id="6", name="Sword Attack", path="/Game/Animations/Combat/SwordAttack", category="combat", duration=1.2, frame_count=36, fps=30, skeleton="SK_Mannequin", tags=["attack", "melee", "sword"], is_looping=False, has_root_motion=True),
        AnimationInfo(id="7", name="Sword Combo", path="/Game/Animations/Combat/SwordCombo", category="combat", duration=2.5, frame_count=75, fps=30, skeleton="SK_Mannequin", tags=["combo", "melee", "sword"], is_looping=False, has_root_motion=True),
        AnimationInfo(id="8", name="Block", path="/Game/Animations/Combat/Block", category="combat", duration=0.5, frame_count=15, fps=30, skeleton="SK_Mannequin", tags=["block", "defense"], is_looping=False, has_root_motion=False),
        AnimationInfo(id="9", name="Dodge Roll", path="/Game/Animations/Combat/DodgeRoll", category="combat", duration=1.0, frame_count=30, fps=30, skeleton="SK_Mannequin", tags=["dodge", "roll", "evasion"], is_looping=False, has_root_motion=True),
        AnimationInfo(id="10", name="Death", path="/Game/Animations/Combat/Death", category="combat", duration=2.0, frame_count=60, fps=30, skeleton="SK_Mannequin", tags=["death", "ragdoll"], is_looping=False, has_root_motion=True),
        AnimationInfo(id="11", name="Wave", path="/Game/Animations/Emotes/Wave", category="emotes", duration=2.0, frame_count=60, fps=30, skeleton="SK_Mannequin", tags=["wave", "greeting", "friendly"], is_looping=False, has_root_motion=False),
        AnimationInfo(id="12", name="Dance", path="/Game/Animations/Emotes/Dance", category="emotes", duration=4.0, frame_count=120, fps=30, skeleton="SK_Mannequin", tags=["dance", "celebration", "loop"], is_looping=True, has_root_motion=False),
        AnimationInfo(id="13", name="Clap", path="/Game/Animations/Emotes/Clap", category="emotes", duration=1.5, frame_count=45, fps=30, skeleton="SK_Mannequin", tags=["clap", "applause"], is_looping=False, has_root_motion=False),
        AnimationInfo(id="14", name="Fireball Cast", path="/Game/Animations/Abilities/FireballCast", category="abilities", duration=1.5, frame_count=45, fps=30, skeleton="SK_Mannequin", tags=["magic", "fireball", "cast"], is_looping=False, has_root_motion=False),
        AnimationInfo(id="15", name="Heal", path="/Game/Animations/Abilities/Heal", category="abilities", duration=2.0, frame_count=60, fps=30, skeleton="SK_Mannequin", tags=["magic", "heal", "support"], is_looping=False, has_root_motion=False),
    ]
    
    # Apply filters
    filtered = sample_animations
    
    if category:
        filtered = [a for a in filtered if a.category == category]
    
    if skeleton:
        filtered = [a for a in filtered if skeleton.lower() in a.skeleton.lower()]
    
    if search:
        search_lower = search.lower()
        filtered = [a for a in filtered if 
            search_lower in a.name.lower() or 
            any(search_lower in tag for tag in a.tags)
        ]
    
    return filtered
