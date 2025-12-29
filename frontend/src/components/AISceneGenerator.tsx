/**
 * AI Scene Generator Component
 * ============================
 * 
 * Generate entire scenes from natural language descriptions.
 * Uses AI to plan and spawn multiple actors automatically in UE5.
 * 
 * Features:
 * - Text-to-scene generation
 * - Scene templates and presets
 * - Visual scene planning preview
 * - Step-by-step generation progress
 * - Actor placement visualization
 * - Style and mood customization
 */

import React, { useState, useCallback } from 'react';
import {
  Wand2,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  Layers,
  Box,
  Sun,
  Camera,
  TreePine,
  Building2,
  Sofa,
  Car,
  Sword,
  Rocket,
  Castle,
  Home,
  Mountain,
  Waves,
  Flame,
  Snowflake,
  CloudSun,
  Moon,
  Zap,
  Volume2,
  Mic,
  Settings,
  Save,
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Download,
  Share2,
  History,
  Lightbulb,
  Palette,
  Grid3X3,
  Move,
  RotateCw,
  Maximize2,
} from 'lucide-react';

// ==================== TYPES ====================

interface SceneObject {
  id: string;
  type: 'mesh' | 'light' | 'camera' | 'effect' | 'audio';
  name: string;
  assetPath: string;
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number; roll: number };
  scale: { x: number; y: number; z: number };
  properties: Record<string, unknown>;
  status: 'pending' | 'spawning' | 'spawned' | 'error';
}

interface ScenePlan {
  id: string;
  name: string;
  description: string;
  style: string;
  mood: string;
  timeOfDay: string;
  weather: string;
  objects: SceneObject[];
  lighting: {
    preset: string;
    intensity: number;
    color: string;
  };
  postProcess: {
    enabled: boolean;
    preset: string;
  };
  estimatedTime: number;
  totalObjects: number;
}

interface GenerationStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  objectsSpawned: number;
  totalObjects: number;
}

interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  prompt: string;
  thumbnail?: string;
  tags: string[];
}

type GenerationStatus = 'idle' | 'planning' | 'previewing' | 'generating' | 'completed' | 'error';

// ==================== CONSTANTS ====================

const SCENE_TEMPLATES: SceneTemplate[] = [
  // Environment
  {
    id: 'medieval-castle',
    name: 'Medieval Castle Courtyard',
    description: 'A grand castle courtyard with stone walls, towers, and medieval decorations',
    icon: <Castle className="w-5 h-5" />,
    category: 'environment',
    prompt: 'Create a medieval castle courtyard with stone walls, a central fountain, guard towers, wooden crates, barrels, torches on the walls, a drawbridge entrance, and cobblestone floor',
    tags: ['medieval', 'castle', 'fantasy'],
  },
  {
    id: 'scifi-spaceship',
    name: 'Sci-Fi Spaceship Interior',
    description: 'Futuristic spaceship interior with control panels and holographic displays',
    icon: <Rocket className="w-5 h-5" />,
    category: 'environment',
    prompt: 'Create a sci-fi spaceship interior with a central command bridge, holographic displays, control panels, captain chair, crew stations, glowing floor panels, and large viewport windows showing space',
    tags: ['scifi', 'spaceship', 'futuristic'],
  },
  {
    id: 'forest-clearing',
    name: 'Enchanted Forest Clearing',
    description: 'A magical forest clearing with ancient trees and mystical elements',
    icon: <TreePine className="w-5 h-5" />,
    category: 'environment',
    prompt: 'Create an enchanted forest clearing with giant ancient trees, glowing mushrooms, a small stream, moss-covered rocks, fireflies, fallen logs, and mystical fog',
    tags: ['forest', 'nature', 'fantasy'],
  },
  {
    id: 'modern-office',
    name: 'Modern Office Space',
    description: 'Contemporary open-plan office with workstations and meeting areas',
    icon: <Building2 className="w-5 h-5" />,
    category: 'interior',
    prompt: 'Create a modern open-plan office with multiple workstations, ergonomic chairs, large monitors, a glass-walled meeting room, lounge area with sofas, indoor plants, and large windows',
    tags: ['modern', 'office', 'interior'],
  },
  {
    id: 'cozy-cabin',
    name: 'Cozy Mountain Cabin',
    description: 'Warm and inviting cabin interior with rustic decorations',
    icon: <Home className="w-5 h-5" />,
    category: 'interior',
    prompt: 'Create a cozy mountain cabin interior with a stone fireplace, wooden beams, comfortable sofas, fur rugs, bookshelves, antler decorations, warm lighting, and snow visible through windows',
    tags: ['cabin', 'cozy', 'rustic'],
  },
  {
    id: 'underwater-ruins',
    name: 'Underwater Ancient Ruins',
    description: 'Submerged temple ruins with coral and sea life',
    icon: <Waves className="w-5 h-5" />,
    category: 'environment',
    prompt: 'Create underwater ancient ruins with crumbling stone columns, coral growth, schools of fish, sunken statues, treasure chests, seaweed, caustic light effects, and mysterious glowing artifacts',
    tags: ['underwater', 'ruins', 'ancient'],
  },
  {
    id: 'cyberpunk-alley',
    name: 'Cyberpunk City Alley',
    description: 'Neon-lit urban alley with futuristic elements',
    icon: <Zap className="w-5 h-5" />,
    category: 'environment',
    prompt: 'Create a cyberpunk city alley with neon signs, holographic advertisements, steam vents, dumpsters, graffiti walls, flying drones, rain puddles reflecting lights, and vending machines',
    tags: ['cyberpunk', 'urban', 'neon'],
  },
  {
    id: 'desert-oasis',
    name: 'Desert Oasis',
    description: 'A peaceful oasis in the middle of sand dunes',
    icon: <Sun className="w-5 h-5" />,
    category: 'environment',
    prompt: 'Create a desert oasis with palm trees, a clear blue pond, sand dunes, ancient stone ruins, a small tent camp, camels, pottery, and golden sunset lighting',
    tags: ['desert', 'oasis', 'nature'],
  },
  // Game Levels
  {
    id: 'battle-arena',
    name: 'Battle Arena',
    description: 'Gladiator-style combat arena with spectator stands',
    icon: <Sword className="w-5 h-5" />,
    category: 'game-level',
    prompt: 'Create a gladiator battle arena with sandy floor, stone walls, spectator stands, weapon racks, entrance gates, torches, victory podium, and dramatic overhead lighting',
    tags: ['arena', 'combat', 'game'],
  },
  {
    id: 'racing-track',
    name: 'Racing Track Start',
    description: 'Racing game starting line with grandstands',
    icon: <Car className="w-5 h-5" />,
    category: 'game-level',
    prompt: 'Create a racing track starting line with checkered start/finish line, grandstands with crowds, pit lane entrance, sponsor billboards, timing tower, and race cars on the grid',
    tags: ['racing', 'track', 'game'],
  },
  // Architectural
  {
    id: 'luxury-penthouse',
    name: 'Luxury Penthouse',
    description: 'High-end penthouse apartment with city views',
    icon: <Sofa className="w-5 h-5" />,
    category: 'interior',
    prompt: 'Create a luxury penthouse with floor-to-ceiling windows, modern furniture, marble floors, a grand piano, art pieces, indoor pool area, bar counter, and panoramic city views',
    tags: ['luxury', 'penthouse', 'modern'],
  },
  {
    id: 'volcanic-cave',
    name: 'Volcanic Cave',
    description: 'Dangerous cave with lava flows and crystals',
    icon: <Flame className="w-5 h-5" />,
    category: 'environment',
    prompt: 'Create a volcanic cave with flowing lava rivers, obsidian rock formations, glowing crystals, steam vents, ancient stone bridge, stalactites, and ominous red lighting',
    tags: ['volcanic', 'cave', 'dangerous'],
  },
];

const STYLE_OPTIONS = [
  { id: 'realistic', name: 'Realistic', icon: <Eye className="w-4 h-4" /> },
  { id: 'stylized', name: 'Stylized', icon: <Palette className="w-4 h-4" /> },
  { id: 'low-poly', name: 'Low Poly', icon: <Box className="w-4 h-4" /> },
  { id: 'cartoon', name: 'Cartoon', icon: <Sparkles className="w-4 h-4" /> },
];

const MOOD_OPTIONS = [
  { id: 'peaceful', name: 'Peaceful', color: 'bg-green-500' },
  { id: 'dramatic', name: 'Dramatic', color: 'bg-red-500' },
  { id: 'mysterious', name: 'Mysterious', color: 'bg-purple-500' },
  { id: 'cheerful', name: 'Cheerful', color: 'bg-yellow-500' },
  { id: 'dark', name: 'Dark', color: 'bg-gray-700' },
  { id: 'romantic', name: 'Romantic', color: 'bg-pink-500' },
];

const TIME_OF_DAY_OPTIONS = [
  { id: 'dawn', name: 'Dawn', icon: <CloudSun className="w-4 h-4" />, time: 6 },
  { id: 'morning', name: 'Morning', icon: <Sun className="w-4 h-4" />, time: 9 },
  { id: 'noon', name: 'Noon', icon: <Sun className="w-4 h-4" />, time: 12 },
  { id: 'golden-hour', name: 'Golden Hour', icon: <Sun className="w-4 h-4" />, time: 17 },
  { id: 'dusk', name: 'Dusk', icon: <CloudSun className="w-4 h-4" />, time: 19 },
  { id: 'night', name: 'Night', icon: <Moon className="w-4 h-4" />, time: 22 },
];

const WEATHER_OPTIONS = [
  { id: 'clear', name: 'Clear' },
  { id: 'cloudy', name: 'Cloudy' },
  { id: 'rainy', name: 'Rainy' },
  { id: 'foggy', name: 'Foggy' },
  { id: 'snowy', name: 'Snowy' },
  { id: 'stormy', name: 'Stormy' },
];

const CATEGORY_FILTERS = [
  { id: 'all', name: 'All' },
  { id: 'environment', name: 'Environment' },
  { id: 'interior', name: 'Interior' },
  { id: 'game-level', name: 'Game Level' },
];

// ==================== COMPONENT ====================

interface AISceneGeneratorProps {
  onGenerate?: (plan: ScenePlan) => void;
  onCancel?: () => void;
  className?: string;
}

export const AISceneGenerator: React.FC<AISceneGeneratorProps> = ({
  onGenerate,
  onCancel,
  className = '',
}) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);
  const [style, setStyle] = useState('realistic');
  const [mood, setMood] = useState('peaceful');
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [weather, setWeather] = useState('clear');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [scenePlan, setScenePlan] = useState<ScenePlan | null>(null);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [generationHistory, setGenerationHistory] = useState<ScenePlan[]>([]);

  // Filter templates by category
  const filteredTemplates = SCENE_TEMPLATES.filter(
    (t) => categoryFilter === 'all' || t.category === categoryFilter
  );

  // Handle template selection
  const handleSelectTemplate = useCallback((template: SceneTemplate) => {
    setSelectedTemplate(template);
    setPrompt(template.prompt);
  }, []);

  // Generate scene plan from prompt
  const generateScenePlan = useCallback(async () => {
    if (!prompt.trim()) return;

    setStatus('planning');
    
    // Simulate AI planning (in production, this would call the backend)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate a mock scene plan
    const mockObjects: SceneObject[] = [
      {
        id: '1',
        type: 'mesh',
        name: 'Floor',
        assetPath: '/Game/Meshes/SM_Floor',
        position: { x: 0, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
        scale: { x: 10, y: 10, z: 1 },
        properties: {},
        status: 'pending',
      },
      {
        id: '2',
        type: 'mesh',
        name: 'Wall_North',
        assetPath: '/Game/Meshes/SM_Wall',
        position: { x: 0, y: 500, z: 150 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
        scale: { x: 10, y: 1, z: 3 },
        properties: {},
        status: 'pending',
      },
      {
        id: '3',
        type: 'mesh',
        name: 'Wall_South',
        assetPath: '/Game/Meshes/SM_Wall',
        position: { x: 0, y: -500, z: 150 },
        rotation: { pitch: 0, yaw: 180, roll: 0 },
        scale: { x: 10, y: 1, z: 3 },
        properties: {},
        status: 'pending',
      },
      {
        id: '4',
        type: 'light',
        name: 'MainLight',
        assetPath: '/Engine/Lights/PointLight',
        position: { x: 0, y: 0, z: 400 },
        rotation: { pitch: -45, yaw: 0, roll: 0 },
        scale: { x: 1, y: 1, z: 1 },
        properties: { intensity: 5000, color: '#FFF5E6' },
        status: 'pending',
      },
      {
        id: '5',
        type: 'mesh',
        name: 'Prop_Table',
        assetPath: '/Game/Meshes/SM_Table',
        position: { x: 0, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 45, roll: 0 },
        scale: { x: 1, y: 1, z: 1 },
        properties: {},
        status: 'pending',
      },
      {
        id: '6',
        type: 'mesh',
        name: 'Prop_Chair_1',
        assetPath: '/Game/Meshes/SM_Chair',
        position: { x: 100, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: -90, roll: 0 },
        scale: { x: 1, y: 1, z: 1 },
        properties: {},
        status: 'pending',
      },
      {
        id: '7',
        type: 'mesh',
        name: 'Prop_Chair_2',
        assetPath: '/Game/Meshes/SM_Chair',
        position: { x: -100, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 90, roll: 0 },
        scale: { x: 1, y: 1, z: 1 },
        properties: {},
        status: 'pending',
      },
      {
        id: '8',
        type: 'effect',
        name: 'AmbientParticles',
        assetPath: '/Game/Effects/P_Dust',
        position: { x: 0, y: 0, z: 200 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
        scale: { x: 5, y: 5, z: 5 },
        properties: {},
        status: 'pending',
      },
    ];

    const plan: ScenePlan = {
      id: `scene-${Date.now()}`,
      name: selectedTemplate?.name || 'Custom Scene',
      description: prompt,
      style,
      mood,
      timeOfDay,
      weather,
      objects: mockObjects,
      lighting: {
        preset: mood === 'dramatic' ? 'dramatic' : 'natural',
        intensity: 1.0,
        color: '#FFFFFF',
      },
      postProcess: {
        enabled: true,
        preset: style === 'stylized' ? 'stylized' : 'cinematic',
      },
      estimatedTime: mockObjects.length * 2,
      totalObjects: mockObjects.length,
    };

    setScenePlan(plan);
    setStatus('previewing');

    // Set up generation steps
    setGenerationSteps([
      {
        id: 'setup',
        name: 'Scene Setup',
        description: 'Preparing scene and clearing existing objects',
        status: 'pending',
        progress: 0,
        objectsSpawned: 0,
        totalObjects: 0,
      },
      {
        id: 'structure',
        name: 'Structure',
        description: 'Spawning floors, walls, and structural elements',
        status: 'pending',
        progress: 0,
        objectsSpawned: 0,
        totalObjects: 3,
      },
      {
        id: 'lighting',
        name: 'Lighting',
        description: 'Setting up lights and atmosphere',
        status: 'pending',
        progress: 0,
        objectsSpawned: 0,
        totalObjects: 1,
      },
      {
        id: 'props',
        name: 'Props & Furniture',
        description: 'Placing props and decorative elements',
        status: 'pending',
        progress: 0,
        objectsSpawned: 0,
        totalObjects: 3,
      },
      {
        id: 'effects',
        name: 'Effects',
        description: 'Adding particle effects and ambiance',
        status: 'pending',
        progress: 0,
        objectsSpawned: 0,
        totalObjects: 1,
      },
      {
        id: 'finalize',
        name: 'Finalize',
        description: 'Applying post-process and final adjustments',
        status: 'pending',
        progress: 0,
        objectsSpawned: 0,
        totalObjects: 0,
      },
    ]);
  }, [prompt, selectedTemplate, style, mood, timeOfDay, weather]);

  // Start scene generation
  const startGeneration = useCallback(async () => {
    if (!scenePlan) return;

    setStatus('generating');
    setCurrentStep(0);

    // Simulate step-by-step generation
    for (let i = 0; i < generationSteps.length; i++) {
      setCurrentStep(i);
      
      // Update step status to running
      setGenerationSteps((prev) =>
        prev.map((step, idx) =>
          idx === i ? { ...step, status: 'running' } : step
        )
      );

      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setGenerationSteps((prev) =>
          prev.map((step, idx) =>
            idx === i ? { ...step, progress } : step
          )
        );
      }

      // Mark step as completed
      setGenerationSteps((prev) =>
        prev.map((step, idx) =>
          idx === i
            ? { ...step, status: 'completed', progress: 100, objectsSpawned: step.totalObjects }
            : step
        )
      );

      // Update object statuses
      if (i === 1) {
        // Structure step
        setScenePlan((prev) =>
          prev
            ? {
                ...prev,
                objects: prev.objects.map((obj) =>
                  obj.name.includes('Floor') || obj.name.includes('Wall')
                    ? { ...obj, status: 'spawned' }
                    : obj
                ),
              }
            : null
        );
      } else if (i === 2) {
        // Lighting step
        setScenePlan((prev) =>
          prev
            ? {
                ...prev,
                objects: prev.objects.map((obj) =>
                  obj.type === 'light' ? { ...obj, status: 'spawned' } : obj
                ),
              }
            : null
        );
      } else if (i === 3) {
        // Props step
        setScenePlan((prev) =>
          prev
            ? {
                ...prev,
                objects: prev.objects.map((obj) =>
                  obj.name.includes('Prop') ? { ...obj, status: 'spawned' } : obj
                ),
              }
            : null
        );
      } else if (i === 4) {
        // Effects step
        setScenePlan((prev) =>
          prev
            ? {
                ...prev,
                objects: prev.objects.map((obj) =>
                  obj.type === 'effect' ? { ...obj, status: 'spawned' } : obj
                ),
              }
            : null
        );
      }
    }

    setStatus('completed');
    
    // Add to history
    if (scenePlan) {
      setGenerationHistory((prev) => [scenePlan, ...prev].slice(0, 10));
    }

    onGenerate?.(scenePlan);
  }, [scenePlan, generationSteps, onGenerate]);

  // Cancel generation
  const cancelGeneration = useCallback(() => {
    setStatus('idle');
    setScenePlan(null);
    setGenerationSteps([]);
    setCurrentStep(0);
    onCancel?.();
  }, [onCancel]);

  // Reset to start
  const resetGenerator = useCallback(() => {
    setStatus('idle');
    setScenePlan(null);
    setGenerationSteps([]);
    setCurrentStep(0);
    setPrompt('');
    setSelectedTemplate(null);
  }, []);

  // Get status color
  const getStatusColor = (objStatus: string) => {
    switch (objStatus) {
      case 'spawned':
        return 'text-green-400';
      case 'spawning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-500';
    }
  };

  // Get step icon
  const getStepIcon = (step: GenerationStep) => {
    switch (step.status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <X className="w-4 h-4 text-red-400" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
    }
  };

  return (
    <div className={`bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                AI Scene Generator
                <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded-full">
                  Beta
                </span>
              </h3>
              <p className="text-sm text-gray-400">Generate entire scenes from text descriptions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {generationHistory.length > 0 && (
              <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                <History className="w-4 h-4" />
              </button>
            )}
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Prompt Input */}
        {status === 'idle' && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Describe your scene</label>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Create a medieval castle courtyard with stone walls, a central fountain, guard towers..."
                  className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                />
                <button className="absolute right-3 bottom-3 p-2 text-gray-400 hover:text-violet-400 transition-colors">
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Templates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  <Lightbulb className="w-4 h-4" />
                  Scene Templates
                  {showTemplates ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showTemplates && (
                  <div className="flex gap-1">
                    {CATEGORY_FILTERS.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          categoryFilter === cat.id
                            ? 'bg-violet-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showTemplates && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`p-3 text-left rounded-lg border transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'bg-violet-500/20 border-violet-500 text-white'
                          : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={selectedTemplate?.id === template.id ? 'text-violet-400' : 'text-gray-400'}>
                          {template.icon}
                        </span>
                        <span className="text-sm font-medium truncate">{template.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{template.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Style & Mood Options */}
            <div className="space-y-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                <Palette className="w-4 h-4" />
                Style & Atmosphere
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg">
                  {/* Style */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400">Visual Style</label>
                    <div className="flex gap-2">
                      {STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setStyle(opt.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            style === opt.id
                              ? 'bg-violet-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {opt.icon}
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mood */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400">Mood</label>
                    <div className="flex flex-wrap gap-2">
                      {MOOD_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setMood(opt.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            mood === opt.id
                              ? 'bg-violet-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${opt.color}`} />
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time of Day */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400">Time of Day</label>
                    <div className="flex flex-wrap gap-2">
                      {TIME_OF_DAY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setTimeOfDay(opt.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            timeOfDay === opt.id
                              ? 'bg-violet-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {opt.icon}
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weather */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400">Weather</label>
                    <div className="flex flex-wrap gap-2">
                      {WEATHER_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setWeather(opt.id)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            weather === opt.id
                              ? 'bg-violet-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={generateScenePlan}
              disabled={!prompt.trim()}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Generate Scene Plan
            </button>
          </>
        )}

        {/* Planning State */}
        {status === 'planning' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">Planning your scene...</p>
              <p className="text-sm text-gray-400">AI is analyzing your description and planning objects</p>
            </div>
          </div>
        )}

        {/* Preview State */}
        {status === 'previewing' && scenePlan && (
          <div className="space-y-4">
            {/* Scene Summary */}
            <div className="p-4 bg-gray-800/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-white">{scenePlan.name}</h4>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Layers className="w-4 h-4" />
                  {scenePlan.totalObjects} objects
                </div>
              </div>
              <p className="text-sm text-gray-400 line-clamp-2">{scenePlan.description}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs bg-violet-500/20 text-violet-400 rounded-full">
                  {style}
                </span>
                <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                  {mood}
                </span>
                <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                  {timeOfDay}
                </span>
                <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded-full">
                  {weather}
                </span>
              </div>
            </div>

            {/* Object List Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Objects to spawn</span>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showPreview && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {scenePlan.objects.map((obj) => (
                    <div
                      key={obj.id}
                      className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {obj.type === 'mesh' && <Box className="w-4 h-4 text-blue-400" />}
                        {obj.type === 'light' && <Sun className="w-4 h-4 text-yellow-400" />}
                        {obj.type === 'camera' && <Camera className="w-4 h-4 text-green-400" />}
                        {obj.type === 'effect' && <Sparkles className="w-4 h-4 text-purple-400" />}
                        {obj.type === 'audio' && <Volume2 className="w-4 h-4 text-pink-400" />}
                        <span className="text-sm text-white">{obj.name}</span>
                      </div>
                      <span className={`text-xs ${getStatusColor(obj.status)}`}>
                        {obj.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Generation Steps Preview */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-300">Generation steps</span>
              <div className="space-y-2">
                {generationSteps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      {getStepIcon(step)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{step.name}</p>
                      <p className="text-xs text-gray-500 truncate">{step.description}</p>
                    </div>
                    {step.totalObjects > 0 && (
                      <span className="text-xs text-gray-400">
                        {step.totalObjects} obj
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={cancelGeneration}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={startGeneration}
                className="flex-1 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Generation
              </button>
            </div>
          </div>
        )}

        {/* Generating State */}
        {status === 'generating' && scenePlan && (
          <div className="space-y-4">
            {/* Progress Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-white">Generating Scene</h4>
                <p className="text-sm text-gray-400">
                  Step {currentStep + 1} of {generationSteps.length}
                </p>
              </div>
              <button
                onClick={cancelGeneration}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Pause className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Steps */}
            <div className="space-y-2">
              {generationSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg transition-colors ${
                    idx === currentStep
                      ? 'bg-violet-500/20 border border-violet-500/50'
                      : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">{getStepIcon(step)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white font-medium">{step.name}</p>
                        {step.status === 'running' && (
                          <span className="text-xs text-violet-400">{step.progress}%</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{step.description}</p>
                      {step.status === 'running' && (
                        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500 transition-all duration-300"
                            style={{ width: `${step.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Object Status */}
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Objects</span>
                <span className="text-sm text-white">
                  {scenePlan.objects.filter((o) => o.status === 'spawned').length} / {scenePlan.totalObjects}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {scenePlan.objects.map((obj) => (
                  <div
                    key={obj.id}
                    className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                      obj.status === 'spawned'
                        ? 'bg-green-500/20 text-green-400'
                        : obj.status === 'spawning'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-700 text-gray-500'
                    }`}
                    title={obj.name}
                  >
                    {obj.status === 'spawned' ? (
                      <Check className="w-3 h-3" />
                    ) : obj.status === 'spawning' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Box className="w-3 h-3" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Completed State */}
        {status === 'completed' && scenePlan && (
          <div className="space-y-4">
            {/* Success Message */}
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Scene Generated Successfully!</p>
                <p className="text-sm text-gray-400">
                  {scenePlan.totalObjects} objects spawned in UE5
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
              <h4 className="font-medium text-white">{scenePlan.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Layers className="w-4 h-4" />
                  {scenePlan.totalObjects} objects
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Sun className="w-4 h-4" />
                  {scenePlan.lighting.preset} lighting
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={resetGenerator}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Scene
              </button>
              <button className="flex-1 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                Save as Template
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Voice Commands Footer */}
      {status === 'idle' && (
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/30">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mic className="w-3 h-3" />
            <span>Voice:</span>
            <span className="text-gray-400">"Create a medieval castle"</span>
            <span className="text-gray-400">"Generate sci-fi interior"</span>
            <span className="text-gray-400">"Build forest scene"</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISceneGenerator;
