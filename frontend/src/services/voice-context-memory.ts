/**
 * Voice Context Memory Service
 * Remember previous commands for intelligent follow-up actions
 */

export interface ContextEntry {
  command: string;
  result: any;
  timestamp: Date;
  entities: Map<string, any>;
}

class VoiceContextMemoryService {
  private history: ContextEntry[] = [];
  private maxHistorySize: number = 50;
  private currentContext: Map<string, any> = new Map();

  /**
   * Add command to history
   */
  addToHistory(command: string, result: any, entities: Map<string, any> = new Map()): void {
    const entry: ContextEntry = {
      command,
      result,
      timestamp: new Date(),
      entities
    };

    this.history.unshift(entry);
    
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    this.updateContext(entities);
  }

  /**
   * Update current context with entities
   */
  private updateContext(entities: Map<string, any>): void {
    entities.forEach((value, key) => {
      this.currentContext.set(key, value);
    });
  }

  /**
   * Resolve references in command (this, that, it, etc.)
   */
  resolveReferences(command: string): string {
    let resolved = command;

    const referencePatterns = [
      { pattern: /\b(this|that|it)\b/gi, contextKey: 'last_entity' },
      { pattern: /\bthere\b/gi, contextKey: 'last_location' },
      { pattern: /\bthe same\b/gi, contextKey: 'last_value' }
    ];

    referencePatterns.forEach(({ pattern, contextKey }) => {
      if (pattern.test(resolved)) {
        const value = this.currentContext.get(contextKey);
        if (value) {
          resolved = resolved.replace(pattern, String(value));
        }
      }
    });

    return resolved;
  }

  /**
   * Get last command of a specific type
   */
  getLastCommand(category?: string): ContextEntry | null {
    if (!category) {
      return this.history[0] || null;
    }

    return this.history.find(entry => 
      entry.command.toLowerCase().includes(category.toLowerCase())
    ) || null;
  }

  /**
   * Get context value by key
   */
  getContextValue(key: string): any {
    return this.currentContext.get(key);
  }

  /**
   * Set context value
   */
  setContextValue(key: string, value: any): void {
    this.currentContext.set(key, value);
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.currentContext.clear();
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): ContextEntry[] {
    return limit ? this.history.slice(0, limit) : [...this.history];
  }

  /**
   * Search history for patterns
   */
  searchHistory(keyword: string): ContextEntry[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.history.filter(entry => 
      entry.command.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get frequently used entities
   */
  getFrequentEntities(limit: number = 10): Array<[string, number]> {
    const entityCounts = new Map<string, number>();

    this.history.forEach(entry => {
      entry.entities.forEach((value, key) => {
        const count = entityCounts.get(key) || 0;
        entityCounts.set(key, count + 1);
      });
    });

    return Array.from(entityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.currentContext.clear();
  }
}

export const voiceContextMemoryService = new VoiceContextMemoryService();
