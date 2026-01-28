/**
 * UE5 Landscape Voice Commands
 * Voice commands for Unreal Engine 5 landscape and terrain operations
 */

import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const ue5LandscapeCommands: CommandDefinition[] = [
  {
    id: 'ue5.create_landscape',
    patterns: ['create landscape', 'add landscape', 'new landscape'],
    intent: 'ue5.landscape.create',
    description: 'Create a new landscape',
    examples: ['create landscape', 'add landscape'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Creating landscape');
      voiceFeedbackService.playSound('processing');
      return { success: true, message: 'Landscape created', data: { action: 'create_landscape' } };
    }
  },
  {
    id: 'ue5.sculpt_landscape',
    patterns: ['sculpt landscape', 'sculpt terrain', 'raise terrain', 'lower terrain', 'smooth terrain'],
    intent: 'ue5.landscape.sculpt',
    description: 'Sculpt the landscape terrain',
    examples: ['sculpt landscape', 'raise terrain', 'smooth terrain'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Activating sculpt mode');
      return { success: true, message: 'Sculpt mode activated', data: { action: 'sculpt_landscape' } };
    }
  },
  {
    id: 'ue5.paint_landscape',
    patterns: ['paint landscape', 'paint terrain', 'paint landscape with {material}'],
    intent: 'ue5.landscape.paint',
    description: 'Paint landscape with materials',
    examples: ['paint landscape', 'paint landscape with grass'],
    category: 'ue5',
    handler: async (params, context) => {
      const material = params.material || 'default material';
      await voiceFeedbackService.speak(`Painting landscape with ${material}`);
      return { success: true, message: `Painting with ${material}`, data: { material, action: 'paint_landscape' } };
    }
  },
  {
    id: 'ue5.add_foliage',
    patterns: ['add foliage {foliage_type}', 'paint foliage {foliage_type}', 'place {foliage_type}'],
    intent: 'ue5.landscape.add_foliage',
    description: 'Add foliage to landscape',
    examples: ['add foliage trees', 'paint foliage grass', 'place rocks'],
    category: 'ue5',
    handler: async (params, context) => {
      const foliageType = params.foliage_type;
      await voiceFeedbackService.speak(`Adding ${foliageType} foliage`);
      voiceFeedbackService.playSound('processing');
      return { success: true, message: `Adding foliage: ${foliageType}`, data: { foliageType, action: 'add_foliage' } };
    }
  },
  {
    id: 'ue5.remove_foliage',
    patterns: ['remove foliage', 'clear foliage', 'delete foliage'],
    intent: 'ue5.landscape.remove_foliage',
    description: 'Remove foliage from landscape',
    examples: ['remove foliage', 'clear foliage'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Removing foliage');
      return { success: true, message: 'Foliage removed', data: { action: 'remove_foliage' } };
    }
  },
  {
    id: 'ue5.flatten_landscape',
    patterns: ['flatten landscape', 'flatten terrain', 'level terrain'],
    intent: 'ue5.landscape.flatten',
    description: 'Flatten landscape terrain',
    examples: ['flatten landscape', 'level terrain'],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Flattening terrain');
      return { success: true, message: 'Terrain flattened', data: { action: 'flatten_landscape' } };
    }
  },
  {
    id: 'ue5.import_heightmap',
    patterns: ['import heightmap', 'import heightmap {file_path}', 'load heightmap'],
    intent: 'ue5.landscape.import_heightmap',
    description: 'Import a heightmap for landscape',
    examples: ['import heightmap', 'import heightmap terrain.png'],
    category: 'ue5',
    handler: async (params, context) => {
      const filePath = params.file_path || 'heightmap file';
      await voiceFeedbackService.speak('Importing heightmap');
      voiceFeedbackService.playSound('processing');
      return { success: true, message: `Importing: ${filePath}`, data: { filePath, action: 'import_heightmap' } };
    }
  },
  {
    id: 'ue5.export_heightmap',
    patterns: ['export heightmap', 'export heightmap to {file_path}', 'save heightmap'],
    intent: 'ue5.landscape.export_heightmap',
    description: 'Export landscape heightmap',
    examples: ['export heightmap', 'save heightmap'],
    category: 'ue5',
    handler: async (params, context) => {
      const filePath = params.file_path || 'heightmap.png';
      await voiceFeedbackService.speak('Exporting heightmap');
      voiceFeedbackService.playSound('processing');
      return { success: true, message: `Exporting to: ${filePath}`, data: { filePath, action: 'export_heightmap' } };
    }
  }
];
