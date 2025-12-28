from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List

from core.database import get_db
from services.auth import get_current_user
from models.user import User
from models.agent import Agent, DEFAULT_AGENTS
from api.schemas import AgentCreate, AgentUpdate, AgentResponse

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("", response_model=List[AgentResponse])
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all agents (default + user custom)."""
    result = await db.execute(
        select(Agent).where(
            or_(
                Agent.user_id == None,  # Default agents
                Agent.user_id == current_user.id  # User's custom agents
            )
        ).order_by(Agent.is_default.desc(), Agent.name)
    )
    agents = result.scalars().all()
    return [AgentResponse.model_validate(a) for a in agents]


@router.get("/defaults", response_model=List[dict])
async def get_default_agents():
    """Get the default agent configurations (no auth required)."""
    return DEFAULT_AGENTS


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a custom agent."""
    # Check if key already exists for user
    result = await db.execute(
        select(Agent).where(
            Agent.key == agent_data.key,
            or_(Agent.user_id == None, Agent.user_id == current_user.id)
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent with this key already exists"
        )
    
    agent = Agent(
        user_id=current_user.id,
        key=agent_data.key,
        name=agent_data.name,
        description=agent_data.description,
        system_prompt=agent_data.system_prompt,
        color=agent_data.color,
        icon=agent_data.icon,
        is_default=False
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific agent."""
    result = await db.execute(
        select(Agent).where(
            Agent.id == agent_id,
            or_(Agent.user_id == None, Agent.user_id == current_user.id)
        )
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    
    return AgentResponse.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: int,
    agent_data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a custom agent (cannot update default agents)."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found or cannot modify default agents"
        )
    
    update_data = agent_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agent, key, value)
    
    await db.commit()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a custom agent (cannot delete default agents)."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found or cannot delete default agents"
        )
    
    await db.delete(agent)
    await db.commit()
