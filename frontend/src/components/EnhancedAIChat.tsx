/**
 * Enhanced AI Chat Interface Component
 * 
 * Features:
 * - Modern chat UI with message bubbles
 * - Typing indicators and animations
 * - Quick action suggestions
 * - Model info display
 * - Code syntax highlighting in responses
 * - Tool execution visualization
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Loader2, Trash2, ChevronDown, ChevronUp,
  Wrench, CheckCircle, XCircle, Camera, Copy, Check,
  Lightbulb, Zap, Box, Palette, Film, Code, RotateCcw,
  MessageSquare, Bot, User, Clock,
  Maximize2, Minimize2, Terminal, Eye, Brain, Cpu
} from 'lucide-react';
import ModelSelector from './ModelSelector';
import { getModelById, AI_PROVIDERS } from '../config/models';

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

// Provider styling
const providerStyles: Record<string, { icon: string; color: string; gradient: string }> = {
  openai: { icon: '🤖', color: 'text-green-400', gradient: 'from-green-500 to-emerald-600' },
  anthropic: { icon: '🧠', color: 'text-orange-400', gradient: 'from-orange-500 to-amber-600' },
  google: { icon: '🔮', color: 'text-blue-400', gradient: 'from-blue-500 to-cyan-600' },
  deepseek: { icon: '🔍', color: 'text-purple-400', gradient: 'from-purple-500 to-violet-600' }
};

// Quick action suggestions with categories
const QUICK_ACTIONS = [
  { icon: Box, label: 'Spawn Actor', prompt: 'Spawn a cube at the center of the level', color: 'from-blue-500 to-cyan-500', category: 'create' },
  { icon: Palette, label: 'Create Material', prompt: 'Create a glowing blue material', color: 'from-purple-500 to-pink-500', category: 'material' },
  { icon: Film, label: 'Add Animation', prompt: 'Make the selected actor rotate continuously', color: 'from-amber-500 to-orange-500', category: 'animation' },
  { icon: Lightbulb, label: 'Add Light', prompt: 'Add a point light above the selected actor', color: 'from-yellow-500 to-amber-500', category: 'lighting' },
  { icon: Code, label: 'Blueprint', prompt: 'Create a blueprint that triggers when player overlaps', color: 'from-green-500 to-emerald-500', category: 'code' },
  { icon: RotateCcw, label: 'Undo Last', prompt: 'Undo the last action', color: 'from-red-500 to-rose-500', category: 'utility' },
  { icon: Eye, label: 'Focus View', prompt: 'Focus the viewport on the selected actor', color: 'from-cyan-500 to-blue-500', category: 'viewport' },
  { icon: Camera, label: 'Screenshot', prompt: 'Take a screenshot of the current viewport', color: 'from-pink-500 to-rose-500', category: 'capture' },
];

// Example prompts organized by complexity
const EXAMPLE_PROMPTS = {
  simple: [
    "Spawn a red cube at position (0, 0, 100)",
    "Delete the selected actor",
    "Select all actors in the scene",
  ],
  intermediate: [
    "Create a living room scene with a sofa, coffee table, and two lamps",
    "Spawn 10 cubes in a circle pattern at position (0, 0, 100)",
    "Apply a metallic red material to all selected actors",
  ],
  advanced: [
    "Set up dramatic sunset lighting with volumetric fog",
    "Create a particle system that emits sparks when triggered",
    "Build a procedural staircase with 20 steps",
  ]
};

const EnhancedAIChat: React.FC<EnhancedAIChatProps> = ({
  chatHistory,
  onSendMessage,
  onClearHistory,
  isProcessing,
  isConnected,
  selectedModel,
  onModelChange,
  autoSelectModel,
  onAutoSelectChange
}) => {
  const [message, setMessage] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get current model info
  const currentModel = getModelById(selectedModel);
  const currentProvider = currentModel ? AI_PROVIDERS.find(p => p.id === currentModel.provider) : null;
  const providerStyle = currentProvider ? providerStyles[currentProvider.id] : providerStyles.deepseek;

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

  // Render code blocks with syntax highlighting
  const renderContent = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <span key={lastIndex}>{content.slice(lastIndex, match.index)}</span>
        );
      }
      
      // Add code block
      const language = match[1] || 'code';
      const code = match[2];
      parts.push(
        <div key={match.index} className="my-2 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3" />
              {language}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="hover:text-white transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <pre className="p-3 bg-gray-900 text-sm overflow-x-auto">
            <code className="text-gray-300">{code}</code>
          </pre>
        </div>
      );
      
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(<span key={lastIndex}>{content.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div className={`flex flex-col bg-gradient-to-br from-gray-900/50 to-gray-950/50 rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50' : 'h-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">AI Command Interface</h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <p className="text-xs text-gray-400">
                {isConnected ? 'Connected to UE5' : 'Waiting for connection'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Model selector */}
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            autoSelect={autoSelectModel}
            onAutoSelectChange={onAutoSelectChange}
            disabled={isProcessing}
            compact={true}
          />
          
          {/* Model info toggle */}
          {currentModel && !autoSelectModel && (
            <button
              onClick={() => setShowModelInfo(!showModelInfo)}
              className={`p-2 rounded-lg transition-all ${showModelInfo ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title="Model info"
            >
              <Cpu className="w-4 h-4" />
            </button>
          )}
          
          {/* Expand/collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          
          {/* Clear history */}
          {chatHistory.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Model info panel */}
      {showModelInfo && currentModel && (
        <div className="px-4 py-3 border-b border-white/10 bg-gray-800/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${providerStyle.gradient} flex items-center justify-center text-lg`}>
              {providerStyle.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{currentModel.name}</span>
                {currentModel.isNew && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full">NEW</span>
                )}
              </div>
              <p className="text-xs text-gray-400">{currentModel.description}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {currentModel.capabilities.reasoning && (
                <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Reasoning
                </span>
              )}
              {currentModel.capabilities.code && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                  <Code className="w-3 h-3" /> Code
                </span>
              )}
              {currentModel.capabilities.fast && (
                <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Fast
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/10">
              <MessageSquare className="w-10 h-10 text-purple-400" />
            </div>
            <h4 className="text-xl font-semibold text-white mb-2">Start a Conversation</h4>
            <p className="text-gray-400 text-sm text-center max-w-md mb-8">
              Describe what you want to do in natural language, and I'll execute the appropriate UE5 commands.
            </p>
            
            {/* Quick Actions Grid */}
            <div className="w-full max-w-2xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 text-center font-medium">Quick Actions</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {QUICK_ACTIONS.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={!isConnected}
                    className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-white transition-colors text-center">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Example Prompts */}
            <div className="w-full max-w-2xl mt-8">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mx-auto"
              >
                <Lightbulb className="w-4 h-4" />
                <span>Example prompts</span>
                {showExamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showExamples && (
                <div className="mt-4 space-y-4 animate-fade-in">
                  {Object.entries(EXAMPLE_PROMPTS).map(([level, prompts]) => (
                    <div key={level}>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 capitalize">{level}</p>
                      <div className="space-y-2">
                        {prompts.map((prompt, i) => (
                          <button
                            key={i}
                            onClick={() => handleQuickAction(prompt)}
                            disabled={!isConnected}
                            className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-xl text-sm text-gray-400 hover:text-white transition-all disabled:opacity-50"
                          >
                            "{prompt}"
                          </button>
                        ))}
                      </div>
                    </div>
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
              style={{ animationDelay: `${index * 0.03}s` }}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-500/20' 
                    : 'bg-gradient-to-br from-violet-500 to-purple-500 shadow-purple-500/20'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Model badge for assistant */}
                  {msg.role === 'assistant' && msg.modelUsed && (
                    <div className="flex items-center gap-1.5 mb-1.5 px-2 py-0.5 bg-gray-800/50 rounded-full">
                      <span className="text-sm">
                        {providerStyles[msg.modelUsed.provider]?.icon || '🤖'}
                      </span>
                      <span className="text-xs text-gray-400">{msg.modelUsed.name}</span>
                    </div>
                  )}

                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-md shadow-lg shadow-blue-500/20'
                      : 'bg-gray-800/80 text-gray-200 rounded-bl-md border border-gray-700/50'
                  }`}>
                    {/* Message text with code highlighting */}
                    <div className="text-sm whitespace-pre-wrap">
                      {renderContent(msg.content)}
                    </div>

                    {/* Tool calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5" />
                          <span className="font-medium">Tools executed ({msg.toolCalls.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {msg.toolCalls.map((tc: any, tcIndex: number) => (
                            <div key={tcIndex} className="flex items-center gap-2 text-xs bg-black/30 rounded-lg px-3 py-2 border border-cyan-500/20">
                              <Zap className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-cyan-400 font-mono font-medium">{tc.function?.name || tc.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tool results */}
                    {msg.toolResults && msg.toolResults.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.toolResults.map((tr: any, trIndex: number) => (
                          <div key={trIndex} className={`text-xs flex items-center gap-2 px-3 py-2 rounded-lg ${
                            tr.success 
                              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                              : 'bg-red-500/10 border border-red-500/20 text-red-400'
                          }`}>
                            {tr.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span className="font-medium">{tr.tool_name}:</span>
                            <span>{tr.success ? 'Success' : tr.error}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Screenshot */}
                    {msg.screenshot && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5" />
                          <span className="font-medium">Viewport Capture</span>
                        </div>
                        <img
                          src={msg.screenshot.base64_data 
                            ? `data:image/png;base64,${msg.screenshot.base64_data}`
                            : msg.screenshot.file_path}
                          alt="Viewport screenshot"
                          className="w-full max-w-[250px] rounded-xl border border-white/10 cursor-pointer hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/20"
                        />
                      </div>
                    )}

                    {/* Streaming indicator */}
                    {msg.isStreaming && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>

                  {/* Timestamp and actions */}
                  <div className={`flex items-center gap-2 mt-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.timestamp && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(msg.timestamp)}
                      </span>
                    )}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => copyToClipboard(msg.content, index)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Copy message"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-sm text-gray-400">Processing your request...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10 bg-gradient-to-r from-gray-800/30 to-gray-900/30">
        {!isConnected && (
          <div className="mb-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium">Not Connected</p>
              <p className="text-xs text-amber-400/70">Connect to UE5 to use AI commands</p>
            </div>
          </div>
        )}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Describe what you want to do in UE5..." : "Connect to UE5 first..."}
            disabled={!isConnected || isProcessing}
            rows={1}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-4 pr-14 py-3.5 text-white placeholder-gray-500 resize-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '52px', maxHeight: '150px' }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || isProcessing || !isConnected}
            className="absolute right-2 bottom-2 p-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl text-white transition-all shadow-lg shadow-purple-500/25 disabled:shadow-none"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">Shift+Enter</kbd> for new line
          </p>
          {autoSelectModel && (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Auto-selecting best model
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedAIChat;
