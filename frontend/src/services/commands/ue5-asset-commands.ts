/**
 * UE5 Asset Voice Commands
 * Voice commands for Unreal Engine 5 asset and animation operations
 */

import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const ue5AssetCommands: CommandDefinition[] = [
  {
    id: 'ue5.play_animation',
    patterns: [
      'play animation {animation_name}',
      'play animation {animation_name} on {actor_name}',
      'animate {actor_name} with {animation_name}',
      'start animation {animation_name}'
    ],
    intent: 'ue5.animation.play',
    description: 'Play an animation on an actor',
    examples: [
      'play animation Walk',
      'play animation Run on PlayerCharacter',
      'animate Character with Jump'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const animationName = params.animation_name;
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak(`Playing animation ${animationName}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Playing ${animationName} on ${actorName}`,
        data: { animationName, actorName, action: 'play_animation' }
      };
    }
  },

  {
    id: 'ue5.stop_animation',
    patterns: [
      'stop animation',
      'stop animation on {actor_name}',
      'stop animating {actor_name}',
      'pause animation'
    ],
    intent: 'ue5.animation.stop',
    description: 'Stop animation on an actor',
    examples: [
      'stop animation',
      'stop animation on PlayerCharacter',
      'pause animation'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak('Stopping animation');
      
      return {
        success: true,
        message: `Animation stopped on ${actorName}`,
        data: { actorName, action: 'stop_animation' }
      };
    }
  },

  {
    id: 'ue5.create_material',
    patterns: [
      'create material {material_name}',
      'create new material {material_name}',
      'make material {material_name}',
      'new material {material_name}'
    ],
    intent: 'ue5.asset.create_material',
    description: 'Create a new material',
    examples: [
      'create material MetalSurface',
      'create new material GlowingBlue',
      'make material WoodTexture'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const materialName = params.material_name;
      
      await voiceFeedbackService.speak(`Creating material ${materialName}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Material created: ${materialName}`,
        data: { materialName, action: 'create_material' }
      };
    }
  },

  {
    id: 'ue5.apply_material',
    patterns: [
      'apply material {material_name}',
      'apply material {material_name} to {actor_name}',
      'set material {material_name}',
      'use material {material_name}'
    ],
    intent: 'ue5.asset.apply_material',
    description: 'Apply a material to an actor',
    examples: [
      'apply material MetalSurface',
      'apply material GlowingBlue to Cube',
      'set material WoodTexture'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const materialName = params.material_name;
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak(`Applying material ${materialName}`);
      
      return {
        success: true,
        message: `Applied ${materialName} to ${actorName}`,
        data: { materialName, actorName, action: 'apply_material' }
      };
    }
  },

  {
    id: 'ue5.import_asset',
    patterns: [
      'import asset {asset_path}',
      'import {asset_path}',
      'load asset {asset_path}',
      'bring in {asset_path}'
    ],
    intent: 'ue5.asset.import',
    description: 'Import an asset into the project',
    examples: [
      'import asset /Game/Models/Character.fbx',
      'import Character.fbx',
      'load asset Texture.png'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const assetPath = params.asset_path;
      
      await voiceFeedbackService.speak('Importing asset');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Importing: ${assetPath}`,
        data: { assetPath, action: 'import_asset' }
      };
    }
  },

  {
    id: 'ue5.create_blueprint',
    patterns: [
      'create blueprint {blueprint_name}',
      'create new blueprint {blueprint_name}',
      'make blueprint {blueprint_name}',
      'new blueprint class {blueprint_name}'
    ],
    intent: 'ue5.blueprint.create',
    description: 'Create a new Blueprint class',
    examples: [
      'create blueprint PlayerController',
      'create new blueprint EnemyAI',
      'make blueprint PickupItem'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const blueprintName = params.blueprint_name;
      
      await voiceFeedbackService.speak(`Creating blueprint ${blueprintName}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Blueprint created: ${blueprintName}`,
        data: { blueprintName, action: 'create_blueprint' }
      };
    }
  },

  {
    id: 'ue5.open_blueprint',
    patterns: [
      'open blueprint {blueprint_name}',
      'edit blueprint {blueprint_name}',
      'show blueprint {blueprint_name}',
      'open {blueprint_name} blueprint'
    ],
    intent: 'ue5.blueprint.open',
    description: 'Open a Blueprint for editing',
    examples: [
      'open blueprint PlayerController',
      'edit blueprint EnemyAI',
      'show blueprint PickupItem'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const blueprintName = params.blueprint_name;
      
      await voiceFeedbackService.speak(`Opening blueprint ${blueprintName}`);
      
      return {
        success: true,
        message: `Opened blueprint: ${blueprintName}`,
        data: { blueprintName, action: 'open_blueprint' }
      };
    }
  },

  {
    id: 'ue5.compile_blueprint',
    patterns: [
      'compile blueprint',
      'compile blueprints',
      'recompile blueprint',
      'build blueprint'
    ],
    intent: 'ue5.blueprint.compile',
    description: 'Compile Blueprint(s)',
    examples: [
      'compile blueprint',
      'compile blueprints',
      'recompile blueprint'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Compiling blueprints');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: 'Blueprints compiled',
        data: { action: 'compile_blueprint' }
      };
    }
  },

  {
    id: 'ue5.add_component',
    patterns: [
      'add {component_type} component',
      'add {component_type} to {actor_name}',
      'add component {component_type}',
      'attach {component_type}'
    ],
    intent: 'ue5.component.add',
    description: 'Add a component to an actor',
    examples: [
      'add StaticMesh component',
      'add PointLight to PlayerCharacter',
      'add component BoxCollision',
      'attach Camera'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const componentType = params.component_type;
      const actorName = params.actor_name || 'selected actor';
      
      await voiceFeedbackService.speak(`Adding ${componentType} component`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Added ${componentType} to ${actorName}`,
        data: { componentType, actorName, action: 'add_component' }
      };
    }
  },

  {
    id: 'ue5.remove_component',
    patterns: [
      'remove {component_name} component',
      'remove component {component_name}',
      'delete {component_name} component',
      'detach {component_name}'
    ],
    intent: 'ue5.component.remove',
    description: 'Remove a component from an actor',
    examples: [
      'remove StaticMesh component',
      'remove component PointLight',
      'delete BoxCollision component'
    ],
    category: 'ue5',
    requiresConfirmation: true,
    handler: async (params, context) => {
      const componentName = params.component_name;
      
      await voiceFeedbackService.speak(`Removing ${componentName} component`);
      voiceFeedbackService.playSound('error');
      
      return {
        success: true,
        message: `Removed component: ${componentName}`,
        data: { componentName, action: 'remove_component' }
      };
    }
  },

  {
    id: 'ue5.spawn_particle',
    patterns: [
      'spawn particle {particle_name}',
      'spawn particle {particle_name} at {location}',
      'create particle effect {particle_name}',
      'play particle {particle_name}'
    ],
    intent: 'ue5.vfx.spawn_particle',
    description: 'Spawn a particle effect',
    examples: [
      'spawn particle Explosion',
      'spawn particle Fire at 100 200 50',
      'create particle effect Smoke'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const particleName = params.particle_name;
      const location = params.location || '0 0 0';
      
      await voiceFeedbackService.speak(`Spawning particle ${particleName}`);
      voiceFeedbackService.playSound('notification');
      
      return {
        success: true,
        message: `Spawned particle: ${particleName}`,
        data: { particleName, location, action: 'spawn_particle' }
      };
    }
  },

  {
    id: 'ue5.spawn_sound',
    patterns: [
      'play sound {sound_name}',
      'play sound {sound_name} at {location}',
      'spawn sound {sound_name}',
      'trigger sound {sound_name}'
    ],
    intent: 'ue5.audio.spawn_sound',
    description: 'Play a sound effect',
    examples: [
      'play sound Explosion',
      'play sound Footstep at 100 200 50',
      'trigger sound Gunshot'
    ],
    category: 'ue5',
    handler: async (params, context) => {
      const soundName = params.sound_name;
      const location = params.location || '0 0 0';
      
      await voiceFeedbackService.speak(`Playing sound ${soundName}`);
      voiceFeedbackService.playSound('notification');
      
      return {
        success: true,
        message: `Playing sound: ${soundName}`,
        data: { soundName, location, action: 'spawn_sound' }
      };
    }
  }
];
