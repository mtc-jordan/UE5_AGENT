/**
 * UE5 AI Studio - File Icons & Language Badges
 * =============================================
 * 
 * Professional file type icons and language badges for the workspace.
 * Uses lucide-react for consistent, beautiful icons.
 * 
 * Version: 2.0.0
 */

import React from 'react';
import {
  FileCode2,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Image,
  FileVideo,
  FileAudio,
  FileArchive,
  File,
  Settings,
  Database,
  Globe,
  Palette,
  Package,
  Terminal,
  Braces,
  Code2,
  FileSpreadsheet,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface FileIconProps {
  fileName: string;
  fileType: 'file' | 'folder';
  language?: string | null;
  isOpen?: boolean;
  className?: string;
  size?: number;
}

export interface LanguageBadgeProps {
  fileName: string;
  language?: string | null;
  className?: string;
}

// =============================================================================
// ICON MAPPING
// =============================================================================

/**
 * Get the appropriate icon component for a file
 */
export function getFileIconComponent(fileName: string, fileType: 'file' | 'folder', isOpen = false): React.ReactElement {
  if (fileType === 'folder') {
    return isOpen ? <FolderOpen className="text-yellow-500" /> : <Folder className="text-yellow-500" />;
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Programming Languages
  const codeIcons: Record<string, { icon: React.ReactElement; color: string }> = {
    // C/C++
    cpp: { icon: <FileCode2 />, color: 'text-blue-500' },
    cc: { icon: <FileCode2 />, color: 'text-blue-500' },
    cxx: { icon: <FileCode2 />, color: 'text-blue-500' },
    c: { icon: <FileCode2 />, color: 'text-blue-400' },
    h: { icon: <FileCode2 />, color: 'text-purple-400' },
    hpp: { icon: <FileCode2 />, color: 'text-purple-400' },
    hxx: { icon: <FileCode2 />, color: 'text-purple-400' },

    // JavaScript/TypeScript
    js: { icon: <FileCode2 />, color: 'text-yellow-400' },
    jsx: { icon: <Code2 />, color: 'text-cyan-400' },
    ts: { icon: <FileCode2 />, color: 'text-blue-600' },
    tsx: { icon: <Code2 />, color: 'text-blue-500' },
    mjs: { icon: <FileCode2 />, color: 'text-yellow-400' },
    cjs: { icon: <FileCode2 />, color: 'text-yellow-400' },

    // Python
    py: { icon: <FileCode2 />, color: 'text-blue-400' },
    pyw: { icon: <FileCode2 />, color: 'text-blue-400' },
    pyi: { icon: <FileCode2 />, color: 'text-blue-400' },

    // Web
    html: { icon: <Globe />, color: 'text-orange-500' },
    htm: { icon: <Globe />, color: 'text-orange-500' },
    css: { icon: <Palette />, color: 'text-blue-400' },
    scss: { icon: <Palette />, color: 'text-pink-400' },
    sass: { icon: <Palette />, color: 'text-pink-400' },
    less: { icon: <Palette />, color: 'text-blue-500' },

    // Data/Config
    json: { icon: <Braces />, color: 'text-yellow-500' },
    jsonc: { icon: <Braces />, color: 'text-yellow-500' },
    yaml: { icon: <Settings />, color: 'text-purple-400' },
    yml: { icon: <Settings />, color: 'text-purple-400' },
    toml: { icon: <Settings />, color: 'text-gray-400' },
    ini: { icon: <Settings />, color: 'text-gray-400' },
    xml: { icon: <FileCode2 />, color: 'text-orange-400' },
    csv: { icon: <FileSpreadsheet />, color: 'text-green-500' },

    // Markdown/Docs
    md: { icon: <FileText />, color: 'text-blue-400' },
    mdx: { icon: <FileText />, color: 'text-blue-500' },
    txt: { icon: <FileText />, color: 'text-gray-400' },
    rst: { icon: <FileText />, color: 'text-gray-400' },

    // Shell/Scripts
    sh: { icon: <Terminal />, color: 'text-green-400' },
    bash: { icon: <Terminal />, color: 'text-green-400' },
    zsh: { icon: <Terminal />, color: 'text-green-400' },
    fish: { icon: <Terminal />, color: 'text-green-400' },
    ps1: { icon: <Terminal />, color: 'text-blue-400' },
    bat: { icon: <Terminal />, color: 'text-gray-400' },
    cmd: { icon: <Terminal />, color: 'text-gray-400' },

    // Database
    sql: { icon: <Database />, color: 'text-orange-400' },
    db: { icon: <Database />, color: 'text-gray-400' },
    sqlite: { icon: <Database />, color: 'text-blue-400' },

    // Images
    png: { icon: <Image />, color: 'text-purple-400' },
    jpg: { icon: <Image />, color: 'text-purple-400' },
    jpeg: { icon: <Image />, color: 'text-purple-400' },
    gif: { icon: <Image />, color: 'text-purple-400' },
    svg: { icon: <Image />, color: 'text-orange-400' },
    webp: { icon: <Image />, color: 'text-purple-400' },
    ico: { icon: <Image />, color: 'text-gray-400' },

    // Video
    mp4: { icon: <FileVideo />, color: 'text-red-400' },
    mov: { icon: <FileVideo />, color: 'text-red-400' },
    avi: { icon: <FileVideo />, color: 'text-red-400' },
    mkv: { icon: <FileVideo />, color: 'text-red-400' },
    webm: { icon: <FileVideo />, color: 'text-red-400' },

    // Audio
    mp3: { icon: <FileAudio />, color: 'text-green-400' },
    wav: { icon: <FileAudio />, color: 'text-green-400' },
    ogg: { icon: <FileAudio />, color: 'text-green-400' },
    flac: { icon: <FileAudio />, color: 'text-green-400' },

    // Archives
    zip: { icon: <FileArchive />, color: 'text-yellow-600' },
    rar: { icon: <FileArchive />, color: 'text-yellow-600' },
    '7z': { icon: <FileArchive />, color: 'text-yellow-600' },
    tar: { icon: <FileArchive />, color: 'text-yellow-600' },
    gz: { icon: <FileArchive />, color: 'text-yellow-600' },

    // Package files
    'package.json': { icon: <Package />, color: 'text-green-500' },
    'package-lock.json': { icon: <Package />, color: 'text-green-600' },
    'yarn.lock': { icon: <Package />, color: 'text-blue-400' },
    'pnpm-lock.yaml': { icon: <Package />, color: 'text-orange-400' },

    // UE5 specific
    uasset: { icon: <Package />, color: 'text-indigo-500' },
    umap: { icon: <Globe />, color: 'text-indigo-400' },
    uplugin: { icon: <Package />, color: 'text-purple-500' },
    uproject: { icon: <Package />, color: 'text-blue-500' },
  };

  // Check full filename first (for special files like package.json)
  if (codeIcons[fileName.toLowerCase()]) {
    const { icon, color } = codeIcons[fileName.toLowerCase()];
    return React.cloneElement(icon, { className: color });
  }

  // Then check extension
  if (codeIcons[ext]) {
    const { icon, color } = codeIcons[ext];
    return React.cloneElement(icon, { className: color });
  }

  // Default file icon
  return <File className="text-gray-400" />;
}

/**
 * FileIcon Component
 */
export const FileIcon: React.FC<FileIconProps> = ({
  fileName,
  fileType,
  language,
  isOpen = false,
  className = '',
  size = 16,
}) => {
  const icon = getFileIconComponent(fileName, fileType, isOpen);

  return (
    <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {React.cloneElement(icon, { size })}
    </span>
  );
};

// =============================================================================
// LANGUAGE BADGES
// =============================================================================

/**
 * Get language display name and color
 */
export function getLanguageInfo(fileName: string, language?: string | null): { name: string; color: string } | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, { name: string; color: string }> = {
    // Programming
    cpp: { name: 'C++', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    cc: { name: 'C++', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    cxx: { name: 'C++', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    c: { name: 'C', color: 'bg-blue-400/20 text-blue-300 border-blue-400/30' },
    h: { name: 'Header', color: 'bg-purple-400/20 text-purple-300 border-purple-400/30' },
    hpp: { name: 'C++ Header', color: 'bg-purple-400/20 text-purple-300 border-purple-400/30' },
    js: { name: 'JavaScript', color: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30' },
    jsx: { name: 'React', color: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30' },
    ts: { name: 'TypeScript', color: 'bg-blue-600/20 text-blue-400 border-blue-600/30' },
    tsx: { name: 'React TS', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    py: { name: 'Python', color: 'bg-blue-400/20 text-blue-300 border-blue-400/30' },

    // Web
    html: { name: 'HTML', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    css: { name: 'CSS', color: 'bg-blue-400/20 text-blue-300 border-blue-400/30' },
    scss: { name: 'SCSS', color: 'bg-pink-400/20 text-pink-300 border-pink-400/30' },

    // Data
    json: { name: 'JSON', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    yaml: { name: 'YAML', color: 'bg-purple-400/20 text-purple-300 border-purple-400/30' },
    yml: { name: 'YAML', color: 'bg-purple-400/20 text-purple-300 border-purple-400/30' },

    // Docs
    md: { name: 'Markdown', color: 'bg-blue-400/20 text-blue-300 border-blue-400/30' },
    txt: { name: 'Text', color: 'bg-gray-400/20 text-gray-300 border-gray-400/30' },

    // Shell
    sh: { name: 'Shell', color: 'bg-green-400/20 text-green-300 border-green-400/30' },
    bash: { name: 'Bash', color: 'bg-green-400/20 text-green-300 border-green-400/30' },

    // UE5
    uasset: { name: 'UE Asset', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    umap: { name: 'UE Map', color: 'bg-indigo-400/20 text-indigo-300 border-indigo-400/30' },
  };

  return languageMap[ext] || null;
}

/**
 * LanguageBadge Component
 */
export const LanguageBadge: React.FC<LanguageBadgeProps> = ({ fileName, language, className = '' }) => {
  const info = getLanguageInfo(fileName, language);

  if (!info) return null;

  return (
    <span
      className={`
        inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border
        ${info.color}
        ${className}
      `}
    >
      {info.name}
    </span>
  );
};

// =============================================================================
// FILE SIZE BADGE
// =============================================================================

export interface FileSizeBadgeProps {
  size: number;
  className?: string;
}

/**
 * Format and display file size
 */
export const FileSizeBadge: React.FC<FileSizeBadgeProps> = ({ size, className = '' }) => {
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <span className={`text-xs text-gray-500 ${className}`}>
      {formatSize(size)}
    </span>
  );
};
