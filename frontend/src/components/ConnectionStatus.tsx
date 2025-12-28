/**
 * Connection Status Component.
 * 
 * Shows WebSocket connection status indicator.
 */

import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { useWebSocketStore } from '../lib/websocket'

interface ConnectionStatusProps {
  className?: string
  showLabel?: boolean
}

export default function ConnectionStatus({
  className,
  showLabel = true
}: ConnectionStatusProps) {
  const { connected, connecting, lastError } = useWebSocketStore()
  
  const getStatus = () => {
    if (connecting) {
      return {
        icon: Loader2,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/20',
        label: 'Connecting...',
        animate: true
      }
    }
    
    if (connected) {
      return {
        icon: Wifi,
        color: 'text-green-500',
        bgColor: 'bg-green-500/20',
        label: 'Connected',
        animate: false
      }
    }
    
    return {
      icon: WifiOff,
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      label: lastError || 'Disconnected',
      animate: false
    }
  }
  
  const status = getStatus()
  const Icon = status.icon
  
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-md',
        status.bgColor,
        className
      )}
      title={status.label}
    >
      <Icon
        className={cn(
          'w-4 h-4',
          status.color,
          status.animate && 'animate-spin'
        )}
      />
      {showLabel && (
        <span className={cn('text-xs font-medium', status.color)}>
          {status.label}
        </span>
      )}
    </div>
  )
}
