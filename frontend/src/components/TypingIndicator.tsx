/**
 * Typing Indicator Component.
 * 
 * Shows animated dots when users are typing.
 */

import { cn } from '../lib/utils'

interface TypingUser {
  user_id: number
  username: string
}

interface TypingIndicatorProps {
  users: TypingUser[]
  isAI?: boolean
  agentName?: string
  className?: string
}

export default function TypingIndicator({
  users,
  isAI = false,
  agentName,
  className
}: TypingIndicatorProps) {
  if (users.length === 0 && !isAI) return null
  
  const getTypingText = () => {
    if (isAI && agentName) {
      return `${agentName} is thinking`
    }
    
    if (users.length === 1) {
      return `${users[0].username} is typing`
    }
    
    if (users.length === 2) {
      return `${users[0].username} and ${users[1].username} are typing`
    }
    
    if (users.length > 2) {
      return `${users[0].username} and ${users.length - 1} others are typing`
    }
    
    return ''
  }
  
  const text = getTypingText()
  if (!text) return null
  
  return (
    <div className={cn(
      'flex items-center gap-2 text-sm text-ue-muted px-4 py-2',
      className
    )}>
      <div className="flex gap-1">
        <span
          className="w-2 h-2 rounded-full bg-ue-accent animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-ue-accent animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-ue-accent animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span>{text}</span>
    </div>
  )
}
