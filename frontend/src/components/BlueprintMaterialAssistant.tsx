/**
 * BlueprintMaterialAssistant Component
 * 
 * AI-assisted Blueprint and Material creation with visual node preview.
 * Features:
 * - Natural language input for creating materials and blueprints
 * - Visual node graph preview
 * - Template suggestions
 * - One-click apply to actors
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Palette,
  Code,
  Wand2,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Sparkles,
  Box,
  Zap,
  Eye,
  EyeOff,
  Download,
  Copy,
  RefreshCw,
  ArrowRight,
  Circle,
  Square,
  Triangle,
  Hexagon,
  GitBranch,
  Clock,
  Move,
  RotateCw,
  Lightbulb,
  Layers
} from 'lucide-react';

// Types
interface NodePosition {
  x: number;
  y: number;
}

interface VisualNode {
  id: string;
  type: string;
  name: string;
  position: NodePosition;
  properties: Record<string, any>;
  inputs: string[];
  outputs: string[];
}

interface NodeConnection {
  from_node: string;
  from_pin: string;
  to_node: string;
  to_pin: string;
}

interface VisualGraph {
  id: string;
  asset_type: 'material' | 'blueprint';
  name: string;
  description: string;
  nodes: VisualNode[];
  connections: NodeConnection[];
  created_at: string;
}

interface MCPCommand {
  tool: string;
  params: Record<string, any>;
  description: string;
}

interface GeneratedAsset {
  parsed_request: {
    asset_type: string;
    name: string;
    description: string;
    features: string[];
    parameters: Record<string, any>;
    template_match: string | null;
  };
  graph: VisualGraph;
  mcp_commands: MCPCommand[];
  template_used: string | null;
}

interface Template {
  name: string;
  description: string;
  prompt_example: string;
  tags: string[];
}

interface BlueprintMaterialAssistantProps {
  authToken: string;
  isConnected: boolean;
  selectedActor?: string;
  onAssetCreated?: (asset: GeneratedAsset) => void;
}

// Node type colors
const NODE_COLORS: Record<string, string> = {
  // Material nodes
  material_output: '#e74c3c',
  texture_sample: '#9b59b6',
  scalar_parameter: '#3498db',
  vector_parameter: '#2ecc71',
  multiply: '#f39c12',
  add: '#f39c12',
  lerp: '#1abc9c',
  fresnel: '#e91e63',
  world_position: '#00bcd4',
  object_position: '#00bcd4',
  time: '#ff9800',
  sine: '#ff5722',
  cosine: '#ff5722',
  constant: '#607d8b',
  
  // Blueprint nodes
  event_begin_play: '#e74c3c',
  event_tick: '#e74c3c',
  event_overlap: '#e74c3c',
  add_rotation: '#3498db',
  set_rotation: '#3498db',
  add_location: '#2ecc71',
  set_location: '#2ecc71',
  branch: '#f39c12',
  sequence: '#9b59b6',
  delay: '#ff9800',
  print_string: '#607d8b',
  
  default: '#95a5a6'
};

// Node type icons
const NODE_ICONS: Record<string, React.ElementType> = {
  material_output: Square,
  texture_sample: Layers,
  scalar_parameter: Circle,
  vector_parameter: Hexagon,
  multiply: X,
  add: Zap,
  lerp: GitBranch,
  fresnel: Lightbulb,
  time: Clock,
  event_begin_play: Play,
  event_tick: RefreshCw,
  add_rotation: RotateCw,
  set_rotation: RotateCw,
  add_location: Move,
  set_location: Move,
  branch: GitBranch,
  default: Box
};

// Visual Node Graph Preview Component
const NodeGraphPreview: React.FC<{
  graph: VisualGraph;
  width?: number;
  height?: number;
}> = ({ graph, width = 600, height = 400 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Calculate node positions for rendering
  const getNodeBounds = useCallback(() => {
    if (graph.nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    graph.nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + 180);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + 80);
    });
    
    return { minX, maxX, minY, maxY };
  }, [graph.nodes]);
  
  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 0.5;
    const gridSize = 20 * scale;
    
    for (let x = offset.x % gridSize; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = offset.y % gridSize; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Calculate centering offset
    const bounds = getNodeBounds();
    const graphWidth = bounds.maxX - bounds.minX;
    const graphHeight = bounds.maxY - bounds.minY;
    const centerOffsetX = (width - graphWidth * scale) / 2 - bounds.minX * scale + offset.x;
    const centerOffsetY = (height - graphHeight * scale) / 2 - bounds.minY * scale + offset.y;
    
    // Draw connections first (behind nodes)
    ctx.lineWidth = 2 * scale;
    graph.connections.forEach(conn => {
      const fromNode = graph.nodes.find(n => n.id === conn.from_node);
      const toNode = graph.nodes.find(n => n.id === conn.to_node);
      
      if (fromNode && toNode) {
        const nodeWidth = 180 * scale;
        const nodeHeight = 60 * scale;
        const pinHeight = 15 * scale;
        
        // Calculate pin positions
        const fromPinIndex = fromNode.outputs.indexOf(conn.from_pin);
        const toPinIndex = toNode.inputs.indexOf(conn.to_pin);
        
        const fromX = (fromNode.position.x + 180) * scale + centerOffsetX;
        const fromY = (fromNode.position.y + 30 + fromPinIndex * 20) * scale + centerOffsetY;
        const toX = toNode.position.x * scale + centerOffsetX;
        const toY = (toNode.position.y + 30 + toPinIndex * 20) * scale + centerOffsetY;
        
        // Draw bezier curve
        const controlOffset = Math.abs(toX - fromX) * 0.5;
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(
          fromX + controlOffset, fromY,
          toX - controlOffset, toY,
          toX, toY
        );
        
        // Gradient for connection
        const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
        gradient.addColorStop(0, NODE_COLORS[fromNode.type] || NODE_COLORS.default);
        gradient.addColorStop(1, NODE_COLORS[toNode.type] || NODE_COLORS.default);
        ctx.strokeStyle = gradient;
        ctx.stroke();
      }
    });
    
    // Draw nodes
    graph.nodes.forEach(node => {
      const x = node.position.x * scale + centerOffsetX;
      const y = node.position.y * scale + centerOffsetY;
      const nodeWidth = 180 * scale;
      const nodeHeight = Math.max(60, 30 + Math.max(node.inputs.length, node.outputs.length) * 20) * scale;
      
      const color = NODE_COLORS[node.type] || NODE_COLORS.default;
      
      // Node shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Node background
      ctx.fillStyle = '#2d2d44';
      ctx.beginPath();
      ctx.roundRect(x, y, nodeWidth, nodeHeight, 8 * scale);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Node header
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, nodeWidth, 24 * scale, [8 * scale, 8 * scale, 0, 0]);
      ctx.fill();
      
      // Node border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.roundRect(x, y, nodeWidth, nodeHeight, 8 * scale);
      ctx.stroke();
      
      // Node title
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${12 * scale}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(node.name, x + 10 * scale, y + 16 * scale);
      
      // Draw input pins
      ctx.font = `${10 * scale}px Inter, sans-serif`;
      node.inputs.forEach((pin, index) => {
        const pinY = y + (30 + index * 20) * scale;
        
        // Pin circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, pinY, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Pin label
        ctx.fillStyle = '#aaaaaa';
        ctx.textAlign = 'left';
        ctx.fillText(pin, x + 10 * scale, pinY + 4 * scale);
      });
      
      // Draw output pins
      node.outputs.forEach((pin, index) => {
        const pinY = y + (30 + index * 20) * scale;
        
        // Pin circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + nodeWidth, pinY, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Pin label
        ctx.fillStyle = '#aaaaaa';
        ctx.textAlign = 'right';
        ctx.fillText(pin, x + nodeWidth - 10 * scale, pinY + 4 * scale);
      });
    });
    
    // Draw asset type badge
    ctx.fillStyle = graph.asset_type === 'material' ? '#9b59b6' : '#3498db';
    ctx.beginPath();
    ctx.roundRect(10, 10, 80, 24, 4);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(graph.asset_type.toUpperCase(), 50, 26);
    
  }, [graph, width, height, scale, offset, getNodeBounds]);
  
  // Handle mouse events for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.3, Math.min(2, s * delta)));
  };
  
  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 rounded-lg p-1">
        <button
          onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
          className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white"
        >
          -
        </button>
        <span className="text-white/60 text-sm min-w-[3rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.min(2, s + 0.1))}
          className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white"
        >
          +
        </button>
        <button
          onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white"
          title="Reset view"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
      
      {/* Node count */}
      <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 rounded text-white/60 text-xs">
        {graph.nodes.length} nodes • {graph.connections.length} connections
      </div>
    </div>
  );
};

// Template Card Component
const TemplateCard: React.FC<{
  template: Template;
  type: 'material' | 'blueprint';
  onSelect: () => void;
}> = ({ template, type, onSelect }) => {
  const Icon = type === 'material' ? Palette : Code;
  const color = type === 'material' ? 'from-purple-500 to-pink-500' : 'from-blue-500 to-cyan-500';
  
  return (
    <button
      onClick={onSelect}
      className="p-3 rounded-xl border border-white/10 text-left hover:border-purple-500/50 hover:bg-white/5 transition-all group"
    >
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-white text-sm font-medium">{template.name}</p>
      <p className="text-white/40 text-xs mt-1 line-clamp-2">{template.description}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {template.tags.slice(0, 3).map((tag, i) => (
          <span key={i} className="px-1.5 py-0.5 bg-white/5 rounded text-white/40 text-xs">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
};

// Main Component
export const BlueprintMaterialAssistant: React.FC<BlueprintMaterialAssistantProps> = ({
  authToken,
  isConnected,
  selectedActor,
  onAssetCreated
}) => {
  // State
  const [isExpanded, setIsExpanded] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [assetType, setAssetType] = useState<'material' | 'blueprint'>('material');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedAsset | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showTemplates, setShowTemplates] = useState(true);
  const [templates, setTemplates] = useState<{ material: Record<string, Template>; blueprint: Record<string, Template> }>({
    material: {},
    blueprint: {}
  });
  
  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/blueprint-material/templates', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setTemplates(data);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    
    loadTemplates();
  }, [authToken]);
  
  // Generate asset
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setGeneratedAsset(null);
    
    try {
      const response = await fetch('/api/blueprint-material/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          actor_name: selectedActor
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate asset');
      }
      
      const asset = await response.json();
      setGeneratedAsset(asset);
      setShowTemplates(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate asset');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Apply asset to UE5
  const handleApply = async () => {
    if (!generatedAsset || !isConnected) return;
    
    setIsApplying(true);
    setError(null);
    
    try {
      const response = await fetch('/api/blueprint-material/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          graph_id: generatedAsset.graph.id,
          actor_name: selectedActor
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to apply asset');
      }
      
      if (onAssetCreated) {
        onAssetCreated(generatedAsset);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply asset');
    } finally {
      setIsApplying(false);
    }
  };
  
  // Select template
  const handleSelectTemplate = (template: Template) => {
    setPrompt(template.prompt_example);
    setShowTemplates(false);
    inputRef.current?.focus();
  };
  
  // Reset
  const handleReset = () => {
    setGeneratedAsset(null);
    setPrompt('');
    setShowTemplates(true);
    setError(null);
  };
  
  // Copy graph JSON
  const handleCopyGraph = () => {
    if (generatedAsset) {
      navigator.clipboard.writeText(JSON.stringify(generatedAsset.graph, null, 2));
    }
  };
  
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl shadow-lg shadow-purple-500/20">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                Blueprint & Material Assistant
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full font-medium">
                  AI-Powered
                </span>
              </h3>
              <p className="text-white/60 text-sm">Create materials and blueprints with natural language</p>
            </div>
          </div>
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-white/60" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/60" />
          )}
        </div>
      </div>
      
      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Connection warning */}
          {!isConnected && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Connect to UE5 to apply generated assets
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </span>
              <button onClick={() => setError(null)} className="hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Asset type selector */}
          {!generatedAsset && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAssetType('material')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  assetType === 'material'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <Palette className="w-5 h-5" />
                Material
              </button>
              <button
                onClick={() => setAssetType('blueprint')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  assetType === 'blueprint'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <Code className="w-5 h-5" />
                Blueprint
              </button>
            </div>
          )}
          
          {/* Templates */}
          {showTemplates && !generatedAsset && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-white/80 text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  {assetType === 'material' ? 'Material' : 'Blueprint'} Templates
                </h4>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-white/40 hover:text-white/60 text-xs"
                >
                  Hide
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(templates[assetType] || {}).map(([key, template]) => (
                  <TemplateCard
                    key={key}
                    template={template}
                    type={assetType}
                    onSelect={() => handleSelectTemplate(template)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Prompt input */}
          {!generatedAsset && (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={assetType === 'material' 
                    ? "Describe the material... e.g., 'Create a material that glows blue when the player is near'"
                    : "Describe the behavior... e.g., 'Add a Blueprint that rotates this actor continuously'"
                  }
                  disabled={isGenerating}
                  className={`
                    w-full p-4 pr-24 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40
                    focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20
                    resize-none transition-all min-h-[100px]
                    ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className={`
                    absolute bottom-3 right-3 px-4 py-2 rounded-lg font-medium text-sm
                    flex items-center gap-2 transition-all
                    ${(!prompt.trim() || isGenerating)
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : assetType === 'material'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/30'
                    }
                  `}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
              
              {!showTemplates && (
                <button
                  onClick={() => setShowTemplates(true)}
                  className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Show templates
                </button>
              )}
              
              {selectedActor && (
                <p className="text-white/40 text-sm flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Will be applied to: <span className="text-purple-400">{selectedActor}</span>
                </p>
              )}
            </div>
          )}
          
          {/* Generated asset preview */}
          {generatedAsset && (
            <div className="space-y-4">
              {/* Asset info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {generatedAsset.graph.asset_type === 'material' ? (
                      <Palette className="w-5 h-5 text-purple-400" />
                    ) : (
                      <Code className="w-5 h-5 text-blue-400" />
                    )}
                    <h4 className="text-white font-medium">{generatedAsset.graph.name}</h4>
                    {generatedAsset.template_used && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                        {generatedAsset.template_used}
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm mt-1">{generatedAsset.graph.description}</p>
                </div>
                
                <button
                  onClick={handleReset}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                  title="Start over"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              {/* Preview toggle */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Hide' : 'Show'} Node Preview
                </button>
                
                <button
                  onClick={handleCopyGraph}
                  className="flex items-center gap-1 text-white/40 hover:text-white text-sm transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Copy JSON
                </button>
              </div>
              
              {/* Node graph preview */}
              {showPreview && (
                <NodeGraphPreview graph={generatedAsset.graph} />
              )}
              
              {/* Features */}
              {generatedAsset.parsed_request.features.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-white/60 text-sm font-medium">Features</h5>
                  <div className="flex flex-wrap gap-2">
                    {generatedAsset.parsed_request.features.map((feature, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-white/5 rounded-lg text-white/70 text-sm flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* MCP Commands preview */}
              <div className="space-y-2">
                <h5 className="text-white/60 text-sm font-medium">Commands to Execute</h5>
                <div className="space-y-1">
                  {generatedAsset.mcp_commands.map((cmd, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 bg-white/5 rounded-lg text-sm"
                    >
                      <span className="text-white/40">{i + 1}.</span>
                      <span className="text-purple-400 font-mono">{cmd.tool}</span>
                      <ArrowRight className="w-3 h-3 text-white/20" />
                      <span className="text-white/60">{cmd.description}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  Generate New
                </button>
                
                <button
                  onClick={handleApply}
                  disabled={!isConnected || isApplying}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all
                    ${(!isConnected || isApplying)
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : generatedAsset.graph.asset_type === 'material'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/30'
                    }
                  `}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Apply to UE5
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BlueprintMaterialAssistant;
