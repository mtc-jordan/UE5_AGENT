/**
 * Voice Commands Initialization
 * Registers all voice commands and sets up the voice command system
 */

import { commandRegistry } from './command-registry';
import { basicCommands } from './commands/basic-commands';
import { gitCommands } from './commands/git-commands';
import { aiCommands } from './commands/ai-commands';
import { collaborationCommands } from './commands/collaboration-commands';
import { ue5ActorCommands } from './commands/ue5-actor-commands';
import { ue5LevelCommands } from './commands/ue5-level-commands';
import { ue5AssetCommands } from './commands/ue5-asset-commands';

/**
 * Initialize voice command system
 */
export function initializeVoiceCommands(): void {
  console.log('Initializing voice command system...');

  // Register all command categories
  commandRegistry.registerBatch(basicCommands);
  commandRegistry.registerBatch(gitCommands);
  commandRegistry.registerBatch(aiCommands);
  commandRegistry.registerBatch(collaborationCommands);
  commandRegistry.registerBatch(ue5ActorCommands);
  commandRegistry.registerBatch(ue5LevelCommands);
  commandRegistry.registerBatch(ue5AssetCommands);

  // Log statistics
  const stats = commandRegistry.getStats();
  console.log(`Voice commands initialized:`, stats);
  console.log(`- Total commands: ${stats.total}`);
  console.log(`- By category:`, stats.byCategory);
  console.log(`  • File: ${stats.byCategory.file || 0}`);
  console.log(`  • Navigation: ${stats.byCategory.navigation || 0}`);
  console.log(`  • Git: ${stats.byCategory.git || 0}`);
  console.log(`  • AI: ${stats.byCategory.ai || 0}`);
  console.log(`  • Collaboration: ${stats.byCategory.collaboration || 0}`);
  console.log(`  • UE5: ${stats.byCategory.ue5 || 0}`);
  console.log(`  • Workspace: ${stats.byCategory.workspace || 0}`);
  console.log(`  • General: ${stats.byCategory.general || 0}`);
}

/**
 * Get command statistics
 */
export function getCommandStats() {
  return commandRegistry.getStats();
}

/**
 * Get all commands help text
 */
export function getAllCommandsHelp(): string {
  return commandRegistry.getAllCommandsHelp();
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: string) {
  return commandRegistry.getCommandsByCategory(category);
}

/**
 * Search commands
 */
export function searchCommands(keyword: string) {
  return commandRegistry.searchCommands(keyword);
}
