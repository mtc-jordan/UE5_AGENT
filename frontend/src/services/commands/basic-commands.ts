/**
 * Basic Voice Commands
 * Initial set of voice commands for file, navigation, and workspace operations
 */

import { CommandDefinition, CommandResult } from '../command-registry';
import { WorkspaceContext } from '../voice-context';
import { voiceFeedbackService } from '../voice-feedback';

/**
 * File operation commands
 */
export const fileCommands: CommandDefinition[] = [
  {
    id: 'file.open',
    patterns: [
      'open file {filename}',
      'open {filename}',
      'show file {filename}',
      'load file {filename}'
    ],
    intent: 'file.open',
    description: 'Open a file in the editor',
    examples: [
      'open file PlayerController.cpp',
      'open main.cpp',
      'show PlayerController.h'
    ],
    category: 'file',
    handler: async (params, context) => {
      const filename = params.filename;
      
      // TODO: Implement actual file opening logic
      await voiceFeedbackService.speak(`Opening ${filename}`);
      
      return {
        success: true,
        message: `Opened ${filename}`,
        data: { filename }
      };
    }
  },

  {
    id: 'file.save',
    patterns: [
      'save file',
      'save this file',
      'save current file',
      'save'
    ],
    intent: 'file.save',
    description: 'Save the current file',
    examples: [
      'save file',
      'save this file'
    ],
    category: 'file',
    handler: async (params, context) => {
      const filename = context.currentFile || 'file';
      
      // TODO: Implement actual file saving logic
      await voiceFeedbackService.speak('File saved');
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Saved ${filename}`,
        data: { filename }
      };
    }
  },

  {
    id: 'file.close',
    patterns: [
      'close file',
      'close this file',
      'close current file',
      'close {filename}'
    ],
    intent: 'file.close',
    description: 'Close a file',
    examples: [
      'close file',
      'close PlayerController.cpp'
    ],
    category: 'file',
    handler: async (params, context) => {
      const filename = params.filename || context.currentFile || 'file';
      
      // TODO: Implement actual file closing logic
      await voiceFeedbackService.speak(`Closing ${filename}`);
      
      return {
        success: true,
        message: `Closed ${filename}`,
        data: { filename }
      };
    }
  },

  {
    id: 'file.new',
    patterns: [
      'create file {filename}',
      'new file {filename}',
      'create new file {filename}'
    ],
    intent: 'file.create',
    description: 'Create a new file',
    examples: [
      'create file NewComponent.cpp',
      'new file MyActor.h'
    ],
    category: 'file',
    handler: async (params, context) => {
      const filename = params.filename;
      
      // TODO: Implement actual file creation logic
      await voiceFeedbackService.speak(`Creating ${filename}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Created ${filename}`,
        data: { filename }
      };
    }
  }
];

/**
 * Navigation commands
 */
export const navigationCommands: CommandDefinition[] = [
  {
    id: 'nav.goto_line',
    patterns: [
      'go to line {line}',
      'goto line {line}',
      'jump to line {line}',
      'line {line}'
    ],
    intent: 'navigation.goto_line',
    description: 'Go to a specific line number',
    examples: [
      'go to line 42',
      'jump to line 100'
    ],
    category: 'navigation',
    handler: async (params, context) => {
      const line = parseInt(params.line);
      
      // TODO: Implement actual navigation logic
      await voiceFeedbackService.speak(`Going to line ${line}`);
      
      return {
        success: true,
        message: `Navigated to line ${line}`,
        data: { line }
      };
    }
  },

  {
    id: 'nav.find',
    patterns: [
      'find {text}',
      'search for {text}',
      'search {text}'
    ],
    intent: 'navigation.find',
    description: 'Find text in the current file',
    examples: [
      'find PlayerController',
      'search for BeginPlay'
    ],
    category: 'navigation',
    handler: async (params, context) => {
      const text = params.text;
      
      // TODO: Implement actual find logic
      await voiceFeedbackService.speak(`Searching for ${text}`);
      
      return {
        success: true,
        message: `Searching for "${text}"`,
        data: { text }
      };
    }
  },

  {
    id: 'nav.show_panel',
    patterns: [
      'show {panel}',
      'open {panel}',
      'display {panel}',
      'toggle {panel}'
    ],
    intent: 'navigation.show_panel',
    description: 'Show a specific panel',
    examples: [
      'show terminal',
      'open file explorer',
      'display git panel'
    ],
    category: 'navigation',
    handler: async (params, context) => {
      const panel = params.panel;
      
      // TODO: Implement actual panel toggle logic
      await voiceFeedbackService.speak(`Showing ${panel}`);
      
      return {
        success: true,
        message: `Opened ${panel} panel`,
        data: { panel }
      };
    }
  }
];

/**
 * Workspace commands
 */
export const workspaceCommands: CommandDefinition[] = [
  {
    id: 'workspace.help',
    patterns: [
      'help',
      'show help',
      'what can you do',
      'list commands',
      'show commands'
    ],
    intent: 'workspace.help',
    description: 'Show available voice commands',
    examples: [
      'help',
      'what can you do',
      'list commands'
    ],
    category: 'general',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Showing available commands');
      
      return {
        success: true,
        message: 'Displaying command help',
        data: { action: 'show_help' }
      };
    }
  },

  {
    id: 'workspace.settings',
    patterns: [
      'show settings',
      'open settings',
      'settings',
      'preferences'
    ],
    intent: 'workspace.settings',
    description: 'Open workspace settings',
    examples: [
      'show settings',
      'open preferences'
    ],
    category: 'workspace',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Opening settings');
      
      return {
        success: true,
        message: 'Opening settings',
        data: { action: 'open_settings' }
      };
    }
  },

  {
    id: 'workspace.theme',
    patterns: [
      'change theme to {theme}',
      'set theme {theme}',
      'switch to {theme} theme'
    ],
    intent: 'workspace.theme',
    description: 'Change workspace theme',
    examples: [
      'change theme to dark',
      'switch to light theme'
    ],
    category: 'workspace',
    handler: async (params, context) => {
      const theme = params.theme;
      
      await voiceFeedbackService.speak(`Changing theme to ${theme}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Changed theme to ${theme}`,
        data: { theme }
      };
    }
  }
];

/**
 * All basic commands
 */
export const basicCommands: CommandDefinition[] = [
  ...fileCommands,
  ...navigationCommands,
  ...workspaceCommands
];
