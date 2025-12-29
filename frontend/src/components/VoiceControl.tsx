/**
 * Voice Control Component for UE5 AI Agent
 * 
 * Comprehensive voice command system supporting all platform features:
 * - Scene Builder
 * - Lighting Wizard
 * - Animation Assistant
 * - Blueprint & Material Assistant
 * - Texture Generator
 * - Performance Optimizer
 * - Asset Manager
 * - Viewport Preview
 * - General UE5 Commands
 * 
 * Features:
 * - Web Speech API integration for voice recognition
 * - Real-time transcription display
 * - Visual feedback with waveform animation
 * - Voice command history
 * - Multi-language support
 * - Command category routing
 * - Smart suggestions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, Settings, X,
  Loader2, CheckCircle, AlertCircle,
  Languages, History, Trash2,
  ChevronDown, ChevronUp, Sparkles, Zap,
  Home, Lightbulb, Film, Palette, Image,
  Gauge, Package, Camera, Gamepad2, Navigation,
  MousePointer, RotateCcw, HelpCircle
} from 'lucide-react';
import {
  parseVoiceCommand,
  getAllVoiceExamples,
  VOICE_COMMAND_EXAMPLES,
  CATEGORY_DISPLAY_NAMES,
  suggestSimilarCommands,
  CommandCategory,
  ParsedCommand
} from '../lib/voiceCommandParser';

// Types
interface VoiceCommand {
  id: string;
  transcript: string;
  confidence: number;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: string;
  category?: CommandCategory;
  parsedCommand?: ParsedCommand | null;
}

interface VoiceControlProps {
  onCommand: (command: string, parsedCommand?: ParsedCommand | null) => void;
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

// Category icons
const CATEGORY_ICONS: Record<CommandCategory, React.ReactNode> = {
  scene: <Home className="w-4 h-4" />,
  lighting: <Lightbulb className="w-4 h-4" />,
  animation: <Film className="w-4 h-4" />,
  material: <Palette className="w-4 h-4" />,
  blueprint: <Sparkles className="w-4 h-4" />,
  texture: <Image className="w-4 h-4" />,
  performance: <Gauge className="w-4 h-4" />,
  asset: <Package className="w-4 h-4" />,
  viewport: <Camera className="w-4 h-4" />,
  general: <Gamepad2 className="w-4 h-4" />,
  navigation: <Navigation className="w-4 h-4" />,
  selection: <MousePointer className="w-4 h-4" />,
  transform: <RotateCcw className="w-4 h-4" />,
};

// Category colors
const CATEGORY_COLORS: Record<CommandCategory, string> = {
  scene: 'from-blue-500 to-cyan-500',
  lighting: 'from-yellow-500 to-orange-500',
  animation: 'from-purple-500 to-pink-500',
  material: 'from-green-500 to-emerald-500',
  blueprint: 'from-indigo-500 to-violet-500',
  texture: 'from-rose-500 to-red-500',
  performance: 'from-amber-500 to-yellow-500',
  asset: 'from-teal-500 to-cyan-500',
  viewport: 'from-sky-500 to-blue-500',
  general: 'from-gray-500 to-slate-500',
  navigation: 'from-lime-500 to-green-500',
  selection: 'from-fuchsia-500 to-pink-500',
  transform: 'from-orange-500 to-amber-500',
};

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
  const [showHelp, setShowHelp] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [continuousMode, setContinuousMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CommandCategory | 'all'>('all');
  const [suggestions, setSuggestions] = useState<string[]>([]);

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
      
      // Update suggestions based on interim transcript
      if (interim) {
        const newSuggestions = suggestSimilarCommands(interim);
        setSuggestions(newSuggestions);
      }
      
      if (final) {
        setTranscript(final);
        setSuggestions([]);
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
    // Parse the command to determine category and action
    const parsedCommand = parseVoiceCommand(text);
    
    const command: VoiceCommand = {
      id: Date.now().toString(),
      transcript: text,
      confidence: conf,
      timestamp: new Date(),
      status: 'pending',
      category: parsedCommand?.category,
      parsedCommand,
    };

    setCommandHistory(prev => [command, ...prev].slice(0, 50));
    
    if (isConnected && !isProcessing) {
      onCommand(text, parsedCommand);
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
      setSuggestions([]);
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
      onCommand(command.transcript, command.parsedCommand);
    }
  };

  // Use example command
  const useExampleCommand = (example: string) => {
    if (isConnected && !isProcessing) {
      const parsedCommand = parseVoiceCommand(example);
      handleVoiceCommand(example, 100);
    }
  };

  // Get filtered examples
  const getFilteredExamples = () => {
    if (selectedCategory === 'all') {
      return getAllVoiceExamples().slice(0, 10);
    }
    return VOICE_COMMAND_EXAMPLES[selectedCategory] || [];
  };

  // Render waveform bars
  const renderWaveform = () => {
    const bars = 16;
    return (
      <div className="flex items-center justify-center gap-0.5 h-10">
        {Array.from({ length: bars }).map((_, i) => {
          const height = isListening 
            ? Math.max(4, Math.min(40, audioLevel * 50 + Math.sin(Date.now() / 100 + i) * 10))
            : 4;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                isListening 
                  ? 'bg-gradient-to-t from-green-500 to-emerald-400' 
                  : 'bg-gray-600'
              }`}
              style={{ height: `${height}px` }}
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
          title="Voice Control"
        >
          {isListening ? (
            <Mic className="w-5 h-5 text-white animate-pulse" />
          ) : (
            <MicOff className="w-5 h-5 text-gray-400" />
          )}
          {isListening && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
          )}
        </button>
      </div>
    );
  }

  // Expanded mode
  return (
    <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isListening ? 'bg-green-500/20' : 'bg-white/10'}`}>
              {isListening ? (
                <Mic className="w-5 h-5 text-green-400" />
              ) : (
                <MicOff className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white">Voice Control</h3>
              <p className="text-xs text-gray-400">
                {isListening ? 'Listening...' : 'Click to start'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`p-2 rounded-lg transition-colors ${showHelp ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-gray-400'}`}
              title="Voice Commands Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/10 text-gray-400'}`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-gray-400'}`}
              title="History"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
              title="Minimize"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Language</label>
              <div className="grid grid-cols-4 gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLanguage(lang.code)}
                    className={`p-2 rounded-lg text-sm transition-colors ${
                      selectedLanguage === lang.code
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-lg">{lang.flag}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Continuous Listening</span>
              <button
                onClick={() => setContinuousMode(!continuousMode)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  continuousMode ? 'bg-purple-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  continuousMode ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Panel - Voice Commands by Category */}
      {showHelp && (
        <div className="p-4 border-b border-white/10 bg-white/5 max-h-80 overflow-y-auto">
          <h4 className="text-sm font-medium text-white mb-3">Voice Commands by Category</h4>
          
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              All
            </button>
            {(Object.keys(CATEGORY_DISPLAY_NAMES) as CommandCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs transition-colors flex items-center gap-1 ${
                  selectedCategory === cat
                    ? `bg-gradient-to-r ${CATEGORY_COLORS[cat]} text-white`
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {CATEGORY_ICONS[cat]}
                {CATEGORY_DISPLAY_NAMES[cat].split(' ')[1]}
              </button>
            ))}
          </div>
          
          {/* Commands List */}
          <div className="space-y-2">
            {getFilteredExamples().map((example, idx) => (
              <button
                key={idx}
                onClick={() => useExampleCommand(example)}
                className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <span className="text-sm text-gray-300 group-hover:text-white">"{example}"</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Waveform Visualization */}
      <div className="p-4 border-b border-white/10">
        {renderWaveform()}
        
        {/* Transcript Display */}
        {(transcript || interimTranscript) && (
          <div className="mt-3 p-3 rounded-lg bg-white/5">
            {interimTranscript && (
              <p className="text-gray-400 text-sm italic">{interimTranscript}</p>
            )}
            {transcript && (
              <div className="flex items-center justify-between">
                <p className="text-white">{transcript}</p>
                <span className="text-xs text-green-400">{confidence}%</span>
              </div>
            )}
          </div>
        )}

        {/* Real-time Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-500">Did you mean:</p>
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => useExampleCommand(suggestion)}
                className="block w-full text-left text-sm text-gray-400 hover:text-white p-1 rounded hover:bg-white/5"
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Main Control Button */}
      <div className="p-4">
        <button
          onClick={toggleListening}
          disabled={!isSupported || disabled || !isConnected}
          className={`
            w-full py-4 rounded-xl font-medium transition-all duration-300
            flex items-center justify-center gap-3
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

        {/* Quick Examples */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Quick Commands</p>
            <button
              onClick={() => setShowHelp(true)}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              View All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {getFilteredExamples().slice(0, 5).map((example, idx) => (
              <button
                key={idx}
                onClick={() => useExampleCommand(example)}
                className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Command History */}
      {showHistory && (
        <div className="border-t border-white/10 p-4 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">Command History</h4>
            {commandHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          
          {commandHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No commands yet</p>
          ) : (
            <div className="space-y-2">
              {commandHistory.map(cmd => (
                <div
                  key={cmd.id}
                  className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {cmd.category && (
                          <span className={`p-1 rounded bg-gradient-to-r ${CATEGORY_COLORS[cmd.category]} bg-opacity-20`}>
                            {CATEGORY_ICONS[cmd.category]}
                          </span>
                        )}
                        <p className="text-sm text-white">{cmd.transcript}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {cmd.timestamp.toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-green-400">{cmd.confidence}%</span>
                        {cmd.category && (
                          <>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-purple-400">{CATEGORY_DISPLAY_NAMES[cmd.category]}</span>
                          </>
                        )}
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
                          className="p-1 rounded hover:bg-white/10"
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
