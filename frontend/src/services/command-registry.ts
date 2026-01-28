/**
 * Command Registry
 * Stores and manages all available voice commands
 */

import { WorkspaceContext } from './voice-context';

export interface CommandDefinition {
  id: string;
  patterns: string[];
  intent: string;
  description: string;
  examples: string[];
  category: 'file' | 'navigation' | 'git' | 'ai' | 'collaboration' | 'workspace' | 'general';
  handler: (params: Record<string, any>, context: WorkspaceContext) => Promise<CommandResult>;
  requiresConfirmation?: boolean;
  aliases?: string[];
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
}

class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeCategories();
  }

  /**
   * Initialize category index
   */
  private initializeCategories(): void {
    const categories = ['file', 'navigation', 'git', 'ai', 'collaboration', 'workspace', 'general'];
    categories.forEach(category => {
      this.categoryIndex.set(category, new Set());
    });
  }

  /**
   * Register a new command
   */
  register(command: CommandDefinition): void {
    // Validate command
    if (!command.id || !command.patterns || command.patterns.length === 0) {
      throw new Error('Command must have an id and at least one pattern');
    }

    if (this.commands.has(command.id)) {
      console.warn(`Command ${command.id} is already registered. Overwriting.`);
    }

    // Store command
    this.commands.set(command.id, command);

    // Update category index
    const categoryCommands = this.categoryIndex.get(command.category);
    if (categoryCommands) {
      categoryCommands.add(command.id);
    }
  }

  /**
   * Register multiple commands at once
   */
  registerBatch(commands: CommandDefinition[]): void {
    commands.forEach(command => this.register(command));
  }

  /**
   * Get command by ID
   */
  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  /**
   * Get all commands
   */
  getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): CommandDefinition[] {
    const commandIds = this.categoryIndex.get(category);
    if (!commandIds) {
      return [];
    }

    return Array.from(commandIds)
      .map(id => this.commands.get(id))
      .filter((cmd): cmd is CommandDefinition => cmd !== undefined);
  }

  /**
   * Search commands by keyword
   */
  searchCommands(keyword: string): CommandDefinition[] {
    const lowerKeyword = keyword.toLowerCase();
    
    return this.getAllCommands().filter(command => {
      // Search in description
      if (command.description.toLowerCase().includes(lowerKeyword)) {
        return true;
      }

      // Search in patterns
      if (command.patterns.some(pattern => pattern.toLowerCase().includes(lowerKeyword))) {
        return true;
      }

      // Search in examples
      if (command.examples.some(example => example.toLowerCase().includes(lowerKeyword))) {
        return true;
      }

      // Search in aliases
      if (command.aliases?.some(alias => alias.toLowerCase().includes(lowerKeyword))) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get command suggestions based on partial input
   */
  getSuggestions(partial: string, limit: number = 5): string[] {
    const lowerPartial = partial.toLowerCase().trim();
    
    if (!lowerPartial) {
      return [];
    }

    const suggestions: Array<{ text: string; score: number }> = [];

    this.getAllCommands().forEach(command => {
      // Check patterns
      command.patterns.forEach(pattern => {
        const lowerPattern = pattern.toLowerCase();
        
        if (lowerPattern.startsWith(lowerPartial)) {
          // Exact prefix match - highest score
          suggestions.push({ text: pattern, score: 100 });
        } else if (lowerPattern.includes(lowerPartial)) {
          // Contains match - medium score
          suggestions.push({ text: pattern, score: 50 });
        }
      });

      // Check examples
      command.examples.forEach(example => {
        const lowerExample = example.toLowerCase();
        
        if (lowerExample.startsWith(lowerPartial)) {
          suggestions.push({ text: example, score: 90 });
        } else if (lowerExample.includes(lowerPartial)) {
          suggestions.push({ text: example, score: 40 });
        }
      });
    });

    // Sort by score (descending) and return unique suggestions
    return [...new Set(
      suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.text)
    )];
  }

  /**
   * Find matching commands for a given text
   */
  findMatches(text: string): Array<{ command: CommandDefinition; confidence: number }> {
    const lowerText = text.toLowerCase().trim();
    const matches: Array<{ command: CommandDefinition; confidence: number }> = [];

    this.getAllCommands().forEach(command => {
      command.patterns.forEach(pattern => {
        const confidence = this.calculateMatchConfidence(lowerText, pattern.toLowerCase());
        
        if (confidence > 0.5) {
          matches.push({ command, confidence });
        }
      });
    });

    // Sort by confidence (descending)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate match confidence between text and pattern
   */
  private calculateMatchConfidence(text: string, pattern: string): number {
    // Remove parameter placeholders for matching
    const cleanPattern = pattern.replace(/\{[^}]+\}/g, '(.+)');
    
    // Convert to regex
    const regex = new RegExp(`^${cleanPattern}$`, 'i');
    
    if (regex.test(text)) {
      // Exact match
      return 1.0;
    }

    // Calculate similarity using Levenshtein distance
    const distance = this.levenshteinDistance(text, pattern);
    const maxLength = Math.max(text.length, pattern.length);
    const similarity = 1 - (distance / maxLength);

    return similarity;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get help text for a command
   */
  getCommandHelp(commandId: string): string | null {
    const command = this.commands.get(commandId);
    
    if (!command) {
      return null;
    }

    let help = `**${command.description}**\n\n`;
    help += `**Category:** ${command.category}\n\n`;
    help += `**Patterns:**\n`;
    command.patterns.forEach(pattern => {
      help += `- ${pattern}\n`;
    });
    help += `\n**Examples:**\n`;
    command.examples.forEach(example => {
      help += `- "${example}"\n`;
    });

    if (command.aliases && command.aliases.length > 0) {
      help += `\n**Aliases:** ${command.aliases.join(', ')}`;
    }

    return help;
  }

  /**
   * Get all commands as help text
   */
  getAllCommandsHelp(): string {
    let help = '# Available Voice Commands\n\n';

    const categories = Array.from(this.categoryIndex.keys());
    
    categories.forEach(category => {
      const commands = this.getCommandsByCategory(category);
      
      if (commands.length === 0) {
        return;
      }

      help += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Commands\n\n`;
      
      commands.forEach(command => {
        help += `### ${command.description}\n`;
        help += `**Examples:** ${command.examples.join(', ')}\n\n`;
      });
    });

    return help;
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.commands.clear();
    this.categoryIndex.forEach(set => set.clear());
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    
    this.categoryIndex.forEach((commandIds, category) => {
      byCategory[category] = commandIds.size;
    });

    return {
      total: this.commands.size,
      byCategory
    };
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();
