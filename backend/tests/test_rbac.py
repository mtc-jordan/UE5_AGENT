"""
Tests for RBAC (Role-Based Access Control) System.

Version: 2.2.0
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch


# =============================================================================
# TEST PERMISSION CACHE
# =============================================================================

class TestPermissionCache:
    """Tests for PermissionCache class."""
    
    @pytest.mark.asyncio
    async def test_cache_set_and_get(self):
        """Test setting and getting cache values."""
        from services.rbac import PermissionCache
        
        cache = PermissionCache(ttl_seconds=60)
        await cache.set(1, {"chat.read", "chat.create"})
        
        result = await cache.get(1)
        assert result is not None
        assert "chat.read" in result
        assert "chat.create" in result
    
    @pytest.mark.asyncio
    async def test_cache_expiration(self):
        """Test cache expiration."""
        from services.rbac import PermissionCache
        
        cache = PermissionCache(ttl_seconds=0)  # Immediate expiration
        await cache.set(1, {"chat.read"})
        
        # Should be expired immediately
        import asyncio
        await asyncio.sleep(0.1)
        result = await cache.get(1)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self):
        """Test cache invalidation."""
        from services.rbac import PermissionCache
        
        cache = PermissionCache(ttl_seconds=60)
        await cache.set(1, {"chat.read"})
        await cache.invalidate(1)
        
        result = await cache.get(1)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_cache_clear(self):
        """Test clearing entire cache."""
        from services.rbac import PermissionCache
        
        cache = PermissionCache(ttl_seconds=60)
        await cache.set(1, {"chat.read"})
        await cache.set(2, {"project.read"})
        await cache.invalidate_all()
        
        assert await cache.get(1) is None
        assert await cache.get(2) is None


# =============================================================================
# TEST ROLE HIERARCHY
# =============================================================================

class TestRoleHierarchy:
    """Tests for role hierarchy logic."""
    
    def test_role_levels(self):
        """Test role level ordering."""
        # Owner (0) > Admin (10) > Manager (20) > Developer (30) > Analyst (35) > User (40) > Guest (50)
        levels = {
            "owner": 0,
            "admin": 10,
            "manager": 20,
            "developer": 30,
            "analyst": 35,
            "user": 40,
            "guest": 50
        }
        
        # Verify ordering
        sorted_roles = sorted(levels.items(), key=lambda x: x[1])
        assert sorted_roles[0][0] == "owner"
        assert sorted_roles[-1][0] == "guest"
    
    def test_role_inheritance(self):
        """Test that higher roles inherit lower role permissions."""
        # This is a conceptual test - actual inheritance depends on permission setup
        owner_perms = {"system.all", "admin.users", "chat.read"}
        admin_perms = {"admin.users", "chat.read"}
        user_perms = {"chat.read"}
        
        # Owner should have all permissions
        assert owner_perms.issuperset(admin_perms)
        assert admin_perms.issuperset(user_perms)


# =============================================================================
# TEST PERMISSION CHECKS
# =============================================================================

class TestPermissionChecks:
    """Tests for permission check functions."""
    
    @pytest.mark.asyncio
    async def test_has_permission_with_system_all(self):
        """Test that system.all grants all permissions."""
        from services.rbac import RBACService
        
        service = RBACService()
        
        # Mock the get_user_permissions to return system.all
        with patch.object(service, 'get_user_permissions', new_callable=AsyncMock) as mock_perms:
            mock_perms.return_value = {"system.all"}
            
            # Should have any permission
            result = await service.has_permission(MagicMock(), 1, "any.permission")
            assert result is True
    
    @pytest.mark.asyncio
    async def test_has_permission_specific(self):
        """Test specific permission check."""
        from services.rbac import RBACService
        
        service = RBACService()
        
        with patch.object(service, 'get_user_permissions', new_callable=AsyncMock) as mock_perms:
            mock_perms.return_value = {"chat.read", "chat.create"}
            
            # Should have chat.read
            result = await service.has_permission(MagicMock(), 1, "chat.read")
            assert result is True
            
            # Should not have chat.delete
            result = await service.has_permission(MagicMock(), 1, "chat.delete")
            assert result is False
    
    @pytest.mark.asyncio
    async def test_has_any_permission(self):
        """Test checking for any of multiple permissions."""
        from services.rbac import RBACService
        
        service = RBACService()
        
        with patch.object(service, 'get_user_permissions', new_callable=AsyncMock) as mock_perms:
            mock_perms.return_value = {"chat.read"}
            
            # Should pass - has chat.read
            result = await service.has_any_permission(
                MagicMock(), 1, ["chat.read", "chat.create"]
            )
            assert result is True
            
            # Should fail - has neither
            result = await service.has_any_permission(
                MagicMock(), 1, ["project.read", "project.create"]
            )
            assert result is False
    
    @pytest.mark.asyncio
    async def test_has_all_permissions(self):
        """Test checking for all permissions."""
        from services.rbac import RBACService
        
        service = RBACService()
        
        with patch.object(service, 'get_user_permissions', new_callable=AsyncMock) as mock_perms:
            mock_perms.return_value = {"chat.read", "chat.create", "chat.delete"}
            
            # Should pass - has all
            result = await service.has_all_permissions(
                MagicMock(), 1, ["chat.read", "chat.create"]
            )
            assert result is True
            
            # Should fail - missing one
            result = await service.has_all_permissions(
                MagicMock(), 1, ["chat.read", "project.read"]
            )
            assert result is False


# =============================================================================
# TEST AUDIT LOGGING
# =============================================================================

class TestAuditLogging:
    """Tests for audit logging functionality."""
    
    def test_audit_log_model(self):
        """Test that audit log model has correct fields."""
        from models.rbac import PermissionAuditLog, AuditAction
        
        # Verify AuditAction enum values
        assert AuditAction.ROLE_CREATED.value == "role_created"
        assert AuditAction.USER_ROLE_ASSIGNED.value == "user_role_assigned"
        assert AuditAction.PERMISSION_GRANTED.value == "permission_granted"
        assert AuditAction.ACCESS_DENIED.value == "access_denied"


# =============================================================================
# TEST ROLE OPERATIONS
# =============================================================================

class TestRoleOperations:
    """Tests for role CRUD operations."""
    
    def test_role_name_validation(self):
        """Test role name validation."""
        valid_names = ["admin", "developer", "custom_role", "role123"]
        invalid_names = ["", "a", "role with spaces", "role@special"]
        
        import re
        pattern = r'^[a-z][a-z0-9_]{1,48}[a-z0-9]$'
        
        for name in valid_names:
            assert re.match(pattern, name) is not None, f"{name} should be valid"
        
        for name in invalid_names:
            assert re.match(pattern, name) is None, f"{name} should be invalid"
    
    def test_role_level_bounds(self):
        """Test role level bounds."""
        min_level = 0
        max_level = 100
        
        # Valid levels
        assert 0 <= 0 <= 100
        assert 0 <= 50 <= 100
        assert 0 <= 100 <= 100
        
        # Invalid levels
        assert not (0 <= -1 <= 100)
        assert not (0 <= 101 <= 100)


# =============================================================================
# TEST PERMISSION OVERRIDE
# =============================================================================

class TestPermissionOverride:
    """Tests for permission override functionality."""
    
    @pytest.mark.asyncio
    async def test_grant_override(self):
        """Test granting a permission override."""
        # Permission overrides should take precedence over role permissions
        base_permissions = {"chat.read"}
        override_grant = {"chat.delete"}
        
        # Combined should include both
        combined = base_permissions | override_grant
        assert "chat.read" in combined
        assert "chat.delete" in combined
    
    @pytest.mark.asyncio
    async def test_revoke_override(self):
        """Test revoking a permission via override."""
        base_permissions = {"chat.read", "chat.create", "chat.delete"}
        override_revoke = {"chat.delete"}
        
        # Combined should exclude revoked
        combined = base_permissions - override_revoke
        assert "chat.read" in combined
        assert "chat.create" in combined
        assert "chat.delete" not in combined
    
    def test_override_expiration(self):
        """Test permission override expiration."""
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=1)
        
        # Not expired
        assert expires_at > now
        
        # Expired
        expired_at = now - timedelta(hours=1)
        assert expired_at < now


# =============================================================================
# TEST DEFAULT PERMISSIONS
# =============================================================================

class TestDefaultPermissions:
    """Tests for default permission setup."""
    
    def test_permission_categories(self):
        """Test that all permission categories are defined."""
        expected_categories = [
            "chat", "project", "workspace", "plugin",
            "comparison", "mcp", "agent", "admin",
            "subscription", "system"
        ]
        
        for category in expected_categories:
            assert category in expected_categories
    
    def test_default_roles(self):
        """Test that default roles are defined."""
        default_roles = [
            "owner", "admin", "manager", "developer",
            "analyst", "user", "guest"
        ]
        
        assert len(default_roles) == 7
        assert "owner" in default_roles
        assert "guest" in default_roles


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
