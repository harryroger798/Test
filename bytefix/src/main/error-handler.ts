import { app, dialog, BrowserWindow } from 'electron'
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { createLogger } from './logger'

const logger = createLogger('error-handler')

let logDir: string
let logFile: string

function ensureLogDir(): void {
  if (!logDir) {
    logDir = path.join(app.getPath('userData'), 'logs')
    const today = new Date().toISOString().split('T')[0]
    logFile = path.join(logDir, `bytefix-${today}.log`)
  }
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
}

export function logToFile(
  level: 'INFO' | 'WARN' | 'ERROR',
  source: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  ensureLogDir()
  const entry = `[${new Date().toISOString()}] [${level}] [${source}] ${message}${meta ? ' | ' + JSON.stringify(meta) : ''}\n`
  try {
    appendFileSync(logFile, entry)
  } catch {
    // Cannot crash the crash handler
  }
}

export function setupGlobalErrorHandlers(): void {
  ensureLogDir()

  process.on('uncaughtException', (error) => {
    logToFile('ERROR', 'main/uncaught', error.message, { stack: error.stack })
    logger.error('Uncaught exception:', error)

    // Known non-fatal error codes — don't show dialog for these
    const nonFatal = [
      'EPERM', 'EACCES', 'ENOENT', 'ECONNREFUSED', 'ECONNRESET',
      'SQLITE_BUSY', 'SQLITE_LOCKED', 'ETIMEDOUT', 'EHOSTUNREACH',
      'ERR_INTERNET_DISCONNECTED'
    ]
    const isNonFatal = nonFatal.some((code) => error.message.includes(code))

    if (!isNonFatal) {
      try {
        dialog.showErrorBox(
          'ByteFix - Unexpected Error',
          `An error occurred. The app will try to continue.\n\n${error.message}\n\nLog: ${logFile}`
        )
      } catch {
        // dialog might fail if app is exiting
      }
    }
  })

  process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    logToFile('ERROR', 'main/unhandledRejection', message, { stack })
    logger.error('Unhandled rejection:', reason)
  })

  // Renderer crash handling — auto-reload on crash/OOM with cooldown to prevent infinite loop
  let crashCount = 0
  let lastCrashTime = 0
  const CRASH_COOLDOWN_MS = 10_000
  const MAX_CRASHES = 3

  app.on('render-process-gone', (_event, _webContents, details) => {
    logToFile('ERROR', 'renderer/crash', `Renderer process gone: ${details.reason}`, {
      reason: details.reason,
      exitCode: details.exitCode
    })
    if (details.reason === 'crashed' || details.reason === 'oom') {
      const now = Date.now()
      if (now - lastCrashTime > CRASH_COOLDOWN_MS) {
        crashCount = 0
      }
      lastCrashTime = now
      crashCount++

      if (crashCount <= MAX_CRASHES) {
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.reload()
        }
      } else {
        logToFile('ERROR', 'renderer/crash', `Too many crashes (${crashCount}), not reloading`)
        try {
          dialog.showErrorBox(
            'ByteFix - Repeated Crashes',
            'The application has crashed multiple times. Please restart ByteFix manually.'
          )
        } catch {
          // dialog might fail during shutdown
        }
      }
    }
  })

  app.on('child-process-gone', (_event, details) => {
    logToFile('WARN', 'child/crash', `Child process gone: ${details.type}`, {
      type: details.type,
      reason: details.reason
    })
  })
}

export function getLogPath(): string {
  ensureLogDir()
  return logFile
}

export function getLogDir(): string {
  ensureLogDir()
  return logDir
}
