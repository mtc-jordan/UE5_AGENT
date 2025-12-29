"""
Advanced AI Features API for UE5 AI Agent
Handles command chains, macros, suggestions, and debugging
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

router = APIRouter(prefix="/advanced-ai", tags=["advanced-ai"])

# ==================== MODELS ====================

class CommandStep(BaseModel):
    id: str
    type: str  # action, condition, loop, delay, variable
    command: str
    parameters: Dict[str, Any] = {}
    description: Optional[str] = None

class CommandChain(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    steps: List[CommandStep]
    tags: List[str] = []

class Macro(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    shortcut: Optional[str] = None
    commands: List[str]

class DebugScanRequest(BaseModel):
    scan_type: str = "full"  # full, performance, errors, warnings
    include_suggestions: bool = True

class SuggestionRequest(BaseModel):
    context: str
    recent_commands: List[str] = []
    current_selection: Optional[str] = None

class PatternData(BaseModel):
    command: str
    context: str
    timestamp: str

# ==================== IN-MEMORY STORAGE ====================

chains_db: Dict[str, dict] = {}
macros_db: Dict[str, dict] = {}
patterns_db: List[dict] = []
suggestions_cache: List[dict] = []

# ==================== COMMAND CHAINS ====================

@router.get("/chains")
async def get_chains():
    """Get all command chains"""
    return {
        "chains": list(chains_db.values()),
        "total": len(chains_db)
    }

@router.post("/chains")
async def create_chain(chain: CommandChain):
    """Create a new command chain"""
    chain_id = f"chain_{datetime.now().timestamp()}"
    chain_data = {
        "id": chain_id,
        "name": chain.name,
        "description": chain.description,
        "steps": [step.dict() for step in chain.steps],
        "tags": chain.tags,
        "created_at": datetime.now().isoformat(),
        "run_count": 0,
        "is_favorite": False
    }
    chains_db[chain_id] = chain_data
    return chain_data

@router.get("/chains/{chain_id}")
async def get_chain(chain_id: str):
    """Get a specific command chain"""
    if chain_id not in chains_db:
        raise HTTPException(status_code=404, detail="Chain not found")
    return chains_db[chain_id]

@router.post("/chains/{chain_id}/run")
async def run_chain(chain_id: str):
    """Execute a command chain"""
    if chain_id not in chains_db:
        raise HTTPException(status_code=404, detail="Chain not found")
    
    chain = chains_db[chain_id]
    results = []
    
    for step in chain["steps"]:
        # Simulate step execution
        result = {
            "step_id": step["id"],
            "command": step["command"],
            "status": "completed",
            "duration_ms": 250,
            "result": f"Executed: {step['command']}"
        }
        results.append(result)
    
    # Update run count
    chain["run_count"] += 1
    chain["last_run"] = datetime.now().isoformat()
    
    return {
        "chain_id": chain_id,
        "status": "completed",
        "steps_executed": len(results),
        "results": results
    }

@router.delete("/chains/{chain_id}")
async def delete_chain(chain_id: str):
    """Delete a command chain"""
    if chain_id not in chains_db:
        raise HTTPException(status_code=404, detail="Chain not found")
    del chains_db[chain_id]
    return {"status": "deleted", "chain_id": chain_id}

@router.post("/chains/{chain_id}/favorite")
async def toggle_chain_favorite(chain_id: str):
    """Toggle favorite status of a chain"""
    if chain_id not in chains_db:
        raise HTTPException(status_code=404, detail="Chain not found")
    chains_db[chain_id]["is_favorite"] = not chains_db[chain_id].get("is_favorite", False)
    return {"is_favorite": chains_db[chain_id]["is_favorite"]}

# ==================== MACROS ====================

@router.get("/macros")
async def get_macros():
    """Get all macros"""
    return {
        "macros": list(macros_db.values()),
        "total": len(macros_db)
    }

@router.post("/macros")
async def create_macro(macro: Macro):
    """Create a new macro"""
    macro_id = f"macro_{datetime.now().timestamp()}"
    macro_data = {
        "id": macro_id,
        "name": macro.name,
        "description": macro.description,
        "shortcut": macro.shortcut,
        "commands": macro.commands,
        "created_at": datetime.now().isoformat(),
        "usage_count": 0,
        "is_favorite": False
    }
    macros_db[macro_id] = macro_data
    return macro_data

@router.post("/macros/{macro_id}/run")
async def run_macro(macro_id: str):
    """Execute a macro"""
    if macro_id not in macros_db:
        raise HTTPException(status_code=404, detail="Macro not found")
    
    macro = macros_db[macro_id]
    results = []
    
    for cmd in macro["commands"]:
        result = {
            "command": cmd,
            "status": "completed",
            "result": f"Executed: {cmd}"
        }
        results.append(result)
    
    # Update usage count
    macro["usage_count"] += 1
    macro["last_used"] = datetime.now().isoformat()
    
    return {
        "macro_id": macro_id,
        "status": "completed",
        "commands_executed": len(results),
        "results": results
    }

@router.delete("/macros/{macro_id}")
async def delete_macro(macro_id: str):
    """Delete a macro"""
    if macro_id not in macros_db:
        raise HTTPException(status_code=404, detail="Macro not found")
    del macros_db[macro_id]
    return {"status": "deleted", "macro_id": macro_id}

# ==================== SMART SUGGESTIONS ====================

@router.post("/suggestions")
async def get_suggestions(request: SuggestionRequest):
    """Get context-aware command suggestions"""
    
    # Generate suggestions based on context
    suggestions = []
    
    # Context-based suggestions
    context_suggestions = {
        "lighting": [
            {"command": "Add point light above selection", "confidence": 92, "category": "lighting"},
            {"command": "Setup three-point lighting", "confidence": 85, "category": "lighting"},
            {"command": "Adjust light intensity", "confidence": 78, "category": "lighting"},
        ],
        "material": [
            {"command": "Apply PBR material", "confidence": 90, "category": "material"},
            {"command": "Create material instance", "confidence": 82, "category": "material"},
            {"command": "Generate texture maps", "confidence": 75, "category": "material"},
        ],
        "scene": [
            {"command": "Duplicate and arrange in grid", "confidence": 88, "category": "scene"},
            {"command": "Group selected actors", "confidence": 80, "category": "scene"},
            {"command": "Align to ground", "confidence": 76, "category": "scene"},
        ],
        "animation": [
            {"command": "Play animation preview", "confidence": 91, "category": "animation"},
            {"command": "Create animation montage", "confidence": 83, "category": "animation"},
            {"command": "Retarget animation", "confidence": 77, "category": "animation"},
        ],
    }
    
    # Get suggestions for the context
    if request.context in context_suggestions:
        suggestions.extend(context_suggestions[request.context])
    
    # Add general suggestions
    general_suggestions = [
        {"command": "Save current level", "confidence": 95, "category": "general"},
        {"command": "Take viewport screenshot", "confidence": 85, "category": "general"},
        {"command": "Run performance analysis", "confidence": 78, "category": "performance"},
    ]
    suggestions.extend(general_suggestions)
    
    # Add pattern-based suggestions
    for pattern in patterns_db[-10:]:  # Last 10 patterns
        if pattern["context"] == request.context:
            suggestions.append({
                "command": pattern["command"],
                "confidence": 70,
                "category": "learned",
                "source": "user_pattern"
            })
    
    # Sort by confidence and deduplicate
    seen = set()
    unique_suggestions = []
    for s in sorted(suggestions, key=lambda x: x["confidence"], reverse=True):
        if s["command"] not in seen:
            seen.add(s["command"])
            unique_suggestions.append(s)
    
    return {
        "suggestions": unique_suggestions[:10],
        "context": request.context,
        "total": len(unique_suggestions)
    }

@router.post("/patterns")
async def record_pattern(pattern: PatternData):
    """Record a user command pattern for learning"""
    pattern_data = {
        "command": pattern.command,
        "context": pattern.context,
        "timestamp": pattern.timestamp,
        "recorded_at": datetime.now().isoformat()
    }
    patterns_db.append(pattern_data)
    
    # Keep only last 1000 patterns
    if len(patterns_db) > 1000:
        patterns_db.pop(0)
    
    return {"status": "recorded", "total_patterns": len(patterns_db)}

@router.get("/patterns/stats")
async def get_pattern_stats():
    """Get statistics about learned patterns"""
    if not patterns_db:
        return {"total": 0, "contexts": {}, "top_commands": []}
    
    # Count by context
    contexts = {}
    commands = {}
    for p in patterns_db:
        contexts[p["context"]] = contexts.get(p["context"], 0) + 1
        commands[p["command"]] = commands.get(p["command"], 0) + 1
    
    # Top commands
    top_commands = sorted(commands.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "total": len(patterns_db),
        "contexts": contexts,
        "top_commands": [{"command": c, "count": n} for c, n in top_commands]
    }

# ==================== AI DEBUGGING ====================

@router.post("/debug/scan")
async def scan_for_issues(request: DebugScanRequest):
    """Scan the scene for issues and optimization opportunities"""
    
    issues = []
    
    # Simulated issues based on scan type
    if request.scan_type in ["full", "performance"]:
        issues.extend([
            {
                "id": "perf_1",
                "type": "performance",
                "title": "High Draw Call Count",
                "description": "Scene has 3,500+ draw calls which may impact performance",
                "location": "Level: MainLevel",
                "suggestion": "Consider merging static meshes or using instancing",
                "auto_fix": True,
                "severity": "high"
            },
            {
                "id": "perf_2",
                "type": "performance",
                "title": "Large Texture Memory Usage",
                "description": "Texture memory usage exceeds 2GB",
                "location": "Various textures",
                "suggestion": "Compress textures or reduce resolution for distant objects",
                "auto_fix": True,
                "severity": "medium"
            }
        ])
    
    if request.scan_type in ["full", "errors"]:
        issues.extend([
            {
                "id": "err_1",
                "type": "error",
                "title": "Broken Material Reference",
                "description": "Material M_OldWood references missing texture",
                "location": "Material: M_OldWood",
                "suggestion": "Reassign texture or use fallback",
                "auto_fix": False,
                "severity": "high"
            }
        ])
    
    if request.scan_type in ["full", "warnings"]:
        issues.extend([
            {
                "id": "warn_1",
                "type": "warning",
                "title": "Missing Collision",
                "description": "12 meshes are missing collision data",
                "location": "Folder: /Props/",
                "suggestion": "Generate simple collision for these meshes",
                "auto_fix": True,
                "severity": "medium"
            }
        ])
    
    if request.include_suggestions:
        issues.extend([
            {
                "id": "sug_1",
                "type": "suggestion",
                "title": "Texture Optimization",
                "description": "8 textures could be compressed without quality loss",
                "location": "Various textures",
                "suggestion": "Apply BC7 compression to these textures",
                "auto_fix": True,
                "severity": "low"
            }
        ])
    
    return {
        "scan_type": request.scan_type,
        "issues": issues,
        "summary": {
            "errors": len([i for i in issues if i["type"] == "error"]),
            "warnings": len([i for i in issues if i["type"] == "warning"]),
            "performance": len([i for i in issues if i["type"] == "performance"]),
            "suggestions": len([i for i in issues if i["type"] == "suggestion"])
        },
        "scanned_at": datetime.now().isoformat()
    }

@router.post("/debug/fix/{issue_id}")
async def apply_fix(issue_id: str):
    """Apply an automatic fix for an issue"""
    
    # Simulate fix application
    fix_results = {
        "perf_1": {"action": "Merged 45 static meshes", "draw_calls_reduced": 1200},
        "perf_2": {"action": "Compressed 12 textures", "memory_saved_mb": 450},
        "warn_1": {"action": "Generated collision for 12 meshes", "meshes_fixed": 12},
        "sug_1": {"action": "Applied BC7 compression to 8 textures", "quality_preserved": True}
    }
    
    if issue_id not in fix_results:
        raise HTTPException(status_code=404, detail="Issue not found or cannot be auto-fixed")
    
    return {
        "issue_id": issue_id,
        "status": "fixed",
        "result": fix_results[issue_id],
        "fixed_at": datetime.now().isoformat()
    }

@router.get("/debug/health")
async def get_scene_health():
    """Get overall scene health score"""
    
    # Simulated health metrics
    return {
        "overall_score": 72,
        "categories": {
            "performance": {"score": 65, "issues": 3},
            "quality": {"score": 85, "issues": 1},
            "optimization": {"score": 70, "issues": 2},
            "best_practices": {"score": 78, "issues": 4}
        },
        "recommendations": [
            "Consider enabling LOD for distant meshes",
            "Review material complexity for mobile targets",
            "Enable texture streaming for large textures"
        ],
        "last_scan": datetime.now().isoformat()
    }
