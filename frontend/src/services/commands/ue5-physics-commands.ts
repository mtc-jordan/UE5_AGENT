import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const ue5PhysicsCommands: CommandDefinition[] = [
  {
    id: 'ue5.simulate_physics',
    patterns: ['simulate physics', 'enable physics', 'physics on'],
    intent: 'ue5.physics.simulate',
    description: 'Enable physics simulation',
    examples: ['simulate physics', 'enable physics'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Enabling physics simulation');
      return { success: true, message: 'Physics enabled', data: { action: 'simulate_physics' } };
    }
  },
  {
    id: 'ue5.stop_physics',
    patterns: ['stop physics', 'disable physics', 'physics off'],
    intent: 'ue5.physics.stop',
    description: 'Disable physics simulation',
    examples: ['stop physics', 'disable physics'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Stopping physics');
      return { success: true, message: 'Physics stopped', data: { action: 'stop_physics' } };
    }
  },
  {
    id: 'ue5.apply_force',
    patterns: ['apply force', 'add force'],
    intent: 'ue5.physics.apply_force',
    description: 'Apply force to selected actor',
    examples: ['apply force', 'add force'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Applying force');
      return { success: true, message: 'Force applied', data: { action: 'apply_force' } };
    }
  },
  {
    id: 'ue5.set_gravity',
    patterns: ['set gravity', 'change gravity'],
    intent: 'ue5.physics.set_gravity',
    description: 'Set world gravity',
    examples: ['set gravity', 'change gravity'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Setting gravity');
      return { success: true, message: 'Gravity set', data: { action: 'set_gravity' } };
    }
  }
];
