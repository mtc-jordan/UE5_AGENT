import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export const agentColors: Record<string, string> = {
  architect: '#58a6ff',
  developer: '#3fb950',
  blueprint: '#f0883e',
  qa: '#a371f7',
  devops: '#d29922',
  artist: '#f778ba',
}

export const agentIcons: Record<string, string> = {
  architect: 'Compass',
  developer: 'Code',
  blueprint: 'Workflow',
  qa: 'Shield',
  devops: 'Server',
  artist: 'Palette',
}
