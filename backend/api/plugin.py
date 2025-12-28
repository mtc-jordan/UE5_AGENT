"""
UE5 AI Studio - Plugin API Endpoints
=====================================

REST API endpoints for plugin management.

Version: 2.2.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from core.database import get_db
from services.auth import get_current_user
from services.plugin import PluginService
from services.plugin_executor import ExecutionContext
from models.user import User
from models.plugin import PluginCategory, PluginStatus, PluginVisibility

router = APIRouter(prefix="/plugins", tags=["Plugins"])


# =============================================================================
# SCHEMAS
# =============================================================================

class PluginCreateRequest(BaseModel):
    """Request to create a plugin."""
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=10)
    description: Optional[str] = None
    category: Optional[str] = "custom"
    tags: Optional[List[str]] = []
    config_schema: Optional[Dict] = {}
    input_schema: Optional[Dict] = {}
    output_schema: Optional[Dict] = {}
    ai_description: Optional[str] = None
    ai_examples: Optional[List[Dict]] = []
    requires_mcp: bool = False
    requires_workspace: bool = False
    allowed_imports: Optional[List[str]] = []
    timeout_seconds: int = 30


class PluginUpdateRequest(BaseModel):
    """Request to update a plugin."""
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    config_schema: Optional[Dict] = None
    input_schema: Optional[Dict] = None
    output_schema: Optional[Dict] = None
    ai_description: Optional[str] = None
    ai_examples: Optional[List[Dict]] = None
    requires_mcp: Optional[bool] = None
    requires_workspace: Optional[bool] = None
    allowed_imports: Optional[List[str]] = None
    timeout_seconds: Optional[int] = None


class PluginExecuteRequest(BaseModel):
    """Request to execute a plugin."""
    input_data: Optional[Dict[str, Any]] = {}
    chat_id: Optional[int] = None


class PluginInstallRequest(BaseModel):
    """Request to install a plugin."""
    config: Optional[Dict] = {}


class PluginRateRequest(BaseModel):
    """Request to rate a plugin."""
    rating: int = Field(..., ge=1, le=5)


class PluginResponse(BaseModel):
    """Plugin response model."""
    id: int
    name: str
    slug: str
    description: Optional[str]
    version: str
    category: str
    tags: List[str]
    status: str
    visibility: str
    code: str
    entry_function: str
    config_schema: Dict
    input_schema: Dict
    output_schema: Dict
    ai_description: Optional[str]
    requires_mcp: bool
    requires_workspace: bool
    timeout_seconds: int
    execution_count: int
    success_count: int
    error_count: int
    avg_execution_time_ms: int
    rating: float
    rating_count: int
    author_id: int
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime]

    class Config:
        from_attributes = True


class PluginListResponse(BaseModel):
    """Plugin list item response."""
    id: int
    name: str
    slug: str
    description: Optional[str]
    category: str
    tags: List[str]
    status: str
    visibility: str
    execution_count: int
    rating: float
    rating_count: int
    author_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExecutionResponse(BaseModel):
    """Plugin execution response."""
    success: bool
    output: Optional[Any]
    error: Optional[str]
    execution_time_ms: int
    stdout: Optional[str]
    stderr: Optional[str]
    logs: Optional[List[Dict]]


class InstallationResponse(BaseModel):
    """Plugin installation response."""
    id: int
    plugin_id: int
    user_id: int
    config: Dict
    is_enabled: bool
    installed_at: datetime
    last_used_at: Optional[datetime]

    class Config:
        from_attributes = True


class TemplateResponse(BaseModel):
    """Plugin template response."""
    id: int
    name: str
    description: Optional[str]
    category: str
    code: str
    difficulty: str
    estimated_time_minutes: int

    class Config:
        from_attributes = True


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_category_enum(category: str) -> PluginCategory:
    """Convert string to PluginCategory enum."""
    try:
        return PluginCategory(category)
    except ValueError:
        return PluginCategory.CUSTOM


def plugin_to_response(plugin) -> dict:
    """Convert plugin model to response dict."""
    return {
        "id": plugin.id,
        "name": plugin.name,
        "slug": plugin.slug,
        "description": plugin.description,
        "version": plugin.version,
        "category": plugin.category.value,
        "tags": plugin.tags,
        "status": plugin.status.value,
        "visibility": plugin.visibility.value,
        "code": plugin.code,
        "entry_function": plugin.entry_function,
        "config_schema": plugin.config_schema,
        "input_schema": plugin.input_schema,
        "output_schema": plugin.output_schema,
        "ai_description": plugin.ai_description,
        "requires_mcp": plugin.requires_mcp,
        "requires_workspace": plugin.requires_workspace,
        "timeout_seconds": plugin.timeout_seconds,
        "execution_count": plugin.execution_count,
        "success_count": plugin.success_count,
        "error_count": plugin.error_count,
        "avg_execution_time_ms": plugin.avg_execution_time_ms,
        "rating": plugin.rating,
        "rating_count": plugin.rating_count,
        "author_id": plugin.author_id,
        "created_at": plugin.created_at,
        "updated_at": plugin.updated_at,
        "published_at": plugin.published_at
    }


# =============================================================================
# PLUGIN CRUD ENDPOINTS
# =============================================================================

@router.post("", response_model=PluginResponse)
async def create_plugin(
    request: PluginCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new plugin."""
    service = PluginService(db)
    
    try:
        plugin = await service.create_plugin(
            user_id=current_user.id,
            name=request.name,
            code=request.code,
            description=request.description,
            category=get_category_enum(request.category),
            tags=request.tags,
            config_schema=request.config_schema,
            input_schema=request.input_schema,
            output_schema=request.output_schema,
            ai_description=request.ai_description,
            ai_examples=request.ai_examples,
            requires_mcp=request.requires_mcp,
            requires_workspace=request.requires_workspace,
            allowed_imports=request.allowed_imports,
            timeout_seconds=request.timeout_seconds
        )
        return plugin_to_response(plugin)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=List[PluginListResponse])
async def list_my_plugins(
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List current user's plugins."""
    service = PluginService(db)
    
    cat = get_category_enum(category) if category else None
    stat = PluginStatus(status_filter) if status_filter else None
    
    plugins = await service.list_user_plugins(
        user_id=current_user.id,
        category=cat,
        status=stat,
        search=search,
        limit=limit,
        offset=offset
    )
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "description": p.description,
            "category": p.category.value,
            "tags": p.tags,
            "status": p.status.value,
            "visibility": p.visibility.value,
            "execution_count": p.execution_count,
            "rating": p.rating,
            "rating_count": p.rating_count,
            "author_id": p.author_id,
            "created_at": p.created_at
        }
        for p in plugins
    ]


@router.get("/marketplace", response_model=List[PluginListResponse])
async def list_marketplace_plugins(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("popular", regex="^(popular|recent|rating)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List public plugins in the marketplace."""
    service = PluginService(db)
    
    cat = get_category_enum(category) if category else None
    
    plugins = await service.list_public_plugins(
        category=cat,
        search=search,
        sort_by=sort_by,
        limit=limit,
        offset=offset
    )
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "description": p.description,
            "category": p.category.value,
            "tags": p.tags,
            "status": p.status.value,
            "visibility": p.visibility.value,
            "execution_count": p.execution_count,
            "rating": p.rating,
            "rating_count": p.rating_count,
            "author_id": p.author_id,
            "created_at": p.created_at
        }
        for p in plugins
    ]


@router.get("/{plugin_id}", response_model=PluginResponse)
async def get_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a plugin by ID."""
    service = PluginService(db)
    
    plugin = await service.get_plugin(plugin_id, current_user.id)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found"
        )
    
    return plugin_to_response(plugin)


@router.put("/{plugin_id}", response_model=PluginResponse)
async def update_plugin(
    plugin_id: int,
    request: PluginUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a plugin."""
    service = PluginService(db)
    
    updates = request.dict(exclude_unset=True)
    
    # Convert category string to enum
    if 'category' in updates:
        updates['category'] = get_category_enum(updates['category'])
    
    try:
        plugin = await service.update_plugin(
            plugin_id=plugin_id,
            user_id=current_user.id,
            **updates
        )
        
        if not plugin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Plugin not found or access denied"
            )
        
        return plugin_to_response(plugin)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{plugin_id}")
async def delete_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a plugin."""
    service = PluginService(db)
    
    success = await service.delete_plugin(plugin_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found or access denied"
        )
    
    return {"message": "Plugin deleted"}


# =============================================================================
# PUBLISHING ENDPOINTS
# =============================================================================

@router.post("/{plugin_id}/publish", response_model=PluginResponse)
async def publish_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Publish a plugin to the marketplace."""
    service = PluginService(db)
    
    plugin = await service.publish_plugin(plugin_id, current_user.id)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found or access denied"
        )
    
    return plugin_to_response(plugin)


@router.post("/{plugin_id}/unpublish", response_model=PluginResponse)
async def unpublish_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unpublish a plugin from the marketplace."""
    service = PluginService(db)
    
    plugin = await service.unpublish_plugin(plugin_id, current_user.id)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found or access denied"
        )
    
    return plugin_to_response(plugin)


@router.post("/{plugin_id}/rate")
async def rate_plugin(
    plugin_id: int,
    request: PluginRateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rate a plugin."""
    service = PluginService(db)
    
    try:
        plugin = await service.rate_plugin(
            plugin_id=plugin_id,
            user_id=current_user.id,
            rating=request.rating
        )
        
        if not plugin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Plugin not found"
            )
        
        return {"message": "Rating submitted", "new_rating": plugin.rating}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# =============================================================================
# INSTALLATION ENDPOINTS
# =============================================================================

@router.post("/{plugin_id}/install", response_model=InstallationResponse)
async def install_plugin(
    plugin_id: int,
    request: PluginInstallRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Install a plugin."""
    service = PluginService(db)
    
    config = request.config if request else {}
    
    installation = await service.install_plugin(
        plugin_id=plugin_id,
        user_id=current_user.id,
        config=config
    )
    
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found or access denied"
        )
    
    return installation


@router.delete("/{plugin_id}/install")
async def uninstall_plugin(
    plugin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Uninstall a plugin."""
    service = PluginService(db)
    
    success = await service.uninstall_plugin(plugin_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not installed"
        )
    
    return {"message": "Plugin uninstalled"}


@router.get("/installed/list", response_model=List[InstallationResponse])
async def list_installed_plugins(
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List installed plugins."""
    service = PluginService(db)
    
    installations = await service.get_installed_plugins(
        user_id=current_user.id,
        enabled_only=enabled_only
    )
    
    return installations


@router.patch("/{plugin_id}/toggle")
async def toggle_plugin(
    plugin_id: int,
    enabled: bool,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Enable or disable an installed plugin."""
    service = PluginService(db)
    
    installation = await service.toggle_plugin(
        plugin_id=plugin_id,
        user_id=current_user.id,
        enabled=enabled
    )
    
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not installed"
        )
    
    return {"message": f"Plugin {'enabled' if enabled else 'disabled'}"}


# =============================================================================
# EXECUTION ENDPOINTS
# =============================================================================

@router.post("/{plugin_id}/execute", response_model=ExecutionResponse)
async def execute_plugin(
    plugin_id: int,
    request: PluginExecuteRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a plugin."""
    service = PluginService(db)
    
    input_data = request.input_data if request else {}
    chat_id = request.chat_id if request else None
    
    # Create execution context
    context = ExecutionContext(
        user_id=current_user.id
    )
    
    result = await service.execute_plugin(
        plugin_id=plugin_id,
        user_id=current_user.id,
        input_data=input_data,
        context=context,
        chat_id=chat_id,
        triggered_by="user"
    )
    
    return ExecutionResponse(
        success=result.get("success", False),
        output=result.get("output"),
        error=result.get("error"),
        execution_time_ms=result.get("execution_time_ms", 0),
        stdout=result.get("stdout", ""),
        stderr=result.get("stderr", ""),
        logs=result.get("logs", [])
    )


@router.get("/{plugin_id}/executions")
async def get_execution_history(
    plugin_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get execution history for a plugin."""
    service = PluginService(db)
    
    executions = await service.get_execution_history(
        user_id=current_user.id,
        plugin_id=plugin_id,
        limit=limit,
        offset=offset
    )
    
    return [
        {
            "id": e.id,
            "plugin_id": e.plugin_id,
            "input_data": e.input_data,
            "output_data": e.output_data,
            "error_message": e.error_message,
            "success": e.success,
            "execution_time_ms": e.execution_time_ms,
            "triggered_by": e.triggered_by,
            "started_at": e.started_at,
            "completed_at": e.completed_at
        }
        for e in executions
    ]


# =============================================================================
# TEMPLATE ENDPOINTS
# =============================================================================

@router.get("/templates/list", response_model=List[TemplateResponse])
async def list_templates(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List plugin templates."""
    service = PluginService(db)
    
    cat = get_category_enum(category) if category else None
    
    templates = await service.get_templates(category=cat)
    
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "category": t.category.value,
            "code": t.code,
            "difficulty": t.difficulty,
            "estimated_time_minutes": t.estimated_time_minutes
        }
        for t in templates
    ]


@router.post("/templates/{template_id}/create", response_model=PluginResponse)
async def create_from_template(
    template_id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a plugin from a template."""
    service = PluginService(db)
    
    try:
        plugin = await service.create_from_template(
            user_id=current_user.id,
            template_id=template_id,
            name=name
        )
        return plugin_to_response(plugin)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# =============================================================================
# AI INTEGRATION ENDPOINTS
# =============================================================================

@router.get("/ai/available")
async def get_ai_available_plugins(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get plugins available for AI to use."""
    service = PluginService(db)
    
    plugins = await service.get_ai_available_plugins(current_user.id)
    
    return {
        "plugins": plugins,
        "formatted": service.format_plugins_for_ai(plugins)
    }


@router.post("/ai/execute/{plugin_id}")
async def ai_execute_plugin(
    plugin_id: int,
    input_data: Dict[str, Any],
    chat_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a plugin triggered by AI."""
    service = PluginService(db)
    
    context = ExecutionContext(
        user_id=current_user.id
    )
    
    result = await service.execute_plugin(
        plugin_id=plugin_id,
        user_id=current_user.id,
        input_data=input_data,
        context=context,
        chat_id=chat_id,
        triggered_by="ai"
    )
    
    return result


# =============================================================================
# VALIDATION ENDPOINT
# =============================================================================

@router.post("/validate")
async def validate_plugin_code(
    code: str,
    allowed_imports: Optional[List[str]] = None,
    current_user: User = Depends(get_current_user)
):
    """Validate plugin code without creating."""
    from services.plugin_executor import CodeValidator
    
    is_valid, error = CodeValidator.validate(code, allowed_imports)
    
    return {
        "valid": is_valid,
        "error": error if not is_valid else None
    }
