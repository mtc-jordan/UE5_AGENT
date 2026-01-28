/**
 * File Locks Hook
 * Manages file locking state and operations
 */
import { useState, useEffect, useCallback } from 'react';
import {
  FileLock,
  getAllLocks,
  acquireLock,
  releaseLock,
  checkFileAccess,
  requestFileAccess,
  AcquireLockRequest
} from '../lib/file-lock-api';

export interface UseFileLocksOptions {
  autoLoad?: boolean;
  refreshInterval?: number;
}

export interface UseFileLocksReturn {
  locks: Map<number, FileLock>;
  loading: boolean;
  error: string | null;
  acquireFileLock: (request: AcquireLockRequest) => Promise<void>;
  releaseFileLock: (fileId: number) => Promise<void>;
  checkAccess: (fileId: number) => Promise<{
    can_edit: boolean;
    can_view: boolean;
    lock?: FileLock;
    message?: string;
    warning?: string;
  }>;
  requestAccess: (fileId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing file locks
 */
export const useFileLocks = (
  options: UseFileLocksOptions = {}
): UseFileLocksReturn => {
  const { autoLoad = true, refreshInterval } = options;
  
  const [locks, setLocks] = useState<Map<number, FileLock>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load all locks
  const loadLocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllLocks();
      
      // Convert to Map for efficient lookup
      const locksMap = new Map<number, FileLock>();
      response.locks.forEach((lock) => {
        locksMap.set(lock.file_id, lock);
      });
      
      setLocks(locksMap);
    } catch (err: any) {
      console.error('Failed to load locks:', err);
      setError(err.message || 'Failed to load locks');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadLocks();
    }
  }, [autoLoad, loadLocks]);
  
  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;
    
    const interval = setInterval(() => {
      loadLocks();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval, loadLocks]);
  
  // Acquire lock
  const acquireFileLock = useCallback(async (request: AcquireLockRequest) => {
    try {
      const response = await acquireLock(request);
      
      // Update local state
      setLocks((prev) => {
        const next = new Map(prev);
        next.set(response.lock.file_id, response.lock);
        return next;
      });
      
      if (response.warning) {
        console.warn(response.warning);
      }
    } catch (err: any) {
      console.error('Failed to acquire lock:', err);
      throw err;
    }
  }, []);
  
  // Release lock
  const releaseFileLock = useCallback(async (fileId: number) => {
    try {
      await releaseLock(fileId);
      
      // Update local state
      setLocks((prev) => {
        const next = new Map(prev);
        next.delete(fileId);
        return next;
      });
    } catch (err: any) {
      console.error('Failed to release lock:', err);
      throw err;
    }
  }, []);
  
  // Check access
  const checkAccess = useCallback(async (fileId: number) => {
    return await checkFileAccess(fileId);
  }, []);
  
  // Request access
  const requestAccess = useCallback(async (fileId: number) => {
    await requestFileAccess(fileId);
  }, []);
  
  return {
    locks,
    loading,
    error,
    acquireFileLock,
    releaseFileLock,
    checkAccess,
    requestAccess,
    refresh: loadLocks
  };
};

export default useFileLocks;
