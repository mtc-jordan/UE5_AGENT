/**
 * Voice Commands Initialization
 * Registers all voice commands and sets up the voice command system
 */

import { commandRegistry } from './command-registry';
import { basicCommands } from './commands/basic-commands';

/**
 * Initialize voice command system
 */
export function initializeVoiceCommands(): void {
  console.log('Initializing voice command system...');

  // Register basic commands
  commandRegistry.registerBatch(basicCommands);

  // Log statistics
  const stats = commandRegistry.getStats();
  console.log(`Voice commands initialized:`, stats);
  console.log(`- Total commands: ${stats.total}`);
  console.log(`- By category:`, stats.byCategory);
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
