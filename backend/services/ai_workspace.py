"""
UE5 AI Studio - AI Workspace Service
=====================================

AI-powered workspace features with full file context awareness.
The LLM can read all files in the workspace and write to them.

Version: 1.0.0
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.workspace import WorkspaceFile
from services.ai import AIService
from api.api_keys import get_api_key
import os

# =============================================================================
# AI WORKSPACE SERVICE
# =============================================================================

class AIWorkspaceService:
    """
    AI service with full workspace context awareness.
    Can read all files and write to them.
    """
    
    def __init__(self, db: Session, user_id: int, project_id: Optional[int] = None):
        self.db = db
        self.user_id = user_id
        self.project_id = project_id
        self.ai_service = AIService()
    
    # =========================================================================
    # CONTEXT GATHERING
    # =========================================================================
    
    def get_workspace_context(self, max_files: int = 50, max_size_per_file: int = 10000) -> str:
        """
        Get full workspace context for AI.
        Reads all files (up to limits) and returns as formatted string.
        """
        query = self.db.query(WorkspaceFile).filter(
            WorkspaceFile.user_id == self.user_id,
            WorkspaceFile.file_type == 'file'
        )
        
        if self.project_id:
            query = query.filter(WorkspaceFile.project_id == self.project_id)
        
        files = query.order_by(WorkspaceFile.updated_at.desc()).limit(max_files).all()
        
        context_parts = []
        context_parts.append("=== WORKSPACE CONTEXT ===\n")
        context_parts.append(f"Total files in workspace: {len(files)}\n\n")
        
        for file in files:
            context_parts.append(f"--- File: {file.path} ---\n")
            context_parts.append(f"Language: {file.language or 'unknown'}\n")
            context_parts.append(f"Size: {file.size} bytes\n")
            
            if file.content and len(file.content) <= max_size_per_file:
                context_parts.append(f"Content:\n{file.content}\n")
            elif file.content:
                context_parts.append(f"Content (truncated to {max_size_per_file} chars):\n")
                context_parts.append(f"{file.content[:max_size_per_file]}...\n")
            else:
                context_parts.append("Content: (empty)\n")
            
            context_parts.append("\n")
        
        return "".join(context_parts)
    
    def get_file_context(self, file_id: int) -> Dict[str, Any]:
        """Get context for a specific file."""
        file = self.db.query(WorkspaceFile).filter(
            WorkspaceFile.id == file_id,
            WorkspaceFile.user_id == self.user_id
        ).first()
        
        if not file:
            raise ValueError(f"File {file_id} not found")
        
        return {
            "id": file.id,
            "name": file.name,
            "path": file.path,
            "language": file.language,
            "content": file.content or "",
            "size": file.size,
            "is_generated": file.is_generated
        }
    
    def get_related_files(self, file_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get related files (same directory, similar names, etc.)
        for better context.
        """
        file = self.db.query(WorkspaceFile).filter(
            WorkspaceFile.id == file_id,
            WorkspaceFile.user_id == self.user_id
        ).first()
        
        if not file:
            return []
        
        # Get files in same directory
        directory = os.path.dirname(file.path)
        
        related = self.db.query(WorkspaceFile).filter(
            WorkspaceFile.user_id == self.user_id,
            WorkspaceFile.path.like(f"{directory}%"),
            WorkspaceFile.id != file_id,
            WorkspaceFile.file_type == 'file'
        ).limit(limit).all()
        
        return [
            {
                "id": f.id,
                "name": f.name,
                "path": f.path,
                "language": f.language,
                "content": f.content or "",
                "size": f.size
            }
            for f in related
        ]
    
    # =========================================================================
    # AI CODE EXPLANATION
    # =========================================================================
    
    async def explain_code(
        self,
        code: str,
        file_context: Optional[Dict[str, Any]] = None,
        model: str = "deepseek-chat",
        action: str = "explain"
    ) -> Dict[str, Any]:
        """
        Explain code using AI with full workspace context.
        
        Actions:
        - explain: Explain what the code does
        - document: Generate documentation/comments
        - improve: Suggest improvements
        - convert_ue5: Convert to UE5-specific patterns
        - find_bugs: Find potential bugs
        """
        # Build prompt with context
        prompt_parts = []
        
        # Add workspace context if available
        if file_context:
            prompt_parts.append(f"File: {file_context['path']}")
            prompt_parts.append(f"Language: {file_context['language']}")
            prompt_parts.append("")
        
        # Add action-specific instructions
        if action == "explain":
            prompt_parts.append("Explain the following code in detail. What does it do? How does it work?")
        elif action == "document":
            prompt_parts.append("Generate comprehensive documentation/comments for the following code. Include function descriptions, parameter explanations, and return value documentation.")
        elif action == "improve":
            prompt_parts.append("Analyze the following code and suggest improvements. Focus on performance, readability, best practices, and potential bugs.")
        elif action == "convert_ue5":
            prompt_parts.append("Convert the following code to use Unreal Engine 5 specific patterns and best practices. Use UE5 macros, classes, and conventions.")
        elif action == "find_bugs":
            prompt_parts.append("Analyze the following code for potential bugs, errors, or issues. Be specific about what could go wrong and how to fix it.")
        
        prompt_parts.append("")
        prompt_parts.append("```")
        prompt_parts.append(code)
        prompt_parts.append("```")
        
        prompt = "\n".join(prompt_parts)
        
        # Get AI response
        response = await self.ai_service.chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=0.3,  # Lower temperature for more focused responses
            max_tokens=2000
        )
        
        return {
            "action": action,
            "model": model,
            "explanation": response["content"],
            "code": code
        }
    
    # =========================================================================
    # AI CODE SUGGESTIONS (Inline Assistant)
    # =========================================================================
    
    async def get_code_suggestions(
        self,
        file_id: int,
        cursor_position: Dict[str, int],  # {"line": 10, "column": 5}
        context_before: str,
        context_after: str,
        model: str = "deepseek-chat",
        num_suggestions: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Get AI code suggestions for inline assistant (Copilot-style).
        """
        # Get file context
        file_ctx = self.get_file_context(file_id)
        
        # Get related files for better context
        related = self.get_related_files(file_id, limit=5)
        
        # Build prompt
        prompt_parts = []
        prompt_parts.append(f"You are an AI coding assistant for Unreal Engine 5 development.")
        prompt_parts.append(f"File: {file_ctx['path']}")
        prompt_parts.append(f"Language: {file_ctx['language']}")
        prompt_parts.append("")
        prompt_parts.append("Context before cursor:")
        prompt_parts.append("```")
        prompt_parts.append(context_before)
        prompt_parts.append("```")
        prompt_parts.append("")
        prompt_parts.append("Context after cursor:")
        prompt_parts.append("```")
        prompt_parts.append(context_after)
        prompt_parts.append("```")
        prompt_parts.append("")
        prompt_parts.append(f"Provide {num_suggestions} code suggestions for what should come next at the cursor position.")
        prompt_parts.append("Format each suggestion as a complete, syntactically correct code snippet.")
        prompt_parts.append("Focus on UE5 best practices and patterns.")
        
        prompt = "\n".join(prompt_parts)
        
        # Get AI response
        response = await self.ai_service.chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=0.5,
            max_tokens=1000
        )
        
        # Parse suggestions from response
        # For now, return as single suggestion (can be enhanced to parse multiple)
        suggestions = [
            {
                "code": response["content"],
                "confidence": 0.9,
                "description": "AI-generated suggestion"
            }
        ]
        
        return suggestions
    
    # =========================================================================
    # AI FILE GENERATION
    # =========================================================================
    
    async def generate_file(
        self,
        description: str,
        file_type: str,  # "cpp_class", "header", "blueprint", "python", etc.
        class_name: Optional[str] = None,
        parent_class: Optional[str] = None,
        model: str = "deepseek-chat",
        include_workspace_context: bool = True
    ) -> Dict[str, Any]:
        """
        Generate entire file from natural language description.
        """
        # Build prompt
        prompt_parts = []
        prompt_parts.append("You are an expert Unreal Engine 5 developer.")
        prompt_parts.append("")
        
        # Add workspace context if requested
        if include_workspace_context:
            context = self.get_workspace_context(max_files=10, max_size_per_file=5000)
            prompt_parts.append("Current workspace context:")
            prompt_parts.append(context)
            prompt_parts.append("")
        
        prompt_parts.append(f"Generate a {file_type} file based on this description:")
        prompt_parts.append(f'"{description}"')
        prompt_parts.append("")
        
        if class_name:
            prompt_parts.append(f"Class name: {class_name}")
        if parent_class:
            prompt_parts.append(f"Parent class: {parent_class}")
        
        prompt_parts.append("")
        prompt_parts.append("Requirements:")
        prompt_parts.append("- Follow UE5 coding standards and best practices")
        prompt_parts.append("- Include all necessary includes and forward declarations")
        prompt_parts.append("- Add comprehensive comments")
        prompt_parts.append("- Use UCLASS, UPROPERTY, UFUNCTION macros where appropriate")
        prompt_parts.append("- Make it production-ready")
        prompt_parts.append("")
        prompt_parts.append("Generate the complete file content:")
        
        prompt = "\n".join(prompt_parts)
        
        # Get AI response
        response = await self.ai_service.chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=0.4,
            max_tokens=4000
        )
        
        return {
            "file_type": file_type,
            "class_name": class_name,
            "parent_class": parent_class,
            "content": response["content"],
            "model": model,
            "description": description
        }
    
    # =========================================================================
    # FILE WRITE OPERATIONS
    # =========================================================================
    
    def write_to_file(self, file_id: int, content: str) -> WorkspaceFile:
        """
        Write AI-generated content to a file.
        """
        file = self.db.query(WorkspaceFile).filter(
            WorkspaceFile.id == file_id,
            WorkspaceFile.user_id == self.user_id
        ).first()
        
        if not file:
            raise ValueError(f"File {file_id} not found")
        
        if file.is_readonly:
            raise ValueError(f"File {file.path} is read-only")
        
        # Update file content
        file.content = content
        file.size = len(content.encode('utf-8'))
        file.version += 1
        file.is_generated = True  # Mark as AI-generated
        
        self.db.commit()
        self.db.refresh(file)
        
        return file
    
    def create_file_from_ai(
        self,
        path: str,
        content: str,
        language: Optional[str] = None,
        mime_type: Optional[str] = None
    ) -> WorkspaceFile:
        """
        Create a new file from AI-generated content.
        """
        # Check if file already exists
        existing = self.db.query(WorkspaceFile).filter(
            WorkspaceFile.user_id == self.user_id,
            WorkspaceFile.path == path
        ).first()
        
        if existing:
            raise ValueError(f"File {path} already exists")
        
        # Create new file
        file = WorkspaceFile(
            user_id=self.user_id,
            project_id=self.project_id,
            name=os.path.basename(path),
            path=path,
            file_type='file',
            content=content,
            size=len(content.encode('utf-8')),
            language=language,
            mime_type=mime_type,
            is_generated=True,  # Mark as AI-generated
            version=1
        )
        
        self.db.add(file)
        self.db.commit()
        self.db.refresh(file)
        
        return file
