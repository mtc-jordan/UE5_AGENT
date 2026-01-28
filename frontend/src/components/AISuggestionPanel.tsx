/**
 * UE5 AI Studio - AI Suggestion Panel
 * ====================================
 * 
 * Inline AI code suggestions (Copilot-style).
 * 
 * Version: 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowUp, ArrowDown, Check, X, Loader2 } from 'lucide-react';
import { getCodeSuggestions, type CodeSuggestion } from '../lib/ai-workspace-api';
import { toast } from 'react-hot-toast';

// =============================================================================
// TYPES
// =============================================================================

interface AISuggestionPanelProps {
  fileId: number;
  cursorPosition: { line: number; column: number };
  contextBefore: string;
  contextAfter: string;
  model?: string;
  onAccept: (suggestion: string) => void;
  onReject: () => void;
  visible: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const AISuggestionPanel: React.FC<AISuggestionPanelProps> = ({
  fileId,
  cursorPosition,
  contextBefore,
  contextAfter,
  model = 'deepseek-chat',
  onAccept,
  onReject,
  visible
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch suggestions when panel becomes visible
  useEffect(() => {
    if (visible && suggestions.length === 0) {
      fetchSuggestions();
    }
  }, [visible]);

  const fetchSuggestions = async () => {
    setLoading(true);

    try {
      const results = await getCodeSuggestions({
        file_id: fileId,
        cursor_position: cursorPosition,
        context_before: contextBefore,
        context_after: contextAfter,
        model,
        num_suggestions: 3
      });

      setSuggestions(results);
      setSelectedIndex(0);
    } catch (error: any) {
      console.error('Failed to get suggestions:', error);
      toast.error('Failed to get AI suggestions');
      onReject();
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestions[selectedIndex]) {
      onAccept(suggestions[selectedIndex].code);
      setSuggestions([]);
    }
  };

  const handleNavigate = (direction: 'up' | 'down') => {
    if (direction === 'up' && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (direction === 'down' && selectedIndex < suggestions.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        handleAccept();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onReject();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNavigate('down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, selectedIndex, suggestions]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full mx-4 border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
            <span className="text-sm font-medium text-white">AI Code Suggestions</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="px-2 py-1 bg-gray-700 rounded">Tab</span>
            <span>Accept</span>
            <span className="px-2 py-1 bg-gray-700 rounded ml-2">Esc</span>
            <span>Cancel</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="ml-3 text-gray-400">Generating suggestions...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-3">
              {/* Suggestion Counter */}
              <div className="text-xs text-gray-400 text-center">
                Suggestion {selectedIndex + 1} of {suggestions.length}
              </div>

              {/* Current Suggestion */}
              <div className="bg-gray-800 border-2 border-blue-500/50 rounded-lg p-4 relative">
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    {Math.round(suggestions[selectedIndex].confidence * 100)}%
                  </div>
                </div>

                <pre className="text-sm text-gray-200 font-mono whitespace-pre-wrap overflow-x-auto mt-6">
                  {suggestions[selectedIndex].code}
                </pre>

                {suggestions[selectedIndex].description && (
                  <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                    {suggestions[selectedIndex].description}
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleNavigate('up')}
                  disabled={selectedIndex === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors text-sm"
                >
                  <ArrowUp className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={onReject}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={handleAccept}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <Check className="w-4 h-4" />
                    Accept (Tab)
                  </button>
                </div>

                <button
                  onClick={() => handleNavigate('down')}
                  disabled={selectedIndex === suggestions.length - 1}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors text-sm"
                >
                  Next
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No suggestions available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
