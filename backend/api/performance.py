"""
Performance Analyzer API Endpoints

Provides endpoints for:
- Performance analysis and metrics
- Bottleneck detection
- Optimization recommendations
- Auto-optimization actions
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from services.performance_analyzer import performance_analyzer_service
from services.agent_relay import agent_relay
from api.auth import get_current_user

router = APIRouter(prefix="/api/performance", tags=["performance"])


class AnalyzeRequest(BaseModel):
    model: str = "deepseek-chat"


class OptimizeRequest(BaseModel):
    optimization_id: str
    options: Optional[Dict[str, Any]] = None


class PresetRequest(BaseModel):
    preset: str  # mobile, console, pc_high, pc_ultra


@router.post("/analyze")
async def analyze_performance(
    request: AnalyzeRequest,
    user: dict = Depends(get_current_user)
):
    """
    Run comprehensive performance analysis on the current scene
    """
    user_id = user.get("sub", "default")
    
    # Get scene data from UE5
    try:
        # Get actors
        actors_result = await agent_relay.execute_tool(
            user_id=user_id,
            tool_name="get_all_actors",
            arguments={}
        )
        
        # Get scene stats if available
        stats_result = await agent_relay.execute_tool(
            user_id=user_id,
            tool_name="execute_console_command",
            arguments={"command": "stat unit"}
        )
        
        scene_data = {
            "actors": actors_result.get("result", []) if isinstance(actors_result, dict) else [],
            "stats": stats_result.get("result", "") if isinstance(stats_result, dict) else ""
        }
        
        # Run analysis
        analysis = await performance_analyzer_service.analyze_performance(
            scene_data=scene_data,
            model=request.model
        )
        
        return analysis
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics")
async def get_metrics(user: dict = Depends(get_current_user)):
    """
    Get current performance metrics
    """
    return performance_analyzer_service.get_current_metrics()


@router.get("/bottlenecks")
async def get_bottlenecks(user: dict = Depends(get_current_user)):
    """
    Get detected performance bottlenecks
    """
    return {
        "bottlenecks": [
            {
                "id": b.id,
                "category": b.category.value,
                "severity": b.severity.value,
                "title": b.title,
                "description": b.description,
                "impact": b.impact,
                "affected_actors": b.affected_actors
            }
            for b in performance_analyzer_service.bottlenecks
        ]
    }


@router.get("/optimizations")
async def get_optimizations(user: dict = Depends(get_current_user)):
    """
    Get available optimization recommendations
    """
    return {
        "optimizations": [
            {
                "id": o.id,
                "title": o.title,
                "description": o.description,
                "category": o.category,
                "estimated_improvement": o.estimated_improvement,
                "risk_level": o.risk_level,
                "auto_applicable": o.auto_applicable,
                "steps": o.steps
            }
            for o in performance_analyzer_service.optimizations
        ]
    }


@router.post("/optimize")
async def apply_optimization(
    request: OptimizeRequest,
    user: dict = Depends(get_current_user)
):
    """
    Apply a specific optimization
    """
    user_id = user.get("sub", "default")
    
    result = await performance_analyzer_service.apply_optimization(
        optimization_id=request.optimization_id,
        execute_tool=lambda name, args: agent_relay.execute_tool(user_id, name, args)
    )
    
    return result


@router.post("/apply-preset")
async def apply_preset(
    request: PresetRequest,
    user: dict = Depends(get_current_user)
):
    """
    Apply a performance preset (mobile, console, pc_high, pc_ultra)
    """
    user_id = user.get("sub", "default")
    
    result = await performance_analyzer_service.apply_preset(
        preset=request.preset,
        execute_tool=lambda name, args: agent_relay.execute_tool(user_id, name, args)
    )
    
    return result


@router.get("/presets")
async def get_presets(user: dict = Depends(get_current_user)):
    """
    Get available performance presets
    """
    return {
        "presets": [
            {
                "id": "mobile",
                "name": "Mobile",
                "description": "Optimized for mobile devices with limited GPU/CPU",
                "target_fps": 30,
                "settings": {
                    "shadow_quality": "low",
                    "texture_quality": "medium",
                    "effects_quality": "low",
                    "view_distance": "medium"
                }
            },
            {
                "id": "console",
                "name": "Console",
                "description": "Balanced settings for console platforms",
                "target_fps": 60,
                "settings": {
                    "shadow_quality": "medium",
                    "texture_quality": "high",
                    "effects_quality": "medium",
                    "view_distance": "high"
                }
            },
            {
                "id": "pc_high",
                "name": "PC High",
                "description": "High quality settings for gaming PCs",
                "target_fps": 60,
                "settings": {
                    "shadow_quality": "high",
                    "texture_quality": "high",
                    "effects_quality": "high",
                    "view_distance": "epic"
                }
            },
            {
                "id": "pc_ultra",
                "name": "PC Ultra",
                "description": "Maximum quality for high-end PCs",
                "target_fps": 30,
                "settings": {
                    "shadow_quality": "epic",
                    "texture_quality": "epic",
                    "effects_quality": "epic",
                    "view_distance": "epic",
                    "ray_tracing": True
                }
            }
        ]
    }


@router.get("/history")
async def get_analysis_history(
    limit: int = Query(default=10, le=50),
    user: dict = Depends(get_current_user)
):
    """
    Get performance analysis history
    """
    return {
        "history": performance_analyzer_service.analysis_history[-limit:]
    }


@router.get("/score")
async def get_performance_score(user: dict = Depends(get_current_user)):
    """
    Get current performance score summary
    """
    metrics = performance_analyzer_service.get_current_metrics()
    bottlenecks = performance_analyzer_service.bottlenecks
    
    # Calculate score
    base_score = 100
    
    # Deduct for bottlenecks
    for b in bottlenecks:
        if b.severity.value == "critical":
            base_score -= 20
        elif b.severity.value == "high":
            base_score -= 10
        elif b.severity.value == "medium":
            base_score -= 5
        elif b.severity.value == "low":
            base_score -= 2
    
    score = max(0, min(100, base_score))
    
    return {
        "score": score,
        "grade": "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F",
        "bottleneck_count": len(bottlenecks),
        "optimization_count": len(performance_analyzer_service.optimizations),
        "metrics": metrics
    }
