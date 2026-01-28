/**
 * UE5 AI Studio - Code Editor Component
 * ======================================
 * 
 * A modern code editor with syntax highlighting, line numbers,
 * and auto-save functionality.
 * 
 * Version: 2.0.0
 */

import React, { useState, useEffect, useRef} from 'react';
import { EmptyState } from './EmptyState';
import {
  WorkspaceFile,
  updateFile,
  getFileVersions,
  restoreFileVersion,
  FileVersion,
  getLanguageDisplayName,
  formatFileSize,
  isFileEditable} from '../lib/workspace-api';

// =============================================================================
// TYPES
// =============================================================================

interface CodeEditorProps {
  file: WorkspaceFile | null;
  projectId?: number;
  onSave?: (file: WorkspaceFile) => void;
  onClose?: () => void;
  autoSaveInterval?: number; // seconds, 0 to disable
  className?: string;
}

interface EditorTab {
  file: WorkspaceFile;
  content: string;
  isDirty: boolean;
}

// =============================================================================
// SYNTAX HIGHLIGHTING (Basic)
// =============================================================================

const KEYWORDS: Record<string, string[]> = {
  cpp: [
    'auto', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default',
    'delete', 'do', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
    'for', 'friend', 'goto', 'if', 'inline', 'mutable', 'namespace', 'new',
    'nullptr', 'operator', 'private', 'protected', 'public', 'register',
    'return', 'sizeof', 'static', 'struct', 'switch', 'template', 'this',
    'throw', 'true', 'try', 'typedef', 'typename', 'union', 'using',
    'virtual', 'void', 'volatile', 'while', 'override', 'final',
    // UE5 specific
    'UCLASS', 'UPROPERTY', 'UFUNCTION', 'USTRUCT', 'UENUM', 'GENERATED_BODY',
    'BlueprintCallable', 'BlueprintReadWrite', 'EditAnywhere', 'VisibleAnywhere',
  ],
  javascript: [
    'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
    'new', 'null', 'return', 'static', 'super', 'switch', 'this', 'throw',
    'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield',
  ],
  typescript: [
    'abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case',
    'catch', 'class', 'const', 'continue', 'debugger', 'declare', 'default',
    'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally',
    'for', 'from', 'function', 'get', 'if', 'implements', 'import', 'in',
    'infer', 'instanceof', 'interface', 'is', 'keyof', 'let', 'module',
    'namespace', 'never', 'new', 'null', 'number', 'object', 'of', 'package',
    'private', 'protected', 'public', 'readonly', 'require', 'return', 'set',
    'static', 'string', 'super', 'switch', 'symbol', 'this', 'throw', 'true',
    'try', 'type', 'typeof', 'undefined', 'unique', 'unknown', 'var', 'void',
    'while', 'with', 'yield',
  ],
  python: [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
    'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
    'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  ]};

const TYPES: Record<string, string[]> = {
  cpp: [
    'int', 'float', 'double', 'char', 'bool', 'long', 'short', 'unsigned',
    'signed', 'wchar_t', 'size_t', 'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64', 'FString', 'FName', 'FText',
    'FVector', 'FRotator', 'FTransform', 'TArray', 'TMap', 'TSet',
    'AActor', 'UObject', 'ACharacter', 'APawn', 'APlayerController',
    'UActorComponent', 'USceneComponent', 'UStaticMeshComponent',
  ],
  typescript: [
    'string', 'number', 'boolean', 'any', 'void', 'never', 'unknown',
    'object', 'symbol', 'bigint', 'undefined', 'null',
  ]};

function highlightLine(line: string, language: string | null): React.ReactNode[] {
  if (!language || !['cpp', 'javascript', 'typescript', 'python'].includes(language)) {
    return [<span key="0">{line}</span>];
  }
  
  const keywords = KEYWORDS[language] || [];
  const types = TYPES[language] || [];
  const result: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;
  
  // Simple tokenizer
  while (remaining.length > 0) {
    // Comments
    if (remaining.startsWith('//')) {
      result.push(
        <span key={key++} className="text-gray-500 italic">
          {remaining}
        </span>
      );
      break;
    }
    
    // Strings
    const stringMatch = remaining.match(/^(["'`])(?:[^\\]|\\.)*?\1/);
    if (stringMatch) {
      result.push(
        <span key={key++} className="text-green-400">
          {stringMatch[0]}
        </span>
      );
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }
    
    // Numbers
    const numberMatch = remaining.match(/^\b\d+\.?\d*\b/);
    if (numberMatch) {
      result.push(
        <span key={key++} className="text-orange-400">
          {numberMatch[0]}
        </span>
      );
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }
    
    // Words (keywords, types, identifiers)
    const wordMatch = remaining.match(/^\b[a-zA-Z_][a-zA-Z0-9_]*\b/);
    if (wordMatch) {
      const word = wordMatch[0];
      let className = '';
      
      if (keywords.includes(word)) {
        className = 'text-purple-400 font-semibold';
      } else if (types.includes(word)) {
        className = 'text-blue-400';
      } else if (word.startsWith('U') || word.startsWith('A') || word.startsWith('F')) {
        // UE5 naming convention
        className = 'text-cyan-400';
      }
      
      result.push(
        <span key={key++} className={className}>
          {word}
        </span>
      );
      remaining = remaining.slice(word.length);
      continue;
    }
    
    // Operators and punctuation
    const opMatch = remaining.match(/^[+\-*/%=<>!&|^~?:;,.()[\]{}#@]+/);
    if (opMatch) {
      result.push(
        <span key={key++} className="text-gray-400">
          {opMatch[0]}
        </span>
      );
      remaining = remaining.slice(opMatch[0].length);
      continue;
    }
    
    // Whitespace and other
    result.push(<span key={key++}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }
  
  return result;
}

// =============================================================================
// VERSION HISTORY PANEL
// =============================================================================

interface VersionHistoryProps {
  fileId: number;
  projectId?: number;
  onRestore: (version: FileVersion) => void;
  onClose: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  fileId,
  projectId,
  onRestore,
  onClose}) => {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getFileVersions(fileId, { projectId, limit: 20 });
        setVersions(data);
      } catch (err) {
        console.error('Failed to load versions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fileId, projectId]);
  
  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-gray-800 border-l border-gray-700 shadow-xl z-10">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="font-medium text-white">Version History</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="overflow-auto h-[calc(100%-48px)]">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin text-2xl">⏳</div>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center text-gray-500 p-4">
            No version history
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="p-3 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white">
                    v{version.version_number}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatFileSize(version.size)}
                  </span>
                </div>
                <div className="text-sm text-gray-400 mb-2">
                  {version.change_description || version.change_type}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(version.created_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => onRestore(version)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN CODE EDITOR COMPONENT
// =============================================================================

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  projectId,
  onSave,
  onClose,
  autoSaveInterval = 30,
  className = ''}) => {
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load file content
  useEffect(() => {
    if (file) {
      setContent(file.content || '');
      setIsDirty(false);
    }
  }, [file?.id]);
  
  // Auto-save
  useEffect(() => {
    if (autoSaveInterval > 0 && isDirty && file && isFileEditable(file)) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave();
      }, autoSaveInterval * 1000);
      
      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
      };
    }
  }, [isDirty, content, autoSaveInterval]);
  
  // Handle content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(true);
    updateCursorPosition(e.target);
  };
  
  // Update cursor position
  const updateCursorPosition = (textarea: HTMLTextAreaElement) => {
    const text = textarea.value.substring(0, textarea.selectionStart);
    const lines = text.split('\n');
    setCursorPosition({
      line: lines.length,
      col: lines[lines.length - 1].length + 1});
  };
  
  // Handle save
  const handleSave = async () => {
    if (!file || !isDirty || isSaving) return;
    
    try {
      setIsSaving(true);
      const updated = await updateFile(file.id, { content }, projectId);
      setIsDirty(false);
      onSave?.(updated);
    } catch (err: any) {
      console.error('Failed to save:', err);
      alert(err.message || 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    
    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + '  ' + content.substring(end);
        setContent(newContent);
        setIsDirty(true);
        
        // Restore cursor position
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };
  
  // Handle version restore
  const handleRestore = async (version: FileVersion) => {
    if (!file) return;
    
    if (confirm(`Restore to version ${version.version_number}?`)) {
      try {
        const restored = await restoreFileVersion(file.id, version.version_number, projectId);
        setContent(restored.content || '');
        setIsDirty(false);
        setShowVersions(false);
        onSave?.(restored);
      } catch (err: any) {
        alert(err.message || 'Failed to restore');
      }
    }
  };
  
  // Render line numbers
  const lineCount = content.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
  
  // Check if file is editable
  const editable = file ? isFileEditable(file) : false;
  
  if (!file) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col h-full bg-gray-900 relative ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-white font-medium">
            {file.name}
            {isDirty && <span className="text-orange-400 ml-1">●</span>}
          </span>
          <span className="text-xs text-gray-500">
            {getLanguageDisplayName(file.language)}
          </span>
          {file.is_generated && (
            <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded">
              AI Generated
            </span>
          )}
          {file.is_readonly && (
            <span className="text-xs px-2 py-0.5 bg-yellow-600/30 text-yellow-300 rounded">
              Read Only
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors"
            title="Version History"
          >
            📜 History
          </button>
          
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving || !editable}
            className={`
              px-3 py-1 text-sm rounded transition-colors
              ${isDirty && editable
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-1 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers */}
        <div className="w-12 bg-gray-800 border-r border-gray-700 overflow-hidden select-none">
          <div className="py-2 px-2 text-right font-mono text-sm text-gray-500">
            {lineNumbers.map((num) => (
              <div
                key={num}
                className={`leading-6 ${num === cursorPosition.line ? 'text-white' : ''}`}
              >
                {num}
              </div>
            ))}
          </div>
        </div>
        
        {/* Code Area */}
        <div className="flex-1 relative overflow-auto">
          {/* Syntax Highlighted Layer (background) */}
          <pre className="absolute inset-0 p-2 font-mono text-sm leading-6 pointer-events-none overflow-hidden whitespace-pre-wrap break-all">
            {content.split('\n').map((line, i) => (
              <div key={i} className="text-gray-300">
                {highlightLine(line, file.language)}
              </div>
            ))}
          </pre>
          
          {/* Textarea (foreground, transparent text) */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={(e) => updateCursorPosition(e.target as HTMLTextAreaElement)}
            onClick={(e) => updateCursorPosition(e.target as HTMLTextAreaElement)}
            disabled={!editable}
            spellCheck={false}
            className="absolute inset-0 w-full h-full p-2 font-mono text-sm leading-6 bg-transparent text-transparent caret-white resize-none focus:outline-none"
            style={{ caretColor: 'white' }}
          />
        </div>
        
        {/* Version History Panel */}
        {showVersions && (
          <VersionHistory
            fileId={file.id}
            projectId={projectId}
            onRestore={handleRestore}
            onClose={() => setShowVersions(false)}
          />
        )}
      </div>
      
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-gray-700 bg-gray-800 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.col}
          </span>
          <span>{lineCount} lines</span>
          <span>{formatFileSize(new Blob([content]).size)}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span>v{file.version}</span>
          <span>{file.language || 'Plain Text'}</span>
          {autoSaveInterval > 0 && (
            <span className="text-green-500">Auto-save: {autoSaveInterval}s</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
