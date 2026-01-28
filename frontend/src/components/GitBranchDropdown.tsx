/**
 * Git Branch Dropdown Component
 * Branch selector with create/switch/delete functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, Plus, Trash2, Check, X } from 'lucide-react';
import * as gitApi from '../lib/git-api';
import { toast } from 'react-hot-toast';

interface GitBranchDropdownProps {
  onBranchChange?: (branch: string) => void;
}

export const GitBranchDropdown: React.FC<GitBranchDropdownProps> = ({ onBranchChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load branches
  const loadBranches = async () => {
    setLoading(true);
    try {
      const result = await gitApi.getBranches();
      setBranches(result);
    } catch (error: any) {
      console.error('Failed to load branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Switch branch
  const handleSwitchBranch = async (branchName: string) => {
    try {
      await gitApi.switchBranch(branchName);
      toast.success(`Switched to ${branchName}`);
      await loadBranches();
      onBranchChange?.(branchName);
      setIsOpen(false);
    } catch (error: any) {
      toast.error(`Failed to switch branch: ${error.message}`);
    }
  };

  // Create branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      toast.error('Please enter a branch name');
      return;
    }

    setCreating(true);
    try {
      await gitApi.createBranch(newBranchName, true);
      toast.success(`Created and switched to ${newBranchName}`);
      setNewBranchName('');
      setShowCreateInput(false);
      await loadBranches();
      onBranchChange?.(newBranchName);
    } catch (error: any) {
      toast.error(`Failed to create branch: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Delete branch
  const handleDeleteBranch = async (branchName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (branchName === branches?.current_branch) {
      toast.error('Cannot delete current branch');
      return;
    }

    if (!confirm(`Delete branch "${branchName}"?`)) {
      return;
    }

    try {
      await gitApi.deleteBranch(branchName);
      toast.success(`Deleted branch ${branchName}`);
      await loadBranches();
    } catch (error: any) {
      toast.error(`Failed to delete branch: ${error.message}`);
    }
  };

  if (!branches) {
    return (
      <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400">
        <GitBranch className="w-4 h-4 animate-pulse" />
        <span>Loading...</span>
      </button>
    );
  }

  const currentBranch = branches.current_branch || 'main';
  const localBranches = branches.local_branches || [];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
      >
        <GitBranch className="w-4 h-4 text-blue-400" />
        <span className="font-mono">{currentBranch}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 bg-gray-850 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-300">Branches</span>
            <button
              onClick={() => setShowCreateInput(!showCreateInput)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Create branch"
            >
              {showCreateInput ? (
                <X className="w-4 h-4 text-gray-400" />
              ) : (
                <Plus className="w-4 h-4 text-green-400" />
              )}
            </button>
          </div>

          {/* Create Branch Input */}
          {showCreateInput && (
            <div className="px-3 py-2 bg-gray-850 border-b border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateBranch()}
                  placeholder="Branch name..."
                  className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={creating || !newBranchName.trim()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  {creating ? '...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Branch List */}
          <div className="max-h-64 overflow-y-auto">
            {localBranches.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No branches found
              </div>
            ) : (
              localBranches.map((branch: any) => {
                const isCurrent = branch.name === currentBranch;
                return (
                  <div
                    key={branch.name}
                    className={`px-3 py-2 hover:bg-gray-700 transition-colors cursor-pointer flex items-center justify-between group ${
                      isCurrent ? 'bg-gray-750' : ''
                    }`}
                    onClick={() => !isCurrent && handleSwitchBranch(branch.name)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isCurrent && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
                      <span className={`text-sm font-mono truncate ${isCurrent ? 'text-green-400 font-semibold' : 'text-gray-300'}`}>
                        {branch.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">{branch.commit}</span>
                      {!isCurrent && (
                        <button
                          onClick={(e) => handleDeleteBranch(branch.name, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all"
                          title="Delete branch"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Remote Branches (if any) */}
          {branches.remote_branches && branches.remote_branches.length > 0 && (
            <>
              <div className="px-3 py-1.5 bg-gray-850 border-t border-gray-700 text-xs font-semibold text-gray-400">
                Remote Branches
              </div>
              <div className="max-h-32 overflow-y-auto">
                {branches.remote_branches.map((branch: any) => (
                  <div
                    key={branch.name}
                    className="px-3 py-2 hover:bg-gray-700 transition-colors flex items-center justify-between"
                  >
                    <span className="text-sm font-mono text-gray-400 truncate">{branch.name}</span>
                    <span className="text-xs text-gray-500 font-mono">{branch.commit}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
