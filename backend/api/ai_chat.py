"""
AI Chat API - Natural language interface for UE5 control

This API provides endpoints for AI-powered chat that converts natural language
commands into MCP tool calls and executes them on the connected UE5 instance.

Endpoints:
- POST /api/ai/chat - Send a message and get AI response with tool execution
- POST /api/ai/chat/stream - Stream AI response with real-time tool execution
- GET /api/ai/suggestions - Get command suggestions based on partial input
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import asyncio

from services.ue5_ai_chat import get_ue5_ai_chat_service, UE5AIChatService
from services.agent_relay import get_agent_relay
from services.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/ue5-ai", tags=["UE5 AI Chat"])


class ChatMessage(BaseModel):
    """A single chat message"""
    role: str  # 'user', 'assistant', 'tool'
    content: str
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class ChatRequest(BaseModel):
    """Request body for chat endpoint"""
    messages: List[ChatMessage]
    execute_tools: bool = True  # Whether to automatically execute MCP tools
    context: Optional[Dict[str, Any]] = None  # Additional context (e.g., selected actors)


class ToolCallResult(BaseModel):
    """Result of a tool call"""
    tool_call_id: str
    tool_name: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    success: bool


class ChatResponse(BaseModel):
    """Response from chat endpoint"""
    content: str
    tool_calls: List[Dict[str, Any]] = []
    tool_results: List[ToolCallResult] = []
    suggestions: List[str] = []
    error: Optional[str] = None


class SuggestionRequest(BaseModel):
    """Request body for suggestions endpoint"""
    query: str
    context: Optional[Dict[str, Any]] = None


class SuggestionResponse(BaseModel):
    """Response from suggestions endpoint"""
    suggestions: List[str]


async def execute_mcp_tool(tool_name: str, arguments: Dict[str, Any], user_id: int) -> Dict[str, Any]:
    """
    Execute an MCP tool through the agent relay.
    
    Args:
        tool_name: Name of the MCP tool to execute
        arguments: Tool arguments
        user_id: ID of the user making the request
        
    Returns:
        Tool execution result
    """
    agent_relay = get_agent_relay()
    
    # Check if agent is connected
    if not agent_relay.is_agent_connected(user_id):
        raise HTTPException(
            status_code=503,
            detail="No agent connected. Please connect the UE5 AI Studio Agent first."
        )
    
    # Check if MCP is connected
    if not agent_relay.is_mcp_connected(user_id):
        raise HTTPException(
            status_code=503,
            detail="Agent is connected but MCP is not. Please ensure UE5 is running with the MCP Bridge plugin."
        )
    
    try:
        # Execute the tool through the agent relay
        result = await agent_relay.execute_tool(user_id, tool_name, arguments)
        return result
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"Tool execution timed out: {tool_name}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Tool execution failed: {str(e)}"
        )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Send a chat message and get AI response with optional tool execution.
    
    The AI will analyze the message, determine if any MCP tools should be called,
    and optionally execute them on the connected UE5 instance.
    
    Example request:
    ```json
    {
        "messages": [
            {"role": "user", "content": "Create a cube at position 0, 0, 100"}
        ],
        "execute_tools": true
    }
    ```
    """
    ai_service = get_ue5_ai_chat_service()
    
    # Convert messages to dict format
    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in request.messages
    ]
    
    # Create tool executor that uses the agent relay
    async def tool_executor(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return await execute_mcp_tool(tool_name, arguments, current_user.id)
    
    # Get AI response with tool execution
    result = await ai_service.chat(
        messages=messages,
        execute_tools=request.execute_tools,
        tool_executor=tool_executor if request.execute_tools else None
    )
    
    # Convert tool results to response format
    tool_results = [
        ToolCallResult(
            tool_call_id=tr.get("tool_call_id", ""),
            tool_name=tr.get("tool_name", ""),
            result=tr.get("result"),
            error=tr.get("error"),
            success=tr.get("success", False)
        )
        for tr in result.get("tool_results", [])
    ]
    
    return ChatResponse(
        content=result.get("content", ""),
        tool_calls=result.get("tool_calls", []),
        tool_results=tool_results,
        suggestions=[],
        error=result.get("error")
    )


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Stream chat response with real-time tool execution.
    
    Returns a Server-Sent Events (SSE) stream with:
    - Tool calls as they are identified
    - Tool results as they complete
    - AI response content as it's generated
    
    Event types:
    - tool_call: AI has decided to call a tool
    - tool_result: Tool execution completed
    - content: AI response text chunk
    - done: Stream complete
    - error: An error occurred
    """
    ai_service = get_ue5_ai_chat_service()
    
    # Convert messages to dict format
    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in request.messages
    ]
    
    # Create tool executor
    async def tool_executor(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return await execute_mcp_tool(tool_name, arguments, current_user.id)
    
    async def event_generator():
        """Generate SSE events from the AI chat stream."""
        try:
            async for chunk in ai_service.chat_stream(
                messages=messages,
                tool_executor=tool_executor if request.execute_tools else None
            ):
                event_type = chunk.get("type", "unknown")
                data = json.dumps(chunk)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as e:
            error_data = json.dumps({"type": "error", "error": str(e)})
            yield f"event: error\ndata: {error_data}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/suggestions", response_model=SuggestionResponse)
async def get_suggestions(
    query: str = "",
    current_user: User = Depends(get_current_user)
):
    """
    Get AI-powered command suggestions based on partial input.
    
    Useful for autocomplete functionality in the chat interface.
    
    Example: GET /api/ai/suggestions?query=create a
    Returns: ["Create a cube at the origin", "Create a sphere at 0,0,100", ...]
    """
    ai_service = get_ue5_ai_chat_service()
    
    if not query.strip():
        # Return default suggestions
        return SuggestionResponse(suggestions=[
            "Create a cube at the origin",
            "Take a screenshot",
            "Start the game",
            "Get all actors in the level",
            "Save the current level"
        ])
    
    suggestions = await ai_service.get_tool_suggestion(query)
    
    if not suggestions:
        # Fallback suggestions based on keywords
        query_lower = query.lower()
        fallback = []
        
        if "create" in query_lower or "spawn" in query_lower:
            fallback = [
                "Create a cube at 0, 0, 100",
                "Create a sphere at the origin",
                "Create a point light at 0, 0, 200"
            ]
        elif "move" in query_lower:
            fallback = [
                "Move the selected actor to 100, 0, 0",
                "Move Cube_1 to the origin"
            ]
        elif "delete" in query_lower or "remove" in query_lower:
            fallback = [
                "Delete the selected actor",
                "Delete Cube_1"
            ]
        elif "play" in query_lower or "game" in query_lower:
            fallback = [
                "Start the game",
                "Stop the game"
            ]
        elif "save" in query_lower:
            fallback = [
                "Save the current level",
                "Save all"
            ]
        else:
            fallback = [
                f"{query} - press Enter to execute",
                "Create a cube at the origin",
                "Take a screenshot"
            ]
        
        return SuggestionResponse(suggestions=fallback)
    
    return SuggestionResponse(suggestions=suggestions)


@router.get("/tools")
async def get_available_tools(
    current_user: User = Depends(get_current_user)
):
    """
    Get the list of available MCP tools that the AI can use.
    
    Returns tool definitions with descriptions and parameters.
    """
    ai_service = get_ue5_ai_chat_service()
    
    tools = []
    for tool_def in ai_service.tools:
        func = tool_def.get("function", {})
        tools.append({
            "name": func.get("name"),
            "description": func.get("description"),
            "parameters": func.get("parameters", {}).get("properties", {}),
            "required": func.get("parameters", {}).get("required", [])
        })
    
    return {"tools": tools, "count": len(tools)}


@router.post("/execute")
async def execute_tool_directly(
    tool_name: str,
    arguments: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Execute an MCP tool directly without AI interpretation.
    
    Useful for programmatic tool execution or when the exact
    tool and parameters are already known.
    """
    result = await execute_mcp_tool(tool_name, arguments, current_user.id)
    return {
        "tool_name": tool_name,
        "arguments": arguments,
        "result": result,
        "success": True
    }
