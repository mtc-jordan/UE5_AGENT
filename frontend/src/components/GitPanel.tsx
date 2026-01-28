/**
 * Git Panel Component
 * Displays file status, staging area, and commit interface
 */

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  Plus, 
  Minus, 
  FileText, 
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Upload,
  Download
} from 'lucide-react';
import * as gitApi from '../lib/git-api';
import { toast } from 'react-hot-toast';

interface GitPanelProps {
  onRefresh?: () => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ onRefresh }) => {
  const [status, setStatus] = useState<gitApi.GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Load Git status
  const loadStatus = async () => {
    setLoading(true);
    try {
      const result = await gitApi.getStatus();
      setStatus(result);
    } catch (error: any) {
      console.error('Failed to load Git status:', error);
      toast.error('Failed to load Git status');
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

  // Stage file
  const handleStageFile = async (filePath: string) => {
    try {
      await gitApi.stageFiles([filePath]);
      toast.success(`Staged ${filePath}`);
      await loadStatus();
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to stage file: ${error.message}`);
    }
  };

  // Unstage file
  const handleUnstageFile = async (filePath: string) => {
    try {
      await gitApi.unstageFiles([filePath]);
      toast.success(`Unstaged ${filePath}`);
      await loadStatus();
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to unstage file: ${error.message}`);
    }
  };

  // Stage all
  const handleStageAll = async () => {
    try {
      await gitApi.stageAll();
      toast.success('Staged all changes');
      await loadStatus();
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to stage all: ${error.message}`);
    }
  };

  // Discard changes
  const handleDiscardChanges = async (filePath: string) => {
    if (!confirm(`Discard changes in ${filePath}? This cannot be undone.`)) {
      return;
    }

    try {
      await gitApi.discardChanges([filePath]);
      toast.success(`Discarded changes in ${filePath}`);
      await loadStatus();
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to discard changes: ${error.message}`);
    }
  };

  // Commit
  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('Please enter a commit message');
      return;
    }

    if (!status?.staged_files || status.staged_files.length === 0) {
      toast.error('No files staged for commit');
      return;
    }

    setCommitting(true);
    try {
      const result = await gitApi.commit(commitMessage);
      toast.success(`Committed: ${result.commit_hash}`);
      setCommitMessage('');
      await loadStatus();
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to commit: ${error.message}`);
    } finally {
      setCommitting(false);
    }
  };

  // Push
  const handlePush = async () => {
    try {
      await gitApi.push();
      toast.success('Pushed to remote');
      await loadStatus();
    } catch (error: any) {
      toast.error(`Failed to push: ${error.message}`);
    }
  };

  // Pull
  const handlePull = async () => {
    try {
      await gitApi.pull();
      toast.success('Pulled from remote');
      await loadStatus();
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to pull: ${error.message}`);
    }
  };

  if (!status) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <p>Loading Git status...</p>
        </div>
      </div>
    );
  }

  if (!status.initialized) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400 p-4">
        <div className="text-center max-w-sm">
          <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No Git Repository</h3>
          <p className="text-sm mb-4">Initialize a repository to start using version control.</p>
          <button
            onClick={async () => {
              try {
                await gitApi.initRepository();
                toast.success('Repository initialized');
                await loadStatus();
              } catch (error: any) {
                toast.error(`Failed to initialize: ${error.message}`);
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Initialize Repository
          </button>
        </div>
      </div>
    );
  }

  const changedFiles = status.changed_files || [];
  const stagedFiles = status.staged_files || [];
  const untrackedFiles = status.untracked_files || [];
  const allChanges = [...changedFiles, ...untrackedFiles];

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-300">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-400" />
            Source Control
          </h2>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="p-1.5 hover:bg-gray-800 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Branch and sync info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Branch:</span>
            <span className="font-mono text-blue-400">{status.branch}</span>
          </div>
          {status.ahead !== undefined && status.behind !== undefined && (
            <div className="flex items-center gap-2">
              {status.ahead > 0 && (
                <span className="text-green-400" title="Commits ahead">
                  ↑{status.ahead}
                </span>
              )}
              {status.behind > 0 && (
                <span className="text-orange-400" title="Commits behind">
                  ↓{status.behind}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Push/Pull buttons */}
        {status.remotes && status.remotes.length > 0 && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handlePull}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded transition-colors text-sm"
              title="Pull from remote"
            >
              <Download className="w-4 h-4" />
              Pull
            </button>
            <button
              onClick={handlePush}
              disabled={status.ahead === 0}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Push to remote"
            >
              <Upload className="w-4 h-4" />
              Push
            </button>
          </div>
        )}
      </div>

      {/* File lists */}
      <div className="flex-1 overflow-y-auto">
        {/* Staged Files */}
        {stagedFiles.length > 0 && (
          <div className="border-b border-gray-800">
            <div className="px-4 py-2 bg-gray-850 text-sm font-semibold flex items-center justify-between">
              <span>Staged Changes ({stagedFiles.length})</span>
            </div>
            <div className="divide-y divide-gray-800">
              {stagedFiles.map((file) => (
                <div
                  key={file}
                  className="px-4 py-2 hover:bg-gray-800 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-sm font-mono truncate" title={file}>
                      {file}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnstageFile(file)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                    title="Unstage"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Changes */}
        {allChanges.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-gray-850 text-sm font-semibold flex items-center justify-between">
              <span>Changes ({allChanges.length})</span>
              {allChanges.length > 0 && (
                <button
                  onClick={handleStageAll}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Stage All
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-800">
              {allChanges.map((file) => {
                const isUntracked = untrackedFiles.includes(file);
                return (
                  <div
                    key={file}
                    className="px-4 py-2 hover:bg-gray-800 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isUntracked ? (
                        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-mono truncate" title={file}>
                        {file}
                      </span>
                      {isUntracked && (
                        <span className="text-xs text-yellow-400">U</span>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStageFile(file)}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Stage"
                      >
                        <Plus className="w-4 h-4 text-green-400" />
                      </button>
                      {!isUntracked && (
                        <button
                          onClick={() => handleDiscardChanges(file)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="Discard changes"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clean state */}
        {status.clean && (
          <div className="p-8 text-center text-gray-500">
            <Check className="w-12 h-12 mx-auto mb-3 text-green-600" />
            <p className="text-sm">No changes</p>
            <p className="text-xs mt-1">Working tree clean</p>
          </div>
        )}
      </div>

      {/* Commit section */}
      {stagedFiles.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-800 p-4">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
            rows={3}
          />
          <button
            onClick={handleCommit}
            disabled={committing || !commitMessage.trim()}
            className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <GitCommit className="w-4 h-4" />
            {committing ? 'Committing...' : 'Commit'}
          </button>
        </div>
      )}
    </div>
  );
};
