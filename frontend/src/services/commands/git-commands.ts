/**
 * Git Voice Commands
 * Voice commands for Git operations
 */

import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const gitCommands: CommandDefinition[] = [
  {
    id: 'git.commit',
    patterns: [
      'commit with message {message}',
      'commit changes with message {message}',
      'git commit {message}',
      'commit {message}'
    ],
    intent: 'git.commit',
    description: 'Commit changes with a message',
    examples: [
      'commit with message "Fixed player movement bug"',
      'commit changes with message "Added new weapon system"'
    ],
    category: 'git',
    handler: async (params, context) => {
      const message = params.message;
      
      // TODO: Implement actual Git commit
      await voiceFeedbackService.speak(`Committing changes with message: ${message}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Committed: ${message}`,
        data: { message, action: 'commit' }
      };
    }
  },

  {
    id: 'git.push',
    patterns: [
      'push changes',
      'git push',
      'push to remote',
      'push'
    ],
    intent: 'git.push',
    description: 'Push commits to remote repository',
    examples: [
      'push changes',
      'git push'
    ],
    category: 'git',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Pushing changes to remote');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: 'Pushed changes to remote',
        data: { action: 'push' }
      };
    }
  },

  {
    id: 'git.pull',
    patterns: [
      'pull changes',
      'git pull',
      'pull from remote',
      'pull'
    ],
    intent: 'git.pull',
    description: 'Pull changes from remote repository',
    examples: [
      'pull changes',
      'git pull'
    ],
    category: 'git',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Pulling changes from remote');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: 'Pulled changes from remote',
        data: { action: 'pull' }
      };
    }
  },

  {
    id: 'git.status',
    patterns: [
      'show git status',
      'git status',
      'show status',
      'what changed'
    ],
    intent: 'git.status',
    description: 'Show Git status',
    examples: [
      'show git status',
      'what changed'
    ],
    category: 'git',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Showing git status');
      
      return {
        success: true,
        message: 'Displaying Git status',
        data: { action: 'status' }
      };
    }
  },

  {
    id: 'git.log',
    patterns: [
      'show git log',
      'git log',
      'show commit history',
      'show history'
    ],
    intent: 'git.log',
    description: 'Show Git commit history',
    examples: [
      'show git log',
      'show commit history'
    ],
    category: 'git',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Showing commit history');
      
      return {
        success: true,
        message: 'Displaying commit history',
        data: { action: 'log' }
      };
    }
  },

  {
    id: 'git.branch',
    patterns: [
      'create branch {name}',
      'new branch {name}',
      'git branch {name}'
    ],
    intent: 'git.branch.create',
    description: 'Create a new Git branch',
    examples: [
      'create branch feature-weapons',
      'new branch bugfix-movement'
    ],
    category: 'git',
    handler: async (params, context) => {
      const branchName = params.name;
      
      await voiceFeedbackService.speak(`Creating branch ${branchName}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Created branch: ${branchName}`,
        data: { branchName, action: 'branch_create' }
      };
    }
  },

  {
    id: 'git.switch',
    patterns: [
      'switch to branch {name}',
      'checkout branch {name}',
      'switch to {name}',
      'checkout {name}'
    ],
    intent: 'git.branch.switch',
    description: 'Switch to a different branch',
    examples: [
      'switch to branch main',
      'checkout develop'
    ],
    category: 'git',
    handler: async (params, context) => {
      const branchName = params.name;
      
      await voiceFeedbackService.speak(`Switching to branch ${branchName}`);
      
      return {
        success: true,
        message: `Switched to branch: ${branchName}`,
        data: { branchName, action: 'branch_switch' }
      };
    }
  },

  {
    id: 'git.diff',
    patterns: [
      'show changes',
      'show diff',
      'git diff',
      'what did I change'
    ],
    intent: 'git.diff',
    description: 'Show changes in working directory',
    examples: [
      'show changes',
      'what did I change'
    ],
    category: 'git',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Showing changes');
      
      return {
        success: true,
        message: 'Displaying changes',
        data: { action: 'diff' }
      };
    }
  },

  {
    id: 'git.stash',
    patterns: [
      'stash changes',
      'git stash',
      'save changes for later'
    ],
    intent: 'git.stash',
    description: 'Stash uncommitted changes',
    examples: [
      'stash changes',
      'save changes for later'
    ],
    category: 'git',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Stashing changes');
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: 'Changes stashed',
        data: { action: 'stash' }
      };
    }
  },

  {
    id: 'git.stash_pop',
    patterns: [
      'apply stashed changes',
      'pop stash',
      'git stash pop',
      'restore stashed changes'
    ],
    intent: 'git.stash.pop',
    description: 'Apply stashed changes',
    examples: [
      'apply stashed changes',
      'pop stash'
    ],
    category: 'git',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Applying stashed changes');
      
      return {
        success: true,
        message: 'Stashed changes applied',
        data: { action: 'stash_pop' }
      };
    }
  },

  {
    id: 'git.discard',
    patterns: [
      'discard changes',
      'discard changes in {filename}',
      'reset file {filename}',
      'undo changes'
    ],
    intent: 'git.discard',
    description: 'Discard uncommitted changes',
    examples: [
      'discard changes',
      'discard changes in PlayerController.cpp',
      'undo changes'
    ],
    category: 'git',
    requiresConfirmation: true,
    handler: async (params, context) => {
      const filename = params.filename || 'all files';
      
      await voiceFeedbackService.speak(`Discarding changes in ${filename}`);
      voiceFeedbackService.playSound('error');
      
      return {
        success: true,
        message: `Discarded changes in ${filename}`,
        data: { filename, action: 'discard' }
      };
    }
  }
];
