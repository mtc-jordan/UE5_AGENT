"""
Action History Service

Tracks all AI actions with undo/redo capability and visual previews.
Provides timeline of executed commands with state snapshots.

Features:
- Track all tool executions with parameters and results
- Store viewport screenshots for each state
- Support single and batch undo operations
- Redo capability for undone actions
- Action grouping for multi-step operations
"""

import uuid
import asyncio
from datetime import datetime
from typing import Optional, Dict, List, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import deque


class ActionType(str, Enum):
    """Types of actions that can be tracked"""
    SPAWN = "spawn"
    DELETE = "delete"
    TRANSFORM = "transform"
    PROPERTY = "property"
    MATERIAL = "material"
    BLUEPRINT = "blueprint"
    SCENE = "scene"
    OTHER = "other"


class ActionStatus(str, Enum):
    """Status of an action"""
    EXECUTED = "executed"
    UNDONE = "undone"
    FAILED = "failed"


@dataclass
class ActionSnapshot:
    """Snapshot of an actor's state before/after an action"""
    actor_name: str
    actor_class: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    rotation: Optional[Dict[str, float]] = None
    scale: Optional[Dict[str, float]] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    exists: bool = True


@dataclass
class ActionRecord:
    """Record of a single action"""
    id: str
    user_id: int
    action_type: ActionType
    tool_name: str
    tool_params: Dict[str, Any]
    description: str
    timestamp: datetime
    status: ActionStatus = ActionStatus.EXECUTED
    
    # State snapshots
    before_state: Optional[ActionSnapshot] = None
    after_state: Optional[ActionSnapshot] = None
    
    # Screenshot data (base64)
    before_screenshot: Optional[str] = None
    after_screenshot: Optional[str] = None
    
    # For undo
    undo_tool: Optional[str] = None
    undo_params: Optional[Dict[str, Any]] = None
    
    # Grouping for batch operations
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    group_order: int = 0
    
    # Result
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class ActionGroup:
    """Group of related actions for batch undo"""
    id: str
    name: str
    user_id: int
    actions: List[str]  # List of action IDs
    timestamp: datetime
    status: ActionStatus = ActionStatus.EXECUTED


class ActionHistoryService:
    """
    Service for tracking and managing action history with undo/redo.
    
    Maintains a timeline of all AI actions with state snapshots
    and provides undo/redo functionality.
    """
    
    def __init__(self, max_history: int = 100):
        self.max_history = max_history
        
        # Action storage per user
        self.actions: Dict[int, Dict[str, ActionRecord]] = {}
        self.action_order: Dict[int, List[str]] = {}  # Ordered list of action IDs
        
        # Undo/redo stacks per user
        self.undo_stack: Dict[int, List[str]] = {}
        self.redo_stack: Dict[int, List[str]] = {}
        
        # Action groups per user
        self.groups: Dict[int, Dict[str, ActionGroup]] = {}
        
        # Current active group for batch operations
        self.active_group: Dict[int, Optional[str]] = {}
    
    def _ensure_user_storage(self, user_id: int):
        """Ensure storage exists for a user"""
        if user_id not in self.actions:
            self.actions[user_id] = {}
            self.action_order[user_id] = []
            self.undo_stack[user_id] = []
            self.redo_stack[user_id] = []
            self.groups[user_id] = {}
            self.active_group[user_id] = None
    
    def start_action_group(self, user_id: int, name: str) -> str:
        """Start a new action group for batch operations"""
        self._ensure_user_storage(user_id)
        
        group_id = str(uuid.uuid4())[:8]
        group = ActionGroup(
            id=group_id,
            name=name,
            user_id=user_id,
            actions=[],
            timestamp=datetime.now()
        )
        
        self.groups[user_id][group_id] = group
        self.active_group[user_id] = group_id
        
        return group_id
    
    def end_action_group(self, user_id: int) -> Optional[ActionGroup]:
        """End the current action group"""
        self._ensure_user_storage(user_id)
        
        group_id = self.active_group.get(user_id)
        if group_id:
            self.active_group[user_id] = None
            return self.groups[user_id].get(group_id)
        return None
    
    def record_action(
        self,
        user_id: int,
        tool_name: str,
        tool_params: Dict[str, Any],
        result: Optional[Dict[str, Any]] = None,
        before_state: Optional[ActionSnapshot] = None,
        after_state: Optional[ActionSnapshot] = None,
        before_screenshot: Optional[str] = None,
        after_screenshot: Optional[str] = None,
        description: Optional[str] = None
    ) -> ActionRecord:
        """
        Record a new action in the history.
        
        Args:
            user_id: User who performed the action
            tool_name: Name of the MCP tool executed
            tool_params: Parameters passed to the tool
            result: Result from the tool execution
            before_state: State snapshot before action
            after_state: State snapshot after action
            before_screenshot: Base64 screenshot before action
            after_screenshot: Base64 screenshot after action
            description: Human-readable description
            
        Returns:
            The created ActionRecord
        """
        self._ensure_user_storage(user_id)
        
        action_id = str(uuid.uuid4())[:8]
        action_type = self._determine_action_type(tool_name)
        
        # Generate description if not provided
        if not description:
            description = self._generate_description(tool_name, tool_params)
        
        # Determine undo operation
        undo_tool, undo_params = self._determine_undo_operation(
            tool_name, tool_params, before_state, after_state
        )
        
        # Check for active group
        group_id = self.active_group.get(user_id)
        group_order = 0
        group_name = None
        
        if group_id and group_id in self.groups[user_id]:
            group = self.groups[user_id][group_id]
            group_order = len(group.actions)
            group_name = group.name
            group.actions.append(action_id)
        
        action = ActionRecord(
            id=action_id,
            user_id=user_id,
            action_type=action_type,
            tool_name=tool_name,
            tool_params=tool_params,
            description=description,
            timestamp=datetime.now(),
            before_state=before_state,
            after_state=after_state,
            before_screenshot=before_screenshot,
            after_screenshot=after_screenshot,
            undo_tool=undo_tool,
            undo_params=undo_params,
            group_id=group_id,
            group_name=group_name,
            group_order=group_order,
            result=result
        )
        
        # Store action
        self.actions[user_id][action_id] = action
        self.action_order[user_id].append(action_id)
        
        # Add to undo stack
        self.undo_stack[user_id].append(action_id)
        
        # Clear redo stack (new action invalidates redo history)
        self.redo_stack[user_id].clear()
        
        # Trim history if needed
        self._trim_history(user_id)
        
        return action
    
    def _determine_action_type(self, tool_name: str) -> ActionType:
        """Determine action type from tool name"""
        tool_lower = tool_name.lower()
        
        if 'spawn' in tool_lower or 'create' in tool_lower:
            return ActionType.SPAWN
        elif 'delete' in tool_lower or 'destroy' in tool_lower:
            return ActionType.DELETE
        elif any(t in tool_lower for t in ['location', 'rotation', 'scale', 'transform', 'move', 'rotate']):
            return ActionType.TRANSFORM
        elif 'material' in tool_lower:
            return ActionType.MATERIAL
        elif 'blueprint' in tool_lower:
            return ActionType.BLUEPRINT
        elif 'property' in tool_lower or 'set_' in tool_lower:
            return ActionType.PROPERTY
        else:
            return ActionType.OTHER
    
    def _generate_description(self, tool_name: str, params: Dict[str, Any]) -> str:
        """Generate human-readable description for an action"""
        tool_lower = tool_name.lower()
        
        if 'spawn' in tool_lower:
            actor_name = params.get('actor_name', params.get('asset_path', 'Actor'))
            return f"Spawned {actor_name}"
        elif 'delete' in tool_lower:
            actor_name = params.get('actor_name', 'Actor')
            return f"Deleted {actor_name}"
        elif 'location' in tool_lower or 'move' in tool_lower:
            actor_name = params.get('actor_name', 'Actor')
            x = params.get('x', params.get('location_x', 0))
            y = params.get('y', params.get('location_y', 0))
            z = params.get('z', params.get('location_z', 0))
            return f"Moved {actor_name} to ({x:.0f}, {y:.0f}, {z:.0f})"
        elif 'rotation' in tool_lower or 'rotate' in tool_lower:
            actor_name = params.get('actor_name', 'Actor')
            return f"Rotated {actor_name}"
        elif 'scale' in tool_lower:
            actor_name = params.get('actor_name', 'Actor')
            return f"Scaled {actor_name}"
        elif 'material' in tool_lower:
            actor_name = params.get('actor_name', 'Actor')
            return f"Changed material on {actor_name}"
        elif 'property' in tool_lower:
            actor_name = params.get('actor_name', 'Actor')
            prop_name = params.get('property_name', 'property')
            return f"Set {prop_name} on {actor_name}"
        else:
            return f"Executed {tool_name}"
    
    def _determine_undo_operation(
        self,
        tool_name: str,
        params: Dict[str, Any],
        before_state: Optional[ActionSnapshot],
        after_state: Optional[ActionSnapshot]
    ) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        """Determine how to undo an action"""
        tool_lower = tool_name.lower()
        
        # Spawn -> Delete
        if 'spawn' in tool_lower:
            actor_name = params.get('actor_name')
            if actor_name:
                return 'delete_actor', {'actor_name': actor_name}
        
        # Delete -> Spawn (if we have the state)
        elif 'delete' in tool_lower and before_state and before_state.exists:
            return 'spawn_actor', {
                'actor_name': before_state.actor_name,
                'actor_class': before_state.actor_class,
                'location_x': before_state.location.get('x', 0) if before_state.location else 0,
                'location_y': before_state.location.get('y', 0) if before_state.location else 0,
                'location_z': before_state.location.get('z', 0) if before_state.location else 0,
            }
        
        # Transform -> Restore previous transform
        elif any(t in tool_lower for t in ['location', 'move']) and before_state and before_state.location:
            return 'set_actor_location', {
                'actor_name': params.get('actor_name'),
                'x': before_state.location.get('x', 0),
                'y': before_state.location.get('y', 0),
                'z': before_state.location.get('z', 0),
            }
        
        elif any(t in tool_lower for t in ['rotation', 'rotate']) and before_state and before_state.rotation:
            return 'set_actor_rotation', {
                'actor_name': params.get('actor_name'),
                'pitch': before_state.rotation.get('pitch', 0),
                'yaw': before_state.rotation.get('yaw', 0),
                'roll': before_state.rotation.get('roll', 0),
            }
        
        elif 'scale' in tool_lower and before_state and before_state.scale:
            return 'set_actor_scale', {
                'actor_name': params.get('actor_name'),
                'x': before_state.scale.get('x', 1),
                'y': before_state.scale.get('y', 1),
                'z': before_state.scale.get('z', 1),
            }
        
        return None, None
    
    def _trim_history(self, user_id: int):
        """Trim history to max size"""
        while len(self.action_order[user_id]) > self.max_history:
            oldest_id = self.action_order[user_id].pop(0)
            if oldest_id in self.actions[user_id]:
                del self.actions[user_id][oldest_id]
            if oldest_id in self.undo_stack[user_id]:
                self.undo_stack[user_id].remove(oldest_id)
    
    async def undo_action(
        self,
        user_id: int,
        action_id: Optional[str] = None,
        agent_relay_service = None
    ) -> Optional[ActionRecord]:
        """
        Undo an action (or the most recent if no ID provided).
        
        Args:
            user_id: User performing the undo
            action_id: Specific action to undo (optional)
            agent_relay_service: Service for executing undo commands
            
        Returns:
            The undone action record, or None if undo failed
        """
        self._ensure_user_storage(user_id)
        
        if not self.undo_stack[user_id]:
            return None
        
        # Get action to undo
        if action_id:
            if action_id not in self.actions[user_id]:
                return None
            # Remove all actions after this one from undo stack
            idx = self.undo_stack[user_id].index(action_id) if action_id in self.undo_stack[user_id] else -1
            if idx == -1:
                return None
            target_id = action_id
        else:
            target_id = self.undo_stack[user_id][-1]
        
        action = self.actions[user_id][target_id]
        
        # Execute undo if we have the operation
        if action.undo_tool and action.undo_params and agent_relay_service:
            try:
                result = await agent_relay_service.execute_tool(
                    user_id,
                    action.undo_tool,
                    action.undo_params
                )
                action.status = ActionStatus.UNDONE
            except Exception as e:
                action.error = str(e)
                return None
        else:
            action.status = ActionStatus.UNDONE
        
        # Move from undo to redo stack
        self.undo_stack[user_id].remove(target_id)
        self.redo_stack[user_id].append(target_id)
        
        return action
    
    async def redo_action(
        self,
        user_id: int,
        agent_relay_service = None
    ) -> Optional[ActionRecord]:
        """
        Redo the most recently undone action.
        
        Args:
            user_id: User performing the redo
            agent_relay_service: Service for executing redo commands
            
        Returns:
            The redone action record, or None if redo failed
        """
        self._ensure_user_storage(user_id)
        
        if not self.redo_stack[user_id]:
            return None
        
        target_id = self.redo_stack[user_id][-1]
        action = self.actions[user_id][target_id]
        
        # Re-execute the original action
        if agent_relay_service:
            try:
                result = await agent_relay_service.execute_tool(
                    user_id,
                    action.tool_name,
                    action.tool_params
                )
                action.status = ActionStatus.EXECUTED
                action.result = result
            except Exception as e:
                action.error = str(e)
                return None
        else:
            action.status = ActionStatus.EXECUTED
        
        # Move from redo to undo stack
        self.redo_stack[user_id].remove(target_id)
        self.undo_stack[user_id].append(target_id)
        
        return action
    
    async def undo_to_action(
        self,
        user_id: int,
        action_id: str,
        agent_relay_service = None
    ) -> List[ActionRecord]:
        """
        Undo all actions back to (and including) a specific action.
        
        Args:
            user_id: User performing the undo
            action_id: Target action to undo back to
            agent_relay_service: Service for executing undo commands
            
        Returns:
            List of undone actions
        """
        self._ensure_user_storage(user_id)
        
        undone_actions = []
        
        # Find the action in undo stack
        if action_id not in self.undo_stack[user_id]:
            return undone_actions
        
        idx = self.undo_stack[user_id].index(action_id)
        
        # Undo all actions from the end to the target (inclusive)
        actions_to_undo = self.undo_stack[user_id][idx:][::-1]  # Reverse order
        
        for aid in actions_to_undo:
            result = await self.undo_action(user_id, aid, agent_relay_service)
            if result:
                undone_actions.append(result)
        
        return undone_actions
    
    async def undo_group(
        self,
        user_id: int,
        group_id: str,
        agent_relay_service = None
    ) -> List[ActionRecord]:
        """
        Undo all actions in a group (batch undo).
        
        Args:
            user_id: User performing the undo
            group_id: Group to undo
            agent_relay_service: Service for executing undo commands
            
        Returns:
            List of undone actions
        """
        self._ensure_user_storage(user_id)
        
        if group_id not in self.groups[user_id]:
            return []
        
        group = self.groups[user_id][group_id]
        undone_actions = []
        
        # Undo actions in reverse order
        for action_id in reversed(group.actions):
            if action_id in self.undo_stack[user_id]:
                result = await self.undo_action(user_id, action_id, agent_relay_service)
                if result:
                    undone_actions.append(result)
        
        group.status = ActionStatus.UNDONE
        return undone_actions
    
    def get_action(self, user_id: int, action_id: str) -> Optional[ActionRecord]:
        """Get a specific action by ID"""
        self._ensure_user_storage(user_id)
        return self.actions[user_id].get(action_id)
    
    def get_history(
        self,
        user_id: int,
        limit: int = 50,
        include_undone: bool = True
    ) -> List[ActionRecord]:
        """
        Get action history for a user.
        
        Args:
            user_id: User to get history for
            limit: Maximum number of actions to return
            include_undone: Whether to include undone actions
            
        Returns:
            List of actions in reverse chronological order
        """
        self._ensure_user_storage(user_id)
        
        actions = []
        for action_id in reversed(self.action_order[user_id]):
            if action_id in self.actions[user_id]:
                action = self.actions[user_id][action_id]
                if include_undone or action.status != ActionStatus.UNDONE:
                    actions.append(action)
                    if len(actions) >= limit:
                        break
        
        return actions
    
    def get_undo_stack(self, user_id: int) -> List[ActionRecord]:
        """Get all actions that can be undone"""
        self._ensure_user_storage(user_id)
        return [
            self.actions[user_id][aid]
            for aid in self.undo_stack[user_id]
            if aid in self.actions[user_id]
        ]
    
    def get_redo_stack(self, user_id: int) -> List[ActionRecord]:
        """Get all actions that can be redone"""
        self._ensure_user_storage(user_id)
        return [
            self.actions[user_id][aid]
            for aid in self.redo_stack[user_id]
            if aid in self.actions[user_id]
        ]
    
    def can_undo(self, user_id: int) -> bool:
        """Check if undo is available"""
        self._ensure_user_storage(user_id)
        return len(self.undo_stack[user_id]) > 0
    
    def can_redo(self, user_id: int) -> bool:
        """Check if redo is available"""
        self._ensure_user_storage(user_id)
        return len(self.redo_stack[user_id]) > 0
    
    def clear_history(self, user_id: int):
        """Clear all history for a user"""
        self._ensure_user_storage(user_id)
        self.actions[user_id].clear()
        self.action_order[user_id].clear()
        self.undo_stack[user_id].clear()
        self.redo_stack[user_id].clear()
        self.groups[user_id].clear()
        self.active_group[user_id] = None
    
    def action_to_dict(self, action: ActionRecord) -> Dict[str, Any]:
        """Convert action to dictionary for API response"""
        return {
            'id': action.id,
            'action_type': action.action_type.value,
            'tool_name': action.tool_name,
            'tool_params': action.tool_params,
            'description': action.description,
            'timestamp': action.timestamp.isoformat(),
            'status': action.status.value,
            'before_screenshot': action.before_screenshot,
            'after_screenshot': action.after_screenshot,
            'group_id': action.group_id,
            'group_name': action.group_name,
            'group_order': action.group_order,
            'can_undo': action.undo_tool is not None,
            'error': action.error
        }


# Global service instance
_action_history_service: Optional[ActionHistoryService] = None


def get_action_history_service() -> ActionHistoryService:
    """Get the global action history service instance"""
    global _action_history_service
    if _action_history_service is None:
        _action_history_service = ActionHistoryService()
    return _action_history_service
