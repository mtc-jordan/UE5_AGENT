"""
UE5 AI Studio - AI Workspace API Endpoints
===========================================

API endpoints for AI-powered workspace features.

Version: 1.0.0
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from core.database import get_db
from services.auth import get_current_user
from services.ai_workspace import AIWorkspaceService
from models.user import User

router = APIRouter(prefix="/api/ai-workspace", tags=["AI Workspace"])

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ExplainCodeRequest(BaseModel):
    code: str
    file_id: Optional[int] = None
    model: str = "deepseek-chat"
    action: str = "explain"  # explain, document, improve, convert_ue5, find_bugs

class CodeSuggestionRequest(BaseModel):
    file_id: int
    cursor_position: Dict[str, int]  # {"line": 10, "column": 5}
    context_before: str
    context_after: str
    model: str = "deepseek-chat"
    num_suggestions: int = 3

class GenerateFileRequest(BaseModel):
    description: str
    file_type: str  # cpp_class, header, blueprint, python, etc.
    class_name: Optional[str] = None
    parent_class: Optional[str] = None
    model: str = "deepseek-chat"
    include_workspace_context: bool = True
    save_to_workspace: bool = False
    file_path: Optional[str] = None

class WriteFileRequest(BaseModel):
    file_id: int
    content: str

# =============================================================================
# AI CODE EXPLANATION ENDPOINTS
# =============================================================================

@router.post("/explain")
async def explain_code(
    request: ExplainCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Explain code using AI with full workspace context.
    
    Actions:
    - explain: Explain what the code does
    - document: Generate documentation/comments
    - improve: Suggest improvements
    - convert_ue5: Convert to UE5-specific patterns
    - find_bugs: Find potential bugs
    """
    try:
        service = AIWorkspaceService(db, current_user.id)
        
        # Get file context if file_id provided
        file_context = None
        if request.file_id:
            file_context = service.get_file_context(request.file_id)
        
        result = await service.explain_code(
            code=request.code,
            file_context=file_context,
            model=request.model,
            action=request.action
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# AI CODE SUGGESTIONS (Inline Assistant)
# =============================================================================

@router.post("/suggest")
async def get_code_suggestions(
    request: CodeSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get AI code suggestions for inline assistant (Copilot-style).
    """
    try:
        service = AIWorkspaceService(db, current_user.id)
        
        suggestions = await service.get_code_suggestions(
            file_id=request.file_id,
            cursor_position=request.cursor_position,
            context_before=request.context_before,
            context_after=request.context_after,
            model=request.model,
            num_suggestions=request.num_suggestions
        )
        
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# AI FILE GENERATION
# =============================================================================

@router.post("/generate-file")
async def generate_file(
    request: GenerateFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate entire file from natural language description.
    """
    try:
        service = AIWorkspaceService(db, current_user.id)
        
        result = await service.generate_file(
            description=request.description,
            file_type=request.file_type,
            class_name=request.class_name,
            parent_class=request.parent_class,
            model=request.model,
            include_workspace_context=request.include_workspace_context
        )
        
        # Optionally save to workspace
        if request.save_to_workspace and request.file_path:
            # Determine language from file type
            language_map = {
                "cpp_class": "cpp",
                "header": "cpp",
                "python": "python",
                "blueprint": "blueprint"
            }
            language = language_map.get(request.file_type, "text")
            
            file = service.create_file_from_ai(
                path=request.file_path,
                content=result["content"],
                language=language
            )
            
            result["file_id"] = file.id
            result["saved"] = True
        else:
            result["saved"] = False
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# FILE WRITE OPERATIONS
# =============================================================================

@router.post("/write-file")
async def write_file(
    request: WriteFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Write AI-generated content to a file.
    """
    try:
        service = AIWorkspaceService(db, current_user.id)
        
        file = service.write_to_file(
            file_id=request.file_id,
            content=request.content
        )
        
        return {
            "success": True,
            "file_id": file.id,
            "path": file.path,
            "size": file.size,
            "version": file.version
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# WORKSPACE CONTEXT
# =============================================================================

@router.get("/context")
async def get_workspace_context(
    max_files: int = 50,
    max_size_per_file: int = 10000,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get full workspace context for AI.
    Returns all files with their content.
    """
    try:
        service = AIWorkspaceService(db, current_user.id)
        context = service.get_workspace_context(max_files, max_size_per_file)
        
        return {"context": context}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/file-context/{file_id}")
async def get_file_context(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get context for a specific file.
    """
    try:
        service = AIWorkspaceService(db, current_user.id)
        context = service.get_file_context(file_id)
        
        return context
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/related-files/{file_id}")
async def get_related_files(
    file_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get related files for better context.
    """
    try:
        service = AIWorkspaceService(db, current_user.id)
        related = service.get_related_files(file_id, limit)
        
        return {"related_files": related}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
