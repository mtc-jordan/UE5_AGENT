/**
 * Voice Learning Service
 * Adaptive command recognition based on usage patterns
 */

export interface CommandUsage {
  commandId: string;
  count: number;
  lastUsed: Date;
  variations: Map<string, number>;
}

class VoiceLearningService {
  private usageStats: Map<string, CommandUsage> = new Map();
  private userPreferences: Map<string, string> = new Map();

  /**
   * Record command usage
   */
  recordUsage(commandId: string, spokenText: string): void {
    let usage = this.usageStats.get(commandId);
    
    if (!usage) {
      usage = {
        commandId,
        count: 0,
        lastUsed: new Date(),
        variations: new Map()
      };
      this.usageStats.set(commandId, usage);
    }

    usage.count++;
    usage.lastUsed = new Date();
    
    const normalizedText = spokenText.toLowerCase().trim();
    const currentCount = usage.variations.get(normalizedText) || 0;
    usage.variations.set(normalizedText, currentCount + 1);

    this.saveStats();
  }

  /**
   * Get most frequently used commands
   */
  getTopCommands(limit: number = 10): CommandUsage[] {
    return Array.from(this.usageStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get preferred variation for a command
   */
  getPreferredVariation(commandId: string): string | null {
    const usage = this.usageStats.get(commandId);
    if (!usage || usage.variations.size === 0) {
      return null;
    }

    let maxCount = 0;
    let preferred = '';
    
    usage.variations.forEach((count, variation) => {
      if (count > maxCount) {
        maxCount = count;
        preferred = variation;
      }
    });

    return preferred;
  }

  /**
   * Learn user preference for ambiguous commands
   */
  learnPreference(ambiguousText: string, chosenCommandId: string): void {
    this.userPreferences.set(ambiguousText.toLowerCase(), chosenCommandId);
    this.saveStats();
  }

  /**
   * Get learned preference
   */
  getPreference(ambiguousText: string): string | null {
    return this.userPreferences.get(ambiguousText.toLowerCase()) || null;
  }

  /**
   * Calculate command score for ranking
   */
  getCommandScore(commandId: string): number {
    const usage = this.usageStats.get(commandId);
    if (!usage) return 0;

    const recencyWeight = 0.3;
    const frequencyWeight = 0.7;

    const daysSinceUsed = (Date.now() - usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - (daysSinceUsed / 30));

    const frequencyScore = Math.min(1, usage.count / 100);

    return (recencyScore * recencyWeight) + (frequencyScore * frequencyWeight);
  }

  /**
   * Save stats to localStorage
   */
  private saveStats(): void {
    const stats = Array.from(this.usageStats.entries()).map(([id, usage]) => ({
      id,
      count: usage.count,
      lastUsed: usage.lastUsed.toISOString(),
      variations: Array.from(usage.variations.entries())
    }));

    const prefs = Array.from(this.userPreferences.entries());

    localStorage.setItem('voice_learning_stats', JSON.stringify(stats));
    localStorage.setItem('voice_learning_prefs', JSON.stringify(prefs));
  }

  /**
   * Load stats from localStorage
   */
  loadStats(): void {
    const statsStr = localStorage.getItem('voice_learning_stats');
    const prefsStr = localStorage.getItem('voice_learning_prefs');

    if (statsStr) {
      const stats = JSON.parse(statsStr);
      this.usageStats.clear();
      stats.forEach((item: any) => {
        this.usageStats.set(item.id, {
          commandId: item.id,
          count: item.count,
          lastUsed: new Date(item.lastUsed),
          variations: new Map(item.variations)
        });
      });
    }

    if (prefsStr) {
      const prefs = JSON.parse(prefsStr);
      this.userPreferences = new Map(prefs);
    }
  }

  /**
   * Clear all learning data
   */
  clearLearning(): void {
    this.usageStats.clear();
    this.userPreferences.clear();
    localStorage.removeItem('voice_learning_stats');
    localStorage.removeItem('voice_learning_prefs');
  }
}

export const voiceLearningService = new VoiceLearningService();
