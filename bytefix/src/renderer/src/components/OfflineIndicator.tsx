import React, { useState, useEffect } from 'react'

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    const api = (window as Record<string, unknown>).bytefix as
      | {
          getOfflineStatus?: () => Promise<{ online: boolean }>
          getOfflineQueue?: () => Promise<{ count: number }>
          onOfflineStatusChanged?: (callback: (data: { online: boolean }) => void) => void
        }
      | undefined

    // Initial check
    if (api?.getOfflineStatus) {
      api.getOfflineStatus().then((status) => setOnline(status.online)).catch(() => {})
    }

    if (api?.getOfflineQueue) {
      api.getOfflineQueue().then((queue) => setQueueCount(queue.count)).catch(() => {})
    }

    // Listen for changes via window events (from preload)
    const handleStatusChange = (event: Event): void => {
      const detail = (event as CustomEvent<{ online: boolean }>).detail
      setOnline(detail.online)
    }

    const handleQueueUpdate = (event: Event): void => {
      const detail = (event as CustomEvent<{ count: number }>).detail
      setQueueCount(detail.count)
    }

    window.addEventListener('bytefix:offline-status', handleStatusChange)
    window.addEventListener('bytefix:queue-update', handleQueueUpdate)

    return () => {
      window.removeEventListener('bytefix:offline-status', handleStatusChange)
      window.removeEventListener('bytefix:queue-update', handleQueueUpdate)
    }
  }, [])

  if (online && queueCount === 0) return null

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm ${
        online ? 'bg-yellow-900/90 text-yellow-200' : 'bg-red-900/90 text-red-200'
      }`}
    >
      <div
        className={`h-2 w-2 rounded-full ${online ? 'bg-yellow-400' : 'bg-red-400 animate-pulse'}`}
      />
      {!online && <span>Offline</span>}
      {queueCount > 0 && (
        <span>
          {queueCount} action{queueCount > 1 ? 's' : ''} queued
        </span>
      )}
    </div>
  )
}
