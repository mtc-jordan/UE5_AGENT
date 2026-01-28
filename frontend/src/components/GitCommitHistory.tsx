/**
 * Git Commit History Component
 * Displays commit history with details
 */

import React, { useState, useEffect } from 'react';
import { X, GitCommit, User, Calendar, FileText, RefreshCw } from 'lucide-react';
import * as gitApi from '../lib/git-api';
import { toast } from 'react-hot-toast';

interface GitCommitHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitCommitHistory: React.FC<GitCommitHistoryProps> = ({ isOpen, onClose }) => {
  const [commits, setCommits] = useState<gitApi.GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const loadCommits = async () => {
    setLoading(true);
    try {
      const result = await gitApi.getCommitHistory(limit);
      setCommits(result.commits || []);
    } catch (error: any) {
      toast.error('Failed to load commit history');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCommits();
    }
  }, [isOpen, limit]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <GitCommit className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-200">Commit History</h2>
            <span className="text-sm text-gray-500">({commits.length} commits)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadCommits}
              disabled={loading}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Commit List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && commits.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-600" />
                <p className="text-gray-500">Loading commits...</p>
              </div>
            </div>
          ) : commits.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <GitCommit className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                <p className="text-gray-500">No commits yet</p>
                <p className="text-sm text-gray-600 mt-1">Make your first commit to see history</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {commits.map((commit, index) => (
                <div
                  key={commit.full_hash}
                  className="bg-gray-850 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                >
                  {/* Commit Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                          {commit.hash}
                        </span>
                        {index === 0 && (
                          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded font-semibold">
                            HEAD
                          </span>
                        )}
                      </div>
                      <p className="text-gray-200 font-medium mb-2">{commit.message}</p>
                    </div>
                  </div>

                  {/* Commit Details */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>{commit.author}</span>
                      <span className="text-gray-600">({commit.email})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(commit.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      <span>{commit.files_changed} file{commit.files_changed !== 1 ? 's' : ''} changed</span>
                    </div>
                  </div>

                  {/* Copy Hash Button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(commit.full_hash);
                      toast.success('Commit hash copied');
                    }}
                    className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Copy full hash
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Show:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={10}>10 commits</option>
              <option value={25}>25 commits</option>
              <option value={50}>50 commits</option>
              <option value={100}>100 commits</option>
              <option value={200}>200 commits</option>
            </select>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
