import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const ue5AdvancedCommands: CommandDefinition[] = [
  {
    id: 'ue5.add_volumetric_fog',
    patterns: ['add volumetric fog', 'enable volumetric fog', 'create fog'],
    intent: 'ue5.lighting.volumetric_fog',
    description: 'Add volumetric fog to the scene',
    examples: ['add volumetric fog', 'enable volumetric fog'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Adding volumetric fog');
      voiceFeedbackService.playSound('success');
      return { success: true, message: 'Volumetric fog added', data: { action: 'add_volumetric_fog' } };
    }
  },
  {
    id: 'ue5.add_post_process_volume',
    patterns: ['add post process volume', 'create post process', 'add ppv'],
    intent: 'ue5.postprocess.add_volume',
    description: 'Add a post-process volume',
    examples: ['add post process volume', 'create post process'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Adding post process volume');
      voiceFeedbackService.playSound('success');
      return { success: true, message: 'Post-process volume added', data: { action: 'add_post_process_volume' } };
    }
  },
  {
    id: 'ue5.enable_bloom',
    patterns: ['enable bloom', 'add bloom', 'bloom on'],
    intent: 'ue5.postprocess.bloom',
    description: 'Enable bloom effect',
    examples: ['enable bloom', 'add bloom'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Enabling bloom');
      return { success: true, message: 'Bloom enabled', data: { action: 'enable_bloom' } };
    }
  },
  {
    id: 'ue5.enable_motion_blur',
    patterns: ['enable motion blur', 'add motion blur', 'motion blur on'],
    intent: 'ue5.postprocess.motion_blur',
    description: 'Enable motion blur effect',
    examples: ['enable motion blur', 'add motion blur'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Enabling motion blur');
      return { success: true, message: 'Motion blur enabled', data: { action: 'enable_motion_blur' } };
    }
  },
  {
    id: 'ue5.enable_ambient_occlusion',
    patterns: ['enable ambient occlusion', 'add ao', 'ambient occlusion on'],
    intent: 'ue5.postprocess.ao',
    description: 'Enable ambient occlusion',
    examples: ['enable ambient occlusion', 'add ao'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Enabling ambient occlusion');
      return { success: true, message: 'Ambient occlusion enabled', data: { action: 'enable_ambient_occlusion' } };
    }
  }
];
