/**
 * UE5 AI Studio - Workspace API Client
 * =====================================
 * 
 * TypeScript client for workspace file operations.
 * 
 * Version: 2.0.0
 */

import { api } from './api';

// =============================================================================
// TYPES
// =============================================================================

export type FileType = 'file' | 'folder';

export interface WorkspaceFile {
  id: number;
  name: string;
  path: string;
  file_type: FileType;
  parent_id: number | null;
  content: string | null;
  mime_type: string | null;
  size: number;
  language: string | null;
  is_readonly: boolean;
  is_generated: boolean;
  version: number;
  project_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface FileTreeNode {
  id: number;
  name: string;
  path: string;
  file_type: FileType;
  size: number;
  language: string | null;
  is_generated: boolean;
  children: FileTreeNode[];
  // UI state
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface FileVersion {
  id: number;
  version_number: number;
  size: number;
  change_type: string | null;
  change_description: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface WorkspaceStats {
  file_count: number;
  folder_count: number;
  total_size: number;
  generated_count: number;
}

export interface SearchResult {
  id: number;
  name: string;
  path: string;
  file_type: FileType;
  language: string | null;
  match_preview: string | null;
}

export interface CreateFileRequest {
  path: string;
  content?: string;
  project_id?: number;
}

export interface CreateFolderRequest {
  path: string;
  project_id?: number;
}

export interface UpdateFileRequest {
  content: string;
}

export interface RenameFileRequest {
  new_name: string;
}

export interface MoveFileRequest {
  new_parent_path: string;
}

export interface CopyFileRequest {
  dest_path: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Create a new file
 */
export async function createFile(data: CreateFileRequest): Promise<WorkspaceFile> {
  const response = await api.post('/workspace/files', data);
  return response.data;
}

/**
 * Create a new folder
 */
export async function createFolder(data: CreateFolderRequest): Promise<WorkspaceFile> {
  const response = await api.post('/workspace/folders', data);
  return response.data;
}

/**
 * Get a file by ID
 */
export async function getFile(fileId: number, projectId?: number): Promise<WorkspaceFile> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.get(`/workspace/files/${fileId}`, { params });
  return response.data;
}

/**
 * Get a file by path
 */
export async function getFileByPath(path: string, projectId?: number): Promise<WorkspaceFile> {
  const params: any = { path };
  if (projectId) params.project_id = projectId;
  const response = await api.get('/workspace/files/by-path', { params });
  return response.data;
}

/**
 * List files in a directory
 */
export async function listFiles(
  parentPath: string = '/',
  options?: {
    projectId?: number;
    includeChildren?: boolean;
    fileType?: FileType;
  }
): Promise<WorkspaceFile[]> {
  const params: any = { parent_path: parentPath };
  if (options?.projectId) params.project_id = options.projectId;
  if (options?.includeChildren) params.include_children = true;
  if (options?.fileType) params.file_type = options.fileType;
  
  const response = await api.get('/workspace/files', { params });
  return response.data;
}

/**
 * Get hierarchical file tree
 */
export async function getFileTree(
  rootPath: string = '/',
  projectId?: number
): Promise<FileTreeNode[]> {
  const params: any = { root_path: rootPath };
  if (projectId) params.project_id = projectId;
  
  const response = await api.get('/workspace/tree', { params });
  return response.data;
}

/**
 * Update file content
 */
export async function updateFile(
  fileId: number,
  data: UpdateFileRequest,
  projectId?: number
): Promise<WorkspaceFile> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.put(`/workspace/files/${fileId}`, data, { params });
  return response.data;
}

/**
 * Rename a file or folder
 */
export async function renameFile(
  fileId: number,
  data: RenameFileRequest,
  projectId?: number
): Promise<WorkspaceFile> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.patch(`/workspace/files/${fileId}/rename`, data, { params });
  return response.data;
}

/**
 * Move a file or folder
 */
export async function moveFile(
  fileId: number,
  data: MoveFileRequest,
  projectId?: number
): Promise<WorkspaceFile> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.patch(`/workspace/files/${fileId}/move`, data, { params });
  return response.data;
}

/**
 * Copy a file
 */
export async function copyFile(
  fileId: number,
  data: CopyFileRequest,
  projectId?: number
): Promise<WorkspaceFile> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.post(`/workspace/files/${fileId}/copy`, data, { params });
  return response.data;
}

/**
 * Delete a file or folder
 */
export async function deleteFile(
  fileId: number,
  options?: {
    projectId?: number;
    permanent?: boolean;
  }
): Promise<void> {
  const params: any = {};
  if (options?.projectId) params.project_id = options.projectId;
  if (options?.permanent) params.permanent = true;
  
  await api.delete(`/workspace/files/${fileId}`, { params });
}

/**
 * Get file version history
 */
export async function getFileVersions(
  fileId: number,
  options?: {
    projectId?: number;
    limit?: number;
  }
): Promise<FileVersion[]> {
  const params: any = {};
  if (options?.projectId) params.project_id = options.projectId;
  if (options?.limit) params.limit = options.limit;
  
  const response = await api.get(`/workspace/files/${fileId}/versions`, { params });
  return response.data;
}

/**
 * Restore a file to a previous version
 */
export async function restoreFileVersion(
  fileId: number,
  versionNumber: number,
  projectId?: number
): Promise<WorkspaceFile> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.post(
    `/workspace/files/${fileId}/versions/${versionNumber}/restore`,
    {},
    { params }
  );
  return response.data;
}

/**
 * Search files
 */
export async function searchFiles(
  query: string,
  options?: {
    projectId?: number;
    fileType?: FileType;
    limit?: number;
  }
): Promise<SearchResult[]> {
  const params: any = { q: query };
  if (options?.projectId) params.project_id = options.projectId;
  if (options?.fileType) params.file_type = options.fileType;
  if (options?.limit) params.limit = options.limit;
  
  const response = await api.get('/workspace/search', { params });
  return response.data;
}

/**
 * Get workspace statistics
 */
export async function getWorkspaceStats(projectId?: number): Promise<WorkspaceStats> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.get('/workspace/stats', { params });
  return response.data;
}

/**
 * Upload a file
 */
export async function uploadFile(
  file: File,
  path: string,
  projectId?: number
): Promise<WorkspaceFile> {
  const formData = new FormData();
  formData.append('file', file);
  
  const params: any = { path };
  if (projectId) params.project_id = projectId;
  
  const response = await api.post('/workspace/upload', formData, {
    params,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Download a file
 */
export async function downloadFile(fileId: number, projectId?: number): Promise<Blob> {
  const params = projectId ? { project_id: projectId } : {};
  const response = await api.get(`/workspace/files/${fileId}/download`, {
    params,
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Bulk create files
 */
export async function bulkCreateFiles(
  files: CreateFileRequest[]
): Promise<WorkspaceFile[]> {
  const response = await api.post('/workspace/bulk/create', { files });
  return response.data;
}

/**
 * Bulk delete files
 */
export async function bulkDeleteFiles(
  fileIds: number[],
  permanent: boolean = false
): Promise<void> {
  await api.post('/workspace/bulk/delete', { file_ids: fileIds, permanent });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get file icon based on language/type
 */
export function getFileIcon(file: { file_type: FileType; language?: string | null; name: string }): string {
  if (file.file_type === 'folder') {
    return '📁';
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, string> = {
    // Code
    cpp: '⚙️',
    h: '📋',
    hpp: '📋',
    c: '⚙️',
    py: '🐍',
    js: '📜',
    ts: '📘',
    jsx: '⚛️',
    tsx: '⚛️',
    
    // Web
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    json: '📋',
    
    // Config
    yaml: '⚙️',
    yml: '⚙️',
    ini: '⚙️',
    toml: '⚙️',
    
    // Docs
    md: '📝',
    txt: '📄',
    
    // UE5
    uasset: '🎮',
    umap: '🗺️',
    uplugin: '🔌',
    uproject: '🎮',
  };
  
  return iconMap[ext || ''] || '📄';
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Get language display name
 */
export function getLanguageDisplayName(language: string | null): string {
  if (!language) return 'Plain Text';
  
  const names: Record<string, string> = {
    cpp: 'C++',
    c: 'C',
    python: 'Python',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    yaml: 'YAML',
    markdown: 'Markdown',
    plaintext: 'Plain Text',
    csharp: 'C#',
    bash: 'Bash',
    batch: 'Batch',
    powershell: 'PowerShell',
    ini: 'INI',
    xml: 'XML',
  };
  
  return names[language] || language;
}

/**
 * Check if file is editable
 */
export function isFileEditable(file: WorkspaceFile): boolean {
  if (file.file_type === 'folder') return false;
  if (file.is_readonly) return false;
  
  // Binary files are not editable
  const binaryExtensions = ['uasset', 'umap', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'icns'];
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  return !binaryExtensions.includes(ext || '');
}

/**
 * Sort files (folders first, then alphabetically)
 */
export function sortFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return [...files].sort((a, b) => {
    // Folders first
    if (a.file_type !== b.file_type) {
      return a.file_type === 'folder' ? -1 : 1;
    }
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });
}
