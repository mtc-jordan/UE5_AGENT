/**
 * Animation Assistant Component for UE5 AI Agent
 * 
 * Features:
 * - Animation library browser with search and filters
 * - Animation preview panel with playback controls
 * - Blend space editor with AI suggestions
 * - Retargeting wizard for skeleton mapping
 * - Animation montage builder
 * - Voice control integration
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1,
  Search, Grid, List, Folder, Film, Clapperboard,
  User, Swords, Heart, Hand, Footprints, Zap,
  Settings, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Loader2, CheckCircle, Plus,
  Layers, Shuffle,
  Volume2,
  Sparkles, Eye, Move3D
} from 'lucide-react';

// Types
interface Animation {
  id: string;
  name: string;
  path: string;
  category: string;
  duration: number;
  frameCount: number;
  fps: number;
  skeleton: string;
  tags: string[];
  thumbnail?: string;
  isLooping: boolean;
  hasRootMotion: boolean;
}

interface BlendSpace {
  id: string;
  name: string;
  type: '1D' | '2D';
  axisX: { name: string; min: number; max: number };
  axisY?: { name: string; min: number; max: number };
  samples: BlendSample[];
}

interface BlendSample {
  animation: string;
  position: { x: number; y?: number };
}

interface AnimationNotify {
  id: string;
  name: string;
  time: number;
  type: 'event' | 'state' | 'sound';
}

interface AnimationMontage {
  id: string;
  name: string;
  sections: MontageSection[];
  notifies: AnimationNotify[];
}

interface MontageSection {
  id: string;
  name: string;
  startTime: number;
  animation: string;
}

interface AnimationAssistantProps {
  authToken: string;
  isConnected: boolean;
  onAnimationApplied?: (animation: Animation) => void;
  onVoiceCommand?: (command: string) => boolean;
}

// Animation categories
const ANIMATION_CATEGORIES = [
  { id: 'all', name: 'All', icon: Layers, count: 0 },
  { id: 'locomotion', name: 'Locomotion', icon: Footprints, count: 0 },
  { id: 'combat', name: 'Combat', icon: Swords, count: 0 },
  { id: 'emotes', name: 'Emotes', icon: Heart, count: 0 },
  { id: 'interactions', name: 'Interactions', icon: Hand, count: 0 },
  { id: 'abilities', name: 'Abilities', icon: Zap, count: 0 },
  { id: 'cinematic', name: 'Cinematic', icon: Film, count: 0 },
];

// Sample animations for demo
const SAMPLE_ANIMATIONS: Animation[] = [
  { id: '1', name: 'Idle', path: '/Game/Animations/Locomotion/Idle', category: 'locomotion', duration: 2.0, frameCount: 60, fps: 30, skeleton: 'SK_Mannequin', tags: ['idle', 'standing', 'loop'], isLooping: true, hasRootMotion: false },
  { id: '2', name: 'Walk', path: '/Game/Animations/Locomotion/Walk', category: 'locomotion', duration: 1.0, frameCount: 30, fps: 30, skeleton: 'SK_Mannequin', tags: ['walk', 'movement', 'loop'], isLooping: true, hasRootMotion: true },
  { id: '3', name: 'Run', path: '/Game/Animations/Locomotion/Run', category: 'locomotion', duration: 0.8, frameCount: 24, fps: 30, skeleton: 'SK_Mannequin', tags: ['run', 'sprint', 'movement', 'loop'], isLooping: true, hasRootMotion: true },
  { id: '4', name: 'Jump', path: '/Game/Animations/Locomotion/Jump', category: 'locomotion', duration: 1.5, frameCount: 45, fps: 30, skeleton: 'SK_Mannequin', tags: ['jump', 'air'], isLooping: false, hasRootMotion: true },
  { id: '5', name: 'Crouch Idle', path: '/Game/Animations/Locomotion/CrouchIdle', category: 'locomotion', duration: 2.0, frameCount: 60, fps: 30, skeleton: 'SK_Mannequin', tags: ['crouch', 'stealth', 'loop'], isLooping: true, hasRootMotion: false },
  { id: '6', name: 'Sword Attack', path: '/Game/Animations/Combat/SwordAttack', category: 'combat', duration: 1.2, frameCount: 36, fps: 30, skeleton: 'SK_Mannequin', tags: ['attack', 'melee', 'sword'], isLooping: false, hasRootMotion: true },
  { id: '7', name: 'Sword Combo', path: '/Game/Animations/Combat/SwordCombo', category: 'combat', duration: 2.5, frameCount: 75, fps: 30, skeleton: 'SK_Mannequin', tags: ['combo', 'melee', 'sword'], isLooping: false, hasRootMotion: true },
  { id: '8', name: 'Block', path: '/Game/Animations/Combat/Block', category: 'combat', duration: 0.5, frameCount: 15, fps: 30, skeleton: 'SK_Mannequin', tags: ['block', 'defense'], isLooping: false, hasRootMotion: false },
  { id: '9', name: 'Dodge Roll', path: '/Game/Animations/Combat/DodgeRoll', category: 'combat', duration: 1.0, frameCount: 30, fps: 30, skeleton: 'SK_Mannequin', tags: ['dodge', 'roll', 'evasion'], isLooping: false, hasRootMotion: true },
  { id: '10', name: 'Death', path: '/Game/Animations/Combat/Death', category: 'combat', duration: 2.0, frameCount: 60, fps: 30, skeleton: 'SK_Mannequin', tags: ['death', 'ragdoll'], isLooping: false, hasRootMotion: true },
  { id: '11', name: 'Wave', path: '/Game/Animations/Emotes/Wave', category: 'emotes', duration: 2.0, frameCount: 60, fps: 30, skeleton: 'SK_Mannequin', tags: ['wave', 'greeting', 'friendly'], isLooping: false, hasRootMotion: false },
  { id: '12', name: 'Dance', path: '/Game/Animations/Emotes/Dance', category: 'emotes', duration: 4.0, frameCount: 120, fps: 30, skeleton: 'SK_Mannequin', tags: ['dance', 'celebration', 'loop'], isLooping: true, hasRootMotion: false },
  { id: '13', name: 'Clap', path: '/Game/Animations/Emotes/Clap', category: 'emotes', duration: 1.5, frameCount: 45, fps: 30, skeleton: 'SK_Mannequin', tags: ['clap', 'applause'], isLooping: false, hasRootMotion: false },
  { id: '14', name: 'Sit Down', path: '/Game/Animations/Emotes/SitDown', category: 'emotes', duration: 1.0, frameCount: 30, fps: 30, skeleton: 'SK_Mannequin', tags: ['sit', 'rest'], isLooping: false, hasRootMotion: false },
  { id: '15', name: 'Pick Up', path: '/Game/Animations/Interactions/PickUp', category: 'interactions', duration: 1.2, frameCount: 36, fps: 30, skeleton: 'SK_Mannequin', tags: ['pickup', 'grab', 'item'], isLooping: false, hasRootMotion: false },
  { id: '16', name: 'Open Door', path: '/Game/Animations/Interactions/OpenDoor', category: 'interactions', duration: 1.5, frameCount: 45, fps: 30, skeleton: 'SK_Mannequin', tags: ['door', 'open', 'interact'], isLooping: false, hasRootMotion: false },
  { id: '17', name: 'Push Button', path: '/Game/Animations/Interactions/PushButton', category: 'interactions', duration: 0.8, frameCount: 24, fps: 30, skeleton: 'SK_Mannequin', tags: ['button', 'press', 'interact'], isLooping: false, hasRootMotion: false },
  { id: '18', name: 'Fireball Cast', path: '/Game/Animations/Abilities/FireballCast', category: 'abilities', duration: 1.5, frameCount: 45, fps: 30, skeleton: 'SK_Mannequin', tags: ['magic', 'fireball', 'cast'], isLooping: false, hasRootMotion: false },
  { id: '19', name: 'Heal', path: '/Game/Animations/Abilities/Heal', category: 'abilities', duration: 2.0, frameCount: 60, fps: 30, skeleton: 'SK_Mannequin', tags: ['magic', 'heal', 'support'], isLooping: false, hasRootMotion: false },
  { id: '20', name: 'Teleport', path: '/Game/Animations/Abilities/Teleport', category: 'abilities', duration: 1.0, frameCount: 30, fps: 30, skeleton: 'SK_Mannequin', tags: ['magic', 'teleport', 'blink'], isLooping: false, hasRootMotion: true },
];

// Voice command patterns
const VOICE_PATTERNS = [
  { pattern: /play\s+(.+?)(?:\s+animation)?$/i, action: 'play', extract: 'name' },
  { pattern: /preview\s+(.+?)(?:\s+animation)?$/i, action: 'preview', extract: 'name' },
  { pattern: /blend\s+(.+?)\s+to\s+(.+)/i, action: 'blend', extract: ['from', 'to'] },
  { pattern: /(?:set\s+)?(?:animation\s+)?speed\s+(?:to\s+)?(.+)/i, action: 'speed', extract: 'rate' },
  { pattern: /loop\s+(?:the\s+)?(?:current\s+)?animation/i, action: 'loop' },
  { pattern: /stop\s+(?:the\s+)?animation/i, action: 'stop' },
  { pattern: /pause\s+(?:the\s+)?animation/i, action: 'pause' },
  { pattern: /resume\s+(?:the\s+)?animation/i, action: 'resume' },
  { pattern: /show\s+(?:all\s+)?(.+?)\s+animations/i, action: 'filter', extract: 'category' },
  { pattern: /search\s+(?:for\s+)?(.+)/i, action: 'search', extract: 'query' },
  { pattern: /retarget\s+(?:animation\s+)?(?:to\s+)?(.+)/i, action: 'retarget', extract: 'skeleton' },
  { pattern: /create\s+(?:animation\s+)?montage/i, action: 'montage' },
  { pattern: /add\s+notify\s+(?:at\s+)?(\d+(?:\.\d+)?)/i, action: 'notify', extract: 'time' },
];

const AnimationAssistant: React.FC<AnimationAssistantProps> = ({
  authToken,
  isConnected,
  onAnimationApplied,
  onVoiceCommand}) => {
  // State
  const [animations, setAnimations] = useState<Animation[]>(SAMPLE_ANIMATIONS);
  const [filteredAnimations, setFilteredAnimations] = useState<Animation[]>(SAMPLE_ANIMATIONS);
  const [selectedAnimation, setSelectedAnimation] = useState<Animation | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'library' | 'preview' | 'blend' | 'montage'>('library');
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [ setIsMuted] = useState(false);
  
  // Blend space state
  const [ setBlendSpaces] = useState<BlendSpace[]>([]);
  const [ setSelectedBlendSpace] = useState<BlendSpace | null>(null);
  const [blendPosition, setBlendPosition] = useState({ x: 0, y: 0 });
  
  // Montage state
  const [montages, setMontages] = useState<AnimationMontage[]>([]);
  const [selectedMontage, setSelectedMontage] = useState<AnimationMontage | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  
  // Refs
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter animations
  useEffect(() => {
    let filtered = animations;
    
    // Category filter
    if (activeCategory !== 'all') {
      filtered = filtered.filter(a => a.category === activeCategory);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(query) ||
        a.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    setFilteredAnimations(filtered);
  }, [animations, activeCategory, searchQuery]);

  // Playback simulation
  useEffect(() => {
    if (isPlaying && selectedAnimation) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (0.033 * playbackSpeed); // ~30fps update
          if (next >= selectedAnimation.duration) {
            if (isLooping) {
              return 0;
            } else {
              setIsPlaying(false);
              return selectedAnimation.duration;
            }
          }
          return next;
        });
      }, 33);
    }
    
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, selectedAnimation, playbackSpeed, isLooping]);

  // Handle voice command
  const handleVoiceCommand = useCallback((command: string): boolean => {
    for (const vc of VOICE_PATTERNS) {
      const match = command.match(vc.pattern);
      if (match) {
        switch (vc.action) {
          case 'play':
          case 'preview': {
            const name = match[1].toLowerCase();
            const anim = animations.find(a => 
              a.name.toLowerCase().includes(name) ||
              a.tags.some(t => t.toLowerCase().includes(name))
            );
            if (anim) {
              setSelectedAnimation(anim);
              setIsPlaying(true);
              setCurrentTime(0);
              playAnimation(anim);
              return true;
            }
            break;
          }
          case 'blend': {
            // Handle blend command
            const from = match[1];
            const to = match[2];
            console.log(`Blend from ${from} to ${to}`);
            setActiveTab('blend');
            return true;
          }
          case 'speed': {
            const rateStr = match[1].toLowerCase();
            let rate = 1.0;
            if (rateStr.includes('half') || rateStr.includes('0.5')) rate = 0.5;
            else if (rateStr.includes('double') || rateStr.includes('2')) rate = 2.0;
            else if (rateStr.includes('quarter') || rateStr.includes('0.25')) rate = 0.25;
            else rate = parseFloat(rateStr) || 1.0;
            setPlaybackSpeed(rate);
            return true;
          }
          case 'loop':
            setIsLooping(true);
            return true;
          case 'stop':
            setIsPlaying(false);
            setCurrentTime(0);
            return true;
          case 'pause':
            setIsPlaying(false);
            return true;
          case 'resume':
            setIsPlaying(true);
            return true;
          case 'filter': {
            const category = match[1].toLowerCase();
            const cat = ANIMATION_CATEGORIES.find(c => 
              c.name.toLowerCase().includes(category) ||
              c.id.toLowerCase().includes(category)
            );
            if (cat) {
              setActiveCategory(cat.id);
              return true;
            }
            break;
          }
          case 'search':
            setSearchQuery(match[1]);
            return true;
          case 'montage':
            setActiveTab('montage');
            return true;
        }
      }
    }
    return false;
  }, [animations]);

  // Expose voice command handler
  useEffect(() => {
    if (onVoiceCommand) {
      // The parent component will call handleVoiceCommand
    }
  }, [onVoiceCommand, handleVoiceCommand]);

  // Play animation on UE5
  const playAnimation = async (animation: Animation) => {
    if (!isConnected) return;
    
    setIsApplying(true);
    try {
      const response = await fetch('/api/animation/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`},
        body: JSON.stringify({
          animation_path: animation.path,
          loop: isLooping,
          speed: playbackSpeed})});
      
      if (response.ok) {
        onAnimationApplied?.(animation);
      }
    } catch (error) {
      console.error('Failed to play animation:', error);
    } finally {
      setIsApplying(false);
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Render animation card
  const renderAnimationCard = (animation: Animation) => {
    const isSelected = selectedAnimation?.id === animation.id;
    
    return (
      <button
        key={animation.id}
        onClick={() => {
          setSelectedAnimation(animation);
          setCurrentTime(0);
          setActiveTab('preview');
        }}
        className={`
          relative p-3 rounded-xl border transition-all duration-200 text-left group
          ${isSelected 
            ? 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/50 shadow-lg shadow-violet-500/20' 
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
          }
        `}
      >
        {/* Thumbnail placeholder */}
        <div className={`
          aspect-video rounded-lg mb-2 flex items-center justify-center
          ${isSelected ? 'bg-violet-500/30' : 'bg-white/5'}
        `}>
          <Film className={`w-8 h-8 ${isSelected ? 'text-violet-300' : 'text-gray-500'}`} />
          
          {/* Play overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        </div>
        
        {/* Info */}
        <h4 className={`font-medium text-sm truncate ${isSelected ? 'text-violet-300' : 'text-white'}`}>
          {animation.name}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">{animation.duration.toFixed(1)}s</span>
          <span className="text-xs text-gray-600">•</span>
          <span className="text-xs text-gray-500">{animation.frameCount} frames</span>
        </div>
        
        {/* Tags */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {animation.tags.slice(0, 2).map(tag => (
            <span
              key={tag}
              className={`px-1.5 py-0.5 rounded text-xs ${
                isSelected ? 'bg-violet-500/30 text-violet-300' : 'bg-white/5 text-gray-500'
              }`}
            >
              {tag}
            </span>
          ))}
          {animation.isLooping && (
            <Repeat1 className="w-3 h-3 text-green-400" title="Looping" />
          )}
          {animation.hasRootMotion && (
            <Move3D className="w-3 h-3 text-blue-400" title="Root Motion" />
          )}
        </div>
        
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="w-4 h-4 text-violet-400" />
          </div>
        )}
      </button>
    );
  };

  // Render animation list item
  const renderAnimationListItem = (animation: Animation) => {
    const isSelected = selectedAnimation?.id === animation.id;
    
    return (
      <button
        key={animation.id}
        onClick={() => {
          setSelectedAnimation(animation);
          setCurrentTime(0);
          setActiveTab('preview');
        }}
        className={`
          w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left
          ${isSelected 
            ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/50' 
            : 'bg-white/5 border-white/10 hover:bg-white/10'
          }
        `}
      >
        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
          ${isSelected ? 'bg-violet-500/30' : 'bg-white/5'}
        `}>
          <Film className={`w-5 h-5 ${isSelected ? 'text-violet-300' : 'text-gray-500'}`} />
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm truncate ${isSelected ? 'text-violet-300' : 'text-white'}`}>
            {animation.name}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{animation.duration.toFixed(1)}s</span>
            <span className="text-xs text-gray-600">•</span>
            <span className="text-xs text-gray-500">{animation.category}</span>
          </div>
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-2">
          {animation.isLooping && (
            <Repeat1 className="w-4 h-4 text-green-400" title="Looping" />
          )}
          {animation.hasRootMotion && (
            <Move3D className="w-4 h-4 text-blue-400" title="Root Motion" />
          )}
        </div>
      </button>
    );
  };

  // Render preview panel
  const renderPreviewPanel = () => {
    if (!selectedAnimation) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Film className="w-12 h-12 mb-3 opacity-50" />
          <p>Select an animation to preview</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {/* Preview viewport */}
        <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden">
          {/* Placeholder for 3D preview */}
          <div className="text-center">
            <User className="w-16 h-16 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{selectedAnimation.name}</p>
            <p className="text-gray-600 text-xs">{selectedAnimation.skeleton}</p>
          </div>
          
          {/* Playback indicator */}
          {isPlaying && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 bg-green-500/20 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">Playing</span>
            </div>
          )}
          
          {/* Speed indicator */}
          {playbackSpeed !== 1.0 && (
            <div className="absolute top-3 right-3 px-2 py-1 bg-white/10 rounded-full">
              <span className="text-xs text-white">{playbackSpeed}x</span>
            </div>
          )}
        </div>
        
        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16">{formatTime(currentTime)}</span>
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max={selectedAnimation.duration}
                step="0.001"
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              {/* Frame markers */}
              <div className="absolute top-full left-0 right-0 flex justify-between mt-1">
                {[0, 0.25, 0.5, 0.75, 1].map(p => (
                  <span key={p} className="text-xs text-gray-600">
                    {Math.round(p * selectedAnimation.frameCount)}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-xs text-gray-500 w-16 text-right">{formatTime(selectedAnimation.duration)}</span>
          </div>
        </div>
        
        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentTime(0)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Go to start"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setCurrentTime(Math.max(0, currentTime - 1/30))}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Previous frame"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => {
              if (isPlaying) {
                setIsPlaying(false);
              } else {
                setIsPlaying(true);
                if (currentTime >= selectedAnimation.duration) {
                  setCurrentTime(0);
                }
              }
            }}
            className={`
              p-3 rounded-xl transition-all
              ${isPlaying 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white'
              }
            `}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          
          <button
            onClick={() => setCurrentTime(Math.min(selectedAnimation.duration, currentTime + 1/30))}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Next frame"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setCurrentTime(selectedAnimation.duration)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Go to end"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          
          <div className="w-px h-6 bg-white/10 mx-2" />
          
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-lg transition-colors ${
              isLooping ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={isLooping ? 'Looping enabled' : 'Enable loop'}
          >
            <Repeat className="w-5 h-5" />
          </button>
          
          {/* Speed control */}
          <div className="relative group">
            <button
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1"
              title="Playback speed"
            >
              <Zap className="w-4 h-4" />
              <span className="text-xs">{playbackSpeed}x</span>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
              <div className="bg-gray-900 border border-white/10 rounded-lg p-2 shadow-xl">
                {[0.25, 0.5, 1.0, 1.5, 2.0].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`block w-full px-3 py-1 text-sm rounded transition-colors ${
                      playbackSpeed === speed ? 'bg-violet-500/20 text-violet-400' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Animation info */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-xl">
          <div>
            <span className="text-xs text-gray-500">Duration</span>
            <p className="text-sm text-white">{selectedAnimation.duration.toFixed(2)}s</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Frames</span>
            <p className="text-sm text-white">{selectedAnimation.frameCount}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">FPS</span>
            <p className="text-sm text-white">{selectedAnimation.fps}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Skeleton</span>
            <p className="text-sm text-white truncate">{selectedAnimation.skeleton}</p>
          </div>
        </div>
        
        {/* Apply button */}
        <button
          onClick={() => playAnimation(selectedAnimation)}
          disabled={!isConnected || isApplying}
          className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Play on Selected Actor
            </>
          )}
        </button>
      </div>
    );
  };

  // Render blend space editor
  const renderBlendSpaceEditor = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Blend Space Editor</h4>
        <button className="px-3 py-1.5 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-colors flex items-center gap-1">
          <Plus className="w-4 h-4" />
          New Blend Space
        </button>
      </div>
      
      {/* 2D Blend Space visualization */}
      <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-white/10 relative">
        {/* Grid */}
        <div className="absolute inset-4 border border-white/10 rounded-lg">
          {/* Axis labels */}
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500">Speed</span>
          <span className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-500">Direction</span>
          
          {/* Sample points */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white" title="Idle" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white" title="Walk" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-4 h-4 bg-yellow-500 rounded-full border-2 border-white" title="Run" />
          
          {/* Current blend position */}
          <div 
            className="absolute w-6 h-6 bg-violet-500 rounded-full border-2 border-white shadow-lg shadow-violet-500/50 cursor-move"
            style={{
              left: `${50 + blendPosition.x * 50}%`,
              top: `${50 - blendPosition.y * 50}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
      </div>
      
      {/* Blend controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Speed (X)</label>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={blendPosition.x}
            onChange={(e) => setBlendPosition(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
          <span className="text-xs text-gray-500">{blendPosition.x.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Direction (Y)</label>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={blendPosition.y}
            onChange={(e) => setBlendPosition(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
          <span className="text-xs text-gray-500">{blendPosition.y.toFixed(2)}</span>
        </div>
      </div>
      
      {/* AI Suggestions */}
      <div className="p-3 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-violet-300">AI Suggestions</span>
        </div>
        <p className="text-xs text-gray-400">
          Based on your animations, consider adding a "Jog" animation at position (0.5, 0) for smoother transitions.
        </p>
      </div>
    </div>
  );

  // Render montage builder
  const renderMontageBuilder = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Animation Montage Builder</h4>
        <button className="px-3 py-1.5 bg-violet-500/20 text-violet-400 rounded-lg text-sm hover:bg-violet-500/30 transition-colors flex items-center gap-1">
          <Plus className="w-4 h-4" />
          New Montage
        </button>
      </div>
      
      {/* Timeline */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-white/10 p-4">
        <div className="space-y-3">
          {/* Track header */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-20">Track</span>
            <div className="flex-1 flex justify-between">
              <span>0:00</span>
              <span>1:00</span>
              <span>2:00</span>
              <span>3:00</span>
            </div>
          </div>
          
          {/* Animation track */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs text-gray-400">Anim</span>
            <div className="flex-1 h-10 bg-white/5 rounded-lg relative">
              {/* Sample sections */}
              <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-violet-500/30 rounded-l-lg border-r border-violet-500/50 flex items-center px-2">
                <span className="text-xs text-violet-300 truncate">Idle</span>
              </div>
              <div className="absolute left-1/3 top-0 bottom-0 w-1/3 bg-blue-500/30 border-r border-blue-500/50 flex items-center px-2">
                <span className="text-xs text-blue-300 truncate">Attack</span>
              </div>
              <div className="absolute left-2/3 top-0 bottom-0 w-1/3 bg-green-500/30 rounded-r-lg flex items-center px-2">
                <span className="text-xs text-green-300 truncate">Idle</span>
              </div>
            </div>
          </div>
          
          {/* Notify track */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs text-gray-400">Notifies</span>
            <div className="flex-1 h-6 bg-white/5 rounded-lg relative">
              {/* Sample notifies */}
              <div className="absolute left-[15%] top-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-500 rounded-full" title="Hit" />
              <div className="absolute left-[45%] top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full" title="Damage" />
              <div className="absolute left-[80%] top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full" title="End" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Section list */}
      <div className="space-y-2">
        <h5 className="text-xs text-gray-400 uppercase tracking-wider">Sections</h5>
        {['Default', 'Attack', 'Recovery'].map((section, i) => (
          <div key={section} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${
              i === 0 ? 'bg-violet-500' : i === 1 ? 'bg-blue-500' : 'bg-green-500'
            }`} />
            <span className="text-sm text-white flex-1">{section}</span>
            <button className="p-1 text-gray-500 hover:text-white">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      
      {/* Add section button */}
      <button className="w-full py-2 border border-dashed border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" />
        Add Section
      </button>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              Animation Assistant
              <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded-full">
                AI-Powered
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              {isConnected ? 'Browse, preview, and apply animations' : 'Connect to UE5 to use'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title={viewMode === 'grid' ? 'List view' : 'Grid view'}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
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
        <div className="p-4">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {[
              { id: 'library', name: 'Library', icon: Folder },
              { id: 'preview', name: 'Preview', icon: Eye },
              { id: 'blend', name: 'Blend Space', icon: Shuffle },
              { id: 'montage', name: 'Montage', icon: Layers },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.name}</span>
              </button>
            ))}
          </div>

          {/* Library Tab */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              {/* Search and filters */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search animations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                </div>
              </div>

              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {ANIMATION_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                      activeCategory === cat.id
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <cat.icon className="w-4 h-4" />
                    <span className="text-sm">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Animation grid/list */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredAnimations.map(renderAnimationCard)}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAnimations.map(renderAnimationListItem)}
                </div>
              )}

              {filteredAnimations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No animations found</p>
                </div>
              )}
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && renderPreviewPanel()}

          {/* Blend Space Tab */}
          {activeTab === 'blend' && renderBlendSpaceEditor()}

          {/* Montage Tab */}
          {activeTab === 'montage' && renderMontageBuilder()}

          {/* Voice Commands Help */}
          <div className="mt-4 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-300">Voice Commands</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                'Play walk animation',
                'Blend idle to run',
                'Set speed to half',
                'Show combat animations',
                'Loop animation',
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

export default AnimationAssistant;
