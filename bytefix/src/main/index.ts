import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join, resolve, sep, extname } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc-handler'
import { initDatabase } from './database'
import { createLogger } from './logger'
import { setupGlobalErrorHandlers, logToFile, getLogPath, getLogDir } from './error-handler'
import { setupAutoUpdater } from './auto-updater'
import { setupOfflineManager } from './offline-manager'

// Register custom 'bytefix' protocol BEFORE app.ready
// This protocol serves renderer files with proper CORS headers so that
// ES modules (type="module") work correctly in packaged builds.
// (file:// protocol blocks ES module loading due to CORS restrictions)
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

  // Log renderer console messages to main process for debugging
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] || 'UNKNOWN'
    logger.info(`[Renderer ${levelStr}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Load renderer HTML directly via file:// protocol.
    // The postbuild script strips type="module" from HTML (the bundle has no
    // import/export statements) and moves scripts after <div id="root">.
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

  // Register custom protocol handler for serving renderer files
  // with proper CORS headers so ES modules work in production builds
  const rendererRoot = resolve(__dirname, '../renderer')

  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.map': 'application/json'
  }

  protocol.handle('bytefix', async (request) => {
    try {
      const reqUrl = new URL(request.url)
      if (reqUrl.host !== 'app') return new Response('Not Found', { status: 404 })

      const pathname =
        reqUrl.pathname === '/' ? '/index.html' : decodeURIComponent(reqUrl.pathname)
      const filePath = resolve(rendererRoot, `.${pathname}`)

      // Prevent path traversal outside renderer directory
      if (filePath !== rendererRoot && !filePath.startsWith(`${rendererRoot}${sep}`)) {
        return new Response('Forbidden', { status: 403 })
      }

      // Read file asynchronously to avoid blocking the event loop
      const data = await readFile(filePath)
      const ext = extname(filePath).toLowerCase()
      const mimeType = mimeTypes[ext] || 'application/octet-stream'

      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': 'bytefix://app'
        }
      })
    } catch (error: unknown) {
      if (error instanceof URIError) {
        return new Response('Bad Request', { status: 400 })
      }
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return new Response('Not Found', { status: 404 })
      }
      if (code === 'EACCES' || code === 'EPERM') {
        return new Response('Forbidden', { status: 403 })
      }
      return new Response('Internal Server Error', { status: 500 })
    }
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
