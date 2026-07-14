import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { createLogger, getLogDirectory } from '../logger'
import type { SafetyActionLogEntry } from '../../shared/types'

const PREFIX = '[safety-action] '
const MAX_ENTRIES = 200
const MAX_TEXT = 800
const logger = createLogger('safety-gate')

function safeText(value: unknown): string {
  return String(value ?? '')
    .replace(/bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/(token|api[_-]?key|password|secret)\s*[=:]\s*\S+/gi, '$1=[REDACTED]')
    .slice(0, MAX_TEXT)
}

export function recordSafetyAction(entry: Omit<SafetyActionLogEntry, 'timestamp'>): void {
  const loggerEntry: SafetyActionLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    exitInfo: entry.exitInfo ? safeText(entry.exitInfo) : undefined,
    commands: entry.commands?.map(safeText),
    outputTail: entry.outputTail ? safeText(entry.outputTail) : undefined
  }
  // The logger's message is intentionally a small structured record. It keeps
  // activity-log parsing independent from arbitrary application log metadata.
  safetyActionLogger(loggerEntry)
}

function safetyActionLogger(entry: SafetyActionLogEntry): void {
  logger.info(`${PREFIX}${JSON.stringify(entry)}`)
}

export function readRecentSafetyActions(limit = MAX_ENTRIES): SafetyActionLogEntry[] {
  const path = join(getLogDirectory(), 'combined.log')
  if (!existsSync(path)) return []
  let content = ''
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return []
  }
  const entries: SafetyActionLogEntry[] = []
  for (const line of content.split(/\r?\n/).reverse()) {
    const marker = line.indexOf(PREFIX)
    if (marker < 0) continue
    try {
      const parsed = JSON.parse(line.slice(marker + PREFIX.length)) as SafetyActionLogEntry
      if (parsed.channel && parsed.phase) entries.push(parsed)
    } catch {
      // Ignore partial or rotated log lines.
    }
    if (entries.length >= Math.min(Math.max(1, limit), MAX_ENTRIES)) break
  }
  return entries
}
