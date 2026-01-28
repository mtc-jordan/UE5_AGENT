/**
 * UE5 AI Studio - AI File Generator Modal
 * ========================================
 * 
 * Generate entire files from natural language descriptions.
 * 
 * Version: 1.0.0
 */

import React, { useState } from 'react';
import { X, Sparkles, FileCode, Loader2, Eye, Save, RotateCcw } from 'lucide-react';
import { generateFile, AVAILABLE_MODELS, FILE_TYPES, type GenerateFileResponse } from '../lib/ai-workspace-api';
import { toast } from 'react-hot-toast';

// =============================================================================
// TYPES
// =============================================================================

interface AIFileGeneratorProps {
  onClose: () => void;
  onFileSaved?: (fileId: number, path: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const AIFileGenerator: React.FC<AIFileGeneratorProps> = ({
  onClose,
  onFileSaved
}) => {
  const [description, setDescription] = useState('');
  const [fileType, setFileType] = useState('cpp_class');
  const [className, setClassName] = useState('');
  const [parentClass, setParentClass] = useState('AActor');
  const [filePath, setFilePath] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [includeContext, setIncludeContext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateFileResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error('Please provide a description');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await generateFile({
        description,
        file_type: fileType,
        class_name: className || undefined,
        parent_class: parentClass || undefined,
        model: selectedModel,
        include_workspace_context: includeContext,
        save_to_workspace: false
      });

      setResult(response);
      setShowPreview(true);
      toast.success('File generated successfully!');
    } catch (error: any) {
      console.error('File generation failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate file');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !filePath.trim()) {
      toast.error('Please provide a file path');
      return;
    }

    setLoading(true);

    try {
      const response = await generateFile({
        description,
        file_type: fileType,
        class_name: className || undefined,
        parent_class: parentClass || undefined,
        model: selectedModel,
        include_workspace_context: includeContext,
        save_to_workspace: true,
        file_path: filePath
      });

      if (response.saved && response.file_id) {
        toast.success('File saved to workspace!');
        onFileSaved?.(response.file_id, filePath);
        onClose();
      }
    } catch (error: any) {
      console.error('Failed to save file:', error);
      toast.error(error.response?.data?.detail || 'Failed to save file');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (result) {
      navigator.clipboard.writeText(result.content);
      toast.success('Code copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-3">
            <FileCode className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">AI File Generator</h2>
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
          {!showPreview ? (
            // Generation Form
            <>
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Describe what you want to create *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Create a UE5 character controller with WASD movement, jumping, and camera rotation"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] resize-y"
                />
              </div>

              {/* File Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    File Type
                  </label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {FILE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    AI Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {AVAILABLE_MODELS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.icon} {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class Details (for C++ files) */}
              {(fileType === 'cpp_class' || fileType === 'header') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Class Name
                    </label>
                    <input
                      type="text"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="e.g., AMyCharacter"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Parent Class
                    </label>
                    <input
                      type="text"
                      value={parentClass}
                      onChange={(e) => setParentClass(e.target.value)}
                      placeholder="e.g., AActor"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeContext"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-700 rounded focus:ring-purple-500"
                />
                <label htmlFor="includeContext" className="text-sm text-gray-300">
                  Include workspace context (AI will analyze your existing files for better results)
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading || !description.trim()}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate with AI
                  </>
                )}
              </button>
            </>
          ) : (
            // Preview
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-400" />
                  Generated Code Preview
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    Copy Code
                  </button>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      setResult(null);
                    }}
                    className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Code Preview */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                  {result?.content}
                </pre>
              </div>

              {/* File Path Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Save as (file path) *
                </label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="e.g., /MyProject/Source/MyCharacter.cpp"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={loading || !filePath.trim()}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save to Workspace
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          >
            {showPreview ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
