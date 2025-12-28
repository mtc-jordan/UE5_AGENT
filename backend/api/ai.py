from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import json
import asyncio
import logging
from datetime import datetime

from core.database import get_db, async_session
from services.auth import get_current_user
from services.ai import orchestrator, ai_service
from models.user import User
from models.chat import Chat, Message, MessageRole, ChatMode
from models.project import Project
from models.agent_memory import AgentMemory
from api.schemas import AIChatRequest, ChatModeEnum
from sqlalchemy import desc

router = APIRouter(prefix="/ai", tags=["AI"])
logger = logging.getLogger(__name__)


def build_project_context(project: Project) -> str:
    """Build a context string from project information."""
    context_parts = []
    
    context_parts.append(f"## Project Context")
    context_parts.append(f"- **Project Name**: {project.name}")
    context_parts.append(f"- **Unreal Engine Version**: {project.ue_version}")
    
    if project.description:
        context_parts.append(f"- **Description**: {project.description}")
    
    if project.project_path:
        context_parts.append(f"- **Project Path**: {project.project_path}")
    
    context_parts.append("")
    context_parts.append("Please provide advice and code that is compatible with this UE version and project context.")
    context_parts.append("")
    
    return "\n".join(context_parts)


async def recall_agent_memories(
    db: AsyncSession,
    user_id: int,
    project_id: int | None,
    agents: list[str],
    query: str,
    limit: int = 5
) -> str:
    """
    Recall relevant memories for the given agents and query.
    Returns a formatted string of memories to include in the context.
    """
    # Build query for memories
    base_query = select(AgentMemory).where(
        AgentMemory.user_id == user_id,
        AgentMemory.agent.in_(agents)
    )
    
    # Filter by project if available
    if project_id:
        base_query = base_query.where(
            (AgentMemory.project_id == project_id) | (AgentMemory.project_id == None)
        )
    
    # Simple keyword search
    keywords = query.lower().split()[:5]
    for keyword in keywords:
        if len(keyword) > 2:  # Skip very short words
            base_query = base_query.where(
                (AgentMemory.title.ilike(f"%{keyword}%")) | 
                (AgentMemory.content.ilike(f"%{keyword}%"))
            )
    
    base_query = base_query.order_by(desc(AgentMemory.importance)).limit(limit)
    
    result = await db.execute(base_query)
    memories = result.scalars().all()
    
    if not memories:
        return ""
    
    # Format memories for context
    memory_parts = ["## Agent Memory (Previous Conversations)"]
    memory_parts.append("The following are relevant insights from previous conversations:")
    memory_parts.append("")
    
    for memory in memories:
        memory_parts.append(f"### [{memory.agent}] {memory.title}")
        memory_parts.append(f"*Type: {memory.memory_type} | Importance: {memory.importance:.1f}*")
        memory_parts.append(memory.content)
        memory_parts.append("")
        
        # Update access count
        memory.access_count += 1
        memory.last_accessed = datetime.utcnow()
    
    await db.commit()
    
    memory_parts.append("Use these memories to provide consistent and contextually aware responses.")
    memory_parts.append("")
    
    return "\n".join(memory_parts)


async def extract_and_save_memories(
    db: AsyncSession,
    user_id: int,
    project_id: int | None,
    chat_id: int,
    agent: str,
    content: str
):
    """
    Extract key insights from agent response and save as memories.
    This is a simple extraction - in production you might use AI to extract.
    """
    # Simple heuristics to identify memory-worthy content
    memory_triggers = [
        ("decision", ["I recommend", "we should", "the best approach", "I suggest"]),
        ("insight", ["important to note", "key insight", "keep in mind", "remember that"]),
        ("code_pattern", ["```cpp", "```c++", "UCLASS", "UFUNCTION", "UPROPERTY"]),
        ("issue", ["common issue", "watch out for", "potential problem", "bug"]),
    ]
    
    content_lower = content.lower()
    
    for memory_type, triggers in memory_triggers:
        for trigger in triggers:
            if trigger.lower() in content_lower:
                # Extract a relevant snippet (first 500 chars around the trigger)
                idx = content_lower.find(trigger.lower())
                start = max(0, idx - 100)
                end = min(len(content), idx + 400)
                snippet = content[start:end].strip()
                
                if len(snippet) > 50:  # Only save meaningful snippets
                    # Create a title from the first line or sentence
                    title_end = min(snippet.find("\n"), snippet.find("."), 100)
                    if title_end < 0:
                        title_end = 100
                    title = snippet[:title_end].strip()[:100]
                    
                    # Check if similar memory exists
                    existing = await db.execute(
                        select(AgentMemory).where(
                            AgentMemory.user_id == user_id,
                            AgentMemory.agent == agent,
                            AgentMemory.title.ilike(f"%{title[:50]}%")
                        ).limit(1)
                    )
                    if existing.scalar_one_or_none():
                        continue  # Skip duplicate
                    
                    memory = AgentMemory(
                        user_id=user_id,
                        project_id=project_id,
                        agent=agent,
                        memory_type=memory_type,
                        title=title,
                        content=snippet,
                        source_chat_id=chat_id,
                        importance=0.6 if memory_type == "decision" else 0.5
                    )
                    db.add(memory)
                    break  # Only one memory per type per response
    
    try:
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to save memory: {e}")


async def save_assistant_messages(chat_id: int, responses: dict):
    """Save assistant messages to database using a new session."""
    if not chat_id or not responses:
        return
    
    try:
        async with async_session() as db:
            for agent, content in responses.items():
                if content:
                    assistant_message = Message(
                        chat_id=chat_id,
                        role=MessageRole.ASSISTANT,
                        agent=agent,
                        content=content
                    )
                    db.add(assistant_message)
            await db.commit()
            logger.info(f"Saved {len(responses)} assistant messages for chat {chat_id}")
    except Exception as e:
        logger.error(f"Failed to save messages: {e}")


async def generate_sse_response(
    generator, 
    chat_id: int = None,
    user_id: int = None,
    project_id: int = None
):
    """Convert async generator to SSE format with proper flushing."""
    full_responses = {}
    
    try:
        async for chunk in generator:
            # Collect complete responses for saving
            if chunk.get("type") == "complete":
                agent = chunk.get("agent", "assistant")
                content = chunk.get("content", "")
                if content:
                    full_responses[agent] = content
            
            data = json.dumps(chunk)
            yield f"data: {data}\n\n"
            # Small delay to ensure proper streaming
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        logger.info("SSE stream cancelled by client")
        yield f"data: {json.dumps({'type': 'cancelled'})}\n\n"
    except Exception as e:
        logger.error(f"SSE stream error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    finally:
        # Save messages after streaming completes
        if chat_id and full_responses:
            await save_assistant_messages(chat_id, full_responses)
            
            # Extract and save memories from responses
            if user_id:
                try:
                    async with async_session() as memory_db:
                        for agent, content in full_responses.items():
                            await extract_and_save_memories(
                                db=memory_db,
                                user_id=user_id,
                                project_id=project_id,
                                chat_id=chat_id,
                                agent=agent,
                                content=content
                            )
                except Exception as e:
                    logger.error(f"Failed to extract memories: {e}")
        yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat(
    request: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a message and get AI response with streaming.
    
    Supports both Solo and Team modes.
    Includes project context when chat is linked to a project.
    """
    # Get or create chat
    chat = None
    project = None
    
    if request.chat_id:
        result = await db.execute(
            select(Chat)
            .options(selectinload(Chat.project))
            .where(Chat.id == request.chat_id, Chat.user_id == current_user.id)
        )
        chat = result.scalar_one_or_none()
        
        if not chat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
        
        # Get project if linked
        if chat.project_id:
            project = chat.project
    
    # Build message history
    messages = []
    
    # Add project context as system message if available
    if project:
        project_context = build_project_context(project)
        messages.append({"role": "system", "content": project_context})
    
    # Recall relevant agent memories
    agents_to_recall = request.active_agents if request.mode != ChatModeEnum.SOLO else [request.solo_agent]
    memory_context = await recall_agent_memories(
        db=db,
        user_id=current_user.id,
        project_id=project.id if project else None,
        agents=agents_to_recall,
        query=request.message,
        limit=5
    )
    if memory_context:
        messages.append({"role": "system", "content": memory_context})
    
    if chat:
        result = await db.execute(
            select(Message).where(Message.chat_id == chat.id).order_by(Message.created_at)
        )
        db_messages = result.scalars().all()
        
        for msg in db_messages:
            role = "user" if msg.role == MessageRole.USER else "assistant"
            content = msg.content
            if msg.agent:
                content = f"[{msg.agent}]: {content}"
            messages.append({"role": role, "content": content})
    
    # Add current message
    messages.append({"role": "user", "content": request.message})
    
    # Save user message to database if chat exists
    if chat:
        user_message = Message(
            chat_id=chat.id,
            role=MessageRole.USER,
            content=request.message,
            attachments=request.attachments
        )
        db.add(user_message)
        await db.commit()
    
    # Store chat_id for use in generator
    chat_id = chat.id if chat else None
    
    # Generate response based on mode
    async def response_generator():
        try:
            if request.mode == ChatModeEnum.SOLO:
                async for chunk in orchestrator.solo_mode(
                    messages=messages,
                    agent_key=request.solo_agent,
                    model=request.model
                ):
                    yield chunk
            elif request.mode == ChatModeEnum.ROUNDTABLE:
                async for chunk in orchestrator.roundtable_mode(
                    messages=messages,
                    active_agents=request.active_agents,
                    model=request.model
                ):
                    yield chunk
            else:
                async for chunk in orchestrator.team_mode(
                    messages=messages,
                    active_agents=request.active_agents,
                    model=request.model
                ):
                    yield chunk
        except Exception as e:
            logger.error(f"AI generation error: {e}")
            yield {"type": "error", "message": str(e)}
    
    return StreamingResponse(
        generate_sse_response(
            response_generator(), 
            chat_id,
            user_id=current_user.id,
            project_id=project.id if project else None
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked"
        }
    )


@router.get("/models")
async def list_models():
    """List available AI models."""
    return {
        "models": [
            {
                "id": "deepseek-chat",
                "name": "DeepSeek V3",
                "provider": "deepseek",
                "description": "Fast and efficient code generation",
                "default": True
            },
            {
                "id": "deepseek-reasoner",
                "name": "DeepSeek R1",
                "provider": "deepseek",
                "description": "Advanced reasoning for complex tasks"
            },
            {
                "id": "claude-3-5-sonnet",
                "name": "Claude 3.5 Sonnet",
                "provider": "anthropic",
                "description": "Balanced performance and quality"
            },
            {
                "id": "claude-3-opus",
                "name": "Claude 3 Opus",
                "provider": "anthropic",
                "description": "Highest quality responses"
            }
        ]
    }


@router.get("/agents")
async def list_agents():
    """List available agents with their info."""
    agents = []
    for key, agent in ai_service.agents.items():
        agents.append({
            "key": key,
            "name": agent["name"],
            "description": agent["description"],
            "color": agent["color"],
            "icon": agent["icon"]
        })
    return {"agents": agents}
