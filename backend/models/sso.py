"""
SSO Database Models

Models for OAuth2 and SAML single sign-on integration.

Version: 2.3.0
"""

from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Text, 
    ForeignKey, Enum as SQLEnum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import enum
import secrets
import json

from core.database import Base


# =============================================================================
# ENUMS
# =============================================================================

class SSOProvider(str, enum.Enum):
    """Supported SSO providers."""
    GOOGLE = "google"
    GITHUB = "github"
    MICROSOFT = "microsoft"
    OKTA = "okta"
    AUTH0 = "auth0"
    SAML = "saml"
    CUSTOM_OIDC = "custom_oidc"


class SSOConnectionStatus(str, enum.Enum):
    """Status of SSO connection."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    ERROR = "error"


# =============================================================================
# MODELS
# =============================================================================

class SSOConfiguration(Base):
    """
    SSO provider configuration for an organization/team.
    
    Stores OAuth2/OIDC or SAML configuration for enterprise SSO.
    """
    __tablename__ = "sso_configurations"
    __table_args__ = (
        UniqueConstraint('team_id', 'provider', name='uq_team_provider'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Association (can be team-level or global)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)
    
    # Provider info
    provider = Column(SQLEnum(SSOProvider), nullable=False)
    display_name = Column(String(128), nullable=False)  # e.g., "Sign in with Google"
    
    # Status
    status = Column(SQLEnum(SSOConnectionStatus), default=SSOConnectionStatus.PENDING)
    is_default = Column(Boolean, default=False)  # Default provider for team
    
    # OAuth2/OIDC Configuration
    client_id = Column(String(512), nullable=True)
    client_secret_encrypted = Column(Text, nullable=True)  # Encrypted
    authorization_url = Column(String(1024), nullable=True)
    token_url = Column(String(1024), nullable=True)
    userinfo_url = Column(String(1024), nullable=True)
    scopes = Column(String(512), default="openid email profile")
    
    # SAML Configuration
    entity_id = Column(String(512), nullable=True)
    sso_url = Column(String(1024), nullable=True)  # IdP SSO URL
    slo_url = Column(String(1024), nullable=True)  # IdP SLO URL
    certificate = Column(Text, nullable=True)  # IdP X.509 certificate
    
    # Attribute mapping (JSON)
    attribute_mapping = Column(Text, nullable=True)
    
    # Settings
    auto_create_users = Column(Boolean, default=True)
    default_role = Column(String(64), default="user")
    allowed_domains = Column(String(1024), nullable=True)  # Comma-separated
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    
    # Relationships
    team = relationship("Team", backref="sso_configurations")
    connections = relationship("SSOConnection", back_populates="configuration", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<SSOConfiguration {self.provider.value} for team {self.team_id}>"
    
    def get_attribute_mapping(self) -> Dict[str, str]:
        """Get attribute mapping as dictionary."""
        if self.attribute_mapping:
            return json.loads(self.attribute_mapping)
        # Default mapping
        return {
            "email": "email",
            "name": "name",
            "given_name": "given_name",
            "family_name": "family_name",
            "picture": "picture"
        }
    
    def set_attribute_mapping(self, mapping: Dict[str, str]):
        """Set attribute mapping from dictionary."""
        self.attribute_mapping = json.dumps(mapping)
    
    def get_allowed_domains(self) -> list:
        """Get allowed domains as list."""
        if self.allowed_domains:
            return [d.strip() for d in self.allowed_domains.split(",")]
        return []
    
    def is_domain_allowed(self, email: str) -> bool:
        """Check if email domain is allowed."""
        domains = self.get_allowed_domains()
        if not domains:
            return True  # No restriction
        
        email_domain = email.split("@")[-1].lower()
        return email_domain in [d.lower() for d in domains]
    
    def to_dict(self, include_secrets: bool = False) -> dict:
        """Convert to dictionary."""
        result = {
            "id": self.id,
            "team_id": self.team_id,
            "provider": self.provider.value,
            "display_name": self.display_name,
            "status": self.status.value,
            "is_default": self.is_default,
            "client_id": self.client_id,
            "authorization_url": self.authorization_url,
            "token_url": self.token_url,
            "userinfo_url": self.userinfo_url,
            "scopes": self.scopes,
            "entity_id": self.entity_id,
            "sso_url": self.sso_url,
            "slo_url": self.slo_url,
            "auto_create_users": self.auto_create_users,
            "default_role": self.default_role,
            "allowed_domains": self.get_allowed_domains(),
            "attribute_mapping": self.get_attribute_mapping(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None
        }
        
        if include_secrets:
            result["client_secret"] = self.client_secret_encrypted  # Would be decrypted
            result["certificate"] = self.certificate
        
        return result


class SSOConnection(Base):
    """
    User's SSO connection/identity.
    
    Links a user account to an SSO provider identity.
    """
    __tablename__ = "sso_connections"
    __table_args__ = (
        UniqueConstraint('configuration_id', 'provider_user_id', name='uq_config_provider_user'),
        Index('ix_sso_connections_user', 'user_id'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User link
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # SSO configuration
    configuration_id = Column(Integer, ForeignKey("sso_configurations.id", ondelete="CASCADE"), nullable=False)
    
    # Provider identity
    provider_user_id = Column(String(256), nullable=False)  # User ID from provider
    provider_email = Column(String(320), nullable=True)
    provider_name = Column(String(256), nullable=True)
    provider_avatar = Column(String(1024), nullable=True)
    
    # Tokens (encrypted)
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    
    # SAML specific
    saml_name_id = Column(String(512), nullable=True)
    saml_session_index = Column(String(256), nullable=True)
    
    # Status
    is_primary = Column(Boolean, default=False)  # Primary SSO for user
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", backref="sso_connections")
    configuration = relationship("SSOConfiguration", back_populates="connections")
    
    def __repr__(self):
        return f"<SSOConnection user={self.user_id} provider={self.configuration.provider.value if self.configuration else 'unknown'}>"
    
    def is_token_expired(self) -> bool:
        """Check if access token is expired."""
        if not self.token_expires_at:
            return True
        return datetime.utcnow() > self.token_expires_at
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "configuration_id": self.configuration_id,
            "provider": self.configuration.provider.value if self.configuration else None,
            "provider_user_id": self.provider_user_id,
            "provider_email": self.provider_email,
            "provider_name": self.provider_name,
            "provider_avatar": self.provider_avatar,
            "is_primary": self.is_primary,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None
        }


class SSOState(Base):
    """
    OAuth2 state parameter storage.
    
    Stores state for CSRF protection during OAuth2 flow.
    """
    __tablename__ = "sso_states"
    
    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(128), unique=True, nullable=False, index=True)
    
    # Flow info
    configuration_id = Column(Integer, ForeignKey("sso_configurations.id", ondelete="CASCADE"), nullable=False)
    redirect_uri = Column(String(1024), nullable=False)
    
    # Optional: link existing user
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # PKCE (for mobile/SPA)
    code_verifier = Column(String(128), nullable=True)
    
    # Nonce for OIDC
    nonce = Column(String(128), nullable=True)
    
    # Expiry
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    # Relationships
    configuration = relationship("SSOConfiguration")
    
    @classmethod
    def generate_state(cls) -> str:
        """Generate a secure state token."""
        return secrets.token_urlsafe(32)
    
    @classmethod
    def generate_nonce(cls) -> str:
        """Generate a nonce for OIDC."""
        return secrets.token_urlsafe(16)
    
    @classmethod
    def generate_code_verifier(cls) -> str:
        """Generate PKCE code verifier."""
        return secrets.token_urlsafe(64)
    
    def is_valid(self) -> bool:
        """Check if state is still valid."""
        return datetime.utcnow() < self.expires_at


class SAMLAssertion(Base):
    """
    SAML assertion storage for validation.
    
    Stores SAML assertions to prevent replay attacks.
    """
    __tablename__ = "saml_assertions"
    
    id = Column(Integer, primary_key=True, index=True)
    assertion_id = Column(String(256), unique=True, nullable=False, index=True)
    
    # Association
    configuration_id = Column(Integer, ForeignKey("sso_configurations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Assertion details
    issuer = Column(String(512), nullable=False)
    subject = Column(String(512), nullable=False)
    
    # Validity
    not_before = Column(DateTime, nullable=True)
    not_on_or_after = Column(DateTime, nullable=False)
    
    # Timestamps
    received_at = Column(DateTime, default=datetime.utcnow)
    
    def is_valid(self) -> bool:
        """Check if assertion is within validity period."""
        now = datetime.utcnow()
        if self.not_before and now < self.not_before:
            return False
        if now >= self.not_on_or_after:
            return False
        return True


# =============================================================================
# PROVIDER CONFIGURATIONS
# =============================================================================

# Pre-configured OAuth2 providers
OAUTH2_PROVIDERS = {
    SSOProvider.GOOGLE: {
        "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scopes": "openid email profile",
        "attribute_mapping": {
            "email": "email",
            "name": "name",
            "given_name": "given_name",
            "family_name": "family_name",
            "picture": "picture"
        }
    },
    SSOProvider.GITHUB: {
        "authorization_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scopes": "read:user user:email",
        "attribute_mapping": {
            "email": "email",
            "name": "name",
            "picture": "avatar_url"
        }
    },
    SSOProvider.MICROSOFT: {
        "authorization_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "scopes": "openid email profile User.Read",
        "attribute_mapping": {
            "email": "mail",
            "name": "displayName",
            "given_name": "givenName",
            "family_name": "surname"
        }
    }
}
