"""
Action History API

Endpoints for managing action history with undo/redo capability.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.auth import get_current_user
from services.action_history import get_action_history_service, ActionHistoryService
from services.agent_relay import AgentRelayService
from models.user import User


router = APIRouter(prefix="/action-history", tags=["action-history"])


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


class ActionResponse(BaseModel):
    """Response containing an action record"""
    id: str
    action_type: str
    tool_name: str
    tool_params: Dict[str, Any]
    description: str
    timestamp: str
    status: str
    before_screenshot: Optional[str] = None
    after_screenshot: Optional[str] = None
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    group_order: int = 0
    can_undo: bool
    error: Optional[str] = None


class HistoryResponse(BaseModel):
    """Response containing action history"""
    actions: List[ActionResponse]
    can_undo: bool
    can_redo: bool
    total_count: int


class UndoResponse(BaseModel):
    """Response after undo/redo operation"""
    success: bool
    action: Optional[ActionResponse] = None
    message: str


class BatchUndoResponse(BaseModel):
    """Response after batch undo operation"""
    success: bool
    undone_count: int
    actions: List[ActionResponse]
    message: str


@router.get("", response_model=HistoryResponse)
async def get_action_history(
    limit: int = Query(50, ge=1, le=200),
    include_undone: bool = Query(True),
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """
    Get action history for the current user.
    
    Args:
        limit: Maximum number of actions to return
        include_undone: Whether to include undone actions
        
    Returns:
        List of actions in reverse chronological order
    """
    actions = history_service.get_history(
        user_id=current_user.id,
        limit=limit,
        include_undone=include_undone
    )
    
    return {
        "actions": [history_service.action_to_dict(a) for a in actions],
        "can_undo": history_service.can_undo(current_user.id),
        "can_redo": history_service.can_redo(current_user.id),
        "total_count": len(actions)
    }


@router.get("/{action_id}", response_model=ActionResponse)
async def get_action(
    action_id: str,
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """Get a specific action by ID"""
    action = history_service.get_action(current_user.id, action_id)
    
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    return history_service.action_to_dict(action)


@router.post("/undo", response_model=UndoResponse)
async def undo_latest_action(
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """
    Undo the most recent action.
    
    Returns:
        The undone action record
    """
    agent_relay = get_agent_relay()
    
    if not history_service.can_undo(current_user.id):
        raise HTTPException(status_code=400, detail="Nothing to undo")
    
    try:
        action = await history_service.undo_action(
            user_id=current_user.id,
            agent_relay_service=agent_relay
        )
        
        if action:
            return {
                "success": True,
                "action": history_service.action_to_dict(action),
                "message": f"Undone: {action.description}"
            }
        else:
            return {
                "success": False,
                "action": None,
                "message": "Failed to undo action"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Undo failed: {str(e)}")


@router.post("/undo/{action_id}", response_model=UndoResponse)
async def undo_specific_action(
    action_id: str,
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """
    Undo a specific action by ID.
    
    Args:
        action_id: ID of the action to undo
        
    Returns:
        The undone action record
    """
    agent_relay = get_agent_relay()
    
    action = history_service.get_action(current_user.id, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    try:
        result = await history_service.undo_action(
            user_id=current_user.id,
            action_id=action_id,
            agent_relay_service=agent_relay
        )
        
        if result:
            return {
                "success": True,
                "action": history_service.action_to_dict(result),
                "message": f"Undone: {result.description}"
            }
        else:
            return {
                "success": False,
                "action": None,
                "message": "Failed to undo action"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Undo failed: {str(e)}")


@router.post("/undo-to/{action_id}", response_model=BatchUndoResponse)
async def undo_to_action(
    action_id: str,
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """
    Undo all actions back to (and including) a specific action.
    
    Args:
        action_id: Target action to undo back to
        
    Returns:
        List of undone actions
    """
    agent_relay = get_agent_relay()
    
    action = history_service.get_action(current_user.id, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    try:
        undone_actions = await history_service.undo_to_action(
            user_id=current_user.id,
            action_id=action_id,
            agent_relay_service=agent_relay
        )
        
        return {
            "success": True,
            "undone_count": len(undone_actions),
            "actions": [history_service.action_to_dict(a) for a in undone_actions],
            "message": f"Undone {len(undone_actions)} actions"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch undo failed: {str(e)}")


@router.post("/undo-group/{group_id}", response_model=BatchUndoResponse)
async def undo_action_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """
    Undo all actions in a group (batch undo).
    
    Args:
        group_id: ID of the group to undo
        
    Returns:
        List of undone actions
    """
    agent_relay = get_agent_relay()
    
    try:
        undone_actions = await history_service.undo_group(
            user_id=current_user.id,
            group_id=group_id,
            agent_relay_service=agent_relay
        )
        
        return {
            "success": True,
            "undone_count": len(undone_actions),
            "actions": [history_service.action_to_dict(a) for a in undone_actions],
            "message": f"Undone {len(undone_actions)} actions in group"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Group undo failed: {str(e)}")


@router.post("/redo", response_model=UndoResponse)
async def redo_action(
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """
    Redo the most recently undone action.
    
    Returns:
        The redone action record
    """
    agent_relay = get_agent_relay()
    
    if not history_service.can_redo(current_user.id):
        raise HTTPException(status_code=400, detail="Nothing to redo")
    
    try:
        action = await history_service.redo_action(
            user_id=current_user.id,
            agent_relay_service=agent_relay
        )
        
        if action:
            return {
                "success": True,
                "action": history_service.action_to_dict(action),
                "message": f"Redone: {action.description}"
            }
        else:
            return {
                "success": False,
                "action": None,
                "message": "Failed to redo action"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redo failed: {str(e)}")


@router.post("/clear")
async def clear_history(
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """Clear all action history for the current user"""
    history_service.clear_history(current_user.id)
    return {"success": True, "message": "History cleared"}


@router.get("/undo-stack")
async def get_undo_stack(
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """Get all actions that can be undone"""
    actions = history_service.get_undo_stack(current_user.id)
    return {
        "actions": [history_service.action_to_dict(a) for a in actions],
        "count": len(actions)
    }


@router.get("/redo-stack")
async def get_redo_stack(
    current_user: User = Depends(get_current_user),
    history_service: ActionHistoryService = Depends(get_action_history_service)
):
    """Get all actions that can be redone"""
    actions = history_service.get_redo_stack(current_user.id)
    return {
        "actions": [history_service.action_to_dict(a) for a in actions],
        "count": len(actions)
    }
