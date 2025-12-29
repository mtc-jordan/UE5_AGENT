"""
Asset Manager API Endpoints

Provides endpoints for:
- Asset scanning and analysis
- Natural language search
- Duplicate detection
- Batch operations
- Organization suggestions
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from services.asset_manager import asset_manager_service
from services.agent_relay import agent_relay
from api.auth import get_current_user

router = APIRouter(prefix="/api/assets", tags=["assets"])


class ScanRequest(BaseModel):
    model: str = "deepseek-chat"


class SearchRequest(BaseModel):
    query: str
    filters: Optional[Dict[str, Any]] = None
    model: str = "deepseek-chat"


class BatchRequest(BaseModel):
    operation: str  # delete, move, rename
    asset_paths: List[str]
    options: Optional[Dict[str, Any]] = None


@router.post("/scan")
async def scan_assets(
    request: ScanRequest = ScanRequest(),
    user: dict = Depends(get_current_user)
):
    """
    Scan and analyze all project assets
    """
    user_id = user.get("sub", "default")
    
    try:
        # Get asset list from UE5
        result = await agent_relay.execute_tool(
            user_id=user_id,
            tool_name="get_all_actors",
            arguments={}
        )
        
        # Parse actors as assets (simplified - in real implementation would use asset registry)
        actors = result.get("result", []) if isinstance(result, dict) else []
        
        # Convert actors to asset format
        asset_list = []
        for actor in actors:
            if isinstance(actor, dict):
                asset_list.append({
                    "name": actor.get("name", "Unknown"),
                    "path": actor.get("path", f"/Game/Actors/{actor.get('name', 'Unknown')}"),
                    "size_mb": 0.5,  # Placeholder
                    "dependencies": [],
                    "referencers": [],
                    "metadata": actor
                })
            elif isinstance(actor, str):
                asset_list.append({
                    "name": actor,
                    "path": f"/Game/Actors/{actor}",
                    "size_mb": 0.5,
                    "dependencies": [],
                    "referencers": []
                })
        
        # Run analysis
        analysis = await asset_manager_service.scan_assets(
            asset_list=asset_list,
            model=request.model
        )
        
        # Add assets to response
        analysis["assets"] = asset_manager_service.get_all_assets()
        
        return analysis
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_assets(
    request: SearchRequest,
    user: dict = Depends(get_current_user)
):
    """
    Search assets using natural language
    """
    try:
        results = await asset_manager_service.search_assets(
            query=request.query,
            filters=request.filters,
            model=request.model
        )
        
        return {
            "query": request.query,
            "results": [asset_manager_service.search_result_to_dict(r) for r in results],
            "total": len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_assets(
    type_filter: Optional[str] = Query(default=None),
    health_filter: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    user: dict = Depends(get_current_user)
):
    """
    List all scanned assets with optional filters
    """
    assets = asset_manager_service.get_all_assets()
    
    # Apply filters
    if type_filter:
        assets = [a for a in assets if a["type"] == type_filter]
    if health_filter:
        assets = [a for a in assets if a["health"] == health_filter]
    
    return {
        "assets": assets[:limit],
        "total": len(assets)
    }


@router.get("/issues")
async def get_issues(
    severity: Optional[str] = Query(default=None),
    user: dict = Depends(get_current_user)
):
    """
    Get detected asset issues
    """
    issues = asset_manager_service.issues
    
    if severity:
        issues = [i for i in issues if i.severity.value == severity]
    
    return {
        "issues": [asset_manager_service._issue_to_dict(i) for i in issues],
        "total": len(issues),
        "auto_fixable": len([i for i in issues if i.auto_fix_available])
    }


@router.get("/duplicates")
async def get_duplicates(user: dict = Depends(get_current_user)):
    """
    Get duplicate asset groups
    """
    return {
        "duplicate_groups": [
            asset_manager_service._duplicate_group_to_dict(d)
            for d in asset_manager_service.duplicate_groups
        ],
        "total_groups": len(asset_manager_service.duplicate_groups),
        "potential_savings_mb": sum(d.potential_savings_mb for d in asset_manager_service.duplicate_groups)
    }


@router.get("/suggestions")
async def get_organization_suggestions(user: dict = Depends(get_current_user)):
    """
    Get asset organization suggestions
    """
    return {
        "suggestions": [
            asset_manager_service._suggestion_to_dict(s)
            for s in asset_manager_service.organization_suggestions
        ],
        "total": len(asset_manager_service.organization_suggestions)
    }


@router.post("/fix/{issue_id}")
async def fix_issue(
    issue_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Apply auto-fix for an asset issue
    """
    result = await asset_manager_service.auto_fix_issue(issue_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Fix failed"))
    
    return result


@router.post("/batch")
async def batch_operation(
    request: BatchRequest,
    user: dict = Depends(get_current_user)
):
    """
    Perform batch operation on multiple assets
    """
    user_id = user.get("sub", "default")
    
    try:
        result = await asset_manager_service.batch_operation(
            operation=request.operation,
            asset_paths=request.asset_paths,
            options=request.options
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_statistics(user: dict = Depends(get_current_user)):
    """
    Get asset statistics
    """
    if not asset_manager_service.assets:
        return {
            "total_assets": 0,
            "by_type": [],
            "total_size_mb": 0,
            "health_summary": {"healthy": 0, "warning": 0, "error": 0, "orphaned": 0}
        }
    
    stats = asset_manager_service._calculate_statistics()
    health = asset_manager_service._get_health_summary()
    
    return {
        "total_assets": len(asset_manager_service.assets),
        **stats,
        "health_summary": health
    }


@router.get("/asset/{asset_path:path}")
async def get_asset(
    asset_path: str,
    user: dict = Depends(get_current_user)
):
    """
    Get details for a specific asset
    """
    asset = asset_manager_service.get_asset(f"/{asset_path}")
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return asset_manager_service._asset_to_dict(asset)


@router.get("/types")
async def get_asset_types(user: dict = Depends(get_current_user)):
    """
    Get list of asset types with counts
    """
    type_counts: Dict[str, int] = {}
    
    for asset in asset_manager_service.assets.values():
        type_name = asset.type.value
        type_counts[type_name] = type_counts.get(type_name, 0) + 1
    
    return {
        "types": [
            {"type": t, "count": c}
            for t, c in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
        ]
    }


@router.get("/folders")
async def get_folder_structure(user: dict = Depends(get_current_user)):
    """
    Get folder structure with asset counts
    """
    folder_counts: Dict[str, int] = {}
    
    for asset in asset_manager_service.assets.values():
        folder = "/".join(asset.path.split("/")[:-1])
        folder_counts[folder] = folder_counts.get(folder, 0) + 1
    
    return {
        "folders": [
            {"path": f, "asset_count": c}
            for f, c in sorted(folder_counts.items())
        ]
    }
