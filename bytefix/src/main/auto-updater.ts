import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain, app } from 'electron'
import { logToFile } from './error-handler'

let mainWindow: BrowserWindow | null = null
let updateAvailable = false
let downloadedUpdate = false

function sendToRenderer(channel: string, data: Record<string, unknown>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

export function setupAutoUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Config
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false

  // Events
  autoUpdater.on('checking-for-update', () => {
    logToFile('INFO', 'updater', 'Checking for updates...')
    sendToRenderer('updater:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    logToFile('INFO', 'updater', `Update available: ${info.version}`)
    updateAvailable = true
    sendToRenderer('updater:status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    logToFile('INFO', 'updater', `No update available. Current: ${app.getVersion()}, Latest: ${info.version}`)
    sendToRenderer('updater:status', { status: 'up-to-date', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('updater:status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    logToFile('INFO', 'updater', `Update downloaded: ${info.version}`)
    downloadedUpdate = true
    sendToRenderer('updater:status', {
      status: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (error) => {
    logToFile('ERROR', 'updater', error.message, { stack: error.stack })
    sendToRenderer('updater:status', {
      status: 'error',
      message: error.message
    })
  })

  // IPC handlers
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo?.version }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logToFile('ERROR', 'updater', `Check failed: ${message}`)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('updater:download', async () => {
    if (!updateAvailable) return { success: false, error: 'No update available' }
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('updater:install', () => {
    if (!downloadedUpdate) return { success: false, error: 'No downloaded update' }
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true)
    }, 1000)
    return { success: true }
  })

  ipcMain.handle('updater:getVersion', () => app.getVersion())

  // Check on launch (delayed to not block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      logToFile('WARN', 'updater', `Auto-check failed: ${message}`)
    })
  }, 10_000)

  // Check every 4 hours
  const updateInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Silent failure on periodic checks
    })
  }, 4 * 60 * 60 * 1000)

  // Clean up interval on app quit
  app.on('will-quit', () => {
    clearInterval(updateInterval)
  })
}
