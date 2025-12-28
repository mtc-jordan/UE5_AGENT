"""
SSO Service

Handles OAuth2 and SAML single sign-on authentication flows.

Version: 2.3.0
"""

from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlencode, parse_qs
import hashlib
import base64
import secrets
import json
import httpx

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.sso import (
    SSOConfiguration, SSOConnection, SSOState, SAMLAssertion,
    SSOProvider, SSOConnectionStatus, OAUTH2_PROVIDERS
)
from models.user import User
from core.config import settings


class SSOService:
    """Service for SSO authentication operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._http_client = None
    
    @property
    def http_client(self) -> httpx.AsyncClient:
        """Get HTTP client for OAuth2 requests."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client
    
    async def close(self):
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
    
    # =========================================================================
    # CONFIGURATION MANAGEMENT
    # =========================================================================
    
    async def create_configuration(
        self,
        provider: SSOProvider,
        display_name: str,
        team_id: Optional[int] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        **kwargs
    ) -> SSOConfiguration:
        """Create a new SSO configuration."""
        # Get provider defaults
        provider_defaults = OAUTH2_PROVIDERS.get(provider, {})
        
        config = SSOConfiguration(
            team_id=team_id,
            provider=provider,
            display_name=display_name,
            client_id=client_id,
            client_secret_encrypted=self._encrypt_secret(client_secret) if client_secret else None,
            authorization_url=kwargs.get('authorization_url', provider_defaults.get('authorization_url')),
            token_url=kwargs.get('token_url', provider_defaults.get('token_url')),
            userinfo_url=kwargs.get('userinfo_url', provider_defaults.get('userinfo_url')),
            scopes=kwargs.get('scopes', provider_defaults.get('scopes', 'openid email profile')),
            entity_id=kwargs.get('entity_id'),
            sso_url=kwargs.get('sso_url'),
            slo_url=kwargs.get('slo_url'),
            certificate=kwargs.get('certificate'),
            auto_create_users=kwargs.get('auto_create_users', True),
            default_role=kwargs.get('default_role', 'user'),
            allowed_domains=','.join(kwargs.get('allowed_domains', [])) if kwargs.get('allowed_domains') else None,
            status=SSOConnectionStatus.ACTIVE if client_id else SSOConnectionStatus.PENDING
        )
        
        # Set attribute mapping
        mapping = kwargs.get('attribute_mapping', provider_defaults.get('attribute_mapping', {}))
        config.set_attribute_mapping(mapping)
        
        self.db.add(config)
        await self.db.commit()
        await self.db.refresh(config)
        
        return config
    
    async def get_configuration(self, config_id: int) -> Optional[SSOConfiguration]:
        """Get SSO configuration by ID."""
        result = await self.db.execute(
            select(SSOConfiguration).where(SSOConfiguration.id == config_id)
        )
        return result.scalar_one_or_none()
    
    async def get_team_configurations(self, team_id: Optional[int] = None) -> list:
        """Get SSO configurations for a team (or global if team_id is None)."""
        query = select(SSOConfiguration).where(
            SSOConfiguration.status == SSOConnectionStatus.ACTIVE
        )
        
        if team_id:
            query = query.where(
                (SSOConfiguration.team_id == team_id) | 
                (SSOConfiguration.team_id.is_(None))
            )
        else:
            query = query.where(SSOConfiguration.team_id.is_(None))
        
        result = await self.db.execute(query.order_by(SSOConfiguration.display_name))
        return list(result.scalars().all())
    
    async def update_configuration(
        self,
        config_id: int,
        **updates
    ) -> Optional[SSOConfiguration]:
        """Update SSO configuration."""
        config = await self.get_configuration(config_id)
        if not config:
            return None
        
        # Handle special fields
        if 'client_secret' in updates and updates['client_secret']:
            updates['client_secret_encrypted'] = self._encrypt_secret(updates.pop('client_secret'))
        
        if 'allowed_domains' in updates:
            domains = updates.pop('allowed_domains')
            updates['allowed_domains'] = ','.join(domains) if domains else None
        
        if 'attribute_mapping' in updates:
            config.set_attribute_mapping(updates.pop('attribute_mapping'))
        
        for key, value in updates.items():
            if hasattr(config, key):
                setattr(config, key, value)
        
        await self.db.commit()
        await self.db.refresh(config)
        
        return config
    
    async def delete_configuration(self, config_id: int) -> bool:
        """Delete SSO configuration."""
        config = await self.get_configuration(config_id)
        if not config:
            return False
        
        await self.db.delete(config)
        await self.db.commit()
        return True
    
    # =========================================================================
    # OAUTH2 FLOW
    # =========================================================================
    
    async def create_authorization_url(
        self,
        config_id: int,
        redirect_uri: str,
        user_id: Optional[int] = None,
        use_pkce: bool = False
    ) -> Tuple[str, str]:
        """
        Create OAuth2 authorization URL.
        
        Returns:
            Tuple of (authorization_url, state)
        """
        config = await self.get_configuration(config_id)
        if not config or config.status != SSOConnectionStatus.ACTIVE:
            raise ValueError("Invalid or inactive SSO configuration")
        
        # Generate state
        state = SSOState.generate_state()
        nonce = SSOState.generate_nonce()
        code_verifier = SSOState.generate_code_verifier() if use_pkce else None
        
        # Store state
        state_obj = SSOState(
            state=state,
            configuration_id=config_id,
            redirect_uri=redirect_uri,
            user_id=user_id,
            nonce=nonce,
            code_verifier=code_verifier,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        self.db.add(state_obj)
        await self.db.commit()
        
        # Build authorization URL
        params = {
            "client_id": config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": config.scopes,
            "state": state,
            "nonce": nonce
        }
        
        # Add PKCE if enabled
        if use_pkce and code_verifier:
            code_challenge = self._generate_code_challenge(code_verifier)
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"
        
        auth_url = f"{config.authorization_url}?{urlencode(params)}"
        
        return auth_url, state
    
    async def handle_callback(
        self,
        state: str,
        code: str
    ) -> Tuple[User, SSOConnection]:
        """
        Handle OAuth2 callback.
        
        Returns:
            Tuple of (user, sso_connection)
        """
        # Verify state
        state_obj = await self._verify_state(state)
        if not state_obj:
            raise ValueError("Invalid or expired state")
        
        config = await self.get_configuration(state_obj.configuration_id)
        if not config:
            raise ValueError("SSO configuration not found")
        
        # Exchange code for tokens
        tokens = await self._exchange_code(
            config=config,
            code=code,
            redirect_uri=state_obj.redirect_uri,
            code_verifier=state_obj.code_verifier
        )
        
        # Get user info
        user_info = await self._get_user_info(config, tokens['access_token'])
        
        # Validate domain if restricted
        email = user_info.get('email')
        if email and not config.is_domain_allowed(email):
            raise ValueError(f"Email domain not allowed for this SSO provider")
        
        # Find or create user and connection
        user, connection = await self._find_or_create_user(
            config=config,
            user_info=user_info,
            tokens=tokens,
            existing_user_id=state_obj.user_id
        )
        
        # Update last used
        config.last_used_at = datetime.utcnow()
        
        # Clean up state
        await self.db.delete(state_obj)
        await self.db.commit()
        
        return user, connection
    
    async def _exchange_code(
        self,
        config: SSOConfiguration,
        code: str,
        redirect_uri: str,
        code_verifier: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        data = {
            "client_id": config.client_id,
            "client_secret": self._decrypt_secret(config.client_secret_encrypted),
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }
        
        if code_verifier:
            data["code_verifier"] = code_verifier
        
        headers = {"Accept": "application/json"}
        
        response = await self.http_client.post(
            config.token_url,
            data=data,
            headers=headers
        )
        
        if response.status_code != 200:
            raise ValueError(f"Token exchange failed: {response.text}")
        
        return response.json()
    
    async def _get_user_info(
        self,
        config: SSOConfiguration,
        access_token: str
    ) -> Dict[str, Any]:
        """Get user info from provider."""
        headers = {"Authorization": f"Bearer {access_token}"}
        
        response = await self.http_client.get(
            config.userinfo_url,
            headers=headers
        )
        
        if response.status_code != 200:
            raise ValueError(f"Failed to get user info: {response.text}")
        
        raw_info = response.json()
        
        # Map attributes
        mapping = config.get_attribute_mapping()
        user_info = {}
        
        for our_key, their_key in mapping.items():
            if their_key in raw_info:
                user_info[our_key] = raw_info[their_key]
        
        # Ensure we have an ID
        user_info['provider_user_id'] = raw_info.get('sub') or raw_info.get('id') or raw_info.get('user_id')
        
        return user_info
    
    async def _find_or_create_user(
        self,
        config: SSOConfiguration,
        user_info: Dict[str, Any],
        tokens: Dict[str, Any],
        existing_user_id: Optional[int] = None
    ) -> Tuple[User, SSOConnection]:
        """Find existing user or create new one."""
        provider_user_id = str(user_info['provider_user_id'])
        email = user_info.get('email')
        
        # Check for existing connection
        result = await self.db.execute(
            select(SSOConnection)
            .options(selectinload(SSOConnection.user))
            .where(
                and_(
                    SSOConnection.configuration_id == config.id,
                    SSOConnection.provider_user_id == provider_user_id
                )
            )
        )
        existing_connection = result.scalar_one_or_none()
        
        if existing_connection:
            # Update tokens
            existing_connection.access_token_encrypted = self._encrypt_secret(tokens.get('access_token'))
            existing_connection.refresh_token_encrypted = self._encrypt_secret(tokens.get('refresh_token'))
            if tokens.get('expires_in'):
                existing_connection.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens['expires_in'])
            existing_connection.last_login_at = datetime.utcnow()
            
            await self.db.commit()
            return existing_connection.user, existing_connection
        
        # Find user by ID or email
        user = None
        
        if existing_user_id:
            result = await self.db.execute(
                select(User).where(User.id == existing_user_id)
            )
            user = result.scalar_one_or_none()
        
        if not user and email:
            result = await self.db.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
        
        # Create user if needed
        if not user:
            if not config.auto_create_users:
                raise ValueError("User not found and auto-creation is disabled")
            
            user = User(
                email=email,
                username=email.split('@')[0] if email else f"user_{provider_user_id[:8]}",
                full_name=user_info.get('name'),
                avatar_url=user_info.get('picture'),
                is_active=True,
                is_verified=True  # SSO users are pre-verified
            )
            self.db.add(user)
            await self.db.flush()
        
        # Create connection
        connection = SSOConnection(
            user_id=user.id,
            configuration_id=config.id,
            provider_user_id=provider_user_id,
            provider_email=email,
            provider_name=user_info.get('name'),
            provider_avatar=user_info.get('picture'),
            access_token_encrypted=self._encrypt_secret(tokens.get('access_token')),
            refresh_token_encrypted=self._encrypt_secret(tokens.get('refresh_token')),
            token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get('expires_in', 3600)),
            is_primary=True,
            last_login_at=datetime.utcnow()
        )
        self.db.add(connection)
        
        await self.db.commit()
        await self.db.refresh(user)
        await self.db.refresh(connection)
        
        return user, connection
    
    async def _verify_state(self, state: str) -> Optional[SSOState]:
        """Verify and retrieve state object."""
        result = await self.db.execute(
            select(SSOState).where(SSOState.state == state)
        )
        state_obj = result.scalar_one_or_none()
        
        if not state_obj or not state_obj.is_valid():
            return None
        
        return state_obj
    
    # =========================================================================
    # USER CONNECTIONS
    # =========================================================================
    
    async def get_user_connections(self, user_id: int) -> list:
        """Get all SSO connections for a user."""
        result = await self.db.execute(
            select(SSOConnection)
            .options(selectinload(SSOConnection.configuration))
            .where(SSOConnection.user_id == user_id)
            .order_by(SSOConnection.is_primary.desc())
        )
        return list(result.scalars().all())
    
    async def disconnect(self, user_id: int, connection_id: int) -> bool:
        """Remove an SSO connection."""
        result = await self.db.execute(
            select(SSOConnection).where(
                and_(
                    SSOConnection.id == connection_id,
                    SSOConnection.user_id == user_id
                )
            )
        )
        connection = result.scalar_one_or_none()
        
        if not connection:
            return False
        
        await self.db.delete(connection)
        await self.db.commit()
        return True
    
    # =========================================================================
    # HELPERS
    # =========================================================================
    
    def _encrypt_secret(self, secret: Optional[str]) -> Optional[str]:
        """Encrypt a secret (placeholder - use proper encryption in production)."""
        if not secret:
            return None
        # In production, use proper encryption (e.g., Fernet)
        return base64.b64encode(secret.encode()).decode()
    
    def _decrypt_secret(self, encrypted: Optional[str]) -> Optional[str]:
        """Decrypt a secret (placeholder - use proper decryption in production)."""
        if not encrypted:
            return None
        # In production, use proper decryption
        return base64.b64decode(encrypted.encode()).decode()
    
    def _generate_code_challenge(self, code_verifier: str) -> str:
        """Generate PKCE code challenge."""
        digest = hashlib.sha256(code_verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode()


# Singleton factory
def get_sso_service(db: AsyncSession) -> SSOService:
    """Get SSO service instance."""
    return SSOService(db)
