import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc-handler'
import { initDatabase } from './database'
import { createLogger } from './logger'
import { setupGlobalErrorHandlers, logToFile, getLogPath, getLogDir } from './error-handler'
import { setupAutoUpdater } from './auto-updater'
import { setupOfflineManager } from './offline-manager'

// Register custom 'app' protocol BEFORE app.ready
// This fixes blank screen caused by type="module" scripts being blocked on file:// protocol
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bytefix',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

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
    // Use custom protocol to serve renderer files with proper CORS headers
    // This allows <script type="module"> to work (file:// blocks ES modules)
    mainWindow.loadURL('bytefix://app/index.html')
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

  // Register custom protocol handler to serve renderer files with CORS support
  // This fixes the blank screen issue where <script type="module"> is silently
  // blocked on file:// protocol due to CORS restrictions in Chromium
  protocol.handle('bytefix', (request) => {
    const url = new URL(request.url)
    const filePath = join(
      __dirname,
      '../renderer',
      decodeURIComponent(url.pathname)
    )
    return net.fetch(pathToFileURL(filePath).toString())
  })

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
