/**
 * UE5 AI Studio - Plugin Editor Page
 * ====================================
 * 
 * Full-featured plugin code editor with testing and configuration.
 * 
 * Version: 2.2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  Play,
  Settings,
  Code,
  FileJson,
  TestTube,
  History,
  Upload,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  RefreshCw
} from 'lucide-react';
import {
  pluginsApi,
  executionApi,
  Plugin,
  PluginCategory,
  ExecutionResult,
  CATEGORY_LABELS,
  CATEGORY_ICONS
} from '../lib/plugin-api';

// =============================================================================
// TYPES
// =============================================================================

type EditorTab = 'code' | 'config' | 'input' | 'output' | 'test';

interface TestResult {
  success: boolean;
  output: any;
  error: string | null;
  execution_time_ms: number;
  stdout: string;
  stderr: string;
}

// =============================================================================
// CODE EDITOR COMPONENT
// =============================================================================

interface PythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

function PythonEditor({ value, onChange, readOnly }: PythonEditorProps) {
  const lines = value.split('\n');
  
  return (
    <div className="h-full flex bg-gray-900 font-mono text-sm">
      {/* Line numbers */}
      <div className="flex-shrink-0 py-4 px-2 bg-gray-800 text-gray-500 text-right select-none border-r border-gray-700">
        {lines.map((_, i) => (
          <div key={i} className="leading-6 px-2">
            {i + 1}
          </div>
        ))}
      </div>
      
      {/* Code area */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="flex-1 p-4 bg-gray-900 text-gray-100 resize-none focus:outline-none leading-6"
        style={{ tabSize: 4 }}
        spellCheck={false}
        placeholder="# Write your plugin code here..."
      />
    </div>
  );
}

// =============================================================================
// JSON EDITOR COMPONENT
// =============================================================================

interface JsonEditorProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  label: string;
}

function JsonEditor({ value, onChange, label }: JsonEditorProps) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      onChange(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm text-gray-400">{label}</span>
        {error && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
}

// =============================================================================
// MAIN EDITOR PAGE
// =============================================================================

export default function PluginEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  // Plugin state
  const [plugin, setPlugin] = useState<Partial<Plugin>>({
    name: 'New Plugin',
    code: `"""
My Plugin
=========

A custom plugin for UE5 AI Studio.
"""

def main(input_data: dict, context: dict) -> dict:
    """
    Main entry point for the plugin.
    
    Args:
        input_data: Input parameters from user or AI
        context: Execution context (mcp, workspace, etc.)
    
    Returns:
        Result dictionary with output data
    """
    # Get input parameters
    message = input_data.get("message", "Hello from plugin!")
    
    # Perform operations
    result = {
        "status": "success",
        "message": message,
        "processed": True
    }
    
    return result
`,
    description: '',
    category: 'custom' as PluginCategory,
    tags: [],
    config_schema: {},
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to process'
        }
      }
    },
    output_schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        processed: { type: 'boolean' }
      }
    },
    ai_description: '',
    requires_mcp: false,
    requires_workspace: false,
    timeout_seconds: 30
  });

  // UI state
  const [activeTab, setActiveTab] = useState<EditorTab>('code');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Test state
  const [testInput, setTestInput] = useState<Record<string, any>>({ message: 'Test message' });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);

  // Load plugin
  useEffect(() => {
    if (!isNew && id) {
      loadPlugin(parseInt(id));
    }
  }, [id, isNew]);

  const loadPlugin = async (pluginId: number) => {
    setLoading(true);
    try {
      const data = await pluginsApi.get(pluginId);
      setPlugin(data);
      
      // Load execution history
      const history = await executionApi.history(pluginId, 10);
      setExecutionHistory(history);
    } catch (error) {
      console.error('Failed to load plugin:', error);
      navigate('/plugins');
    } finally {
      setLoading(false);
    }
  };

  // Update plugin field
  const updatePlugin = useCallback((field: string, value: any) => {
    setPlugin(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // Validate code
  const validateCode = async () => {
    try {
      const result = await pluginsApi.validate(plugin.code || '');
      if (!result.valid) {
        setValidationError(result.error);
        return false;
      }
      setValidationError(null);
      return true;
    } catch (error) {
      setValidationError('Validation failed');
      return false;
    }
  };

  // Save plugin
  const handleSave = async () => {
    const isValid = await validateCode();
    if (!isValid) return;

    setSaving(true);
    try {
      if (isNew) {
        const created = await pluginsApi.create({
          name: plugin.name || 'Untitled Plugin',
          code: plugin.code || '',
          description: plugin.description || undefined,
          category: plugin.category,
          tags: plugin.tags,
          config_schema: plugin.config_schema,
          input_schema: plugin.input_schema,
          output_schema: plugin.output_schema,
          ai_description: plugin.ai_description || undefined,
          requires_mcp: plugin.requires_mcp,
          requires_workspace: plugin.requires_workspace,
          timeout_seconds: plugin.timeout_seconds
        });
        navigate(`/plugins/${created.id}/edit`, { replace: true });
      } else if (id) {
        await pluginsApi.update(parseInt(id), {
          name: plugin.name,
          code: plugin.code,
          description: plugin.description || undefined,
          category: plugin.category,
          tags: plugin.tags,
          config_schema: plugin.config_schema,
          input_schema: plugin.input_schema,
          output_schema: plugin.output_schema,
          ai_description: plugin.ai_description || undefined,
          requires_mcp: plugin.requires_mcp,
          requires_workspace: plugin.requires_workspace,
          timeout_seconds: plugin.timeout_seconds
        });
      }
      setHasChanges(false);
    } catch (error: any) {
      console.error('Failed to save plugin:', error);
      setValidationError(error.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Test plugin
  const handleTest = async () => {
    if (isNew || !id) {
      setValidationError('Save the plugin before testing');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const result = await executionApi.execute(parseInt(id), testInput);
      setTestResult(result);
      
      // Refresh history
      const history = await executionApi.history(parseInt(id), 10);
      setExecutionHistory(history);
    } catch (error: any) {
      setTestResult({
        success: false,
        output: null,
        error: error.response?.data?.detail || 'Execution failed',
        execution_time_ms: 0,
        stdout: '',
        stderr: ''
      });
    } finally {
      setTesting(false);
    }
  };

  // Delete plugin
  const handleDelete = async () => {
    if (!id || isNew) return;
    
    if (!confirm('Are you sure you want to delete this plugin?')) return;

    try {
      await pluginsApi.delete(parseInt(id));
      navigate('/plugins');
    } catch (error) {
      console.error('Failed to delete plugin:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <Loader className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/plugins')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {CATEGORY_ICONS[plugin.category as PluginCategory] || '⚙️'}
            </span>
            <div>
              <input
                type="text"
                value={plugin.name || ''}
                onChange={(e) => updatePlugin('name', e.target.value)}
                className="text-xl font-semibold bg-transparent border-none focus:outline-none text-white"
                placeholder="Plugin Name"
              />
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <select
                  value={plugin.category || 'custom'}
                  onChange={(e) => updatePlugin('category', e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-gray-400"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                {hasChanges && (
                  <span className="text-yellow-400">• Unsaved changes</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {validationError && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm">
              <XCircle className="w-4 h-4" />
              {validationError}
            </div>
          )}
          
          <button
            onClick={handleTest}
            disabled={testing || isNew}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors"
          >
            {testing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Test
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors"
          >
            {saving ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>

          {!isNew && (
            <button
              onClick={handleDelete}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor tabs */}
        <div className="w-48 border-r border-gray-700 flex flex-col">
          {[
            { id: 'code', label: 'Code', icon: Code },
            { id: 'config', label: 'Settings', icon: Settings },
            { id: 'input', label: 'Input Schema', icon: FileJson },
            { id: 'output', label: 'Output Schema', icon: FileJson },
            { id: 'test', label: 'Test & Debug', icon: TestTube }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as EditorTab)}
              className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600/20 text-purple-400 border-r-2 border-purple-500'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Editor content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Code tab */}
          {activeTab === 'code' && (
            <PythonEditor
              value={plugin.code || ''}
              onChange={(code) => updatePlugin('code', code)}
            />
          )}

          {/* Config tab */}
          {activeTab === 'config' && (
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={plugin.description || ''}
                    onChange={(e) => updatePlugin('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="Describe what your plugin does..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    AI Description
                  </label>
                  <textarea
                    value={plugin.ai_description || ''}
                    onChange={(e) => updatePlugin('ai_description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="Describe when AI should use this plugin..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This helps AI understand when to invoke your plugin
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={(plugin.tags || []).join(', ')}
                    onChange={(e) => updatePlugin('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Timeout (seconds)
                    </label>
                    <input
                      type="number"
                      value={plugin.timeout_seconds || 30}
                      onChange={(e) => updatePlugin('timeout_seconds', parseInt(e.target.value))}
                      min={1}
                      max={300}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plugin.requires_mcp || false}
                      onChange={(e) => updatePlugin('requires_mcp', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-300">Requires MCP Connection</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plugin.requires_workspace || false}
                      onChange={(e) => updatePlugin('requires_workspace', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-300">Requires Workspace Access</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Input Schema tab */}
          {activeTab === 'input' && (
            <JsonEditor
              value={plugin.input_schema || {}}
              onChange={(schema) => updatePlugin('input_schema', schema)}
              label="Input Schema (JSON Schema)"
            />
          )}

          {/* Output Schema tab */}
          {activeTab === 'output' && (
            <JsonEditor
              value={plugin.output_schema || {}}
              onChange={(schema) => updatePlugin('output_schema', schema)}
              label="Output Schema (JSON Schema)"
            />
          )}

          {/* Test tab */}
          {activeTab === 'test' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Test input */}
              <div className="w-1/2 flex flex-col border-r border-gray-700">
                <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Test Input</span>
                  <button
                    onClick={handleTest}
                    disabled={testing || isNew}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm flex items-center gap-1"
                  >
                    {testing ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    Run
                  </button>
                </div>
                <JsonEditor
                  value={testInput}
                  onChange={setTestInput}
                  label=""
                />
              </div>

              {/* Test output */}
              <div className="w-1/2 flex flex-col">
                <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Output</span>
                  {testResult && (
                    <span className={`flex items-center gap-1 text-sm ${
                      testResult.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {testResult.success ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {testResult.execution_time_ms}ms
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-4 bg-gray-900 font-mono text-sm">
                  {testResult ? (
                    <div className="space-y-4">
                      {testResult.error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400">
                          <strong>Error:</strong> {testResult.error}
                        </div>
                      )}
                      
                      {testResult.output && (
                        <div>
                          <div className="text-gray-400 mb-1">Result:</div>
                          <pre className="text-green-400 whitespace-pre-wrap">
                            {JSON.stringify(testResult.output, null, 2)}
                          </pre>
                        </div>
                      )}

                      {testResult.stdout && (
                        <div>
                          <div className="text-gray-400 mb-1">Stdout:</div>
                          <pre className="text-gray-300 whitespace-pre-wrap bg-gray-800 p-2 rounded">
                            {testResult.stdout}
                          </pre>
                        </div>
                      )}

                      {testResult.stderr && (
                        <div>
                          <div className="text-gray-400 mb-1">Stderr:</div>
                          <pre className="text-yellow-400 whitespace-pre-wrap bg-gray-800 p-2 rounded">
                            {testResult.stderr}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center py-8">
                      Click "Run" to test your plugin
                    </div>
                  )}
                </div>

                {/* Execution history */}
                {executionHistory.length > 0 && (
                  <div className="border-t border-gray-700">
                    <div className="p-3 bg-gray-800 flex items-center gap-2">
                      <History className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-300">Recent Executions</span>
                    </div>
                    <div className="max-h-32 overflow-auto">
                      {executionHistory.map((exec, i) => (
                        <div
                          key={exec.id}
                          className="px-3 py-2 border-b border-gray-800 flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {exec.success ? (
                              <CheckCircle className="w-3 h-3 text-green-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-400" />
                            )}
                            <span className="text-gray-400">
                              {new Date(exec.started_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="text-gray-500">
                            {exec.execution_time_ms}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
