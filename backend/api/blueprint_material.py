"""
Blueprint/Material Assistant API

Endpoints for AI-assisted Blueprint and Material creation.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.auth import get_current_user
from services.blueprint_material_assistant import (
    get_blueprint_material_assistant,
    BlueprintMaterialAssistant
)
from services.agent_relay import AgentRelayService
from models.user import User


router = APIRouter(prefix="/blueprint-material", tags=["blueprint-material"])


# Get agent relay service (will be set by main.py)
_agent_relay_service: Optional[AgentRelayService] = None


def set_agent_relay_service(service: AgentRelayService):
    """Set the agent relay service"""
    global _agent_relay_service
    _agent_relay_service = service


def get_agent_relay() -> AgentRelayService:
    """Get the agent relay service"""
    if _agent_relay_service is None:
        raise HTTPException(status_code=500, detail="Agent relay service not initialized")
    return _agent_relay_service


class GenerateRequest(BaseModel):
    """Request to generate a material or blueprint"""
    prompt: str
    actor_name: Optional[str] = None


class ApplyRequest(BaseModel):
    """Request to apply a generated asset"""
    graph_id: str
    actor_name: Optional[str] = None


class NodeResponse(BaseModel):
    """Response containing a visual node"""
    id: str
    type: str
    name: str
    position: Dict[str, float]
    properties: Dict[str, Any]
    inputs: List[str]
    outputs: List[str]


class ConnectionResponse(BaseModel):
    """Response containing a node connection"""
    from_node: str
    from_pin: str
    to_node: str
    to_pin: str


class GraphResponse(BaseModel):
    """Response containing a visual graph"""
    id: str
    asset_type: str
    name: str
    description: str
    nodes: List[NodeResponse]
    connections: List[ConnectionResponse]
    created_at: str


class MCPCommandResponse(BaseModel):
    """Response containing an MCP command"""
    tool: str
    params: Dict[str, Any]
    description: str


class GenerateResponse(BaseModel):
    """Response containing a generated asset"""
    parsed_request: Dict[str, Any]
    graph: GraphResponse
    mcp_commands: List[MCPCommandResponse]
    template_used: Optional[str] = None


class ApplyResponse(BaseModel):
    """Response after applying an asset"""
    success: bool
    message: str
    executed_commands: List[Dict[str, Any]]


@router.get("/templates")
async def get_templates(
    asset_type: Optional[str] = None,
    assistant: BlueprintMaterialAssistant = Depends(get_blueprint_material_assistant)
):
    """
    Get available templates for materials and blueprints.
    
    Args:
        asset_type: Optional filter for 'material' or 'blueprint'
        
    Returns:
        Dictionary of templates by type
    """
    return assistant.get_templates(asset_type)


@router.post("/generate", response_model=GenerateResponse)
async def generate_asset(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
    assistant: BlueprintMaterialAssistant = Depends(get_blueprint_material_assistant)
):
    """
    Generate a material or blueprint from a natural language prompt.
    
    Args:
        request: Generation request with prompt and optional actor name
        
    Returns:
        Generated asset with visual graph and MCP commands
    """
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    try:
        result = await assistant.generate_asset(
            prompt=request.prompt,
            actor_name=request.actor_name
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/parse")
async def parse_request(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
    assistant: BlueprintMaterialAssistant = Depends(get_blueprint_material_assistant)
):
    """
    Parse a natural language request without generating the full graph.
    
    Useful for understanding what the user wants before generating.
    
    Args:
        request: Request with prompt
        
    Returns:
        Parsed request with asset type, features, etc.
    """
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    try:
        result = await assistant.parse_request(request.prompt)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")


@router.get("/graph/{graph_id}", response_model=GraphResponse)
async def get_graph(
    graph_id: str,
    current_user: User = Depends(get_current_user),
    assistant: BlueprintMaterialAssistant = Depends(get_blueprint_material_assistant)
):
    """
    Get a previously generated graph by ID.
    
    Args:
        graph_id: ID of the graph to retrieve
        
    Returns:
        The visual graph
    """
    graph = assistant.get_graph(graph_id)
    
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    return assistant.graph_to_dict(graph)


@router.post("/apply", response_model=ApplyResponse)
async def apply_asset(
    request: ApplyRequest,
    current_user: User = Depends(get_current_user),
    assistant: BlueprintMaterialAssistant = Depends(get_blueprint_material_assistant)
):
    """
    Apply a generated asset to UE5.
    
    Executes the MCP commands to create the material/blueprint in UE5.
    
    Args:
        request: Apply request with graph ID and optional actor name
        
    Returns:
        Result of applying the asset
    """
    agent_relay = get_agent_relay()
    
    # Check if agent is connected
    if not agent_relay.is_agent_connected(current_user.id):
        raise HTTPException(status_code=400, detail="Agent not connected")
    
    if not agent_relay.is_mcp_connected(current_user.id):
        raise HTTPException(status_code=400, detail="MCP not connected to UE5")
    
    # Get the graph
    graph = assistant.get_graph(request.graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    # Generate MCP commands
    from services.blueprint_material_assistant import BlueprintMaterialAssistant
    temp_assistant = BlueprintMaterialAssistant()
    commands = temp_assistant._generate_mcp_commands(graph, request.actor_name)
    
    executed_commands = []
    
    try:
        for cmd in commands:
            # Execute each command via agent relay
            result = await agent_relay.execute_tool(
                user_id=current_user.id,
                tool_name=cmd["tool"],
                tool_params=cmd["params"]
            )
            
            executed_commands.append({
                "tool": cmd["tool"],
                "params": cmd["params"],
                "result": result,
                "success": True
            })
        
        return {
            "success": True,
            "message": f"Successfully created {graph.asset_type} '{graph.name}'",
            "executed_commands": executed_commands
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to apply asset: {str(e)}",
            "executed_commands": executed_commands
        }


@router.post("/material/preview")
async def generate_material_preview(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
    assistant: BlueprintMaterialAssistant = Depends(get_blueprint_material_assistant)
):
    """
    Generate a material graph preview without applying.
    
    Args:
        request: Request with material description
        
    Returns:
        Material graph for preview
    """
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    try:
        # Parse the request
        parsed = await assistant.parse_request(request.prompt)
        
        # Force material type
        parsed["asset_type"] = "material"
        
        # Generate material graph
        graph = await assistant.generate_material_graph(parsed)
        
        return assistant.graph_to_dict(graph)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")


@router.post("/blueprint/preview")
async def generate_blueprint_preview(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
    assistant: BlueprintMaterialAssistant = Depends(get_blueprint_material_assistant)
):
    """
    Generate a blueprint graph preview without applying.
    
    Args:
        request: Request with blueprint description
        
    Returns:
        Blueprint graph for preview
    """
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    try:
        # Parse the request
        parsed = await assistant.parse_request(request.prompt)
        
        # Force blueprint type
        parsed["asset_type"] = "blueprint"
        
        # Generate blueprint graph
        graph = await assistant.generate_blueprint_graph(parsed)
        
        return assistant.graph_to_dict(graph)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")
