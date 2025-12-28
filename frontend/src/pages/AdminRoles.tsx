/**
 * Admin Role Management Page
 * 
 * Provides UI for managing roles, permissions, and user assignments.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Users, Key, Plus, Edit2, Trash2, Save, X,
  ChevronDown, ChevronRight, Check, Search, Filter,
  Crown, Code, BarChart, Eye, User, AlertCircle, History
} from 'lucide-react';
import {
  rbacApi,
  Role,
  Permission,
  RoleCreate,
  RoleUpdate,
  AuditLog,
  groupPermissionsByCategory,
  PERMISSION_CATEGORIES,
  getRoleColor,
  getRoleIcon
} from '../lib/rbac-api';
import { usePermissions, AdminGate } from '../hooks/usePermissions';

// ==================== Role Icon Component ====================

const RoleIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className = '' }) => {
  const icons: Record<string, React.FC<{ className?: string }>> = {
    Crown, Shield, Users, Code, BarChart, Eye, User
  };
  const IconComponent = icons[icon] || User;
  return <IconComponent className={className} />;
};

// ==================== Main Component ====================

const AdminRoles: React.FC = () => {
  const { isAdmin, loading: permLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'audit'>('roles');
  
  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  
  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  
  // Search/filter
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesData, permsData] = await Promise.all([
        rbacApi.getRoles(),
        rbacApi.getPermissions()
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async (page: number = 1) => {
    try {
      const data = await rbacApi.getAuditLogs({ page, page_size: 20 });
      setAuditLogs(data.items);
      setAuditTotal(data.total);
      setAuditPage(page);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    return groupPermissionsByCategory(permissions);
  }, [permissions]);

  // Filter roles by search
  const filteredRoles = useMemo(() => {
    if (!searchTerm) return roles;
    const term = searchTerm.toLowerCase();
    return roles.filter(r =>
      r.name.toLowerCase().includes(term) ||
      r.display_name.toLowerCase().includes(term)
    );
  }, [roles, searchTerm]);

  // Handlers
  const handleCreateRole = () => {
    setIsCreating(true);
    setEditingRole({
      id: 0,
      name: '',
      display_name: '',
      description: '',
      level: 40,
      color: '#6B7280',
      icon: 'User',
      is_system: false,
      is_active: true,
      permissions: [],
      created_at: null,
      updated_at: null
    });
    setSelectedPermissions(new Set());
  };

  const handleEditRole = (role: Role) => {
    setIsCreating(false);
    setEditingRole(role);
    setSelectedPermissions(new Set(role.permissions));
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;

    try {
      if (isCreating) {
        const data: RoleCreate = {
          name: editingRole.name,
          display_name: editingRole.display_name,
          description: editingRole.description || undefined,
          level: editingRole.level,
          color: editingRole.color || undefined,
          icon: editingRole.icon || undefined,
          permissions: Array.from(selectedPermissions)
        };
        await rbacApi.createRole(data);
      } else {
        const data: RoleUpdate = {
          display_name: editingRole.display_name,
          description: editingRole.description || undefined,
          level: editingRole.level,
          color: editingRole.color || undefined,
          icon: editingRole.icon || undefined,
          is_active: editingRole.is_active
        };
        await rbacApi.updateRole(editingRole.id, data);
        await rbacApi.updateRolePermissions(editingRole.id, Array.from(selectedPermissions));
      }
      
      setEditingRole(null);
      setIsCreating(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await rbacApi.deleteRole(roleId);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const togglePermission = (permName: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permName)) {
      newSelected.delete(permName);
    } else {
      newSelected.add(permName);
    }
    setSelectedPermissions(newSelected);
  };

  const selectAllInCategory = (category: string) => {
    const categoryPerms = groupedPermissions[category] || [];
    const newSelected = new Set(selectedPermissions);
    categoryPerms.forEach(p => newSelected.add(p.name));
    setSelectedPermissions(newSelected);
  };

  const deselectAllInCategory = (category: string) => {
    const categoryPerms = groupedPermissions[category] || [];
    const newSelected = new Set(selectedPermissions);
    categoryPerms.forEach(p => newSelected.delete(p.name));
    setSelectedPermissions(newSelected);
  };

  if (permLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Shield className="w-16 h-16 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-7 h-7 text-purple-500" />
              Role Management
            </h1>
            <p className="text-gray-400 mt-1">Manage roles, permissions, and access control</p>
          </div>
          
          {activeTab === 'roles' && (
            <button
              onClick={handleCreateRole}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Role
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-6">
          {[
            { id: 'roles', label: 'Roles', icon: Shield },
            { id: 'permissions', label: 'Permissions', icon: Key },
            { id: 'audit', label: 'Audit Log', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'roles' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Roles List */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {filteredRoles.map(role => (
                <div
                  key={role.id}
                  className={`p-4 bg-gray-800 rounded-lg border transition-colors cursor-pointer ${
                    editingRole?.id === role.id
                      ? 'border-purple-500'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => handleEditRole(role)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: role.color || '#6B7280' }}
                      >
                        <RoleIcon icon={role.icon || 'User'} className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{role.display_name}</h3>
                        <p className="text-sm text-gray-400">{role.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {role.is_system && (
                        <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                          System
                        </span>
                      )}
                      <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                        Level {role.level}
                      </span>
                      {!role.is_system && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRole(role.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">{role.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {role.permissions.slice(0, 5).map(perm => (
                      <span key={perm} className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                        {perm}
                      </span>
                    ))}
                    {role.permissions.length > 5 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                        +{role.permissions.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Role Editor */}
            {editingRole && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">
                    {isCreating ? 'Create Role' : 'Edit Role'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRole(null);
                        setIsCreating(false);
                      }}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleSaveRole}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>

                {/* Role Details */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={editingRole.name}
                        onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                        disabled={editingRole.is_system}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={editingRole.display_name}
                        onChange={(e) => setEditingRole({ ...editingRole, display_name: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                    <textarea
                      value={editingRole.description || ''}
                      onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Level</label>
                      <input
                        type="number"
                        value={editingRole.level}
                        onChange={(e) => setEditingRole({ ...editingRole, level: parseInt(e.target.value) })}
                        disabled={editingRole.is_system}
                        min={0}
                        max={100}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Color</label>
                      <input
                        type="color"
                        value={editingRole.color || '#6B7280'}
                        onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                        className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Icon</label>
                      <select
                        value={editingRole.icon || 'User'}
                        onChange={(e) => setEditingRole({ ...editingRole, icon: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      >
                        <option value="Crown">Crown</option>
                        <option value="Shield">Shield</option>
                        <option value="Users">Users</option>
                        <option value="Code">Code</option>
                        <option value="BarChart">Chart</option>
                        <option value="User">User</option>
                        <option value="Eye">Eye</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    Permissions ({selectedPermissions.size} selected)
                  </h3>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                      <div key={category} className="bg-gray-700 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-600 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="font-medium text-white capitalize">{category}</span>
                            <span className="text-sm text-gray-400">
                              ({perms.filter(p => selectedPermissions.has(p.name)).length}/{perms.length})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllInCategory(category);
                              }}
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >
                              All
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deselectAllInCategory(category);
                              }}
                              className="text-xs text-gray-400 hover:text-gray-300"
                            >
                              None
                            </button>
                          </div>
                        </button>
                        
                        {expandedCategories.has(category) && (
                          <div className="p-3 pt-0 space-y-1">
                            {perms.map(perm => (
                              <label
                                key={perm.id}
                                className="flex items-center gap-2 p-2 hover:bg-gray-600 rounded cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.has(perm.name)}
                                  onChange={() => togglePermission(perm.name)}
                                  className="w-4 h-4 rounded border-gray-500 text-purple-600 focus:ring-purple-500 bg-gray-600"
                                />
                                <div>
                                  <span className="text-sm text-white">{perm.display_name}</span>
                                  <span className="text-xs text-gray-400 ml-2">({perm.name})</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-4">
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <div key={category} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="font-semibold text-white capitalize flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-500" />
                    {PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES] || category}
                    <span className="text-sm text-gray-400 font-normal">({perms.length} permissions)</span>
                  </h3>
                </div>
                <div className="divide-y divide-gray-700">
                  {perms.map(perm => (
                    <div key={perm.id} className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">{perm.display_name}</h4>
                        <p className="text-sm text-gray-400">{perm.name}</p>
                        {perm.description && (
                          <p className="text-sm text-gray-500 mt-1">{perm.description}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        perm.is_active
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}>
                        {perm.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Action</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Target</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        User #{log.user_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${
                          log.action.includes('created') ? 'bg-green-900/50 text-green-400' :
                          log.action.includes('deleted') ? 'bg-red-900/50 text-red-400' :
                          log.action.includes('denied') ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-blue-900/50 text-blue-400'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.target_type} #{log.target_id}
                        {log.target_name && ` (${log.target_name})`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {log.new_value && (
                          <code className="text-xs bg-gray-700 px-1 py-0.5 rounded">
                            {JSON.stringify(log.new_value).slice(0, 50)}...
                          </code>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                Showing {auditLogs.length} of {auditTotal} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchAuditLogs(auditPage - 1)}
                  disabled={auditPage === 1}
                  className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchAuditLogs(auditPage + 1)}
                  disabled={auditLogs.length < 20}
                  className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRoles;
