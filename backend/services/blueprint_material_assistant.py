"""
Blueprint/Material Assistant Service

AI-assisted Blueprint and Material creation for Unreal Engine 5.
Features:
- Natural language to Blueprint/Material conversion
- Visual node preview generation
- Common pattern templates
- Parameter suggestions
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from enum import Enum
from openai import AsyncOpenAI


class AssetType(str, Enum):
    """Types of assets that can be created"""
    MATERIAL = "material"
    BLUEPRINT = "blueprint"
    MATERIAL_INSTANCE = "material_instance"
    BLUEPRINT_FUNCTION = "blueprint_function"


class NodeType(str, Enum):
    """Types of nodes in visual graphs"""
    # Material nodes
    MATERIAL_OUTPUT = "material_output"
    TEXTURE_SAMPLE = "texture_sample"
    SCALAR_PARAMETER = "scalar_parameter"
    VECTOR_PARAMETER = "vector_parameter"
    MULTIPLY = "multiply"
    ADD = "add"
    LERP = "lerp"
    FRESNEL = "fresnel"
    WORLD_POSITION = "world_position"
    OBJECT_POSITION = "object_position"
    TIME = "time"
    SINE = "sine"
    COSINE = "cosine"
    PANNER = "panner"
    TEXTURE_COORDINATE = "texture_coordinate"
    CONSTANT = "constant"
    CONSTANT_2D = "constant_2d"
    CONSTANT_3D = "constant_3d"
    CONSTANT_4D = "constant_4d"
    CLAMP = "clamp"
    SATURATE = "saturate"
    POWER = "power"
    DISTANCE = "distance"
    
    # Blueprint nodes
    EVENT_BEGIN_PLAY = "event_begin_play"
    EVENT_TICK = "event_tick"
    EVENT_OVERLAP = "event_overlap"
    ADD_ROTATION = "add_rotation"
    SET_ROTATION = "set_rotation"
    ADD_LOCATION = "add_location"
    SET_LOCATION = "set_location"
    GET_ACTOR_LOCATION = "get_actor_location"
    GET_PLAYER_LOCATION = "get_player_location"
    BRANCH = "branch"
    SEQUENCE = "sequence"
    DELAY = "delay"
    TIMELINE = "timeline"
    SET_VISIBILITY = "set_visibility"
    PLAY_SOUND = "play_sound"
    SPAWN_ACTOR = "spawn_actor"
    DESTROY_ACTOR = "destroy_actor"
    PRINT_STRING = "print_string"
    MAKE_ROTATOR = "make_rotator"
    BREAK_ROTATOR = "break_rotator"
    MAKE_VECTOR = "make_vector"
    BREAK_VECTOR = "break_vector"
    DELTA_SECONDS = "delta_seconds"
    COMPARE_FLOAT = "compare_float"
    COMPARE_DISTANCE = "compare_distance"


@dataclass
class NodeConnection:
    """Connection between two nodes"""
    from_node: str
    from_pin: str
    to_node: str
    to_pin: str


@dataclass
class VisualNode:
    """A node in the visual graph"""
    id: str
    type: NodeType
    name: str
    position: Dict[str, float]  # x, y for visual layout
    properties: Dict[str, Any] = field(default_factory=dict)
    inputs: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)


@dataclass
class VisualGraph:
    """Visual graph representation for preview"""
    id: str
    asset_type: AssetType
    name: str
    description: str
    nodes: List[VisualNode]
    connections: List[NodeConnection]
    created_at: datetime


@dataclass
class AssetTemplate:
    """Template for common asset patterns"""
    id: str
    name: str
    description: str
    asset_type: AssetType
    prompt_example: str
    graph: VisualGraph
    tags: List[str]


# Common material templates
MATERIAL_TEMPLATES = {
    "glow_proximity": {
        "name": "Proximity Glow",
        "description": "Material that glows when the player is near",
        "prompt_example": "Create a material that glows blue when the player is near",
        "tags": ["glow", "proximity", "interactive", "emissive"]
    },
    "pulsing_emissive": {
        "name": "Pulsing Emissive",
        "description": "Material with pulsing glow effect",
        "prompt_example": "Create a material that pulses with a red glow",
        "tags": ["pulse", "glow", "animated", "emissive"]
    },
    "scrolling_texture": {
        "name": "Scrolling Texture",
        "description": "Material with scrolling/panning texture",
        "prompt_example": "Create a material with a scrolling water texture",
        "tags": ["scroll", "pan", "animated", "water"]
    },
    "color_parameter": {
        "name": "Color Parameter",
        "description": "Simple material with adjustable color",
        "prompt_example": "Create a material with an adjustable base color",
        "tags": ["color", "parameter", "simple"]
    },
    "fresnel_rim": {
        "name": "Fresnel Rim Light",
        "description": "Material with fresnel rim lighting effect",
        "prompt_example": "Create a material with a glowing edge effect",
        "tags": ["fresnel", "rim", "edge", "glow"]
    },
    "dissolve": {
        "name": "Dissolve Effect",
        "description": "Material with dissolve/disintegration effect",
        "prompt_example": "Create a material that dissolves from bottom to top",
        "tags": ["dissolve", "fade", "effect", "animated"]
    }
}

# Common blueprint templates
BLUEPRINT_TEMPLATES = {
    "rotate_continuous": {
        "name": "Continuous Rotation",
        "description": "Blueprint that rotates an actor continuously",
        "prompt_example": "Add a Blueprint that rotates this actor continuously",
        "tags": ["rotate", "spin", "continuous", "animation"]
    },
    "bob_up_down": {
        "name": "Bobbing Motion",
        "description": "Blueprint that makes an actor bob up and down",
        "prompt_example": "Make this actor float up and down",
        "tags": ["bob", "float", "hover", "animation"]
    },
    "proximity_trigger": {
        "name": "Proximity Trigger",
        "description": "Blueprint that triggers when player is near",
        "prompt_example": "Trigger an event when the player gets close",
        "tags": ["proximity", "trigger", "player", "interaction"]
    },
    "toggle_visibility": {
        "name": "Toggle Visibility",
        "description": "Blueprint that toggles actor visibility",
        "prompt_example": "Make this actor appear and disappear on a timer",
        "tags": ["visibility", "toggle", "show", "hide"]
    },
    "follow_player": {
        "name": "Follow Player",
        "description": "Blueprint that makes actor follow the player",
        "prompt_example": "Make this actor follow the player around",
        "tags": ["follow", "player", "movement", "AI"]
    },
    "pickup_collectible": {
        "name": "Pickup Collectible",
        "description": "Blueprint for collectible item pickup",
        "prompt_example": "Make this a collectible that disappears when touched",
        "tags": ["pickup", "collectible", "item", "interaction"]
    }
}


class BlueprintMaterialAssistant:
    """
    AI-assisted Blueprint and Material creation service.
    
    Uses GPT to parse natural language descriptions and generate
    visual node graphs for UE5 materials and blueprints.
    """
    
    def __init__(self):
        self.client = AsyncOpenAI()
        self.model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        
        # Cache for generated graphs
        self.graphs: Dict[str, VisualGraph] = {}
    
    async def parse_request(self, prompt: str) -> Dict[str, Any]:
        """
        Parse a natural language request to determine asset type and requirements.
        
        Args:
            prompt: User's natural language description
            
        Returns:
            Parsed request with asset type, features, and parameters
        """
        system_prompt = """You are an expert Unreal Engine 5 developer specializing in Materials and Blueprints.
        
Parse the user's request and extract:
1. asset_type: "material" or "blueprint"
2. name: A suitable name for the asset (PascalCase, e.g., "M_GlowingBlue" for materials, "BP_RotatingActor" for blueprints)
3. description: Brief description of what the asset does
4. features: List of key features/behaviors
5. parameters: Any adjustable parameters mentioned (colors, speeds, distances, etc.)
6. template_match: Best matching template from the available templates, or null if custom

Available material templates: glow_proximity, pulsing_emissive, scrolling_texture, color_parameter, fresnel_rim, dissolve
Available blueprint templates: rotate_continuous, bob_up_down, proximity_trigger, toggle_visibility, follow_player, pickup_collectible

Respond in JSON format only."""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            # Fallback parsing
            prompt_lower = prompt.lower()
            
            is_material = any(word in prompt_lower for word in ['material', 'texture', 'color', 'glow', 'emissive', 'shader'])
            is_blueprint = any(word in prompt_lower for word in ['blueprint', 'rotate', 'move', 'trigger', 'script', 'behavior'])
            
            asset_type = "material" if is_material else "blueprint"
            
            return {
                "asset_type": asset_type,
                "name": f"{'M' if asset_type == 'material' else 'BP'}_Custom_{uuid.uuid4().hex[:6]}",
                "description": prompt,
                "features": [],
                "parameters": {},
                "template_match": None
            }
    
    async def generate_material_graph(
        self,
        parsed_request: Dict[str, Any]
    ) -> VisualGraph:
        """
        Generate a material node graph based on the parsed request.
        
        Args:
            parsed_request: Parsed request from parse_request()
            
        Returns:
            VisualGraph representing the material
        """
        system_prompt = """You are an expert Unreal Engine 5 Material designer.

Generate a material node graph based on the request. Output a JSON object with:
- nodes: Array of nodes, each with:
  - id: Unique string ID (e.g., "node_1")
  - type: One of: material_output, texture_sample, scalar_parameter, vector_parameter, multiply, add, lerp, fresnel, world_position, object_position, time, sine, cosine, panner, texture_coordinate, constant, constant_2d, constant_3d, constant_4d, clamp, saturate, power, distance
  - name: Display name
  - position: {x, y} for visual layout (start at 0,0 for output, go left for inputs)
  - properties: Node-specific properties (e.g., {value: 0.5} for constant, {color: [1,0,0,1]} for vector_parameter)
  - inputs: Array of input pin names
  - outputs: Array of output pin names
- connections: Array of connections, each with:
  - from_node: Source node ID
  - from_pin: Source pin name
  - to_node: Target node ID
  - to_pin: Target pin name

Common material patterns:
- Proximity glow: Use distance between WorldPosition and ObjectPosition, compare to threshold, multiply with emissive color
- Pulsing: Use Time -> Sine -> Multiply with color
- Fresnel rim: Use Fresnel node -> Multiply with color -> Add to emissive

Always include a material_output node. Connect to appropriate pins:
- Base Color, Metallic, Roughness, Emissive Color, Normal, Opacity, etc.

Respond with JSON only."""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(parsed_request)}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            graph_data = json.loads(response.choices[0].message.content)
            
            # Convert to VisualGraph
            nodes = []
            for node_data in graph_data.get("nodes", []):
                node = VisualNode(
                    id=node_data.get("id", f"node_{len(nodes)}"),
                    type=NodeType(node_data.get("type", "constant")),
                    name=node_data.get("name", "Node"),
                    position=node_data.get("position", {"x": 0, "y": 0}),
                    properties=node_data.get("properties", {}),
                    inputs=node_data.get("inputs", []),
                    outputs=node_data.get("outputs", [])
                )
                nodes.append(node)
            
            connections = []
            for conn_data in graph_data.get("connections", []):
                conn = NodeConnection(
                    from_node=conn_data.get("from_node", ""),
                    from_pin=conn_data.get("from_pin", ""),
                    to_node=conn_data.get("to_node", ""),
                    to_pin=conn_data.get("to_pin", "")
                )
                connections.append(conn)
            
            graph = VisualGraph(
                id=str(uuid.uuid4())[:8],
                asset_type=AssetType.MATERIAL,
                name=parsed_request.get("name", "M_Custom"),
                description=parsed_request.get("description", ""),
                nodes=nodes,
                connections=connections,
                created_at=datetime.now()
            )
            
            self.graphs[graph.id] = graph
            return graph
            
        except Exception as e:
            # Return a basic material graph
            return self._create_basic_material_graph(parsed_request)
    
    async def generate_blueprint_graph(
        self,
        parsed_request: Dict[str, Any]
    ) -> VisualGraph:
        """
        Generate a blueprint node graph based on the parsed request.
        
        Args:
            parsed_request: Parsed request from parse_request()
            
        Returns:
            VisualGraph representing the blueprint
        """
        system_prompt = """You are an expert Unreal Engine 5 Blueprint designer.

Generate a blueprint event graph based on the request. Output a JSON object with:
- nodes: Array of nodes, each with:
  - id: Unique string ID (e.g., "node_1")
  - type: One of: event_begin_play, event_tick, event_overlap, add_rotation, set_rotation, add_location, set_location, get_actor_location, get_player_location, branch, sequence, delay, timeline, set_visibility, play_sound, spawn_actor, destroy_actor, print_string, make_rotator, break_rotator, make_vector, break_vector, delta_seconds, compare_float, compare_distance
  - name: Display name
  - position: {x, y} for visual layout
  - properties: Node-specific properties (e.g., {rotation_rate: {pitch: 0, yaw: 90, roll: 0}})
  - inputs: Array of input pin names (include "Exec" for execution pins)
  - outputs: Array of output pin names (include "Then" for execution pins)
- connections: Array of connections, each with:
  - from_node: Source node ID
  - from_pin: Source pin name
  - to_node: Target node ID
  - to_pin: Target pin name

Common blueprint patterns:
- Continuous rotation: EventTick -> AddActorLocalRotation with DeltaSeconds * RotationSpeed
- Bobbing: EventTick -> SetActorLocation with Sin(Time) * BobHeight
- Proximity check: EventTick -> GetDistanceTo(Player) -> Branch -> Action

Always start with an event node (event_begin_play or event_tick).
Connect execution pins (Exec/Then) to control flow.

Respond with JSON only."""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(parsed_request)}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            graph_data = json.loads(response.choices[0].message.content)
            
            # Convert to VisualGraph
            nodes = []
            for node_data in graph_data.get("nodes", []):
                node = VisualNode(
                    id=node_data.get("id", f"node_{len(nodes)}"),
                    type=NodeType(node_data.get("type", "event_tick")),
                    name=node_data.get("name", "Node"),
                    position=node_data.get("position", {"x": 0, "y": 0}),
                    properties=node_data.get("properties", {}),
                    inputs=node_data.get("inputs", []),
                    outputs=node_data.get("outputs", [])
                )
                nodes.append(node)
            
            connections = []
            for conn_data in graph_data.get("connections", []):
                conn = NodeConnection(
                    from_node=conn_data.get("from_node", ""),
                    from_pin=conn_data.get("from_pin", ""),
                    to_node=conn_data.get("to_node", ""),
                    to_pin=conn_data.get("to_pin", "")
                )
                connections.append(conn)
            
            graph = VisualGraph(
                id=str(uuid.uuid4())[:8],
                asset_type=AssetType.BLUEPRINT,
                name=parsed_request.get("name", "BP_Custom"),
                description=parsed_request.get("description", ""),
                nodes=nodes,
                connections=connections,
                created_at=datetime.now()
            )
            
            self.graphs[graph.id] = graph
            return graph
            
        except Exception as e:
            # Return a basic blueprint graph
            return self._create_basic_blueprint_graph(parsed_request)
    
    def _create_basic_material_graph(self, parsed_request: Dict[str, Any]) -> VisualGraph:
        """Create a basic material graph as fallback"""
        nodes = [
            VisualNode(
                id="output",
                type=NodeType.MATERIAL_OUTPUT,
                name="Material Output",
                position={"x": 0, "y": 0},
                inputs=["Base Color", "Metallic", "Roughness", "Emissive Color"],
                outputs=[]
            ),
            VisualNode(
                id="color",
                type=NodeType.VECTOR_PARAMETER,
                name="Base Color",
                position={"x": -300, "y": 0},
                properties={"color": [0.5, 0.5, 1.0, 1.0], "parameter_name": "BaseColor"},
                inputs=[],
                outputs=["RGB", "R", "G", "B", "A"]
            )
        ]
        
        connections = [
            NodeConnection(
                from_node="color",
                from_pin="RGB",
                to_node="output",
                to_pin="Base Color"
            )
        ]
        
        return VisualGraph(
            id=str(uuid.uuid4())[:8],
            asset_type=AssetType.MATERIAL,
            name=parsed_request.get("name", "M_Basic"),
            description=parsed_request.get("description", "Basic material"),
            nodes=nodes,
            connections=connections,
            created_at=datetime.now()
        )
    
    def _create_basic_blueprint_graph(self, parsed_request: Dict[str, Any]) -> VisualGraph:
        """Create a basic blueprint graph as fallback"""
        nodes = [
            VisualNode(
                id="event",
                type=NodeType.EVENT_TICK,
                name="Event Tick",
                position={"x": 0, "y": 0},
                properties={},
                inputs=[],
                outputs=["Then", "Delta Seconds"]
            ),
            VisualNode(
                id="print",
                type=NodeType.PRINT_STRING,
                name="Print String",
                position={"x": 300, "y": 0},
                properties={"string": "Hello from Blueprint!"},
                inputs=["Exec", "String"],
                outputs=["Then"]
            )
        ]
        
        connections = [
            NodeConnection(
                from_node="event",
                from_pin="Then",
                to_node="print",
                to_pin="Exec"
            )
        ]
        
        return VisualGraph(
            id=str(uuid.uuid4())[:8],
            asset_type=AssetType.BLUEPRINT,
            name=parsed_request.get("name", "BP_Basic"),
            description=parsed_request.get("description", "Basic blueprint"),
            nodes=nodes,
            connections=connections,
            created_at=datetime.now()
        )
    
    async def generate_asset(
        self,
        prompt: str,
        actor_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a complete asset from a natural language prompt.
        
        Args:
            prompt: User's description of the desired asset
            actor_name: Optional actor to apply the asset to
            
        Returns:
            Dictionary with parsed request, visual graph, and MCP commands
        """
        # Parse the request
        parsed = await self.parse_request(prompt)
        
        # Generate the appropriate graph
        if parsed.get("asset_type") == "material":
            graph = await self.generate_material_graph(parsed)
        else:
            graph = await self.generate_blueprint_graph(parsed)
        
        # Generate MCP commands to create the asset
        mcp_commands = self._generate_mcp_commands(graph, actor_name)
        
        return {
            "parsed_request": parsed,
            "graph": self.graph_to_dict(graph),
            "mcp_commands": mcp_commands,
            "template_used": parsed.get("template_match")
        }
    
    def _generate_mcp_commands(
        self,
        graph: VisualGraph,
        actor_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate MCP commands to create the asset in UE5"""
        commands = []
        
        if graph.asset_type == AssetType.MATERIAL:
            # Create material command
            commands.append({
                "tool": "create_material",
                "params": {
                    "material_name": graph.name,
                    "material_path": f"/Game/Materials/{graph.name}"
                },
                "description": f"Create material {graph.name}"
            })
            
            # If actor specified, apply material
            if actor_name:
                commands.append({
                    "tool": "set_material",
                    "params": {
                        "actor_name": actor_name,
                        "material_path": f"/Game/Materials/{graph.name}"
                    },
                    "description": f"Apply {graph.name} to {actor_name}"
                })
        
        elif graph.asset_type == AssetType.BLUEPRINT:
            # Create blueprint command
            commands.append({
                "tool": "create_blueprint",
                "params": {
                    "blueprint_name": graph.name,
                    "blueprint_path": f"/Game/Blueprints/{graph.name}",
                    "parent_class": "Actor"
                },
                "description": f"Create blueprint {graph.name}"
            })
            
            # If actor specified, add component or convert
            if actor_name:
                commands.append({
                    "tool": "add_blueprint_component",
                    "params": {
                        "actor_name": actor_name,
                        "blueprint_path": f"/Game/Blueprints/{graph.name}"
                    },
                    "description": f"Add {graph.name} behavior to {actor_name}"
                })
        
        return commands
    
    def get_graph(self, graph_id: str) -> Optional[VisualGraph]:
        """Get a cached graph by ID"""
        return self.graphs.get(graph_id)
    
    def get_templates(self, asset_type: Optional[str] = None) -> Dict[str, Any]:
        """Get available templates"""
        templates = {}
        
        if asset_type is None or asset_type == "material":
            templates["material"] = MATERIAL_TEMPLATES
        
        if asset_type is None or asset_type == "blueprint":
            templates["blueprint"] = BLUEPRINT_TEMPLATES
        
        return templates
    
    def graph_to_dict(self, graph: VisualGraph) -> Dict[str, Any]:
        """Convert a VisualGraph to dictionary for API response"""
        return {
            "id": graph.id,
            "asset_type": graph.asset_type.value,
            "name": graph.name,
            "description": graph.description,
            "nodes": [
                {
                    "id": node.id,
                    "type": node.type.value,
                    "name": node.name,
                    "position": node.position,
                    "properties": node.properties,
                    "inputs": node.inputs,
                    "outputs": node.outputs
                }
                for node in graph.nodes
            ],
            "connections": [
                {
                    "from_node": conn.from_node,
                    "from_pin": conn.from_pin,
                    "to_node": conn.to_node,
                    "to_pin": conn.to_pin
                }
                for conn in graph.connections
            ],
            "created_at": graph.created_at.isoformat()
        }


# Global service instance
_blueprint_material_assistant: Optional[BlueprintMaterialAssistant] = None


def get_blueprint_material_assistant() -> BlueprintMaterialAssistant:
    """Get the global blueprint/material assistant instance"""
    global _blueprint_material_assistant
    if _blueprint_material_assistant is None:
        _blueprint_material_assistant = BlueprintMaterialAssistant()
    return _blueprint_material_assistant
