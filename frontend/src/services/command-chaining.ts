/**
 * Command Chaining Service
 * Enables sequential execution of multiple voice commands
 */

import { commandParser } from './command-parser';
import { actionExecutor } from './action-executor';
import { voiceFeedbackService } from './voice-feedback';

export interface ChainedCommand {
  originalText: string;
  commands: string[];
  results: any[];
}

class CommandChainingService {
  private chainSeparators = ['and', 'then', 'after that', 'next'];

  /**
   * Check if text contains command chaining
   */
  isChainedCommand(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.chainSeparators.some(sep => lowerText.includes(` ${sep} `));
  }

  /**
   * Split chained command into individual commands
   */
  splitChain(text: string): string[] {
    let commands: string[] = [text];
    
    for (const separator of this.chainSeparators) {
      const newCommands: string[] = [];
      for (const cmd of commands) {
        const parts = cmd.split(new RegExp(`\\s+${separator}\\s+`, 'i'));
        newCommands.push(...parts);
      }
      commands = newCommands;
    }
    
    return commands.map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
  }

  /**
   * Execute chained commands sequentially
   */
  async executeChain(text: string): Promise<ChainedCommand> {
    const commands = this.splitChain(text);
    const results: any[] = [];

    await voiceFeedbackService.speak(`Executing ${commands.length} commands`);

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      
      try {
        // Parse command
        const parsed = await commandParser.parse(cmd);
        
        if (!parsed) {
          results.push({ success: false, message: `Could not parse: ${cmd}` });
          continue;
        }

        // Execute command
        const result = await actionExecutor.execute(parsed);
        results.push(result);

        // Provide feedback
        if (result.success) {
          await voiceFeedbackService.speak(`Step ${i + 1} complete`);
        } else {
          await voiceFeedbackService.speak(`Step ${i + 1} failed`);
          break; // Stop on failure
        }

        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({ success: false, message: `Error: ${error}` });
        break;
      }
    }

    const successCount = results.filter(r => r.success).length;
    await voiceFeedbackService.speak(`Completed ${successCount} of ${commands.length} commands`);

    return {
      originalText: text,
      commands,
      results
    };
  }
}

export const commandChainingService = new CommandChainingService();
