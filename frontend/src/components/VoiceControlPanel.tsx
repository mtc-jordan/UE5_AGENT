/**
 * Voice Control Panel Component
 * UI for voice command input and feedback
 */
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, X, HelpCircle } from 'lucide-react';
import { voiceRecognitionService, RecognitionResult, RecognitionError } from '../services/voice-recognition';
import { commandParser, ParsedCommand } from '../services/command-parser';
import { voiceContextManager } from '../services/voice-context';

type VoiceState = 'idle' | 'listening' | 'processing' | 'executing' | 'success' | 'error';

interface VoiceControlPanelProps {
  onCommandExecuted?: (command: ParsedCommand, result: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  onCommandExecuted,
  onError,
  className = ''
}) => {
  const [state, setState] = useState<VoiceState>('idle');
  const [isEnabled, setIsEnabled] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check browser support
    setIsSupported(voiceRecognitionService.isSupported());

    // Set up event listeners
    voiceRecognitionService.on('result', handleResult);
    voiceRecognitionService.on('interim', handleInterim);
    voiceRecognitionService.on('error', handleError);
    voiceRecognitionService.on('start', handleStart);
    voiceRecognitionService.on('end', handleEnd);

    return () => {
      // Clean up
      voiceRecognitionService.off('result', handleResult);
      voiceRecognitionService.off('interim', handleInterim);
      voiceRecognitionService.off('error', handleError);
      voiceRecognitionService.off('start', handleStart);
      voiceRecognitionService.off('end', handleEnd);
      
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleResult = (result: RecognitionResult) => {
    setTranscript(result.transcript);
    setInterimTranscript('');
    setState('processing');

    // Parse command
    const context = voiceContextManager.getContext();
    const parsed = commandParser.parse(result.transcript, { context });

    if (parsed) {
      setParsedCommand(parsed);
      setFeedback(`Command recognized: ${parsed.matchedCommand?.description || parsed.intent}`);
      
      // Add to context
      voiceContextManager.addRecentCommand(parsed);

      // Execute command (would be handled by parent component)
      if (onCommandExecuted) {
        setState('executing');
        onCommandExecuted(parsed, null);
      }

      // Show success
      setTimeout(() => {
        setState('success');
        setTimeout(() => {
          setState('idle');
          setTranscript('');
          setFeedback('');
        }, 2000);
      }, 500);
    } else {
      setState('error');
      setFeedback(`Command not recognized: "${result.transcript}"`);
      
      if (onError) {
        onError(`Command not recognized: "${result.transcript}"`);
      }

      setTimeout(() => {
        setState('idle');
        setTranscript('');
        setFeedback('');
      }, 3000);
    }
  };

  const handleInterim = (result: RecognitionResult) => {
    setInterimTranscript(result.transcript);
  };

  const handleError = (error: RecognitionError) => {
    setState('error');
    setFeedback(error.message);
    
    if (onError) {
      onError(error.message);
    }

    setTimeout(() => {
      setState('idle');
      setFeedback('');
    }, 3000);
  };

  const handleStart = () => {
    setState('listening');
    setFeedback('Listening...');
  };

  const handleEnd = () => {
    if (state === 'listening') {
      setState('idle');
      setFeedback('');
    }
  };

  const toggleVoiceControl = async () => {
    if (!isSupported) {
      setFeedback('Voice commands are not supported in this browser');
      return;
    }

    if (!isEnabled) {
      // Request permission and start
      try {
        const granted = await voiceRecognitionService.requestPermission();
        
        if (granted) {
          setHasPermission(true);
          voiceRecognitionService.startListening();
          setIsEnabled(true);
        } else {
          setFeedback('Microphone permission denied');
          if (onError) {
            onError('Microphone permission denied');
          }
        }
      } catch (error) {
        setFeedback('Failed to start voice recognition');
        if (onError) {
          onError('Failed to start voice recognition');
        }
      }
    } else {
      // Stop listening
      voiceRecognitionService.stopListening();
      setIsEnabled(false);
      setState('idle');
      setTranscript('');
      setInterimTranscript('');
      setFeedback('');
    }
  };

  const getStateColor = (): string => {
    switch (state) {
      case 'listening':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'executing':
        return 'bg-purple-500';
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStateIcon = () => {
    if (!isEnabled) {
      return <MicOff className="w-5 h-5" />;
    }

    switch (state) {
      case 'listening':
        return <Mic className="w-5 h-5 animate-pulse" />;
      case 'processing':
      case 'executing':
        return <Volume2 className="w-5 h-5 animate-pulse" />;
      case 'success':
        return <Volume2 className="w-5 h-5" />;
      case 'error':
        return <VolumeX className="w-5 h-5" />;
      default:
        return <Mic className="w-5 h-5" />;
    }
  };

  if (!isSupported) {
    return (
      <div className={`bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-yellow-400">
          <MicOff className="w-5 h-5" />
          <span className="text-sm">Voice commands are not supported in this browser</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-ue-panel border border-ue-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-ue-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStateColor()}`} />
          <span className="text-sm font-medium text-ue-text">Voice Control</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1 hover:bg-ue-hover rounded transition-colors"
            title="Help"
          >
            <HelpCircle className="w-4 h-4 text-ue-text-secondary" />
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-ue-hover rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-ue-text-secondary" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Microphone Button */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={toggleVoiceControl}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center
              transition-all duration-200 transform hover:scale-105
              ${isEnabled 
                ? `${getStateColor()} text-white shadow-lg` 
                : 'bg-ue-hover text-ue-text-secondary hover:bg-ue-border'
              }
            `}
            title={isEnabled ? 'Stop listening' : 'Start listening'}
          >
            {getStateIcon()}
          </button>

          {/* Status Text */}
          {feedback && (
            <div className="text-center">
              <p className={`text-sm ${
                state === 'error' ? 'text-red-400' : 
                state === 'success' ? 'text-green-400' : 
                'text-ue-text-secondary'
              }`}>
                {feedback}
              </p>
            </div>
          )}

          {/* Transcript Display */}
          {(transcript || interimTranscript) && (
            <div className="w-full bg-ue-bg rounded-lg p-3 border border-ue-border">
              <p className="text-sm text-ue-text">
                {transcript || <span className="text-ue-text-secondary italic">{interimTranscript}</span>}
              </p>
            </div>
          )}

          {/* Parsed Command Display */}
          {parsedCommand && (
            <div className="w-full bg-blue-900/20 border border-blue-600 rounded-lg p-3">
              <div className="text-xs text-blue-400 mb-1">Recognized Command:</div>
              <div className="text-sm text-ue-text font-medium">
                {parsedCommand.matchedCommand?.description}
              </div>
              {Object.keys(parsedCommand.params).length > 0 && (
                <div className="mt-2 text-xs text-ue-text-secondary">
                  {Object.entries(parsedCommand.params).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-blue-400">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs text-ue-text-secondary">
                Confidence: {(parsedCommand.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>

        {/* Quick Start Guide */}
        {!isEnabled && !showHelp && (
          <div className="mt-4 text-center">
            <p className="text-xs text-ue-text-secondary">
              Click the microphone to start voice commands
            </p>
          </div>
        )}
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="border-t border-ue-border p-4 bg-ue-bg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-ue-text">Voice Commands Help</h3>
            <button
              onClick={() => setShowHelp(false)}
              className="p-1 hover:bg-ue-hover rounded"
            >
              <X className="w-4 h-4 text-ue-text-secondary" />
            </button>
          </div>
          
          <div className="space-y-2 text-xs text-ue-text-secondary">
            <div>
              <strong className="text-ue-text">File Commands:</strong>
              <div className="ml-2 mt-1">
                • "Open file PlayerController.cpp"<br />
                • "Save file"<br />
                • "Close file"
              </div>
            </div>
            
            <div>
              <strong className="text-ue-text">Navigation:</strong>
              <div className="ml-2 mt-1">
                • "Go to line 42"<br />
                • "Find function"<br />
                • "Show terminal"
              </div>
            </div>
            
            <div>
              <strong className="text-ue-text">Git Commands:</strong>
              <div className="ml-2 mt-1">
                • "Commit with message 'Fixed bug'"<br />
                • "Push changes"<br />
                • "Show git status"
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-t border-ue-border p-4 bg-ue-bg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-ue-text">Voice Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-ue-hover rounded"
            >
              <X className="w-4 h-4 text-ue-text-secondary" />
            </button>
          </div>
          
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-ue-text-secondary mb-1">Language</label>
              <select 
                className="w-full bg-ue-panel border border-ue-border rounded px-2 py-1 text-ue-text"
                defaultValue="en-US"
                onChange={(e) => voiceRecognitionService.setLanguage(e.target.value)}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="ar-SA">Arabic</option>
                <option value="es-ES">Spanish</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-ue-text-secondary">Continuous Listening</span>
              <input 
                type="checkbox" 
                defaultChecked 
                className="rounded"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-ue-text-secondary">Audio Feedback</span>
              <input 
                type="checkbox" 
                defaultChecked 
                className="rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
