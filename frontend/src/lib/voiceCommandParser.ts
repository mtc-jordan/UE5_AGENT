/**
 * Voice Command Parser for UE5 AI Agent
 * 
 * Comprehensive voice command system that routes commands to all platform features:
 * - Scene Builder
 * - Lighting Wizard
 * - Animation Assistant
 * - Blueprint & Material Assistant
 * - Texture Generator
 * - Performance Optimizer
 * - Asset Manager
 * - Viewport Preview
 * - General UE5 Commands
 */

// Command categories
export type CommandCategory = 
  | 'scene'
  | 'lighting'
  | 'animation'
  | 'material'
  | 'blueprint'
  | 'texture'
  | 'performance'
  | 'asset'
  | 'viewport'
  | 'general'
  | 'navigation'
  | 'selection'
  | 'transform'
  | 'collaboration'
  | 'scene_generation';

// Parsed command result
export interface ParsedCommand {
  category: CommandCategory;
  action: string;
  parameters: Record<string, any>;
  confidence: number;
  originalText: string;
  suggestion?: string;
}

// Command pattern definition
interface CommandPattern {
  pattern: RegExp;
  category: CommandCategory;
  action: string;
  extractParams?: (match: RegExpMatchArray) => Record<string, any>;
}

// ==================== COMMAND PATTERNS ====================

const COMMAND_PATTERNS: CommandPattern[] = [
  // ==================== SCENE BUILDER ====================
  {
    pattern: /(?:create|build|make|generate)\s+(?:a\s+)?(?:cozy\s+)?living\s*room/i,
    category: 'scene',
    action: 'createScene',
    extractParams: () => ({ template: 'cozy-living-room' })
  },
  {
    pattern: /(?:create|build|make|generate)\s+(?:a\s+)?(?:modern\s+)?bedroom/i,
    category: 'scene',
    action: 'createScene',
    extractParams: () => ({ template: 'modern-bedroom' })
  },
  {
    pattern: /(?:create|build|make|generate)\s+(?:a\s+)?(?:home\s+)?office/i,
    category: 'scene',
    action: 'createScene',
    extractParams: () => ({ template: 'home-office' })
  },
  {
    pattern: /(?:create|build|make|generate)\s+(?:a\s+)?dining\s*(?:room|area)?/i,
    category: 'scene',
    action: 'createScene',
    extractParams: () => ({ template: 'dining-area' })
  },
  {
    pattern: /(?:create|build|make|generate)\s+(?:a\s+)?reading\s*(?:nook|corner)/i,
    category: 'scene',
    action: 'createScene',
    extractParams: () => ({ template: 'reading-nook' })
  },
  {
    pattern: /(?:create|build|make|generate)\s+(?:an?\s+)?entertainment\s*(?:setup|room|area)?/i,
    category: 'scene',
    action: 'createScene',
    extractParams: () => ({ template: 'entertainment-setup' })
  },
  {
    pattern: /(?:plan|design|layout)\s+(?:the\s+)?scene/i,
    category: 'scene',
    action: 'planScene',
    extractParams: () => ({})
  },
  {
    pattern: /clear\s+(?:the\s+)?scene/i,
    category: 'scene',
    action: 'clearScene',
    extractParams: () => ({})
  },

  // ==================== LIGHTING WIZARD ====================
  {
    pattern: /(?:set\s*up|create|add|apply)\s+(?:a\s+)?(?:three[\s-]?point|3[\s-]?point)\s+lighting/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'three-point' })
  },
  {
    pattern: /(?:set\s*up|create|add|apply)\s+(?:a\s+)?studio\s+lighting/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'soft-studio' })
  },
  {
    pattern: /(?:set\s*up|create|add|apply)\s+(?:a\s+)?dramatic\s+(?:studio\s+)?lighting/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'dramatic-studio' })
  },
  {
    pattern: /(?:golden\s*hour|sunset)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'golden-hour' })
  },
  {
    pattern: /(?:sunny|bright)\s*(?:day)?\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'sunny-day' })
  },
  {
    pattern: /(?:overcast|cloudy)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'overcast' })
  },
  {
    pattern: /(?:moonlit|moonlight|night)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'moonlit-night' })
  },
  {
    pattern: /(?:film\s*noir|noir)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'film-noir' })
  },
  {
    pattern: /(?:blockbuster|hollywood|action)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'blockbuster' })
  },
  {
    pattern: /(?:sci[\s-]?fi|futuristic|neon)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'sci-fi' })
  },
  {
    pattern: /(?:romantic|intimate)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'romantic' })
  },
  {
    pattern: /(?:horror|scary|dark)\s*(?:atmosphere|lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'horror' })
  },
  {
    pattern: /(?:peaceful|calm|serene)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'peaceful' })
  },
  {
    pattern: /(?:mysterious|enigmatic)\s*(?:lighting)?/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'mysterious' })
  },
  {
    pattern: /(?:make\s+it|set)\s+(?:more\s+)?cinematic/i,
    category: 'lighting',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'blockbuster' })
  },
  {
    pattern: /(?:time|set\s+time)\s+(?:to\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
    category: 'lighting',
    action: 'setTimeOfDay',
    extractParams: (match) => {
      let hour = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3]?.toLowerCase();
      
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      
      return { hour, minutes };
    }
  },
  {
    pattern: /(?:time\s+to\s+)?(?:midnight|12\s*am)/i,
    category: 'lighting',
    action: 'setTimeOfDay',
    extractParams: () => ({ hour: 0, minutes: 0 })
  },
  {
    pattern: /(?:time\s+to\s+)?(?:dawn|sunrise|6\s*am)/i,
    category: 'lighting',
    action: 'setTimeOfDay',
    extractParams: () => ({ hour: 6, minutes: 0 })
  },
  {
    pattern: /(?:time\s+to\s+)?(?:morning|9\s*am)/i,
    category: 'lighting',
    action: 'setTimeOfDay',
    extractParams: () => ({ hour: 9, minutes: 0 })
  },
  {
    pattern: /(?:time\s+to\s+)?(?:noon|midday|12\s*pm)/i,
    category: 'lighting',
    action: 'setTimeOfDay',
    extractParams: () => ({ hour: 12, minutes: 0 })
  },
  {
    pattern: /(?:time\s+to\s+)?(?:dusk|evening|6\s*pm)/i,
    category: 'lighting',
    action: 'setTimeOfDay',
    extractParams: () => ({ hour: 18, minutes: 0 })
  },

  // ==================== ANIMATION ASSISTANT ====================
  {
    pattern: /(?:play|start|run)\s+(?:the\s+)?(\w+)\s+animation/i,
    category: 'animation',
    action: 'playAnimation',
    extractParams: (match) => ({ animationName: match[1].toLowerCase() })
  },
  {
    pattern: /(?:stop|pause)\s+(?:the\s+)?animation/i,
    category: 'animation',
    action: 'stopAnimation',
    extractParams: () => ({})
  },
  {
    pattern: /(?:loop|repeat)\s+(?:the\s+)?animation/i,
    category: 'animation',
    action: 'setLoop',
    extractParams: () => ({ loop: true })
  },
  {
    pattern: /(?:don't\s+loop|stop\s+looping|no\s+loop)/i,
    category: 'animation',
    action: 'setLoop',
    extractParams: () => ({ loop: false })
  },
  {
    pattern: /(?:set\s+)?(?:animation\s+)?speed\s+(?:to\s+)?(?:(\d+(?:\.\d+)?)|half|double|normal)/i,
    category: 'animation',
    action: 'setSpeed',
    extractParams: (match) => {
      const value = match[1];
      if (value) return { speed: parseFloat(value) };
      if (match[0].includes('half')) return { speed: 0.5 };
      if (match[0].includes('double')) return { speed: 2.0 };
      return { speed: 1.0 };
    }
  },
  {
    pattern: /blend\s+(\w+)\s+(?:to|and|with)\s+(\w+)/i,
    category: 'animation',
    action: 'blendAnimations',
    extractParams: (match) => ({
      from: match[1].toLowerCase(),
      to: match[2].toLowerCase()
    })
  },
  {
    pattern: /show\s+(?:all\s+)?(\w+)\s+animations?/i,
    category: 'animation',
    action: 'filterAnimations',
    extractParams: (match) => ({ category: match[1].toLowerCase() })
  },
  {
    pattern: /(?:create|make)\s+(?:a\s+)?(?:animation\s+)?montage/i,
    category: 'animation',
    action: 'createMontage',
    extractParams: () => ({})
  },
  {
    pattern: /(?:next|previous|forward|back)\s+frame/i,
    category: 'animation',
    action: 'stepFrame',
    extractParams: (match) => ({
      direction: match[0].includes('next') || match[0].includes('forward') ? 1 : -1
    })
  },

  // ==================== MATERIAL & BLUEPRINT ====================
  {
    pattern: /(?:create|make|generate)\s+(?:a\s+)?(?:glowing|glow)\s+material/i,
    category: 'material',
    action: 'createMaterial',
    extractParams: () => ({ template: 'proximity-glow' })
  },
  {
    pattern: /(?:create|make|generate)\s+(?:a\s+)?(?:pulsing|pulse)\s+(?:emissive\s+)?material/i,
    category: 'material',
    action: 'createMaterial',
    extractParams: () => ({ template: 'pulsing-emissive' })
  },
  {
    pattern: /(?:create|make|generate)\s+(?:a\s+)?(?:scrolling|scroll)\s+(?:texture\s+)?material/i,
    category: 'material',
    action: 'createMaterial',
    extractParams: () => ({ template: 'scrolling-texture' })
  },
  {
    pattern: /(?:create|make|generate)\s+(?:a\s+)?(?:fresnel|rim\s*light)\s+material/i,
    category: 'material',
    action: 'createMaterial',
    extractParams: () => ({ template: 'fresnel-rim' })
  },
  {
    pattern: /(?:create|make|generate)\s+(?:a\s+)?(?:dissolve|disintegration)\s+(?:effect\s+)?material/i,
    category: 'material',
    action: 'createMaterial',
    extractParams: () => ({ template: 'dissolve' })
  },
  {
    pattern: /(?:create|make|generate)\s+(?:a\s+)?(\w+)\s+(?:colored?\s+)?material/i,
    category: 'material',
    action: 'createMaterial',
    extractParams: (match) => ({ color: match[1].toLowerCase() })
  },
  {
    pattern: /(?:create|make|generate)\s+(?:a\s+)?blueprint\s+(?:for\s+)?(\w+)/i,
    category: 'blueprint',
    action: 'createBlueprint',
    extractParams: (match) => ({ type: match[1].toLowerCase() })
  },
  {
    pattern: /(?:open|edit)\s+(?:the\s+)?blueprint\s+editor/i,
    category: 'blueprint',
    action: 'openEditor',
    extractParams: () => ({})
  },

  // ==================== TEXTURE GENERATOR ====================
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?(?:rusty|rust)\s+(?:metal\s+)?texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'rusty-metal', prompt: 'rusty weathered metal' })
  },
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?(?:polished\s+)?metal\s+texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'polished-metal', prompt: 'polished metal surface' })
  },
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?wood(?:en)?\s+texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'wood', prompt: 'natural wood grain' })
  },
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?stone\s+texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'stone', prompt: 'rough stone surface' })
  },
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?concrete\s+texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'concrete', prompt: 'concrete surface' })
  },
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?fabric\s+texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'fabric', prompt: 'woven fabric texture' })
  },
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?leather\s+texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'leather', prompt: 'leather texture' })
  },
  {
    pattern: /(?:generate|create|make)\s+(?:a\s+)?glass\s+texture/i,
    category: 'texture',
    action: 'generateTexture',
    extractParams: () => ({ preset: 'glass', prompt: 'glass surface' })
  },
  {
    pattern: /(?:set\s+)?texture\s+resolution\s+(?:to\s+)?(\d+)/i,
    category: 'texture',
    action: 'setResolution',
    extractParams: (match) => ({ resolution: parseInt(match[1]) })
  },

  // ==================== PERFORMANCE OPTIMIZER ====================
  {
    pattern: /(?:analyze|check|scan)\s+(?:the\s+)?(?:scene\s+)?performance/i,
    category: 'performance',
    action: 'analyzePerformance',
    extractParams: () => ({})
  },
  {
    pattern: /(?:optimize|improve)\s+(?:for\s+)?(?:pc|desktop)\s*(?:ultra)?/i,
    category: 'performance',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'pc-ultra' })
  },
  {
    pattern: /(?:optimize|improve)\s+(?:for\s+)?(?:pc|desktop)\s*high/i,
    category: 'performance',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'pc-high' })
  },
  {
    pattern: /(?:optimize|improve)\s+(?:for\s+)?console/i,
    category: 'performance',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'console' })
  },
  {
    pattern: /(?:optimize|improve)\s+(?:for\s+)?mobile/i,
    category: 'performance',
    action: 'applyPreset',
    extractParams: () => ({ preset: 'mobile' })
  },
  {
    pattern: /(?:show|view)\s+(?:the\s+)?(?:performance\s+)?bottlenecks/i,
    category: 'performance',
    action: 'showBottlenecks',
    extractParams: () => ({})
  },
  {
    pattern: /(?:auto[\s-]?optimize|quick\s+optimize)/i,
    category: 'performance',
    action: 'autoOptimize',
    extractParams: () => ({})
  },

  // ==================== ASSET MANAGER ====================
  {
    pattern: /(?:scan|index)\s+(?:all\s+)?assets/i,
    category: 'asset',
    action: 'scanAssets',
    extractParams: () => ({})
  },
  {
    pattern: /(?:find|search|show)\s+(?:all\s+)?(?:unused|orphan)\s+(?:assets|textures|meshes)?/i,
    category: 'asset',
    action: 'findUnused',
    extractParams: () => ({})
  },
  {
    pattern: /(?:find|search|show)\s+(?:all\s+)?duplicate\s+(?:assets|textures|meshes)?/i,
    category: 'asset',
    action: 'findDuplicates',
    extractParams: () => ({})
  },
  {
    pattern: /(?:find|search|show)\s+(?:all\s+)?(\w+)\s+(?:materials?|textures?|meshes?|assets?)/i,
    category: 'asset',
    action: 'searchAssets',
    extractParams: (match) => ({ query: match[1].toLowerCase() })
  },
  {
    pattern: /(?:organize|sort|clean\s*up)\s+(?:the\s+)?assets/i,
    category: 'asset',
    action: 'organizeAssets',
    extractParams: () => ({})
  },
  {
    pattern: /(?:show|list)\s+(?:asset\s+)?issues/i,
    category: 'asset',
    action: 'showIssues',
    extractParams: () => ({})
  },

  // ==================== VIEWPORT PREVIEW ====================
  {
    pattern: /(?:take|capture)\s+(?:a\s+)?screenshot/i,
    category: 'viewport',
    action: 'captureScreenshot',
    extractParams: () => ({})
  },
  {
    pattern: /(?:enable|start|turn\s+on)\s+auto[\s-]?capture/i,
    category: 'viewport',
    action: 'setAutoCapture',
    extractParams: () => ({ enabled: true })
  },
  {
    pattern: /(?:disable|stop|turn\s+off)\s+auto[\s-]?capture/i,
    category: 'viewport',
    action: 'setAutoCapture',
    extractParams: () => ({ enabled: false })
  },
  {
    pattern: /(?:compare|diff)\s+(?:the\s+)?screenshots/i,
    category: 'viewport',
    action: 'compareScreenshots',
    extractParams: () => ({})
  },
  {
    pattern: /(?:clear|delete)\s+(?:all\s+)?screenshots/i,
    category: 'viewport',
    action: 'clearScreenshots',
    extractParams: () => ({})
  },

  // ==================== GENERAL UE5 COMMANDS ====================
  {
    pattern: /(?:spawn|create|add)\s+(?:a\s+)?(?:(\w+)\s+)?cube(?:\s+at\s+(?:the\s+)?(\w+))?/i,
    category: 'general',
    action: 'spawnActor',
    extractParams: (match) => ({
      type: 'cube',
      color: match[1]?.toLowerCase(),
      position: match[2]?.toLowerCase() || 'origin'
    })
  },
  {
    pattern: /(?:spawn|create|add)\s+(?:a\s+)?(?:(\w+)\s+)?sphere(?:\s+at\s+(?:the\s+)?(\w+))?/i,
    category: 'general',
    action: 'spawnActor',
    extractParams: (match) => ({
      type: 'sphere',
      color: match[1]?.toLowerCase(),
      position: match[2]?.toLowerCase() || 'origin'
    })
  },
  {
    pattern: /(?:spawn|create|add)\s+(?:a\s+)?(?:(\w+)\s+)?cylinder(?:\s+at\s+(?:the\s+)?(\w+))?/i,
    category: 'general',
    action: 'spawnActor',
    extractParams: (match) => ({
      type: 'cylinder',
      color: match[1]?.toLowerCase(),
      position: match[2]?.toLowerCase() || 'origin'
    })
  },
  {
    pattern: /(?:spawn|create|add)\s+(?:a\s+)?(?:point\s+)?light(?:\s+(?:at|above|below)\s+(?:the\s+)?(\w+))?/i,
    category: 'general',
    action: 'spawnLight',
    extractParams: (match) => ({
      type: 'point',
      position: match[1]?.toLowerCase()
    })
  },
  {
    pattern: /(?:spawn|create|add)\s+(?:a\s+)?(?:spot\s+)?light/i,
    category: 'general',
    action: 'spawnLight',
    extractParams: () => ({ type: 'spot' })
  },
  {
    pattern: /(?:spawn|create|add)\s+(?:a\s+)?directional\s+light/i,
    category: 'general',
    action: 'spawnLight',
    extractParams: () => ({ type: 'directional' })
  },

  // ==================== SELECTION ====================
  {
    pattern: /(?:select|pick)\s+(?:all|everything)/i,
    category: 'selection',
    action: 'selectAll',
    extractParams: () => ({})
  },
  {
    pattern: /(?:deselect|clear\s+selection|unselect)\s*(?:all)?/i,
    category: 'selection',
    action: 'deselectAll',
    extractParams: () => ({})
  },
  {
    pattern: /(?:delete|remove)\s+(?:the\s+)?selection/i,
    category: 'selection',
    action: 'deleteSelection',
    extractParams: () => ({})
  },
  {
    pattern: /(?:duplicate|copy)\s+(?:the\s+)?selection/i,
    category: 'selection',
    action: 'duplicateSelection',
    extractParams: () => ({})
  },
  {
    pattern: /(?:group|combine)\s+(?:the\s+)?selection/i,
    category: 'selection',
    action: 'groupSelection',
    extractParams: () => ({})
  },

  // ==================== TRANSFORM ====================
  {
    pattern: /(?:rotate|turn)\s+(?:the\s+)?(?:selection\s+)?(\d+)\s*(?:degrees?)?/i,
    category: 'transform',
    action: 'rotate',
    extractParams: (match) => ({ angle: parseFloat(match[1]) })
  },
  {
    pattern: /(?:scale|resize)\s+(?:the\s+)?(?:selection\s+)?(?:by\s+)?(\d+(?:\.\d+)?)/i,
    category: 'transform',
    action: 'scale',
    extractParams: (match) => ({ factor: parseFloat(match[1]) })
  },
  {
    parameter: /(?:move|translate)\s+(?:the\s+)?(?:selection\s+)?(?:to\s+)?(?:the\s+)?(\w+)/i,
    category: 'transform',
    action: 'move',
    extractParams: (match) => ({ position: match[1].toLowerCase() })
  },
  {
    pattern: /(?:reset|zero)\s+(?:the\s+)?transform/i,
    category: 'transform',
    action: 'resetTransform',
    extractParams: () => ({})
  },

  // ==================== NAVIGATION ====================
  {
    pattern: /(?:undo|go\s+back)/i,
    category: 'navigation',
    action: 'undo',
    extractParams: () => ({})
  },
  {
    pattern: /(?:redo|go\s+forward)/i,
    category: 'navigation',
    action: 'redo',
    extractParams: () => ({})
  },
  {
    pattern: /(?:save|save\s+level|save\s+all)/i,
    category: 'navigation',
    action: 'save',
    extractParams: () => ({})
  },
  {
    pattern: /(?:play|start)\s+(?:the\s+)?game/i,
    category: 'navigation',
    action: 'playGame',
    extractParams: () => ({})
  },
  {
    pattern: /(?:stop|end)\s+(?:the\s+)?game/i,
    category: 'navigation',
    action: 'stopGame',
    extractParams: () => ({})
  },
  {
    pattern: /(?:focus|zoom)\s+(?:on\s+)?(?:the\s+)?selection/i,
    category: 'navigation',
    action: 'focusSelection',
    extractParams: () => ({})
  },

  // ==================== COLLABORATION ====================
  {
    pattern: /(?:who'?s|who\s+is)\s+online/i,
    category: 'collaboration',
    action: 'listOnlineUsers',
    extractParams: () => ({})
  },
  {
    pattern: /(?:share|stream)\s+(?:my\s+)?viewport/i,
    category: 'collaboration',
    action: 'shareViewport',
    extractParams: () => ({})
  },
  {
    pattern: /(?:stop\s+)?sharing\s+(?:my\s+)?viewport/i,
    category: 'collaboration',
    action: 'stopSharingViewport',
    extractParams: () => ({})
  },
  {
    pattern: /follow\s+(\w+)/i,
    category: 'collaboration',
    action: 'followUser',
    extractParams: (match) => ({ userName: match[1] })
  },
  {
    pattern: /stop\s+following/i,
    category: 'collaboration',
    action: 'stopFollowing',
    extractParams: () => ({})
  },
  {
    pattern: /(?:lock|claim)\s+(?:this\s+)?(?:actor|selection)/i,
    category: 'collaboration',
    action: 'lockActor',
    extractParams: () => ({})
  },
  {
    pattern: /unlock\s+(?:this\s+)?(?:actor|selection)/i,
    category: 'collaboration',
    action: 'unlockActor',
    extractParams: () => ({})
  },
  {
    pattern: /(?:send|share)\s+screenshot\s+(?:to\s+)?(?:the\s+)?team/i,
    category: 'collaboration',
    action: 'shareScreenshot',
    extractParams: () => ({})
  },
  {
    pattern: /(?:show|view)\s+(?:team\s+)?activity/i,
    category: 'collaboration',
    action: 'showActivity',
    extractParams: () => ({})
  },
  {
    pattern: /(?:open|show)\s+(?:team\s+)?chat/i,
    category: 'collaboration',
    action: 'openChat',
    extractParams: () => ({})
  },
  {
    pattern: /(?:invite|add)\s+(?:a\s+)?(?:team\s+)?member/i,
    category: 'collaboration',
    action: 'inviteMember',
    extractParams: () => ({})
  },
  {
    pattern: /(?:highlight|show)\s+(?:my\s+)?selection\s+(?:to\s+)?(?:the\s+)?team/i,
    category: 'collaboration',
    action: 'highlightSelection',
    extractParams: () => ({})
  },

  // ==================== AI SCENE GENERATION ====================
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:medieval\s+)?castle(?:\s+(?:courtyard|scene))?/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'medieval-castle', prompt: 'medieval castle courtyard' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:sci-?fi\s+)?(?:spaceship|space\s+ship)(?:\s+(?:interior|bridge))?/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'scifi-spaceship', prompt: 'sci-fi spaceship interior' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:enchanted\s+)?forest(?:\s+(?:clearing|scene))?/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'forest-clearing', prompt: 'enchanted forest clearing' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:modern\s+)?office(?:\s+(?:space|scene))?/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'modern-office', prompt: 'modern office space' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:cozy\s+)?(?:mountain\s+)?cabin/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'cozy-cabin', prompt: 'cozy mountain cabin' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:underwater\s+)?(?:ancient\s+)?ruins/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'underwater-ruins', prompt: 'underwater ancient ruins' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?cyberpunk(?:\s+(?:city|alley|scene))?/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'cyberpunk-alley', prompt: 'cyberpunk city alley' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?desert(?:\s+oasis)?/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'desert-oasis', prompt: 'desert oasis' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:battle\s+)?arena/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'battle-arena', prompt: 'battle arena' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:racing\s+)?track/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'racing-track', prompt: 'racing track' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:luxury\s+)?penthouse/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'luxury-penthouse', prompt: 'luxury penthouse' })
  },
  {
    pattern: /(?:generate|create|build)\s+(?:a\s+)?(?:volcanic\s+)?cave/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: () => ({ template: 'volcanic-cave', prompt: 'volcanic cave' })
  },
  {
    pattern: /(?:generate|create)\s+(?:a\s+)?scene\s+(?:with|from|about)\s+(.+)/i,
    category: 'scene_generation',
    action: 'generateScene',
    extractParams: (match) => ({ prompt: match[1].trim() })
  },
  {
    pattern: /(?:ai\s+)?(?:generate|create)\s+(?:entire\s+)?scene/i,
    category: 'scene_generation',
    action: 'openGenerator',
    extractParams: () => ({})
  },
  {
    pattern: /(?:set\s+)?(?:scene\s+)?style\s+(?:to\s+)?(realistic|stylized|low[\s-]?poly|cartoon)/i,
    category: 'scene_generation',
    action: 'setStyle',
    extractParams: (match) => ({ style: match[1].toLowerCase().replace(/[\s-]/g, '-') })
  },
  {
    pattern: /(?:set\s+)?(?:scene\s+)?mood\s+(?:to\s+)?(peaceful|dramatic|mysterious|cheerful|dark|romantic)/i,
    category: 'scene_generation',
    action: 'setMood',
    extractParams: (match) => ({ mood: match[1].toLowerCase() })
  },
  {
    pattern: /(?:set\s+)?weather\s+(?:to\s+)?(clear|cloudy|rainy|foggy|snowy|stormy)/i,
    category: 'scene_generation',
    action: 'setWeather',
    extractParams: (match) => ({ weather: match[1].toLowerCase() })
  },
  {
    pattern: /(?:start|begin)\s+(?:scene\s+)?generation/i,
    category: 'scene_generation',
    action: 'startGeneration',
    extractParams: () => ({})
  },
  {
    pattern: /(?:cancel|stop)\s+(?:scene\s+)?generation/i,
    category: 'scene_generation',
    action: 'cancelGeneration',
    extractParams: () => ({})
  },
  {
    pattern: /(?:preview|show)\s+(?:the\s+)?(?:scene\s+)?plan/i,
    category: 'scene_generation',
    action: 'previewPlan',
    extractParams: () => ({})
  },
];

// ==================== VOICE COMMAND EXAMPLES BY CATEGORY ====================

export const VOICE_COMMAND_EXAMPLES: Record<CommandCategory, string[]> = {
  scene: [
    "Create a cozy living room",
    "Build a modern bedroom",
    "Generate a home office",
    "Plan the scene",
    "Clear the scene",
  ],
  lighting: [
    "Set up studio lighting",
    "Golden hour lighting",
    "Make it cinematic",
    "Horror atmosphere",
    "Time to 6 PM",
    "Sunset lighting",
    "Moonlit night",
  ],
  animation: [
    "Play walk animation",
    "Blend idle to run",
    "Set speed to half",
    "Show combat animations",
    "Loop the animation",
    "Stop animation",
    "Create montage",
  ],
  material: [
    "Create a glowing material",
    "Make a pulsing emissive material",
    "Generate a red material",
    "Create dissolve effect material",
  ],
  blueprint: [
    "Create a blueprint for door",
    "Open blueprint editor",
  ],
  texture: [
    "Generate rusty metal texture",
    "Create wood texture",
    "Make stone texture",
    "Set texture resolution to 1024",
  ],
  performance: [
    "Analyze performance",
    "Optimize for PC Ultra",
    "Optimize for mobile",
    "Show bottlenecks",
    "Auto optimize",
  ],
  asset: [
    "Scan all assets",
    "Find unused textures",
    "Find duplicate assets",
    "Show metal materials",
    "Organize assets",
  ],
  viewport: [
    "Take a screenshot",
    "Enable auto capture",
    "Compare screenshots",
    "Clear screenshots",
  ],
  general: [
    "Spawn a red cube",
    "Add a point light above",
    "Create a sphere",
  ],
  navigation: [
    "Undo",
    "Redo",
    "Save level",
    "Play game",
    "Stop game",
  ],
  selection: [
    "Select all",
    "Deselect all",
    "Delete selection",
    "Duplicate selection",
  ],
  transform: [
    "Rotate 45 degrees",
    "Scale by 2",
    "Reset transform",
  ],
  collaboration: [
    "Who's online",
    "Share my viewport",
    "Follow Sarah",
    "Stop following",
    "Lock this actor",
    "Unlock actor",
    "Send screenshot to team",
    "Show team activity",
    "Open team chat",
    "Invite team member",
    "Highlight my selection",
  ],
  scene_generation: [
    "Generate a medieval castle",
    "Create a sci-fi spaceship interior",
    "Build an enchanted forest",
    "Generate a cyberpunk alley",
    "Create a scene with dragons and mountains",
    "Set style to realistic",
    "Set mood to dramatic",
    "Set weather to rainy",
    "Start generation",
    "Preview the plan",
  ],
};

// ==================== PARSER FUNCTION ====================

export function parseVoiceCommand(text: string): ParsedCommand | null {
  const normalizedText = text.toLowerCase().trim();
  
  for (const pattern of COMMAND_PATTERNS) {
    const match = normalizedText.match(pattern.pattern);
    if (match) {
      const params = pattern.extractParams ? pattern.extractParams(match) : {};
      return {
        category: pattern.category,
        action: pattern.action,
        parameters: params,
        confidence: 1.0,
        originalText: text,
      };
    }
  }
  
  // No exact match found - return null to let AI handle it
  return null;
}

// ==================== GET ALL EXAMPLES ====================

export function getAllVoiceExamples(): string[] {
  const allExamples: string[] = [];
  Object.values(VOICE_COMMAND_EXAMPLES).forEach(examples => {
    allExamples.push(...examples);
  });
  return allExamples;
}

// ==================== GET EXAMPLES BY CATEGORY ====================

export function getExamplesByCategory(category: CommandCategory): string[] {
  return VOICE_COMMAND_EXAMPLES[category] || [];
}

// ==================== CATEGORY DISPLAY NAMES ====================

export const CATEGORY_DISPLAY_NAMES: Record<CommandCategory, string> = {
  scene: '🏠 Scene Builder',
  lighting: '💡 Lighting Wizard',
  animation: '🎬 Animation',
  material: '🎨 Materials',
  blueprint: '📐 Blueprints',
  texture: '🖼️ Textures',
  performance: '📊 Performance',
  asset: '📦 Assets',
  viewport: '📷 Viewport',
  general: '🎮 General',
  navigation: '🧭 Navigation',
  selection: '✅ Selection',
  transform: '🔄 Transform',
  collaboration: '👥 Collaboration',
  scene_generation: '🪄 AI Scene Generator',
};

// ==================== SUGGEST SIMILAR COMMANDS ====================

export function suggestSimilarCommands(text: string): string[] {
  const normalizedText = text.toLowerCase();
  const suggestions: string[] = [];
  
  const allExamples = getAllVoiceExamples();
  
  // Simple word matching for suggestions
  const words = normalizedText.split(/\s+/);
  
  for (const example of allExamples) {
    const exampleLower = example.toLowerCase();
    for (const word of words) {
      if (word.length > 2 && exampleLower.includes(word)) {
        if (!suggestions.includes(example)) {
          suggestions.push(example);
        }
        break;
      }
    }
  }
  
  return suggestions.slice(0, 5);
}
