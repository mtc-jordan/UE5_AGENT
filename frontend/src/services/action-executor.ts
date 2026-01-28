/**
 * Action Executor Service
 * Executes parsed voice commands and coordinates with platform services
 */

import { ParsedCommand } from './command-parser';
import { WorkspaceContext, voiceContextManager } from './voice-context';
import { voiceFeedbackService } from './voice-feedback';
import { CommandResult } from './command-registry';

export interface ExecutionOptions {
  context?: WorkspaceContext;
  skipConfirmation?: boolean;
  silent?: boolean;
}

export interface ExecutionResult extends CommandResult {
  executionTime: number;
  timestamp: number;
}

class ActionExecutor {
  /**
   * Execute a parsed command
   */
  async execute(
    command: ParsedCommand,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const context = options.context || voiceContextManager.getContext();

    try {
      // Check if command requires confirmation
      if (command.matchedCommand?.requiresConfirmation && !options.skipConfirmation) {
        const confirmed = await this.requestConfirmation(command);
        
        if (!confirmed) {
          return {
            success: false,
            message: 'Command cancelled by user',
            executionTime: Date.now() - startTime,
            timestamp: Date.now()
          };
        }
      }

      // Validate command
      if (!command.matchedCommand) {
        throw new Error('No command handler found');
      }

      // Play processing sound
      if (!options.silent) {
        voiceFeedbackService.playSound('processing');
      }

      // Execute command handler
      const result = await command.matchedCommand.handler(command.params, context);

      // Add execution metadata
      const executionResult: ExecutionResult = {
        ...result,
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      // Update context with result
      voiceContextManager.addConversationTurn(command, executionResult);

      // Play success/error sound
      if (!options.silent) {
        if (result.success) {
          voiceFeedbackService.playSound('success');
        } else {
          voiceFeedbackService.playSound('error');
        }
      }

      return executionResult;
    } catch (error: any) {
      const errorMessage = error.message || 'Command execution failed';
      
      // Play error sound
      if (!options.silent) {
        voiceFeedbackService.playSound('error');
        await voiceFeedbackService.speakError(errorMessage);
      }

      return {
        success: false,
        message: errorMessage,
        error,
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Request confirmation for destructive commands
   */
  private async requestConfirmation(command: ParsedCommand): Promise<boolean> {
    // TODO: Show confirmation dialog
    // For now, return true (auto-confirm)
    return true;
  }

  /**
   * Check if a command can be executed
   */
  canExecute(command: ParsedCommand): boolean {
    return command.matchedCommand !== undefined;
  }

  /**
   * Get command description
   */
  getCommandDescription(command: ParsedCommand): string {
    if (!command.matchedCommand) {
      return 'Unknown command';
    }

    return command.matchedCommand.description;
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeSequence(
    commands: ParsedCommand[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const command of commands) {
      const result = await this.execute(command, options);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute commands in parallel
   */
  async executeParallel(
    commands: ParsedCommand[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult[]> {
    const promises = commands.map(command => this.execute(command, options));
    return Promise.all(promises);
  }
}

// Export singleton instance
export const actionExecutor = new ActionExecutor();
