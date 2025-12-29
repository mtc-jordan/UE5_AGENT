"""
UE5 Command Service
===================

Central service for executing UE5 commands through the MCP Bridge.
Provides a unified interface for all UE5 operations including:
- Lighting control
- Animation playback
- Actor management
- Scene manipulation
- Performance optimization

This service acts as the bridge between the frontend UI and the UE5 MCP server.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class CommandCategory(str, Enum):
    """Categories of UE5 commands."""
    LIGHTING = "lighting"
    ANIMATION = "animation"
    SCENE = "scene"
    ACTOR = "actor"
    MATERIAL = "material"
    BLUEPRINT = "blueprint"
    PERFORMANCE = "performance"
    VIEWPORT = "viewport"
    ASSET = "asset"


class CommandStatus(str, Enum):
    """Status of a command execution."""
    PENDING = "pending"
    EXECUTING = "executing"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class CommandResult:
    """Result of a UE5 command execution."""
    success: bool
    command: str
    category: CommandCategory
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: float = 0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "command": self.command,
            "category": self.category.value,
            "result": self.result,
            "error": self.error,
            "execution_time_ms": self.execution_time_ms,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class CommandBatch:
    """A batch of commands to execute together."""
    commands: List[Dict[str, Any]]
    category: CommandCategory
    parallel: bool = False
    stop_on_error: bool = True
    
    
class UE5CommandService:
    """
    Central service for executing UE5 commands.
    
    This service provides:
    - Command execution through MCP Bridge
    - Command batching and sequencing
    - Error handling and retries
    - Command history tracking
    - Event callbacks for UI updates
    """
    
    def __init__(self, agent_relay=None):
        self._agent_relay = agent_relay
        self._command_history: List[CommandResult] = []
        self._max_history = 100
        self._callbacks: Dict[str, List[Callable]] = {}
        self._lock = asyncio.Lock()
        
    def set_agent_relay(self, relay):
        """Set the agent relay service."""
        self._agent_relay = relay
        
    def on(self, event: str, callback: Callable):
        """Register an event callback."""
        if event not in self._callbacks:
            self._callbacks[event] = []
        self._callbacks[event].append(callback)
        
    async def _emit(self, event: str, data: Any):
        """Emit an event to all registered callbacks."""
        if event in self._callbacks:
            for callback in self._callbacks[event]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(data)
                    else:
                        callback(data)
                except Exception as e:
                    logger.error(f"Error in event callback: {e}")
    
    async def execute(
        self,
        user_id: int,
        tool_name: str,
        parameters: Dict[str, Any],
        category: CommandCategory = CommandCategory.SCENE,
        timeout: float = 30.0
    ) -> CommandResult:
        """
        Execute a single UE5 command.
        
        Args:
            user_id: The user's ID
            tool_name: Name of the MCP tool to execute
            parameters: Tool parameters
            category: Command category for tracking
            timeout: Execution timeout in seconds
            
        Returns:
            CommandResult with execution details
        """
        start_time = datetime.utcnow()
        
        if not self._agent_relay:
            return CommandResult(
                success=False,
                command=tool_name,
                category=category,
                error="Agent relay service not available"
            )
        
        try:
            await self._emit("command_start", {
                "tool": tool_name,
                "params": parameters,
                "category": category.value
            })
            
            result = await self._agent_relay.execute_tool(
                user_id=user_id,
                tool_name=tool_name,
                parameters=parameters,
                timeout=timeout
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            cmd_result = CommandResult(
                success=True,
                command=tool_name,
                category=category,
                result=result,
                execution_time_ms=execution_time
            )
            
            await self._add_to_history(cmd_result)
            await self._emit("command_success", cmd_result.to_dict())
            
            return cmd_result
            
        except Exception as e:
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            cmd_result = CommandResult(
                success=False,
                command=tool_name,
                category=category,
                error=str(e),
                execution_time_ms=execution_time
            )
            
            await self._add_to_history(cmd_result)
            await self._emit("command_error", cmd_result.to_dict())
            
            return cmd_result
    
    async def execute_batch(
        self,
        user_id: int,
        batch: CommandBatch,
        timeout: float = 60.0
    ) -> List[CommandResult]:
        """
        Execute a batch of commands.
        
        Args:
            user_id: The user's ID
            batch: CommandBatch containing commands to execute
            timeout: Total timeout for the batch
            
        Returns:
            List of CommandResults
        """
        results = []
        
        if batch.parallel:
            # Execute all commands in parallel
            tasks = [
                self.execute(
                    user_id=user_id,
                    tool_name=cmd["tool"],
                    parameters=cmd.get("params", {}),
                    category=batch.category,
                    timeout=timeout / len(batch.commands)
                )
                for cmd in batch.commands
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            # Convert exceptions to CommandResults
            results = [
                r if isinstance(r, CommandResult) else CommandResult(
                    success=False,
                    command="unknown",
                    category=batch.category,
                    error=str(r)
                )
                for r in results
            ]
        else:
            # Execute commands sequentially
            for cmd in batch.commands:
                result = await self.execute(
                    user_id=user_id,
                    tool_name=cmd["tool"],
                    parameters=cmd.get("params", {}),
                    category=batch.category,
                    timeout=timeout
                )
                results.append(result)
                
                if batch.stop_on_error and not result.success:
                    break
        
        return results
    
    async def _add_to_history(self, result: CommandResult):
        """Add a command result to history."""
        async with self._lock:
            self._command_history.append(result)
            if len(self._command_history) > self._max_history:
                self._command_history = self._command_history[-self._max_history:]
    
    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get command history."""
        return [r.to_dict() for r in self._command_history[-limit:]]
    
    # ==================== LIGHTING COMMANDS ====================
    
    async def set_time_of_day(
        self,
        user_id: int,
        time: float,
        animate: bool = False,
        duration: float = 2.0
    ) -> CommandResult:
        """Set the time of day in UE5."""
        return await self.execute(
            user_id=user_id,
            tool_name="set_sun_position",
            parameters={
                "time_of_day": time,
                "animate": animate,
                "duration": duration
            },
            category=CommandCategory.LIGHTING
        )
    
    async def set_sun_properties(
        self,
        user_id: int,
        intensity: float = 1.0,
        color: str = "#FFFFFF",
        time_of_day: Optional[float] = None
    ) -> CommandResult:
        """Set sun/directional light properties."""
        params = {
            "intensity": intensity,
            "color": color
        }
        if time_of_day is not None:
            params["time_of_day"] = time_of_day
            
        return await self.execute(
            user_id=user_id,
            tool_name="set_directional_light",
            parameters=params,
            category=CommandCategory.LIGHTING
        )
    
    async def set_sky_light(
        self,
        user_id: int,
        intensity: float = 1.0,
        color: str = "#87CEEB"
    ) -> CommandResult:
        """Set sky light properties."""
        return await self.execute(
            user_id=user_id,
            tool_name="set_sky_light",
            parameters={
                "intensity": intensity,
                "color": color
            },
            category=CommandCategory.LIGHTING
        )
    
    async def set_post_process(
        self,
        user_id: int,
        bloom: float = 0.2,
        exposure: float = 1.0,
        contrast: float = 1.0,
        saturation: float = 1.0,
        temperature: int = 5500
    ) -> CommandResult:
        """Set post-process volume settings."""
        return await self.execute(
            user_id=user_id,
            tool_name="set_post_process_settings",
            parameters={
                "bloom_intensity": bloom,
                "auto_exposure_bias": exposure,
                "color_contrast": contrast,
                "color_saturation": saturation,
                "white_temp": temperature
            },
            category=CommandCategory.LIGHTING
        )
    
    async def spawn_light(
        self,
        user_id: int,
        light_type: str,
        location: Dict[str, float],
        intensity: float = 1.0,
        color: str = "#FFFFFF",
        **kwargs
    ) -> CommandResult:
        """Spawn a light actor in the scene."""
        params = {
            "light_type": light_type,
            "location": location,
            "intensity": intensity,
            "color": color,
            **kwargs
        }
        return await self.execute(
            user_id=user_id,
            tool_name="spawn_light",
            parameters=params,
            category=CommandCategory.LIGHTING
        )
    
    async def apply_lighting_preset(
        self,
        user_id: int,
        preset: Dict[str, Any]
    ) -> List[CommandResult]:
        """Apply a complete lighting preset."""
        commands = []
        
        # Sun/directional light
        if "sun_intensity" in preset or "time_of_day" in preset:
            commands.append({
                "tool": "set_directional_light",
                "params": {
                    "intensity": preset.get("sun_intensity", 1.0),
                    "color": preset.get("sun_color", "#FFFFFF"),
                    "time_of_day": preset.get("time_of_day", 12.0)
                }
            })
        
        # Sky light
        if "sky_intensity" in preset:
            commands.append({
                "tool": "set_sky_light",
                "params": {
                    "intensity": preset.get("sky_intensity", 1.0),
                    "color": preset.get("sky_color", "#87CEEB")
                }
            })
        
        # Post-process
        if any(k in preset for k in ["bloom_intensity", "exposure", "contrast", "saturation"]):
            commands.append({
                "tool": "set_post_process_settings",
                "params": {
                    "bloom_intensity": preset.get("bloom_intensity", 0.2),
                    "auto_exposure_bias": preset.get("exposure", 1.0),
                    "color_contrast": preset.get("contrast", 1.0),
                    "color_saturation": preset.get("saturation", 1.0),
                    "white_temp": preset.get("temperature", 5500)
                }
            })
        
        # Fog
        if preset.get("fog_density", 0) > 0:
            commands.append({
                "tool": "set_exponential_fog",
                "params": {
                    "fog_density": preset.get("fog_density", 0.02),
                    "fog_color": preset.get("fog_color", "#FFFFFF")
                }
            })
        
        # Additional lights
        for light in preset.get("additional_lights", []):
            commands.append({
                "tool": "spawn_light",
                "params": light
            })
        
        batch = CommandBatch(
            commands=commands,
            category=CommandCategory.LIGHTING,
            parallel=False,
            stop_on_error=False
        )
        
        return await self.execute_batch(user_id, batch)
    
    # ==================== ANIMATION COMMANDS ====================
    
    async def play_animation(
        self,
        user_id: int,
        actor_name: str,
        animation_asset: str,
        loop: bool = False,
        play_rate: float = 1.0
    ) -> CommandResult:
        """Play an animation on an actor."""
        return await self.execute(
            user_id=user_id,
            tool_name="play_animation",
            parameters={
                "actor_name": actor_name,
                "animation_asset": animation_asset,
                "looping": loop,
                "play_rate": play_rate
            },
            category=CommandCategory.ANIMATION
        )
    
    async def stop_animation(
        self,
        user_id: int,
        actor_name: str
    ) -> CommandResult:
        """Stop animation on an actor."""
        return await self.execute(
            user_id=user_id,
            tool_name="stop_animation",
            parameters={"actor_name": actor_name},
            category=CommandCategory.ANIMATION
        )
    
    async def set_animation_speed(
        self,
        user_id: int,
        actor_name: str,
        speed: float
    ) -> CommandResult:
        """Set animation playback speed."""
        return await self.execute(
            user_id=user_id,
            tool_name="set_animation_play_rate",
            parameters={
                "actor_name": actor_name,
                "play_rate": speed
            },
            category=CommandCategory.ANIMATION
        )
    
    async def create_animation_montage(
        self,
        user_id: int,
        name: str,
        animations: List[str],
        blend_time: float = 0.25
    ) -> CommandResult:
        """Create an animation montage."""
        return await self.execute(
            user_id=user_id,
            tool_name="create_animation_montage",
            parameters={
                "montage_name": name,
                "animation_sequences": animations,
                "blend_in_time": blend_time,
                "blend_out_time": blend_time
            },
            category=CommandCategory.ANIMATION
        )
    
    async def create_blend_space(
        self,
        user_id: int,
        name: str,
        animations: List[Dict[str, Any]],
        axis_x: str = "Speed",
        axis_y: str = "Direction"
    ) -> CommandResult:
        """Create a blend space."""
        return await self.execute(
            user_id=user_id,
            tool_name="create_blend_space",
            parameters={
                "blend_space_name": name,
                "animations": animations,
                "horizontal_axis": axis_x,
                "vertical_axis": axis_y
            },
            category=CommandCategory.ANIMATION
        )
    
    # ==================== ACTOR COMMANDS ====================
    
    async def spawn_actor(
        self,
        user_id: int,
        actor_class: str,
        location: Dict[str, float],
        rotation: Optional[Dict[str, float]] = None,
        scale: Optional[Dict[str, float]] = None,
        name: Optional[str] = None
    ) -> CommandResult:
        """Spawn an actor in the scene."""
        params = {
            "actor_class": actor_class,
            "location": location
        }
        if rotation:
            params["rotation"] = rotation
        if scale:
            params["scale"] = scale
        if name:
            params["actor_name"] = name
            
        return await self.execute(
            user_id=user_id,
            tool_name="spawn_actor",
            parameters=params,
            category=CommandCategory.ACTOR
        )
    
    async def delete_actor(
        self,
        user_id: int,
        actor_name: str
    ) -> CommandResult:
        """Delete an actor from the scene."""
        return await self.execute(
            user_id=user_id,
            tool_name="delete_actor",
            parameters={"actor_name": actor_name},
            category=CommandCategory.ACTOR
        )
    
    async def set_actor_transform(
        self,
        user_id: int,
        actor_name: str,
        location: Optional[Dict[str, float]] = None,
        rotation: Optional[Dict[str, float]] = None,
        scale: Optional[Dict[str, float]] = None
    ) -> CommandResult:
        """Set an actor's transform."""
        params = {"actor_name": actor_name}
        if location:
            params["location"] = location
        if rotation:
            params["rotation"] = rotation
        if scale:
            params["scale"] = scale
            
        return await self.execute(
            user_id=user_id,
            tool_name="set_actor_transform",
            parameters=params,
            category=CommandCategory.ACTOR
        )
    
    async def get_selected_actors(
        self,
        user_id: int
    ) -> CommandResult:
        """Get currently selected actors in the editor."""
        return await self.execute(
            user_id=user_id,
            tool_name="get_selected_actors",
            parameters={},
            category=CommandCategory.ACTOR
        )
    
    async def select_actor(
        self,
        user_id: int,
        actor_name: str,
        add_to_selection: bool = False
    ) -> CommandResult:
        """Select an actor in the editor."""
        return await self.execute(
            user_id=user_id,
            tool_name="select_actor",
            parameters={
                "actor_name": actor_name,
                "add_to_selection": add_to_selection
            },
            category=CommandCategory.ACTOR
        )
    
    # ==================== SCENE COMMANDS ====================
    
    async def save_level(self, user_id: int) -> CommandResult:
        """Save the current level."""
        return await self.execute(
            user_id=user_id,
            tool_name="save_current_level",
            parameters={},
            category=CommandCategory.SCENE
        )
    
    async def play_in_editor(self, user_id: int) -> CommandResult:
        """Start Play in Editor (PIE)."""
        return await self.execute(
            user_id=user_id,
            tool_name="play_in_editor",
            parameters={},
            category=CommandCategory.SCENE
        )
    
    async def stop_play(self, user_id: int) -> CommandResult:
        """Stop Play in Editor."""
        return await self.execute(
            user_id=user_id,
            tool_name="stop_play_in_editor",
            parameters={},
            category=CommandCategory.SCENE
        )
    
    async def take_screenshot(
        self,
        user_id: int,
        filename: Optional[str] = None,
        resolution: Optional[Dict[str, int]] = None
    ) -> CommandResult:
        """Take a viewport screenshot."""
        params = {}
        if filename:
            params["filename"] = filename
        if resolution:
            params["resolution_x"] = resolution.get("width", 1920)
            params["resolution_y"] = resolution.get("height", 1080)
            
        return await self.execute(
            user_id=user_id,
            tool_name="take_screenshot",
            parameters=params,
            category=CommandCategory.VIEWPORT
        )
    
    async def undo(self, user_id: int) -> CommandResult:
        """Undo the last action."""
        return await self.execute(
            user_id=user_id,
            tool_name="undo",
            parameters={},
            category=CommandCategory.SCENE
        )
    
    async def redo(self, user_id: int) -> CommandResult:
        """Redo the last undone action."""
        return await self.execute(
            user_id=user_id,
            tool_name="redo",
            parameters={},
            category=CommandCategory.SCENE
        )


# Global instance
ue5_command_service = UE5CommandService()


def get_ue5_command_service() -> UE5CommandService:
    """Get the global UE5 command service instance."""
    return ue5_command_service
