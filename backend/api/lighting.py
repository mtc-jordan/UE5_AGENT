"""
Lighting Wizard API Endpoints
=============================

Provides endpoints for AI-assisted lighting setup in UE5:
- Apply lighting presets
- Custom lighting settings
- Time-of-day control
- HDRI sky management
- AI lighting suggestions
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

# Authentication is optional for these endpoints
# from services.auth import get_current_user
# from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lighting", tags=["lighting"])

# Store agent relay service reference
_agent_relay = None

def set_agent_relay_service(relay):
    """Set the agent relay service for MCP communication."""
    global _agent_relay
    _agent_relay = relay


# ==================== SCHEMAS ====================

class AdditionalLight(BaseModel):
    """Additional light configuration."""
    type: str = Field(..., description="Light type: point, spot, directional, rect")
    position: Dict[str, float] = Field(..., description="Position {x, y, z}")
    rotation: Optional[Dict[str, float]] = Field(None, description="Rotation {pitch, yaw, roll}")
    intensity: float = Field(1.0, description="Light intensity")
    color: str = Field("#FFFFFF", description="Light color in hex")
    radius: Optional[float] = Field(None, description="Light radius for point/spot lights")
    inner_cone_angle: Optional[float] = Field(None, description="Inner cone angle for spot lights")
    outer_cone_angle: Optional[float] = Field(None, description="Outer cone angle for spot lights")


class LightingSettings(BaseModel):
    """Complete lighting settings configuration."""
    time_of_day: float = Field(12.0, ge=0, le=24, description="Time of day (0-24)")
    sun_intensity: float = Field(1.0, ge=0, le=10, description="Sun light intensity")
    sun_color: str = Field("#FFFFFF", description="Sun color in hex")
    sky_intensity: float = Field(1.0, ge=0, le=5, description="Sky light intensity")
    sky_color: str = Field("#87CEEB", description="Sky color in hex")
    ambient_intensity: float = Field(0.5, ge=0, le=2, description="Ambient light intensity")
    ambient_color: str = Field("#404040", description="Ambient color in hex")
    fog_density: float = Field(0.0, ge=0, le=1, description="Fog density")
    fog_color: str = Field("#FFFFFF", description="Fog color in hex")
    shadow_intensity: float = Field(0.8, ge=0, le=1, description="Shadow intensity")
    bloom_intensity: float = Field(0.2, ge=0, le=2, description="Bloom intensity")
    exposure: float = Field(1.0, ge=0.1, le=5, description="Exposure value")
    contrast: float = Field(1.0, ge=0.5, le=2, description="Contrast value")
    saturation: float = Field(1.0, ge=0, le=2, description="Saturation value")
    temperature: int = Field(5500, ge=1000, le=15000, description="Color temperature in Kelvin")
    hdri_asset: Optional[str] = Field(None, description="HDRI asset path")
    additional_lights: Optional[List[AdditionalLight]] = Field(None, description="Additional lights to spawn")


class ApplyPresetRequest(BaseModel):
    """Request to apply a lighting preset."""
    preset_id: str = Field(..., description="Preset identifier")
    settings: LightingSettings = Field(..., description="Lighting settings to apply")


class ApplyCustomRequest(BaseModel):
    """Request to apply custom lighting settings."""
    settings: LightingSettings = Field(..., description="Custom lighting settings")


class TimeOfDayRequest(BaseModel):
    """Request to change time of day."""
    time: float = Field(..., ge=0, le=24, description="Time of day (0-24)")
    animate: bool = Field(False, description="Animate the transition")
    duration: float = Field(2.0, ge=0.1, le=30, description="Animation duration in seconds")


class HDRIRequest(BaseModel):
    """Request to change HDRI sky."""
    hdri_asset: str = Field(..., description="HDRI asset path or name")
    intensity: float = Field(1.0, ge=0, le=5, description="HDRI intensity")
    rotation: float = Field(0.0, ge=0, le=360, description="HDRI rotation in degrees")


class LightingResponse(BaseModel):
    """Response from lighting operations."""
    success: bool
    message: str
    preset_id: Optional[str] = None
    settings_applied: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AILightingSuggestion(BaseModel):
    """AI-generated lighting suggestion."""
    preset_id: str
    name: str
    description: str
    confidence: float
    reasoning: str
    settings: LightingSettings


class AILightingRequest(BaseModel):
    """Request for AI lighting suggestions."""
    scene_description: Optional[str] = Field(None, description="Description of the scene")
    mood: Optional[str] = Field(None, description="Desired mood (e.g., dramatic, peaceful)")
    reference_image: Optional[str] = Field(None, description="Base64 encoded reference image")
    current_time: Optional[float] = Field(None, description="Current time of day in scene")


# ==================== ENDPOINTS ====================

@router.post("/apply", response_model=LightingResponse)
async def apply_lighting_preset(
    request: ApplyPresetRequest,

):
    """
    Apply a lighting preset to the UE5 scene.
    
    This will:
    1. Set the directional light (sun) properties
    2. Configure the sky light
    3. Set post-process settings
    4. Spawn any additional lights defined in the preset
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        settings = request.settings
        
        # Build MCP commands to apply lighting
        commands = []
        
        # 1. Set directional light (sun)
        commands.append({
            "tool": "set_sun_position",
            "params": {
                "time_of_day": settings.time_of_day,
                "intensity": settings.sun_intensity,
                "color": settings.sun_color
            }
        })
        
        # 2. Set sky light
        commands.append({
            "tool": "set_sky_light",
            "params": {
                "intensity": settings.sky_intensity,
                "color": settings.sky_color
            }
        })
        
        # 3. Set post-process settings
        commands.append({
            "tool": "set_post_process",
            "params": {
                "bloom_intensity": settings.bloom_intensity,
                "exposure": settings.exposure,
                "contrast": settings.contrast,
                "saturation": settings.saturation,
                "color_temperature": settings.temperature
            }
        })
        
        # 4. Set fog
        if settings.fog_density > 0:
            commands.append({
                "tool": "set_exponential_fog",
                "params": {
                    "density": settings.fog_density,
                    "color": settings.fog_color
                }
            })
        
        # 5. Spawn additional lights
        if settings.additional_lights:
            for light in settings.additional_lights:
                light_params = {
                    "type": light.type,
                    "location": light.position,
                    "intensity": light.intensity,
                    "color": light.color
                }
                if light.rotation:
                    light_params["rotation"] = light.rotation
                if light.radius:
                    light_params["attenuation_radius"] = light.radius
                if light.inner_cone_angle:
                    light_params["inner_cone_angle"] = light.inner_cone_angle
                if light.outer_cone_angle:
                    light_params["outer_cone_angle"] = light.outer_cone_angle
                    
                commands.append({
                    "tool": "spawn_light",
                    "params": light_params
                })
        
        # Execute commands via agent relay
        results = []
        for cmd in commands:
            try:
                result = await _agent_relay.execute_mcp_tool(
                    cmd["tool"],
                    cmd["params"]
                )
                results.append({"tool": cmd["tool"], "success": True, "result": result})
            except Exception as e:
                results.append({"tool": cmd["tool"], "success": False, "error": str(e)})
                logger.warning(f"Failed to execute {cmd['tool']}: {e}")
        
        # Check if majority succeeded
        success_count = sum(1 for r in results if r.get("success", False))
        overall_success = success_count >= len(commands) // 2
        
        return LightingResponse(
            success=overall_success,
            message=f"Applied preset '{request.preset_id}' ({success_count}/{len(commands)} operations succeeded)",
            preset_id=request.preset_id,
            settings_applied=settings.dict()
        )
        
    except Exception as e:
        logger.error(f"Failed to apply lighting preset: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply lighting: {str(e)}"
        )


@router.post("/apply-custom", response_model=LightingResponse)
async def apply_custom_lighting(
    request: ApplyCustomRequest,

):
    """Apply custom lighting settings to the UE5 scene."""
    # Reuse the apply preset logic with a custom preset ID
    preset_request = ApplyPresetRequest(
        preset_id="custom",
        settings=request.settings
    )
    return await apply_lighting_preset(preset_request, current_user)


@router.post("/time-of-day", response_model=LightingResponse)
async def set_time_of_day(
    request: TimeOfDayRequest,

):
    """
    Set the time of day in the UE5 scene.
    
    Optionally animate the transition for smooth day/night cycles.
    """
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        result = await _agent_relay.execute_mcp_tool(
            "set_sun_position",
            {
                "time_of_day": request.time,
                "animate": request.animate,
                "duration": request.duration if request.animate else 0
            }
        )
        
        return LightingResponse(
            success=True,
            message=f"Time of day set to {request.time:.1f}h",
            settings_applied={"time_of_day": request.time}
        )
        
    except Exception as e:
        logger.error(f"Failed to set time of day: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set time of day: {str(e)}"
        )


@router.post("/hdri", response_model=LightingResponse)
async def set_hdri_sky(
    request: HDRIRequest,

):
    """Set the HDRI sky background."""
    global _agent_relay
    
    if not _agent_relay:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent relay service not available"
        )
    
    try:
        result = await _agent_relay.execute_mcp_tool(
            "set_hdri_sky",
            {
                "asset": request.hdri_asset,
                "intensity": request.intensity,
                "rotation": request.rotation
            }
        )
        
        return LightingResponse(
            success=True,
            message=f"HDRI sky set to '{request.hdri_asset}'",
            settings_applied={
                "hdri_asset": request.hdri_asset,
                "intensity": request.intensity,
                "rotation": request.rotation
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to set HDRI sky: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set HDRI sky: {str(e)}"
        )


@router.post("/suggest", response_model=List[AILightingSuggestion])
async def get_ai_lighting_suggestions(
    request: AILightingRequest,

):
    """
    Get AI-powered lighting suggestions based on scene description or mood.
    
    The AI will analyze the request and suggest appropriate lighting presets
    with explanations for each recommendation.
    """
    suggestions = []
    
    # Mood-based suggestions
    mood_presets = {
        "dramatic": ["studio-dramatic", "cinematic-noir", "mood-mysterious"],
        "peaceful": ["mood-peaceful", "outdoor-sunny", "outdoor-golden-hour"],
        "romantic": ["mood-romantic", "outdoor-golden-hour"],
        "scary": ["mood-horror", "cinematic-noir"],
        "futuristic": ["cinematic-scifi"],
        "natural": ["outdoor-sunny", "outdoor-overcast", "outdoor-golden-hour"],
        "cinematic": ["cinematic-blockbuster", "cinematic-noir", "cinematic-scifi"],
        "studio": ["studio-three-point", "studio-soft", "studio-dramatic"],
    }
    
    # Default presets for lighting suggestions
    preset_data = {
        "studio-three-point": {
            "name": "Three-Point Lighting",
            "description": "Classic studio setup with key, fill, and back lights",
            "settings": LightingSettings(
                time_of_day=12, sun_intensity=0.3, sun_color="#FFFFFF",
                sky_intensity=0.5, sky_color="#87CEEB", ambient_intensity=0.4,
                shadow_intensity=0.8, bloom_intensity=0.2, temperature=5500
            )
        },
        "outdoor-golden-hour": {
            "name": "Golden Hour",
            "description": "Warm, magical lighting just before sunset",
            "settings": LightingSettings(
                time_of_day=17.5, sun_intensity=0.8, sun_color="#FFB347",
                sky_intensity=0.7, sky_color="#FFD700", ambient_intensity=0.5,
                shadow_intensity=0.7, bloom_intensity=0.4, temperature=3500
            )
        },
        "mood-horror": {
            "name": "Horror",
            "description": "Dark, unsettling atmosphere",
            "settings": LightingSettings(
                time_of_day=2, sun_intensity=0.02, sun_color="#400000",
                sky_intensity=0.05, sky_color="#0A0000", ambient_intensity=0.08,
                shadow_intensity=1.0, bloom_intensity=0.2, temperature=2500
            )
        },
        "cinematic-scifi": {
            "name": "Sci-Fi",
            "description": "Futuristic neon-lit atmosphere",
            "settings": LightingSettings(
                time_of_day=21, sun_intensity=0.05, sun_color="#00FFFF",
                sky_intensity=0.2, sky_color="#0A0A30", ambient_intensity=0.25,
                shadow_intensity=0.6, bloom_intensity=0.6, temperature=7000
            )
        },
    }
    
    # Determine relevant presets based on mood
    relevant_presets = []
    if request.mood:
        mood_lower = request.mood.lower()
        for mood_key, presets in mood_presets.items():
            if mood_key in mood_lower:
                relevant_presets.extend(presets)
    
    # If no mood match, suggest based on scene description
    if not relevant_presets and request.scene_description:
        desc_lower = request.scene_description.lower()
        if any(word in desc_lower for word in ["indoor", "studio", "product", "portrait"]):
            relevant_presets = ["studio-three-point", "studio-soft"]
        elif any(word in desc_lower for word in ["outdoor", "nature", "landscape"]):
            relevant_presets = ["outdoor-sunny", "outdoor-golden-hour"]
        elif any(word in desc_lower for word in ["night", "dark", "horror"]):
            relevant_presets = ["mood-horror", "outdoor-night"]
        else:
            relevant_presets = ["studio-three-point", "outdoor-golden-hour"]
    
    # Default suggestions if nothing matched
    if not relevant_presets:
        relevant_presets = ["studio-three-point", "outdoor-golden-hour", "cinematic-blockbuster"]
    
    # Build suggestions
    for i, preset_id in enumerate(relevant_presets[:3]):
        if preset_id in preset_data:
            data = preset_data[preset_id]
            suggestions.append(AILightingSuggestion(
                preset_id=preset_id,
                name=data["name"],
                description=data["description"],
                confidence=0.9 - (i * 0.15),
                reasoning=f"Recommended based on {'mood: ' + request.mood if request.mood else 'scene analysis'}",
                settings=data["settings"]
            ))
    
    return suggestions


@router.get("/presets")
async def list_lighting_presets(

):
    """List all available lighting presets."""
    presets = [
        {"id": "studio-three-point", "name": "Three-Point Lighting", "category": "studio"},
        {"id": "studio-soft", "name": "Soft Studio", "category": "studio"},
        {"id": "studio-dramatic", "name": "Dramatic Studio", "category": "studio"},
        {"id": "outdoor-sunny", "name": "Sunny Day", "category": "outdoor"},
        {"id": "outdoor-golden-hour", "name": "Golden Hour", "category": "outdoor"},
        {"id": "outdoor-overcast", "name": "Overcast", "category": "outdoor"},
        {"id": "outdoor-night", "name": "Moonlit Night", "category": "outdoor"},
        {"id": "cinematic-noir", "name": "Film Noir", "category": "cinematic"},
        {"id": "cinematic-blockbuster", "name": "Blockbuster", "category": "cinematic"},
        {"id": "cinematic-scifi", "name": "Sci-Fi", "category": "cinematic"},
        {"id": "mood-romantic", "name": "Romantic", "category": "mood"},
        {"id": "mood-horror", "name": "Horror", "category": "mood"},
        {"id": "mood-peaceful", "name": "Peaceful", "category": "mood"},
        {"id": "mood-mysterious", "name": "Mysterious", "category": "mood"},
    ]
    return {"presets": presets, "count": len(presets)}


@router.get("/hdri-options")
async def list_hdri_options(

):
    """List available HDRI sky options."""
    hdri_options = [
        {"id": "studio_small_08", "name": "Studio Small", "category": "studio"},
        {"id": "photo_studio_01", "name": "Photo Studio", "category": "studio"},
        {"id": "venice_sunset", "name": "Venice Sunset", "category": "outdoor"},
        {"id": "kloppenheim_02", "name": "Kloppenheim", "category": "outdoor"},
        {"id": "industrial_sunset_02", "name": "Industrial Sunset", "category": "outdoor"},
        {"id": "moonless_golf", "name": "Moonless Golf", "category": "night"},
        {"id": "night_bridge", "name": "Night Bridge", "category": "night"},
        {"id": "abandoned_parking", "name": "Abandoned Parking", "category": "urban"},
    ]
    return {"hdri_options": hdri_options, "count": len(hdri_options)}
