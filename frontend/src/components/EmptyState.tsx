/**
 * UE5 AI Studio - Empty State Component
 * ======================================
 * 
 * Beautiful, engaging empty state for the workspace editor.
 * 
 * Version: 2.0.0
 */

import React from 'react';
import { FileText, FolderPlus, Upload, Search, Sparkles } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface EmptyStateProps {
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onUpload?: () => void;
  onSearch?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const EmptyState: React.FC<EmptyStateProps> = ({
  onCreateFile,
  onCreateFolder,
  onUpload,
  onSearch,
}) => {
  return (
    <div className="flex items-center justify-center h-full bg-gray-900">
      <div className="text-center max-w-2xl px-8 py-12">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
            <div className="relative bg-gray-800 p-6 rounded-2xl border border-gray-700">
              <Sparkles className="w-12 h-12 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-white mb-3">
          Welcome to Your Workspace
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-lg mb-8">
          Your AI-powered code editing environment for UE5 development.
          <br />
          Create files, organize your project, and let AI assist you.
        </p>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {onCreateFile && (
            <button
              onClick={onCreateFile}
              className="
                group flex flex-col items-center gap-3 p-6 rounded-xl
                bg-gray-800 border border-gray-700
                hover:border-blue-500/50 hover:bg-gray-800/80
                transition-all duration-200
                hover:scale-105 hover:shadow-lg hover:shadow-blue-500/10
              "
            >
              <div className="p-3 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-white mb-1">New File</div>
                <div className="text-sm text-gray-400">Create a new file</div>
              </div>
            </button>
          )}

          {onCreateFolder && (
            <button
              onClick={onCreateFolder}
              className="
                group flex flex-col items-center gap-3 p-6 rounded-xl
                bg-gray-800 border border-gray-700
                hover:border-yellow-500/50 hover:bg-gray-800/80
                transition-all duration-200
                hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/10
              "
            >
              <div className="p-3 rounded-lg bg-yellow-500/10 group-hover:bg-yellow-500/20 transition-colors">
                <FolderPlus className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <div className="font-semibold text-white mb-1">New Folder</div>
                <div className="text-sm text-gray-400">Organize your files</div>
              </div>
            </button>
          )}

          {onUpload && (
            <button
              onClick={onUpload}
              className="
                group flex flex-col items-center gap-3 p-6 rounded-xl
                bg-gray-800 border border-gray-700
                hover:border-green-500/50 hover:bg-gray-800/80
                transition-all duration-200
                hover:scale-105 hover:shadow-lg hover:shadow-green-500/10
              "
            >
              <div className="p-3 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <Upload className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <div className="font-semibold text-white mb-1">Upload Files</div>
                <div className="text-sm text-gray-400">Drag & drop or browse</div>
              </div>
            </button>
          )}

          {onSearch && (
            <button
              onClick={onSearch}
              className="
                group flex flex-col items-center gap-3 p-6 rounded-xl
                bg-gray-800 border border-gray-700
                hover:border-purple-500/50 hover:bg-gray-800/80
                transition-all duration-200
                hover:scale-105 hover:shadow-lg hover:shadow-purple-500/10
              "
            >
              <div className="p-3 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <Search className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="font-semibold text-white mb-1">Search Files</div>
                <div className="text-sm text-gray-400">Press ⌘P to search</div>
              </div>
            </button>
          )}
        </div>

        {/* Tips */}
        <div className="space-y-3 text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 font-mono text-xs">
              <span className="text-gray-400">⌘</span>
              <span>P</span>
            </span>
            <span>Quick file search</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 font-mono text-xs">
              <span className="text-gray-400">⌘</span>
              <span>S</span>
            </span>
            <span>Save current file</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 font-mono text-xs">
              <span className="text-gray-400">⌘</span>
              <span>K</span>
            </span>
            <span>AI assistance</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
