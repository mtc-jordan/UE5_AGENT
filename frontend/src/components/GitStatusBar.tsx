/**
 * Git Status Bar Component
 * Displays Git status indicators in workspace header
 */

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  Upload, 
  Download, 
  AlertCircle,
  Check,
  Clock
} from 'lucide-react';
import * as gitApi from '../lib/git-api';

interface GitStatusBarProps {
  onCommitHistoryClick?: () => void;
  onCloneClick?: () => void;
}

export const GitStatusBar: React.FC<GitStatusBarProps> = ({ 
  onCommitHistoryClick,
  onCloneClick 
}) => {
  const [status, setStatus] = useState<gitApi.GitStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const result = await gitApi.getStatus();
      setStatus(result);
    } catch (error) {
      console.error('Failed to load Git status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // Refresh every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <GitBranch className="w-4 h-4 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!status || !status.initialized) {
    return (
      <button
        onClick={onCloneClick}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition-colors"
        title="Clone repository or initialize Git"
      >
        <GitBranch className="w-4 h-4" />
        <span>No Git</span>
      </button>
    );
  }

  const changedFiles = (status.changed_files?.length || 0) + (status.untracked_files?.length || 0);
  const stagedFiles = status.staged_files?.length || 0;
  const isClean = status.clean;

  return (
    <div className="flex items-center gap-3">
      {/* Status Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isClean ? (
          <div className="flex items-center gap-1.5 text-green-400" title="Working tree clean">
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">Clean</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-orange-400" title={`${changedFiles} file(s) changed`}>
            <AlertCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{changedFiles} changed</span>
          </div>
        )}
      </div>

      {/* Staged Files */}
      {stagedFiles > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-blue-400" title={`${stagedFiles} file(s) staged`}>
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">{stagedFiles} staged</span>
        </div>
      )}

      {/* Sync Status */}
      {status.remotes && status.remotes.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          {status.ahead !== undefined && status.ahead > 0 && (
            <div className="flex items-center gap-1 text-green-400" title={`${status.ahead} commit(s) ahead`}>
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{status.ahead}</span>
            </div>
          )}
          {status.behind !== undefined && status.behind > 0 && (
            <div className="flex items-center gap-1 text-orange-400" title={`${status.behind} commit(s) behind`}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{status.behind}</span>
            </div>
          )}
        </div>
      )}

      {/* Commit History Button */}
      <button
        onClick={onCommitHistoryClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition-colors"
        title="View commit history"
      >
        <GitCommit className="w-4 h-4" />
        <span className="hidden sm:inline">History</span>
      </button>
    </div>
  );
};
