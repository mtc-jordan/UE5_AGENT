/**
 * Command Parser
 * Parses natural language voice commands into structured actions
 */

import { commandRegistry, CommandDefinition } from './command-registry';
import { WorkspaceContext } from './voice-context';

export interface ParsedCommand {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  action: string;
  params: Record<string, any>;
  originalText: string;
  matchedCommand?: CommandDefinition;
}

export interface ParseOptions {
  context?: WorkspaceContext;
  fuzzyMatch?: boolean;
  confidenceThreshold?: number;
}

class CommandParser {
  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

  /**
   * Parse a voice command text into a structured command
   */
  parse(text: string, options: ParseOptions = {}): ParsedCommand | null {
    const {
      context,
      fuzzyMatch = true,
      confidenceThreshold = this.DEFAULT_CONFIDENCE_THRESHOLD
    } = options;

    // Normalize text
    const normalizedText = this.normalizeText(text);

    if (!normalizedText) {
      return null;
    }

    // Find matching commands
    const matches = commandRegistry.findMatches(normalizedText);

    if (matches.length === 0) {
      return null;
    }

    // Get best match
    const bestMatch = matches[0];

    if (bestMatch.confidence < confidenceThreshold) {
      return null;
    }

    // Extract entities from the matched pattern
    const entities = this.extractEntities(normalizedText, bestMatch.command, context);

    // Build parsed command
    const parsedCommand: ParsedCommand = {
      intent: bestMatch.command.intent,
      entities,
      confidence: bestMatch.confidence,
      action: bestMatch.command.id,
      params: entities,
      originalText: text,
      matchedCommand: bestMatch.command
    };

    return parsedCommand;
  }

  /**
   * Normalize text for parsing
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[.,!?;:]$/, ''); // Remove trailing punctuation
  }

  /**
   * Extract entities from text based on command pattern
   */
  private extractEntities(
    text: string,
    command: CommandDefinition,
    context?: WorkspaceContext
  ): Record<string, any> {
    const entities: Record<string, any> = {};

    // Try each pattern
    for (const pattern of command.patterns) {
      const extracted = this.extractFromPattern(text, pattern);
      
      if (extracted) {
        Object.assign(entities, extracted);
        break;
      }
    }

    // Resolve context references
    if (context) {
      this.resolveContextReferences(entities, context);
    }

    return entities;
  }

  /**
   * Extract entities from text using a pattern
   */
  private extractFromPattern(text: string, pattern: string): Record<string, any> | null {
    // Convert pattern to regex
    // "open file {filename}" → /^open file (.+)$/
    const paramNames: string[] = [];
    const regexPattern = pattern.replace(/\{([^}]+)\}/g, (_, paramName) => {
      paramNames.push(paramName);
      return '(.+?)';
    });

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    const match = text.match(regex);

    if (!match) {
      return null;
    }

    // Extract parameter values
    const entities: Record<string, any> = {};
    paramNames.forEach((paramName, index) => {
      entities[paramName] = match[index + 1].trim();
    });

    return entities;
  }

  /**
   * Resolve context references in entities
   */
  private resolveContextReferences(
    entities: Record<string, any>,
    context: WorkspaceContext
  ): void {
    // Resolve pronouns and references
    const pronouns = ['this', 'that', 'current', 'it', 'here'];

    Object.keys(entities).forEach(key => {
      const value = entities[key];

      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();

        // Check if value is a pronoun
        if (pronouns.includes(lowerValue)) {
          // Try to resolve from context
          if (key === 'filename' || key === 'file') {
            entities[key] = context.currentFile || value;
          } else if (key === 'text' || key === 'code') {
            entities[key] = context.selectedText || value;
          } else if (key === 'branch') {
            entities[key] = context.gitBranch || value;
          }
        }

        // Resolve "selected" or "selection"
        if (lowerValue === 'selected' || lowerValue === 'selection') {
          entities[key] = context.selectedText || '';
        }
      }
    });
  }

  /**
   * Parse multiple alternative transcriptions and return best match
   */
  parseAlternatives(
    alternatives: string[],
    options: ParseOptions = {}
  ): ParsedCommand | null {
    let bestCommand: ParsedCommand | null = null;
    let bestConfidence = 0;

    for (const text of alternatives) {
      const parsed = this.parse(text, options);

      if (parsed && parsed.confidence > bestConfidence) {
        bestCommand = parsed;
        bestConfidence = parsed.confidence;
      }
    }

    return bestCommand;
  }

  /**
   * Validate a parsed command
   */
  validate(command: ParsedCommand): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if command exists
    if (!command.matchedCommand) {
      errors.push('Command not found');
      return { valid: false, errors };
    }

    // Check confidence
    if (command.confidence < this.DEFAULT_CONFIDENCE_THRESHOLD) {
      errors.push(`Low confidence: ${(command.confidence * 100).toFixed(0)}%`);
    }

    // Check required parameters
    const requiredParams = this.getRequiredParams(command.matchedCommand);
    
    for (const param of requiredParams) {
      if (!command.params[param] || command.params[param] === '') {
        errors.push(`Missing required parameter: ${param}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get required parameters from command pattern
   */
  private getRequiredParams(command: CommandDefinition): string[] {
    const params = new Set<string>();

    command.patterns.forEach(pattern => {
      const matches = pattern.matchAll(/\{([^}]+)\}/g);
      
      for (const match of matches) {
        params.add(match[1]);
      }
    });

    return Array.from(params);
  }

  /**
   * Get suggestions for partial command
   */
  getSuggestions(partial: string, limit: number = 5): string[] {
    return commandRegistry.getSuggestions(partial, limit);
  }

  /**
   * Explain what a command will do
   */
  explainCommand(command: ParsedCommand): string {
    if (!command.matchedCommand) {
      return 'Unknown command';
    }

    let explanation = command.matchedCommand.description;

    // Add parameter details
    if (Object.keys(command.params).length > 0) {
      explanation += ' with:\n';
      Object.entries(command.params).forEach(([key, value]) => {
        explanation += `- ${key}: ${value}\n`;
      });
    }

    // Add confidence
    explanation += `\nConfidence: ${(command.confidence * 100).toFixed(0)}%`;

    return explanation;
  }

  /**
   * Check if command requires confirmation
   */
  requiresConfirmation(command: ParsedCommand): boolean {
    return command.matchedCommand?.requiresConfirmation ?? false;
  }

  /**
   * Parse intent from text (simpler than full parse)
   */
  parseIntent(text: string): string | null {
    const parsed = this.parse(text, { confidenceThreshold: 0.5 });
    return parsed?.intent || null;
  }

  /**
   * Check if text is a command
   */
  isCommand(text: string): boolean {
    const parsed = this.parse(text, { confidenceThreshold: 0.5 });
    return parsed !== null;
  }
}

// Export singleton instance
export const commandParser = new CommandParser();
