/**
 * Git Diff Viewer Component
 * Displays file diffs with syntax highlighting
 */

import React, { useState, useEffect } from 'react';
import { X, FileText, Plus, Minus, RefreshCw } from 'lucide-react';
import * as gitApi from '../lib/git-api';
import { toast } from 'react-hot-toast';

interface GitDiffViewerProps {
  filePath: string | null;
  isOpen: boolean;
  onClose: () => void;
  staged?: boolean;
}

export const GitDiffViewer: React.FC<GitDiffViewerProps> = ({ 
  filePath, 
  isOpen, 
  onClose,
  staged = false 
}) => {
  const [diff, setDiff] = useState<gitApi.GitDiff | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDiff = async () => {
    if (!filePath) return;

    setLoading(true);
    try {
      const result = await gitApi.getFileDiff(filePath, staged);
      setDiff(result);
    } catch (error: any) {
      toast.error('Failed to load diff');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && filePath) {
      loadDiff();
    }
  }, [isOpen, filePath, staged]);

  if (!isOpen || !filePath) return null;

  const parseDiff = (diffText: string) => {
    if (!diffText) return [];

    const lines = diffText.split('\n');
    const parsed: Array<{ type: 'add' | 'remove' | 'context' | 'header'; content: string; lineNum?: number }> = [];
    
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Hunk header
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLineNum = parseInt(match[1]);
          newLineNum = parseInt(match[2]);
        }
        parsed.push({ type: 'header', content: line });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        parsed.push({ type: 'add', content: line.substring(1), lineNum: newLineNum });
        newLineNum++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        parsed.push({ type: 'remove', content: line.substring(1), lineNum: oldLineNum });
        oldLineNum++;
      } else if (!line.startsWith('\\')) {
        parsed.push({ type: 'context', content: line, lineNum: newLineNum });
        oldLineNum++;
        newLineNum++;
      }
    }

    return parsed;
  };

  const diffLines = diff ? parseDiff(diff.diff) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-200">File Diff</h2>
              <p className="text-sm text-gray-500 font-mono">{filePath}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {diff && (
              <div className="flex items-center gap-4 mr-4 text-sm">
                <div className="flex items-center gap-1.5 text-green-400">
                  <Plus className="w-4 h-4" />
                  <span>{diff.additions} additions</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-400">
                  <Minus className="w-4 h-4" />
                  <span>{diff.deletions} deletions</span>
                </div>
              </div>
            )}
            <button
              onClick={loadDiff}
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

        {/* Diff Content */}
        <div className="flex-1 overflow-auto bg-gray-950 p-4 font-mono text-sm">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-600" />
                <p className="text-gray-500">Loading diff...</p>
              </div>
            </div>
          ) : !diff || !diff.diff ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                <p className="text-gray-500">No changes to display</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {diffLines.map((line, index) => {
                let bgColor = '';
                let textColor = 'text-gray-300';
                let borderColor = '';

                if (line.type === 'add') {
                  bgColor = 'bg-green-900/20';
                  textColor = 'text-green-300';
                  borderColor = 'border-l-4 border-green-500';
                } else if (line.type === 'remove') {
                  bgColor = 'bg-red-900/20';
                  textColor = 'text-red-300';
                  borderColor = 'border-l-4 border-red-500';
                } else if (line.type === 'header') {
                  bgColor = 'bg-blue-900/20';
                  textColor = 'text-blue-300';
                  borderColor = 'border-l-4 border-blue-500';
                } else {
                  bgColor = 'bg-gray-900/50';
                  textColor = 'text-gray-400';
                }

                return (
                  <div
                    key={index}
                    className={`flex ${bgColor} ${borderColor} hover:bg-opacity-80 transition-colors`}
                  >
                    {/* Line Number */}
                    <div className="flex-shrink-0 w-16 px-2 py-1 text-right text-gray-600 select-none">
                      {line.lineNum || ''}
                    </div>
                    {/* Line Content */}
                    <div className={`flex-1 px-4 py-1 ${textColor} whitespace-pre overflow-x-auto`}>
                      {line.type === 'add' && <span className="text-green-500 mr-2">+</span>}
                      {line.type === 'remove' && <span className="text-red-500 mr-2">-</span>}
                      {line.content || ' '}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800">
          <div className="text-sm text-gray-500">
            {diff && (
              <span>
                Change type: <span className="text-gray-400 font-mono">{diff.change_type}</span>
              </span>
            )}
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
