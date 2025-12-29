/**
 * Enhanced AI Chat Interface Component
 * 
 * Features:
 * - Modern chat UI with message bubbles
 * - Typing indicators and animations
 * - Quick action suggestions
 * - Voice input support (future)
 * - File/image attachments (future)
 * - Code syntax highlighting in responses
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Loader2, Trash2, ChevronDown,
  Wrench, CheckCircle, XCircle, Camera, Copy, Check,
  Lightbulb, Zap, Box, Palette, Film, Code, RotateCcw,
  MessageSquare, Bot, User, Clock} from 'lucide-react';
import ModelSelector from './ModelSelector';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  toolCalls?: any[];
  toolResults?: any[];
  screenshot?: any;
  modelUsed?: { name: string; provider: string };
  isStreaming?: boolean;
}

interface EnhancedAIChatProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string, model: string) => void;
  onClearHistory: () => void;
  isProcessing: boolean;
  isConnected: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  autoSelectModel: boolean;
  onAutoSelectChange: (auto: boolean) => void;
}

// Quick action suggestions
const QUICK_ACTIONS = [
  { icon: Box, label: 'Spawn Actor', prompt: 'Spawn a cube at the center of the level', color: 'from-blue-500 to-cyan-500' },
  { icon: Palette, label: 'Create Material', prompt: 'Create a glowing blue material', color: 'from-purple-500 to-pink-500' },
  { icon: Film, label: 'Add Animation', prompt: 'Make the selected actor rotate continuously', color: 'from-amber-500 to-orange-500' },
  { icon: Lightbulb, label: 'Add Light', prompt: 'Add a point light above the selected actor', color: 'from-yellow-500 to-amber-500' },
  { icon: Code, label: 'Blueprint', prompt: 'Create a blueprint that triggers when player overlaps', color: 'from-green-500 to-emerald-500' },
  { icon: RotateCcw, label: 'Undo Last', prompt: 'Undo the last action', color: 'from-red-500 to-rose-500' },
];

// Example prompts for inspiration
const EXAMPLE_PROMPTS = [
  "Create a living room scene with a sofa, coffee table, and two lamps",
  "Spawn 10 cubes in a circle pattern at position (0, 0, 100)",
  "Apply a metallic red material to all selected actors",
  "Set up dramatic sunset lighting for the scene",
  "Create a particle system that emits sparks",
  "Add a camera that orbits around the selected actor",
];

const EnhancedAIChat: React.FC<EnhancedAIChatProps> = ({
  chatHistory,
  onSendMessage,
  onClearHistory,
  isProcessing,
  isConnected,
  selectedModel,
  onModelChange,
  autoSelectModel,
  onAutoSelectChange}) => {
  const [message, setMessage] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (!message.trim() || isProcessing || !isConnected) return;
    onSendMessage(message.trim(), selectedModel);
    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Command Interface</h3>
            <p className="text-xs text-gray-400">
              {isConnected ? 'Connected to UE5' : 'Waiting for connection'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            autoSelect={autoSelectModel}
            onAutoSelectChange={onAutoSelectChange}
            disabled={isProcessing}
            compact={true}
          />
          {chatHistory.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-purple-400" />
            </div>
            <h4 className="text-lg font-medium text-white mb-2">Start a Conversation</h4>
            <p className="text-gray-400 text-sm text-center max-w-md mb-6">
              Describe what you want to do in natural language, and I'll execute the appropriate UE5 commands.
            </p>
            
            {/* Quick Actions */}
            <div className="w-full max-w-2xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center">Quick Actions</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {QUICK_ACTIONS.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={!isConnected}
                    className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <action.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Example Prompts */}
            <div className="w-full max-w-2xl mt-6">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mx-auto"
              >
                <Lightbulb className="w-3 h-3" />
                <span>Example prompts</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showExamples ? 'rotate-180' : ''}`} />
              </button>
              {showExamples && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  {EXAMPLE_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickAction(prompt)}
                      className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition-all"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                    : 'bg-gradient-to-br from-violet-500 to-purple-500'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Model badge for assistant */}
                  {msg.role === 'assistant' && msg.modelUsed && (
                    <div className="flex items-center gap-1.5 mb-1 text-xs text-gray-500">
                      <span>
                        {msg.modelUsed.provider === 'openai' ? '🤖' : 
                         msg.modelUsed.provider === 'anthropic' ? '🧠' :
                         msg.modelUsed.provider === 'google' ? '🔮' :
                         msg.modelUsed.provider === 'deepseek' ? '🔍' : '🤖'}
                      </span>
                      <span>{msg.modelUsed.name}</span>
                    </div>
                  )}

                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-md'
                      : 'bg-white/10 text-gray-200 rounded-bl-md'
                  }`}>
                    {/* Message text */}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                    {/* Tool calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          Tools executed:
                        </div>
                        <div className="space-y-1">
                          {msg.toolCalls.map((tc: any, tcIndex: number) => (
                            <div key={tcIndex} className="flex items-center gap-2 text-xs bg-black/20 rounded-lg px-2 py-1">
                              <Zap className="w-3 h-3 text-cyan-400" />
                              <span className="text-cyan-400 font-mono">{tc.function?.name || tc.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tool results */}
                    {msg.toolResults && msg.toolResults.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.toolResults.map((tr: any, trIndex: number) => (
                          <div key={trIndex} className={`text-xs flex items-center gap-1 ${
                            tr.success ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {tr.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>{tr.tool_name}: {tr.success ? 'Success' : tr.error}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Screenshot */}
                    {msg.screenshot && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          Viewport Capture
                        </div>
                        <img
                          src={msg.screenshot.base64_data 
                            ? `data:image/png;base64,${msg.screenshot.base64_data}`
                            : msg.screenshot.file_path}
                          alt="Viewport screenshot"
                          className="w-full max-w-[200px] rounded-lg border border-white/10 cursor-pointer hover:border-purple-500/50 transition-colors"
                        />
                      </div>
                    )}

                    {/* Streaming indicator */}
                    {msg.isStreaming && (
                      <div className="flex items-center gap-1 mt-2">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>

                  {/* Timestamp and actions */}
                  <div className={`flex items-center gap-2 mt-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.timestamp && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(msg.timestamp)}
                      </span>
                    )}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => copyToClipboard(msg.content, index)}
                        className="p-1 text-gray-500 hover:text-white transition-colors"
                        title="Copy message"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-sm text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-white/5">
        {!isConnected && (
          <div className="mb-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Connect to UE5 to use AI commands
          </div>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Describe what you want to do..." : "Connect to UE5 first..."}
            disabled={!isConnected || isProcessing}
            rows={1}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-14 py-3 text-white placeholder-gray-500 resize-none focus:border-purple-500 focus:bg-white/10 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '48px', maxHeight: '150px' }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isProcessing || !isConnected}
            className="absolute right-2 bottom-2 p-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg text-white transition-all shadow-lg shadow-purple-500/25 disabled:shadow-none"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
};

export default EnhancedAIChat;
