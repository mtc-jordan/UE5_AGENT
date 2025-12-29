"""
AI Scene Generator API Endpoints
================================

Provides endpoints for AI-powered scene generation in UE5:
- Text-to-scene generation
- Scene planning with AI
- Batch object spawning
- Scene templates management
- Generation progress tracking
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import logging
import asyncio
import uuid
import json

# from services.auth import get_current_user
# from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scene-generator", tags=["scene-generator"])

# Store agent relay service reference
_agent_relay = None

def set_agent_relay_service(relay):
    """Set the agent relay service for MCP communication."""
    global _agent_relay
    _agent_relay = relay


# ==================== ENUMS ====================

class GenerationStatus(str, Enum):
    PENDING = "pending"
    PLANNING = "planning"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ObjectType(str, Enum):
    MESH = "mesh"
    LIGHT = "light"
    CAMERA = "camera"
    EFFECT = "effect"
    AUDIO = "audio"


class ObjectStatus(str, Enum):
    PENDING = "pending"
    SPAWNING = "spawning"
    SPAWNED = "spawned"
    ERROR = "error"


# ==================== SCHEMAS ====================

class Vector3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class Rotator(BaseModel):
    pitch: float = 0.0
    yaw: float = 0.0
    roll: float = 0.0


class SceneObject(BaseModel):
    """An object to be spawned in the scene."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: ObjectType
    name: str
    asset_path: str
    position: Vector3 = Field(default_factory=Vector3)
    rotation: Rotator = Field(default_factory=Rotator)
    scale: Vector3 = Field(default_factory=lambda: Vector3(x=1, y=1, z=1))
    properties: Dict[str, Any] = Field(default_factory=dict)
    status: ObjectStatus = ObjectStatus.PENDING


class LightingConfig(BaseModel):
    """Lighting configuration for the scene."""
    preset: str = "natural"
    intensity: float = 1.0
    color: str = "#FFFFFF"
    time_of_day: float = 12.0
    use_hdri: bool = False
    hdri_asset: Optional[str] = None


class PostProcessConfig(BaseModel):
    """Post-process configuration for the scene."""
    enabled: bool = True
    preset: str = "cinematic"
    bloom_intensity: float = 0.5
    exposure: float = 1.0
    contrast: float = 1.0
    saturation: float = 1.0


class ScenePlan(BaseModel):
    """A complete scene generation plan."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    style: str = "realistic"
    mood: str = "peaceful"
    time_of_day: str = "morning"
    weather: str = "clear"
    objects: List[SceneObject] = Field(default_factory=list)
    lighting: LightingConfig = Field(default_factory=LightingConfig)
    post_process: PostProcessConfig = Field(default_factory=PostProcessConfig)
    estimated_time: int = 0
    total_objects: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GenerationStep(BaseModel):
    """A step in the generation process."""
    id: str
    name: str
    description: str
    status: str = "pending"
    progress: int = 0
    objects_spawned: int = 0
    total_objects: int = 0


class GenerationProgress(BaseModel):
    """Progress of scene generation."""
    job_id: str
    status: GenerationStatus
    current_step: int = 0
    total_steps: int = 0
    steps: List[GenerationStep] = Field(default_factory=list)
    objects_spawned: int = 0
    total_objects: int = 0
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class GenerateSceneRequest(BaseModel):
    """Request to generate a scene from a prompt."""
    prompt: str = Field(..., min_length=10, max_length=2000)
    style: str = Field("realistic", description="Visual style: realistic, stylized, low-poly, cartoon")
    mood: str = Field("peaceful", description="Scene mood: peaceful, dramatic, mysterious, cheerful, dark, romantic")
    time_of_day: str = Field("morning", description="Time: dawn, morning, noon, golden-hour, dusk, night")
    weather: str = Field("clear", description="Weather: clear, cloudy, rainy, foggy, snowy, stormy")
    clear_existing: bool = Field(True, description="Clear existing scene before generating")
    template_id: Optional[str] = Field(None, description="Optional template ID to use as base")


class SceneTemplate(BaseModel):
    """A scene template for quick generation."""
    id: str
    name: str
    description: str
    category: str
    prompt: str
    tags: List[str] = Field(default_factory=list)
    thumbnail: Optional[str] = None
    created_by: Optional[int] = None
    is_public: bool = True
    use_count: int = 0


class GenerateSceneResponse(BaseModel):
    """Response from scene generation request."""
    job_id: str
    status: GenerationStatus
    plan: Optional[ScenePlan] = None
    message: str


# ==================== IN-MEMORY STORAGE ====================

# Active generation jobs
_generation_jobs: Dict[str, GenerationProgress] = {}

# Scene plans
_scene_plans: Dict[str, ScenePlan] = {}

# Default templates
DEFAULT_TEMPLATES: List[SceneTemplate] = [
    SceneTemplate(
        id="medieval-castle",
        name="Medieval Castle Courtyard",
        description="A grand castle courtyard with stone walls, towers, and medieval decorations",
        category="environment",
        prompt="Create a medieval castle courtyard with stone walls, a central fountain, guard towers, wooden crates, barrels, torches on the walls, a drawbridge entrance, and cobblestone floor",
        tags=["medieval", "castle", "fantasy"],
    ),
    SceneTemplate(
        id="scifi-spaceship",
        name="Sci-Fi Spaceship Interior",
        description="Futuristic spaceship interior with control panels and holographic displays",
        category="environment",
        prompt="Create a sci-fi spaceship interior with a central command bridge, holographic displays, control panels, captain chair, crew stations, glowing floor panels, and large viewport windows showing space",
        tags=["scifi", "spaceship", "futuristic"],
    ),
    SceneTemplate(
        id="forest-clearing",
        name="Enchanted Forest Clearing",
        description="A magical forest clearing with ancient trees and mystical elements",
        category="environment",
        prompt="Create an enchanted forest clearing with giant ancient trees, glowing mushrooms, a small stream, moss-covered rocks, fireflies, fallen logs, and mystical fog",
        tags=["forest", "nature", "fantasy"],
    ),
    SceneTemplate(
        id="modern-office",
        name="Modern Office Space",
        description="Contemporary open-plan office with workstations and meeting areas",
        category="interior",
        prompt="Create a modern open-plan office with multiple workstations, ergonomic chairs, large monitors, a glass-walled meeting room, lounge area with sofas, indoor plants, and large windows",
        tags=["modern", "office", "interior"],
    ),
    SceneTemplate(
        id="cyberpunk-alley",
        name="Cyberpunk City Alley",
        description="Neon-lit urban alley with futuristic elements",
        category="environment",
        prompt="Create a cyberpunk city alley with neon signs, holographic advertisements, steam vents, dumpsters, graffiti walls, flying drones, rain puddles reflecting lights, and vending machines",
        tags=["cyberpunk", "urban", "neon"],
    ),
]


# ==================== HELPER FUNCTIONS ====================

async def generate_scene_plan_with_ai(
    prompt: str,
    style: str,
    mood: str,
    time_of_day: str,
    weather: str
) -> ScenePlan:
    """
    Generate a scene plan using AI based on the prompt.
    
    In production, this would call an LLM to generate the scene plan.
    For now, we generate a structured plan based on keywords.
    """
    # Parse the prompt to identify key elements
    prompt_lower = prompt.lower()
    
    objects: List[SceneObject] = []
    object_id = 1
    
    # Base structure - floor
    objects.append(SceneObject(
        id=str(object_id),
        type=ObjectType.MESH,
        name="Floor",
        asset_path="/Game/Meshes/SM_Floor_Large",
        position=Vector3(x=0, y=0, z=0),
        scale=Vector3(x=20, y=20, z=1),
    ))
    object_id += 1
    
    # Detect environment type and add appropriate objects
    if any(word in prompt_lower for word in ["castle", "medieval", "fortress"]):
        # Castle elements
        objects.extend([
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Castle_Wall_North",
                       asset_path="/Game/Meshes/SM_Castle_Wall", position=Vector3(x=0, y=1000, z=200),
                       scale=Vector3(x=20, y=1, z=4)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Castle_Wall_South",
                       asset_path="/Game/Meshes/SM_Castle_Wall", position=Vector3(x=0, y=-1000, z=200),
                       rotation=Rotator(yaw=180), scale=Vector3(x=20, y=1, z=4)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Castle_Tower_1",
                       asset_path="/Game/Meshes/SM_Castle_Tower", position=Vector3(x=-800, y=800, z=0),
                       scale=Vector3(x=2, y=2, z=3)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Castle_Tower_2",
                       asset_path="/Game/Meshes/SM_Castle_Tower", position=Vector3(x=800, y=800, z=0),
                       scale=Vector3(x=2, y=2, z=3)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Fountain",
                       asset_path="/Game/Meshes/SM_Fountain", position=Vector3(x=0, y=0, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Barrel_1",
                       asset_path="/Game/Meshes/SM_Barrel", position=Vector3(x=300, y=200, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Barrel_2",
                       asset_path="/Game/Meshes/SM_Barrel", position=Vector3(x=350, y=180, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Crate_1",
                       asset_path="/Game/Meshes/SM_Crate", position=Vector3(x=-300, y=150, z=0)),
        ])
        
    elif any(word in prompt_lower for word in ["spaceship", "sci-fi", "futuristic", "space"]):
        # Sci-fi elements
        objects.extend([
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Bridge_Console",
                       asset_path="/Game/Meshes/SM_SciFi_Console", position=Vector3(x=0, y=200, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Captain_Chair",
                       asset_path="/Game/Meshes/SM_SciFi_Chair", position=Vector3(x=0, y=0, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Crew_Station_1",
                       asset_path="/Game/Meshes/SM_SciFi_Station", position=Vector3(x=-300, y=100, z=0),
                       rotation=Rotator(yaw=30)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Crew_Station_2",
                       asset_path="/Game/Meshes/SM_SciFi_Station", position=Vector3(x=300, y=100, z=0),
                       rotation=Rotator(yaw=-30)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Viewport_Window",
                       asset_path="/Game/Meshes/SM_SciFi_Window", position=Vector3(x=0, y=500, z=150),
                       scale=Vector3(x=10, y=1, z=3)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.EFFECT, name="Hologram_Display",
                       asset_path="/Game/Effects/P_Hologram", position=Vector3(x=0, y=200, z=100)),
        ])
        
    elif any(word in prompt_lower for word in ["forest", "tree", "nature", "woods"]):
        # Forest elements
        objects.extend([
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Tree_Large_1",
                       asset_path="/Game/Meshes/SM_Tree_Large", position=Vector3(x=-400, y=300, z=0),
                       scale=Vector3(x=2, y=2, z=2)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Tree_Large_2",
                       asset_path="/Game/Meshes/SM_Tree_Large", position=Vector3(x=500, y=-200, z=0),
                       scale=Vector3(x=1.8, y=1.8, z=2.2)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Tree_Medium_1",
                       asset_path="/Game/Meshes/SM_Tree_Medium", position=Vector3(x=200, y=400, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Rock_1",
                       asset_path="/Game/Meshes/SM_Rock_Large", position=Vector3(x=-200, y=-100, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Rock_2",
                       asset_path="/Game/Meshes/SM_Rock_Medium", position=Vector3(x=100, y=-300, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Mushroom_Cluster",
                       asset_path="/Game/Meshes/SM_Mushrooms", position=Vector3(x=-100, y=50, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.EFFECT, name="Fireflies",
                       asset_path="/Game/Effects/P_Fireflies", position=Vector3(x=0, y=0, z=100)),
        ])
        
    elif any(word in prompt_lower for word in ["office", "modern", "workspace"]):
        # Office elements
        objects.extend([
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Desk_1",
                       asset_path="/Game/Meshes/SM_Office_Desk", position=Vector3(x=-200, y=0, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Desk_2",
                       asset_path="/Game/Meshes/SM_Office_Desk", position=Vector3(x=200, y=0, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Chair_1",
                       asset_path="/Game/Meshes/SM_Office_Chair", position=Vector3(x=-200, y=-80, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Chair_2",
                       asset_path="/Game/Meshes/SM_Office_Chair", position=Vector3(x=200, y=-80, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Monitor_1",
                       asset_path="/Game/Meshes/SM_Monitor", position=Vector3(x=-200, y=30, z=75)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Monitor_2",
                       asset_path="/Game/Meshes/SM_Monitor", position=Vector3(x=200, y=30, z=75)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Plant_1",
                       asset_path="/Game/Meshes/SM_Plant_Pot", position=Vector3(x=400, y=200, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Sofa",
                       asset_path="/Game/Meshes/SM_Sofa", position=Vector3(x=0, y=400, z=0),
                       rotation=Rotator(yaw=180)),
        ])
    
    else:
        # Generic scene with basic props
        objects.extend([
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Table",
                       asset_path="/Game/Meshes/SM_Table", position=Vector3(x=0, y=0, z=0)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Chair_1",
                       asset_path="/Game/Meshes/SM_Chair", position=Vector3(x=100, y=0, z=0),
                       rotation=Rotator(yaw=-90)),
            SceneObject(id=str(object_id := object_id + 1), type=ObjectType.MESH, name="Chair_2",
                       asset_path="/Game/Meshes/SM_Chair", position=Vector3(x=-100, y=0, z=0),
                       rotation=Rotator(yaw=90)),
        ])
    
    # Add lighting based on mood and time
    time_hours = {
        "dawn": 6, "morning": 9, "noon": 12,
        "golden-hour": 17, "dusk": 19, "night": 22
    }.get(time_of_day, 12)
    
    light_color = {
        "dawn": "#FFB366",
        "morning": "#FFF5E6",
        "noon": "#FFFFFF",
        "golden-hour": "#FFD700",
        "dusk": "#FF6B6B",
        "night": "#4169E1"
    }.get(time_of_day, "#FFFFFF")
    
    objects.append(SceneObject(
        id=str(object_id := object_id + 1),
        type=ObjectType.LIGHT,
        name="Sun_Light",
        asset_path="/Engine/Lights/DirectionalLight",
        position=Vector3(x=0, y=0, z=1000),
        rotation=Rotator(pitch=-45, yaw=45, roll=0),
        properties={"intensity": 10.0, "color": light_color}
    ))
    
    # Add ambient light
    objects.append(SceneObject(
        id=str(object_id := object_id + 1),
        type=ObjectType.LIGHT,
        name="Ambient_Light",
        asset_path="/Engine/Lights/SkyLight",
        position=Vector3(x=0, y=0, z=500),
        properties={"intensity": 1.0}
    ))
    
    # Add atmosphere effect based on weather
    if weather in ["foggy", "rainy", "stormy"]:
        objects.append(SceneObject(
            id=str(object_id := object_id + 1),
            type=ObjectType.EFFECT,
            name="Atmosphere_Fog",
            asset_path="/Game/Effects/P_Fog",
            position=Vector3(x=0, y=0, z=100),
            properties={"density": 0.5 if weather == "foggy" else 0.2}
        ))
    
    if weather in ["rainy", "stormy"]:
        objects.append(SceneObject(
            id=str(object_id := object_id + 1),
            type=ObjectType.EFFECT,
            name="Rain_Effect",
            asset_path="/Game/Effects/P_Rain",
            position=Vector3(x=0, y=0, z=500),
        ))
    
    if weather == "snowy":
        objects.append(SceneObject(
            id=str(object_id := object_id + 1),
            type=ObjectType.EFFECT,
            name="Snow_Effect",
            asset_path="/Game/Effects/P_Snow",
            position=Vector3(x=0, y=0, z=500),
        ))
    
    # Create the scene plan
    plan = ScenePlan(
        name=f"Generated Scene - {style.title()} {mood.title()}",
        description=prompt,
        style=style,
        mood=mood,
        time_of_day=time_of_day,
        weather=weather,
        objects=objects,
        lighting=LightingConfig(
            preset=mood if mood in ["dramatic", "romantic", "mysterious"] else "natural",
            intensity=1.0,
            color=light_color,
            time_of_day=time_hours
        ),
        post_process=PostProcessConfig(
            enabled=True,
            preset="stylized" if style == "stylized" else "cinematic"
        ),
        estimated_time=len(objects) * 2,
        total_objects=len(objects)
    )
    
    return plan


async def execute_scene_generation(
    job_id: str,
    plan: ScenePlan,
    clear_existing: bool
):
    """
    Execute the scene generation in the background.
    
    This spawns all objects in the plan to UE5.
    """
    global _agent_relay, _generation_jobs
    
    job = _generation_jobs.get(job_id)
    if not job:
        return
    
    job.status = GenerationStatus.GENERATING
    job.started_at = datetime.utcnow()
    
    # Define generation steps
    steps = [
        GenerationStep(
            id="setup",
            name="Scene Setup",
            description="Preparing scene and clearing existing objects",
            total_objects=0
        ),
        GenerationStep(
            id="structure",
            name="Structure",
            description="Spawning floors, walls, and structural elements",
            total_objects=len([o for o in plan.objects if o.type == ObjectType.MESH and 
                             any(x in o.name.lower() for x in ["floor", "wall", "ceiling"])])
        ),
        GenerationStep(
            id="lighting",
            name="Lighting",
            description="Setting up lights and atmosphere",
            total_objects=len([o for o in plan.objects if o.type == ObjectType.LIGHT])
        ),
        GenerationStep(
            id="props",
            name="Props & Furniture",
            description="Placing props and decorative elements",
            total_objects=len([o for o in plan.objects if o.type == ObjectType.MESH and 
                             not any(x in o.name.lower() for x in ["floor", "wall", "ceiling"])])
        ),
        GenerationStep(
            id="effects",
            name="Effects",
            description="Adding particle effects and ambiance",
            total_objects=len([o for o in plan.objects if o.type in [ObjectType.EFFECT, ObjectType.AUDIO]])
        ),
        GenerationStep(
            id="finalize",
            name="Finalize",
            description="Applying post-process and final adjustments",
            total_objects=0
        ),
    ]
    
    job.steps = steps
    job.total_steps = len(steps)
    job.total_objects = plan.total_objects
    
    try:
        for step_idx, step in enumerate(steps):
            job.current_step = step_idx
            step.status = "running"
            
            if step.id == "setup":
                # Clear existing scene if requested
                if clear_existing and _agent_relay:
                    try:
                        await _agent_relay.execute_mcp_tool("clear_scene", {})
                    except Exception as e:
                        logger.warning(f"Failed to clear scene: {e}")
                
                step.progress = 100
                step.status = "completed"
                
            elif step.id == "structure":
                # Spawn structural elements
                structural = [o for o in plan.objects if o.type == ObjectType.MESH and 
                            any(x in o.name.lower() for x in ["floor", "wall", "ceiling"])]
                await spawn_objects(structural, step, job)
                
            elif step.id == "lighting":
                # Spawn lights
                lights = [o for o in plan.objects if o.type == ObjectType.LIGHT]
                await spawn_objects(lights, step, job)
                
                # Apply lighting preset
                if _agent_relay:
                    try:
                        await _agent_relay.execute_mcp_tool("set_time_of_day", {
                            "time": plan.lighting.time_of_day
                        })
                    except Exception as e:
                        logger.warning(f"Failed to set time of day: {e}")
                
            elif step.id == "props":
                # Spawn props
                props = [o for o in plan.objects if o.type == ObjectType.MESH and 
                        not any(x in o.name.lower() for x in ["floor", "wall", "ceiling"])]
                await spawn_objects(props, step, job)
                
            elif step.id == "effects":
                # Spawn effects
                effects = [o for o in plan.objects if o.type in [ObjectType.EFFECT, ObjectType.AUDIO]]
                await spawn_objects(effects, step, job)
                
            elif step.id == "finalize":
                # Apply post-process settings
                if _agent_relay and plan.post_process.enabled:
                    try:
                        await _agent_relay.execute_mcp_tool("set_post_process", {
                            "preset": plan.post_process.preset,
                            "bloom": plan.post_process.bloom_intensity,
                            "exposure": plan.post_process.exposure
                        })
                    except Exception as e:
                        logger.warning(f"Failed to apply post-process: {e}")
                
                step.progress = 100
                step.status = "completed"
            
            # Small delay between steps
            await asyncio.sleep(0.5)
        
        job.status = GenerationStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        
    except Exception as e:
        logger.error(f"Scene generation failed: {e}")
        job.status = GenerationStatus.FAILED
        job.error_message = str(e)


async def spawn_objects(
    objects: List[SceneObject],
    step: GenerationStep,
    job: GenerationProgress
):
    """Spawn a list of objects and update progress."""
    global _agent_relay
    
    for idx, obj in enumerate(objects):
        obj.status = ObjectStatus.SPAWNING
        
        # Spawn the object via MCP
        if _agent_relay:
            try:
                await _agent_relay.execute_mcp_tool("spawn_actor", {
                    "actor_class": obj.asset_path,
                    "location": {"x": obj.position.x, "y": obj.position.y, "z": obj.position.z},
                    "rotation": {"pitch": obj.rotation.pitch, "yaw": obj.rotation.yaw, "roll": obj.rotation.roll},
                    "scale": {"x": obj.scale.x, "y": obj.scale.y, "z": obj.scale.z},
                    "name": obj.name
                })
                obj.status = ObjectStatus.SPAWNED
            except Exception as e:
                logger.warning(f"Failed to spawn {obj.name}: {e}")
                obj.status = ObjectStatus.ERROR
        else:
            # Simulate spawning
            await asyncio.sleep(0.3)
            obj.status = ObjectStatus.SPAWNED
        
        step.objects_spawned = idx + 1
        step.progress = int((idx + 1) / len(objects) * 100) if objects else 100
        job.objects_spawned += 1
    
    step.status = "completed"


# ==================== ENDPOINTS ====================

@router.post("/generate", response_model=GenerateSceneResponse)
async def generate_scene(
    request: GenerateSceneRequest,
    background_tasks: BackgroundTasks,

):
    """
    Generate a scene from a text prompt.
    
    This endpoint:
    1. Creates a scene plan using AI
    2. Returns the plan for preview
    3. Optionally starts generation in the background
    """
    try:
        # Generate scene plan
        plan = await generate_scene_plan_with_ai(
            prompt=request.prompt,
            style=request.style,
            mood=request.mood,
            time_of_day=request.time_of_day,
            weather=request.weather
        )
        
        # Store the plan
        _scene_plans[plan.id] = plan
        
        # Create a generation job
        job_id = str(uuid.uuid4())
        job = GenerationProgress(
            job_id=job_id,
            status=GenerationStatus.PLANNING,
            total_objects=plan.total_objects
        )
        _generation_jobs[job_id] = job
        
        return GenerateSceneResponse(
            job_id=job_id,
            status=GenerationStatus.PLANNING,
            plan=plan,
            message=f"Scene plan created with {plan.total_objects} objects"
        )
        
    except Exception as e:
        logger.error(f"Failed to generate scene plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate scene plan: {str(e)}"
        )


@router.post("/execute/{job_id}")
async def execute_generation(
    job_id: str,
    background_tasks: BackgroundTasks,
    clear_existing: bool = True,

):
    """
    Start executing a scene generation job.
    """
    job = _generation_jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation job not found"
        )
    
    # Find the associated plan
    plan = None
    for p in _scene_plans.values():
        if any(j.job_id == job_id for j in [job]):
            plan = p
            break
    
    if not plan:
        # Try to find by matching job creation time
        for p in _scene_plans.values():
            plan = p
            break
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scene plan not found"
        )
    
    # Start generation in background
    background_tasks.add_task(execute_scene_generation, job_id, plan, clear_existing)
    
    return {"message": "Generation started", "job_id": job_id}


@router.get("/progress/{job_id}", response_model=GenerationProgress)
async def get_generation_progress(
    job_id: str,

):
    """
    Get the progress of a scene generation job.
    """
    job = _generation_jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation job not found"
        )
    
    return job


@router.post("/cancel/{job_id}")
async def cancel_generation(
    job_id: str,

):
    """
    Cancel a scene generation job.
    """
    job = _generation_jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation job not found"
        )
    
    if job.status in [GenerationStatus.COMPLETED, GenerationStatus.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel completed or failed job"
        )
    
    job.status = GenerationStatus.CANCELLED
    return {"message": "Generation cancelled", "job_id": job_id}


@router.get("/templates", response_model=List[SceneTemplate])
async def get_templates(
    category: Optional[str] = None,

):
    """
    Get available scene templates.
    """
    templates = DEFAULT_TEMPLATES
    
    if category:
        templates = [t for t in templates if t.category == category]
    
    return templates


@router.get("/templates/{template_id}", response_model=SceneTemplate)
async def get_template(
    template_id: str,

):
    """
    Get a specific scene template.
    """
    template = next((t for t in DEFAULT_TEMPLATES if t.id == template_id), None)
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    return template


@router.get("/plans/{plan_id}", response_model=ScenePlan)
async def get_scene_plan(
    plan_id: str,

):
    """
    Get a specific scene plan.
    """
    plan = _scene_plans.get(plan_id)
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scene plan not found"
        )
    
    return plan
