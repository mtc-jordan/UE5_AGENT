/**
 * UE5 AI Studio - AI Code Explanation Modal
 * ==========================================
 * 
 * Modal for explaining, documenting, and improving code with AI.
 * 
 * Version: 1.0.0
 */

import React, { useState } from 'react';
import { X, Sparkles, FileText, Lightbulb, Bug, Code2, Loader2 } from 'lucide-react';
import { explainCode, AVAILABLE_MODELS, type ExplainCodeResponse } from '../lib/ai-workspace-api';
import { toast } from 'react-hot-toast';

// =============================================================================
// TYPES
// =============================================================================

interface AICodeExplanationProps {
  code: string;
  fileId?: number;
  onClose: () => void;
  onApplyFix?: (newCode: string) => void;
}

type AIAction = 'explain' | 'document' | 'improve' | 'convert_ue5' | 'find_bugs';

// =============================================================================
// COMPONENT
// =============================================================================

export const AICodeExplanation: React.FC<AICodeExplanationProps> = ({
  code,
  fileId,
  onClose,
  onApplyFix
}) => {
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [selectedAction, setSelectedAction] = useState<AIAction>('explain');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplainCodeResponse | null>(null);

  const actions = [
    { value: 'explain' as AIAction, label: 'Explain Code', icon: Sparkles, color: 'blue' },
    { value: 'document' as AIAction, label: 'Generate Docs', icon: FileText, color: 'green' },
    { value: 'improve' as AIAction, label: 'Suggest Improvements', icon: Lightbulb, color: 'yellow' },
    { value: 'convert_ue5' as AIAction, label: 'Convert to UE5', icon: Code2, color: 'purple' },
    { value: 'find_bugs' as AIAction, label: 'Find Bugs', icon: Bug, color: 'red' }
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await explainCode({
        code,
        file_id: fileId,
        model: selectedModel,
        action: selectedAction
      });

      setResult(response);
      toast.success('Analysis complete!');
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to analyze code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyExplanation = () => {
    if (result) {
      navigator.clipboard.writeText(result.explanation);
      toast.success('Copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">AI Code Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              AI Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.icon} {model.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              What would you like AI to do?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {actions.map((action) => {
                const Icon = action.icon;
                const isSelected = selectedAction === action.value;
                return (
                  <button
                    key={action.value}
                    onClick={() => setSelectedAction(action.value)}
                    className={`
                      flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                      ${isSelected
                        ? `border-${action.color}-500 bg-${action.color}-500/10 text-${action.color}-400`
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Selected Code
            </label>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                {code}
              </pre>
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyze with AI
              </>
            )}
          </button>

          {/* Results */}
          {result && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  AI Analysis Result
                </h3>
                <button
                  onClick={handleCopyExplanation}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                >
                  Copy
                </button>
              </div>

              <div className="prose prose-invert max-w-none">
                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {result.explanation}
                </div>
              </div>

              {onApplyFix && (
                <div className="flex gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => {
                      // Extract code from explanation if present
                      const codeMatch = result.explanation.match(/```[\w]*\n([\s\S]*?)```/);
                      if (codeMatch) {
                        onApplyFix(codeMatch[1]);
                        toast.success('Code applied!');
                        onClose();
                      } else {
                        toast.error('No code found in explanation');
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Apply Fix
                  </button>
                  <button
                    onClick={handleAnalyze}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
