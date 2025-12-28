"""
UE5 AI Studio - Workspace AI Integration Service
=================================================

Service for AI-powered file operations in the workspace.
Allows AI agents to create, read, and modify files.

Version: 2.0.0
"""

import json
import re
import logging
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from services.workspace import WorkspaceService
from models.workspace import FileType

logger = logging.getLogger(__name__)


class WorkspaceAIService:
    """
    Service for AI-powered workspace operations.
    
    This service provides methods for AI agents to interact with
    the file workspace, including creating, reading, and modifying files.
    """
    
    # File operation patterns for parsing AI responses
    FILE_CREATE_PATTERN = re.compile(
        r'```(?:create|new)\s+(\S+)\n(.*?)```',
        re.DOTALL | re.IGNORECASE
    )
    
    FILE_EDIT_PATTERN = re.compile(
        r'```(?:edit|modify|update)\s+(\S+)\n(.*?)```',
        re.DOTALL | re.IGNORECASE
    )
    
    FILE_READ_PATTERN = re.compile(
        r'```read\s+(\S+)```',
        re.IGNORECASE
    )
    
    CODE_BLOCK_PATTERN = re.compile(
        r'```(\w+)?\n(.*?)```',
        re.DOTALL
    )
    
    def __init__(self, db: AsyncSession, user_id: int, project_id: Optional[int] = None):
        """
        Initialize the workspace AI service.
        
        Args:
            db: Database session
            user_id: ID of the user
            project_id: Optional project ID for scoping files
        """
        self.db = db
        self.user_id = user_id
        self.project_id = project_id
        self.workspace = WorkspaceService(db)
    
    async def get_workspace_context(self, max_files: int = 20) -> str:
        """
        Get workspace context for AI prompts.
        
        Returns a summary of the workspace structure for AI context.
        
        Args:
            max_files: Maximum number of files to include
            
        Returns:
            Formatted string describing the workspace
        """
        try:
            # Get workspace stats
            stats = await self.workspace.get_workspace_stats(
                self.user_id, self.project_id
            )
            
            # Get file tree
            files = await self.workspace.list_files(
                user_id=self.user_id,
                parent_path="/",
                project_id=self.project_id,
                include_children=True
            )
            
            # Build context string
            context_lines = [
                "## Workspace Overview",
                f"- Files: {stats['file_count']}",
                f"- Folders: {stats['folder_count']}",
                f"- Total Size: {stats['total_size']} bytes",
                f"- AI Generated: {stats['generated_count']}",
                "",
                "## File Structure",
            ]
            
            # Add file tree (limited)
            for i, file in enumerate(files[:max_files]):
                indent = "  " * (file.path.count("/") - 1)
                icon = "📁" if file.file_type == FileType.FOLDER else "📄"
                context_lines.append(f"{indent}{icon} {file.name}")
            
            if len(files) > max_files:
                context_lines.append(f"  ... and {len(files) - max_files} more files")
            
            return "\n".join(context_lines)
            
        except Exception as e:
            logger.error(f"Failed to get workspace context: {e}")
            return "## Workspace\nUnable to load workspace information."
    
    async def get_file_content(self, path: str) -> Optional[str]:
        """
        Get file content by path.
        
        Args:
            path: File path
            
        Returns:
            File content or None if not found
        """
        try:
            file = await self.workspace.get_file_by_path(
                self.user_id, path, self.project_id
            )
            if file and file.file_type == FileType.FILE:
                return file.content
            return None
        except Exception as e:
            logger.error(f"Failed to get file content: {e}")
            return None
    
    async def create_file_from_ai(
        self,
        path: str,
        content: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a file from AI-generated content.
        
        Args:
            path: File path
            content: File content
            description: Optional description of the file
            
        Returns:
            Result dict with success status and file info
        """
        try:
            # Ensure path starts with /
            if not path.startswith("/"):
                path = "/" + path
            
            # Create the file
            file = await self.workspace.create_file(
                user_id=self.user_id,
                path=path,
                content=content,
                project_id=self.project_id,
                is_generated=True
            )
            
            return {
                "success": True,
                "action": "created",
                "file": {
                    "id": file.id,
                    "name": file.name,
                    "path": file.path,
                    "size": file.size,
                    "language": file.language,
                }
            }
            
        except ValueError as e:
            return {
                "success": False,
                "action": "create_failed",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Failed to create file from AI: {e}")
            return {
                "success": False,
                "action": "create_failed",
                "error": "Internal error"
            }
    
    async def update_file_from_ai(
        self,
        path: str,
        content: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update a file from AI-generated content.
        
        Args:
            path: File path
            content: New file content
            description: Optional description of the change
            
        Returns:
            Result dict with success status and file info
        """
        try:
            # Ensure path starts with /
            if not path.startswith("/"):
                path = "/" + path
            
            # Find the file
            file = await self.workspace.get_file_by_path(
                self.user_id, path, self.project_id
            )
            
            if not file:
                # File doesn't exist, create it
                return await self.create_file_from_ai(path, content, description)
            
            # Update the file
            updated = await self.workspace.update_file(
                user_id=self.user_id,
                file_id=file.id,
                content=content,
                project_id=self.project_id,
                changed_by="ai",
                change_description=description
            )
            
            return {
                "success": True,
                "action": "updated",
                "file": {
                    "id": updated.id,
                    "name": updated.name,
                    "path": updated.path,
                    "size": updated.size,
                    "version": updated.version,
                }
            }
            
        except ValueError as e:
            return {
                "success": False,
                "action": "update_failed",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Failed to update file from AI: {e}")
            return {
                "success": False,
                "action": "update_failed",
                "error": "Internal error"
            }
    
    def parse_file_operations(self, ai_response: str) -> List[Dict[str, Any]]:
        """
        Parse AI response for file operations.
        
        Looks for special code blocks that indicate file operations:
        - ```create /path/to/file.cpp
        - ```edit /path/to/file.cpp
        - ```read /path/to/file.cpp
        
        Args:
            ai_response: The AI's response text
            
        Returns:
            List of file operations to execute
        """
        operations = []
        
        # Find create operations
        for match in self.FILE_CREATE_PATTERN.finditer(ai_response):
            path = match.group(1).strip()
            content = match.group(2).strip()
            operations.append({
                "type": "create",
                "path": path,
                "content": content
            })
        
        # Find edit operations
        for match in self.FILE_EDIT_PATTERN.finditer(ai_response):
            path = match.group(1).strip()
            content = match.group(2).strip()
            operations.append({
                "type": "edit",
                "path": path,
                "content": content
            })
        
        # Find read operations
        for match in self.FILE_READ_PATTERN.finditer(ai_response):
            path = match.group(1).strip()
            operations.append({
                "type": "read",
                "path": path
            })
        
        return operations
    
    async def execute_file_operations(
        self,
        operations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Execute a list of file operations.
        
        Args:
            operations: List of operations from parse_file_operations
            
        Returns:
            List of results for each operation
        """
        results = []
        
        for op in operations:
            op_type = op.get("type")
            path = op.get("path", "")
            
            if op_type == "create":
                result = await self.create_file_from_ai(
                    path=path,
                    content=op.get("content", "")
                )
            elif op_type == "edit":
                result = await self.update_file_from_ai(
                    path=path,
                    content=op.get("content", "")
                )
            elif op_type == "read":
                content = await self.get_file_content(path)
                result = {
                    "success": content is not None,
                    "action": "read",
                    "path": path,
                    "content": content
                }
            else:
                result = {
                    "success": False,
                    "action": "unknown",
                    "error": f"Unknown operation type: {op_type}"
                }
            
            results.append(result)
        
        return results
    
    async def process_ai_response(
        self,
        ai_response: str,
        auto_execute: bool = True
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Process an AI response and optionally execute file operations.
        
        Args:
            ai_response: The AI's response text
            auto_execute: Whether to automatically execute file operations
            
        Returns:
            Tuple of (cleaned response, operation results)
        """
        # Parse operations
        operations = self.parse_file_operations(ai_response)
        
        if not operations:
            return ai_response, []
        
        # Execute if requested
        results = []
        if auto_execute:
            results = await self.execute_file_operations(operations)
        
        return ai_response, results
    
    def get_ai_instructions(self) -> str:
        """
        Get instructions for AI about file operations.
        
        Returns:
            Instructions string to include in system prompt
        """
        return """
## File Operations

You can create and edit files in the user's workspace using special code blocks:

### Creating a new file:
```create /path/to/filename.ext
file content here
```

### Editing an existing file:
```edit /path/to/filename.ext
new file content here
```

### Reading a file:
```read /path/to/filename.ext```

When creating UE5 code files:
- Use proper UE5 naming conventions (A prefix for Actors, U for Objects, F for structs)
- Include necessary headers and GENERATED_BODY() macros
- Follow Epic's coding standards

Always explain what changes you're making and why.
"""
    
    async def search_relevant_files(
        self,
        query: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for files relevant to a query.
        
        Args:
            query: Search query
            limit: Maximum results
            
        Returns:
            List of relevant files with content previews
        """
        try:
            files = await self.workspace.search_files(
                user_id=self.user_id,
                query=query,
                project_id=self.project_id,
                limit=limit
            )
            
            results = []
            for file in files:
                preview = ""
                if file.content:
                    # Get relevant snippet
                    query_lower = query.lower()
                    content_lower = file.content.lower()
                    idx = content_lower.find(query_lower)
                    if idx >= 0:
                        start = max(0, idx - 50)
                        end = min(len(file.content), idx + len(query) + 50)
                        preview = f"...{file.content[start:end]}..."
                    else:
                        preview = file.content[:100] + "..." if len(file.content) > 100 else file.content
                
                results.append({
                    "path": file.path,
                    "name": file.name,
                    "language": file.language,
                    "preview": preview
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to search files: {e}")
            return []
