/**
 * Voice Feedback Service
 * Provides audio feedback and text-to-speech responses
 */

export interface SpeechOptions {
  voice?: string;
  rate?: number;  // 0.1 to 10, default 1
  pitch?: number;  // 0 to 2, default 1
  volume?: number;  // 0 to 1, default 1
  language?: string;
}

export type SoundType = 'success' | 'error' | 'listening' | 'processing' | 'notification';

class VoiceFeedbackService {
  private synthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private enabled: boolean = true;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private initialize(): void {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      
      // Load voices
      this.loadVoices();
      
      // Voices might load asynchronously
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }

    // Initialize audio context for sound effects
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
  }

  /**
   * Load available voices
   */
  private loadVoices(): void {
    if (this.synthesis) {
      this.voices = this.synthesis.getVoices();
    }
  }

  /**
   * Check if text-to-speech is supported
   */
  isSupported(): boolean {
    return this.synthesis !== null;
  }

  /**
   * Get available voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  /**
   * Get voice by name or language
   */
  getVoice(nameOrLang: string): SpeechSynthesisVoice | null {
    const lowerQuery = nameOrLang.toLowerCase();
    
    // Try exact name match first
    let voice = this.voices.find(v => v.name.toLowerCase() === lowerQuery);
    
    // Try language match
    if (!voice) {
      voice = this.voices.find(v => v.lang.toLowerCase().startsWith(lowerQuery));
    }
    
    // Try partial name match
    if (!voice) {
      voice = this.voices.find(v => v.name.toLowerCase().includes(lowerQuery));
    }
    
    return voice || null;
  }

  /**
   * Speak text using text-to-speech
   */
  async speak(text: string, options: SpeechOptions = {}): Promise<void> {
    if (!this.isSupported() || !this.enabled) {
      return;
    }

    // Cancel any ongoing speech
    this.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Set options
      if (options.voice) {
        const voice = this.getVoice(options.voice);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;

      if (options.language) {
        utterance.lang = options.language;
      }

      // Event handlers
      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      // Store and speak
      this.currentUtterance = utterance;
      this.synthesis!.speak(utterance);
    });
  }

  /**
   * Cancel current speech
   */
  cancel(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  /**
   * Pause current speech
   */
  pause(): void {
    if (this.synthesis && this.synthesis.speaking) {
      this.synthesis.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    if (this.synthesis && this.synthesis.paused) {
      this.synthesis.resume();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis?.speaking ?? false;
  }

  /**
   * Enable/disable voice feedback
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    
    if (!enabled) {
      this.cancel();
    }
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Play a sound effect
   */
  playSound(type: SoundType): void {
    if (!this.audioContext || !this.enabled) {
      return;
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    switch (type) {
      case 'success':
        this.playSuccessSound(ctx, now);
        break;
      case 'error':
        this.playErrorSound(ctx, now);
        break;
      case 'listening':
        this.playListeningSound(ctx, now);
        break;
      case 'processing':
        this.playProcessingSound(ctx, now);
        break;
      case 'notification':
        this.playNotificationSound(ctx, now);
        break;
    }
  }

  /**
   * Play success sound (ascending tones)
   */
  private playSuccessSound(ctx: AudioContext, startTime: number): void {
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freq;
      osc.type = 'sine';

      const time = startTime + (i * 0.1);
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

      osc.start(time);
      osc.stop(time + 0.2);
    });
  }

  /**
   * Play error sound (descending tones)
   */
  private playErrorSound(ctx: AudioContext, startTime: number): void {
    const frequencies = [783.99, 659.25, 523.25]; // G5, E5, C5
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freq;
      osc.type = 'square';

      const time = startTime + (i * 0.1);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

      osc.start(time);
      osc.stop(time + 0.15);
    });
  }

  /**
   * Play listening sound (single beep)
   */
  private playListeningSound(ctx: AudioContext, startTime: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 800;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

    osc.start(startTime);
    osc.stop(startTime + 0.1);
  }

  /**
   * Play processing sound (pulsing tone)
   */
  private playProcessingSound(ctx: AudioContext, startTime: number): void {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = 600 + (i * 100);
      osc.type = 'sine';

      const time = startTime + (i * 0.15);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

      osc.start(time);
      osc.stop(time + 0.1);
    }
  }

  /**
   * Play notification sound (two-tone)
   */
  private playNotificationSound(ctx: AudioContext, startTime: number): void {
    const frequencies = [659.25, 783.99]; // E5, G5
    
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freq;
      osc.type = 'sine';

      const time = startTime + (i * 0.1);
      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

      osc.start(time);
      osc.stop(time + 0.15);
    });
  }

  /**
   * Speak command confirmation
   */
  async confirmCommand(commandDescription: string): Promise<void> {
    await this.speak(`${commandDescription}`, {
      rate: 1.1,
      pitch: 1
    });
  }

  /**
   * Speak error message
   */
  async speakError(error: string): Promise<void> {
    await this.speak(`Error: ${error}`, {
      rate: 0.9,
      pitch: 0.9
    });
  }

  /**
   * Speak success message
   */
  async speakSuccess(message: string): Promise<void> {
    await this.speak(message, {
      rate: 1.1,
      pitch: 1.1
    });
  }

  /**
   * Set voice by name or language
   */
  setVoice(nameOrLang: string): boolean {
    const voice = this.getVoice(nameOrLang);
    return voice !== null;
  }

  /**
   * Set language
   */
  setLanguage(language: string): void {
    // Language will be used in speak() options
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancel();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const voiceFeedbackService = new VoiceFeedbackService();
