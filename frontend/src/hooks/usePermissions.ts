/**
 * usePermissions Hook
 * 
 * React hook for permission checking and role management.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { rbacApi} from '../lib/rbac-api';

interface UsePermissionsResult {
  permissions: string[];
  roles: { id: number; name: string; display_name: string; level: number; color: string | null; icon: string | null }[];
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (roleName: string) => boolean;
  hasAnyRole: (roleNames: string[]) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isDeveloper: boolean;
  refresh: () => Promise<void>;
}

export function usePermissions(): UsePermissionsResult {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string; display_name: string; level: number; color: string | null; icon: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [perms, userRoles] = await Promise.all([
        rbacApi.getMyPermissions(),
        rbacApi.getMyRoles()
      ]);
      
      setPermissions(perms);
      setRoles(userRoles);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch permissions');
      // Set empty permissions on error
      setPermissions([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((permission: string): boolean => {
    // Owner with system.all has all permissions
    if (permissions.includes('system.all')) {
      return true;
    }
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((perms: string[]): boolean => {
    if (permissions.includes('system.all')) {
      return true;
    }
    return perms.some(p => permissions.includes(p));
  }, [permissions]);

  const hasAllPermissions = useCallback((perms: string[]): boolean => {
    if (permissions.includes('system.all')) {
      return true;
    }
    return perms.every(p => permissions.includes(p));
  }, [permissions]);

  const hasRole = useCallback((roleName: string): boolean => {
    return roles.some(r => r.name === roleName);
  }, [roles]);

  const hasAnyRole = useCallback((roleNames: string[]): boolean => {
    return roleNames.some(name => roles.some(r => r.name === name));
  }, [roles]);

  const isOwner = useMemo(() => hasRole('owner'), [hasRole]);
  const isAdmin = useMemo(() => hasAnyRole(['owner', 'admin']), [hasAnyRole]);
  const isManager = useMemo(() => hasAnyRole(['owner', 'admin', 'manager']), [hasAnyRole]);
  const isDeveloper = useMemo(() => hasAnyRole(['owner', 'admin', 'manager', 'developer']), [hasAnyRole]);

  return {
    permissions,
    roles,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isOwner,
    isAdmin,
    isManager,
    isDeveloper,
    refresh: fetchPermissions
  };
}

// ==================== Permission Gate Component ====================

interface PermissionGateProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  roles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  fallback = null,
  children
}: PermissionGateProps): React.ReactNode {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, loading } = usePermissions();

  if (loading) {
    return fallback;
  }

  // Check role first
  if (role && !hasRole(role)) {
    return fallback;
  }

  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    return fallback;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    if (requireAll && !hasAllPermissions(permissions)) {
      return fallback;
    }
    if (!requireAll && !hasAnyPermission(permissions)) {
      return fallback;
    }
  }

  return children;
}

// ==================== Admin Gate Component ====================

interface AdminGateProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminGate({ fallback = null, children }: AdminGateProps): React.ReactNode {
  const { isAdmin, loading } = usePermissions();

  if (loading) {
    return fallback;
  }

  if (!isAdmin) {
    return fallback;
  }

  return children;
}

// ==================== Owner Gate Component ====================

export function OwnerGate({ fallback = null, children }: AdminGateProps): React.ReactNode {
  const { isOwner, loading } = usePermissions();

  if (loading) {
    return fallback;
  }

  if (!isOwner) {
    return fallback;
  }

  return children;
}

export default usePermissions;
