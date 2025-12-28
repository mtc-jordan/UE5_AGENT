"""
Scene Builder Service

Multi-step scene creation with intelligent parsing and spatial arrangement.
Enables complex scene creation from natural language prompts like:
"Create a living room with a sofa, coffee table, and two lamps"

Features:
- AI-powered scene parsing using GPT
- Intelligent spatial arrangement
- Progress tracking for each step
- Automatic positioning based on room type and furniture relationships
- Support for common room types and furniture presets
"""

import json
import asyncio
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import os

try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None


class SceneStatus(str, Enum):
    """Status of a scene building operation"""
    PENDING = "pending"
    PARSING = "parsing"
    PLANNING = "planning"
    BUILDING = "building"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, Enum):
    """Status of an individual build step"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class SceneObject:
    """Represents an object to be placed in the scene"""
    id: str
    name: str
    type: str  # e.g., "furniture", "lighting", "decoration"
    asset_path: str
    position: Dict[str, float]  # x, y, z
    rotation: Dict[str, float]  # pitch, yaw, roll
    scale: Dict[str, float]  # x, y, z
    properties: Dict[str, Any] = field(default_factory=dict)
    parent_id: Optional[str] = None  # For hierarchical placement
    

@dataclass
class BuildStep:
    """Represents a single step in the scene building process"""
    id: str
    order: int
    action: str  # "spawn", "position", "configure"
    object: SceneObject
    status: StepStatus = StepStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class SceneBuildPlan:
    """Complete plan for building a scene"""
    id: str
    prompt: str
    room_type: str
    description: str
    objects: List[SceneObject]
    steps: List[BuildStep]
    status: SceneStatus = SceneStatus.PENDING
    progress: float = 0.0
    current_step: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


# Common furniture presets with default dimensions and asset paths
FURNITURE_PRESETS = {
    # Living Room
    "sofa": {
        "type": "furniture",
        "asset_paths": [
            "/Game/StarterContent/Props/SM_Couch.SM_Couch",
            "/Game/Furniture/Sofa/SM_Sofa.SM_Sofa",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 200, "depth": 90},  # cm
        "facing": "forward",
    },
    "coffee_table": {
        "type": "furniture",
        "asset_paths": [
            "/Game/StarterContent/Props/SM_TableRound.SM_TableRound",
            "/Game/Furniture/Tables/SM_CoffeeTable.SM_CoffeeTable",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 120, "depth": 60},
        "facing": "none",
    },
    "lamp": {
        "type": "lighting",
        "asset_paths": [
            "/Game/StarterContent/Props/SM_Lamp_Ceiling.SM_Lamp_Ceiling",
            "/Game/Furniture/Lighting/SM_FloorLamp.SM_FloorLamp",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 40, "depth": 40},
        "facing": "none",
    },
    "armchair": {
        "type": "furniture",
        "asset_paths": [
            "/Game/StarterContent/Props/SM_Chair.SM_Chair",
            "/Game/Furniture/Chairs/SM_Armchair.SM_Armchair",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 80, "depth": 80},
        "facing": "forward",
    },
    "tv": {
        "type": "electronics",
        "asset_paths": [
            "/Game/StarterContent/Props/SM_TV.SM_TV",
            "/Game/Electronics/SM_FlatscreenTV.SM_FlatscreenTV",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 120, "depth": 10},
        "facing": "forward",
    },
    "bookshelf": {
        "type": "furniture",
        "asset_paths": [
            "/Game/StarterContent/Props/SM_Shelf.SM_Shelf",
            "/Game/Furniture/Storage/SM_Bookshelf.SM_Bookshelf",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 100, "depth": 30},
        "facing": "wall",
    },
    "rug": {
        "type": "decoration",
        "asset_paths": [
            "/Game/Furniture/Rugs/SM_Rug.SM_Rug",
            "/Game/StarterContent/Props/SM_Rug.SM_Rug",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 200, "depth": 150},
        "facing": "none",
    },
    # Bedroom
    "bed": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Bedroom/SM_Bed.SM_Bed",
            "/Game/StarterContent/Props/SM_Bed.SM_Bed",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 200, "depth": 220},
        "facing": "wall",
    },
    "nightstand": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Bedroom/SM_Nightstand.SM_Nightstand",
            "/Game/StarterContent/Props/SM_TableSmall.SM_TableSmall",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 50, "depth": 40},
        "facing": "none",
    },
    "dresser": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Bedroom/SM_Dresser.SM_Dresser",
            "/Game/StarterContent/Props/SM_Cabinet.SM_Cabinet",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 120, "depth": 50},
        "facing": "wall",
    },
    # Dining Room
    "dining_table": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Dining/SM_DiningTable.SM_DiningTable",
            "/Game/StarterContent/Props/SM_TableRound.SM_TableRound",
        ],
        "default_scale": {"x": 1.5, "y": 1.5, "z": 1.0},
        "footprint": {"width": 180, "depth": 90},
        "facing": "none",
    },
    "dining_chair": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Dining/SM_DiningChair.SM_DiningChair",
            "/Game/StarterContent/Props/SM_Chair.SM_Chair",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 45, "depth": 45},
        "facing": "table",
    },
    # Office
    "desk": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Office/SM_Desk.SM_Desk",
            "/Game/StarterContent/Props/SM_TableRound.SM_TableRound",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 150, "depth": 75},
        "facing": "wall",
    },
    "office_chair": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Office/SM_OfficeChair.SM_OfficeChair",
            "/Game/StarterContent/Props/SM_Chair.SM_Chair",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 60, "depth": 60},
        "facing": "desk",
    },
    "computer": {
        "type": "electronics",
        "asset_paths": [
            "/Game/Electronics/SM_Computer.SM_Computer",
            "/Game/StarterContent/Props/SM_TV.SM_TV",
        ],
        "default_scale": {"x": 0.5, "y": 0.5, "z": 0.5},
        "footprint": {"width": 50, "depth": 30},
        "facing": "user",
    },
    # Kitchen
    "kitchen_table": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Kitchen/SM_KitchenTable.SM_KitchenTable",
            "/Game/StarterContent/Props/SM_TableRound.SM_TableRound",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 120, "depth": 80},
        "facing": "none",
    },
    "stool": {
        "type": "furniture",
        "asset_paths": [
            "/Game/Furniture/Kitchen/SM_Stool.SM_Stool",
            "/Game/StarterContent/Props/SM_Chair.SM_Chair",
        ],
        "default_scale": {"x": 0.8, "y": 0.8, "z": 1.0},
        "footprint": {"width": 40, "depth": 40},
        "facing": "counter",
    },
    # Generic
    "plant": {
        "type": "decoration",
        "asset_paths": [
            "/Game/StarterContent/Props/SM_Bush.SM_Bush",
            "/Game/Decoration/Plants/SM_PottedPlant.SM_PottedPlant",
        ],
        "default_scale": {"x": 0.5, "y": 0.5, "z": 0.5},
        "footprint": {"width": 40, "depth": 40},
        "facing": "none",
    },
    "picture_frame": {
        "type": "decoration",
        "asset_paths": [
            "/Game/Decoration/Art/SM_PictureFrame.SM_PictureFrame",
            "/Game/StarterContent/Props/SM_Frame.SM_Frame",
        ],
        "default_scale": {"x": 1.0, "y": 1.0, "z": 1.0},
        "footprint": {"width": 60, "depth": 5},
        "facing": "wall",
    },
}

# Room type configurations with typical layouts
ROOM_LAYOUTS = {
    "living_room": {
        "center": {"x": 0, "y": 0, "z": 0},
        "size": {"width": 500, "depth": 400},  # cm
        "focal_point": "tv",  # Main focal point
        "arrangement": "conversation",  # Furniture faces each other
        "zones": {
            "seating": {"position": "center", "offset": {"x": 0, "y": 50}},
            "entertainment": {"position": "wall", "offset": {"x": 0, "y": -150}},
            "accent": {"position": "corners"},
        }
    },
    "bedroom": {
        "center": {"x": 0, "y": 0, "z": 0},
        "size": {"width": 400, "depth": 350},
        "focal_point": "bed",
        "arrangement": "wall_aligned",
        "zones": {
            "sleeping": {"position": "back_wall", "offset": {"x": 0, "y": -100}},
            "storage": {"position": "side_wall"},
            "accent": {"position": "corners"},
        }
    },
    "dining_room": {
        "center": {"x": 0, "y": 0, "z": 0},
        "size": {"width": 400, "depth": 350},
        "focal_point": "dining_table",
        "arrangement": "centered",
        "zones": {
            "dining": {"position": "center"},
            "storage": {"position": "wall"},
        }
    },
    "office": {
        "center": {"x": 0, "y": 0, "z": 0},
        "size": {"width": 350, "depth": 300},
        "focal_point": "desk",
        "arrangement": "wall_aligned",
        "zones": {
            "work": {"position": "wall", "offset": {"x": 0, "y": -100}},
            "storage": {"position": "side_wall"},
        }
    },
    "kitchen": {
        "center": {"x": 0, "y": 0, "z": 0},
        "size": {"width": 400, "depth": 350},
        "focal_point": "kitchen_table",
        "arrangement": "functional",
        "zones": {
            "dining": {"position": "center"},
            "prep": {"position": "wall"},
        }
    },
}


class SceneBuilderService:
    """
    Service for building complex scenes from natural language prompts.
    
    Uses AI to parse prompts and generates intelligent spatial arrangements.
    """
    
    def __init__(self):
        self.client = None
        if AsyncOpenAI:
            self.client = AsyncOpenAI()
        
        # Active build plans
        self.active_plans: Dict[str, SceneBuildPlan] = {}
        
        # Progress callbacks
        self.progress_callbacks: Dict[str, List[Callable]] = {}
    
    async def parse_scene_prompt(self, prompt: str) -> Dict[str, Any]:
        """
        Use AI to parse a natural language scene description into structured data.
        
        Args:
            prompt: Natural language description like "Create a living room with a sofa and two lamps"
            
        Returns:
            Structured scene data with room type, objects, and relationships
        """
        if not self.client:
            # Fallback to rule-based parsing
            return self._rule_based_parse(prompt)
        
        system_prompt = """You are a scene layout expert. Parse the user's scene description and return a JSON object with:
1. room_type: The type of room (living_room, bedroom, dining_room, office, kitchen, or custom)
2. description: A brief description of the scene
3. objects: An array of objects to place, each with:
   - name: Display name (e.g., "Main Sofa")
   - type: Object type from this list: sofa, coffee_table, lamp, armchair, tv, bookshelf, rug, bed, nightstand, dresser, dining_table, dining_chair, desk, office_chair, computer, kitchen_table, stool, plant, picture_frame
   - quantity: Number of this object (default 1)
   - position_hint: Relative position hint (center, left, right, front, back, corner, beside_X, across_from_X)
   - properties: Optional properties like color, material, size

Example output for "Create a living room with a sofa, coffee table, and two lamps":
{
  "room_type": "living_room",
  "description": "A cozy living room setup with seating and ambient lighting",
  "objects": [
    {"name": "Main Sofa", "type": "sofa", "quantity": 1, "position_hint": "center_back"},
    {"name": "Coffee Table", "type": "coffee_table", "quantity": 1, "position_hint": "center_front"},
    {"name": "Floor Lamp", "type": "lamp", "quantity": 2, "position_hint": "beside_sofa"}
  ]
}

Return ONLY valid JSON, no markdown or explanation."""

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Clean up response if needed
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            return json.loads(content)
            
        except Exception as e:
            print(f"AI parsing failed: {e}, falling back to rule-based parsing")
            return self._rule_based_parse(prompt)
    
    def _rule_based_parse(self, prompt: str) -> Dict[str, Any]:
        """Fallback rule-based parsing when AI is unavailable"""
        prompt_lower = prompt.lower()
        
        # Detect room type
        room_type = "living_room"  # default
        for rt in ROOM_LAYOUTS.keys():
            if rt.replace("_", " ") in prompt_lower:
                room_type = rt
                break
        
        # Extract objects
        objects = []
        for obj_type, preset in FURNITURE_PRESETS.items():
            # Check for object mentions
            search_term = obj_type.replace("_", " ")
            if search_term in prompt_lower:
                # Check for quantity
                quantity = 1
                for word in ["two", "2", "pair of", "couple of"]:
                    if f"{word} {search_term}" in prompt_lower:
                        quantity = 2
                        break
                for word in ["three", "3"]:
                    if f"{word} {search_term}" in prompt_lower:
                        quantity = 3
                        break
                for word in ["four", "4"]:
                    if f"{word} {search_term}" in prompt_lower:
                        quantity = 4
                        break
                
                objects.append({
                    "name": obj_type.replace("_", " ").title(),
                    "type": obj_type,
                    "quantity": quantity,
                    "position_hint": "auto"
                })
        
        return {
            "room_type": room_type,
            "description": f"Scene created from: {prompt}",
            "objects": objects
        }
    
    def calculate_positions(self, parsed_scene: Dict[str, Any]) -> List[SceneObject]:
        """
        Calculate optimal positions for all objects based on room layout and relationships.
        
        Uses spatial reasoning to:
        - Place focal furniture first
        - Arrange supporting furniture around focal points
        - Maintain proper spacing and clearances
        - Handle multiple instances of same object type
        """
        room_type = parsed_scene.get("room_type", "living_room")
        room_layout = ROOM_LAYOUTS.get(room_type, ROOM_LAYOUTS["living_room"])
        objects_data = parsed_scene.get("objects", [])
        
        scene_objects: List[SceneObject] = []
        placed_positions: List[Dict[str, float]] = []
        
        # Sort objects by priority (focal points first)
        focal_point = room_layout.get("focal_point", "")
        
        def get_priority(obj):
            if obj["type"] == focal_point:
                return 0
            if obj["type"] in ["sofa", "bed", "desk", "dining_table"]:
                return 1
            if obj["type"] in ["coffee_table", "nightstand", "office_chair"]:
                return 2
            return 3
        
        sorted_objects = sorted(objects_data, key=get_priority)
        
        # Center position
        center_x = room_layout["center"]["x"]
        center_y = room_layout["center"]["y"]
        center_z = room_layout["center"]["z"]
        
        # Track positions for relationship-based placement
        object_positions: Dict[str, Dict[str, float]] = {}
        
        for obj_data in sorted_objects:
            obj_type = obj_data["type"]
            quantity = obj_data.get("quantity", 1)
            position_hint = obj_data.get("position_hint", "auto")
            
            preset = FURNITURE_PRESETS.get(obj_type, {})
            footprint = preset.get("footprint", {"width": 100, "depth": 100})
            
            for i in range(quantity):
                obj_id = str(uuid.uuid4())[:8]
                obj_name = obj_data["name"]
                if quantity > 1:
                    obj_name = f"{obj_name} {i + 1}"
                
                # Calculate position based on hints and room layout
                position = self._calculate_object_position(
                    obj_type=obj_type,
                    index=i,
                    quantity=quantity,
                    position_hint=position_hint,
                    room_layout=room_layout,
                    placed_positions=placed_positions,
                    object_positions=object_positions,
                    footprint=footprint
                )
                
                # Calculate rotation based on facing direction
                rotation = self._calculate_rotation(
                    obj_type=obj_type,
                    preset=preset,
                    position=position,
                    room_layout=room_layout,
                    object_positions=object_positions
                )
                
                # Get scale
                scale = preset.get("default_scale", {"x": 1.0, "y": 1.0, "z": 1.0})
                
                # Get asset path
                asset_paths = preset.get("asset_paths", [])
                asset_path = asset_paths[0] if asset_paths else f"/Game/Props/SM_{obj_type.title()}.SM_{obj_type.title()}"
                
                scene_obj = SceneObject(
                    id=obj_id,
                    name=obj_name,
                    type=preset.get("type", "furniture"),
                    asset_path=asset_path,
                    position=position,
                    rotation=rotation,
                    scale=scale,
                    properties=obj_data.get("properties", {})
                )
                
                scene_objects.append(scene_obj)
                placed_positions.append(position)
                object_positions[obj_type] = position
        
        return scene_objects
    
    def _calculate_object_position(
        self,
        obj_type: str,
        index: int,
        quantity: int,
        position_hint: str,
        room_layout: Dict,
        placed_positions: List[Dict[str, float]],
        object_positions: Dict[str, Dict[str, float]],
        footprint: Dict[str, int]
    ) -> Dict[str, float]:
        """Calculate position for a single object"""
        
        center_x = room_layout["center"]["x"]
        center_y = room_layout["center"]["y"]
        center_z = room_layout["center"]["z"]
        room_width = room_layout["size"]["width"]
        room_depth = room_layout["size"]["depth"]
        
        # Base position calculation based on object type and room layout
        if obj_type in ["sofa", "bed"]:
            # Main seating/sleeping - back of room
            x = center_x
            y = center_y - room_depth * 0.3
            z = center_z
            
        elif obj_type in ["coffee_table"]:
            # In front of sofa
            sofa_pos = object_positions.get("sofa", {"x": center_x, "y": center_y - 100, "z": center_z})
            x = sofa_pos["x"]
            y = sofa_pos["y"] + 120  # In front of sofa
            z = center_z
            
        elif obj_type in ["lamp"]:
            # Beside main furniture
            main_pos = object_positions.get("sofa") or object_positions.get("bed") or {"x": center_x, "y": center_y, "z": center_z}
            offset = 150 if index == 0 else -150
            x = main_pos["x"] + offset
            y = main_pos["y"]
            z = center_z
            
        elif obj_type in ["armchair"]:
            # Angled beside sofa
            sofa_pos = object_positions.get("sofa", {"x": center_x, "y": center_y, "z": center_z})
            offset = 180 if index == 0 else -180
            x = sofa_pos["x"] + offset
            y = sofa_pos["y"] + 50
            z = center_z
            
        elif obj_type in ["tv"]:
            # Across from sofa
            sofa_pos = object_positions.get("sofa", {"x": center_x, "y": center_y - 100, "z": center_z})
            x = sofa_pos["x"]
            y = sofa_pos["y"] + 300  # Across the room
            z = center_z + 50  # Slightly elevated
            
        elif obj_type in ["nightstand"]:
            # Beside bed
            bed_pos = object_positions.get("bed", {"x": center_x, "y": center_y, "z": center_z})
            offset = 120 if index == 0 else -120
            x = bed_pos["x"] + offset
            y = bed_pos["y"]
            z = center_z
            
        elif obj_type in ["dining_chair"]:
            # Around dining table
            table_pos = object_positions.get("dining_table", {"x": center_x, "y": center_y, "z": center_z})
            # Arrange chairs around table
            angles = [0, 90, 180, 270]
            if quantity <= 4:
                angle_idx = index % len(angles)
            else:
                angle_idx = index % len(angles)
            
            import math
            angle_rad = math.radians(angles[angle_idx])
            distance = 80
            x = table_pos["x"] + distance * math.cos(angle_rad)
            y = table_pos["y"] + distance * math.sin(angle_rad)
            z = center_z
            
        elif obj_type in ["desk"]:
            # Against wall
            x = center_x
            y = center_y - room_depth * 0.35
            z = center_z
            
        elif obj_type in ["office_chair"]:
            # In front of desk
            desk_pos = object_positions.get("desk", {"x": center_x, "y": center_y - 100, "z": center_z})
            x = desk_pos["x"]
            y = desk_pos["y"] + 80
            z = center_z
            
        elif obj_type in ["bookshelf", "dresser"]:
            # Against side wall
            x = center_x + room_width * 0.35
            y = center_y
            z = center_z
            
        elif obj_type in ["plant"]:
            # Corners
            corner_offsets = [
                (room_width * 0.4, room_depth * 0.35),
                (-room_width * 0.4, room_depth * 0.35),
                (room_width * 0.4, -room_depth * 0.35),
                (-room_width * 0.4, -room_depth * 0.35),
            ]
            offset = corner_offsets[index % len(corner_offsets)]
            x = center_x + offset[0]
            y = center_y + offset[1]
            z = center_z
            
        elif obj_type in ["rug"]:
            # Center of room, under coffee table if present
            table_pos = object_positions.get("coffee_table", {"x": center_x, "y": center_y, "z": center_z})
            x = table_pos["x"]
            y = table_pos["y"]
            z = center_z - 1  # Slightly below floor level to sit on floor
            
        else:
            # Default: spread around center
            spread = 100 * (index + 1)
            x = center_x + (spread if index % 2 == 0 else -spread)
            y = center_y
            z = center_z
        
        # Collision avoidance - nudge if too close to existing objects
        position = {"x": x, "y": y, "z": z}
        position = self._avoid_collisions(position, placed_positions, footprint)
        
        return position
    
    def _avoid_collisions(
        self,
        position: Dict[str, float],
        placed_positions: List[Dict[str, float]],
        footprint: Dict[str, int],
        min_distance: float = 50
    ) -> Dict[str, float]:
        """Nudge position to avoid collisions with placed objects"""
        import math
        
        for placed in placed_positions:
            dx = position["x"] - placed["x"]
            dy = position["y"] - placed["y"]
            distance = math.sqrt(dx * dx + dy * dy)
            
            if distance < min_distance + footprint["width"] / 2:
                # Nudge away
                if distance > 0:
                    nudge_factor = (min_distance + footprint["width"] / 2 - distance) / distance
                    position["x"] += dx * nudge_factor
                    position["y"] += dy * nudge_factor
                else:
                    position["x"] += min_distance
        
        return position
    
    def _calculate_rotation(
        self,
        obj_type: str,
        preset: Dict,
        position: Dict[str, float],
        room_layout: Dict,
        object_positions: Dict[str, Dict[str, float]]
    ) -> Dict[str, float]:
        """Calculate rotation based on facing direction"""
        import math
        
        facing = preset.get("facing", "none")
        yaw = 0.0
        
        if facing == "forward":
            # Face toward room center
            yaw = 0.0
            
        elif facing == "wall":
            # Face away from room center (toward wall)
            yaw = 180.0
            
        elif facing == "table":
            # Face toward dining table
            table_pos = object_positions.get("dining_table", {"x": 0, "y": 0})
            dx = table_pos["x"] - position["x"]
            dy = table_pos["y"] - position["y"]
            yaw = math.degrees(math.atan2(dy, dx))
            
        elif facing == "desk":
            # Face toward desk
            desk_pos = object_positions.get("desk", {"x": 0, "y": -100})
            dx = desk_pos["x"] - position["x"]
            dy = desk_pos["y"] - position["y"]
            yaw = math.degrees(math.atan2(dy, dx))
            
        elif facing == "user":
            # Face toward where user would sit
            yaw = 180.0
        
        return {"pitch": 0.0, "yaw": yaw, "roll": 0.0}
    
    def create_build_plan(self, parsed_scene: Dict[str, Any], prompt: str) -> SceneBuildPlan:
        """Create a complete build plan from parsed scene data"""
        plan_id = str(uuid.uuid4())[:8]
        
        # Calculate positions for all objects
        scene_objects = self.calculate_positions(parsed_scene)
        
        # Create build steps
        steps: List[BuildStep] = []
        for i, obj in enumerate(scene_objects):
            step = BuildStep(
                id=str(uuid.uuid4())[:8],
                order=i + 1,
                action="spawn",
                object=obj,
                status=StepStatus.PENDING
            )
            steps.append(step)
        
        plan = SceneBuildPlan(
            id=plan_id,
            prompt=prompt,
            room_type=parsed_scene.get("room_type", "custom"),
            description=parsed_scene.get("description", ""),
            objects=scene_objects,
            steps=steps,
            status=SceneStatus.PLANNING
        )
        
        self.active_plans[plan_id] = plan
        return plan
    
    async def execute_build_plan(
        self,
        plan: SceneBuildPlan,
        agent_relay_service,
        user_id: int,
        progress_callback: Optional[Callable] = None
    ) -> SceneBuildPlan:
        """
        Execute a build plan step by step.
        
        Args:
            plan: The build plan to execute
            agent_relay_service: Service for executing UE5 commands
            user_id: User ID for the agent connection
            progress_callback: Optional callback for progress updates
        """
        plan.status = SceneStatus.BUILDING
        total_steps = len(plan.steps)
        
        for i, step in enumerate(plan.steps):
            plan.current_step = i + 1
            plan.progress = (i / total_steps) * 100
            
            # Notify progress
            if progress_callback:
                await progress_callback({
                    "plan_id": plan.id,
                    "status": plan.status,
                    "progress": plan.progress,
                    "current_step": plan.current_step,
                    "total_steps": total_steps,
                    "step_name": step.object.name,
                    "step_status": "in_progress"
                })
            
            step.status = StepStatus.IN_PROGRESS
            step.started_at = datetime.now()
            
            try:
                # Execute spawn_actor command
                result = await agent_relay_service.execute_tool(
                    user_id,
                    "spawn_actor",
                    {
                        "asset_path": step.object.asset_path,
                        "location_x": step.object.position["x"],
                        "location_y": step.object.position["y"],
                        "location_z": step.object.position["z"],
                        "rotation_pitch": step.object.rotation["pitch"],
                        "rotation_yaw": step.object.rotation["yaw"],
                        "rotation_roll": step.object.rotation["roll"],
                        "scale_x": step.object.scale["x"],
                        "scale_y": step.object.scale["y"],
                        "scale_z": step.object.scale["z"],
                        "actor_name": step.object.name.replace(" ", "_")
                    }
                )
                
                step.result = result
                step.status = StepStatus.COMPLETED
                step.completed_at = datetime.now()
                
                # Small delay between spawns for visual feedback
                await asyncio.sleep(0.3)
                
            except Exception as e:
                step.status = StepStatus.FAILED
                step.error = str(e)
                step.completed_at = datetime.now()
                
                # Continue with other steps even if one fails
                if progress_callback:
                    await progress_callback({
                        "plan_id": plan.id,
                        "status": "step_failed",
                        "step_name": step.object.name,
                        "error": str(e)
                    })
        
        # Final status
        failed_steps = [s for s in plan.steps if s.status == StepStatus.FAILED]
        if failed_steps:
            plan.status = SceneStatus.COMPLETED  # Partial success
            plan.error = f"{len(failed_steps)} steps failed"
        else:
            plan.status = SceneStatus.COMPLETED
        
        plan.progress = 100.0
        plan.completed_at = datetime.now()
        
        # Final progress notification
        if progress_callback:
            await progress_callback({
                "plan_id": plan.id,
                "status": plan.status,
                "progress": 100,
                "current_step": total_steps,
                "total_steps": total_steps,
                "completed": True,
                "failed_count": len(failed_steps)
            })
        
        return plan
    
    def get_plan(self, plan_id: str) -> Optional[SceneBuildPlan]:
        """Get a build plan by ID"""
        return self.active_plans.get(plan_id)
    
    def cancel_plan(self, plan_id: str) -> bool:
        """Cancel an active build plan"""
        plan = self.active_plans.get(plan_id)
        if plan and plan.status == SceneStatus.BUILDING:
            plan.status = SceneStatus.CANCELLED
            return True
        return False
    
    def plan_to_dict(self, plan: SceneBuildPlan) -> Dict[str, Any]:
        """Convert a build plan to dictionary for API response"""
        return {
            "id": plan.id,
            "prompt": plan.prompt,
            "room_type": plan.room_type,
            "description": plan.description,
            "status": plan.status.value,
            "progress": plan.progress,
            "current_step": plan.current_step,
            "total_steps": len(plan.steps),
            "created_at": plan.created_at.isoformat(),
            "completed_at": plan.completed_at.isoformat() if plan.completed_at else None,
            "error": plan.error,
            "objects": [
                {
                    "id": obj.id,
                    "name": obj.name,
                    "type": obj.type,
                    "asset_path": obj.asset_path,
                    "position": obj.position,
                    "rotation": obj.rotation,
                    "scale": obj.scale
                }
                for obj in plan.objects
            ],
            "steps": [
                {
                    "id": step.id,
                    "order": step.order,
                    "action": step.action,
                    "object_name": step.object.name,
                    "status": step.status.value,
                    "error": step.error,
                    "started_at": step.started_at.isoformat() if step.started_at else None,
                    "completed_at": step.completed_at.isoformat() if step.completed_at else None
                }
                for step in plan.steps
            ]
        }


# Global service instance
_scene_builder_service: Optional[SceneBuilderService] = None


def get_scene_builder_service() -> SceneBuilderService:
    """Get the global scene builder service instance"""
    global _scene_builder_service
    if _scene_builder_service is None:
        _scene_builder_service = SceneBuilderService()
    return _scene_builder_service
