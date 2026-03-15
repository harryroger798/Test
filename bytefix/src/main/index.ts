import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc-handler'
import { initDatabase } from './database'
import { createLogger } from './logger'
import { setupGlobalErrorHandlers, logToFile, getLogPath, getLogDir } from './error-handler'
import { setupAutoUpdater } from './auto-updater'
import { setupOfflineManager } from './offline-manager'

const logger = createLogger('main')

let mainWindow: BrowserWindow | null = null
let autoUpdaterInitialized = false
let offlineManagerInitialized = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'ByteFix',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Setup auto-updater (only in production builds, once only)
  if (!is.dev && !autoUpdaterInitialized) {
    setupAutoUpdater(mainWindow)
    autoUpdaterInitialized = true
  }

  // Setup offline manager (once only)
  if (!offlineManagerInitialized) {
    setupOfflineManager(mainWindow)
    offlineManagerInitialized = true
  }
}

app.whenReady().then(async () => {
  // Setup global error handlers after app is ready (needs app.getPath)
  setupGlobalErrorHandlers()

  electronApp.setAppUserModelId('com.bytefix.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    await initDatabase()
    logger.info('Database initialized')
  } catch (err) {
    logger.error('Failed to initialize database', err)
  }

  registerAllHandlers(ipcMain)
  logger.info('IPC handlers registered')

  // Register error logging IPC handler
  ipcMain.handle('app:logError', (_event, data: { module: string; message: string; stack?: string; componentStack?: string; timestamp: number }) => {
    logToFile('ERROR', `renderer/${data.module}`, data.message, {
      stack: data.stack,
      componentStack: data.componentStack
    })
  })

  // App info handlers
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getLogPath', () => getLogPath())
  ipcMain.handle('app:getLogDir', () => getLogDir())
  ipcMain.handle('app:getPlatform', () => process.platform)
  ipcMain.handle('app:getArch', () => process.arch)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Note: Global uncaughtException and unhandledRejection handlers
// are now managed by error-handler.ts (setupGlobalErrorHandlers)
