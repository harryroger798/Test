import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'healthy': return 'text-emerald-400'
    case 'info': return 'text-blue-400'
    case 'warning': return 'text-yellow-400'
    case 'critical': case 'error': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

export function severityBg(severity: string): string {
  switch (severity) {
    case 'healthy': return 'bg-emerald-500/20'
    case 'info': return 'bg-blue-500/20'
    case 'warning': return 'bg-yellow-500/20'
    case 'critical': case 'error': return 'bg-red-500/20'
    default: return 'bg-gray-500/20'
  }
}

export function healthColor(health: number): string {
  if (health >= 80) return 'text-emerald-400'
  if (health >= 60) return 'text-yellow-400'
  if (health >= 40) return 'text-orange-400'
  return 'text-red-400'
}

export function healthGradient(health: number): string {
  if (health >= 80) return 'from-emerald-500 to-emerald-400'
  if (health >= 60) return 'from-yellow-500 to-yellow-400'
  if (health >= 40) return 'from-orange-500 to-orange-400'
  return 'from-red-500 to-red-400'
}
