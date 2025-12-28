/**
 * RBAC API Client
 * 
 * Provides functions for role and permission management.
 */

import { api } from './api';

// ==================== Types ====================

export interface Permission {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
  is_active: boolean;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  level: number;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface RoleCreate {
  name: string;
  display_name: string;
  description?: string;
  level?: number;
  color?: string;
  icon?: string;
  permissions?: string[];
}

export interface RoleUpdate {
  display_name?: string;
  description?: string;
  level?: number;
  color?: string;
  icon?: string;
  is_active?: boolean;
}

export interface UserRoles {
  user_id: number;
  username: string;
  roles: Role[];
}

export interface UserPermissions {
  user_id: number;
  username: string;
  permissions: string[];
  role_permissions: string[];
  overrides: {
    permission: string;
    is_granted: boolean;
    expires_at: string | null;
    reason: string | null;
  }[];
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  target_type: string;
  target_id: number;
  target_name: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

// ==================== Role API ====================

export const rbacApi = {
  // Roles
  async getRoles(): Promise<Role[]> {
    const response = await api.get('/rbac/roles');
    return response.data;
  },

  async getRole(roleId: number): Promise<Role> {
    const response = await api.get(`/rbac/roles/${roleId}`);
    return response.data;
  },

  async createRole(data: RoleCreate): Promise<Role> {
    const response = await api.post('/rbac/roles', data);
    return response.data;
  },

  async updateRole(roleId: number, data: RoleUpdate): Promise<Role> {
    const response = await api.put(`/rbac/roles/${roleId}`, data);
    return response.data;
  },

  async deleteRole(roleId: number): Promise<void> {
    await api.delete(`/rbac/roles/${roleId}`);
  },

  async updateRolePermissions(roleId: number, permissions: string[]): Promise<void> {
    await api.put(`/rbac/roles/${roleId}/permissions`, { permissions });
  },

  // Permissions
  async getPermissions(): Promise<Permission[]> {
    const response = await api.get('/rbac/permissions');
    return response.data;
  },

  async getPermissionCategories(): Promise<string[]> {
    const response = await api.get('/rbac/permissions/categories');
    return response.data.categories;
  },

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    const response = await api.get(`/rbac/permissions/by-category/${category}`);
    return response.data;
  },

  // User Roles
  async getUserRoles(userId: number): Promise<UserRoles> {
    const response = await api.get(`/rbac/users/${userId}/roles`);
    return response.data;
  },

  async assignUserRole(userId: number, roleId: number, expiresAt?: string): Promise<void> {
    await api.post(`/rbac/users/${userId}/roles`, {
      role_id: roleId,
      expires_at: expiresAt
    });
  },

  async removeUserRole(userId: number, roleId: number): Promise<void> {
    await api.delete(`/rbac/users/${userId}/roles/${roleId}`);
  },

  // User Permissions
  async getUserPermissions(userId: number): Promise<UserPermissions> {
    const response = await api.get(`/rbac/users/${userId}/permissions`);
    return response.data;
  },

  async overrideUserPermission(
    userId: number,
    permissionName: string,
    isGranted: boolean,
    expiresAt?: string,
    reason?: string
  ): Promise<void> {
    await api.post(`/rbac/users/${userId}/permissions`, {
      permission_name: permissionName,
      is_granted: isGranted,
      expires_at: expiresAt,
      reason
    });
  },

  // Current User
  async getMyPermissions(): Promise<string[]> {
    const response = await api.get('/rbac/me/permissions');
    return response.data.permissions;
  },

  async getMyRoles(): Promise<{ id: number; name: string; display_name: string; level: number; color: string | null; icon: string | null }[]> {
    const response = await api.get('/rbac/me/roles');
    return response.data.roles;
  },

  async checkMyPermission(permission: string): Promise<boolean> {
    const response = await api.get(`/rbac/me/check/${permission}`);
    return response.data.granted;
  },

  // Audit Logs
  async getAuditLogs(params?: {
    user_id?: number;
    action?: string;
    target_type?: string;
    target_id?: number;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedAuditLogs> {
    const response = await api.get('/rbac/audit', { params });
    return response.data;
  },

  // Initialize
  async initializeRBAC(): Promise<void> {
    await api.post('/rbac/initialize');
  }
};

// ==================== Permission Helpers ====================

export const PERMISSION_CATEGORIES = {
  chat: 'Chat',
  project: 'Project',
  workspace: 'Workspace',
  plugin: 'Plugin',
  comparison: 'Comparison',
  mcp: 'MCP',
  agent: 'Agent',
  admin: 'Admin',
  subscription: 'Subscription',
  system: 'System'
} as const;

export const ROLE_COLORS: Record<string, string> = {
  owner: '#9333EA',
  admin: '#DC2626',
  manager: '#EA580C',
  developer: '#2563EB',
  analyst: '#059669',
  user: '#6B7280',
  guest: '#9CA3AF'
};

export const ROLE_ICONS: Record<string, string> = {
  owner: 'Crown',
  admin: 'Shield',
  manager: 'Users',
  developer: 'Code',
  analyst: 'BarChart',
  user: 'User',
  guest: 'Eye'
};

export function getRoleColor(roleName: string): string {
  return ROLE_COLORS[roleName] || '#6B7280';
}

export function getRoleIcon(roleName: string): string {
  return ROLE_ICONS[roleName] || 'User';
}

export function formatPermissionName(permission: string): string {
  const parts = permission.split('.');
  if (parts.length === 2) {
    const [category, action] = parts;
    return `${category.charAt(0).toUpperCase() + category.slice(1)} - ${action.charAt(0).toUpperCase() + action.slice(1)}`;
  }
  return permission;
}

export function groupPermissionsByCategory(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);
}
