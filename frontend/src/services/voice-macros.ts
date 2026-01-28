/**
 * Voice Macros Service
 * Record and playback command sequences
 */

import { voiceFeedbackService } from './voice-feedback';
import { commandChainingService } from './command-chaining';

export interface Macro {
  id: string;
  name: string;
  commands: string[];
  createdAt: Date;
  usageCount: number;
}

class VoiceMacrosService {
  private macros: Map<string, Macro> = new Map();
  private isRecording: boolean = false;
  private recordingCommands: string[] = [];
  private recordingName: string = '';

  /**
   * Start recording a macro
   */
  startRecording(name: string): void {
    this.isRecording = true;
    this.recordingName = name;
    this.recordingCommands = [];
    voiceFeedbackService.speak(`Recording macro ${name}`);
  }

  /**
   * Add command to current recording
   */
  recordCommand(command: string): void {
    if (this.isRecording) {
      this.recordingCommands.push(command);
    }
  }

  /**
   * Stop recording and save macro
   */
  stopRecording(): Macro | null {
    if (!this.isRecording) {
      return null;
    }

    const macro: Macro = {
      id: `macro_${Date.now()}`,
      name: this.recordingName,
      commands: [...this.recordingCommands],
      createdAt: new Date(),
      usageCount: 0
    };

    this.macros.set(macro.name.toLowerCase(), macro);
    this.isRecording = false;
    this.recordingCommands = [];
    this.recordingName = '';

    voiceFeedbackService.speak(`Macro saved with ${macro.commands.length} commands`);
    return macro;
  }

  /**
   * Cancel current recording
   */
  cancelRecording(): void {
    this.isRecording = false;
    this.recordingCommands = [];
    this.recordingName = '';
    voiceFeedbackService.speak('Recording cancelled');
  }

  /**
   * Play a macro by name
   */
  async playMacro(name: string): Promise<any> {
    const macro = this.macros.get(name.toLowerCase());
    
    if (!macro) {
      voiceFeedbackService.speak(`Macro ${name} not found`);
      return { success: false, message: 'Macro not found' };
    }

    macro.usageCount++;
    voiceFeedbackService.speak(`Playing macro ${name}`);

    // Execute all commands in sequence
    const chainedCommand = macro.commands.join(' and ');
    return await commandChainingService.executeChain(chainedCommand);
  }

  /**
   * Delete a macro
   */
  deleteMacro(name: string): boolean {
    const deleted = this.macros.delete(name.toLowerCase());
    if (deleted) {
      voiceFeedbackService.speak(`Macro ${name} deleted`);
    }
    return deleted;
  }

  /**
   * List all macros
   */
  listMacros(): Macro[] {
    return Array.from(this.macros.values());
  }

  /**
   * Get macro by name
   */
  getMacro(name: string): Macro | undefined {
    return this.macros.get(name.toLowerCase());
  }

  /**
   * Check if currently recording
   */
  isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Save macros to localStorage
   */
  saveMacros(): void {
    const macrosArray = Array.from(this.macros.values());
    localStorage.setItem('voice_macros', JSON.stringify(macrosArray));
  }

  /**
   * Load macros from localStorage
   */
  loadMacros(): void {
    const saved = localStorage.getItem('voice_macros');
    if (saved) {
      const macrosArray = JSON.parse(saved);
      this.macros.clear();
      macrosArray.forEach((macro: Macro) => {
        this.macros.set(macro.name.toLowerCase(), macro);
      });
    }
  }
}

export const voiceMacrosService = new VoiceMacrosService();
