/**
 * Online Users Component.
 * 
 * Shows list of currently online users with presence indicators.
 */

import { useState } from 'react'
import { Users, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'
import { useOnlineUsers } from '../hooks/useRealtime'

interface OnlineUsersProps {
  className?: string
  compact?: boolean
}

export default function OnlineUsers({ className, compact = false }: OnlineUsersProps) {
  const { onlineUsers } = useOnlineUsers()
  const [expanded, setExpanded] = useState(false)
  
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'away':
        return 'bg-yellow-500'
      case 'busy':
        return 'bg-red-500'
      default:
        return 'bg-green-500'
    }
  }
  
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex -space-x-2">
          {onlineUsers.slice(0, 3).map((user) => (
            <div
              key={user.user_id}
              className="w-8 h-8 rounded-full bg-ue-accent flex items-center justify-center text-xs font-medium text-white border-2 border-ue-bg"
              title={user.username}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
          ))}
          {onlineUsers.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-ue-surface flex items-center justify-center text-xs font-medium text-ue-muted border-2 border-ue-bg">
              +{onlineUsers.length - 3}
            </div>
          )}
        </div>
        <span className="text-sm text-ue-muted">
          {onlineUsers.length} online
        </span>
      </div>
    )
  }
  
  return (
    <div className={cn('bg-ue-surface rounded-lg border border-ue-border', className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-ue-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-ue-muted" />
          <span className="text-sm font-medium">Online Users</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
            {onlineUsers.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-ue-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-ue-muted" />
        )}
      </button>
      
      {expanded && (
        <div className="border-t border-ue-border max-h-64 overflow-y-auto">
          {onlineUsers.length === 0 ? (
            <div className="p-4 text-center text-sm text-ue-muted">
              No users online
            </div>
          ) : (
            <ul className="divide-y divide-ue-border">
              {onlineUsers.map((user) => (
                <li
                  key={user.user_id}
                  className="flex items-center gap-3 p-3 hover:bg-ue-bg/50"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-ue-accent flex items-center justify-center text-sm font-medium text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={cn(
                        'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-ue-surface',
                        getStatusColor(user.status)
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.username}</p>
                    <p className="text-xs text-ue-muted capitalize">
                      {user.status || 'online'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
