/**
 * ScreenshotAnnotator Component
 * 
 * A full-featured annotation editor for screenshots with:
 * - Freehand drawing with brush sizes and colors
 * - Shapes: rectangles, circles, arrows, lines
 * - Text annotations with font sizes
 * - Highlighter tool
 * - Undo/Redo support
 * - Export annotated image
 * - Share functionality
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Pencil,
  Square,
  Circle,
  ArrowRight,
  Type,
  Highlighter,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Share2,
  Minus,
  MousePointer,
  Check,
  Palette,
  Save
} from 'lucide-react';

// Types
type Tool = 'select' | 'pen' | 'highlighter' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text';

interface Point {
  x: number;
  y: number;
}

interface Annotation {
  id: string;
  type: Tool;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  opacity?: number;
}

interface ScreenshotAnnotatorProps {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
  onSave?: (annotatedImageData: string, annotations: Annotation[]) => void;
  onShare?: (annotatedImageData: string) => void;
}

// Color palette
const COLORS = [
  '#FF0000', // Red
  '#FF6B00', // Orange
  '#FFD700', // Yellow
  '#00FF00', // Green
  '#00BFFF', // Light Blue
  '#0066FF', // Blue
  '#8B00FF', // Purple
  '#FF1493', // Pink
  '#FFFFFF', // White
  '#000000', // Black
];

// Brush sizes
const BRUSH_SIZES = [2, 4, 6, 8, 12, 16, 24];

// Font sizes for text
const FONT_SIZES = [14, 18, 24, 32, 48, 64];

export const ScreenshotAnnotator: React.FC<ScreenshotAnnotatorProps> = ({
  imageUrl,
  imageName = 'screenshot',
  onClose,
  onSave,
  onShare
}) => {
  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // State
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#FF0000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(24);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      
      // Calculate canvas size to fit in viewport
      const maxWidth = window.innerWidth * 0.85;
      const maxHeight = window.innerHeight * 0.75;
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }
      
      setCanvasSize({ width, height });
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);
  
  // Draw everything on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img || !imageLoaded) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Draw all annotations
    const allAnnotations = currentAnnotation 
      ? [...annotations, currentAnnotation]
      : annotations;
    
    allAnnotations.forEach(annotation => {
      drawAnnotation(ctx, annotation);
    });
  }, [annotations, currentAnnotation, imageLoaded]);
  
  // Draw a single annotation
  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.save();
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;
    ctx.lineWidth = annotation.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (annotation.opacity) {
      ctx.globalAlpha = annotation.opacity;
    }
    
    switch (annotation.type) {
      case 'pen':
      case 'highlighter':
        if (annotation.points && annotation.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
          annotation.points.forEach((point, i) => {
            if (i > 0) {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
        }
        break;
        
      case 'rectangle':
        if (annotation.startPoint && annotation.endPoint) {
          const width = annotation.endPoint.x - annotation.startPoint.x;
          const height = annotation.endPoint.y - annotation.startPoint.y;
          ctx.strokeRect(annotation.startPoint.x, annotation.startPoint.y, width, height);
        }
        break;
        
      case 'circle':
        if (annotation.startPoint && annotation.endPoint) {
          const centerX = (annotation.startPoint.x + annotation.endPoint.x) / 2;
          const centerY = (annotation.startPoint.y + annotation.endPoint.y) / 2;
          const radiusX = Math.abs(annotation.endPoint.x - annotation.startPoint.x) / 2;
          const radiusY = Math.abs(annotation.endPoint.y - annotation.startPoint.y) / 2;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
        
      case 'arrow':
        if (annotation.startPoint && annotation.endPoint) {
          drawArrow(ctx, annotation.startPoint, annotation.endPoint, annotation.strokeWidth);
        }
        break;
        
      case 'line':
        if (annotation.startPoint && annotation.endPoint) {
          ctx.beginPath();
          ctx.moveTo(annotation.startPoint.x, annotation.startPoint.y);
          ctx.lineTo(annotation.endPoint.x, annotation.endPoint.y);
          ctx.stroke();
        }
        break;
        
      case 'text':
        if (annotation.startPoint && annotation.text) {
          ctx.font = `${annotation.fontSize || 24}px Arial, sans-serif`;
          ctx.fillText(annotation.text, annotation.startPoint.x, annotation.startPoint.y);
        }
        break;
    }
    
    ctx.restore();
  };
  
  // Draw arrow with head
  const drawArrow = (ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number) => {
    const headLength = width * 4;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    
    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLength * Math.cos(angle - Math.PI / 6),
      to.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLength * Math.cos(angle + Math.PI / 6),
      to.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };
  
  // Redraw when annotations change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);
  
  // Get mouse position relative to canvas
  const getMousePos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };
  
  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'select') return;
    
    const pos = getMousePos(e);
    
    if (tool === 'text') {
      setTextPosition(pos);
      setTextInput('');
      return;
    }
    
    setIsDrawing(true);
    
    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      type: tool,
      color,
      strokeWidth,
      fontSize,
      opacity: tool === 'highlighter' ? 0.4 : 1
    };
    
    if (tool === 'pen' || tool === 'highlighter') {
      newAnnotation.points = [pos];
      newAnnotation.strokeWidth = tool === 'highlighter' ? strokeWidth * 3 : strokeWidth;
    } else {
      newAnnotation.startPoint = pos;
      newAnnotation.endPoint = pos;
    }
    
    setCurrentAnnotation(newAnnotation);
  };
  
  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentAnnotation) return;
    
    const pos = getMousePos(e);
    
    if (currentAnnotation.type === 'pen' || currentAnnotation.type === 'highlighter') {
      setCurrentAnnotation({
        ...currentAnnotation,
        points: [...(currentAnnotation.points || []), pos]
      });
    } else {
      setCurrentAnnotation({
        ...currentAnnotation,
        endPoint: pos
      });
    }
  };
  
  // Mouse up handler
  const handleMouseUp = () => {
    if (!isDrawing || !currentAnnotation) return;
    
    setIsDrawing(false);
    
    // Add to annotations
    const newAnnotations = [...annotations, currentAnnotation];
    setAnnotations(newAnnotations);
    setCurrentAnnotation(null);
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  // Add text annotation
  const handleAddText = () => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null);
      return;
    }
    
    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      type: 'text',
      startPoint: textPosition,
      text: textInput,
      color,
      strokeWidth,
      fontSize
    };
    
    const newAnnotations = [...annotations, newAnnotation];
    setAnnotations(newAnnotations);
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setTextPosition(null);
    setTextInput('');
  };
  
  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  };
  
  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  };
  
  // Clear all annotations
  const handleClear = () => {
    setAnnotations([]);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  // Get annotated image as data URL
  const getAnnotatedImageData = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };
  
  // Download annotated image
  const handleDownload = () => {
    const dataUrl = getAnnotatedImageData();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${imageName}-annotated.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Save annotated image
  const handleSave = () => {
    if (onSave) {
      const dataUrl = getAnnotatedImageData();
      onSave(dataUrl, annotations);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    }
  };
  
  // Share annotated image
  const handleShare = async () => {
    const dataUrl = getAnnotatedImageData();
    
    // Try native share API first
    if (navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `${imageName}-annotated.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Annotated Screenshot'});
        return;
      } catch (err) {
        console.log('Native share failed, falling back to callback');
      }
    }
    
    // Fallback to callback
    if (onShare) {
      onShare(dataUrl);
    } else {
      // Copy to clipboard as fallback
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('Image copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        // Final fallback: download
        handleDownload();
      }
    }
  };
  
  // Close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textPosition) {
        if (e.key === 'Escape') {
          setTextPosition(null);
        } else if (e.key === 'Enter' && !e.shiftKey) {
          handleAddText();
        }
        return;
      }
      
      if (e.key === 'Escape') {
        handleClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [textPosition, historyIndex, history]);
  
  // Tool button component
  const ToolButton: React.FC<{
    icon: React.ElementType;
    isActive: boolean;
    onClick: () => void;
    title: string;
  }> = ({ icon: Icon, isActive, onClick, title }) => (
    <button
      onClick={onClick}
      className={`
        p-2.5 rounded-lg transition-all
        ${isActive 
          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}
      `}
      title={title}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
  
  return (
    <div 
      className={`
        fixed inset-0 z-[110] flex flex-col bg-gray-900/98 backdrop-blur-md
        transition-opacity duration-200
        ${isClosing ? 'opacity-0' : 'opacity-100'}
      `}
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between p-3 bg-black/50 border-b border-white/10">
        {/* Left: Drawing tools */}
        <div className="flex items-center gap-2">
          <ToolButton
            icon={MousePointer}
            isActive={tool === 'select'}
            onClick={() => setTool('select')}
            title="Select (V)"
          />
          <div className="w-px h-6 bg-white/20" />
          <ToolButton
            icon={Pencil}
            isActive={tool === 'pen'}
            onClick={() => setTool('pen')}
            title="Pen (P)"
          />
          <ToolButton
            icon={Highlighter}
            isActive={tool === 'highlighter'}
            onClick={() => setTool('highlighter')}
            title="Highlighter (H)"
          />
          <div className="w-px h-6 bg-white/20" />
          <ToolButton
            icon={Square}
            isActive={tool === 'rectangle'}
            onClick={() => setTool('rectangle')}
            title="Rectangle (R)"
          />
          <ToolButton
            icon={Circle}
            isActive={tool === 'circle'}
            onClick={() => setTool('circle')}
            title="Circle (C)"
          />
          <ToolButton
            icon={Minus}
            isActive={tool === 'line'}
            onClick={() => setTool('line')}
            title="Line (L)"
          />
          <ToolButton
            icon={ArrowRight}
            isActive={tool === 'arrow'}
            onClick={() => setTool('arrow')}
            title="Arrow (A)"
          />
          <ToolButton
            icon={Type}
            isActive={tool === 'text'}
            onClick={() => setTool('text')}
            title="Text (T)"
          />
        </div>
        
        {/* Center: Color and size */}
        <div className="flex items-center gap-4">
          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            >
              <div 
                className="w-5 h-5 rounded-full border-2 border-white/30"
                style={{ backgroundColor: color }}
              />
              <Palette className="w-4 h-4 text-white/70" />
            </button>
            
            {showColorPicker && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 p-3 bg-gray-800 rounded-xl border border-white/10 shadow-xl z-10">
                <div className="grid grid-cols-5 gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => { setColor(c); setShowColorPicker(false); }}
                      className={`
                        w-8 h-8 rounded-full border-2 transition-transform hover:scale-110
                        ${color === c ? 'border-white scale-110' : 'border-transparent'}
                      `}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Stroke width */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Size:</span>
            <select
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-purple-500"
            >
              {BRUSH_SIZES.map(size => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>
          
          {/* Font size (for text tool) */}
          {tool === 'text' && (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">Font:</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-purple-500"
              >
                {FONT_SIZES.map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className={`
              p-2.5 rounded-lg transition-all
              ${historyIndex <= 0 
                ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}
            `}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className={`
              p-2.5 rounded-lg transition-all
              ${historyIndex >= history.length - 1 
                ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}
            `}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleClear}
            className="p-2.5 rounded-lg bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-400 transition-all"
            title="Clear all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-white/20" />
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
            title="Download"
          >
            <Download className="w-5 h-5" />
            <span className="text-sm font-medium">Download</span>
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
              title="Save (Ctrl+S)"
            >
              {showSaveSuccess ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              <span className="text-sm font-medium">{showSaveSuccess ? 'Saved!' : 'Save'}</span>
            </button>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-sm font-medium">Share</span>
          </button>
          <button
            onClick={handleClose}
            className="p-2.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all ml-2"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 overflow-auto"
      >
        {imageLoaded ? (
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className={`
                rounded-lg shadow-2xl
                ${tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}
              `}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            
            {/* Text input overlay */}
            {textPosition && (
              <div
                className="absolute"
                style={{
                  left: textPosition.x * (canvasRef.current?.getBoundingClientRect().width || 1) / canvasSize.width,
                  top: textPosition.y * (canvasRef.current?.getBoundingClientRect().height || 1) / canvasSize.height}}
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddText();
                    if (e.key === 'Escape') setTextPosition(null);
                  }}
                  placeholder="Type text..."
                  autoFocus
                  className="px-2 py-1 bg-white text-black rounded border-2 border-purple-500 outline-none min-w-[150px]"
                  style={{ fontSize: `${fontSize * 0.6}px` }}
                />
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={handleAddText}
                    className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setTextPosition(null)}
                    className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
          </div>
        )}
      </div>
      
      {/* Bottom hint bar */}
      <div className="p-2 bg-black/50 border-t border-white/10 text-center text-white/50 text-sm">
        <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">Ctrl+Z</kbd> Undo • 
        <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 ml-1">Ctrl+Shift+Z</kbd> Redo • 
        <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 ml-1">Ctrl+S</kbd> Save • 
        <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70 ml-1">Esc</kbd> Close
      </div>
    </div>
  );
};

export default ScreenshotAnnotator;
