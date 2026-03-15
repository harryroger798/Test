import { ipcMain, BrowserWindow, net, app } from 'electron'
import { logToFile } from './error-handler'

interface QueuedAction {
  id: string
  type: string
  payload: Record<string, unknown>
  timestamp: number
  retries: number
}

let isOnline = true
let mainWindow: BrowserWindow | null = null
const actionQueue: QueuedAction[] = []
const MAX_RETRIES = 3
const MAX_QUEUE_SIZE = 100

function sendToRenderer(channel: string, data: Record<string, unknown>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

async function checkConnectivity(): Promise<void> {
  const wasOnline = isOnline

  try {
    const netOnline = net.isOnline()

    if (netOnline) {
      const reachable = await pingEndpoint('https://clients3.google.com/generate_204', 5000)
      isOnline = reachable
    } else {
      isOnline = false
    }
  } catch {
    isOnline = false
  }

  if (wasOnline !== isOnline) {
    logToFile('INFO', 'offline', `Connectivity changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
    sendToRenderer('offline:statusChanged', { online: isOnline })

    if (isOnline && actionQueue.length > 0) {
      sendToRenderer('offline:processingQueue', { count: actionQueue.length })
      processQueue()
    }
  }
}

function pingEndpoint(url: string, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = net.request({ url, method: 'HEAD' })
    const timer = setTimeout(() => {
      request.abort()
      resolve(false)
    }, timeout)

    request.on('response', (response) => {
      clearTimeout(timer)
      resolve(response.statusCode < 500)
    })

    request.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })

    request.end()
  })
}

function processQueue(): void {
  while (actionQueue.length > 0 && isOnline) {
    const action = actionQueue.shift()!
    sendToRenderer('offline:replayAction', {
      id: action.id,
      type: action.type,
      payload: action.payload,
      timestamp: action.timestamp
    })
    logToFile('INFO', 'offline', `Replayed queued action: ${action.type}`, { id: action.id })
  }
}

export function setupOfflineManager(win: BrowserWindow): void {
  mainWindow = win

  // Initial check
  checkConnectivity()

  // Poll every 30 seconds
  const connectivityInterval = setInterval(() => {
    checkConnectivity()
  }, 30_000)

  // Clean up interval on app quit
  app.on('will-quit', () => {
    clearInterval(connectivityInterval)
  })

  // IPC handlers
  ipcMain.handle('offline:getStatus', () => ({ online: isOnline }))

  ipcMain.handle(
    'offline:queueAction',
    (_event, action: { type: string; payload: Record<string, unknown> }) => {
      const queued: QueuedAction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: action.type,
        payload: action.payload,
        timestamp: Date.now(),
        retries: 0
      }
      if (actionQueue.length >= MAX_QUEUE_SIZE) {
        logToFile('WARN', 'offline', `Queue full (${MAX_QUEUE_SIZE}), dropping oldest action`)
        actionQueue.shift()
      }
      actionQueue.push(queued)
      logToFile('INFO', 'offline', `Queued action: ${action.type}`, { id: queued.id })
      return { success: true, id: queued.id, queueLength: actionQueue.length }
    }
  )

  ipcMain.handle('offline:getQueue', () => ({
    actions: actionQueue.map((a) => ({ id: a.id, type: a.type, timestamp: a.timestamp })),
    count: actionQueue.length
  }))

  ipcMain.handle('offline:clearQueue', () => {
    actionQueue.length = 0
    return { success: true }
  })

  ipcMain.handle('offline:forceCheck', async () => {
    await checkConnectivity()
    return { online: isOnline }
  })
}
