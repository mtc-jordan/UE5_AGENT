/**
 * Voice Context Manager
 * Maintains workspace context for voice command resolution
 */

import { ParsedCommand } from './command-parser';

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface ConversationTurn {
  timestamp: number;
  command: ParsedCommand;
  result: any;
}

export interface WorkspaceContext {
  currentFile: string | null;
  openFiles: string[];
  selectedText: string | null;
  cursorPosition: { line: number; column: number } | null;
  gitBranch: string | null;
  onlineUsers: User[];
  recentCommands: ParsedCommand[];
  conversationHistory: ConversationTurn[];
}

class VoiceContextManager {
  private context: WorkspaceContext;
  private readonly MAX_HISTORY = 50;
  private readonly MAX_CONVERSATION = 20;

  constructor() {
    this.context = this.createInitialContext();
  }

  /**
   * Create initial empty context
   */
  private createInitialContext(): WorkspaceContext {
    return {
      currentFile: null,
      openFiles: [],
      selectedText: null,
      cursorPosition: null,
      gitBranch: null,
      onlineUsers: [],
      recentCommands: [],
      conversationHistory: []
    };
  }

  /**
   * Get current context
   */
  getContext(): WorkspaceContext {
    return { ...this.context };
  }

  /**
   * Update current file
   */
  setCurrentFile(filename: string | null): void {
    this.context.currentFile = filename;
  }

  /**
   * Update open files
   */
  setOpenFiles(files: string[]): void {
    this.context.openFiles = [...files];
  }

  /**
   * Add an open file
   */
  addOpenFile(filename: string): void {
    if (!this.context.openFiles.includes(filename)) {
      this.context.openFiles.push(filename);
    }
  }

  /**
   * Remove an open file
   */
  removeOpenFile(filename: string): void {
    this.context.openFiles = this.context.openFiles.filter(f => f !== filename);
  }

  /**
   * Update selected text
   */
  setSelectedText(text: string | null): void {
    this.context.selectedText = text;
  }

  /**
   * Update cursor position
   */
  setCursorPosition(line: number, column: number): void {
    this.context.cursorPosition = { line, column };
  }

  /**
   * Update Git branch
   */
  setGitBranch(branch: string | null): void {
    this.context.gitBranch = branch;
  }

  /**
   * Update online users
   */
  setOnlineUsers(users: User[]): void {
    this.context.onlineUsers = [...users];
  }

  /**
   * Add a command to recent history
   */
  addRecentCommand(command: ParsedCommand): void {
    this.context.recentCommands.unshift(command);

    // Limit history size
    if (this.context.recentCommands.length > this.MAX_HISTORY) {
      this.context.recentCommands = this.context.recentCommands.slice(0, this.MAX_HISTORY);
    }
  }

  /**
   * Add a conversation turn
   */
  addConversationTurn(command: ParsedCommand, result: any): void {
    this.context.conversationHistory.unshift({
      timestamp: Date.now(),
      command,
      result
    });

    // Limit conversation history
    if (this.context.conversationHistory.length > this.MAX_CONVERSATION) {
      this.context.conversationHistory = this.context.conversationHistory.slice(
        0,
        this.MAX_CONVERSATION
      );
    }
  }

  /**
   * Get recent commands
   */
  getRecentCommands(limit: number = 10): ParsedCommand[] {
    return this.context.recentCommands.slice(0, limit);
  }

  /**
   * Get last command
   */
  getLastCommand(): ParsedCommand | null {
    return this.context.recentCommands[0] || null;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(limit: number = 10): ConversationTurn[] {
    return this.context.conversationHistory.slice(0, limit);
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory(): void {
    this.context.conversationHistory = [];
  }

  /**
   * Clear recent commands
   */
  clearRecentCommands(): void {
    this.context.recentCommands = [];
  }

  /**
   * Reset context to initial state
   */
  reset(): void {
    this.context = this.createInitialContext();
  }

  /**
   * Get context summary for debugging
   */
  getSummary(): string {
    return `
Current File: ${this.context.currentFile || 'none'}
Open Files: ${this.context.openFiles.length}
Selected Text: ${this.context.selectedText ? `${this.context.selectedText.substring(0, 50)}...` : 'none'}
Git Branch: ${this.context.gitBranch || 'none'}
Online Users: ${this.context.onlineUsers.length}
Recent Commands: ${this.context.recentCommands.length}
Conversation History: ${this.context.conversationHistory.length}
    `.trim();
  }
}

// Export singleton instance
export const voiceContextManager = new VoiceContextManager();
