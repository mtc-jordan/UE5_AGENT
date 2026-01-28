/**
 * UE5 Level Voice Commands
 * Voice commands for Unreal Engine 5 level and scene operations
 */

import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const ue5LevelCommands: CommandDefinition[] = [
  {
    id: 'ue5.save_level',
    patterns: [
      'save level',
      'save scene',
      'save current level',
      'save the level'
    ],
    intent: 'ue5.level.save',
    description: 'Save the current UE5 level',
    examples: [
      'save level',
      'save scene',
      'save current level'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Saving level');
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: 'Level saved',
        data: { action: 'save_level' }
      };
    }
  },

  {
    id: 'ue5.play_in_editor',
    patterns: [
      'play in editor',
      'start play',
      'run game',
      'play',
      'start simulation'
    ],
    intent: 'ue5.level.play',
    description: 'Start Play in Editor (PIE)',
    examples: [
      'play in editor',
      'start play',
      'run game'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Starting play in editor');
      voiceFeedbackService.playSound('notification');
      
      return {
        success: true,
        message: 'Play in Editor started',
        data: { action: 'play_in_editor' }
      };
    }
  },

  {
    id: 'ue5.stop_play',
    patterns: [
      'stop play',
      'stop playing',
      'stop game',
      'stop simulation',
      'exit play mode'
    ],
    intent: 'ue5.level.stop',
    description: 'Stop Play in Editor',
    examples: [
      'stop play',
      'stop game',
      'exit play mode'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Stopping play in editor');
      voiceFeedbackService.playSound('notification');
      
      return {
        success: true,
        message: 'Play in Editor stopped',
        data: { action: 'stop_play' }
      };
    }
  },

  {
    id: 'ue5.undo',
    patterns: [
      'undo',
      'undo last action',
      'go back',
      'revert'
    ],
    intent: 'ue5.level.undo',
    description: 'Undo the last action in UE5',
    examples: [
      'undo',
      'undo last action',
      'go back'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Undoing');
      
      return {
        success: true,
        message: 'Action undone',
        data: { action: 'undo' }
      };
    }
  },

  {
    id: 'ue5.redo',
    patterns: [
      'redo',
      'redo last action',
      'go forward',
      'redo undo'
    ],
    intent: 'ue5.level.redo',
    description: 'Redo the last undone action',
    examples: [
      'redo',
      'redo last action',
      'go forward'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Redoing');
      
      return {
        success: true,
        message: 'Action redone',
        data: { action: 'redo' }
      };
    }
  },

  {
    id: 'ue5.take_screenshot',
    patterns: [
      'take screenshot',
      'take a screenshot',
      'capture viewport',
      'screenshot',
      'capture screen'
    ],
    intent: 'ue5.level.screenshot',
    description: 'Take a viewport screenshot',
    examples: [
      'take screenshot',
      'capture viewport',
      'screenshot'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Taking screenshot');
      voiceFeedbackService.playSound('notification');
      
      return {
        success: true,
        message: 'Screenshot captured',
        data: { action: 'take_screenshot' }
      };
    }
  },

  {
    id: 'ue5.set_time_of_day',
    patterns: [
      'set time to {time}',
      'set time of day to {time}',
      'change time to {time}',
      'make it {time}'
    ],
    intent: 'ue5.lighting.time',
    description: 'Set the time of day in the scene',
    examples: [
      'set time to 12',
      'set time of day to 18',
      'make it 6 AM'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const time = params.time;
      
      await voiceFeedbackService.speak(`Setting time to ${time}`);
      
      return {
        success: true,
        message: `Time set to ${time}`,
        data: { time, action: 'set_time_of_day' }
      };
    }
  },

  {
    id: 'ue5.set_weather',
    patterns: [
      'set weather to {weather}',
      'change weather to {weather}',
      'make it {weather}',
      'weather {weather}'
    ],
    intent: 'ue5.environment.weather',
    description: 'Set weather conditions',
    examples: [
      'set weather to sunny',
      'make it rainy',
      'weather cloudy'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const weather = params.weather;
      
      await voiceFeedbackService.speak(`Setting weather to ${weather}`);
      
      return {
        success: true,
        message: `Weather set to ${weather}`,
        data: { weather, action: 'set_weather' }
      };
    }
  },

  {
    id: 'ue5.build_lighting',
    patterns: [
      'build lighting',
      'rebuild lighting',
      'bake lighting',
      'calculate lighting'
    ],
    intent: 'ue5.lighting.build',
    description: 'Build/bake lighting for the level',
    examples: [
      'build lighting',
      'rebuild lighting',
      'bake lighting'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Building lighting');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: 'Lighting build started',
        data: { action: 'build_lighting' }
      };
    }
  },

  {
    id: 'ue5.clear_selection',
    patterns: [
      'clear selection',
      'deselect all',
      'unselect all',
      'clear all selections'
    ],
    intent: 'ue5.selection.clear',
    description: 'Clear all actor selections',
    examples: [
      'clear selection',
      'deselect all',
      'unselect all'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Clearing selection');
      
      return {
        success: true,
        message: 'Selection cleared',
        data: { action: 'clear_selection' }
      };
    }
  },

  {
    id: 'ue5.focus_viewport',
    patterns: [
      'focus on selected',
      'focus viewport',
      'zoom to selected',
      'frame selected'
    ],
    intent: 'ue5.viewport.focus',
    description: 'Focus viewport on selected actor',
    examples: [
      'focus on selected',
      'focus viewport',
      'zoom to selected'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Focusing viewport');
      
      return {
        success: true,
        message: 'Viewport focused',
        data: { action: 'focus_viewport' }
      };
    }
  },

  {
    id: 'ue5.set_viewport_mode',
    patterns: [
      'set viewport to {mode}',
      'change viewport mode to {mode}',
      'viewport {mode}',
      'show {mode}'
    ],
    intent: 'ue5.viewport.mode',
    description: 'Set viewport rendering mode',
    examples: [
      'set viewport to wireframe',
      'viewport lit',
      'show unlit'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const mode = params.mode;
      
      await voiceFeedbackService.speak(`Setting viewport to ${mode}`);
      
      return {
        success: true,
        message: `Viewport mode: ${mode}`,
        data: { mode, action: 'set_viewport_mode' }
      };
    }
  }
];
