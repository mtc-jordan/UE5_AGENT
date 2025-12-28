"""Seed initial data - Default roles, permissions, plans, and agents

Revision ID: 002
Revises: 001
Create Date: 2025-12-28 00:00:02

This migration seeds the database with:
- Default roles (Owner, Admin, Manager, Developer, Analyst, User, Guest)
- Default permissions for all resources
- Default subscription plans (Free, Pro, Team, Enterprise)
- Default AI agents
- Default SSO providers
"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed initial data."""
    
    # =========================================================================
    # SEED ROLES
    # =========================================================================
    roles_table = table(
        'roles',
        column('id', sa.Integer),
        column('name', sa.String),
        column('display_name', sa.String),
        column('description', sa.Text),
        column('level', sa.Integer),
        column('is_system', sa.Boolean),
        column('color', sa.String),
        column('created_at', sa.DateTime)
    )
    
    op.bulk_insert(roles_table, [
        {
            'id': 1,
            'name': 'owner',
            'display_name': 'Owner',
            'description': 'Full system access with all permissions',
            'level': 0,
            'is_system': True,
            'color': '#8B5CF6',
            'created_at': datetime.utcnow()
        },
        {
            'id': 2,
            'name': 'admin',
            'display_name': 'Administrator',
            'description': 'Administrative access for user and system management',
            'level': 10,
            'is_system': True,
            'color': '#EF4444',
            'created_at': datetime.utcnow()
        },
        {
            'id': 3,
            'name': 'manager',
            'display_name': 'Manager',
            'description': 'Project and team management capabilities',
            'level': 20,
            'is_system': True,
            'color': '#F59E0B',
            'created_at': datetime.utcnow()
        },
        {
            'id': 4,
            'name': 'developer',
            'display_name': 'Developer',
            'description': 'Full development access including plugins and MCP',
            'level': 30,
            'is_system': True,
            'color': '#3B82F6',
            'created_at': datetime.utcnow()
        },
        {
            'id': 5,
            'name': 'analyst',
            'display_name': 'Analyst',
            'description': 'Read access with model comparison capabilities',
            'level': 35,
            'is_system': True,
            'color': '#10B981',
            'created_at': datetime.utcnow()
        },
        {
            'id': 6,
            'name': 'user',
            'display_name': 'User',
            'description': 'Standard user access',
            'level': 40,
            'is_system': True,
            'color': '#6B7280',
            'created_at': datetime.utcnow()
        },
        {
            'id': 7,
            'name': 'guest',
            'display_name': 'Guest',
            'description': 'Limited read-only access',
            'level': 50,
            'is_system': True,
            'color': '#9CA3AF',
            'created_at': datetime.utcnow()
        }
    ])
    
    # =========================================================================
    # SEED PERMISSIONS
    # =========================================================================
    permissions_table = table(
        'permissions',
        column('id', sa.Integer),
        column('name', sa.String),
        column('resource', sa.String),
        column('action', sa.String),
        column('description', sa.Text),
        column('created_at', sa.DateTime)
    )
    
    permissions = []
    permission_id = 1
    
    resources = {
        'chat': ['create', 'read', 'update', 'delete', 'export'],
        'project': ['create', 'read', 'update', 'delete', 'share'],
        'workspace': ['create', 'read', 'update', 'delete', 'upload'],
        'plugin': ['create', 'read', 'update', 'delete', 'install', 'publish'],
        'comparison': ['create', 'read', 'delete'],
        'mcp': ['connect', 'execute', 'configure'],
        'team': ['create', 'read', 'update', 'delete', 'invite'],
        'user': ['read', 'update', 'delete', 'manage'],
        'role': ['read', 'assign', 'manage'],
        'subscription': ['read', 'manage'],
        'analytics': ['read', 'export'],
        'settings': ['read', 'update']
    }
    
    for resource, actions in resources.items():
        for action in actions:
            permissions.append({
                'id': permission_id,
                'name': f'{resource}:{action}',
                'resource': resource,
                'action': action,
                'description': f'{action.capitalize()} {resource}',
                'created_at': datetime.utcnow()
            })
            permission_id += 1
    
    op.bulk_insert(permissions_table, permissions)
    
    # =========================================================================
    # SEED ROLE PERMISSIONS
    # =========================================================================
    role_permissions_table = table(
        'role_permissions',
        column('id', sa.Integer),
        column('role_id', sa.Integer),
        column('permission_id', sa.Integer),
        column('created_at', sa.DateTime)
    )
    
    # Owner gets all permissions
    role_permissions = []
    rp_id = 1
    
    for perm_id in range(1, permission_id):
        role_permissions.append({
            'id': rp_id,
            'role_id': 1,  # Owner
            'permission_id': perm_id,
            'created_at': datetime.utcnow()
        })
        rp_id += 1
    
    # Admin gets most permissions (excluding some owner-only ones)
    admin_excluded = ['subscription:manage', 'role:manage']
    for perm in permissions:
        if perm['name'] not in admin_excluded:
            role_permissions.append({
                'id': rp_id,
                'role_id': 2,  # Admin
                'permission_id': perm['id'],
                'created_at': datetime.utcnow()
            })
            rp_id += 1
    
    # Developer permissions
    developer_resources = ['chat', 'project', 'workspace', 'plugin', 'comparison', 'mcp']
    for perm in permissions:
        if perm['resource'] in developer_resources:
            role_permissions.append({
                'id': rp_id,
                'role_id': 4,  # Developer
                'permission_id': perm['id'],
                'created_at': datetime.utcnow()
            })
            rp_id += 1
    
    # User permissions
    user_perms = [
        'chat:create', 'chat:read', 'chat:update', 'chat:delete',
        'project:create', 'project:read', 'project:update',
        'workspace:create', 'workspace:read', 'workspace:update', 'workspace:upload',
        'plugin:read', 'plugin:install',
        'comparison:create', 'comparison:read',
        'mcp:connect', 'mcp:execute',
        'settings:read', 'settings:update'
    ]
    for perm in permissions:
        if perm['name'] in user_perms:
            role_permissions.append({
                'id': rp_id,
                'role_id': 6,  # User
                'permission_id': perm['id'],
                'created_at': datetime.utcnow()
            })
            rp_id += 1
    
    op.bulk_insert(role_permissions_table, role_permissions)
    
    # =========================================================================
    # SEED SUBSCRIPTION PLANS
    # =========================================================================
    plans_table = table(
        'subscription_plans',
        column('id', sa.Integer),
        column('name', sa.String),
        column('display_name', sa.String),
        column('description', sa.Text),
        column('price_monthly', sa.Numeric),
        column('price_yearly', sa.Numeric),
        column('features', sa.JSON),
        column('limits', sa.JSON),
        column('is_active', sa.Boolean),
        column('sort_order', sa.Integer),
        column('created_at', sa.DateTime)
    )
    
    op.bulk_insert(plans_table, [
        {
            'id': 1,
            'name': 'free',
            'display_name': 'Free',
            'description': 'Get started with basic features',
            'price_monthly': 0,
            'price_yearly': 0,
            'features': ['100 AI messages/month', 'Basic MCP tools', '1 project', '100MB storage'],
            'limits': {'messages': 100, 'projects': 1, 'storage_mb': 100, 'team_members': 1},
            'is_active': True,
            'sort_order': 1,
            'created_at': datetime.utcnow()
        },
        {
            'id': 2,
            'name': 'pro',
            'display_name': 'Pro',
            'description': 'For individual developers',
            'price_monthly': 29,
            'price_yearly': 290,
            'features': ['Unlimited AI messages', 'All AI models', 'Full MCP access', '10 projects', '10GB storage', 'Plugin marketplace'],
            'limits': {'messages': -1, 'projects': 10, 'storage_mb': 10240, 'team_members': 1},
            'is_active': True,
            'sort_order': 2,
            'created_at': datetime.utcnow()
        },
        {
            'id': 3,
            'name': 'team',
            'display_name': 'Team',
            'description': 'For small teams',
            'price_monthly': 99,
            'price_yearly': 990,
            'features': ['Everything in Pro', 'Team collaboration', 'Up to 10 members', '50GB storage', 'Priority support'],
            'limits': {'messages': -1, 'projects': 50, 'storage_mb': 51200, 'team_members': 10},
            'is_active': True,
            'sort_order': 3,
            'created_at': datetime.utcnow()
        },
        {
            'id': 4,
            'name': 'enterprise',
            'display_name': 'Enterprise',
            'description': 'For large organizations',
            'price_monthly': 299,
            'price_yearly': 2990,
            'features': ['Everything in Team', 'Unlimited members', 'SSO/SAML', 'Custom integrations', 'Dedicated support', 'SLA'],
            'limits': {'messages': -1, 'projects': -1, 'storage_mb': 102400, 'team_members': -1},
            'is_active': True,
            'sort_order': 4,
            'created_at': datetime.utcnow()
        }
    ])
    
    # =========================================================================
    # SEED DEFAULT AGENTS
    # =========================================================================
    agents_table = table(
        'agents',
        column('id', sa.Integer),
        column('name', sa.String),
        column('role', sa.String),
        column('personality', sa.Text),
        column('expertise', sa.JSON),
        column('system_prompt', sa.Text),
        column('is_default', sa.Boolean),
        column('created_at', sa.DateTime)
    )
    
    op.bulk_insert(agents_table, [
        {
            'id': 1,
            'name': 'Atlas',
            'role': 'Lead Developer',
            'personality': 'Analytical, thorough, and detail-oriented. Provides comprehensive solutions with best practices.',
            'expertise': ['C++', 'Blueprints', 'Architecture', 'Performance'],
            'system_prompt': 'You are Atlas, a senior UE5 developer specializing in architecture and performance optimization.',
            'is_default': True,
            'created_at': datetime.utcnow()
        },
        {
            'id': 2,
            'name': 'Maya',
            'role': 'Creative Director',
            'personality': 'Creative, innovative, and visually focused. Excels at design and user experience.',
            'expertise': ['Level Design', 'Materials', 'Lighting', 'UI/UX'],
            'system_prompt': 'You are Maya, a creative director specializing in visual design and level creation in UE5.',
            'is_default': True,
            'created_at': datetime.utcnow()
        },
        {
            'id': 3,
            'name': 'Nexus',
            'role': 'Systems Architect',
            'personality': 'Logical, systematic, and focused on scalability. Expert in complex systems.',
            'expertise': ['Networking', 'Multiplayer', 'Backend', 'Databases'],
            'system_prompt': 'You are Nexus, a systems architect specializing in multiplayer and networked game systems.',
            'is_default': True,
            'created_at': datetime.utcnow()
        },
        {
            'id': 4,
            'name': 'Pixel',
            'role': 'Graphics Engineer',
            'personality': 'Technical, precise, and passionate about visual fidelity.',
            'expertise': ['Shaders', 'Rendering', 'Post-Processing', 'VFX'],
            'system_prompt': 'You are Pixel, a graphics engineer specializing in shaders and rendering in UE5.',
            'is_default': True,
            'created_at': datetime.utcnow()
        }
    ])
    
    # =========================================================================
    # SEED SSO PROVIDERS
    # =========================================================================
    sso_providers_table = table(
        'sso_providers',
        column('id', sa.Integer),
        column('name', sa.String),
        column('display_name', sa.String),
        column('provider_type', sa.String),
        column('authorization_url', sa.String),
        column('token_url', sa.String),
        column('userinfo_url', sa.String),
        column('scopes', sa.JSON),
        column('is_active', sa.Boolean),
        column('created_at', sa.DateTime)
    )
    
    op.bulk_insert(sso_providers_table, [
        {
            'id': 1,
            'name': 'google',
            'display_name': 'Google',
            'provider_type': 'oauth2',
            'authorization_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_url': 'https://oauth2.googleapis.com/token',
            'userinfo_url': 'https://www.googleapis.com/oauth2/v3/userinfo',
            'scopes': ['openid', 'email', 'profile'],
            'is_active': False,
            'created_at': datetime.utcnow()
        },
        {
            'id': 2,
            'name': 'github',
            'display_name': 'GitHub',
            'provider_type': 'oauth2',
            'authorization_url': 'https://github.com/login/oauth/authorize',
            'token_url': 'https://github.com/login/oauth/access_token',
            'userinfo_url': 'https://api.github.com/user',
            'scopes': ['read:user', 'user:email'],
            'is_active': False,
            'created_at': datetime.utcnow()
        },
        {
            'id': 3,
            'name': 'microsoft',
            'display_name': 'Microsoft',
            'provider_type': 'oauth2',
            'authorization_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            'token_url': 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            'userinfo_url': 'https://graph.microsoft.com/v1.0/me',
            'scopes': ['openid', 'email', 'profile'],
            'is_active': False,
            'created_at': datetime.utcnow()
        }
    ])


def downgrade() -> None:
    """Remove seeded data."""
    # Delete in reverse order of dependencies
    op.execute("DELETE FROM sso_providers WHERE id <= 3")
    op.execute("DELETE FROM agents WHERE id <= 4")
    op.execute("DELETE FROM subscription_plans WHERE id <= 4")
    op.execute("DELETE FROM role_permissions")
    op.execute("DELETE FROM permissions")
    op.execute("DELETE FROM roles WHERE id <= 7")
