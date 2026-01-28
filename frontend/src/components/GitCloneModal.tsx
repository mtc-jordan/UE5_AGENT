/**
 * Git Clone Modal Component
 * Interface for cloning repositories
 */

import React, { useState } from 'react';
import { X, GitBranch, Download, AlertCircle } from 'lucide-react';
import * as gitApi from '../lib/git-api';
import { toast } from 'react-hot-toast';

interface GitCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const GitCloneModal: React.FC<GitCloneModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState('');

  const handleClone = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    setCloning(true);
    setError('');

    try {
      await gitApi.cloneRepository(repoUrl, branch || undefined);
      toast.success('Repository cloned successfully');
      setRepoUrl('');
      setBranch('');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to clone repository';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setCloning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !cloning) {
      handleClone();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-200">Clone Repository</h2>
          </div>
          <button
            onClick={onClose}
            disabled={cloning}
            className="p-2 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Repository URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Repository URL *
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder="https://github.com/username/repository.git"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              disabled={cloning}
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter the HTTPS or SSH URL of the repository you want to clone
            </p>
          </div>

          {/* Branch (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Branch (Optional)
            </label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="main"
                className="w-full pl-11 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                disabled={cloning}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Leave empty to clone the default branch
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-900/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300 font-medium">Clone Failed</p>
                <p className="text-sm text-red-400 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-300 mb-2">Important Notes:</h4>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• The workspace directory must be empty to clone</li>
              <li>• Make sure you have access to the repository</li>
              <li>• Private repositories may require authentication</li>
              <li>• Large repositories may take some time to clone</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            disabled={cloning}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={cloning || !repoUrl.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {cloning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Cloning...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Clone Repository</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
