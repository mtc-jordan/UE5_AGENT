from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from core.database import get_db
from services.auth import get_current_user
from models.user import User
from models.agent_memory import AgentMemory, MemoryType


router = APIRouter(prefix="/memory", tags=["Agent Memory"])


# Schemas
class MemoryCreate(BaseModel):
    project_id: Optional[int] = None
    agent: str
    memory_type: str
    title: str
    content: str
    source_chat_id: Optional[int] = None
    importance: float = 0.5


class MemoryResponse(BaseModel):
    id: int
    project_id: Optional[int]
    agent: str
    memory_type: str
    title: str
    content: str
    importance: float
    access_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class MemoryStats(BaseModel):
    total_memories: int
    by_type: dict
    by_agent: dict
    most_accessed: List[MemoryResponse]


@router.get("", response_model=List[MemoryResponse])
async def list_memories(
    project_id: Optional[int] = None,
    agent: Optional[str] = None,
    memory_type: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List agent memories with optional filters."""
    query = select(AgentMemory).where(AgentMemory.user_id == current_user.id)
    
    if project_id:
        query = query.where(AgentMemory.project_id == project_id)
    if agent:
        query = query.where(AgentMemory.agent == agent)
    if memory_type:
        query = query.where(AgentMemory.memory_type == memory_type)
    
    query = query.order_by(desc(AgentMemory.importance), desc(AgentMemory.created_at)).limit(limit)
    
    result = await db.execute(query)
    memories = result.scalars().all()
    return [MemoryResponse.model_validate(m) for m in memories]


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    memory_data: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new agent memory."""
    memory = AgentMemory(
        user_id=current_user.id,
        project_id=memory_data.project_id,
        agent=memory_data.agent,
        memory_type=memory_data.memory_type,
        title=memory_data.title,
        content=memory_data.content,
        source_chat_id=memory_data.source_chat_id,
        importance=memory_data.importance
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return MemoryResponse.model_validate(memory)


@router.get("/recall", response_model=List[MemoryResponse])
async def recall_memories(
    query: str,
    project_id: Optional[int] = None,
    agents: Optional[str] = None,  # Comma-separated list
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recall relevant memories based on a query.
    
    This is a simple keyword-based search. In production, you might want
    to use vector embeddings for semantic search.
    """
    base_query = select(AgentMemory).where(AgentMemory.user_id == current_user.id)
    
    if project_id:
        base_query = base_query.where(AgentMemory.project_id == project_id)
    
    if agents:
        agent_list = [a.strip() for a in agents.split(",")]
        base_query = base_query.where(AgentMemory.agent.in_(agent_list))
    
    # Simple keyword search in title and content
    keywords = query.lower().split()
    for keyword in keywords[:5]:  # Limit to 5 keywords
        base_query = base_query.where(
            (AgentMemory.title.ilike(f"%{keyword}%")) | 
            (AgentMemory.content.ilike(f"%{keyword}%"))
        )
    
    base_query = base_query.order_by(desc(AgentMemory.importance)).limit(limit)
    
    result = await db.execute(base_query)
    memories = result.scalars().all()
    
    # Update access count and last_accessed
    for memory in memories:
        memory.access_count += 1
        memory.last_accessed = datetime.utcnow()
    await db.commit()
    
    return [MemoryResponse.model_validate(m) for m in memories]


@router.get("/stats", response_model=MemoryStats)
async def get_memory_stats(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get memory statistics."""
    base_query = select(AgentMemory).where(AgentMemory.user_id == current_user.id)
    
    if project_id:
        base_query = base_query.where(AgentMemory.project_id == project_id)
    
    result = await db.execute(base_query)
    memories = result.scalars().all()
    
    # Calculate stats
    by_type = {}
    by_agent = {}
    for m in memories:
        by_type[m.memory_type] = by_type.get(m.memory_type, 0) + 1
        by_agent[m.agent] = by_agent.get(m.agent, 0) + 1
    
    # Get most accessed
    most_accessed_query = base_query.order_by(desc(AgentMemory.access_count)).limit(5)
    result = await db.execute(most_accessed_query)
    most_accessed = result.scalars().all()
    
    return MemoryStats(
        total_memories=len(memories),
        by_type=by_type,
        by_agent=by_agent,
        most_accessed=[MemoryResponse.model_validate(m) for m in most_accessed]
    )


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a memory."""
    result = await db.execute(
        select(AgentMemory).where(
            AgentMemory.id == memory_id,
            AgentMemory.user_id == current_user.id
        )
    )
    memory = result.scalar_one_or_none()
    
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    
    await db.delete(memory)
    await db.commit()
    return {"message": "Memory deleted"}


@router.patch("/{memory_id}/importance")
async def update_importance(
    memory_id: int,
    importance: float,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update memory importance (0.0 to 1.0)."""
    if not 0.0 <= importance <= 1.0:
        raise HTTPException(status_code=400, detail="Importance must be between 0.0 and 1.0")
    
    result = await db.execute(
        select(AgentMemory).where(
            AgentMemory.id == memory_id,
            AgentMemory.user_id == current_user.id
        )
    )
    memory = result.scalar_one_or_none()
    
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    
    memory.importance = importance
    await db.commit()
    return {"message": "Importance updated", "importance": importance}
