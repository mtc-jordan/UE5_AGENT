/**
 * Comparison Metrics Component
 * 
 * Displays detailed metrics and analysis for model comparisons.
 */

import React from 'react'
import {
  Clock,
  Hash,
  Zap,
  Trophy,
  Star,
  BarChart3} from 'lucide-react'
import {
  ComparisonResult,
  ModelInfo,
  formatResponseTime,
  formatTokenCount
} from '../lib/comparison-api'

interface ComparisonMetricsProps {
  results: ComparisonResult[]
  models: ModelInfo[]
}

export default function ComparisonMetrics({ results, models }: ComparisonMetricsProps) {
  // Calculate metrics
  const completedResults = results.filter(r => r.status === 'completed')
  
  if (completedResults.length === 0) {
    return null
  }
  
  // Find fastest response time
  const fastestResponse = completedResults.reduce((fastest, r) => {
    if (!r.response_time_ms) return fastest
    if (!fastest || r.response_time_ms < fastest.response_time_ms!) {
      return r
    }
    return fastest
  }, null as ComparisonResult | null)
  
  // Find fastest total time
  const fastestTotal = completedResults.reduce((fastest, r) => {
    if (!r.total_time_ms) return fastest
    if (!fastest || r.total_time_ms < fastest.total_time_ms!) {
      return r
    }
    return fastest
  }, null as ComparisonResult | null)
  
  // Find most tokens (longest response)
  const mostTokens = completedResults.reduce((most, r) => {
    if (!r.token_count) return most
    if (!most || r.token_count > most.token_count!) {
      return r
    }
    return most
  }, null as ComparisonResult | null)
  
  // Find winner
  const winner = completedResults.find(r => r.is_winner)
  
  // Find highest rated
  const highestRated = completedResults.reduce((highest, r) => {
    if (!r.user_rating) return highest
    if (!highest || r.user_rating > highest.user_rating!) {
      return r
    }
    return highest
  }, null as ComparisonResult | null)
  
  // Calculate average metrics
  const avgResponseTime = completedResults.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / completedResults.length
  const avgTotalTime = completedResults.reduce((sum, r) => sum + (r.total_time_ms || 0), 0) / completedResults.length
  const avgTokens = completedResults.reduce((sum, r) => sum + (r.token_count || 0), 0) / completedResults.length
  
  const getModelName = (modelId: string) => {
    const model = models.find(m => m.id === modelId)
    return model?.name || modelId
  }
  
  const getModelColor = (modelId: string) => {
    const model = models.find(m => m.id === modelId)
    return model?.color || '#666'
  }
  
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-4">
      <h3 className="text-lg font-medium text-white flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        Comparison Analysis
      </h3>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Fastest First Token */}
        {fastestResponse && (
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Zap className="w-3 h-3" />
              Fastest Response
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getModelColor(fastestResponse.model_id) }}
              />
              <span className="text-white font-medium text-sm">
                {getModelName(fastestResponse.model_id)}
              </span>
            </div>
            <div className="text-green-400 text-xs mt-1">
              {formatResponseTime(fastestResponse.response_time_ms)}
            </div>
          </div>
        )}
        
        {/* Fastest Total */}
        {fastestTotal && (
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Clock className="w-3 h-3" />
              Fastest Complete
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getModelColor(fastestTotal.model_id) }}
              />
              <span className="text-white font-medium text-sm">
                {getModelName(fastestTotal.model_id)}
              </span>
            </div>
            <div className="text-green-400 text-xs mt-1">
              {formatResponseTime(fastestTotal.total_time_ms)}
            </div>
          </div>
        )}
        
        {/* Most Detailed */}
        {mostTokens && (
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Hash className="w-3 h-3" />
              Most Detailed
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getModelColor(mostTokens.model_id) }}
              />
              <span className="text-white font-medium text-sm">
                {getModelName(mostTokens.model_id)}
              </span>
            </div>
            <div className="text-blue-400 text-xs mt-1">
              {formatTokenCount(mostTokens.token_count)} tokens
            </div>
          </div>
        )}
        
        {/* Winner / Highest Rated */}
        {(winner || highestRated) && (
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              {winner ? <Trophy className="w-3 h-3" /> : <Star className="w-3 h-3" />}
              {winner ? 'Your Pick' : 'Highest Rated'}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getModelColor((winner || highestRated)!.model_id) }}
              />
              <span className="text-white font-medium text-sm">
                {getModelName((winner || highestRated)!.model_id)}
              </span>
            </div>
            {highestRated?.user_rating && (
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-3 h-3 ${
                      star <= highestRated.user_rating!
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-600'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Detailed Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs">
              <th className="text-left py-2 px-3">Model</th>
              <th className="text-right py-2 px-3">First Token</th>
              <th className="text-right py-2 px-3">Total Time</th>
              <th className="text-right py-2 px-3">Tokens</th>
              <th className="text-right py-2 px-3">Tokens/sec</th>
              <th className="text-center py-2 px-3">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {completedResults.map(result => {
              const tokensPerSec = result.total_time_ms && result.token_count
                ? Math.round((result.token_count / result.total_time_ms) * 1000)
                : null
              
              return (
                <tr key={result.id} className="text-white">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getModelColor(result.model_id) }}
                      />
                      <span>{getModelName(result.model_id)}</span>
                      {result.is_winner && (
                        <Trophy className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                  </td>
                  <td className={`text-right py-2 px-3 ${
                    fastestResponse?.model_id === result.model_id ? 'text-green-400' : 'text-gray-300'
                  }`}>
                    {formatResponseTime(result.response_time_ms)}
                  </td>
                  <td className={`text-right py-2 px-3 ${
                    fastestTotal?.model_id === result.model_id ? 'text-green-400' : 'text-gray-300'
                  }`}>
                    {formatResponseTime(result.total_time_ms)}
                  </td>
                  <td className={`text-right py-2 px-3 ${
                    mostTokens?.model_id === result.model_id ? 'text-blue-400' : 'text-gray-300'
                  }`}>
                    {formatTokenCount(result.token_count)}
                  </td>
                  <td className="text-right py-2 px-3 text-gray-300">
                    {tokensPerSec ? `${tokensPerSec}/s` : '-'}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            (result.user_rating || 0) >= star
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="text-gray-400 text-xs border-t border-gray-600">
              <td className="py-2 px-3 font-medium">Average</td>
              <td className="text-right py-2 px-3">{formatResponseTime(Math.round(avgResponseTime))}</td>
              <td className="text-right py-2 px-3">{formatResponseTime(Math.round(avgTotalTime))}</td>
              <td className="text-right py-2 px-3">{formatTokenCount(Math.round(avgTokens))}</td>
              <td className="text-right py-2 px-3">-</td>
              <td className="text-center py-2 px-3">-</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {/* Performance Bars */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-400">Response Time Comparison</h4>
        {completedResults.map(result => {
          const maxTime = Math.max(...completedResults.map(r => r.total_time_ms || 0))
          const percentage = result.total_time_ms ? (result.total_time_ms / maxTime) * 100 : 0
          
          return (
            <div key={result.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white">{getModelName(result.model_id)}</span>
                <span className="text-gray-400">{formatResponseTime(result.total_time_ms)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: getModelColor(result.model_id)
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
