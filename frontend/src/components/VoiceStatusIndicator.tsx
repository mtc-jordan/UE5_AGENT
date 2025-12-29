/**
 * Voice Status Indicator Component
 * 
 * A compact indicator that shows voice control status in the header.
 * Features:
 * - Animated microphone icon
 * - Listening state visualization
 * - Quick toggle functionality
 * - Tooltip with status info
 */

import React, { useState, useEffect} from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

interface VoiceStatusIndicatorProps {
  isListening: boolean;
  isSupported: boolean;
  isConnected: boolean;
  onToggle: () => void;
  transcript?: string;
  error?: string | null;
}

const VoiceStatusIndicator: React.FC<VoiceStatusIndicatorProps> = ({
  isListening,
  isSupported,
  isConnected,
  onToggle,
  transcript,
  error}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Simulate audio level when listening
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 0.8 + 0.2);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAudioLevel(0);
    }
  }, [isListening]);

  // Render audio bars
  const renderAudioBars = () => {
    const bars = 5;
    return (
      <div className="flex items-end gap-0.5 h-4">
        {Array.from({ length: bars }).map((_, i) => {
          const height = isListening 
            ? Math.max(4, audioLevel * 16 * (1 - Math.abs(i - 2) * 0.2))
            : 4;
          return (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all duration-75 ${
                isListening 
                  ? 'bg-green-400' 
                  : 'bg-gray-600'
              }`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
    );
  };

  if (!isSupported) {
    return (
      <div
        className="relative flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10 opacity-50 cursor-not-allowed"
        title="Voice control not supported in this browser"
      >
        <MicOff className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500">Voice N/A</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={!isConnected}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300
          ${isListening 
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 shadow-lg shadow-green-500/20' 
            : 'bg-white/5 border border-white/10 hover:bg-white/10'
          }
          ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {/* Microphone Icon */}
        <div className="relative">
          {isListening ? (
            <Mic className="w-4 h-4 text-green-400" />
          ) : error ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <MicOff className="w-4 h-4 text-gray-400" />
          )}
          
          {/* Pulse animation when listening */}
          {isListening && (
            <span className="absolute -inset-1 rounded-full bg-green-500/30 animate-ping" />
          )}
        </div>

        {/* Audio Level Bars */}
        {renderAudioBars()}

        {/* Status Text */}
        <span className={`text-xs font-medium ${
          isListening ? 'text-green-400' : error ? 'text-red-400' : 'text-gray-400'
        }`}>
          {isListening ? 'Listening' : error ? 'Error' : 'Voice'}
        </span>

        {/* Live indicator */}
        {isListening && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-fade-in">
          <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              {isListening ? (
                <Mic className="w-4 h-4 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm font-medium text-white">
                {isListening ? 'Voice Active' : 'Voice Control'}
              </span>
            </div>
            
            {error ? (
              <p className="text-xs text-red-400">{error}</p>
            ) : transcript ? (
              <p className="text-xs text-gray-400 italic">"{transcript}"</p>
            ) : (
              <p className="text-xs text-gray-500">
                {isConnected 
                  ? 'Click to toggle voice control' 
                  : 'Connect to UE5 to use voice'
                }
              </p>
            )}

            {/* Keyboard shortcut hint */}
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-xs text-gray-600">
                Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-gray-400">V</kbd> to toggle
              </p>
            </div>
          </div>
          
          {/* Arrow */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-l border-t border-white/10 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default VoiceStatusIndicator;
