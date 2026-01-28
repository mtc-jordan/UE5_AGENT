/**
 * Collaboration Voice Commands
 * Voice commands for team collaboration features
 */

import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const collaborationCommands: CommandDefinition[] = [
  {
    id: 'collab.lock',
    patterns: [
      'lock this file',
      'lock file',
      'lock {filename}',
      'acquire lock'
    ],
    intent: 'collaboration.lock',
    description: 'Lock a file for exclusive editing',
    examples: [
      'lock this file',
      'lock PlayerController.cpp',
      'acquire lock'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      const filename = params.filename || context.currentFile || 'this file';
      
      await voiceFeedbackService.speak(`Locking ${filename}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Locked: ${filename}`,
        data: { filename, action: 'lock' }
      };
    }
  },

  {
    id: 'collab.unlock',
    patterns: [
      'unlock this file',
      'unlock file',
      'unlock {filename}',
      'release lock'
    ],
    intent: 'collaboration.unlock',
    description: 'Unlock a file',
    examples: [
      'unlock this file',
      'unlock PlayerController.cpp',
      'release lock'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      const filename = params.filename || context.currentFile || 'this file';
      
      await voiceFeedbackService.speak(`Unlocking ${filename}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Unlocked: ${filename}`,
        data: { filename, action: 'unlock' }
      };
    }
  },

  {
    id: 'collab.show_users',
    patterns: [
      'show online users',
      'who is online',
      'show team',
      'show collaborators',
      'who else is here'
    ],
    intent: 'collaboration.show_users',
    description: 'Show online team members',
    examples: [
      'show online users',
      'who is online',
      'show team'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      const userCount = context.onlineUsers?.length || 0;
      
      await voiceFeedbackService.speak(`There are ${userCount} users online`);
      
      return {
        success: true,
        message: `${userCount} users online`,
        data: { userCount, action: 'show_users' }
      };
    }
  },

  {
    id: 'collab.request_access',
    patterns: [
      'request access to {filename}',
      'ask for access to {filename}',
      'request access',
      'ask for access'
    ],
    intent: 'collaboration.request_access',
    description: 'Request access to a locked file',
    examples: [
      'request access to PlayerController.cpp',
      'ask for access to this file'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      const filename = params.filename || context.currentFile || 'this file';
      
      await voiceFeedbackService.speak(`Requesting access to ${filename}`);
      voiceFeedbackService.playSound('notification');
      
      return {
        success: true,
        message: `Access requested for: ${filename}`,
        data: { filename, action: 'request_access' }
      };
    }
  },

  {
    id: 'collab.show_locks',
    patterns: [
      'show file locks',
      'show locks',
      'what files are locked',
      'show locked files'
    ],
    intent: 'collaboration.show_locks',
    description: 'Show all locked files',
    examples: [
      'show file locks',
      'what files are locked'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Showing file locks');
      
      return {
        success: true,
        message: 'Displaying file locks',
        data: { action: 'show_locks' }
      };
    }
  },

  {
    id: 'collab.show_presence',
    patterns: [
      'show presence',
      'show who is editing',
      'show active users',
      'who is editing what'
    ],
    intent: 'collaboration.show_presence',
    description: 'Show live presence and who is editing what',
    examples: [
      'show presence',
      'who is editing what'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Showing live presence');
      
      return {
        success: true,
        message: 'Displaying live presence',
        data: { action: 'show_presence' }
      };
    }
  },

  {
    id: 'collab.follow_user',
    patterns: [
      'follow {username}',
      'follow user {username}',
      'watch {username}'
    ],
    intent: 'collaboration.follow_user',
    description: 'Follow another user\'s cursor and edits',
    examples: [
      'follow john',
      'watch sarah'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      const username = params.username;
      
      await voiceFeedbackService.speak(`Following ${username}`);
      voiceFeedbackService.playSound('success');
      
      return {
        success: true,
        message: `Following: ${username}`,
        data: { username, action: 'follow_user' }
      };
    }
  },

  {
    id: 'collab.unfollow',
    patterns: [
      'stop following',
      'unfollow',
      'stop watching'
    ],
    intent: 'collaboration.unfollow',
    description: 'Stop following another user',
    examples: [
      'stop following',
      'unfollow'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Stopped following');
      
      return {
        success: true,
        message: 'Stopped following user',
        data: { action: 'unfollow' }
      };
    }
  },

  {
    id: 'collab.send_message',
    patterns: [
      'send message {message}',
      'message team {message}',
      'tell everyone {message}'
    ],
    intent: 'collaboration.send_message',
    description: 'Send a message to the team',
    examples: [
      'send message "I\'m working on the player controller"',
      'message team "Taking a break"'
    ],
    category: 'collaboration',
    handler: async (params, context) => {
      const message = params.message;
      
      await voiceFeedbackService.speak('Message sent');
      voiceFeedbackService.playSound('notification');
      
      return {
        success: true,
        message: `Sent: ${message}`,
        data: { message, action: 'send_message' }
      };
    }
  }
];
