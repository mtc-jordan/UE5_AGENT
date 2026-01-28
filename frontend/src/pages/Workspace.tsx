/**
 * UE5 AI Studio - Workspace Page
 * ===============================
 * 
 * Main workspace page integrating file browser, code editor,
 * and file upload/download functionality.
 * 
 * Version: 2.0.0
 */

import React, { useState, useRef} from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FileBrowser } from '../components/FileBrowser';
import { CodeEditor } from '../components/CodeEditor';
import { EmptyState } from '../components/EmptyState';
import { AIFileGenerator } from '../components/AIFileGenerator';
import {
  WorkspaceFile,
  WorkspaceStats,
  getWorkspaceStats,
  uploadFile,
  downloadFile,
  searchFiles,
  SearchResult,
  formatFileSize,
  getFile} from '../lib/workspace-api';
import { workspaceToasts } from '../lib/toast';

// =============================================================================
// TYPES
// =============================================================================

interface WorkspacePageProps {
  projectId?: number;
}

// =============================================================================
// UPLOAD ZONE COMPONENT
// =============================================================================

interface UploadZoneProps {
  projectId?: number;
  currentPath: string;
  onUploadComplete: () => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({
  projectId,
  currentPath,
  onUploadComplete}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress([]);
    
    for (const file of files) {
      try {
        setUploadProgress((prev) => [...prev, `Uploading ${file.name}...`]);
        await uploadFile(file, currentPath, projectId);
        setUploadProgress((prev) => [
          ...prev.slice(0, -1),
          `✓ ${file.name} uploaded`,
        ]);
      } catch (err: any) {
        setUploadProgress((prev) => [
          ...prev.slice(0, -1),
          `✗ ${file.name}: ${err.message}`,
        ]);
      }
    }
    
    setIsUploading(false);
    onUploadComplete();
    
    // Clear progress after delay
    setTimeout(() => setUploadProgress([]), 3000);
  };
  
  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-4 text-center transition-colors
        ${isDragging
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-700 hover:border-gray-600'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {isUploading ? (
        <div className="space-y-1">
          {uploadProgress.map((msg, i) => (
            <div
              key={i}
              className={`text-sm ${
                msg.startsWith('✓')
                  ? 'text-green-400'
                  : msg.startsWith('✗')
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}
            >
              {msg}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="text-3xl mb-2">📤</div>
          <p className="text-gray-400 text-sm mb-2">
            Drag & drop files here, or{' '}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-400 hover:text-blue-300"
            >
              browse
            </button>
          </p>
          <p className="text-gray-500 text-xs">
            Upload to: {currentPath}
          </p>
        </>
      )}
    </div>
  );
};

// =============================================================================
// SEARCH PANEL COMPONENT
// =============================================================================

interface SearchPanelProps {
  projectId?: number;
  onResultClick: (result: SearchResult) => void;
  onClose: () => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  projectId,
  onResultClick,
  onClose}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const handleSearch = async () => {
    if (!query.trim()) return;
    
    try {
      setLoading(true);
      const data = await searchFiles(query, { projectId, limit: 50 });
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  return (
    <div className="absolute inset-0 bg-gray-900/95 z-20 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name or content..."
            autoFocus
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            {loading ? '...' : 'Search'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {results.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {query ? 'No results found' : 'Enter a search query'}
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => onResultClick(result)}
                className="w-full p-3 bg-gray-800 rounded hover:bg-gray-700 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{result.file_type === 'folder' ? '📁' : '📄'}</span>
                  <span className="font-medium text-white">{result.name}</span>
                  {result.language && (
                    <span className="text-xs text-gray-500">{result.language}</span>
                  )}
                </div>
                <div className="text-sm text-gray-400">{result.path}</div>
                {result.match_preview && (
                  <div className="text-sm text-gray-500 mt-1 truncate">
                    {result.match_preview}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// STATS PANEL COMPONENT
// =============================================================================



// =============================================================================
// MAIN WORKSPACE PAGE
// =============================================================================

export const WorkspacePage: React.FC<WorkspacePageProps> = ({ projectId }) => {
  const navigate = useNavigate();
  
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [openFiles, setOpenFiles] = useState<WorkspaceFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [showSearch, setShowSearch] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Load stats
  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getWorkspaceStats(projectId);
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    };
    loadStats();
  }, [projectId, refreshKey]);
  
  // Handle file select (single click)
  const handleFileSelect = (file: WorkspaceFile) => {
    setSelectedFile(file);
    if (file.file_type === 'folder') {
      setCurrentPath(file.path);
    }
  };
  
  // Handle file open (double click)
  const handleFileOpen = (file: WorkspaceFile) => {
    if (file.file_type === 'folder') return;
    
    // Check if already open
    const existing = openFiles.find((f) => f.id === file.id);
    if (!existing) {
      setOpenFiles((prev) => [...prev, file]);
    }
    setActiveFileId(file.id);
  };
  
  // Handle tab close
  const handleTabClose = (fileId: number) => {
    setOpenFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (activeFileId === fileId) {
      const remaining = openFiles.filter((f) => f.id !== fileId);
      setActiveFileId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };
  
  // Handle file save
  const handleFileSave = (updated: WorkspaceFile) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f))
    );
    setRefreshKey((k) => k + 1);
  };
  
  // Handle search result click
  const handleSearchResultClick = async (result: SearchResult) => {
    try {
      const file = await getFile(result.id, projectId);
      if (file.file_type === 'file') {
        handleFileOpen(file);
      }
      setShowSearch(false);
    } catch (err) {
      console.error('Failed to open search result:', err);
    }
  };
  
  // Handle download
  const handleDownload = async () => {
    if (!selectedFile || selectedFile.file_type === 'folder') return;
    
    try {
      const blob = await downloadFile(selectedFile.id, projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Download failed');
    }
  };
  
  // Get active file
  const activeFile = openFiles.find((f) => f.id === activeFileId) || null;
  
  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + P for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);
  
  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Workspace</h1>
          <span className="text-sm text-gray-400">
            {stats && `${stats.file_count} files, ${formatFileSize(stats.total_size)}`}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(true)}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            🔍 Search
            <span className="text-xs text-gray-600 ml-1">⌘P</span>
          </button>
          
          <button
            onClick={() => setShowUpload(!showUpload)}
            className={`
              px-3 py-1.5 text-sm rounded transition-colors
              ${showUpload
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
              }
            `}
          >
            📤 Upload
          </button>
          
          <button
            onClick={() => setShowAIGenerator(true)}
            className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded hover:from-purple-500 hover:to-blue-500 transition-colors flex items-center gap-1"
          >
            ✨ AI Generate
          </button>
          
          {selectedFile && selectedFile.file_type === 'file' && (
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              📥 Download
            </button>
          )}
          
          <button
            onClick={() => navigate('/chat')}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors"
          >
            💬 Chat with AI
          </button>
        </div>
      </div>
      
      {/* Upload Zone (collapsible) */}
      {showUpload && (
        <div className="p-4 border-b border-gray-700">
          <UploadZone
            projectId={projectId}
            currentPath={currentPath}
            onUploadComplete={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* File Browser Sidebar */}
        <div className="w-64 border-r border-gray-700 flex-shrink-0">
          <FileBrowser
            key={refreshKey}
            projectId={projectId}
            selectedFileId={selectedFile?.id}
            onFileSelect={handleFileSelect}
            onFileOpen={handleFileOpen}
          />
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          {openFiles.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700 bg-gray-800 overflow-x-auto">
              {openFiles.map((file) => (
                <div
                  key={file.id}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-t text-sm cursor-pointer
                    ${file.id === activeFileId
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }
                  `}
                  onClick={() => setActiveFileId(file.id)}
                >
                  <span>{file.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTabClose(file.id);
                    }}
                    className="text-gray-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              file={activeFile}
              projectId={projectId}
              onSave={handleFileSave}
              onClose={activeFile ? () => handleTabClose(activeFile.id) : undefined}
            />
          </div>
        </div>
        
        {/* Search Panel */}
        {showSearch && (
          <SearchPanel
            projectId={projectId}
            onResultClick={handleSearchResultClick}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>
      
      {/* AI File Generator */}
      {showAIGenerator && (
        <AIFileGenerator
          onClose={() => setShowAIGenerator(false)}
          onFileSaved={(fileId, path) => {
            // Refresh file browser and open the new file
            setRefreshKey((prev) => prev + 1);
            setShowAIGenerator(false);
            // Optionally open the file
            getFile(fileId, projectId).then(handleFileOpen).catch(console.error);
          }}
        />
      )}
      
      {/* Toast Notifications */}
      <Toaster position="bottom-right" />
    </div>
  );
};

export default WorkspacePage;
