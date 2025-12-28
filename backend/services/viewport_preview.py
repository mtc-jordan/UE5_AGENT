"""
Viewport Preview Service
Handles screenshot capture, storage, and retrieval for real-time UE5 viewport preview.
Supports auto-capture after tool execution and before/after comparison.
"""

import os
import re
import uuid
import base64
import asyncio
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ViewportScreenshot:
    """Represents a captured viewport screenshot"""
    id: str
    user_id: int
    filename: str
    timestamp: datetime
    width: int
    height: int
    file_path: str
    thumbnail_path: Optional[str] = None
    base64_data: Optional[str] = None
    context: Optional[str] = None  # What action triggered this screenshot
    tool_name: Optional[str] = None  # Tool that was executed before capture
    is_before: bool = False  # True if this is a "before" screenshot
    paired_screenshot_id: Optional[str] = None  # ID of the paired before/after screenshot


@dataclass
class BeforeAfterPair:
    """Represents a before/after screenshot comparison"""
    id: str
    before: ViewportScreenshot
    after: ViewportScreenshot
    tool_name: str
    tool_params: Dict[str, Any]
    created_at: datetime


class ViewportPreviewService:
    """
    Service for managing viewport screenshots and previews.
    
    Features:
    - Auto-capture screenshots after tool execution
    - Before/after comparison for transformations
    - Thumbnail generation
    - Screenshot storage and retrieval
    """
    
    def __init__(self, storage_path: str = "/home/ubuntu/UE5_AGENT/screenshots"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # In-memory storage for screenshots (in production, use database)
        self.screenshots: Dict[str, ViewportScreenshot] = {}
        self.user_screenshots: Dict[int, List[str]] = {}  # user_id -> list of screenshot ids
        self.before_after_pairs: Dict[str, BeforeAfterPair] = {}
        
        # Pending "before" screenshots waiting for "after"
        self.pending_before: Dict[int, ViewportScreenshot] = {}  # user_id -> before screenshot
        
        # Tools that should trigger before/after comparison
        self.transform_tools = {
            'set_actor_property',
            'set_actor_location',
            'set_actor_rotation',
            'set_actor_scale',
            'move_actor',
            'rotate_actor',
            'scale_actor',
            'spawn_actor',
            'delete_actor',
            'duplicate_actor',
            'set_material',
            'set_static_mesh',
            'set_visibility',
            'set_physics_enabled',
        }
    
    def should_capture_before_after(self, tool_name: str) -> bool:
        """Check if a tool should trigger before/after comparison"""
        return tool_name in self.transform_tools
    
    async def capture_screenshot(
        self,
        user_id: int,
        agent_relay_service,
        context: Optional[str] = None,
        tool_name: Optional[str] = None,
        is_before: bool = False,
        resolution_x: int = 1280,
        resolution_y: int = 720
    ) -> Optional[ViewportScreenshot]:
        """
        Capture a screenshot from the UE5 viewport via the agent.
        
        The UE5 take_screenshot tool is asynchronous - it requests a screenshot
        and returns immediately. We need to wait for the file to be written
        and then read it.
        
        Args:
            user_id: The user ID to capture for
            agent_relay_service: The agent relay service for tool execution
            context: Description of what triggered this capture
            tool_name: Name of the tool being executed (for before/after)
            is_before: Whether this is a "before" screenshot
            resolution_x: Screenshot width
            resolution_y: Screenshot height
            
        Returns:
            ViewportScreenshot object or None if capture failed
        """
        try:
            # Generate unique filename
            screenshot_id = str(uuid.uuid4())[:8]
            timestamp = datetime.now()
            filename = f"viewport_{user_id}_{screenshot_id}_{timestamp.strftime('%Y%m%d_%H%M%S')}"
            
            # Execute take_screenshot tool
            # Note: This tool is async in UE5 - it requests a screenshot and returns immediately
            result = await agent_relay_service.execute_tool(
                user_id,
                'take_screenshot',
                {
                    'filename': filename,
                    'resolution_x': resolution_x,
                    'resolution_y': resolution_y
                }
            )
            
            if not result:
                print(f"Screenshot capture returned no result")
                return None
            
            # Parse the result to get the file path and/or base64 data
            screenshot_data = self._parse_screenshot_result(result)
            file_path = screenshot_data.get('file_path', '')
            base64_data = screenshot_data.get('base64_data')
            
            print(f"Screenshot result type: {type(result)}")
            print(f"Parsed file path: {file_path}")
            print(f"Has base64 data: {bool(base64_data)}")
            
            # If we already have base64 data from the agent, use it directly
            # The updated agent reads the file locally and returns base64
            if not base64_data:
                print("No base64 data in result, attempting to read from file...")
                # Wait for the screenshot file to be written (async operation in UE5)
                # Note: This only works if the backend can access the same filesystem
                base64_data = await self._wait_and_read_screenshot(file_path, max_wait=5.0)
            
            if not base64_data:
                print(f"Warning: No screenshot data available. File: {file_path}")
                # Return a placeholder or error indicator
                base64_data = None
            
            # Create screenshot object
            screenshot = ViewportScreenshot(
                id=screenshot_id,
                user_id=user_id,
                filename=filename,
                timestamp=timestamp,
                width=resolution_x,
                height=resolution_y,
                file_path=file_path,
                base64_data=base64_data,
                context=context,
                tool_name=tool_name,
                is_before=is_before
            )
            
            # Store screenshot
            self.screenshots[screenshot_id] = screenshot
            if user_id not in self.user_screenshots:
                self.user_screenshots[user_id] = []
            self.user_screenshots[user_id].append(screenshot_id)
            
            # Keep only last 50 screenshots per user
            if len(self.user_screenshots[user_id]) > 50:
                old_id = self.user_screenshots[user_id].pop(0)
                if old_id in self.screenshots:
                    del self.screenshots[old_id]
            
            return screenshot
            
        except Exception as e:
            print(f"Error capturing screenshot: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def _wait_and_read_screenshot(self, file_path: str, max_wait: float = 5.0) -> Optional[str]:
        """
        Wait for the screenshot file to be written and read it as base64.
        
        UE5's FScreenshotRequest::RequestScreenshot is async, so we need to poll
        for the file to appear and be fully written.
        
        Args:
            file_path: Path to the screenshot file (from UE5)
            max_wait: Maximum time to wait in seconds
            
        Returns:
            Base64 encoded image data or None if failed
        """
        if not file_path:
            return None
        
        # Extract just the filename if it's a full message
        # e.g., "Screenshot requested: C:/Project/Saved/Screenshots/file.png"
        if "Screenshot requested:" in file_path:
            match = re.search(r'Screenshot requested:\s*(.+?)(?:\s*$)', file_path)
            if match:
                file_path = match.group(1).strip()
        
        # Normalize path
        file_path = file_path.replace('\\', '/')
        
        # If the path doesn't end with .png, add it
        if not file_path.lower().endswith('.png'):
            file_path = file_path + '.png'
        
        print(f"Waiting for screenshot file: {file_path}")
        
        # Poll for file existence and size stability
        start_time = asyncio.get_event_loop().time()
        last_size = -1
        stable_count = 0
        
        while (asyncio.get_event_loop().time() - start_time) < max_wait:
            try:
                if os.path.exists(file_path):
                    current_size = os.path.getsize(file_path)
                    
                    # Check if file size is stable (not still being written)
                    if current_size > 0 and current_size == last_size:
                        stable_count += 1
                        if stable_count >= 2:  # File size stable for 2 checks
                            # Read and encode the file
                            with open(file_path, 'rb') as f:
                                image_data = f.read()
                            
                            if len(image_data) > 0:
                                base64_data = base64.b64encode(image_data).decode('utf-8')
                                print(f"Successfully read screenshot: {len(image_data)} bytes")
                                return base64_data
                    else:
                        stable_count = 0
                    
                    last_size = current_size
                
            except Exception as e:
                print(f"Error checking file: {e}")
            
            await asyncio.sleep(0.2)  # Check every 200ms
        
        print(f"Timeout waiting for screenshot file: {file_path}")
        return None
    
    def _parse_screenshot_result(self, result: Any) -> Dict[str, Any]:
        """Parse the screenshot tool result to extract file path or base64 data"""
        print(f"Parsing screenshot result: {type(result)} - {str(result)[:200]}")
        
        if isinstance(result, dict):
            # Check for base64 data first (preferred - from updated agent)
            if 'base64' in result and result['base64']:
                print(f"Found base64 data in result: {len(result['base64'])} chars")
                return {'base64_data': result['base64'], 'file_path': result.get('file_path', '')}
            if 'data' in result and result['data']:
                return {'base64_data': result['data'], 'file_path': result.get('file_path', '')}
            # Check for file path
            if 'file_path' in result:
                return {'file_path': result['file_path']}
            if 'path' in result:
                return {'file_path': result['path']}
            if 'content' in result:
                # MCP format with content array
                content = result['content']
                if isinstance(content, list) and len(content) > 0:
                    item = content[0]
                    if isinstance(item, dict):
                        if item.get('type') == 'image':
                            return {'base64_data': item.get('data', '')}
                        if item.get('type') == 'text':
                            # File path returned as text
                            return {'file_path': item.get('text', '')}
            # Check if there's a text message with the path
            if 'text' in result:
                return {'file_path': result['text']}
            if 'message' in result:
                return {'file_path': result['message']}
            # Return the whole result as string
            return {'file_path': str(result)}
        elif isinstance(result, str):
            # Assume it's a file path or message containing path
            return {'file_path': result}
        return {}
    
    async def capture_before(
        self,
        user_id: int,
        agent_relay_service,
        tool_name: str
    ) -> Optional[ViewportScreenshot]:
        """Capture a 'before' screenshot before tool execution"""
        screenshot = await self.capture_screenshot(
            user_id=user_id,
            agent_relay_service=agent_relay_service,
            context=f"Before {tool_name}",
            tool_name=tool_name,
            is_before=True,
            resolution_x=640,  # Smaller for thumbnails
            resolution_y=360
        )
        
        if screenshot:
            self.pending_before[user_id] = screenshot
        
        return screenshot
    
    async def capture_after(
        self,
        user_id: int,
        agent_relay_service,
        tool_name: str,
        tool_params: Dict[str, Any]
    ) -> Optional[BeforeAfterPair]:
        """Capture an 'after' screenshot and create a before/after pair"""
        # Get the pending before screenshot
        before_screenshot = self.pending_before.pop(user_id, None)
        
        # Capture after screenshot
        after_screenshot = await self.capture_screenshot(
            user_id=user_id,
            agent_relay_service=agent_relay_service,
            context=f"After {tool_name}",
            tool_name=tool_name,
            is_before=False,
            resolution_x=640,
            resolution_y=360
        )
        
        if not after_screenshot:
            return None
        
        # If we have both before and after, create a pair
        if before_screenshot:
            pair_id = str(uuid.uuid4())[:8]
            before_screenshot.paired_screenshot_id = after_screenshot.id
            after_screenshot.paired_screenshot_id = before_screenshot.id
            
            pair = BeforeAfterPair(
                id=pair_id,
                before=before_screenshot,
                after=after_screenshot,
                tool_name=tool_name,
                tool_params=tool_params,
                created_at=datetime.now()
            )
            
            self.before_after_pairs[pair_id] = pair
            return pair
        
        return None
    
    def get_screenshot(self, screenshot_id: str) -> Optional[ViewportScreenshot]:
        """Get a screenshot by ID"""
        return self.screenshots.get(screenshot_id)
    
    def get_user_screenshots(self, user_id: int, limit: int = 10) -> List[ViewportScreenshot]:
        """Get recent screenshots for a user"""
        screenshot_ids = self.user_screenshots.get(user_id, [])
        screenshots = []
        for sid in reversed(screenshot_ids[-limit:]):
            if sid in self.screenshots:
                screenshots.append(self.screenshots[sid])
        return screenshots
    
    def get_before_after_pair(self, pair_id: str) -> Optional[BeforeAfterPair]:
        """Get a before/after pair by ID"""
        return self.before_after_pairs.get(pair_id)
    
    def get_user_pairs(self, user_id: int, limit: int = 5) -> List[BeforeAfterPair]:
        """Get recent before/after pairs for a user"""
        pairs = []
        for pair in self.before_after_pairs.values():
            if pair.before.user_id == user_id:
                pairs.append(pair)
        # Sort by created_at descending
        pairs.sort(key=lambda p: p.created_at, reverse=True)
        return pairs[:limit]
    
    def to_dict(self, screenshot: ViewportScreenshot) -> Dict[str, Any]:
        """Convert screenshot to dictionary for API response"""
        return {
            'id': screenshot.id,
            'filename': screenshot.filename,
            'timestamp': screenshot.timestamp.isoformat(),
            'width': screenshot.width,
            'height': screenshot.height,
            'file_path': screenshot.file_path,
            'base64_data': screenshot.base64_data,
            'context': screenshot.context,
            'tool_name': screenshot.tool_name,
            'is_before': screenshot.is_before,
            'paired_screenshot_id': screenshot.paired_screenshot_id
        }
    
    def pair_to_dict(self, pair: BeforeAfterPair) -> Dict[str, Any]:
        """Convert before/after pair to dictionary for API response"""
        return {
            'id': pair.id,
            'before': self.to_dict(pair.before),
            'after': self.to_dict(pair.after),
            'tool_name': pair.tool_name,
            'tool_params': pair.tool_params,
            'created_at': pair.created_at.isoformat()
        }


# Global service instance
_viewport_preview_service: Optional[ViewportPreviewService] = None


def get_viewport_preview_service() -> ViewportPreviewService:
    """Get the global viewport preview service instance"""
    global _viewport_preview_service
    if _viewport_preview_service is None:
        _viewport_preview_service = ViewportPreviewService()
    return _viewport_preview_service
