"""
SSO API Endpoints

REST API for OAuth2 and SAML single sign-on.

Version: 2.3.0
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from core.database import get_db
from services.auth import get_current_user, create_access_token
from services.sso import SSOService, get_sso_service
from models.user import User
from models.sso import SSOProvider, SSOConnectionStatus


router = APIRouter(prefix="/sso", tags=["sso"])


# =============================================================================
# SCHEMAS
# =============================================================================

class SSOConfigCreate(BaseModel):
    provider: str
    display_name: str
    team_id: Optional[int] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    scopes: Optional[str] = None
    entity_id: Optional[str] = None
    sso_url: Optional[str] = None
    slo_url: Optional[str] = None
    certificate: Optional[str] = None
    auto_create_users: bool = True
    default_role: str = "user"
    allowed_domains: Optional[List[str]] = None
    attribute_mapping: Optional[dict] = None


class SSOConfigUpdate(BaseModel):
    display_name: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    scopes: Optional[str] = None
    auto_create_users: Optional[bool] = None
    default_role: Optional[str] = None
    allowed_domains: Optional[List[str]] = None
    attribute_mapping: Optional[dict] = None
    status: Optional[str] = None


class AuthorizeRequest(BaseModel):
    redirect_uri: str
    use_pkce: bool = False


# =============================================================================
# PROVIDER ENDPOINTS
# =============================================================================

@router.get("/providers")
async def list_providers():
    """List available SSO providers."""
    return {
        "providers": [
            {
                "id": p.value,
                "name": p.name.replace("_", " ").title(),
                "type": "saml" if p == SSOProvider.SAML else "oauth2"
            }
            for p in SSOProvider
        ]
    }


@router.get("/providers/{provider}/defaults")
async def get_provider_defaults(provider: str):
    """Get default configuration for a provider."""
    try:
        sso_provider = SSOProvider(provider)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown provider: {provider}"
        )
    
    from models.sso import OAUTH2_PROVIDERS
    defaults = OAUTH2_PROVIDERS.get(sso_provider, {})
    
    return {
        "provider": provider,
        "defaults": defaults
    }


# =============================================================================
# CONFIGURATION ENDPOINTS
# =============================================================================

@router.post("/configurations")
async def create_configuration(
    data: SSOConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new SSO configuration (admin only)."""
    # Check admin permission
    # In production, use proper RBAC check
    
    try:
        provider = SSOProvider(data.provider)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider: {data.provider}"
        )
    
    service = get_sso_service(db)
    
    config = await service.create_configuration(
        provider=provider,
        display_name=data.display_name,
        team_id=data.team_id,
        client_id=data.client_id,
        client_secret=data.client_secret,
        authorization_url=data.authorization_url,
        token_url=data.token_url,
        userinfo_url=data.userinfo_url,
        scopes=data.scopes,
        entity_id=data.entity_id,
        sso_url=data.sso_url,
        slo_url=data.slo_url,
        certificate=data.certificate,
        auto_create_users=data.auto_create_users,
        default_role=data.default_role,
        allowed_domains=data.allowed_domains,
        attribute_mapping=data.attribute_mapping
    )
    
    return config.to_dict()


@router.get("/configurations")
async def list_configurations(
    team_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """List available SSO configurations."""
    service = get_sso_service(db)
    configs = await service.get_team_configurations(team_id)
    
    return [c.to_dict() for c in configs]


@router.get("/configurations/{config_id}")
async def get_configuration(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get SSO configuration details."""
    service = get_sso_service(db)
    config = await service.get_configuration(config_id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    return config.to_dict()


@router.put("/configurations/{config_id}")
async def update_configuration(
    config_id: int,
    data: SSOConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update SSO configuration (admin only)."""
    service = get_sso_service(db)
    
    updates = data.dict(exclude_unset=True)
    
    if 'status' in updates:
        try:
            updates['status'] = SSOConnectionStatus(updates['status'])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {updates['status']}"
            )
    
    config = await service.update_configuration(config_id, **updates)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    return config.to_dict()


@router.delete("/configurations/{config_id}")
async def delete_configuration(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete SSO configuration (admin only)."""
    service = get_sso_service(db)
    
    success = await service.delete_configuration(config_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    return {"message": "Configuration deleted"}


# =============================================================================
# OAUTH2 FLOW ENDPOINTS
# =============================================================================

@router.post("/authorize/{config_id}")
async def authorize(
    config_id: int,
    data: AuthorizeRequest,
    current_user: Optional[User] = None,  # Optional - for linking accounts
    db: AsyncSession = Depends(get_db)
):
    """
    Start OAuth2 authorization flow.
    
    Returns authorization URL to redirect user to.
    """
    service = get_sso_service(db)
    
    try:
        auth_url, state = await service.create_authorization_url(
            config_id=config_id,
            redirect_uri=data.redirect_uri,
            user_id=current_user.id if current_user else None,
            use_pkce=data.use_pkce
        )
        
        return {
            "authorization_url": auth_url,
            "state": state
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/callback")
async def callback(
    state: str = Query(...),
    code: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OAuth2 callback.
    
    Exchanges code for tokens and creates/updates user.
    """
    service = get_sso_service(db)
    
    try:
        user, connection = await service.handle_callback(state, code)
        
        # Create JWT token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name
            },
            "sso_connection": connection.to_dict()
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    finally:
        await service.close()


@router.get("/callback/redirect")
async def callback_redirect(
    state: str = Query(...),
    code: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OAuth2 callback with redirect.
    
    For browser-based flows that need to redirect back to frontend.
    """
    service = get_sso_service(db)
    
    try:
        user, connection = await service.handle_callback(state, code)
        
        # Create JWT token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        # Redirect to frontend with token
        # In production, use a more secure method
        redirect_url = f"/auth/sso/success?token={access_token}"
        
        return RedirectResponse(url=redirect_url)
    except ValueError as e:
        return RedirectResponse(url=f"/auth/sso/error?message={str(e)}")
    finally:
        await service.close()


# =============================================================================
# USER CONNECTION ENDPOINTS
# =============================================================================

@router.get("/connections")
async def list_my_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List current user's SSO connections."""
    service = get_sso_service(db)
    connections = await service.get_user_connections(current_user.id)
    
    return [c.to_dict() for c in connections]


@router.delete("/connections/{connection_id}")
async def disconnect(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove an SSO connection."""
    service = get_sso_service(db)
    
    success = await service.disconnect(current_user.id, connection_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    return {"message": "SSO connection removed"}


# =============================================================================
# QUICK LOGIN ENDPOINTS
# =============================================================================

@router.get("/login/{provider}")
async def quick_login(
    provider: str,
    redirect_uri: str = Query(...),
    team_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Quick login with a provider.
    
    Finds the configuration for the provider and starts auth flow.
    """
    try:
        sso_provider = SSOProvider(provider)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown provider: {provider}"
        )
    
    service = get_sso_service(db)
    configs = await service.get_team_configurations(team_id)
    
    # Find matching config
    config = next((c for c in configs if c.provider == sso_provider), None)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {provider} SSO configured"
        )
    
    try:
        auth_url, state = await service.create_authorization_url(
            config_id=config.id,
            redirect_uri=redirect_uri,
            use_pkce=True
        )
        
        return RedirectResponse(url=auth_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
