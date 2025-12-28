/**
 * ViewportPreview Component
 * 
 * Real-time viewport preview with:
 * - Screenshot thumbnails
 * - Full-size image modal
 * - Before/After comparison slider
 * - Auto-capture toggle
 */

import React, { useState, useRef, useEffect } from 'react';
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
  ArrowLeftRight
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
}

// Image Modal Component
const ImageModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  screenshot: Screenshot | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}> = ({ isOpen, onClose, screenshot, onPrevious, onNext, hasPrevious, hasNext }) => {
  const [zoom, setZoom] = useState(1);
  
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
    }
  }, [isOpen, screenshot]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) onPrevious();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrevious, hasNext, onPrevious, onNext, onClose]);
  
  if (!isOpen || !screenshot) return null;
  
  const imageUrl = screenshot.base64_data 
    ? `data:image/png;base64,${screenshot.base64_data}`
    : screenshot.file_path;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>
      
      {/* Zoom controls */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <button
          onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-white text-sm font-medium px-2">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
      
      {/* Navigation arrows */}
      {hasPrevious && (
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
      
      {/* Image */}
      <div className="max-w-[90vw] max-h-[85vh] overflow-auto">
        <img
          src={imageUrl}
          alt={screenshot.context || 'Viewport screenshot'}
          className="transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        />
      </div>
      
      {/* Info bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
        <div className="flex items-center gap-4">
          <span>{screenshot.width} × {screenshot.height}</span>
          <span>•</span>
          <span>{new Date(screenshot.timestamp).toLocaleString()}</span>
          {screenshot.context && (
            <>
              <span>•</span>
              <span>{screenshot.context}</span>
            </>
          )}
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove as any);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove as any);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);
  
  const beforeUrl = pair.before.base64_data 
    ? `data:image/png;base64,${pair.before.base64_data}`
    : pair.before.file_path;
    
  const afterUrl = pair.after.base64_data 
    ? `data:image/png;base64,${pair.after.base64_data}`
    : pair.after.file_path;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>
      
      {/* Title */}
      <div className="absolute top-4 left-4 text-white">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5" />
          Before / After: {pair.tool_name}
        </h3>
        <p className="text-sm text-white/60">{new Date(pair.created_at).toLocaleString()}</p>
      </div>
      
      {/* Comparison container */}
      <div
        ref={containerRef}
        className="relative max-w-[90vw] max-h-[80vh] overflow-hidden cursor-ew-resize select-none"
        onMouseMove={handleMouseMove}
      >
        {/* After image (full) */}
        <img
          src={afterUrl}
          alt="After"
          className="block max-w-full max-h-[80vh]"
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
            className="block max-h-[80vh]"
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-gray-800" />
          </div>
        </div>
        
        {/* Labels */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-white text-sm font-medium">
          Before
        </div>
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-white text-sm font-medium">
          After
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
        Drag the slider to compare before and after
      </div>
    </div>
  );
};

// Screenshot Thumbnail Component
const ScreenshotThumbnail: React.FC<{
  screenshot: Screenshot;
  onClick: () => void;
  isSelected?: boolean;
}> = ({ screenshot, onClick, isSelected }) => {
  const imageUrl = screenshot.base64_data 
    ? `data:image/png;base64,${screenshot.base64_data}`
    : screenshot.file_path;
  
  // For file paths, show a placeholder if we can't load the image
  const [hasError, setHasError] = useState(false);
  
  return (
    <div
      onClick={onClick}
      className={`
        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-white/10 hover:border-white/30'}
      `}
    >
      {hasError ? (
        <div className="w-full h-24 bg-gray-800 flex items-center justify-center">
          <Camera className="w-8 h-8 text-gray-600" />
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={screenshot.context || 'Screenshot'}
          className="w-full h-24 object-cover"
          onError={() => setHasError(true)}
        />
      )}
      
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ZoomIn className="w-6 h-6 text-white" />
      </div>
      
      {/* Before/After badge */}
      {screenshot.is_before && (
        <div className="absolute top-1 left-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded">
          Before
        </div>
      )}
      {screenshot.paired_screenshot_id && !screenshot.is_before && (
        <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
          After
        </div>
      )}
      
      {/* Timestamp */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
        <span className="text-white text-xs">
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
  onToggleAutoCapture
}) => {
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [selectedPair, setSelectedPair] = useState<BeforeAfterPair | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [viewMode, setViewMode] = useState<'screenshots' | 'comparisons'>('screenshots');
  
  const currentIndex = selectedScreenshot 
    ? screenshots.findIndex(s => s.id === selectedScreenshot.id)
    : -1;
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setSelectedScreenshot(screenshots[currentIndex - 1]);
    }
  };
  
  const handleNext = () => {
    if (currentIndex < screenshots.length - 1) {
      setSelectedScreenshot(screenshots[currentIndex + 1]);
    }
  };
  
  const handleDownload = async (screenshot: Screenshot) => {
    const imageUrl = screenshot.base64_data 
      ? `data:image/png;base64,${screenshot.base64_data}`
      : screenshot.file_path;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = screenshot.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Viewport Preview</h3>
              <p className="text-white/60 text-sm">{screenshots.length} screenshots</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Auto-capture toggle */}
            <button
              onClick={() => onToggleAutoCapture(!autoCapture)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${autoCapture 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'}
              `}
            >
              {autoCapture ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Auto
            </button>
            
            {/* Refresh button */}
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            {/* Capture button */}
            <button
              onClick={onCapture}
              disabled={isCapturing}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                ${isCapturing 
                  ? 'bg-purple-500/50 text-white/50 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25'}
              `}
            >
              <Camera className="w-4 h-4" />
              {isCapturing ? 'Capturing...' : 'Capture'}
            </button>
          </div>
        </div>
        
        {/* View mode tabs */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setViewMode('screenshots')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${viewMode === 'screenshots' 
                ? 'bg-white/10 text-white' 
                : 'text-white/60 hover:text-white hover:bg-white/5'}
            `}
          >
            Screenshots ({screenshots.length})
          </button>
          <button
            onClick={() => setViewMode('comparisons')}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
              ${viewMode === 'comparisons' 
                ? 'bg-white/10 text-white' 
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
          screenshots.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {screenshots.map((screenshot) => (
                <ScreenshotThumbnail
                  key={screenshot.id}
                  screenshot={screenshot}
                  onClick={() => {
                    setSelectedScreenshot(screenshot);
                    setShowModal(true);
                  }}
                  isSelected={selectedScreenshot?.id === screenshot.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Camera className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No screenshots yet</p>
              <p className="text-white/40 text-sm">Click "Capture" or enable auto-capture</p>
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
                  className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer transition-colors"
                >
                  {/* Before thumbnail */}
                  <div className="relative">
                    <img
                      src={pair.before.base64_data 
                        ? `data:image/png;base64,${pair.before.base64_data}`
                        : pair.before.file_path}
                      alt="Before"
                      className="w-20 h-12 object-cover rounded"
                    />
                    <span className="absolute bottom-0 left-0 bg-orange-500 text-white text-xs px-1 rounded-tr">
                      Before
                    </span>
                  </div>
                  
                  <ArrowLeftRight className="w-5 h-5 text-white/40" />
                  
                  {/* After thumbnail */}
                  <div className="relative">
                    <img
                      src={pair.after.base64_data 
                        ? `data:image/png;base64,${pair.after.base64_data}`
                        : pair.after.file_path}
                      alt="After"
                      className="w-20 h-12 object-cover rounded"
                    />
                    <span className="absolute bottom-0 left-0 bg-green-500 text-white text-xs px-1 rounded-tr">
                      After
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1">
                    <p className="text-white font-medium">{pair.tool_name}</p>
                    <p className="text-white/60 text-sm">
                      {new Date(pair.created_at).toLocaleString()}
                    </p>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-white/40" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Layers className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No comparisons yet</p>
              <p className="text-white/40 text-sm">Enable auto-capture to create before/after comparisons</p>
            </div>
          )
        )}
      </div>
      
      {/* Image Modal */}
      <ImageModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        screenshot={selectedScreenshot}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasPrevious={currentIndex > 0}
        hasNext={currentIndex < screenshots.length - 1}
      />
      
      {/* Before/After Comparison */}
      {showComparison && selectedPair && (
        <BeforeAfterSlider
          pair={selectedPair}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
};

export default ViewportPreview;
