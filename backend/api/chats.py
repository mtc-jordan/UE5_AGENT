from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from core.database import get_db
from services.auth import get_current_user
from models.user import User
from models.chat import Chat, Message, MessageRole
from api.schemas import (
    ChatCreate, ChatUpdate, ChatResponse,
    MessageCreate, MessageResponse
)

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.get("", response_model=List[ChatResponse])
async def list_chats(
    project_id: Optional[int] = None,
    include_archived: bool = False,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all chats for the current user.
    
    - Pinned chats appear first, sorted by pinned_at
    - Then regular chats sorted by updated_at
    - Archived chats are hidden by default
    """
    query = select(Chat).where(Chat.user_id == current_user.id)
    
    # Filter by project if specified
    if project_id:
        query = query.where(Chat.project_id == project_id)
    
    # Filter archived chats
    if not include_archived:
        query = query.where(Chat.is_archived == False)
    
    # Search in title
    if search:
        query = query.where(Chat.title.ilike(f"%{search}%"))
    
    # Order: pinned first (by pinned_at desc), then by updated_at desc
    query = query.order_by(
        Chat.is_pinned.desc(),
        Chat.pinned_at.desc().nullslast(),
        Chat.updated_at.desc()
    )
    
    result = await db.execute(query)
    chats = result.scalars().all()
    return [ChatResponse.model_validate(c) for c in chats]


@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    chat_data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new chat."""
    chat = Chat(
        user_id=current_user.id,
        project_id=chat_data.project_id,
        title=chat_data.title,
        mode=chat_data.mode,
        active_agents=chat_data.active_agents,
        solo_agent=chat_data.solo_agent,
        model=chat_data.model
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific chat."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    return ChatResponse.model_validate(chat)


@router.patch("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: int,
    chat_data: ChatUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a chat."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    update_data = chat_data.model_dump(exclude_unset=True)
    
    # Handle pinning - set pinned_at timestamp
    if 'is_pinned' in update_data:
        if update_data['is_pinned'] and not chat.is_pinned:
            chat.pinned_at = datetime.utcnow()
        elif not update_data['is_pinned']:
            chat.pinned_at = None
    
    for key, value in update_data.items():
        setattr(chat, key, value)
    
    await db.commit()
    await db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.post("/{chat_id}/pin", response_model=ChatResponse)
async def pin_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pin a chat to the top."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    chat.is_pinned = True
    chat.pinned_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.post("/{chat_id}/unpin", response_model=ChatResponse)
async def unpin_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unpin a chat."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    chat.is_pinned = False
    chat.pinned_at = None
    
    await db.commit()
    await db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.post("/{chat_id}/archive", response_model=ChatResponse)
async def archive_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Archive a chat."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    chat.is_archived = True
    chat.is_pinned = False  # Unpin when archiving
    chat.pinned_at = None
    
    await db.commit()
    await db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.post("/{chat_id}/unarchive", response_model=ChatResponse)
async def unarchive_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unarchive a chat."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    chat.is_archived = False
    
    await db.commit()
    await db.refresh(chat)
    return ChatResponse.model_validate(chat)


@router.post("/{chat_id}/duplicate", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Duplicate a chat including all messages."""
    # Get the original chat
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    original = result.scalar_one_or_none()
    
    if not original:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    # Create the new chat
    new_chat = Chat(
        user_id=current_user.id,
        project_id=original.project_id,
        title=f"{original.title} (Copy)",
        mode=original.mode,
        active_agents=original.active_agents,
        solo_agent=original.solo_agent,
        model=original.model
    )
    db.add(new_chat)
    await db.flush()  # Get the new chat ID without committing
    
    # Get all messages from the original chat
    messages_result = await db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)
    )
    original_messages = messages_result.scalars().all()
    
    # Copy all messages to the new chat
    for msg in original_messages:
        new_message = Message(
            chat_id=new_chat.id,
            role=msg.role,
            agent=msg.agent,
            content=msg.content,
            attachments=msg.attachments
        )
        db.add(new_message)
    
    await db.commit()
    await db.refresh(new_chat)
    return ChatResponse.model_validate(new_chat)


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat and all its messages."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    await db.delete(chat)
    await db.commit()


# Message endpoints

@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all messages in a chat."""
    # Verify chat ownership
    chat_result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = chat_result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    result = await db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [MessageResponse.model_validate(m) for m in messages]


@router.post("/{chat_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    chat_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a user message to a chat."""
    # Verify chat ownership
    chat_result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = chat_result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    message = Message(
        chat_id=chat_id,
        role=MessageRole.USER,
        content=message_data.content,
        attachments=message_data.attachments
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return MessageResponse.model_validate(message)


@router.delete("/{chat_id}/messages", status_code=status.HTTP_204_NO_CONTENT)
async def clear_messages(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Clear all messages in a chat."""
    # Verify chat ownership
    chat_result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == current_user.id)
    )
    chat = chat_result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
    # Delete all messages
    await db.execute(
        Message.__table__.delete().where(Message.chat_id == chat_id)
    )
    await db.commit()
