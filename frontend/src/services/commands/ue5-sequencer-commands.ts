import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const ue5SequencerCommands: CommandDefinition[] = [
  {
    id: 'ue5.create_sequence',
    patterns: ['create sequence', 'new sequence'],
    intent: 'ue5.sequencer.create',
    description: 'Create a new Level Sequence',
    examples: ['create sequence'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Creating sequence');
      return { success: true, message: 'Sequence created', data: { action: 'create_sequence' } };
    }
  },
  {
    id: 'ue5.play_sequence',
    patterns: ['play sequence', 'start playback'],
    intent: 'ue5.sequencer.play',
    description: 'Play the current sequence',
    examples: ['play sequence'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Playing sequence');
      return { success: true, message: 'Sequence playing', data: { action: 'play_sequence' } };
    }
  },
  {
    id: 'ue5.add_keyframe',
    patterns: ['add keyframe', 'set keyframe'],
    intent: 'ue5.sequencer.add_keyframe',
    description: 'Add a keyframe at current time',
    examples: ['add keyframe'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Adding keyframe');
      return { success: true, message: 'Keyframe added', data: { action: 'add_keyframe' } };
    }
  }
];
