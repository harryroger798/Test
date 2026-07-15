import winston from 'winston'
import { app } from 'electron'
import { join } from 'path'

export function getLogDirectory(): string {
  return app?.isPackaged
    ? join(app.getPath('userData'), 'logs')
    : join(__dirname, '../../logs')
}

export function createLogger(module: string): winston.Logger {
  const logDir = getLogDirectory()
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        const base = `${timestamp} [${module}] ${level}: ${message}`
        return stack ? `${base}\n${stack}` : base
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({
        filename: join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 3
      }),
      new winston.transports.File({
        filename: join(logDir, 'combined.log'),
        maxsize: 10485760,
        maxFiles: 5
      })
    ]
  })
}
