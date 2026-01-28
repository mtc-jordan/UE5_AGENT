/**
 * Voice Recognition Service
 * Handles Web Speech API integration for voice input
 */

export interface ListenOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  maxAlternatives?: number;
}

export interface RecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: string[];
}

export type RecognitionEventType = 'result' | 'error' | 'start' | 'end' | 'interim';

export interface RecognitionError {
  error: string;
  message: string;
}

type EventCallback = (data: any) => void;

class VoiceRecognitionService {
  private recognition: any | null = null;
  private isListening: boolean = false;
  private eventHandlers: Map<RecognitionEventType, Set<EventCallback>> = new Map();
  private permissionGranted: boolean = false;

  constructor() {
    this.initializeEventHandlers();
  }

  /**
   * Check if Web Speech API is supported in the browser
   */
  isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  /**
   * Get the SpeechRecognition constructor
   */
  private getSpeechRecognition(): any {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }

  /**
   * Initialize event handler maps
   */
  private initializeEventHandlers(): void {
    const events: RecognitionEventType[] = ['result', 'error', 'start', 'end', 'interim'];
    events.forEach(event => {
      this.eventHandlers.set(event, new Set());
    });
  }

  /**
   * Request microphone permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      this.permissionGranted = true;
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      this.permissionGranted = false;
      return false;
    }
  }

  /**
   * Initialize the speech recognition instance
   */
  private initialize(options: ListenOptions = {}): void {
    if (!this.isSupported()) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    const SpeechRecognition = this.getSpeechRecognition();
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = options.continuous ?? true;
    this.recognition.interimResults = options.interimResults ?? true;
    this.recognition.lang = options.language ?? 'en-US';
    this.recognition.maxAlternatives = options.maxAlternatives ?? 3;

    // Set up event handlers
    this.setupRecognitionHandlers();
  }

  /**
   * Set up recognition event handlers
   */
  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    // Handle recognition results
    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      // Get alternatives
      const alternatives: string[] = [];
      for (let i = 1; i < result.length && i < 3; i++) {
        alternatives.push(result[i].transcript.trim());
      }

      const recognitionResult: RecognitionResult = {
        transcript,
        confidence,
        isFinal,
        alternatives: alternatives.length > 0 ? alternatives : undefined
      };

      // Emit appropriate event
      if (isFinal) {
        this.emit('result', recognitionResult);
      } else {
        this.emit('interim', recognitionResult);
      }
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      const error: RecognitionError = {
        error: event.error,
        message: this.getErrorMessage(event.error)
      };
      this.emit('error', error);
      
      // Stop listening on error
      this.isListening = false;
    };

    // Handle start
    this.recognition.onstart = () => {
      this.isListening = true;
      this.emit('start', { timestamp: Date.now() });
    };

    // Handle end
    this.recognition.onend = () => {
      this.isListening = false;
      this.emit('end', { timestamp: Date.now() });
    };
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'no-speech': 'No speech was detected. Please try again.',
      'aborted': 'Speech recognition was aborted.',
      'audio-capture': 'No microphone was found. Ensure that a microphone is installed.',
      'network': 'Network error occurred. Please check your internet connection.',
      'not-allowed': 'Microphone permission was denied. Please allow microphone access.',
      'service-not-allowed': 'Speech recognition service is not allowed.',
      'bad-grammar': 'Grammar error occurred.',
      'language-not-supported': 'The selected language is not supported.'
    };

    return errorMessages[error] || `An unknown error occurred: ${error}`;
  }

  /**
   * Start listening for voice input
   */
  startListening(options: ListenOptions = {}): void {
    if (!this.permissionGranted) {
      throw new Error('Microphone permission not granted. Call requestPermission() first.');
    }

    if (this.isListening) {
      console.warn('Already listening');
      return;
    }

    // Initialize if not already done
    if (!this.recognition) {
      this.initialize(options);
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      throw error;
    }
  }

  /**
   * Stop listening for voice input
   */
  stopListening(): void {
    if (!this.isListening || !this.recognition) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  }

  /**
   * Abort listening immediately
   */
  abort(): void {
    if (!this.recognition) {
      return;
    }

    try {
      this.recognition.abort();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to abort recognition:', error);
    }
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Check if permission is granted
   */
  hasPermission(): boolean {
    return this.permissionGranted;
  }

  /**
   * Set recognition language
   */
  setLanguage(language: string): void {
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  /**
   * Register event handler
   */
  on(event: RecognitionEventType, callback: EventCallback): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(callback);
    }
  }

  /**
   * Unregister event handler
   */
  off(event: RecognitionEventType, callback: EventCallback): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  /**
   * Emit event to all registered handlers
   */
  private emit(event: RecognitionEventType, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.abort();
    this.recognition = null;
    this.eventHandlers.clear();
    this.permissionGranted = false;
  }
}

// Export singleton instance
export const voiceRecognitionService = new VoiceRecognitionService();
