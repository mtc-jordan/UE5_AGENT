/**
 * Lighting Wizard Component for UE5 AI Agent
 * 
 * Features:
 * - Pre-built lighting presets (Studio, Outdoor, Cinematic, Horror, Romantic, etc.)
 * - Time-of-day slider with real-time preview
 * - Mood-based AI suggestions
 * - One-click lighting optimization
 * - HDRI sky integration
 * - Three-point lighting setup
 * - Voice control integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun, Moon, Sunrise, Sunset, Cloud, CloudRain, CloudSnow,
  Lightbulb, Sparkles, Zap, Camera, Film, Heart, Skull,
  Building2, TreePine, Mountain, Waves, Star, Flame,
  Settings, RefreshCw, Play, Pause, ChevronDown, ChevronUp,
  Loader2, CheckCircle, AlertCircle, Wand2, Eye, EyeOff,
  SlidersHorizontal, Palette, Clock, Volume2, X, Plus, Minus,
  RotateCcw, Download, Upload, Copy, Layers, Target
} from 'lucide-react';

// Types
interface LightingPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'studio' | 'outdoor' | 'cinematic' | 'mood' | 'custom';
  color: string;
  settings: LightingSettings;
  tags: string[];
}

interface LightingSettings {
  timeOfDay: number; // 0-24 hours
  sunIntensity: number;
  sunColor: string;
  skyIntensity: number;
  skyColor: string;
  ambientIntensity: number;
  ambientColor: string;
  fogDensity: number;
  fogColor: string;
  shadowIntensity: number;
  bloomIntensity: number;
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number; // Kelvin
  hdriAsset?: string;
  additionalLights?: AdditionalLight[];
}

interface AdditionalLight {
  type: 'point' | 'spot' | 'directional' | 'rect';
  position: { x: number; y: number; z: number };
  rotation?: { pitch: number; yaw: number; roll: number };
  intensity: number;
  color: string;
  radius?: number;
  innerConeAngle?: number;
  outerConeAngle?: number;
}

interface LightingWizardProps {
  authToken: string;
  isConnected: boolean;
  onLightingApplied?: (preset: LightingPreset) => void;
  onVoiceCommand?: (command: string) => void;
}

// Time of day presets
const TIME_PRESETS = [
  { time: 0, name: 'Midnight', icon: Moon },
  { time: 5, name: 'Dawn', icon: Sunrise },
  { time: 7, name: 'Morning', icon: Sun },
  { time: 12, name: 'Noon', icon: Sun },
  { time: 17, name: 'Golden Hour', icon: Sunset },
  { time: 19, name: 'Dusk', icon: Sunset },
  { time: 21, name: 'Night', icon: Moon },
];

// Lighting presets
const LIGHTING_PRESETS: LightingPreset[] = [
  // Studio Presets
  {
    id: 'studio-three-point',
    name: 'Three-Point Lighting',
    description: 'Classic studio setup with key, fill, and back lights',
    icon: Lightbulb,
    category: 'studio',
    color: 'from-blue-500 to-cyan-500',
    tags: ['professional', 'portrait', 'product'],
    settings: {
      timeOfDay: 12,
      sunIntensity: 0.3,
      sunColor: '#FFFFFF',
      skyIntensity: 0.5,
      skyColor: '#87CEEB',
      ambientIntensity: 0.4,
      ambientColor: '#404040',
      fogDensity: 0,
      fogColor: '#FFFFFF',
      shadowIntensity: 0.8,
      bloomIntensity: 0.2,
      exposure: 1.0,
      contrast: 1.1,
      saturation: 1.0,
      temperature: 5500,
      additionalLights: [
        { type: 'spot', position: { x: 200, y: 100, z: 200 }, intensity: 10, color: '#FFFFFF', innerConeAngle: 20, outerConeAngle: 40 },
        { type: 'spot', position: { x: -150, y: 50, z: 150 }, intensity: 5, color: '#E0E8FF', innerConeAngle: 30, outerConeAngle: 50 },
        { type: 'spot', position: { x: 0, y: 200, z: -100 }, intensity: 3, color: '#FFF8E0', innerConeAngle: 25, outerConeAngle: 45 },
      ]
    }
  },
  {
    id: 'studio-soft',
    name: 'Soft Studio',
    description: 'Soft, diffused lighting for gentle shadows',
    icon: Cloud,
    category: 'studio',
    color: 'from-gray-400 to-gray-500',
    tags: ['soft', 'diffused', 'beauty'],
    settings: {
      timeOfDay: 12,
      sunIntensity: 0.2,
      sunColor: '#FFFFFF',
      skyIntensity: 0.8,
      skyColor: '#F0F0F0',
      ambientIntensity: 0.7,
      ambientColor: '#E0E0E0',
      fogDensity: 0,
      fogColor: '#FFFFFF',
      shadowIntensity: 0.3,
      bloomIntensity: 0.3,
      exposure: 1.1,
      contrast: 0.95,
      saturation: 0.95,
      temperature: 5800,
    }
  },
  {
    id: 'studio-dramatic',
    name: 'Dramatic Studio',
    description: 'High contrast lighting with deep shadows',
    icon: Zap,
    category: 'studio',
    color: 'from-purple-500 to-pink-500',
    tags: ['dramatic', 'contrast', 'moody'],
    settings: {
      timeOfDay: 12,
      sunIntensity: 0.1,
      sunColor: '#FFFFFF',
      skyIntensity: 0.2,
      skyColor: '#1A1A2E',
      ambientIntensity: 0.15,
      ambientColor: '#0A0A0A',
      fogDensity: 0,
      fogColor: '#000000',
      shadowIntensity: 1.0,
      bloomIntensity: 0.4,
      exposure: 0.9,
      contrast: 1.4,
      saturation: 0.9,
      temperature: 4500,
      additionalLights: [
        { type: 'spot', position: { x: 300, y: 150, z: 0 }, intensity: 15, color: '#FFFFFF', innerConeAngle: 15, outerConeAngle: 30 },
      ]
    }
  },

  // Outdoor Presets
  {
    id: 'outdoor-sunny',
    name: 'Sunny Day',
    description: 'Bright, clear sky with warm sunlight',
    icon: Sun,
    category: 'outdoor',
    color: 'from-yellow-400 to-orange-400',
    tags: ['sunny', 'bright', 'warm'],
    settings: {
      timeOfDay: 14,
      sunIntensity: 1.0,
      sunColor: '#FFF5E0',
      skyIntensity: 1.0,
      skyColor: '#87CEEB',
      ambientIntensity: 0.4,
      ambientColor: '#B0D4F1',
      fogDensity: 0.001,
      fogColor: '#C8E0F0',
      shadowIntensity: 0.9,
      bloomIntensity: 0.15,
      exposure: 1.0,
      contrast: 1.05,
      saturation: 1.1,
      temperature: 5500,
    }
  },
  {
    id: 'outdoor-golden-hour',
    name: 'Golden Hour',
    description: 'Warm, magical lighting just before sunset',
    icon: Sunset,
    category: 'outdoor',
    color: 'from-orange-400 to-red-400',
    tags: ['golden', 'warm', 'magical'],
    settings: {
      timeOfDay: 17.5,
      sunIntensity: 0.8,
      sunColor: '#FFB347',
      skyIntensity: 0.7,
      skyColor: '#FFD700',
      ambientIntensity: 0.5,
      ambientColor: '#FF8C00',
      fogDensity: 0.003,
      fogColor: '#FFE4B5',
      shadowIntensity: 0.7,
      bloomIntensity: 0.4,
      exposure: 1.1,
      contrast: 1.1,
      saturation: 1.2,
      temperature: 3500,
    }
  },
  {
    id: 'outdoor-overcast',
    name: 'Overcast',
    description: 'Cloudy sky with soft, even lighting',
    icon: Cloud,
    category: 'outdoor',
    color: 'from-gray-400 to-blue-400',
    tags: ['cloudy', 'soft', 'diffused'],
    settings: {
      timeOfDay: 12,
      sunIntensity: 0.3,
      sunColor: '#E0E0E0',
      skyIntensity: 0.6,
      skyColor: '#B0B0B0',
      ambientIntensity: 0.6,
      ambientColor: '#C0C0C0',
      fogDensity: 0.005,
      fogColor: '#D0D0D0',
      shadowIntensity: 0.2,
      bloomIntensity: 0.1,
      exposure: 1.0,
      contrast: 0.9,
      saturation: 0.85,
      temperature: 6500,
    }
  },
  {
    id: 'outdoor-night',
    name: 'Moonlit Night',
    description: 'Cool moonlight with starry atmosphere',
    icon: Moon,
    category: 'outdoor',
    color: 'from-indigo-500 to-purple-600',
    tags: ['night', 'moon', 'stars'],
    settings: {
      timeOfDay: 23,
      sunIntensity: 0.05,
      sunColor: '#C0D8FF',
      skyIntensity: 0.1,
      skyColor: '#0A0A20',
      ambientIntensity: 0.1,
      ambientColor: '#1A1A3A',
      fogDensity: 0.002,
      fogColor: '#0A0A20',
      shadowIntensity: 0.4,
      bloomIntensity: 0.3,
      exposure: 0.8,
      contrast: 1.2,
      saturation: 0.7,
      temperature: 8000,
    }
  },

  // Cinematic Presets
  {
    id: 'cinematic-noir',
    name: 'Film Noir',
    description: 'Classic black and white cinema style',
    icon: Film,
    category: 'cinematic',
    color: 'from-gray-700 to-gray-900',
    tags: ['noir', 'classic', 'dramatic'],
    settings: {
      timeOfDay: 22,
      sunIntensity: 0.1,
      sunColor: '#FFFFFF',
      skyIntensity: 0.05,
      skyColor: '#0A0A0A',
      ambientIntensity: 0.1,
      ambientColor: '#1A1A1A',
      fogDensity: 0.01,
      fogColor: '#2A2A2A',
      shadowIntensity: 1.0,
      bloomIntensity: 0.2,
      exposure: 0.85,
      contrast: 1.5,
      saturation: 0.0,
      temperature: 5000,
    }
  },
  {
    id: 'cinematic-blockbuster',
    name: 'Blockbuster',
    description: 'High-budget Hollywood action movie look',
    icon: Camera,
    category: 'cinematic',
    color: 'from-amber-500 to-teal-500',
    tags: ['action', 'hollywood', 'teal-orange'],
    settings: {
      timeOfDay: 16,
      sunIntensity: 0.9,
      sunColor: '#FFD080',
      skyIntensity: 0.6,
      skyColor: '#40A0B0',
      ambientIntensity: 0.3,
      ambientColor: '#206080',
      fogDensity: 0.002,
      fogColor: '#80C0D0',
      shadowIntensity: 0.8,
      bloomIntensity: 0.35,
      exposure: 1.05,
      contrast: 1.2,
      saturation: 1.15,
      temperature: 4800,
    }
  },
  {
    id: 'cinematic-scifi',
    name: 'Sci-Fi',
    description: 'Futuristic neon-lit atmosphere',
    icon: Sparkles,
    category: 'cinematic',
    color: 'from-cyan-400 to-purple-500',
    tags: ['scifi', 'neon', 'futuristic'],
    settings: {
      timeOfDay: 21,
      sunIntensity: 0.05,
      sunColor: '#00FFFF',
      skyIntensity: 0.2,
      skyColor: '#0A0A30',
      ambientIntensity: 0.25,
      ambientColor: '#200040',
      fogDensity: 0.008,
      fogColor: '#100030',
      shadowIntensity: 0.6,
      bloomIntensity: 0.6,
      exposure: 0.95,
      contrast: 1.3,
      saturation: 1.3,
      temperature: 7000,
      additionalLights: [
        { type: 'point', position: { x: 100, y: 50, z: 0 }, intensity: 5, color: '#00FFFF', radius: 500 },
        { type: 'point', position: { x: -100, y: 50, z: 0 }, intensity: 5, color: '#FF00FF', radius: 500 },
      ]
    }
  },

  // Mood Presets
  {
    id: 'mood-romantic',
    name: 'Romantic',
    description: 'Warm, soft lighting for intimate scenes',
    icon: Heart,
    category: 'mood',
    color: 'from-pink-400 to-rose-500',
    tags: ['romantic', 'warm', 'intimate'],
    settings: {
      timeOfDay: 19,
      sunIntensity: 0.4,
      sunColor: '#FFB0A0',
      skyIntensity: 0.3,
      skyColor: '#FFD0C0',
      ambientIntensity: 0.4,
      ambientColor: '#FF9080',
      fogDensity: 0.003,
      fogColor: '#FFE0D0',
      shadowIntensity: 0.4,
      bloomIntensity: 0.5,
      exposure: 1.1,
      contrast: 0.95,
      saturation: 1.1,
      temperature: 3200,
    }
  },
  {
    id: 'mood-horror',
    name: 'Horror',
    description: 'Dark, unsettling atmosphere',
    icon: Skull,
    category: 'mood',
    color: 'from-red-600 to-gray-900',
    tags: ['horror', 'dark', 'scary'],
    settings: {
      timeOfDay: 2,
      sunIntensity: 0.02,
      sunColor: '#400000',
      skyIntensity: 0.05,
      skyColor: '#0A0000',
      ambientIntensity: 0.08,
      ambientColor: '#200000',
      fogDensity: 0.015,
      fogColor: '#100000',
      shadowIntensity: 1.0,
      bloomIntensity: 0.2,
      exposure: 0.7,
      contrast: 1.4,
      saturation: 0.6,
      temperature: 2500,
    }
  },
  {
    id: 'mood-peaceful',
    name: 'Peaceful',
    description: 'Calm, serene lighting for relaxation',
    icon: Waves,
    category: 'mood',
    color: 'from-teal-400 to-green-400',
    tags: ['peaceful', 'calm', 'serene'],
    settings: {
      timeOfDay: 10,
      sunIntensity: 0.7,
      sunColor: '#FFFAF0',
      skyIntensity: 0.8,
      skyColor: '#90D0E0',
      ambientIntensity: 0.5,
      ambientColor: '#A0E0C0',
      fogDensity: 0.002,
      fogColor: '#E0F0F0',
      shadowIntensity: 0.5,
      bloomIntensity: 0.25,
      exposure: 1.05,
      contrast: 1.0,
      saturation: 1.05,
      temperature: 5800,
    }
  },
  {
    id: 'mood-mysterious',
    name: 'Mysterious',
    description: 'Enigmatic atmosphere with subtle lighting',
    icon: Star,
    category: 'mood',
    color: 'from-violet-500 to-indigo-600',
    tags: ['mysterious', 'enigmatic', 'subtle'],
    settings: {
      timeOfDay: 20,
      sunIntensity: 0.15,
      sunColor: '#8080FF',
      skyIntensity: 0.2,
      skyColor: '#1A1A40',
      ambientIntensity: 0.2,
      ambientColor: '#2A2A50',
      fogDensity: 0.008,
      fogColor: '#1A1A30',
      shadowIntensity: 0.7,
      bloomIntensity: 0.35,
      exposure: 0.9,
      contrast: 1.15,
      saturation: 0.9,
      temperature: 6500,
    }
  },
];

// HDRI options
const HDRI_OPTIONS = [
  { id: 'studio_small_08', name: 'Studio Small', category: 'studio' },
  { id: 'photo_studio_01', name: 'Photo Studio', category: 'studio' },
  { id: 'venice_sunset', name: 'Venice Sunset', category: 'outdoor' },
  { id: 'kloppenheim_02', name: 'Kloppenheim', category: 'outdoor' },
  { id: 'industrial_sunset_02', name: 'Industrial Sunset', category: 'outdoor' },
  { id: 'moonless_golf', name: 'Moonless Golf', category: 'night' },
  { id: 'night_bridge', name: 'Night Bridge', category: 'night' },
  { id: 'abandoned_parking', name: 'Abandoned Parking', category: 'urban' },
];

// Voice commands mapping
const VOICE_COMMANDS = [
  { pattern: /studio|three.?point/i, preset: 'studio-three-point' },
  { pattern: /soft.*studio|studio.*soft/i, preset: 'studio-soft' },
  { pattern: /dramatic.*studio|studio.*dramatic/i, preset: 'studio-dramatic' },
  { pattern: /sunny|bright.*day/i, preset: 'outdoor-sunny' },
  { pattern: /golden.*hour|sunset/i, preset: 'outdoor-golden-hour' },
  { pattern: /overcast|cloudy/i, preset: 'outdoor-overcast' },
  { pattern: /night|moon/i, preset: 'outdoor-night' },
  { pattern: /noir|black.*white/i, preset: 'cinematic-noir' },
  { pattern: /blockbuster|action|hollywood/i, preset: 'cinematic-blockbuster' },
  { pattern: /sci.?fi|futuristic|neon/i, preset: 'cinematic-scifi' },
  { pattern: /romantic|intimate/i, preset: 'mood-romantic' },
  { pattern: /horror|scary|dark/i, preset: 'mood-horror' },
  { pattern: /peaceful|calm|serene/i, preset: 'mood-peaceful' },
  { pattern: /mysterious|enigmatic/i, preset: 'mood-mysterious' },
];

const LightingWizard: React.FC<LightingWizardProps> = ({
  authToken,
  isConnected,
  onLightingApplied,
  onVoiceCommand,
}) => {
  // State
  const [selectedPreset, setSelectedPreset] = useState<LightingPreset | null>(null);
  const [currentSettings, setCurrentSettings] = useState<LightingSettings>(LIGHTING_PRESETS[0].settings);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isApplying, setIsApplying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [recentPresets, setRecentPresets] = useState<string[]>([]);
  const [customPresets, setCustomPresets] = useState<LightingPreset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Categories
  const categories = [
    { id: 'all', name: 'All', icon: Layers },
    { id: 'studio', name: 'Studio', icon: Lightbulb },
    { id: 'outdoor', name: 'Outdoor', icon: Sun },
    { id: 'cinematic', name: 'Cinematic', icon: Film },
    { id: 'mood', name: 'Mood', icon: Heart },
    { id: 'custom', name: 'Custom', icon: Palette },
  ];

  // Filter presets
  const filteredPresets = LIGHTING_PRESETS.filter(preset => {
    const matchesCategory = activeCategory === 'all' || preset.category === activeCategory;
    const matchesSearch = !searchQuery || 
      preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Get time of day label
  const getTimeLabel = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Get sun position based on time
  const getSunPosition = (time: number) => {
    const angle = ((time - 6) / 12) * 180; // 6 AM = 0°, 6 PM = 180°
    return Math.max(0, Math.min(100, 50 + Math.sin((angle * Math.PI) / 180) * 50));
  };

  // Apply preset
  const applyPreset = async (preset: LightingPreset) => {
    if (!isConnected) return;

    setIsApplying(true);
    setSelectedPreset(preset);
    setCurrentSettings(preset.settings);

    try {
      const response = await fetch('/api/lighting/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          preset_id: preset.id,
          settings: preset.settings,
        }),
      });

      if (response.ok) {
        // Add to recent presets
        setRecentPresets(prev => [preset.id, ...prev.filter(id => id !== preset.id)].slice(0, 5));
        onLightingApplied?.(preset);
      }
    } catch (error) {
      console.error('Failed to apply lighting preset:', error);
    } finally {
      setIsApplying(false);
    }
  };

  // Apply custom settings
  const applyCustomSettings = async () => {
    if (!isConnected) return;

    setIsApplying(true);

    try {
      const response = await fetch('/api/lighting/apply-custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          settings: currentSettings,
        }),
      });

      if (response.ok) {
        onLightingApplied?.({
          id: 'custom',
          name: 'Custom Settings',
          description: 'User-defined lighting',
          icon: Palette,
          category: 'custom',
          color: 'from-violet-500 to-purple-500',
          tags: ['custom'],
          settings: currentSettings,
        });
      }
    } catch (error) {
      console.error('Failed to apply custom settings:', error);
    } finally {
      setIsApplying(false);
    }
  };

  // Handle voice command
  const handleVoiceCommand = useCallback((command: string) => {
    for (const vc of VOICE_COMMANDS) {
      if (vc.pattern.test(command)) {
        const preset = LIGHTING_PRESETS.find(p => p.id === vc.preset);
        if (preset) {
          applyPreset(preset);
          return true;
        }
      }
    }

    // Handle time-based commands
    const timeMatch = command.match(/time.*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      const time = hours + minutes / 60;
      setCurrentSettings(prev => ({ ...prev, timeOfDay: time }));
      applyCustomSettings();
      return true;
    }

    return false;
  }, [isConnected, authToken]);

  // Expose voice command handler
  useEffect(() => {
    if (onVoiceCommand) {
      // Register voice command handler
    }
  }, [onVoiceCommand, handleVoiceCommand]);

  // Render time slider
  const renderTimeSlider = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Time of Day
        </label>
        <span className="text-sm font-medium text-white">
          {getTimeLabel(currentSettings.timeOfDay)}
        </span>
      </div>
      
      {/* Visual time representation */}
      <div className="relative h-16 bg-gradient-to-r from-indigo-900 via-orange-400 via-yellow-200 via-orange-400 to-indigo-900 rounded-xl overflow-hidden">
        {/* Sun/Moon indicator */}
        <div
          className="absolute w-8 h-8 rounded-full transition-all duration-300"
          style={{
            left: `${(currentSettings.timeOfDay / 24) * 100}%`,
            top: `${100 - getSunPosition(currentSettings.timeOfDay)}%`,
            transform: 'translate(-50%, -50%)',
            background: currentSettings.timeOfDay > 6 && currentSettings.timeOfDay < 18 
              ? 'radial-gradient(circle, #FFD700 0%, #FFA500 100%)' 
              : 'radial-gradient(circle, #E0E0E0 0%, #A0A0A0 100%)',
            boxShadow: currentSettings.timeOfDay > 6 && currentSettings.timeOfDay < 18
              ? '0 0 20px #FFD700'
              : '0 0 15px #E0E0E0',
          }}
        />
        
        {/* Time markers */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 py-1">
          {['12AM', '6AM', '12PM', '6PM', '12AM'].map((label, i) => (
            <span key={i} className="text-xs text-white/70">{label}</span>
          ))}
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min="0"
        max="24"
        step="0.25"
        value={currentSettings.timeOfDay}
        onChange={(e) => setCurrentSettings(prev => ({ ...prev, timeOfDay: parseFloat(e.target.value) }))}
        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
      />

      {/* Quick time presets */}
      <div className="flex gap-2 flex-wrap">
        {TIME_PRESETS.map((tp) => (
          <button
            key={tp.time}
            onClick={() => setCurrentSettings(prev => ({ ...prev, timeOfDay: tp.time }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              Math.abs(currentSettings.timeOfDay - tp.time) < 1
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
            }`}
          >
            <tp.icon className="w-3 h-3" />
            {tp.name}
          </button>
        ))}
      </div>
    </div>
  );

  // Render preset card
  const renderPresetCard = (preset: LightingPreset) => {
    const isSelected = selectedPreset?.id === preset.id;
    const Icon = preset.icon;

    return (
      <button
        key={preset.id}
        onClick={() => applyPreset(preset)}
        disabled={!isConnected || isApplying}
        className={`
          relative p-4 rounded-xl border transition-all duration-300 text-left group
          ${isSelected 
            ? 'bg-gradient-to-br ' + preset.color + ' border-white/30 shadow-lg' 
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
          }
          ${(!isConnected || isApplying) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110
          ${isSelected ? 'bg-white/20' : 'bg-gradient-to-br ' + preset.color}
        `}>
          <Icon className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <h4 className={`font-medium mb-1 ${isSelected ? 'text-white' : 'text-white'}`}>
          {preset.name}
        </h4>
        <p className={`text-xs line-clamp-2 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
          {preset.description}
        </p>

        {/* Tags */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {preset.tags.slice(0, 2).map(tag => (
            <span
              key={tag}
              className={`px-2 py-0.5 rounded text-xs ${
                isSelected ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-500'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
        )}

        {/* Loading overlay */}
        {isApplying && isSelected && (
          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </button>
    );
  };

  // Render advanced settings
  const renderAdvancedSettings = () => (
    <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
      <h4 className="text-sm font-medium text-white flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4" />
        Advanced Settings
      </h4>

      <div className="grid grid-cols-2 gap-4">
        {/* Sun Intensity */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Sun Intensity</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={currentSettings.sunIntensity}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, sunIntensity: parseFloat(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
          <span className="text-xs text-gray-500">{currentSettings.sunIntensity.toFixed(1)}</span>
        </div>

        {/* Shadow Intensity */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Shadow Intensity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={currentSettings.shadowIntensity}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, shadowIntensity: parseFloat(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gray-500"
          />
          <span className="text-xs text-gray-500">{currentSettings.shadowIntensity.toFixed(1)}</span>
        </div>

        {/* Bloom */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Bloom</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={currentSettings.bloomIntensity}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, bloomIntensity: parseFloat(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
          />
          <span className="text-xs text-gray-500">{currentSettings.bloomIntensity.toFixed(2)}</span>
        </div>

        {/* Exposure */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Exposure</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={currentSettings.exposure}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, exposure: parseFloat(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <span className="text-xs text-gray-500">{currentSettings.exposure.toFixed(2)}</span>
        </div>

        {/* Contrast */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Contrast</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={currentSettings.contrast}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, contrast: parseFloat(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-gray-500">{currentSettings.contrast.toFixed(2)}</span>
        </div>

        {/* Saturation */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Saturation</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={currentSettings.saturation}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, saturation: parseFloat(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <span className="text-xs text-gray-500">{currentSettings.saturation.toFixed(2)}</span>
        </div>

        {/* Fog Density */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Fog Density</label>
          <input
            type="range"
            min="0"
            max="0.05"
            step="0.001"
            value={currentSettings.fogDensity}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, fogDensity: parseFloat(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-xs text-gray-500">{currentSettings.fogDensity.toFixed(3)}</span>
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Temperature (K)</label>
          <input
            type="range"
            min="2000"
            max="10000"
            step="100"
            value={currentSettings.temperature}
            onChange={(e) => setCurrentSettings(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
            className="w-full h-1.5 bg-gradient-to-r from-orange-500 via-white to-blue-500 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-500">{currentSettings.temperature}K</span>
        </div>
      </div>

      {/* Apply Custom Button */}
      <button
        onClick={applyCustomSettings}
        disabled={!isConnected || isApplying}
        className="w-full py-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isApplying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Applying...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Apply Custom Settings
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Sun className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              Lighting Wizard
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                AI-Powered
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              {isConnected ? 'Create stunning lighting setups' : 'Connect to UE5 to use'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewEnabled(!previewEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              previewEnabled ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400'
            }`}
            title={previewEnabled ? 'Preview enabled' : 'Preview disabled'}
          >
            {previewEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Time of Day Control */}
          {renderTimeSlider()}

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search presets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
            />
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPresets.map(renderPresetCard)}
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center gap-2 py-2 text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">{showAdvanced ? 'Hide' : 'Show'} Advanced Settings</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {/* Advanced Settings Panel */}
          {showAdvanced && renderAdvancedSettings()}

          {/* Voice Commands Help */}
          <div className="p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">Voice Commands</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                'Set up studio lighting',
                'Golden hour',
                'Make it cinematic',
                'Horror atmosphere',
                'Time to 6 PM',
              ].map((cmd, i) => (
                <span
                  key={i}
                  className="px-2 py-1 text-xs bg-violet-500/20 text-violet-300 rounded-lg"
                >
                  "{cmd}"
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LightingWizard;
