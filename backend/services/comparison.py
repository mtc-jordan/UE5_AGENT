"""
Model Comparison Service.

Handles parallel AI model calls and comparison logic.
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, AsyncGenerator, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from models.comparison import ComparisonSession, ComparisonResult, get_model_info
from services.ai import ai_service
from core.config import settings

logger = logging.getLogger(__name__)


class ComparisonService:
    """
    Service for comparing AI model responses.
    
    Features:
    - Parallel model calls
    - Streaming responses
    - Performance metrics
    - History management
    """
    
    def __init__(self):
        self.active_comparisons: Dict[int, Dict[str, Any]] = {}
    
    async def create_comparison(
        self,
        db: AsyncSession,
        user_id: int,
        prompt: str,
        models: List[str],
        system_prompt: Optional[str] = None,
        title: Optional[str] = None
    ) -> ComparisonSession:
        """Create a new comparison session."""
        session = ComparisonSession(
            user_id=user_id,
            title=title or f"Comparison: {prompt[:50]}...",
            prompt=prompt,
            system_prompt=system_prompt,
            models=models,
            status="pending"
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        # Create result placeholders for each model
        for model_id in models:
            model_info = get_model_info(model_id)
            result = ComparisonResult(
                session_id=session.id,
                model_id=model_id,
                provider=model_info["provider"],
                status="pending"
            )
            db.add(result)
        
        await db.commit()
        await db.refresh(session, ["results"])
        
        logger.info(f"Created comparison session {session.id} with models: {models}")
        return session
    
    async def run_comparison(
        self,
        db: AsyncSession,
        session_id: int
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Run comparison and stream results.
        
        Yields events for each model's progress:
        - {"type": "start", "model": "...", "session_id": ...}
        - {"type": "chunk", "model": "...", "content": "..."}
        - {"type": "complete", "model": "...", "response": "...", "metrics": {...}}
        - {"type": "error", "model": "...", "error": "..."}
        - {"type": "done", "session_id": ...}
        """
        # Get session with results
        result = await db.execute(
            select(ComparisonSession)
            .options(selectinload(ComparisonSession.results))
            .where(ComparisonSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            yield {"type": "error", "error": "Session not found"}
            return
        
        # Update session status
        session.status = "running"
        await db.commit()
        
        # Track active comparison
        self.active_comparisons[session_id] = {
            "session": session,
            "tasks": {},
            "results": {}
        }
        
        try:
            # Create tasks for each model
            tasks = []
            for model_result in session.results:
                task = asyncio.create_task(
                    self._run_model(
                        db,
                        session,
                        model_result,
                        session.prompt,
                        session.system_prompt
                    )
                )
                tasks.append((model_result.model_id, task))
                self.active_comparisons[session_id]["tasks"][model_result.model_id] = task
            
            # Yield start events
            for model_id, _ in tasks:
                yield {
                    "type": "start",
                    "model": model_id,
                    "session_id": session_id,
                    "model_info": get_model_info(model_id)
                }
            
            # Process results as they complete
            pending = {task: model_id for model_id, task in tasks}
            
            while pending:
                done, _ = await asyncio.wait(
                    pending.keys(),
                    timeout=0.1,
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                for task in done:
                    model_id = pending.pop(task)
                    try:
                        result_data = await task
                        self.active_comparisons[session_id]["results"][model_id] = result_data
                        
                        if result_data.get("error"):
                            yield {
                                "type": "error",
                                "model": model_id,
                                "error": result_data["error"]
                            }
                        else:
                            yield {
                                "type": "complete",
                                "model": model_id,
                                "response": result_data["response"],
                                "metrics": result_data["metrics"]
                            }
                    except Exception as e:
                        logger.error(f"Error processing model {model_id}: {e}")
                        yield {
                            "type": "error",
                            "model": model_id,
                            "error": str(e)
                        }
                
                # Small delay to prevent busy loop
                if pending:
                    await asyncio.sleep(0.05)
            
            # Update session status
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            await db.commit()
            
            yield {
                "type": "done",
                "session_id": session_id
            }
            
        except Exception as e:
            logger.error(f"Comparison error: {e}")
            session.status = "failed"
            await db.commit()
            yield {"type": "error", "error": str(e)}
        finally:
            # Cleanup
            if session_id in self.active_comparisons:
                del self.active_comparisons[session_id]
    
    async def _run_model(
        self,
        db: AsyncSession,
        session: ComparisonSession,
        model_result: ComparisonResult,
        prompt: str,
        system_prompt: Optional[str]
    ) -> Dict[str, Any]:
        """Run a single model and collect metrics."""
        model_id = model_result.model_id
        
        # Update status
        model_result.status = "streaming"
        model_result.started_at = datetime.utcnow()
        await db.commit()
        
        start_time = time.time()
        first_token_time = None
        response_chunks = []
        
        try:
            # Build messages
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            
            # Stream response
            async for chunk in ai_service.chat_stream(messages, model_id):
                if first_token_time is None:
                    first_token_time = time.time()
                response_chunks.append(chunk)
            
            end_time = time.time()
            full_response = "".join(response_chunks)
            
            # Calculate metrics
            response_time_ms = int((first_token_time - start_time) * 1000) if first_token_time else None
            total_time_ms = int((end_time - start_time) * 1000)
            token_count = len(full_response.split())  # Approximate
            
            # Update result
            model_result.response = full_response
            model_result.status = "completed"
            model_result.completed_at = datetime.utcnow()
            model_result.response_time_ms = response_time_ms
            model_result.total_time_ms = total_time_ms
            model_result.token_count = token_count
            await db.commit()
            
            return {
                "response": full_response,
                "metrics": {
                    "response_time_ms": response_time_ms,
                    "total_time_ms": total_time_ms,
                    "token_count": token_count
                }
            }
            
        except Exception as e:
            logger.error(f"Model {model_id} error: {e}")
            model_result.status = "failed"
            model_result.error = str(e)
            model_result.completed_at = datetime.utcnow()
            await db.commit()
            
            return {"error": str(e)}
    
    async def run_comparison_parallel(
        self,
        db: AsyncSession,
        session_id: int
    ) -> Dict[str, Any]:
        """
        Run comparison with all models in parallel (non-streaming).
        
        Returns complete results for all models.
        """
        # Get session with results
        result = await db.execute(
            select(ComparisonSession)
            .options(selectinload(ComparisonSession.results))
            .where(ComparisonSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            return {"error": "Session not found"}
        
        # Update session status
        session.status = "running"
        await db.commit()
        
        try:
            # Run all models in parallel
            tasks = [
                self._run_model(db, session, model_result, session.prompt, session.system_prompt)
                for model_result in session.results
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Build response
            model_results = {}
            for i, model_result in enumerate(session.results):
                if isinstance(results[i], Exception):
                    model_results[model_result.model_id] = {
                        "error": str(results[i])
                    }
                else:
                    model_results[model_result.model_id] = results[i]
            
            # Update session status
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            await db.commit()
            
            return {
                "session_id": session_id,
                "status": "completed",
                "results": model_results
            }
            
        except Exception as e:
            logger.error(f"Comparison error: {e}")
            session.status = "failed"
            await db.commit()
            return {"error": str(e)}
    
    async def get_session(
        self,
        db: AsyncSession,
        session_id: int,
        user_id: int
    ) -> Optional[ComparisonSession]:
        """Get a comparison session by ID."""
        result = await db.execute(
            select(ComparisonSession)
            .options(selectinload(ComparisonSession.results))
            .where(
                ComparisonSession.id == session_id,
                ComparisonSession.user_id == user_id
            )
        )
        return result.scalar_one_or_none()
    
    async def list_sessions(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        saved_only: bool = False,
        favorites_only: bool = False
    ) -> Tuple[List[ComparisonSession], int]:
        """List comparison sessions for a user."""
        query = select(ComparisonSession).where(
            ComparisonSession.user_id == user_id
        )
        
        if saved_only:
            query = query.where(ComparisonSession.is_saved == True)
        if favorites_only:
            query = query.where(ComparisonSession.is_favorite == True)
        
        # Count total
        count_result = await db.execute(
            select(ComparisonSession.id).where(ComparisonSession.user_id == user_id)
        )
        total = len(count_result.all())
        
        # Get paginated results
        query = query.order_by(ComparisonSession.created_at.desc())
        query = query.offset(offset).limit(limit)
        query = query.options(selectinload(ComparisonSession.results))
        
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        return sessions, total
    
    async def update_session(
        self,
        db: AsyncSession,
        session_id: int,
        user_id: int,
        **kwargs
    ) -> Optional[ComparisonSession]:
        """Update a comparison session."""
        session = await self.get_session(db, session_id, user_id)
        if not session:
            return None
        
        for key, value in kwargs.items():
            if hasattr(session, key):
                setattr(session, key, value)
        
        await db.commit()
        await db.refresh(session)
        return session
    
    async def delete_session(
        self,
        db: AsyncSession,
        session_id: int,
        user_id: int
    ) -> bool:
        """Delete a comparison session."""
        result = await db.execute(
            delete(ComparisonSession).where(
                ComparisonSession.id == session_id,
                ComparisonSession.user_id == user_id
            )
        )
        await db.commit()
        return result.rowcount > 0
    
    async def rate_result(
        self,
        db: AsyncSession,
        result_id: int,
        user_id: int,
        rating: int,
        is_winner: bool = False
    ) -> Optional[ComparisonResult]:
        """Rate a comparison result."""
        # Verify ownership through session
        result = await db.execute(
            select(ComparisonResult)
            .join(ComparisonSession)
            .where(
                ComparisonResult.id == result_id,
                ComparisonSession.user_id == user_id
            )
        )
        comparison_result = result.scalar_one_or_none()
        
        if not comparison_result:
            return None
        
        comparison_result.user_rating = rating
        
        if is_winner:
            # Clear other winners in the same session
            await db.execute(
                update(ComparisonResult)
                .where(
                    ComparisonResult.session_id == comparison_result.session_id,
                    ComparisonResult.id != result_id
                )
                .values(is_winner=False)
            )
            comparison_result.is_winner = True
        
        await db.commit()
        await db.refresh(comparison_result)
        return comparison_result
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available models for comparison."""
        models = []
        
        # DeepSeek models (always available)
        if settings.DEEPSEEK_API_KEY:
            models.extend([
                {**get_model_info("deepseek-chat"), "id": "deepseek-chat", "available": True},
                {**get_model_info("deepseek-reasoner"), "id": "deepseek-reasoner", "available": True}
            ])
        
        # Anthropic models
        if settings.ANTHROPIC_API_KEY:
            models.extend([
                {**get_model_info("claude-3-5-sonnet-20241022"), "id": "claude-3-5-sonnet-20241022", "available": True},
                {**get_model_info("claude-3-opus-20240229"), "id": "claude-3-opus-20240229", "available": True}
            ])
        
        # Google Gemini models
        if settings.GOOGLE_API_KEY:
            models.extend([
                {**get_model_info("gemini-2.5-flash"), "id": "gemini-2.5-flash", "available": True},
                {**get_model_info("gemini-2.5-flash-lite"), "id": "gemini-2.5-flash-lite", "available": True},
                {**get_model_info("gemini-2.5-pro"), "id": "gemini-2.5-pro", "available": True},
                {**get_model_info("gemini-2.0-flash"), "id": "gemini-2.0-flash", "available": True}
            ])
        
        return models


# Global instance
comparison_service = ComparisonService()
