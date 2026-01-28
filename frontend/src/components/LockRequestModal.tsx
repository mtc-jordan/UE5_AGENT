/**
 * Lock Request Modal Component
 * Allows users to request access to locked files
 */
import React, { useState } from 'react';
import { X, Lock, Send } from 'lucide-react';
import { FileLock } from './FileLockIndicator';

interface LockRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  lock: FileLock;
  fileName: string;
  onRequestAccess: (message?: string) => Promise<void>;
}

export const LockRequestModal: React.FC<LockRequestModalProps> = ({
  isOpen,
  onClose,
  lock,
  fileName,
  onRequestAccess
}) => {
  const [message, setMessage] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isOpen) return null;

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    try {
      await onRequestAccess(message || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to request access:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-white">
              File is Locked
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* File info */}
          <div className="bg-gray-900 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">File:</span>
              <span className="text-sm text-white font-mono">{fileName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Locked by:</span>
              <span className="text-sm text-white">User {lock.user_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Reason:</span>
              <span className="text-sm text-white">{lock.reason}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Lock type:</span>
              <span
                className={`text-sm font-medium ${
                  lock.lock_type === 'hard' ? 'text-red-400' : 'text-yellow-400'
                }`}
              >
                {lock.lock_type === 'hard' ? 'Hard Lock' : 'Soft Lock'}
              </span>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <p className="text-sm text-gray-300">
              This file is currently locked. You can request access from the lock owner.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional: Add a message to your request..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            disabled={isRequesting}
          >
            Cancel
          </button>
          <button
            onClick={handleRequestAccess}
            disabled={isRequesting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isRequesting ? 'Requesting...' : 'Request Access'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockRequestModal;
