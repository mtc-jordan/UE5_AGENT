from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List

from core.database import get_db
from services.auth import get_current_user
from models.user import User
from models.project import Project
from models.chat import Chat
from api.schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse, ChatResponse

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectDetailResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all projects for the current user with chat counts."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.chats))
        .where(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
    )
    projects = result.scalars().all()
    
    response = []
    for p in projects:
        project_dict = {
            "id": p.id,
            "user_id": p.user_id,
            "name": p.name,
            "description": p.description,
            "ue_version": p.ue_version,
            "project_path": p.project_path,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "chat_count": len(p.chats) if p.chats else 0,
            "recent_chats": [
                ChatResponse.model_validate(c) 
                for c in sorted(p.chats, key=lambda x: x.updated_at, reverse=True)[:3]
            ] if p.chats else []
        }
        response.append(ProjectDetailResponse(**project_dict))
    
    return response


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new project."""
    project = Project(
        user_id=current_user.id,
        name=project_data.name,
        description=project_data.description,
        ue_version=project_data.ue_version,
        project_path=project_data.project_path
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific project with its chats."""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.chats))
        .where(Project.id == project_id, Project.user_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    return ProjectDetailResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        ue_version=project.ue_version,
        project_path=project.project_path,
        created_at=project.created_at,
        updated_at=project.updated_at,
        chat_count=len(project.chats) if project.chats else 0,
        recent_chats=[
            ChatResponse.model_validate(c) 
            for c in sorted(project.chats, key=lambda x: x.updated_at, reverse=True)[:5]
        ] if project.chats else []
    )


@router.get("/{project_id}/chats", response_model=List[ChatResponse])
async def get_project_chats(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all chats for a specific project."""
    # Verify project ownership
    project_result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    result = await db.execute(
        select(Chat)
        .where(Chat.project_id == project_id)
        .order_by(Chat.updated_at.desc())
    )
    chats = result.scalars().all()
    return [ChatResponse.model_validate(c) for c in chats]


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    update_data = project_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a project and all its associated chats."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
