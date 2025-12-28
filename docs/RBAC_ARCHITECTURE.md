# Role-Based Access Control (RBAC) Architecture

## Overview

This document outlines the RBAC system architecture for UE5 AI Studio, providing granular permission control for all platform features.

---

## Role Hierarchy

```
                    ┌─────────────┐
                    │   OWNER     │  Full system control
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    ADMIN    │  User & system management
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐    ┌──────▼──────┐   ┌─────▼─────┐
   │  MANAGER  │    │  DEVELOPER  │   │  ANALYST  │
   └─────┬─────┘    └──────┬──────┘   └─────┬─────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    ┌──────▼──────┐
                    │    USER     │  Basic access
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    GUEST    │  Read-only access
                    └─────────────┘
```

---

## Permission Categories

### 1. Chat Permissions
| Permission | Description |
|------------|-------------|
| `chat.create` | Create new chat sessions |
| `chat.read` | View chat history |
| `chat.update` | Edit chat messages |
| `chat.delete` | Delete chat sessions |
| `chat.share` | Share chats with others |
| `chat.export` | Export chat history |

### 2. Project Permissions
| Permission | Description |
|------------|-------------|
| `project.create` | Create new projects |
| `project.read` | View projects |
| `project.update` | Edit project settings |
| `project.delete` | Delete projects |
| `project.manage_members` | Add/remove project members |
| `project.transfer` | Transfer project ownership |

### 3. Workspace Permissions
| Permission | Description |
|------------|-------------|
| `workspace.create` | Create files/folders |
| `workspace.read` | View workspace files |
| `workspace.update` | Edit files |
| `workspace.delete` | Delete files/folders |
| `workspace.upload` | Upload files |
| `workspace.download` | Download files |
| `workspace.share` | Share workspace items |

### 4. Plugin Permissions
| Permission | Description |
|------------|-------------|
| `plugin.create` | Create new plugins |
| `plugin.read` | View plugins |
| `plugin.update` | Edit plugins |
| `plugin.delete` | Delete plugins |
| `plugin.execute` | Run plugins |
| `plugin.publish` | Publish to marketplace |
| `plugin.install` | Install plugins |
| `plugin.manage` | Manage all plugins (admin) |

### 5. Comparison Permissions
| Permission | Description |
|------------|-------------|
| `comparison.create` | Create comparisons |
| `comparison.read` | View comparisons |
| `comparison.delete` | Delete comparisons |
| `comparison.rate` | Rate model responses |

### 6. MCP Permissions
| Permission | Description |
|------------|-------------|
| `mcp.connect` | Connect to UE5 |
| `mcp.execute` | Execute MCP tools |
| `mcp.manage` | Manage MCP connections |

### 7. Agent Permissions
| Permission | Description |
|------------|-------------|
| `agent.create` | Create custom agents |
| `agent.read` | View agents |
| `agent.update` | Edit agents |
| `agent.delete` | Delete agents |
| `agent.use` | Use agents in chat |

### 8. Admin Permissions
| Permission | Description |
|------------|-------------|
| `admin.users.read` | View all users |
| `admin.users.create` | Create users |
| `admin.users.update` | Edit users |
| `admin.users.delete` | Delete users |
| `admin.roles.manage` | Manage roles |
| `admin.settings.manage` | Manage system settings |
| `admin.audit.read` | View audit logs |
| `admin.billing.manage` | Manage billing |

### 9. Subscription Permissions
| Permission | Description |
|------------|-------------|
| `subscription.view` | View subscription status |
| `subscription.upgrade` | Upgrade subscription |
| `subscription.cancel` | Cancel subscription |
| `subscription.manage` | Manage all subscriptions |

---

## Default Role Permissions

### GUEST
```
- chat.read
- project.read
- workspace.read
- plugin.read
- comparison.read
- agent.read
```

### USER
```
All GUEST permissions +
- chat.create, chat.update, chat.delete, chat.export
- project.create, project.update
- workspace.create, workspace.update, workspace.delete, workspace.upload, workspace.download
- plugin.install, plugin.execute
- comparison.create, comparison.delete, comparison.rate
- mcp.connect, mcp.execute
- agent.use
- subscription.view
```

### DEVELOPER
```
All USER permissions +
- project.delete
- workspace.share
- plugin.create, plugin.update, plugin.delete, plugin.publish
- agent.create, agent.update, agent.delete
```

### ANALYST
```
All USER permissions +
- chat.share
- project.manage_members
- comparison.* (all)
```

### MANAGER
```
All DEVELOPER + ANALYST permissions +
- project.manage_members, project.transfer
- admin.users.read
- admin.audit.read
```

### ADMIN
```
All MANAGER permissions +
- admin.users.create, admin.users.update, admin.users.delete
- admin.roles.manage
- admin.settings.manage
- plugin.manage
- mcp.manage
- subscription.manage
```

### OWNER
```
All permissions (full system access)
- admin.billing.manage
- System configuration
- Database access
```

---

## Database Schema

### Roles Table
```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,  -- Hierarchy level (0=highest)
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Permissions Table
```sql
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Role-Permission Association
```sql
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id),
    permission_id INTEGER REFERENCES permissions(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    PRIMARY KEY (role_id, permission_id)
);
```

### User-Role Association
```sql
CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id),
    role_id INTEGER REFERENCES roles(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMP,  -- Optional expiration
    PRIMARY KEY (user_id, role_id)
);
```

### User-Permission Override
```sql
CREATE TABLE user_permissions (
    user_id INTEGER REFERENCES users(id),
    permission_id INTEGER REFERENCES permissions(id),
    is_granted BOOLEAN NOT NULL,  -- TRUE=grant, FALSE=revoke
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMP,
    reason TEXT,
    PRIMARY KEY (user_id, permission_id)
);
```

### Audit Log
```sql
CREATE TABLE permission_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INTEGER NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Role Management
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/roles` | `admin.roles.manage` |
| POST | `/api/roles` | `admin.roles.manage` |
| GET | `/api/roles/{id}` | `admin.roles.manage` |
| PUT | `/api/roles/{id}` | `admin.roles.manage` |
| DELETE | `/api/roles/{id}` | `admin.roles.manage` |
| GET | `/api/roles/{id}/permissions` | `admin.roles.manage` |
| PUT | `/api/roles/{id}/permissions` | `admin.roles.manage` |

### Permission Management
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/permissions` | `admin.roles.manage` |
| GET | `/api/permissions/categories` | `admin.roles.manage` |

### User Role Assignment
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/users/{id}/roles` | `admin.users.read` |
| POST | `/api/users/{id}/roles` | `admin.users.update` |
| DELETE | `/api/users/{id}/roles/{role_id}` | `admin.users.update` |
| GET | `/api/users/{id}/permissions` | `admin.users.read` |
| POST | `/api/users/{id}/permissions` | `admin.users.update` |

### Current User
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/me/permissions` | (authenticated) |
| GET | `/api/me/roles` | (authenticated) |

### Audit Log
| Method | Endpoint | Permission Required |
|--------|----------|---------------------|
| GET | `/api/audit/permissions` | `admin.audit.read` |

---

## Implementation Strategy

### Phase 1: Database Models
- Create Role, Permission, UserRole, UserPermission models
- Define default roles and permissions
- Migration scripts

### Phase 2: Permission Service
- Permission checking logic
- Role hierarchy enforcement
- Permission caching

### Phase 3: Decorators & Middleware
- `@require_permission("permission.name")` decorator
- `@require_role("ADMIN")` decorator
- Permission middleware for API routes

### Phase 4: API Endpoints
- Role CRUD endpoints
- Permission assignment endpoints
- Audit logging

### Phase 5: Admin UI
- Role management interface
- User permission editor
- Audit log viewer

### Phase 6: Feature Integration
- Apply permissions to all existing endpoints
- Update frontend to check permissions
- Conditional UI rendering

---

## Security Considerations

1. **Principle of Least Privilege**: Users start with minimal permissions
2. **Role Hierarchy**: Higher roles inherit lower role permissions
3. **Permission Override**: Individual permissions can override role defaults
4. **Audit Trail**: All permission changes are logged
5. **Time-based Access**: Permissions can have expiration dates
6. **IP Restrictions**: Optional IP-based access control
7. **Rate Limiting**: Per-permission rate limits

---

## Frontend Integration

### Permission Hook
```typescript
const { hasPermission, hasRole, permissions } = usePermissions()

if (hasPermission('plugin.create')) {
  // Show create button
}
```

### Protected Route
```typescript
<ProtectedRoute permission="admin.users.read">
  <AdminUsersPage />
</ProtectedRoute>
```

### Conditional Rendering
```typescript
<PermissionGate permission="chat.delete">
  <DeleteButton />
</PermissionGate>
```
