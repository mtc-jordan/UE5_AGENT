"""
UE5 AI Studio - Workspace AI API Endpoints
==========================================

API endpoints for AI-powered workspace operations.

Version: 2.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from core.database import get_db
from services.auth import get_current_user
from services.workspace_ai import WorkspaceAIService
from models.user import User

router = APIRouter(prefix="/workspace/ai", tags=["Workspace AI"])


# =============================================================================
# SCHEMAS
# =============================================================================

class AIFileCreateRequest(BaseModel):
    """Request to create a file via AI."""
    path: str = Field(..., description="File path")
    content: str = Field(..., description="File content")
    description: Optional[str] = Field(None, description="Description of the file")
    project_id: Optional[int] = Field(None, description="Project ID")


class AIFileUpdateRequest(BaseModel):
    """Request to update a file via AI."""
    path: str = Field(..., description="File path")
    content: str = Field(..., description="New file content")
    description: Optional[str] = Field(None, description="Description of the change")
    project_id: Optional[int] = Field(None, description="Project ID")


class AIProcessRequest(BaseModel):
    """Request to process AI response for file operations."""
    response: str = Field(..., description="AI response text")
    auto_execute: bool = Field(True, description="Whether to auto-execute operations")
    project_id: Optional[int] = Field(None, description="Project ID")


class AISearchRequest(BaseModel):
    """Request to search files relevant to a query."""
    query: str = Field(..., description="Search query")
    limit: int = Field(5, ge=1, le=20, description="Maximum results")
    project_id: Optional[int] = Field(None, description="Project ID")


class FileOperationResult(BaseModel):
    """Result of a file operation."""
    success: bool
    action: str
    file: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    path: Optional[str] = None
    content: Optional[str] = None


class AIProcessResponse(BaseModel):
    """Response from processing AI output."""
    response: str
    operations: List[Dict[str, Any]]
    results: List[FileOperationResult]


class WorkspaceContextResponse(BaseModel):
    """Response containing workspace context."""
    context: str
    file_count: int
    folder_count: int


class AIInstructionsResponse(BaseModel):
    """Response containing AI instructions."""
    instructions: str


class SearchResultItem(BaseModel):
    """Search result item."""
    path: str
    name: str
    language: Optional[str]
    preview: str


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/context", response_model=WorkspaceContextResponse)
async def get_workspace_context(
    project_id: Optional[int] = None,
    max_files: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get workspace context for AI prompts.
    
    Returns a summary of the workspace structure that can be
    included in AI prompts for context.
    """
    service = WorkspaceAIService(db, current_user.id, project_id)
    
    context = await service.get_workspace_context(max_files)
    
    # Get stats for response
    from services.workspace import WorkspaceService
    workspace = WorkspaceService(db)
    stats = await workspace.get_workspace_stats(current_user.id, project_id)
    
    return WorkspaceContextResponse(
        context=context,
        file_count=stats["file_count"],
        folder_count=stats["folder_count"]
    )


@router.get("/instructions", response_model=AIInstructionsResponse)
async def get_ai_instructions(
    current_user: User = Depends(get_current_user)
):
    """
    Get instructions for AI about file operations.
    
    Returns instructions that can be included in the AI system
    prompt to enable file operations.
    """
    # Create a temporary service just to get instructions
    service = WorkspaceAIService(None, current_user.id)
    
    return AIInstructionsResponse(
        instructions=service.get_ai_instructions()
    )


@router.post("/create", response_model=FileOperationResult)
async def ai_create_file(
    request: AIFileCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a file from AI-generated content.
    
    This endpoint is used by AI agents to create new files
    in the user's workspace.
    """
    service = WorkspaceAIService(db, current_user.id, request.project_id)
    
    result = await service.create_file_from_ai(
        path=request.path,
        content=request.content,
        description=request.description
    )
    
    return FileOperationResult(**result)


@router.post("/update", response_model=FileOperationResult)
async def ai_update_file(
    request: AIFileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a file from AI-generated content.
    
    This endpoint is used by AI agents to update existing files
    in the user's workspace.
    """
    service = WorkspaceAIService(db, current_user.id, request.project_id)
    
    result = await service.update_file_from_ai(
        path=request.path,
        content=request.content,
        description=request.description
    )
    
    return FileOperationResult(**result)


@router.get("/file/{path:path}")
async def ai_get_file(
    path: str,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get file content for AI context.
    
    This endpoint is used by AI agents to read file contents
    for context or modification.
    """
    service = WorkspaceAIService(db, current_user.id, project_id)
    
    # Ensure path starts with /
    if not path.startswith("/"):
        path = "/" + path
    
    content = await service.get_file_content(path)
    
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    return {
        "path": path,
        "content": content
    }


@router.post("/process", response_model=AIProcessResponse)
async def process_ai_response(
    request: AIProcessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process an AI response for file operations.
    
    Parses the AI response for file operation commands and
    optionally executes them.
    """
    service = WorkspaceAIService(db, current_user.id, request.project_id)
    
    # Parse operations
    operations = service.parse_file_operations(request.response)
    
    # Execute if requested
    results = []
    if request.auto_execute and operations:
        raw_results = await service.execute_file_operations(operations)
        results = [FileOperationResult(**r) for r in raw_results]
    
    return AIProcessResponse(
        response=request.response,
        operations=operations,
        results=results
    )


@router.post("/search", response_model=List[SearchResultItem])
async def ai_search_files(
    request: AISearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search for files relevant to a query.
    
    This endpoint is used by AI agents to find relevant files
    for context or modification.
    """
    service = WorkspaceAIService(db, current_user.id, request.project_id)
    
    results = await service.search_relevant_files(
        query=request.query,
        limit=request.limit
    )
    
    return [SearchResultItem(**r) for r in results]


@router.post("/batch")
async def ai_batch_operations(
    operations: List[Dict[str, Any]],
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Execute multiple file operations in batch.
    
    Accepts a list of operations with type, path, and content.
    """
    service = WorkspaceAIService(db, current_user.id, project_id)
    
    results = await service.execute_file_operations(operations)
    
    return {
        "total": len(operations),
        "successful": sum(1 for r in results if r.get("success")),
        "failed": sum(1 for r in results if not r.get("success")),
        "results": results
    }
