import { execFile, exec } from 'child_process'
import { promisify } from 'util'
import { createLogger } from '../logger'

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)
const logger = createLogger('async-command')

/**
 * Run a command with arguments asynchronously (non-blocking).
 * Replacement for execFileSync — does NOT block the Electron main thread.
 */
export async function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      encoding: 'utf8',
      windowsHide: true
    })
    return stdout
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    if (error.stdout) return error.stdout
    throw err
  }
}

/**
 * Run a shell command string asynchronously (supports pipes, redirects, etc.).
 * Replacement for execSync — does NOT block the Electron main thread.
 */
export async function runShell(command: string, timeoutMs: number): Promise<string> {
  try {
    const { stdout } = await execAsync(command, {
      timeout: timeoutMs,
      encoding: 'utf8',
      windowsHide: true
    })
    return stdout
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    if (error.stdout) return error.stdout
    throw err
  }
}

/**
 * Run a shell command and return empty string on failure (instead of throwing).
 * Useful for optional/best-effort commands in diagnostics.
 */
export async function runShellSafe(command: string, timeoutMs: number): Promise<string> {
  try {
    return await runShell(command, timeoutMs)
  } catch (err) {
    logger.debug(`Command failed (safe): ${command}`, err)
    return ''
  }
}

export async function runShellDetailed(command: string, timeoutMs: number): Promise<{
  stdout: string
  stderr: string
  error?: string
}> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      encoding: 'utf8',
      windowsHide: true
    })
    return { stdout, stderr }
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      error: error.message || String(err)
    }
  }
}

/**
 * Run a command with arguments and return empty string on failure.
 */
export async function runCommandSafe(command: string, args: string[], timeoutMs: number): Promise<string> {
  try {
    return await runCommand(command, args, timeoutMs)
  } catch (err) {
    logger.debug(`Command failed (safe): ${command} ${args.join(' ')}`, err)
    return ''
  }
}
