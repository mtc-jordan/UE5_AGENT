/**
 * File Lock Indicator Component
 * Shows lock status on files in the file browser
 */
import React from 'react';
import { Lock, LockOpen, AlertCircle } from 'lucide-react';

export interface FileLock {
  file_id: number;
  user_id: number;
  lock_type: 'soft' | 'hard';
  reason: string;
  created_at: string;
  expires_at?: string;
  auto_unlock: boolean;
}

interface FileLockIndicatorProps {
  lock?: FileLock | null;
  currentUserId: number;
  className?: string;
}

export const FileLockIndicator: React.FC<FileLockIndicatorProps> = ({
  lock,
  currentUserId,
  className = ''
}) => {
  if (!lock) {
    return null;
  }

  const isOwner = lock.user_id === currentUserId;
  const isHardLock = lock.lock_type === 'hard';

  // Calculate time since lock
  const timeSince = () => {
    const now = new Date();
    const created = new Date(lock.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {isHardLock ? (
        <Lock
          className={`w-3.5 h-3.5 ${
            isOwner ? 'text-blue-500' : 'text-red-500'
          }`}
          title={
            isOwner
              ? `You locked this file (${lock.reason})`
              : `Locked by user ${lock.user_id} (${lock.reason})`
          }
        />
      ) : (
        <AlertCircle
          className={`w-3.5 h-3.5 ${
            isOwner ? 'text-yellow-500' : 'text-orange-500'
          }`}
          title={
            isOwner
              ? `You're editing this file (${lock.reason})`
              : `Being edited by user ${lock.user_id} (${lock.reason})`
          }
        />
      )}
      <span
        className={`text-xs ${
          isOwner
            ? isHardLock
              ? 'text-blue-400'
              : 'text-yellow-400'
            : isHardLock
            ? 'text-red-400'
            : 'text-orange-400'
        }`}
        title={`Locked ${timeSince()}`}
      >
        {isOwner ? 'You' : `User ${lock.user_id}`}
      </span>
    </div>
  );
};

export default FileLockIndicator;
