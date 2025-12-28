/**
 * ViewportPreview Component
 * 
 * Real-time viewport preview with:
 * - Screenshot thumbnails with delete option
 * - Full-size image modal with pan and zoom
 * - Before/After comparison slider
 * - Auto-capture toggle
 * - Enhanced UX with click-outside-to-close
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Layers,
  Eye,
  EyeOff,
  ArrowLeftRight,
  Minimize2,
  Trash2,
  Move,
  RotateCcw
} from 'lucide-react';

// Types
interface Screenshot {
  id: string;
  filename: string;
  timestamp: string;
  width: number;
  height: number;
  file_path: string;
  base64_data?: string;
  context?: string;
  tool_name?: string;
  is_before: boolean;
  paired_screenshot_id?: string;
}

interface BeforeAfterPair {
  id: string;
  before: Screenshot;
  after: Screenshot;
  tool_name: string;
  tool_params: Record<string, any>;
  created_at: string;
}

interface ViewportPreviewProps {
  screenshots: Screenshot[];
  pairs: BeforeAfterPair[];
  onCapture: () => Promise<void>;
  onRefresh: () => void;
  isCapturing: boolean;
  autoCapture: boolean;
  onToggleAutoCapture: (enabled: boolean) => void;
  onDeleteScreenshot?: (id: string) => void;
}

// Image Modal Component with pan and zoom
const ImageModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  screenshot: Screenshot | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onDelete?: () => void;
}> = ({ isOpen, onClose, screenshot, onPrevious, onNext, hasPrevious, hasNext, onDelete }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isClosing, setIsClosing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Reset state when modal opens or screenshot changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsClosing(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, screenshot]);
  
  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);
  
  // Reset position and zoom
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // Mouse down - start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  
  // Mouse move - drag image
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);
  
  // Mouse up - stop dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.5, Math.min(5, z + delta)));
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          if (showDeleteConfirm) {
            setShowDeleteConfirm(false);
          } else {
            handleClose();
          }
          break;
        case 'ArrowLeft':
          if (!showDeleteConfirm && hasPrevious && onPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (!showDeleteConfirm && hasNext && onNext) onNext();
          break;
        case '+':
        case '=':
          setZoom(z => Math.min(z + 0.25, 5));
          break;
        case '-':
          setZoom(z => Math.max(z - 0.25, 0.5));
          break;
        case '0':
          handleReset();
          break;
        case 'Delete':
        case 'Backspace':
          if (onDelete && !showDeleteConfirm) {
            setShowDeleteConfirm(true);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrevious, hasNext, onPrevious, onNext, handleClose, showDeleteConfirm, onDelete]);
  
  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current && !showDeleteConfirm) {
      handleClose();
    }
  };
  
  // Download screenshot
  const handleDownload = () => {
    if (!screenshot) return;
    
    const imageUrl = screenshot.base64_data 
      ? `data:image/png;base64,${screenshot.base64_data}`
      : screenshot.file_path;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = screenshot.filename || `screenshot-${screenshot.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete();
      setShowDeleteConfirm(false);
      handleClose();
    }
  };
  
  if (!isOpen || !screenshot) return null;
  
  const imageUrl = screenshot.base64_data 
    ? `data:image/png;base64,${screenshot.base64_data}`
    : screenshot.file_path;
  
  return (
    <div 
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`
        fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md
        transition-opacity duration-200
        ${isClosing ? 'opacity-0' : 'opacity-100'}
      `}
    >
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm mx-4 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-white text-lg font-semibold">Delete Screenshot?</h3>
            </div>
            <p className="text-white/60 mb-6">
              Are you sure you want to delete this screenshot? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Top toolbar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
        {/* Zoom and pan controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm font-medium min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom(z => Math.min(z + 0.25, 5))}
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-1" />
          <button
            onClick={handleReset}
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
            title="Reset view (0)"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setZoom(z => z === 1 ? 2 : 1)}
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
            title="Toggle 2x zoom"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg text-white/60 text-sm">
            <Move className="w-4 h-4" />
            <span>Drag to pan</span>
          </div>
        </div>
        
        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
            title="Download screenshot"
          >
            <Download className="w-5 h-5" />
            <span className="text-sm font-medium">Download</span>
          </button>
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all hover:scale-105"
              title="Delete screenshot (Del)"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-sm font-medium">Delete</span>
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
            title="Close (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      {/* Navigation arrows */}
      {hasPrevious && !showDeleteConfirm && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrevious?.(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 z-10"
          title="Previous (←)"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {hasNext && !showDeleteConfirm && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext?.(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 z-10"
          title="Next (→)"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
      
      {/* Image container with pan and zoom */}
      <div 
        className={`
          overflow-hidden rounded-lg cursor-grab active:cursor-grabbing
          transition-transform duration-200
          ${isClosing ? 'scale-95' : 'scale-100'}
        `}
        style={{
          maxWidth: '90vw',
          maxHeight: '80vh',
        }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt={screenshot.context || 'Viewport screenshot'}
          className="rounded-lg shadow-2xl select-none"
          style={{ 
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            maxWidth: '90vw',
            maxHeight: '80vh',
          }}
          draggable={false}
        />
      </div>
      
      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-6 text-white text-sm">
          <span className="flex items-center gap-2">
            <span className="text-white/60">Size:</span>
            <span className="font-medium">{screenshot.width} × {screenshot.height}</span>
          </span>
          <span className="text-white/30">•</span>
          <span className="flex items-center gap-2">
            <span className="text-white/60">Time:</span>
            <span className="font-medium">{new Date(screenshot.timestamp).toLocaleString()}</span>
          </span>
          {screenshot.context && (
            <>
              <span className="text-white/30">•</span>
              <span className="flex items-center gap-2">
                <span className="text-white/60">Context:</span>
                <span className="font-medium">{screenshot.context}</span>
              </span>
            </>
          )}
        </div>
        <div className="text-center text-white/40 text-xs mt-2">
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Esc</kbd> close • 
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 ml-1">←</kbd> <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">→</kbd> navigate • 
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 ml-1">+</kbd> <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">-</kbd> zoom •
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 ml-1">Scroll</kbd> zoom •
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 ml-1">Drag</kbd> pan •
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60 ml-1">Del</kbd> delete
        </div>
      </div>
    </div>
  );
};

// Before/After Comparison Slider Component
const BeforeAfterSlider: React.FC<{
  pair: BeforeAfterPair;
  onClose: () => void;
}> = ({ pair, onClose }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);
  
  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft') setSliderPosition(p => Math.max(0, p - 5));
      if (e.key === 'ArrowRight') setSliderPosition(p => Math.min(100, p + 5));
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, [isDragging]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove as any);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove as any);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      handleClose();
    }
  };
  
  const beforeUrl = pair.before.base64_data 
    ? `data:image/png;base64,${pair.before.base64_data}`
    : pair.before.file_path;
    
  const afterUrl = pair.after.base64_data 
    ? `data:image/png;base64,${pair.after.base64_data}`
    : pair.after.file_path;
  
  return (
    <div 
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`
        fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md
        transition-opacity duration-200
        ${isClosing ? 'opacity-0' : 'opacity-100'}
      `}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="text-white">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Before / After: {pair.tool_name}
          </h3>
          <p className="text-sm text-white/60">{new Date(pair.created_at).toLocaleString()}</p>
        </div>
        
        <button
          onClick={handleClose}
          className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
          title="Close (Esc)"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {/* Comparison container */}
      <div
        ref={containerRef}
        className={`
          relative max-w-[90vw] max-h-[75vh] overflow-hidden cursor-ew-resize select-none rounded-lg shadow-2xl
          transition-transform duration-200
          ${isClosing ? 'scale-95' : 'scale-100'}
        `}
        onMouseMove={handleMouseMove}
        onClick={(e) => e.stopPropagation()}
      >
        {/* After image (full) */}
        <img
          src={afterUrl}
          alt="After"
          className="block max-w-full max-h-[75vh]"
          draggable={false}
        />
        
        {/* Before image (clipped) */}
        <div
          className="absolute top-0 left-0 h-full overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={beforeUrl}
            alt="Before"
            className="block max-h-[75vh]"
            style={{ maxWidth: 'none', width: containerRef.current?.offsetWidth || 'auto' }}
            draggable={false}
          />
        </div>
        
        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
          onMouseDown={() => setIsDragging(true)}
        >
          {/* Slider handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
            <ArrowLeftRight className="w-6 h-6 text-gray-800" />
          </div>
        </div>
        
        {/* Labels */}
        <div className="absolute top-4 left-4 bg-orange-500 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-sm font-bold shadow-lg">
          BEFORE
        </div>
        <div className="absolute top-4 right-4 bg-green-500 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-sm font-bold shadow-lg">
          AFTER
        </div>
      </div>
      
      {/* Bottom instructions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="text-center text-white/60 text-sm">
          Drag the slider or use <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/80">←</kbd> <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/80">→</kbd> keys to compare • 
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/80 ml-1">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};

// Screenshot Thumbnail Component with delete button
const ScreenshotThumbnail: React.FC<{
  screenshot: Screenshot;
  onClick: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
}> = ({ screenshot, onClick, onDelete, isSelected }) => {
  const imageUrl = screenshot.base64_data 
    ? `data:image/png;base64,${screenshot.base64_data}`
    : screenshot.file_path;
  
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    }
  };
  
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowDeleteBtn(true)}
      onMouseLeave={() => setShowDeleteBtn(false)}
      className={`
        relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200
        hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20
        ${isSelected ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-white/10 hover:border-purple-500/50'}
      `}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
          <Camera className="w-6 h-6 text-gray-600" />
        </div>
      )}
      
      {hasError ? (
        <div className="w-full h-24 bg-gray-800 flex items-center justify-center">
          <Camera className="w-8 h-8 text-gray-600" />
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={screenshot.context || 'Screenshot'}
          className={`w-full h-24 object-cover transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setIsLoading(false)}
          onError={() => { setHasError(true); setIsLoading(false); }}
        />
      )}
      
      {/* Delete button on hover */}
      {onDelete && showDeleteBtn && (
        <button
          onClick={handleDelete}
          className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/90 hover:bg-red-600 rounded-lg text-white transition-all z-10 shadow-lg"
          title="Delete screenshot"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
          <ZoomIn className="w-5 h-5 text-white" />
        </div>
      </div>
      
      {/* Before/After badge */}
      {screenshot.is_before && (
        <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-lg">
          Before
        </div>
      )}
      {screenshot.paired_screenshot_id && !screenshot.is_before && (
        <div className="absolute top-1.5 left-1.5 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-lg">
          After
        </div>
      )}
      
      {/* Timestamp */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
        <span className="text-white text-xs font-medium">
          {new Date(screenshot.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

// Main ViewportPreview Component
export const ViewportPreview: React.FC<ViewportPreviewProps> = ({
  screenshots,
  pairs,
  onCapture,
  onRefresh,
  isCapturing,
  autoCapture,
  onToggleAutoCapture,
  onDeleteScreenshot
}) => {
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [selectedPair, setSelectedPair] = useState<BeforeAfterPair | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [viewMode, setViewMode] = useState<'screenshots' | 'comparisons'>('screenshots');
  const [localScreenshots, setLocalScreenshots] = useState<Screenshot[]>(screenshots);
  
  // Sync local screenshots with props
  useEffect(() => {
    setLocalScreenshots(screenshots);
  }, [screenshots]);
  
  const currentIndex = selectedScreenshot 
    ? localScreenshots.findIndex(s => s.id === selectedScreenshot.id)
    : -1;
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setSelectedScreenshot(localScreenshots[currentIndex - 1]);
    }
  };
  
  const handleNext = () => {
    if (currentIndex < localScreenshots.length - 1) {
      setSelectedScreenshot(localScreenshots[currentIndex + 1]);
    }
  };
  
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedScreenshot(null);
  };
  
  const handleCloseComparison = () => {
    setShowComparison(false);
    setSelectedPair(null);
  };
  
  // Handle delete from modal
  const handleDeleteFromModal = () => {
    if (selectedScreenshot && onDeleteScreenshot) {
      onDeleteScreenshot(selectedScreenshot.id);
      // Remove from local state
      setLocalScreenshots(prev => prev.filter(s => s.id !== selectedScreenshot.id));
      // Navigate to next or previous screenshot, or close modal
      if (currentIndex < localScreenshots.length - 1) {
        setSelectedScreenshot(localScreenshots[currentIndex + 1]);
      } else if (currentIndex > 0) {
        setSelectedScreenshot(localScreenshots[currentIndex - 1]);
      } else {
        handleCloseModal();
      }
    }
  };
  
  // Handle delete from thumbnail
  const handleDeleteFromThumbnail = (id: string) => {
    if (onDeleteScreenshot) {
      onDeleteScreenshot(id);
      setLocalScreenshots(prev => prev.filter(s => s.id !== id));
    }
  };
  
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Viewport Preview</h3>
              <p className="text-white/60 text-sm">{localScreenshots.length} screenshots • {pairs.length} comparisons</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Auto-capture toggle */}
            <button
              onClick={() => onToggleAutoCapture(!autoCapture)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all
                ${autoCapture 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 shadow-lg shadow-green-500/10' 
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'}
              `}
            >
              {autoCapture ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Auto-Capture
            </button>
            
            {/* Refresh button */}
            <button
              onClick={onRefresh}
              className="p-2.5 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all border border-white/10"
              title="Refresh screenshots"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            {/* Capture button */}
            <button
              onClick={onCapture}
              disabled={isCapturing}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all
                ${isCapturing 
                  ? 'bg-purple-500/50 text-white/50 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105'}
              `}
            >
              <Camera className="w-4 h-4" />
              {isCapturing ? 'Capturing...' : 'Capture Now'}
            </button>
          </div>
        </div>
        
        {/* View mode tabs */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setViewMode('screenshots')}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${viewMode === 'screenshots' 
                ? 'bg-white/10 text-white shadow-inner' 
                : 'text-white/60 hover:text-white hover:bg-white/5'}
            `}
          >
            <Camera className="w-4 h-4 inline mr-2" />
            Screenshots ({localScreenshots.length})
          </button>
          <button
            onClick={() => setViewMode('comparisons')}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2
              ${viewMode === 'comparisons' 
                ? 'bg-white/10 text-white shadow-inner' 
                : 'text-white/60 hover:text-white hover:bg-white/5'}
            `}
          >
            <Layers className="w-4 h-4" />
            Comparisons ({pairs.length})
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {viewMode === 'screenshots' ? (
          // Screenshots grid
          localScreenshots.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {localScreenshots.map((screenshot) => (
                <ScreenshotThumbnail
                  key={screenshot.id}
                  screenshot={screenshot}
                  onClick={() => {
                    setSelectedScreenshot(screenshot);
                    setShowModal(true);
                  }}
                  onDelete={onDeleteScreenshot ? () => handleDeleteFromThumbnail(screenshot.id) : undefined}
                  isSelected={selectedScreenshot?.id === screenshot.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-white/20" />
              </div>
              <p className="text-white/60 font-medium">No screenshots yet</p>
              <p className="text-white/40 text-sm mt-1">Click "Capture Now" or enable auto-capture</p>
            </div>
          )
        ) : (
          // Comparisons list
          pairs.length > 0 ? (
            <div className="space-y-3">
              {pairs.map((pair) => (
                <div
                  key={pair.id}
                  onClick={() => {
                    setSelectedPair(pair);
                    setShowComparison(true);
                  }}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-purple-500/50 hover:bg-white/10 cursor-pointer transition-all hover:shadow-lg hover:shadow-purple-500/10"
                >
                  {/* Before thumbnail */}
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={pair.before.base64_data 
                        ? `data:image/png;base64,${pair.before.base64_data}`
                        : pair.before.file_path}
                      alt="Before"
                      className="w-24 h-14 object-cover"
                    />
                    <span className="absolute bottom-0 left-0 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-tr font-medium">
                      Before
                    </span>
                  </div>
                  
                  <div className="p-2 bg-white/10 rounded-full">
                    <ArrowLeftRight className="w-4 h-4 text-white/60" />
                  </div>
                  
                  {/* After thumbnail */}
                  <div className="relative rounded-lg overflow-hidden">
                    <img
                      src={pair.after.base64_data 
                        ? `data:image/png;base64,${pair.after.base64_data}`
                        : pair.after.file_path}
                      alt="After"
                      className="w-24 h-14 object-cover"
                    />
                    <span className="absolute bottom-0 left-0 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-tr font-medium">
                      After
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{pair.tool_name}</p>
                    <p className="text-white/60 text-sm">
                      {new Date(pair.created_at).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="p-2 bg-white/5 rounded-lg">
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8 text-white/20" />
              </div>
              <p className="text-white/60 font-medium">No comparisons yet</p>
              <p className="text-white/40 text-sm mt-1">Enable auto-capture to create before/after comparisons</p>
            </div>
          )
        )}
      </div>
      
      {/* Image Modal */}
      <ImageModal
        isOpen={showModal}
        onClose={handleCloseModal}
        screenshot={selectedScreenshot}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasPrevious={currentIndex > 0}
        hasNext={currentIndex < localScreenshots.length - 1}
        onDelete={onDeleteScreenshot ? handleDeleteFromModal : undefined}
      />
      
      {/* Before/After Comparison */}
      {showComparison && selectedPair && (
        <BeforeAfterSlider
          pair={selectedPair}
          onClose={handleCloseComparison}
        />
      )}
    </div>
  );
};

export default ViewportPreview;
