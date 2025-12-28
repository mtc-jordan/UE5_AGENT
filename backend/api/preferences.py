from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from services.auth import get_current_user
from services.ai import ai_service
from models.user import User, UserPreferences
from api.schemas import (
    UserPreferencesUpdate, 
    UserPreferencesResponse,
    GenerateTitleRequest,
    GenerateTitleResponse
)

router = APIRouter(prefix="/preferences", tags=["Preferences"])


async def get_or_create_preferences(db: AsyncSession, user_id: int) -> UserPreferences:
    """Get user preferences or create default ones."""
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    
    if not prefs:
        prefs = UserPreferences(user_id=user_id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    
    return prefs


@router.get("", response_model=UserPreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's preferences."""
    prefs = await get_or_create_preferences(db, current_user.id)
    return UserPreferencesResponse.model_validate(prefs)


@router.patch("", response_model=UserPreferencesResponse)
async def update_preferences(
    prefs_data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user preferences."""
    prefs = await get_or_create_preferences(db, current_user.id)
    
    update_data = prefs_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prefs, key, value)
    
    await db.commit()
    await db.refresh(prefs)
    return UserPreferencesResponse.model_validate(prefs)


@router.post("/generate-title", response_model=GenerateTitleResponse)
async def generate_chat_title(
    request: GenerateTitleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a descriptive title for a chat based on the first message."""
    # Get user preferences for title format
    prefs = await get_or_create_preferences(db, current_user.id)
    
    # Create a prompt to generate a concise title
    prompt = f"""Generate a short, descriptive title (3-6 words) for a chat conversation that starts with this message:

"{request.message[:500]}"

{f'Project context: {request.project_name}' if request.project_name else ''}

Rules:
- Maximum 6 words
- Be specific and descriptive
- Focus on the main topic or task
- Use title case
- No quotes or special characters
- No generic titles like "New Chat" or "Help Request"

Respond with ONLY the title, nothing else."""

    try:
        # Use AI to generate the title
        title = await ai_service.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model="deepseek-chat",
            temperature=0.3
        )
        
        # Clean up the title
        title = title.strip().strip('"\'').strip()
        
        # Apply title format if specified
        if prefs.title_format and prefs.title_format != "{topic}":
            from datetime import datetime
            title = prefs.title_format.replace("{topic}", title)
            title = title.replace("{date}", datetime.now().strftime("%m/%d"))
            if request.project_name:
                title = title.replace("{project}", request.project_name)
            else:
                title = title.replace("{project}", "").replace("[]", "").strip()
        
        # Ensure reasonable length
        if len(title) > 60:
            title = title[:57] + "..."
        
        return GenerateTitleResponse(title=title)
    
    except Exception as e:
        # Fallback to a simple extraction
        words = request.message.split()[:6]
        fallback_title = " ".join(words)
        if len(fallback_title) > 40:
            fallback_title = fallback_title[:37] + "..."
        return GenerateTitleResponse(title=fallback_title.title())
