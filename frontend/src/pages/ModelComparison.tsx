/**
 * Model Comparison Page
 * 
 * Side-by-side comparison of AI model responses.
 */

import React, { useState, useEffect} from 'react'
import {
  Scale,
  Play,
  Loader2,
  Star,
  Trophy,
  Clock,
  Hash,
  Trash2,
  Heart,
  Save,
  History,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Sparkles,
  Zap,
  Brain,
  Crown,
  Feather,
  Bolt,
  Cpu
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  getAvailableModels,
  createComparison,
  runComparisonStream,
  listSessions,
  deleteSession,
  updateSession,
  rateResult,
  ModelInfo,
  ComparisonSession,
  StreamEvent,
  formatResponseTime,
  formatTokenCount} from '../lib/comparison-api'
import ComparisonMetrics from '../components/ComparisonMetrics'

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  brain: <Brain className="w-4 h-4" />,
  lightbulb: <Sparkles className="w-4 h-4" />,
  sparkles: <Sparkles className="w-4 h-4" />,
  crown: <Crown className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  feather: <Feather className="w-4 h-4" />,
  star: <Star className="w-4 h-4" />,
  bolt: <Bolt className="w-4 h-4" />,
  cpu: <Cpu className="w-4 h-4" />
}

export default function ModelComparison() {
  // State
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  
  const [isRunning, setIsRunning] = useState(false)
  const [currentSession, setCurrentSession] = useState<ComparisonSession | null>(null)
  const [streamingResponses, setStreamingResponses] = useState<Record<string, string>>({})
  const [streamingStatus, setStreamingStatus] = useState<Record<string, string>>({})
  
  const [sessions, setSessions] = useState<ComparisonSession[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'saved' | 'favorites'>('all')
  
  const [error, setError] = useState<string | null>(null)
  
  // Load models on mount
  useEffect(() => {
    loadModels()
    loadHistory()
  }, [])
  
  const loadModels = async () => {
    try {
      const data = await getAvailableModels()
      setModels(data.models)
      // Pre-select first 2 models from different providers
      if (data.models.length >= 2) {
        const providers = new Set<string>()
        const preselected: string[] = []
        for (const model of data.models) {
          if (!providers.has(model.provider) && preselected.length < 2) {
            providers.add(model.provider)
            preselected.push(model.id)
          }
        }
        setSelectedModels(preselected)
      }
    } catch (err) {
      setError('Failed to load models')
    }
  }
  
  const loadHistory = async () => {
    try {
      const data = await listSessions({
        limit: 50,
        saved_only: historyFilter === 'saved',
        favorites_only: historyFilter === 'favorites'
      })
      setSessions(data.sessions)
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }
  
  useEffect(() => {
    loadHistory()
  }, [historyFilter])
  
  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId)
      }
      if (prev.length >= 4) {
        return prev // Max 4 models
      }
      return [...prev, modelId]
    })
  }
  
  const runComparison = async () => {
    if (selectedModels.length < 2 || !prompt.trim()) {
      setError('Please select at least 2 models and enter a prompt')
      return
    }
    
    setError(null)
    setIsRunning(true)
    setStreamingResponses({})
    setStreamingStatus(
      Object.fromEntries(selectedModels.map(id => [id, 'pending']))
    )
    
    try {
      // Create session
      const session = await createComparison({
        prompt: prompt.trim(),
        models: selectedModels,
        system_prompt: systemPrompt.trim() || undefined
      })
      
      setCurrentSession(session)
      
      // Run with streaming
      const cleanup = runComparisonStream(
        session.id,
        (event: StreamEvent) => {
          if (event.type === 'start' && event.model) {
            setStreamingStatus(prev => ({
              ...prev,
              [event.model!]: 'streaming'
            }))
          } else if (event.type === 'chunk' && event.model && event.content) {
            setStreamingResponses(prev => ({
              ...prev,
              [event.model!]: (prev[event.model!] || '') + event.content
            }))
          } else if (event.type === 'complete' && event.model) {
            setStreamingStatus(prev => ({
              ...prev,
              [event.model!]: 'completed'
            }))
            setStreamingResponses(prev => ({
              ...prev,
              [event.model!]: event.response || prev[event.model!] || ''
            }))
            // Update session with metrics
            setCurrentSession(prev => {
              if (!prev) return prev
              return {
                ...prev,
                results: prev.results.map(r =>
                  r.model_id === event.model
                    ? {
                        ...r,
                        response: event.response || r.response,
                        status: 'completed',
                        response_time_ms: event.metrics?.response_time_ms ?? r.response_time_ms,
                        total_time_ms: event.metrics?.total_time_ms ?? r.total_time_ms,
                        token_count: event.metrics?.token_count ?? r.token_count
                      }
                    : r
                )
              }
            })
          } else if (event.type === 'error' && event.model) {
            setStreamingStatus(prev => ({
              ...prev,
              [event.model!]: 'failed'
            }))
          } else if (event.type === 'done') {
            setIsRunning(false)
            loadHistory()
          }
        },
        (error) => {
          setError(error.message)
          setIsRunning(false)
        },
        () => {
          setIsRunning(false)
        }
      )
      
      // Cleanup on unmount
      return () => cleanup()
      
    } catch (err: any) {
      setError(err.message || 'Failed to run comparison')
      setIsRunning(false)
    }
  }
  
  const handleRate = async (resultId: number, rating: number, isWinner: boolean = false) => {
    try {
      await rateResult(resultId, { rating, is_winner: isWinner })
      // Update local state
      setCurrentSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          results: prev.results.map(r =>
            r.id === resultId
              ? { ...r, user_rating: rating, is_winner: isWinner }
              : isWinner
              ? { ...r, is_winner: false }
              : r
          )
        }
      })
    } catch (err) {
      console.error('Failed to rate:', err)
    }
  }
  
  const handleSave = async (sessionId: number, isSaved: boolean) => {
    try {
      await updateSession(sessionId, { is_saved: isSaved })
      setCurrentSession(prev =>
        prev?.id === sessionId ? { ...prev, is_saved: isSaved } : prev
      )
      loadHistory()
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }
  
  const handleFavorite = async (sessionId: number, isFavorite: boolean) => {
    try {
      await updateSession(sessionId, { is_favorite: isFavorite })
      setCurrentSession(prev =>
        prev?.id === sessionId ? { ...prev, is_favorite: isFavorite } : prev
      )
      loadHistory()
    } catch (err) {
      console.error('Failed to favorite:', err)
    }
  }
  
  const handleDelete = async (sessionId: number) => {
    if (!confirm('Delete this comparison?')) return
    try {
      await deleteSession(sessionId)
      if (currentSession?.id === sessionId) {
        setCurrentSession(null)
        setStreamingResponses({})
      }
      loadHistory()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }
  
  const loadSession = (session: ComparisonSession) => {
    setCurrentSession(session)
    setPrompt(session.prompt)
    setSystemPrompt(session.system_prompt || '')
    setSelectedModels(session.models)
    setStreamingResponses(
      Object.fromEntries(
        session.results.map(r => [r.model_id, r.response || ''])
      )
    )
    setStreamingStatus(
      Object.fromEntries(
        session.results.map(r => [r.model_id, r.status])
      )
    )
    setShowHistory(false)
  }
  
  const getModelInfo = (modelId: string): ModelInfo | undefined => {
    return models.find(m => m.id === modelId)
  }
  
  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-semibold text-white">Model Comparison</h1>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showHistory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className={`flex-1 flex flex-col overflow-hidden ${showHistory ? 'w-2/3' : 'w-full'}`}>
          {/* Model Selection */}
          <div className="flex-shrink-0 p-4 border-b border-gray-700">
            <div className="mb-3">
              <label className="text-sm text-gray-400 mb-2 block">
                Select Models to Compare (2-4)
              </label>
              <div className="flex flex-wrap gap-2">
                {models.map(model => (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={isRunning}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      selectedModels.includes(model.id)
                        ? 'border-blue-500 bg-blue-500/20 text-white'
                        : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: model.color }}
                    />
                    {iconMap[model.icon] || <Cpu className="w-4 h-4" />}
                    <span className="text-sm">{model.name}</span>
                    {selectedModels.includes(model.id) && (
                      <Check className="w-4 h-4 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Prompt Input */}
          <div className="flex-shrink-0 p-4 border-b border-gray-700">
            <div className="space-y-3">
              <div>
                <button
                  onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                  className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-1 mb-2"
                >
                  {showSystemPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  System Prompt (Optional)
                </button>
                {showSystemPrompt && (
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt..."
                    className="w-full h-20 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                    disabled={isRunning}
                  />
                )}
              </div>
              
              <div className="flex gap-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt to compare model responses..."
                  className="flex-1 h-24 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
                  disabled={isRunning}
                />
                <button
                  onClick={runComparison}
                  disabled={isRunning || selectedModels.length < 2 || !prompt.trim()}
                  className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Compare
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
          
          {/* Results Grid */}
          <div className="flex-1 overflow-auto p-4">
            {currentSession && (
              <>
                {/* Session Actions */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-white">
                    {currentSession.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(currentSession.id, !currentSession.is_saved)}
                      className={`p-2 rounded-lg transition-colors ${
                        currentSession.is_saved
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                      title={currentSession.is_saved ? 'Saved' : 'Save'}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFavorite(currentSession.id, !currentSession.is_favorite)}
                      className={`p-2 rounded-lg transition-colors ${
                        currentSession.is_favorite
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                      title={currentSession.is_favorite ? 'Favorited' : 'Favorite'}
                    >
                      <Heart className="w-4 h-4" fill={currentSession.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => handleDelete(currentSession.id)}
                      className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Side-by-side Results */}
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(selectedModels.length, 4)}, 1fr)`
                  }}
                >
                  {selectedModels.map(modelId => {
                    const model = getModelInfo(modelId)
                    const result = currentSession.results.find(r => r.model_id === modelId)
                    const response = streamingResponses[modelId] || result?.response || ''
                    const status = streamingStatus[modelId] || result?.status || 'pending'
                    
                    return (
                      <div
                        key={modelId}
                        className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col overflow-hidden"
                      >
                        {/* Model Header */}
                        <div
                          className="p-3 border-b border-gray-700 flex items-center justify-between"
                          style={{ borderTopColor: model?.color, borderTopWidth: 3 }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: model?.color }}
                            />
                            <span className="font-medium text-white">
                              {model?.name || modelId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {status === 'streaming' && (
                              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                            )}
                            {status === 'completed' && (
                              <Check className="w-4 h-4 text-green-400" />
                            )}
                            {status === 'failed' && (
                              <X className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                        </div>
                        
                        {/* Response Content */}
                        <div className="flex-1 p-4 overflow-auto max-h-96">
                          {status === 'pending' ? (
                            <div className="text-gray-500 text-center py-8">
                              Waiting to start...
                            </div>
                          ) : status === 'failed' ? (
                            <div className="text-red-400 text-center py-8">
                              {result?.error || 'Failed to generate response'}
                            </div>
                          ) : (
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown>{response}</ReactMarkdown>
                              {status === 'streaming' && (
                                <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Metrics & Rating */}
                        {status === 'completed' && result && (
                          <div className="p-3 border-t border-gray-700 bg-gray-800/50">
                            {/* Metrics */}
                            <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatResponseTime(result.total_time_ms)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {formatTokenCount(result.token_count)} tokens
                              </div>
                            </div>
                            
                            {/* Rating */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => handleRate(result.id, star)}
                                    className="p-1 hover:scale-110 transition-transform"
                                  >
                                    <Star
                                      className={`w-4 h-4 ${
                                        (result.user_rating || 0) >= star
                                          ? 'text-yellow-400 fill-yellow-400'
                                          : 'text-gray-600'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => handleRate(result.id, result.user_rating || 5, true)}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                  result.is_winner
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-gray-700 text-gray-400 hover:text-yellow-400'
                                }`}
                              >
                                <Trophy className="w-3 h-3" />
                                {result.is_winner ? 'Winner' : 'Pick Winner'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            
            {/* Metrics Panel */}
            {currentSession && currentSession.status === 'completed' && (
              <div className="mt-6">
                <ComparisonMetrics
                  results={currentSession.results}
                  models={models}
                />
              </div>
            )}
            
            {!currentSession && !isRunning && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Scale className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Select models and enter a prompt to compare</p>
                <p className="text-sm mt-2">
                  Compare up to 4 AI models side-by-side
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* History Sidebar */}
        {showHistory && (
          <div className="w-1/3 border-l border-gray-700 bg-gray-850 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-medium text-white mb-3">Comparison History</h2>
              <div className="flex gap-2">
                {(['all', 'saved', 'favorites'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      historyFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No comparisons yet
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className={`p-4 cursor-pointer hover:bg-gray-800 transition-colors ${
                        currentSession?.id === session.id ? 'bg-gray-800' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white font-medium text-sm line-clamp-1">
                          {session.title}
                        </h3>
                        <div className="flex items-center gap-1">
                          {session.is_favorite && (
                            <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                          )}
                          {session.is_saved && (
                            <Save className="w-3 h-3 text-green-400" />
                          )}
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs line-clamp-2 mb-2">
                        {session.prompt}
                      </p>
                      <div className="flex items-center gap-2">
                        {session.models.map(modelId => {
                          const model = getModelInfo(modelId)
                          return (
                            <span
                              key={modelId}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: model?.color || '#666' }}
                              title={model?.name || modelId}
                            />
                          )
                        })}
                        <span className="text-gray-500 text-xs ml-auto">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
