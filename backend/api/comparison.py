"""
Model Comparison API Endpoints.

Provides REST and streaming endpoints for AI model comparison.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import List, Optional
import json

from core.database import get_db
from services.auth import get_current_user
from services.comparison import comparison_service
from models.user import User
from models.comparison import get_model_info

router = APIRouter(prefix="/comparison", tags=["comparison"])


# Request/Response Models

class CreateComparisonRequest(BaseModel):
    """Request to create a new comparison."""
    prompt: str = Field(..., min_length=1, max_length=10000)
    models: List[str] = Field(..., min_items=2, max_items=8)
    system_prompt: Optional[str] = Field(None, max_length=5000)
    title: Optional[str] = Field(None, max_length=256)


class UpdateSessionRequest(BaseModel):
    """Request to update a comparison session."""
    title: Optional[str] = Field(None, max_length=256)
    is_saved: Optional[bool] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None


class RateResultRequest(BaseModel):
    """Request to rate a comparison result."""
    rating: int = Field(..., ge=1, le=5)
    is_winner: bool = False


# Endpoints

@router.get("/models")
async def get_available_models(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of available models for comparison.
    
    Returns models grouped by provider with availability status.
    """
    models = comparison_service.get_available_models()
    
    # Group by provider
    providers = {}
    for model in models:
        provider = model["provider"]
        if provider not in providers:
            providers[provider] = {
                "name": provider.title(),
                "models": []
            }
        providers[provider]["models"].append(model)
    
    return {
        "models": models,
        "providers": providers,
        "total": len(models)
    }


@router.post("/create")
async def create_comparison(
    request: CreateComparisonRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new comparison session.
    
    Creates a session with the specified models but does not run it yet.
    Use /run/{session_id} to start the comparison.
    """
    # Validate models
    available_models = [m["id"] for m in comparison_service.get_available_models()]
    invalid_models = [m for m in request.models if m not in available_models]
    
    if invalid_models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or unavailable models: {invalid_models}"
        )
    
    session = await comparison_service.create_comparison(
        db=db,
        user_id=current_user.id,
        prompt=request.prompt,
        models=request.models,
        system_prompt=request.system_prompt,
        title=request.title
    )
    
    return session.to_dict()


@router.post("/run/{session_id}")
async def run_comparison(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run a comparison session (non-streaming).
    
    Runs all models in parallel and returns complete results.
    """
    # Verify session ownership
    session = await comparison_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.status == "completed":
        return session.to_dict()
    
    result = await comparison_service.run_comparison_parallel(db, session_id)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    # Refresh session
    session = await comparison_service.get_session(db, session_id, current_user.id)
    return session.to_dict()


@router.get("/run/{session_id}/stream")
async def run_comparison_stream(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Run a comparison session with streaming.
    
    Returns Server-Sent Events (SSE) with progress updates for each model.
    """
    # Verify session ownership
    session = await comparison_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    async def event_generator():
        async for event in comparison_service.run_comparison(db, session_id):
            yield f"data: {json.dumps(event)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/quick")
async def quick_comparison(
    request: CreateComparisonRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create and run a comparison in one step (non-streaming).
    
    Convenience endpoint that combines create and run.
    """
    # Validate models
    available_models = [m["id"] for m in comparison_service.get_available_models()]
    invalid_models = [m for m in request.models if m not in available_models]
    
    if invalid_models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or unavailable models: {invalid_models}"
        )
    
    # Create session
    session = await comparison_service.create_comparison(
        db=db,
        user_id=current_user.id,
        prompt=request.prompt,
        models=request.models,
        system_prompt=request.system_prompt,
        title=request.title
    )
    
    # Run comparison
    result = await comparison_service.run_comparison_parallel(db, session.id)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    # Refresh and return session
    session = await comparison_service.get_session(db, session.id, current_user.id)
    return session.to_dict()


@router.get("/sessions")
async def list_sessions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    saved_only: bool = Query(False),
    favorites_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List comparison sessions for the current user.
    
    Supports pagination and filtering by saved/favorites.
    """
    sessions, total = await comparison_service.list_sessions(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        saved_only=saved_only,
        favorites_only=favorites_only
    )
    
    return {
        "sessions": [s.to_dict() for s in sessions],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific comparison session."""
    session = await comparison_service.get_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session.to_dict()


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: int,
    request: UpdateSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a comparison session (title, saved status, etc.)."""
    update_data = request.dict(exclude_unset=True)
    
    session = await comparison_service.update_session(
        db=db,
        session_id=session_id,
        user_id=current_user.id,
        **update_data
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session.to_dict()


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a comparison session."""
    success = await comparison_service.delete_session(db, session_id, current_user.id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session deleted successfully"}


@router.post("/results/{result_id}/rate")
async def rate_result(
    result_id: int,
    request: RateResultRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Rate a comparison result.
    
    Optionally mark as winner (best response in the comparison).
    """
    result = await comparison_service.rate_result(
        db=db,
        result_id=result_id,
        user_id=current_user.id,
        rating=request.rating,
        is_winner=request.is_winner
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    return result.to_dict()


@router.get("/stats")
async def get_comparison_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get comparison statistics for the current user.
    
    Returns aggregate stats like total comparisons, favorite models, etc.
    """
    sessions, total = await comparison_service.list_sessions(
        db=db,
        user_id=current_user.id,
        limit=1000,
        offset=0
    )
    
    # Calculate stats
    model_wins = {}
    model_ratings = {}
    total_completed = 0
    
    for session in sessions:
        if session.status == "completed":
            total_completed += 1
            for result in session.results:
                model_id = result.model_id
                
                if result.is_winner:
                    model_wins[model_id] = model_wins.get(model_id, 0) + 1
                
                if result.user_rating:
                    if model_id not in model_ratings:
                        model_ratings[model_id] = []
                    model_ratings[model_id].append(result.user_rating)
    
    # Calculate average ratings
    avg_ratings = {}
    for model_id, ratings in model_ratings.items():
        avg_ratings[model_id] = sum(ratings) / len(ratings) if ratings else 0
    
    return {
        "total_comparisons": total,
        "completed_comparisons": total_completed,
        "model_wins": model_wins,
        "model_avg_ratings": avg_ratings,
        "favorite_model": max(model_wins, key=model_wins.get) if model_wins else None
    }
