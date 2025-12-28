/**
 * SceneBuilder Component
 * 
 * Multi-step scene creation with intelligent positioning and progress tracking.
 * Enables complex scene creation from natural language prompts like:
 * "Create a living room with a sofa, coffee table, and two lamps"
 * 
 * Features:
 * - Natural language prompt input
 * - AI-powered scene parsing
 * - Visual preview of planned objects
 * - Step-by-step progress tracking
 * - Real-time build status updates
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wand2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sofa,
  Lamp,
  Table,
  Tv,
  Bed,
  BookOpen,
  Armchair,
  Flower2,
  Monitor,
  Coffee,
  X,
  Sparkles,
  Layout,
  Eye,
  EyeOff,
  Maximize2,
  Grid3X3
} from 'lucide-react';

// Types
interface SceneObject {
  id: string;
  name: string;
  type: string;
  asset_path: string;
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number; roll: number };
  scale: { x: number; y: number; z: number };
}

interface BuildStep {
  id: string;
  order: number;
  action: string;
  object_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  error?: string;
  started_at?: string;
  completed_at?: string;
}

interface ScenePlan {
  id: string;
  prompt: string;
  room_type: string;
  description: string;
  status: 'pending' | 'parsing' | 'planning' | 'building' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step: number;
  total_steps: number;
  objects: SceneObject[];
  steps: BuildStep[];
  created_at: string;
  completed_at?: string;
  error?: string;
}

interface SceneBuilderProps {
  authToken: string;
  isConnected: boolean;
  onSceneBuilt?: (plan: ScenePlan) => void;
}

// Preset scene templates
const SCENE_TEMPLATES = [
  {
    name: "Cozy Living Room",
    prompt: "Create a living room with a sofa, coffee table, two lamps, and a TV",
    icon: Sofa,
    color: "from-orange-500 to-red-500"
  },
  {
    name: "Modern Bedroom",
    prompt: "Create a bedroom with a bed, two nightstands with lamps, and a dresser",
    icon: Bed,
    color: "from-blue-500 to-purple-500"
  },
  {
    name: "Home Office",
    prompt: "Create an office with a desk, office chair, bookshelf, and a plant",
    icon: Monitor,
    color: "from-green-500 to-teal-500"
  },
  {
    name: "Dining Area",
    prompt: "Create a dining room with a dining table and four chairs",
    icon: Coffee,
    color: "from-amber-500 to-orange-500"
  },
  {
    name: "Reading Nook",
    prompt: "Create a reading corner with an armchair, floor lamp, bookshelf, and a small table",
    icon: BookOpen,
    color: "from-purple-500 to-pink-500"
  },
  {
    name: "Entertainment Setup",
    prompt: "Create an entertainment area with a TV, sofa, two armchairs, and a coffee table",
    icon: Tv,
    color: "from-cyan-500 to-blue-500"
  }
];

// Object type icons
const OBJECT_ICONS: Record<string, React.ElementType> = {
  sofa: Sofa,
  armchair: Armchair,
  lamp: Lamp,
  coffee_table: Table,
  dining_table: Table,
  tv: Tv,
  bed: Bed,
  bookshelf: BookOpen,
  plant: Flower2,
  desk: Table,
  default: Grid3X3
};

// Status colors
const STATUS_COLORS = {
  pending: 'bg-gray-500/20 text-gray-400',
  parsing: 'bg-blue-500/20 text-blue-400',
  planning: 'bg-purple-500/20 text-purple-400',
  building: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  skipped: 'bg-gray-500/20 text-gray-400'
};

// Step status icons
const StepStatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'in_progress':
      return <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />;
    case 'skipped':
      return <XCircle className="w-5 h-5 text-gray-400" />;
    default:
      return <Clock className="w-5 h-5 text-gray-500" />;
  }
};

// Scene Preview Component (2D top-down view)
const ScenePreview: React.FC<{ objects: SceneObject[]; roomType: string }> = ({ objects, roomType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw room outline
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    
    // Draw grid
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 0.5;
    for (let x = 40; x < width - 20; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, height - 20);
      ctx.stroke();
    }
    for (let y = 40; y < height - 20; y += 40) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }
    
    // Calculate scale to fit objects
    const padding = 60;
    const viewWidth = width - padding * 2;
    const viewHeight = height - padding * 2;
    
    // Find bounds of all objects
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    objects.forEach(obj => {
      minX = Math.min(minX, obj.position.x);
      maxX = Math.max(maxX, obj.position.x);
      minY = Math.min(minY, obj.position.y);
      maxY = Math.max(maxY, obj.position.y);
    });
    
    const rangeX = maxX - minX || 400;
    const rangeY = maxY - minY || 400;
    const scale = Math.min(viewWidth / rangeX, viewHeight / rangeY) * 0.8;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const offsetX = (minX + maxX) / 2;
    const offsetY = (minY + maxY) / 2;
    
    // Draw objects
    objects.forEach((obj, index) => {
      const x = centerX + (obj.position.x - offsetX) * scale / 100;
      const y = centerY - (obj.position.y - offsetY) * scale / 100;
      
      // Object colors based on type
      const colors: Record<string, string> = {
        furniture: '#8b5cf6',
        lighting: '#fbbf24',
        electronics: '#3b82f6',
        decoration: '#10b981',
        default: '#6b7280'
      };
      
      const color = colors[obj.type] || colors.default;
      
      // Draw object representation
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      
      // Size based on object type
      let size = 20;
      if (obj.name.toLowerCase().includes('sofa') || obj.name.toLowerCase().includes('bed')) {
        size = 35;
      } else if (obj.name.toLowerCase().includes('table')) {
        size = 25;
      } else if (obj.name.toLowerCase().includes('lamp') || obj.name.toLowerCase().includes('plant')) {
        size = 12;
      }
      
      // Draw rounded rectangle
      ctx.beginPath();
      ctx.roundRect(x - size / 2, y - size / 2, size, size, 4);
      ctx.fill();
      
      // Draw rotation indicator
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const angle = (obj.rotation.yaw * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * size / 2, y - Math.sin(angle) * size / 2);
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(obj.name.split(' ')[0], x, y + size / 2 + 12);
    });
    
    // Draw room type label
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(roomType.replace('_', ' ').toUpperCase(), 30, height - 8);
    
  }, [objects, roomType]);
  
  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={200}
      className="rounded-lg border border-white/10"
    />
  );
};

// Main SceneBuilder Component
export const SceneBuilder: React.FC<SceneBuilderProps> = ({
  authToken,
  isConnected,
  onSceneBuilt
}) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [showTemplates, setShowTemplates] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<ScenePlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showSteps, setShowSteps] = useState(true);
  
  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  // Parse and plan scene
  const handlePlanScene = async () => {
    if (!prompt.trim() || !isConnected) return;
    
    setIsLoading(true);
    setError(null);
    setCurrentPlan(null);
    
    try {
      const response = await fetch('/api/scene-builder/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ prompt: prompt.trim() })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create scene plan');
      }
      
      const plan = await response.json();
      setCurrentPlan(plan);
      setShowTemplates(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to plan scene');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Execute the build plan
  const handleBuildScene = async () => {
    if (!currentPlan || currentPlan.status === 'building') return;
    
    setError(null);
    
    // Update plan status locally
    setCurrentPlan(prev => prev ? { ...prev, status: 'building', progress: 0 } : null);
    
    // Connect to SSE for progress updates
    const eventSource = new EventSource(
      `/api/scene-builder/build/${currentPlan.id}?token=${authToken}`
    );
    eventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setCurrentPlan(prev => {
            if (!prev) return null;
            
            // Update step status
            const updatedSteps = prev.steps.map(step => {
              if (step.order === data.current_step) {
                return { ...step, status: data.step_status };
              }
              if (step.order < data.current_step) {
                return { ...step, status: 'completed' };
              }
              return step;
            });
            
            return {
              ...prev,
              status: data.status,
              progress: data.progress,
              current_step: data.current_step,
              steps: updatedSteps
            };
          });
        } else if (data.type === 'complete') {
          setCurrentPlan(prev => prev ? {
            ...prev,
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString()
          } : null);
          
          eventSource.close();
          
          if (onSceneBuilt && currentPlan) {
            onSceneBuilt(currentPlan);
          }
        } else if (data.type === 'error') {
          setError(data.message);
          setCurrentPlan(prev => prev ? { ...prev, status: 'failed', error: data.message } : null);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };
    
    eventSource.onerror = () => {
      setError('Connection lost during build');
      eventSource.close();
    };
  };
  
  // Cancel build
  const handleCancelBuild = async () => {
    if (!currentPlan) return;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    try {
      await fetch(`/api/scene-builder/cancel/${currentPlan.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      setCurrentPlan(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err) {
      console.error('Failed to cancel build:', err);
    }
  };
  
  // Reset and start over
  const handleReset = () => {
    setCurrentPlan(null);
    setPrompt('');
    setError(null);
    setShowTemplates(true);
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };
  
  // Select template
  const handleSelectTemplate = (template: typeof SCENE_TEMPLATES[0]) => {
    setPrompt(template.prompt);
    setShowTemplates(false);
    inputRef.current?.focus();
  };
  
  // Get object icon
  const getObjectIcon = (objectName: string): React.ElementType => {
    const name = objectName.toLowerCase();
    for (const [key, Icon] of Object.entries(OBJECT_ICONS)) {
      if (name.includes(key.replace('_', ' '))) {
        return Icon;
      }
    }
    return OBJECT_ICONS.default;
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
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                Scene Builder
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full font-medium">
                  AI-Powered
                </span>
              </h3>
              <p className="text-white/60 text-sm">Create complex scenes with a single prompt</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {currentPlan && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[currentPlan.status]}`}>
                {currentPlan.status.replace('_', ' ').toUpperCase()}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/60" />
            )}
          </div>
        </div>
      </div>
      
      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Connection warning */}
          {!isConnected && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Connect to UE5 via the agent to use Scene Builder
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
          
          {/* Templates */}
          {showTemplates && !currentPlan && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-white/80 text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Quick Templates
                </h4>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-white/40 hover:text-white/60 text-xs"
                >
                  Hide
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SCENE_TEMPLATES.map((template, index) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelectTemplate(template)}
                      disabled={!isConnected}
                      className={`
                        p-3 rounded-xl border border-white/10 text-left transition-all
                        ${isConnected 
                          ? 'hover:border-purple-500/50 hover:bg-white/5 cursor-pointer' 
                          : 'opacity-50 cursor-not-allowed'}
                      `}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center mb-2`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-white text-sm font-medium">{template.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Prompt input */}
          {!currentPlan && (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the scene you want to create... e.g., 'Create a living room with a sofa, coffee table, and two lamps'"
                  disabled={!isConnected || isLoading}
                  className={`
                    w-full p-4 pr-24 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40
                    focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20
                    resize-none transition-all min-h-[100px]
                    ${(!isConnected || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePlanScene();
                    }
                  }}
                />
                
                <button
                  onClick={handlePlanScene}
                  disabled={!prompt.trim() || !isConnected || isLoading}
                  className={`
                    absolute bottom-3 right-3 px-4 py-2 rounded-lg font-medium text-sm
                    flex items-center gap-2 transition-all
                    ${(!prompt.trim() || !isConnected || isLoading)
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30'}
                  `}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Planning...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Plan Scene
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
            </div>
          )}
          
          {/* Plan preview */}
          {currentPlan && (
            <div className="space-y-4">
              {/* Plan header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/60 text-sm mb-1">Scene Plan</p>
                  <h4 className="text-white font-medium">{currentPlan.description || currentPlan.prompt}</h4>
                  <p className="text-white/40 text-sm mt-1">
                    {currentPlan.objects.length} objects • {currentPlan.room_type.replace('_', ' ')}
                  </p>
                </div>
                
                <button
                  onClick={handleReset}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                  title="Start over"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              
              {/* Progress bar */}
              {currentPlan.status === 'building' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Building scene...</span>
                    <span className="text-white font-medium">{Math.round(currentPlan.progress)}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                      style={{ width: `${currentPlan.progress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Preview and steps */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Scene preview */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                  
                  {showPreview && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white/60 text-xs flex items-center gap-1">
                          <Layout className="w-3 h-3" />
                          Top-Down View
                        </span>
                      </div>
                      <ScenePreview 
                        objects={currentPlan.objects} 
                        roomType={currentPlan.room_type}
                      />
                    </div>
                  )}
                </div>
                
                {/* Build steps */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowSteps(!showSteps)}
                    className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {showSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Build Steps ({currentPlan.steps.length})
                  </button>
                  
                  {showSteps && (
                    <div className="bg-white/5 rounded-xl border border-white/10 max-h-[250px] overflow-y-auto">
                      {currentPlan.steps.map((step, index) => {
                        const Icon = getObjectIcon(step.object_name);
                        return (
                          <div
                            key={step.id}
                            className={`
                              flex items-center gap-3 p-3 border-b border-white/5 last:border-0
                              ${step.status === 'in_progress' ? 'bg-amber-500/10' : ''}
                              ${step.status === 'completed' ? 'bg-green-500/5' : ''}
                              ${step.status === 'failed' ? 'bg-red-500/10' : ''}
                            `}
                          >
                            <div className="flex-shrink-0">
                              <StepStatusIcon status={step.status} />
                            </div>
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                              <Icon className="w-4 h-4 text-white/60" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">
                                {step.object_name}
                              </p>
                              <p className="text-white/40 text-xs">
                                Step {step.order} • {step.action}
                              </p>
                            </div>
                            {step.error && (
                              <span className="text-red-400 text-xs truncate max-w-[100px]" title={step.error}>
                                {step.error}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Objects list */}
              <div className="space-y-2">
                <h5 className="text-white/60 text-sm font-medium">Objects to Create</h5>
                <div className="flex flex-wrap gap-2">
                  {currentPlan.objects.map((obj) => {
                    const Icon = getObjectIcon(obj.name);
                    const step = currentPlan.steps.find(s => s.object_name === obj.name);
                    const isCompleted = step?.status === 'completed';
                    const isFailed = step?.status === 'failed';
                    const isInProgress = step?.status === 'in_progress';
                    
                    return (
                      <div
                        key={obj.id}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                          ${isCompleted ? 'bg-green-500/10 border-green-500/30 text-green-400' : ''}
                          ${isFailed ? 'bg-red-500/10 border-red-500/30 text-red-400' : ''}
                          ${isInProgress ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : ''}
                          ${!isCompleted && !isFailed && !isInProgress ? 'bg-white/5 border-white/10 text-white/70' : ''}
                        `}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{obj.name}</span>
                        {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                        {isFailed && <XCircle className="w-3 h-3" />}
                        {isInProgress && <Loader2 className="w-3 h-3 animate-spin" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                {currentPlan.status === 'planning' && (
                  <button
                    onClick={handleBuildScene}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                  >
                    <Play className="w-5 h-5" />
                    Build Scene
                  </button>
                )}
                
                {currentPlan.status === 'building' && (
                  <button
                    onClick={handleCancelBuild}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-all"
                  >
                    <Pause className="w-5 h-5" />
                    Cancel Build
                  </button>
                )}
                
                {(currentPlan.status === 'completed' || currentPlan.status === 'failed' || currentPlan.status === 'cancelled') && (
                  <>
                    <button
                      onClick={handleReset}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
                    >
                      <RotateCcw className="w-5 h-5" />
                      New Scene
                    </button>
                    
                    {currentPlan.status !== 'completed' && (
                      <button
                        onClick={handleBuildScene}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                      >
                        <Play className="w-5 h-5" />
                        Retry Build
                      </button>
                    )}
                  </>
                )}
              </div>
              
              {/* Completion message */}
              {currentPlan.status === 'completed' && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Scene built successfully!</p>
                    <p className="text-sm text-green-400/70">
                      {currentPlan.objects.length} objects created in your UE5 scene
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SceneBuilder;
