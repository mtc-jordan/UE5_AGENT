/**
 * File Lock API Client
 * Handles all file locking operations
 */
import api from './api';

export interface FileLock {
  file_id: number;
  user_id: number;
  lock_type: 'soft' | 'hard';
  reason: string;
  created_at: string;
  expires_at?: string;
  auto_unlock: boolean;
}

export interface AcquireLockRequest {
  file_id: number;
  lock_type?: 'soft' | 'hard';
  reason?: string;
  duration_minutes?: number;
}

export interface AcquireLockResponse {
  success: boolean;
  message: string;
  warning?: string;
  lock: FileLock;
}

export interface ReleaseLockResponse {
  success: boolean;
  message: string;
  waiting_users?: number[];
}

export interface CheckAccessResponse {
  can_edit: boolean;
  can_view: boolean;
  lock?: FileLock;
  message?: string;
  warning?: string;
}

export interface RequestAccessResponse {
  success: boolean;
  message: string;
  lock_owner: number;
}

/**
 * Acquire a lock on a file
 */
export const acquireLock = async (
  request: AcquireLockRequest
): Promise<AcquireLockResponse> => {
  const response = await api.post('/file-locks/acquire', request);
  return response.data;
};

/**
 * Release a lock on a file
 */
export const releaseLock = async (fileId: number): Promise<ReleaseLockResponse> => {
  const response = await api.post('/file-locks/release', { file_id: fileId });
  return response.data;
};

/**
 * Get lock information for a file
 */
export const getFileLock = async (
  fileId: number
): Promise<{ locked: boolean; lock?: FileLock }> => {
  const response = await api.get(`/file-locks/file/${fileId}`);
  return response.data;
};

/**
 * Check if current user can access a file
 */
export const checkFileAccess = async (
  fileId: number
): Promise<CheckAccessResponse> => {
  const response = await api.get(`/file-locks/file/${fileId}/access`);
  return response.data;
};

/**
 * Request access to a locked file
 */
export const requestFileAccess = async (
  fileId: number
): Promise<RequestAccessResponse> => {
  const response = await api.post('/file-locks/request-access', { file_id: fileId });
  return response.data;
};

/**
 * Get list of users requesting access to a file
 */
export const getAccessRequests = async (
  fileId: number
): Promise<{ file_id: number; requests: number[] }> => {
  const response = await api.get(`/file-locks/file/${fileId}/requests`);
  return response.data;
};

/**
 * Get all active locks
 */
export const getAllLocks = async (): Promise<{ locks: FileLock[] }> => {
  const response = await api.get('/file-locks/all');
  return response.data;
};

/**
 * Get locks held by current user
 */
export const getUserLocks = async (): Promise<{ locks: FileLock[] }> => {
  const response = await api.get('/file-locks/user');
  return response.data;
};

/**
 * Release all locks held by current user
 */
export const releaseAllUserLocks = async (): Promise<{
  success: boolean;
  message: string;
  released_files: number[];
}> => {
  const response = await api.delete('/file-locks/user/all');
  return response.data;
};
