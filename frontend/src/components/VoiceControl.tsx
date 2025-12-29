/**
 * Voice Control Component for UE5 AI Agent
 * 
 * Features:
 * - Web Speech API integration for voice recognition
 * - Real-time transcription display
 * - Visual feedback with waveform animation
 * - Voice command history
 * - Noise level indicator
 * - Customizable wake word support
 * - Multi-language support
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Settings, X,
  Loader2, CheckCircle, AlertCircle, Waveform,
  Languages, History, Trash2, Play, Pause,
  ChevronDown, ChevronUp, Sparkles, Zap
} from 'lucide-react';

// Types
interface VoiceCommand {
  id: string;
  transcript: string;
  confidence: number;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: string;
}

interface VoiceControlProps {
  onCommand: (command: string) => void;
  isProcessing: boolean;
  isConnected: boolean;
  disabled?: boolean;
}

// Supported languages
const LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
];

// Voice command examples
const VOICE_EXAMPLES = [
  "Spawn a red cube at the center",
  "Rotate selection 45 degrees",
  "Create a glowing material",
  "Add a point light above",
  "Take a screenshot",
  "Undo last action",
  "Select all actors",
  "Delete selected",
];

// Check if Web Speech API is supported
const isSpeechRecognitionSupported = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

// Get SpeechRecognition constructor
const getSpeechRecognition = () => {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
};

const VoiceControl: React.FC<VoiceControlProps> = ({
  onCommand,
  isProcessing,
  isConnected,
  disabled = false,
}) => {
  // State
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<VoiceCommand[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [continuousMode, setContinuousMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      setIsSupported(false);
      setError('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    recognitionRef.current = new SpeechRecognition();
    
    const recognition = recognitionRef.current;
    recognition.continuous = continuousMode;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      startAudioVisualization();
    };

    recognition.onend = () => {
      setIsListening(false);
      stopAudioVisualization();
      
      // Restart if continuous mode is enabled
      if (continuousMode && !disabled && isConnected) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore errors when restarting
        }
      }
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
          setConfidence(Math.round(result[0].confidence * 100));
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);
      
      if (final) {
        setTranscript(final);
        handleVoiceCommand(final, Math.round(event.results[event.results.length - 1][0].confidence * 100));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      switch (event.error) {
        case 'no-speech':
          setError('No speech detected. Please try again.');
          break;
        case 'audio-capture':
          setError('No microphone found. Please check your audio settings.');
          break;
        case 'not-allowed':
          setError('Microphone access denied. Please allow microphone access.');
          break;
        case 'network':
          setError('Network error. Please check your connection.');
          break;
        default:
          setError(`Error: ${event.error}`);
      }
      
      setIsListening(false);
      stopAudioVisualization();
    };

    return () => {
      if (recognition) {
        recognition.abort();
      }
      stopAudioVisualization();
    };
  }, [selectedLanguage, continuousMode, disabled, isConnected]);

  // Audio visualization
  const startAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(average / 255);
        }
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  // Handle voice command
  const handleVoiceCommand = useCallback((text: string, conf: number) => {
    const command: VoiceCommand = {
      id: Date.now().toString(),
      transcript: text,
      confidence: conf,
      timestamp: new Date(),
      status: 'pending',
    };

    setCommandHistory(prev => [command, ...prev].slice(0, 50)); // Keep last 50 commands
    
    // Send command to AI
    if (isConnected && !isProcessing) {
      onCommand(text);
      setCommandHistory(prev => 
        prev.map(c => c.id === command.id ? { ...c, status: 'processing' } : c)
      );
    }
  }, [isConnected, isProcessing, onCommand]);

  // Toggle listening
  const toggleListening = () => {
    if (!isSupported || disabled || !isConnected) return;

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  // Clear history
  const clearHistory = () => {
    setCommandHistory([]);
  };

  // Retry command
  const retryCommand = (command: VoiceCommand) => {
    if (isConnected && !isProcessing) {
      onCommand(command.transcript);
    }
  };

  // Render waveform bars
  const renderWaveform = () => {
    const bars = 12;
    return (
      <div className="flex items-center justify-center gap-0.5 h-8">
        {Array.from({ length: bars }).map((_, i) => {
          const delay = i * 0.05;
          const height = isListening 
            ? Math.max(4, Math.min(32, audioLevel * 40 + Math.sin(Date.now() / 100 + i) * 8))
            : 4;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                isListening 
                  ? 'bg-gradient-to-t from-green-500 to-emerald-400' 
                  : 'bg-gray-600'
              }`}
              style={{
                height: `${height}px`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>
    );
  };

  // Compact mode (just the mic button)
  if (!isExpanded) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsExpanded(true)}
          disabled={!isSupported || disabled}
          className={`
            relative p-3 rounded-xl transition-all duration-300
            ${isListening 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/30' 
              : 'bg-white/10 hover:bg-white/20 border border-white/10'
            }
            ${(!isSupported || disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          title={isSupported ? 'Voice Control' : 'Voice not supported'}
        >
          {isListening ? (
            <Mic className="w-5 h-5 text-white animate-pulse" />
          ) : (
            <MicOff className="w-5 h-5 text-gray-400" />
          )}
          
          {/* Pulse animation when listening */}
          {isListening && (
            <>
              <span className="absolute inset-0 rounded-xl bg-green-500/30 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </>
          )}
        </button>
      </div>
    );
  }

  // Expanded mode
  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
            ${isListening 
              ? 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/30' 
              : 'bg-gradient-to-br from-violet-500 to-purple-600'
            }
          `}>
            {isListening ? (
              <Mic className="w-5 h-5 text-white" />
            ) : (
              <MicOff className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              Voice Control
              {isListening && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full animate-pulse">
                  Listening
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-400">
              {isSupported 
                ? isConnected 
                  ? 'Speak commands to control UE5' 
                  : 'Connect to UE5 to use voice'
                : 'Not supported in this browser'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="History"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Minimize"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-white/10 bg-white/5 space-y-4 animate-fade-in">
          {/* Language Selection */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
              Language
            </label>
            <div className="grid grid-cols-4 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg text-sm transition-all
                    ${selectedLanguage === lang.code 
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                    }
                  `}
                >
                  <span>{lang.flag}</span>
                  <span className="truncate">{lang.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Continuous Mode Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Continuous Listening</p>
              <p className="text-xs text-gray-500">Keep listening after each command</p>
            </div>
            <button
              onClick={() => setContinuousMode(!continuousMode)}
              className={`
                relative w-12 h-6 rounded-full transition-colors
                ${continuousMode ? 'bg-violet-500' : 'bg-gray-700'}
              `}
            >
              <span
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                  ${continuousMode ? 'left-7' : 'left-1'}
                `}
              />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto p-1 hover:bg-red-500/20 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Waveform Visualization */}
        <div className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
          {renderWaveform()}
          
          {/* Transcript Display */}
          <div className="mt-3 min-h-[60px] flex items-center justify-center">
            {isListening ? (
              <div className="text-center">
                {interimTranscript ? (
                  <p className="text-gray-400 italic animate-pulse">
                    {interimTranscript}
                  </p>
                ) : transcript ? (
                  <div>
                    <p className="text-white font-medium">{transcript}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Confidence: {confidence}%
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">Listening for commands...</p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Click the microphone to start
              </p>
            )}
          </div>
        </div>

        {/* Main Control Button */}
        <button
          onClick={toggleListening}
          disabled={!isSupported || disabled || !isConnected}
          className={`
            w-full py-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-3
            ${isListening 
              ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg shadow-red-500/30' 
              : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/30'
            }
            ${(!isSupported || disabled || !isConnected) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              Stop Listening
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Start Voice Control
            </>
          )}
        </button>

        {/* Voice Examples */}
        {!isListening && !showHistory && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Try saying
            </p>
            <div className="flex flex-wrap gap-2">
              {VOICE_EXAMPLES.slice(0, 4).map((example, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (isConnected && !isProcessing) {
                      onCommand(example);
                    }
                  }}
                  disabled={!isConnected || isProcessing}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-gray-400 hover:text-white transition-all disabled:opacity-50"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Command History */}
      {showHistory && (
        <div className="border-t border-white/10 max-h-64 overflow-y-auto">
          <div className="p-3 bg-white/5 flex items-center justify-between sticky top-0">
            <span className="text-xs text-gray-400 uppercase tracking-wider">
              Command History ({commandHistory.length})
            </span>
            {commandHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          
          {commandHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No commands yet
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {commandHistory.map(cmd => (
                <div
                  key={cmd.id}
                  className="p-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{cmd.transcript}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {cmd.timestamp.toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500">
                          {cmd.confidence}% confidence
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {cmd.status === 'processing' && (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      )}
                      {cmd.status === 'completed' && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      {cmd.status === 'error' && (
                        <button
                          onClick={() => retryCommand(cmd)}
                          className="p-1 hover:bg-white/10 rounded"
                          title="Retry"
                        >
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceControl;
