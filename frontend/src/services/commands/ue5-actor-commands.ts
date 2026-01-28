/**
 * UE5 Actor Voice Commands
 * Voice commands for Unreal Engine 5 actor operations
 */

import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const ue5ActorCommands: CommandDefinition[] = [
  {
    id: 'ue5.spawn_actor',
    patterns: [
      'spawn {actor_class}',
      'spawn {actor_class} at {location}',
      'create {actor_class}',
      'add {actor_class} to scene',
      'place {actor_class}'
    ],
    intent: 'ue5.actor.spawn',
    description: 'Spawn an actor in the UE5 scene',
    examples: [
      'spawn StaticMeshActor',
      'spawn PlayerCharacter at 0 0 100',
      'create PointLight',
      'add Cube to scene'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorClass = params.actor_class;
      const location = params.location || '0 0 0';
      
      await voiceFeedbackService.speak(`Spawning ${actorClass}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Spawned: ${actorClass}`,
        data: { actorClass, location, action: 'spawn_actor' }
      };
    }
  },

  {
    id: 'ue5.delete_actor',
    patterns: [
      'delete {actor_name}',
      'remove {actor_name}',
      'destroy {actor_name}',
      'delete selected actor',
      'remove selected'
    ],
    intent: 'ue5.actor.delete',
    description: 'Delete an actor from the scene',
    examples: [
      'delete PlayerCharacter',
      'remove Cube',
      'destroy PointLight',
      'delete selected actor'
    ],
    category: 'ue5',
    requiresConfirmation: true,
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak(`Deleting ${actorName}`);
      voiceFeedbackService.playSound('error');
      
      return {
        success: true,
        message: `Deleted: ${actorName}`,
        data: { actorName, action: 'delete_actor' }
      };
    }
  },

  {
    id: 'ue5.select_actor',
    patterns: [
      'select {actor_name}',
      'select actor {actor_name}',
      'focus on {actor_name}',
      'highlight {actor_name}'
    ],
    intent: 'ue5.actor.select',
    description: 'Select an actor in the UE5 editor',
    examples: [
      'select PlayerCharacter',
      'select actor Cube',
      'focus on PointLight'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name;
      
      await voiceFeedbackService.speak(`Selecting ${actorName}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Selected: ${actorName}`,
        data: { actorName, action: 'select_actor' }
      };
    }
  },

  {
    id: 'ue5.move_actor',
    patterns: [
      'move {actor_name} to {location}',
      'move selected to {location}',
      'set position of {actor_name} to {location}',
      'teleport {actor_name} to {location}'
    ],
    intent: 'ue5.actor.move',
    description: 'Move an actor to a new location',
    examples: [
      'move PlayerCharacter to 100 200 50',
      'move selected to 0 0 100',
      'teleport Cube to 500 500 0'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      const location = params.location;
      
      await voiceFeedbackService.speak(`Moving ${actorName}`);
      
      return {
        success: true,
        message: `Moved ${actorName} to ${location}`,
        data: { actorName, location, action: 'move_actor' }
      };
    }
  },

  {
    id: 'ue5.rotate_actor',
    patterns: [
      'rotate {actor_name} to {rotation}',
      'rotate selected to {rotation}',
      'set rotation of {actor_name} to {rotation}',
      'turn {actor_name} to {rotation}'
    ],
    intent: 'ue5.actor.rotate',
    description: 'Rotate an actor',
    examples: [
      'rotate PlayerCharacter to 0 90 0',
      'rotate selected to 45 0 0',
      'turn Cube to 0 180 0'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      const rotation = params.rotation;
      
      await voiceFeedbackService.speak(`Rotating ${actorName}`);
      
      return {
        success: true,
        message: `Rotated ${actorName} to ${rotation}`,
        data: { actorName, rotation, action: 'rotate_actor' }
      };
    }
  },

  {
    id: 'ue5.scale_actor',
    patterns: [
      'scale {actor_name} to {scale}',
      'scale selected to {scale}',
      'set scale of {actor_name} to {scale}',
      'resize {actor_name} to {scale}'
    ],
    intent: 'ue5.actor.scale',
    description: 'Scale an actor',
    examples: [
      'scale PlayerCharacter to 2',
      'scale selected to 0.5',
      'resize Cube to 3 3 3'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      const scale = params.scale;
      
      await voiceFeedbackService.speak(`Scaling ${actorName}`);
      
      return {
        success: true,
        message: `Scaled ${actorName} to ${scale}`,
        data: { actorName, scale, action: 'scale_actor' }
      };
    }
  },

  {
    id: 'ue5.duplicate_actor',
    patterns: [
      'duplicate {actor_name}',
      'duplicate selected',
      'clone {actor_name}',
      'copy {actor_name}'
    ],
    intent: 'ue5.actor.duplicate',
    description: 'Duplicate an actor',
    examples: [
      'duplicate PlayerCharacter',
      'duplicate selected',
      'clone Cube'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak(`Duplicating ${actorName}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Duplicated: ${actorName}`,
        data: { actorName, action: 'duplicate_actor' }
      };
    }
  },

  {
    id: 'ue5.get_selected',
    patterns: [
      'what is selected',
      'show selected actors',
      'get selection',
      'what am I selecting'
    ],
    intent: 'ue5.actor.get_selected',
    description: 'Get currently selected actors',
    examples: [
      'what is selected',
      'show selected actors',
      'get selection'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Getting selected actors');
      
      return {
        success: true,
        message: 'Retrieved selected actors',
        data: { action: 'get_selected' }
      };
    }
  },

  {
    id: 'ue5.hide_actor',
    patterns: [
      'hide {actor_name}',
      'hide selected',
      'make {actor_name} invisible',
      'turn off {actor_name}'
    ],
    intent: 'ue5.actor.hide',
    description: 'Hide an actor in the viewport',
    examples: [
      'hide PlayerCharacter',
      'hide selected',
      'make Cube invisible'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak(`Hiding ${actorName}`);
      
      return {
        success: true,
        message: `Hidden: ${actorName}`,
        data: { actorName, action: 'hide_actor' }
      };
    }
  },

  {
    id: 'ue5.show_actor',
    patterns: [
      'show {actor_name}',
      'show selected',
      'make {actor_name} visible',
      'turn on {actor_name}',
      'unhide {actor_name}'
    ],
    intent: 'ue5.actor.show',
    description: 'Show a hidden actor',
    examples: [
      'show PlayerCharacter',
      'show selected',
      'make Cube visible',
      'unhide PointLight'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak(`Showing ${actorName}`);
      
      return {
        success: true,
        message: `Shown: ${actorName}`,
        data: { actorName, action: 'show_actor' }
      };
    }
  }
];
