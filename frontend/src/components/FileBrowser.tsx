/**
 * UE5 AI Studio - File Browser Component
 * =======================================
 * 
 * A modern file browser with tree view, context menu, and drag-drop support.
 * 
 * Version: 2.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { FileLockIndicator, FileLock } from './FileLockIndicator';
import {
  FileTreeNode,
  WorkspaceFile,
  getFileTree,
  listFiles,
  getFile,
  createFile,
  createFolder,
  deleteFile,
  renameFile,
  formatFileSize} from '../lib/workspace-api';
import { FileIcon, LanguageBadge, FileSizeBadge } from '../lib/file-icons';

// =============================================================================
// TYPES
// =============================================================================

interface FileBrowserProps {
  projectId?: number;
  onFileSelect?: (file: WorkspaceFile) => void;
  onFileOpen?: (file: WorkspaceFile) => void;
  selectedFileId?: number;
  className?: string;
  fileLocks?: Map<number, FileLock>;
  currentUserId?: number;
}

interface TreeNodeProps {
  node: FileTreeNode;
  level: number;
  selectedId?: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (node: FileTreeNode) => void;
  onDoubleClick: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  fileLocks?: Map<number, FileLock>;
  currentUserId?: number;
}

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileTreeNode | null;
  onClose: () => void;
  onAction: (action: string) => void;
}

// =============================================================================
// TREE NODE COMPONENT
// =============================================================================

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedId,
  expandedPaths,
  onToggle,
  onSelect,
  onDoubleClick,
  onContextMenu,
  fileLocks,
  currentUserId}) => {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.id === selectedId;
  const isFolder = node.file_type === 'folder';
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
    if (isFolder) {
      onToggle(node.path);
    }
  };
  
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick(node);
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };
  
  return (
    <div className="select-none">
      <div
        className={`
          flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md
          hover:bg-gray-700/50 transition-all duration-150
          hover:scale-[1.01] hover:shadow-sm
          ${isSelected ? 'bg-blue-600/30 text-blue-300 ring-1 ring-blue-500/50' : 'text-gray-300'}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse Icon */}
        {isFolder && (
          <span className="w-4 flex items-center justify-center transition-transform duration-200">
            {isExpanded ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )}
          </span>
        )}
        {!isFolder && <span className="w-4" />}
        
        {/* File Icon */}
        <FileIcon
          fileName={node.name}
          fileType={node.file_type}
          language={node.language}
          isOpen={isExpanded}
          size={16}
        />
        
        {/* File Name */}
        <span className="truncate flex-1 text-sm font-medium">{node.name}</span>
        
        {/* Language Badge */}
        {!isFolder && (
          <LanguageBadge fileName={node.name} language={node.language} />
        )}
        
        {/* AI Generated Badge */}
        {node.is_generated && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-purple-600/20 text-purple-300 rounded border border-purple-500/30">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
            AI
          </span>
        )}
        
        {/* Lock indicator */}
        {!isFolder && fileLocks && currentUserId && fileLocks.has(node.id) && (
          <FileLockIndicator
            lock={fileLocks.get(node.id)}
            currentUserId={currentUserId}
          />
        )}
        
        {/* Size (for files) */}
        {!isFolder && node.size > 0 && (
          <FileSizeBadge size={node.size} />
        )}
      </div>
      
      {/* Children */}
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
              fileLocks={fileLocks}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// CONTEXT MENU COMPONENT
// =============================================================================

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onAction}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);
  
  const isFolder = node?.file_type === 'folder';
  
  const menuItems = [
    ...(isFolder ? [
      { id: 'new-file', label: 'New File', icon: '📄' },
      { id: 'new-folder', label: 'New Folder', icon: '📁' },
      { id: 'divider-1', divider: true },
    ] : []),
    { id: 'rename', label: 'Rename', icon: '✏️' },
    { id: 'duplicate', label: 'Duplicate', icon: '📋' },
    { id: 'divider-2', divider: true },
    { id: 'delete', label: 'Delete', icon: '🗑️', danger: true },
  ];
  
  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => (
        item.divider ? (
          <div key={`divider-${index}`} className="border-t border-gray-700 my-1" />
        ) : (
          <button
            key={item.id}
            className={`
              w-full px-3 py-2 text-left text-sm flex items-center gap-2
              hover:bg-gray-700 transition-colors
              ${item.danger ? 'text-red-400 hover:text-red-300' : 'text-gray-300'}
            `}
            onClick={() => {
              onAction(item.id);
              onClose();
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      ))}
    </div>
  );
};

// =============================================================================
// NEW FILE/FOLDER DIALOG
// =============================================================================

interface NewItemDialogProps {
  type: 'file' | 'folder';
  parentPath: string;
  onClose: () => void;
  onCreate: (name: string) => void;
}

const NewItemDialog: React.FC<NewItemDialogProps> = ({
  type,
  parentPath,
  onClose,
  onCreate}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    // Basic validation
    if (/[<>:"/\\|?*]/.test(name)) {
      setError('Name contains invalid characters');
      return;
    }
    
    onCreate(name.trim());
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">
          New {type === 'file' ? 'File' : 'Folder'}
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              {type === 'file' ? 'File name' : 'Folder name'}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder={type === 'file' ? 'example.cpp' : 'NewFolder'}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
            />
            {error && (
              <p className="text-red-400 text-sm mt-1">{error}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Will be created in: {parentPath}
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// RENAME DIALOG
// =============================================================================

interface RenameDialogProps {
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

const RenameDialog: React.FC<RenameDialogProps> = ({
  currentName,
  onClose,
  onRename}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (/[<>:"/\\|?*]/.test(name)) {
      setError('Name contains invalid characters');
      return;
    }
    
    onRename(name.trim());
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Rename</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
            />
            {error && (
              <p className="text-red-400 text-sm mt-1">{error}</p>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN FILE BROWSER COMPONENT
// =============================================================================

export const FileBrowser: React.FC<FileBrowserProps> = ({
  projectId,
  onFileSelect,
  onFileOpen,
  selectedFileId,
  className = '',
  fileLocks,
  currentUserId}) => {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [selectedNode, setSelectedNode] = useState<FileTreeNode | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileTreeNode | null;
  } | null>(null);
  
  // Dialog state
  const [newItemDialog, setNewItemDialog] = useState<{
    type: 'file' | 'folder';
    parentPath: string;
  } | null>(null);
  const [renameDialog, setRenameDialog] = useState<FileTreeNode | null>(null);
  
  // Load file tree
  const loadTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFileTree('/', projectId);
      setTree(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    loadTree();
  }, [loadTree]);
  
  // Handle toggle expand/collapse
  const handleToggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  
  // Handle select
  const handleSelect = async (node: FileTreeNode) => {
    setSelectedNode(node);
    
    if (node.file_type === 'file' && onFileSelect) {
      try {
        const files = await listFiles(node.path.replace(`/${node.name}`, '') || '/');
        const file = files.find(f => f.id === node.id);
        if (file) {
          onFileSelect(file);
        }
      } catch (err) {
        console.error('Failed to get file details:', err);
      }
    }
  };
  
  // Handle double click (open file)
  const handleDoubleClick = async (node: FileTreeNode) => {
    if (node.file_type === 'file' && onFileOpen) {
      try {
        // Fetch full file with content
        const file = await getFile(node.id, projectId);
        if (file) {
          onFileOpen(file);
        }
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    }
  };
  
  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node});
  };
  
  // Handle context menu action
  const handleContextAction = async (action: string) => {
    if (!contextMenu?.node) return;
    
    const node = contextMenu.node;
    
    switch (action) {
      case 'new-file':
        setNewItemDialog({ type: 'file', parentPath: node.path });
        break;
        
      case 'new-folder':
        setNewItemDialog({ type: 'folder', parentPath: node.path });
        break;
        
      case 'rename':
        setRenameDialog(node);
        break;
        
      case 'duplicate':
        // TODO: Implement duplicate
        break;
        
      case 'delete':
        if (confirm(`Delete "${node.name}"?`)) {
          try {
            await deleteFile(node.id);
            await loadTree();
          } catch (err: any) {
            alert(err.message || 'Failed to delete');
          }
        }
        break;
    }
  };
  
  // Handle create new item
  const handleCreate = async (name: string) => {
    if (!newItemDialog) return;
    
    try {
      const path = newItemDialog.parentPath === '/'
        ? `/${name}`
        : `${newItemDialog.parentPath}/${name}`;
      
      if (newItemDialog.type === 'file') {
        await createFile({ path, project_id: projectId });
      } else {
        await createFolder({ path, project_id: projectId });
      }
      
      // Expand parent and reload
      setExpandedPaths((prev) => new Set([...prev, newItemDialog.parentPath]));
      await loadTree();
      setNewItemDialog(null);
    } catch (err: any) {
      alert(err.message || 'Failed to create');
    }
  };
  
  // Handle rename
  const handleRename = async (newName: string) => {
    if (!renameDialog) return;
    
    try {
      await renameFile(renameDialog.id, { new_name: newName });
      await loadTree();
      setRenameDialog(null);
    } catch (err: any) {
      alert(err.message || 'Failed to rename');
    }
  };
  
  // Handle root context menu
  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node: { id: 0, name: '/', path: '/', file_type: 'folder', size: 0, language: null, is_generated: false, children: [] }});
  };
  
  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300">Files</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setNewItemDialog({ type: 'file', parentPath: '/' })}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="New File"
          >
            📄
          </button>
          <button
            onClick={() => setNewItemDialog({ type: 'folder', parentPath: '/' })}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="New Folder"
          >
            📁
          </button>
          <button
            onClick={loadTree}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>
      
      {/* Tree */}
      <div
        className="flex-1 overflow-auto py-2"
        onContextMenu={handleRootContextMenu}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin text-2xl">⏳</div>
          </div>
        ) : error ? (
          <div className="text-center text-red-400 p-4">
            <p>{error}</p>
            <button
              onClick={loadTree}
              className="mt-2 text-blue-400 hover:text-blue-300"
            >
              Retry
            </button>
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center text-gray-500 p-4">
            <p>No files yet</p>
            <p className="text-sm mt-1">Right-click to create</p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              selectedId={selectedFileId || selectedNode?.id}
              expandedPaths={expandedPaths}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              fileLocks={fileLocks}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
      
      {/* New Item Dialog */}
      {newItemDialog && (
        <NewItemDialog
          type={newItemDialog.type}
          parentPath={newItemDialog.parentPath}
          onClose={() => setNewItemDialog(null)}
          onCreate={handleCreate}
        />
      )}
      
      {/* Rename Dialog */}
      {renameDialog && (
        <RenameDialog
          currentName={renameDialog.name}
          onClose={() => setRenameDialog(null)}
          onRename={handleRename}
        />
      )}
    </div>
  );
};

export default FileBrowser;
