/**
 * AI Voice Commands
 * Voice commands for AI-powered operations
 */

import { CommandDefinition } from '../command-registry';
import { voiceFeedbackService } from '../voice-feedback';

export const aiCommands: CommandDefinition[] = [
  {
    id: 'ai.explain',
    patterns: [
      'explain this code',
      'explain this',
      'what does this do',
      'explain {selection}',
      'what is {selection}'
    ],
    intent: 'ai.explain',
    description: 'Explain code using AI',
    examples: [
      'explain this code',
      'what does this do',
      'explain BeginPlay function'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const target = params.selection || context.selectedText || 'this code';
      
      await voiceFeedbackService.speak(`Explaining ${target}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Explaining: ${target}`,
        data: { target, action: 'explain' }
      };
    }
  },

  {
    id: 'ai.generate',
    patterns: [
      'generate {description}',
      'create {description}',
      'write {description}',
      'generate code for {description}'
    ],
    intent: 'ai.generate',
    description: 'Generate code using AI',
    examples: [
      'generate a player movement function',
      'create a weapon pickup system',
      'write a health component'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const description = params.description;
      
      await voiceFeedbackService.speak(`Generating code for ${description}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Generating: ${description}`,
        data: { description, action: 'generate' }
      };
    }
  },

  {
    id: 'ai.fix',
    patterns: [
      'fix this error',
      'fix this bug',
      'fix this',
      'debug this',
      'fix error in {selection}'
    ],
    intent: 'ai.fix',
    description: 'Fix errors using AI',
    examples: [
      'fix this error',
      'debug this function',
      'fix error in PlayerController'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const target = params.selection || context.selectedText || 'this code';
      
      await voiceFeedbackService.speak(`Fixing errors in ${target}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Fixing: ${target}`,
        data: { target, action: 'fix' }
      };
    }
  },

  {
    id: 'ai.optimize',
    patterns: [
      'optimize this code',
      'optimize this',
      'make this faster',
      'improve performance',
      'optimize {selection}'
    ],
    intent: 'ai.optimize',
    description: 'Optimize code using AI',
    examples: [
      'optimize this code',
      'make this faster',
      'improve performance'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const target = params.selection || context.selectedText || 'this code';
      
      await voiceFeedbackService.speak(`Optimizing ${target}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Optimizing: ${target}`,
        data: { target, action: 'optimize' }
      };
    }
  },

  {
    id: 'ai.comment',
    patterns: [
      'add comments',
      'add comments to this',
      'document this code',
      'add documentation',
      'comment this'
    ],
    intent: 'ai.comment',
    description: 'Add comments to code using AI',
    examples: [
      'add comments',
      'document this code',
      'add documentation'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const target = context.selectedText || 'this code';
      
      await voiceFeedbackService.speak('Adding comments');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: 'Adding comments to code',
        data: { target, action: 'comment' }
      };
    }
  },

  {
    id: 'ai.refactor',
    patterns: [
      'refactor this code',
      'refactor this',
      'clean up this code',
      'improve this code',
      'refactor {selection}'
    ],
    intent: 'ai.refactor',
    description: 'Refactor code using AI',
    examples: [
      'refactor this code',
      'clean up this function',
      'improve this code'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const target = params.selection || context.selectedText || 'this code';
      
      await voiceFeedbackService.speak(`Refactoring ${target}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Refactoring: ${target}`,
        data: { target, action: 'refactor' }
      };
    }
  },

  {
    id: 'ai.test',
    patterns: [
      'generate tests',
      'generate tests for this',
      'create unit tests',
      'write tests',
      'test this code'
    ],
    intent: 'ai.test',
    description: 'Generate unit tests using AI',
    examples: [
      'generate tests',
      'create unit tests',
      'write tests for this function'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const target = context.selectedText || 'this code';
      
      await voiceFeedbackService.speak('Generating unit tests');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: 'Generating unit tests',
        data: { target, action: 'test' }
      };
    }
  },

  {
    id: 'ai.convert',
    patterns: [
      'convert this to {language}',
      'translate this to {language}',
      'rewrite this in {language}'
    ],
    intent: 'ai.convert',
    description: 'Convert code to another language using AI',
    examples: [
      'convert this to Python',
      'translate this to C++',
      'rewrite this in TypeScript'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const language = params.language;
      const target = context.selectedText || 'this code';
      
      await voiceFeedbackService.speak(`Converting to ${language}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Converting to ${language}`,
        data: { language, target, action: 'convert' }
      };
    }
  },

  {
    id: 'ai.review',
    patterns: [
      'review this code',
      'review this',
      'code review',
      'check this code',
      'review {selection}'
    ],
    intent: 'ai.review',
    description: 'Perform code review using AI',
    examples: [
      'review this code',
      'code review',
      'check this function'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const target = params.selection || context.selectedText || 'this code';
      
      await voiceFeedbackService.speak(`Reviewing ${target}`);
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Reviewing: ${target}`,
        data: { target, action: 'review' }
      };
    }
  },

  {
    id: 'ai.complete',
    patterns: [
      'complete this',
      'finish this code',
      'auto complete',
      'complete this function'
    ],
    intent: 'ai.complete',
    description: 'Auto-complete code using AI',
    examples: [
      'complete this',
      'finish this function',
      'auto complete'
    ],
    category: 'ai',
    handler: async (params, context) => {
      await voiceFeedbackService.speak('Auto-completing code');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: 'Auto-completing code',
        data: { action: 'complete' }
      };
    }
  },

  {
    id: 'ai.ask',
    patterns: [
      'ask {question}',
      'ai {question}',
      'hey ai {question}'
    ],
    intent: 'ai.ask',
    description: 'Ask AI a question about the code',
    examples: [
      'ask how to implement player movement',
      'ai what is the best way to handle collisions',
      'hey ai how do I optimize this'
    ],
    category: 'ai',
    handler: async (params, context) => {
      const question = params.question;
      
      await voiceFeedbackService.speak('Processing your question');
      voiceFeedbackService.playSound('processing');
      
      return {
        success: true,
        message: `Question: ${question}`,
        data: { question, action: 'ask' }
      };
    }
  }
];
