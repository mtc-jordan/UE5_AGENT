import { commandRegistry } from './command-registry';
import { basicCommands } from './commands/basic-commands';
import { gitCommands } from './commands/git-commands';
import { aiCommands } from './commands/ai-commands';
import { collaborationCommands } from './commands/collaboration-commands';
import { ue5ActorCommands } from './commands/ue5-actor-commands';
import { ue5LevelCommands } from './commands/ue5-level-commands';
import { ue5AssetCommands } from './commands/ue5-asset-commands';
import { ue5LandscapeCommands } from './commands/ue5-landscape-commands';
import { ue5SequencerCommands } from './commands/ue5-sequencer-commands';
import { ue5PhysicsCommands } from './commands/ue5-physics-commands';
import { ue5AdvancedCommands } from './commands/ue5-advanced-commands';

export function initializeVoiceCommands(): void {
  console.log('Initializing voice command system...');

  commandRegistry.registerBatch(basicCommands);
  commandRegistry.registerBatch(gitCommands);
  commandRegistry.registerBatch(aiCommands);
  commandRegistry.registerBatch(collaborationCommands);
  commandRegistry.registerBatch(ue5ActorCommands);
  commandRegistry.registerBatch(ue5LevelCommands);
  commandRegistry.registerBatch(ue5AssetCommands);
  commandRegistry.registerBatch(ue5LandscapeCommands);
  commandRegistry.registerBatch(ue5SequencerCommands);
  commandRegistry.registerBatch(ue5PhysicsCommands);
  commandRegistry.registerBatch(ue5AdvancedCommands);

  const stats = commandRegistry.getStats();
  console.log('Voice commands initialized:', stats);
}

export function getCommandStats() {
  return commandRegistry.getStats();
}

export function getAllCommandsHelp(): string {
  return commandRegistry.getAllCommandsHelp();
}

export function getCommandsByCategory(category: string) {
  return commandRegistry.getCommandsByCategory(category);
}

export function searchCommands(keyword: string) {
  return commandRegistry.searchCommands(keyword);
}
