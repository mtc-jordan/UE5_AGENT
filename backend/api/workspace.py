"""
UE5 AI Studio - Workspace API Endpoints
========================================

REST API endpoints for file workspace operations.

Version: 2.0.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
import io
import json

from core.database import get_db
from services.auth import get_current_user
from services.workspace import WorkspaceService
from models.user import User
from models.workspace import FileType, FileStatus

router = APIRouter(prefix="/workspace", tags=["Workspace"])


# =============================================================================
# SCHEMAS
# =============================================================================

class FileBase(BaseModel):
    """Base schema for file operations."""
    name: str = Field(..., min_length=1, max_length=255)
    

class FileCreate(BaseModel):
    """Schema for creating a file."""
    path: str = Field(..., description="Full path including filename")
    content: str = Field(default="", description="File content")
    project_id: Optional[int] = Field(None, description="Associated project ID")


class FolderCreate(BaseModel):
    """Schema for creating a folder."""
    path: str = Field(..., description="Full folder path")
    project_id: Optional[int] = Field(None, description="Associated project ID")


class FileUpdate(BaseModel):
    """Schema for updating file content."""
    content: str = Field(..., description="New file content")


class FileRename(BaseModel):
    """Schema for renaming a file."""
    new_name: str = Field(..., min_length=1, max_length=255)


class FileMove(BaseModel):
    """Schema for moving a file."""
    new_parent_path: str = Field(..., description="New parent folder path")


class FileCopy(BaseModel):
    """Schema for copying a file."""
    dest_path: str = Field(..., description="Destination path")


class FileResponse(BaseModel):
    """Response schema for file operations."""
    id: int
    name: str
    path: str
    file_type: str
    parent_id: Optional[int]
    content: Optional[str]
    mime_type: Optional[str]
    size: int
    language: Optional[str]
    is_readonly: bool
    is_generated: bool
    version: int
    project_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class FileTreeNode(BaseModel):
    """Schema for file tree node."""
    id: int
    name: str
    path: str
    file_type: str
    size: int
    language: Optional[str]
    is_generated: bool
    children: List["FileTreeNode"] = []
    
    class Config:
        from_attributes = True


class FileVersionResponse(BaseModel):
    """Response schema for file version."""
    id: int
    version_number: int
    size: int
    change_type: Optional[str]
    change_description: Optional[str]
    changed_by: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class WorkspaceStatsResponse(BaseModel):
    """Response schema for workspace statistics."""
    file_count: int
    folder_count: int
    total_size: int
    generated_count: int


class SearchResult(BaseModel):
    """Search result item."""
    id: int
    name: str
    path: str
    file_type: str
    language: Optional[str]
    match_preview: Optional[str]


# Enable forward reference
FileTreeNode.model_rebuild()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def file_to_response(file) -> FileResponse:
    """Convert WorkspaceFile to response schema."""
    return FileResponse(
        id=file.id,
        name=file.name,
        path=file.path,
        file_type=file.file_type.value,
        parent_id=file.parent_id,
        content=file.content if file.file_type == FileType.FILE else None,
        mime_type=file.mime_type,
        size=file.size,
        language=file.language,
        is_readonly=file.is_readonly,
        is_generated=file.is_generated,
        version=file.version,
        project_id=file.project_id,
        created_at=file.created_at,
        updated_at=file.updated_at
    )


def build_file_tree(files: list, parent_path: str = "/") -> List[FileTreeNode]:
    """Build hierarchical file tree from flat list."""
    tree = []
    path_to_node = {}
    
    # Sort by path depth
    sorted_files = sorted(files, key=lambda f: f.path.count("/"))
    
    for file in sorted_files:
        node = FileTreeNode(
            id=file.id,
            name=file.name,
            path=file.path,
            file_type=file.file_type.value,
            size=file.size,
            language=file.language,
            is_generated=file.is_generated,
            children=[]
        )
        
        path_to_node[file.path] = node
        
        # Find parent
        parent_path = WorkspaceService.get_parent_path(file.path)
        
        if parent_path in path_to_node:
            path_to_node[parent_path].children.append(node)
        else:
            tree.append(node)
    
    return tree


# =============================================================================
# FILE ENDPOINTS
# =============================================================================

@router.post("/files", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def create_file(
    data: FileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new file.
    
    - **path**: Full path including filename (e.g., /src/main.cpp)
    - **content**: File content (optional)
    - **project_id**: Associated project (optional)
    """
    service = WorkspaceService(db)
    
    try:
        file = await service.create_file(
            user_id=current_user.id,
            path=data.path,
            content=data.content,
            project_id=data.project_id
        )
        return file_to_response(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/folders", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    data: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new folder.
    
    - **path**: Full folder path (e.g., /src/components)
    - **project_id**: Associated project (optional)
    """
    service = WorkspaceService(db)
    
    try:
        folder = await service.create_folder(
            user_id=current_user.id,
            path=data.path,
            project_id=data.project_id
        )
        return file_to_response(folder)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/files/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: int,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a file by ID."""
    service = WorkspaceService(db)
    
    file = await service.get_file(current_user.id, file_id, project_id)
    
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    return file_to_response(file)


@router.get("/files/by-path", response_model=FileResponse)
async def get_file_by_path(
    path: str,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a file by its path."""
    service = WorkspaceService(db)
    
    file = await service.get_file_by_path(current_user.id, path, project_id)
    
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    return file_to_response(file)


@router.get("/files", response_model=List[FileResponse])
async def list_files(
    parent_path: str = "/",
    project_id: Optional[int] = None,
    include_children: bool = False,
    file_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List files in a directory.
    
    - **parent_path**: Parent directory path (default: root)
    - **project_id**: Filter by project (optional)
    - **include_children**: Include all descendants (default: false)
    - **file_type**: Filter by type: file or folder (optional)
    """
    service = WorkspaceService(db)
    
    ft = None
    if file_type:
        try:
            ft = FileType(file_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file_type: {file_type}"
            )
    
    files = await service.list_files(
        user_id=current_user.id,
        parent_path=parent_path,
        project_id=project_id,
        include_children=include_children,
        file_type=ft
    )
    
    return [file_to_response(f) for f in files]


@router.get("/tree", response_model=List[FileTreeNode])
async def get_file_tree(
    root_path: str = "/",
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get hierarchical file tree.
    
    - **root_path**: Root path for tree (default: /)
    - **project_id**: Filter by project (optional)
    """
    service = WorkspaceService(db)
    
    files = await service.list_files(
        user_id=current_user.id,
        parent_path=root_path,
        project_id=project_id,
        include_children=True
    )
    
    return build_file_tree(files, root_path)


@router.put("/files/{file_id}", response_model=FileResponse)
async def update_file(
    file_id: int,
    data: FileUpdate,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update file content."""
    service = WorkspaceService(db)
    
    try:
        file = await service.update_file(
            user_id=current_user.id,
            file_id=file_id,
            content=data.content,
            project_id=project_id,
            changed_by="user"
        )
        return file_to_response(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/files/{file_id}/rename", response_model=FileResponse)
async def rename_file(
    file_id: int,
    data: FileRename,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rename a file or folder."""
    service = WorkspaceService(db)
    
    try:
        file = await service.rename_file(
            user_id=current_user.id,
            file_id=file_id,
            new_name=data.new_name,
            project_id=project_id
        )
        return file_to_response(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/files/{file_id}/move", response_model=FileResponse)
async def move_file(
    file_id: int,
    data: FileMove,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move a file or folder to a new location."""
    service = WorkspaceService(db)
    
    try:
        file = await service.move_file(
            user_id=current_user.id,
            file_id=file_id,
            new_parent_path=data.new_parent_path,
            project_id=project_id
        )
        return file_to_response(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/files/{file_id}/copy", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def copy_file(
    file_id: int,
    data: FileCopy,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Copy a file to a new location."""
    service = WorkspaceService(db)
    
    try:
        file = await service.copy_file(
            user_id=current_user.id,
            file_id=file_id,
            dest_path=data.dest_path,
            project_id=project_id
        )
        return file_to_response(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: int,
    project_id: Optional[int] = None,
    permanent: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a file or folder.
    
    - **permanent**: If true, permanently delete; otherwise soft delete
    """
    service = WorkspaceService(db)
    
    try:
        await service.delete_file(
            user_id=current_user.id,
            file_id=file_id,
            project_id=project_id,
            permanent=permanent
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =============================================================================
# VERSION ENDPOINTS
# =============================================================================

@router.get("/files/{file_id}/versions", response_model=List[FileVersionResponse])
async def get_file_versions(
    file_id: int,
    project_id: Optional[int] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get version history for a file."""
    service = WorkspaceService(db)
    
    try:
        versions = await service.get_file_versions(
            user_id=current_user.id,
            file_id=file_id,
            project_id=project_id,
            limit=limit
        )
        
        return [
            FileVersionResponse(
                id=v.id,
                version_number=v.version_number,
                size=v.size,
                change_type=v.change_type,
                change_description=v.change_description,
                changed_by=v.changed_by,
                created_at=v.created_at
            )
            for v in versions
        ]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/files/{file_id}/versions/{version_number}/restore", response_model=FileResponse)
async def restore_file_version(
    file_id: int,
    version_number: int,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore a file to a previous version."""
    service = WorkspaceService(db)
    
    try:
        file = await service.restore_version(
            user_id=current_user.id,
            file_id=file_id,
            version_number=version_number,
            project_id=project_id
        )
        return file_to_response(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =============================================================================
# SEARCH & STATS
# =============================================================================

@router.get("/search", response_model=List[SearchResult])
async def search_files(
    q: str = Query(..., min_length=1, description="Search query"),
    project_id: Optional[int] = None,
    file_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search files by name or content.
    
    - **q**: Search query
    - **project_id**: Filter by project (optional)
    - **file_type**: Filter by type (optional)
    """
    service = WorkspaceService(db)
    
    ft = None
    if file_type:
        try:
            ft = FileType(file_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file_type: {file_type}"
            )
    
    files = await service.search_files(
        user_id=current_user.id,
        query=q,
        project_id=project_id,
        file_type=ft,
        limit=limit
    )
    
    results = []
    for f in files:
        # Generate match preview for content matches
        preview = None
        if f.content and q.lower() in f.content.lower():
            idx = f.content.lower().find(q.lower())
            start = max(0, idx - 30)
            end = min(len(f.content), idx + len(q) + 30)
            preview = f"...{f.content[start:end]}..."
        
        results.append(SearchResult(
            id=f.id,
            name=f.name,
            path=f.path,
            file_type=f.file_type.value,
            language=f.language,
            match_preview=preview
        ))
    
    return results


@router.get("/stats", response_model=WorkspaceStatsResponse)
async def get_workspace_stats(
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get workspace statistics."""
    service = WorkspaceService(db)
    
    stats = await service.get_workspace_stats(
        user_id=current_user.id,
        project_id=project_id
    )
    
    return WorkspaceStatsResponse(**stats)


# =============================================================================
# UPLOAD/DOWNLOAD
# =============================================================================

@router.post("/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    path: str = Query(..., description="Destination path"),
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file.
    
    - **file**: File to upload
    - **path**: Destination path (folder path, filename will be appended)
    - **project_id**: Associated project (optional)
    """
    service = WorkspaceService(db)
    
    # Read file content
    content = await file.read()
    
    # Check size
    if len(content) > WorkspaceService.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {WorkspaceService.MAX_FILE_SIZE // 1024 // 1024}MB)"
        )
    
    # Determine full path
    full_path = service.join_path(path, file.filename)
    
    try:
        # Try to decode as text
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only text files are supported"
        )
    
    try:
        workspace_file = await service.create_file(
            user_id=current_user.id,
            path=full_path,
            content=text_content,
            project_id=project_id
        )
        return file_to_response(workspace_file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: int,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download a file."""
    service = WorkspaceService(db)
    
    file = await service.get_file(current_user.id, file_id, project_id)
    
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    if file.file_type == FileType.FOLDER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot download folders")
    
    content = file.content or ""
    
    return StreamingResponse(
        io.BytesIO(content.encode('utf-8')),
        media_type=file.mime_type or "text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{file.name}"'
        }
    )


# =============================================================================
# BULK OPERATIONS
# =============================================================================

class BulkCreateRequest(BaseModel):
    """Request for bulk file creation."""
    files: List[FileCreate]


class BulkDeleteRequest(BaseModel):
    """Request for bulk file deletion."""
    file_ids: List[int]
    permanent: bool = False


@router.post("/bulk/create", response_model=List[FileResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_files(
    data: BulkCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create multiple files at once."""
    service = WorkspaceService(db)
    
    created_files = []
    errors = []
    
    for file_data in data.files:
        try:
            file = await service.create_file(
                user_id=current_user.id,
                path=file_data.path,
                content=file_data.content,
                project_id=file_data.project_id
            )
            created_files.append(file_to_response(file))
        except ValueError as e:
            errors.append({"path": file_data.path, "error": str(e)})
    
    if errors and not created_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "All files failed to create", "errors": errors}
        )
    
    return created_files


@router.post("/bulk/delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_files(
    data: BulkDeleteRequest,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete multiple files at once."""
    service = WorkspaceService(db)
    
    for file_id in data.file_ids:
        try:
            await service.delete_file(
                user_id=current_user.id,
                file_id=file_id,
                project_id=project_id,
                permanent=data.permanent
            )
        except ValueError:
            pass  # Skip files that don't exist
