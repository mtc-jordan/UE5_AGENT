/**
 * useVoiceCommands Hook
 * React hook for voice command integration with hotkey support
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { voiceRecognitionService, RecognitionResult } from '../services/voice-recognition';
import { commandParser, ParsedCommand } from '../services/command-parser';
import { voiceContextManager, WorkspaceContext } from '../services/voice-context';

export interface VoiceCommandsOptions {
  enabled?: boolean;
  hotkey?: string;  // e.g., 'ctrl+shift+v' or 'alt+v'
  pushToTalk?: boolean;  // If true, hold hotkey to talk
  autoStart?: boolean;
  onCommandParsed?: (command: ParsedCommand) => void;
  onCommandExecuted?: (command: ParsedCommand, result: any) => void;
  onError?: (error: string) => void;
}

export interface VoiceCommandsState {
  isListening: boolean;
  isEnabled: boolean;
  hasPermission: boolean;
  transcript: string;
  interimTranscript: string;
  lastCommand: ParsedCommand | null;
  error: string | null;
}

export const useVoiceCommands = (options: VoiceCommandsOptions = {}) => {
  const {
    enabled = true,
    hotkey = 'ctrl+shift+v',
    pushToTalk = false,
    autoStart = false,
    onCommandParsed,
    onCommandExecuted,
    onError
  } = options;

  const [state, setState] = useState<VoiceCommandsState>({
    isListening: false,
    isEnabled: false,
    hasPermission: false,
    transcript: '',
    interimTranscript: '',
    lastCommand: null,
    error: null
  });

  const hotkeyPressedRef = useRef(false);
  const isInitializedRef = useRef(false);

  /**
   * Update state helper
   */
  const updateState = useCallback((updates: Partial<VoiceCommandsState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Handle recognition result
   */
  const handleResult = useCallback((result: RecognitionResult) => {
    updateState({
      transcript: result.transcript,
      interimTranscript: '',
      error: null
    });

    // Parse command
    const context = voiceContextManager.getContext();
    const parsed = commandParser.parse(result.transcript, { context });

    if (parsed) {
      updateState({ lastCommand: parsed });
      
      // Add to context
      voiceContextManager.addRecentCommand(parsed);

      // Notify parent
      if (onCommandParsed) {
        onCommandParsed(parsed);
      }
    } else {
      const errorMsg = `Command not recognized: "${result.transcript}"`;
      updateState({ error: errorMsg });
      
      if (onError) {
        onError(errorMsg);
      }
    }

    // Stop listening if push-to-talk
    if (pushToTalk && !hotkeyPressedRef.current) {
      stopListening();
    }
  }, [pushToTalk, onCommandParsed, onError, updateState]);

  /**
   * Handle interim result
   */
  const handleInterim = useCallback((result: RecognitionResult) => {
    updateState({
      interimTranscript: result.transcript,
      error: null
    });
  }, [updateState]);

  /**
   * Handle recognition error
   */
  const handleError = useCallback((error: any) => {
    const errorMsg = error.message || 'Voice recognition error';
    updateState({
      error: errorMsg,
      isListening: false
    });

    if (onError) {
      onError(errorMsg);
    }
  }, [onError, updateState]);

  /**
   * Handle recognition start
   */
  const handleStart = useCallback(() => {
    updateState({
      isListening: true,
      error: null
    });
  }, [updateState]);

  /**
   * Handle recognition end
   */
  const handleEnd = useCallback(() => {
    updateState({
      isListening: false
    });
  }, [updateState]);

  /**
   * Start listening
   */
  const startListening = useCallback(async () => {
    if (!enabled || state.isListening) {
      return;
    }

    try {
      // Request permission if not granted
      if (!state.hasPermission) {
        const granted = await voiceRecognitionService.requestPermission();
        updateState({ hasPermission: granted });

        if (!granted) {
          throw new Error('Microphone permission denied');
        }
      }

      voiceRecognitionService.startListening({
        continuous: !pushToTalk,
        interimResults: true
      });

      updateState({ isEnabled: true });
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start voice recognition';
      updateState({ error: errorMsg });

      if (onError) {
        onError(errorMsg);
      }
    }
  }, [enabled, state.isListening, state.hasPermission, pushToTalk, onError, updateState]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (!state.isListening) {
      return;
    }

    voiceRecognitionService.stopListening();
    updateState({
      isEnabled: false,
      transcript: '',
      interimTranscript: ''
    });
  }, [state.isListening, updateState]);

  /**
   * Toggle listening
   */
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  /**
   * Parse hotkey string
   */
  const parseHotkey = (hotkeyStr: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } => {
    const parts = hotkeyStr.toLowerCase().split('+');
    return {
      ctrl: parts.includes('ctrl') || parts.includes('control'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt'),
      key: parts[parts.length - 1]
    };
  };

  /**
   * Handle keyboard events for hotkey
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const { ctrl, shift, alt, key } = parseHotkey(hotkey);

    // Check if hotkey matches
    const matches = 
      event.ctrlKey === ctrl &&
      event.shiftKey === shift &&
      event.altKey === alt &&
      event.key.toLowerCase() === key;

    if (matches) {
      event.preventDefault();
      hotkeyPressedRef.current = true;

      if (pushToTalk) {
        // Start listening on key down
        if (!state.isListening) {
          startListening();
        }
      } else {
        // Toggle on key press
        toggleListening();
      }
    }
  }, [enabled, hotkey, pushToTalk, state.isListening, startListening, toggleListening]);

  /**
   * Handle key up for push-to-talk
   */
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!enabled || !pushToTalk) return;

    const { ctrl, shift, alt, key } = parseHotkey(hotkey);

    const matches = 
      event.key.toLowerCase() === key &&
      (ctrl ? event.ctrlKey : true) &&
      (shift ? event.shiftKey : true) &&
      (alt ? event.altKey : true);

    if (matches) {
      hotkeyPressedRef.current = false;
      stopListening();
    }
  }, [enabled, pushToTalk, hotkey, stopListening]);

  /**
   * Initialize voice recognition
   */
  useEffect(() => {
    if (isInitializedRef.current) return;

    // Set up event listeners
    voiceRecognitionService.on('result', handleResult);
    voiceRecognitionService.on('interim', handleInterim);
    voiceRecognitionService.on('error', handleError);
    voiceRecognitionService.on('start', handleStart);
    voiceRecognitionService.on('end', handleEnd);

    // Set up keyboard listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Check support
    const supported = voiceRecognitionService.isSupported();
    if (!supported) {
      updateState({ error: 'Voice commands not supported in this browser' });
    }

    isInitializedRef.current = true;

    // Auto-start if requested
    if (autoStart && supported) {
      startListening();
    }

    // Cleanup
    return () => {
      voiceRecognitionService.off('result', handleResult);
      voiceRecognitionService.off('interim', handleInterim);
      voiceRecognitionService.off('error', handleError);
      voiceRecognitionService.off('start', handleStart);
      voiceRecognitionService.off('end', handleEnd);

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      stopListening();
    };
  }, [
    handleResult,
    handleInterim,
    handleError,
    handleStart,
    handleEnd,
    handleKeyDown,
    handleKeyUp,
    autoStart,
    startListening,
    stopListening,
    updateState
  ]);

  /**
   * Update workspace context
   */
  const updateContext = useCallback((updates: Partial<WorkspaceContext>) => {
    Object.entries(updates).forEach(([key, value]) => {
      switch (key) {
        case 'currentFile':
          voiceContextManager.setCurrentFile(value);
          break;
        case 'openFiles':
          voiceContextManager.setOpenFiles(value);
          break;
        case 'selectedText':
          voiceContextManager.setSelectedText(value);
          break;
        case 'cursorPosition':
          if (value) {
            voiceContextManager.setCursorPosition(value.line, value.column);
          }
          break;
        case 'gitBranch':
          voiceContextManager.setGitBranch(value);
          break;
        case 'onlineUsers':
          voiceContextManager.setOnlineUsers(value);
          break;
      }
    });
  }, []);

  /**
   * Execute a command
   */
  const executeCommand = useCallback((command: ParsedCommand, result: any) => {
    voiceContextManager.addConversationTurn(command, result);

    if (onCommandExecuted) {
      onCommandExecuted(command, result);
    }
  }, [onCommandExecuted]);

  return {
    // State
    ...state,
    
    // Actions
    startListening,
    stopListening,
    toggleListening,
    updateContext,
    executeCommand,

    // Utilities
    isSupported: voiceRecognitionService.isSupported(),
    hotkey,
    pushToTalk
  };
};
