import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { createLogger } from './logger'

const logger = createLogger('platform-utils')

export type Platform = 'win32' | 'darwin' | 'linux'

export function getCurrentPlatform(): Platform {
  return process.platform as Platform
}

export function isWindows(): boolean {
  return process.platform === 'win32'
}

export function isMac(): boolean {
  return process.platform === 'darwin'
}

export function isLinux(): boolean {
  return process.platform === 'linux'
}

/**
 * Check if a command-line tool is available on the system
 */
export function isToolAvailable(toolName: string): boolean {
  try {
    const cmd = isWindows() ? 'where' : 'which'
    execFileSync(cmd, [toolName], { timeout: 5000, encoding: 'utf8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Get the correct smartctl path depending on platform
 */
export function getSmartctlPath(): string {
  if (isWindows()) {
    const windowsPaths = [
      'C:\\Program Files\\smartmontools\\bin\\smartctl.exe',
      'C:\\Program Files (x86)\\smartmontools\\bin\\smartctl.exe'
    ]
    for (const p of windowsPaths) {
      if (existsSync(p)) return p
    }
  }
  return 'smartctl'
}

/**
 * Get the correct ClamAV scan command depending on platform
 */
export function getClamScanPath(): string {
  if (isWindows()) {
    const windowsPaths = [
      'C:\\Program Files\\ClamAV\\clamscan.exe',
      'C:\\Program Files (x86)\\ClamAV\\clamscan.exe'
    ]
    for (const p of windowsPaths) {
      if (existsSync(p)) return p
    }
  }
  if (isMac()) {
    const macPaths = ['/usr/local/bin/clamscan', '/opt/homebrew/bin/clamscan']
    for (const p of macPaths) {
      if (existsSync(p)) return p
    }
  }
  return 'clamscan'
}

/**
 * Safe file copy that uses the right command per platform
 * Windows: robocopy (falls back to copy), macOS/Linux: cp or rsync
 */
export function copyFileCommand(source: string, dest: string): { command: string; args: string[] } {
  if (isWindows()) {
    if (isToolAvailable('robocopy')) {
      return { command: 'robocopy', args: [source, dest, '/E', '/R:1', '/W:1'] }
    }
    return { command: 'cmd', args: ['/c', 'copy', '/Y', source, dest] }
  }
  if (isToolAvailable('rsync')) {
    return { command: 'rsync', args: ['-a', source, dest] }
  }
  return { command: 'cp', args: ['-r', source, dest] }
}

/**
 * Run a platform-appropriate service management command
 */
export function restartService(serviceName: string): { success: boolean; output: string } {
  try {
    if (isWindows()) {
      execFileSync('net', ['stop', serviceName], { timeout: 15000, encoding: 'utf8', stdio: 'pipe' })
      const output = execFileSync('net', ['start', serviceName], { timeout: 15000, encoding: 'utf8', stdio: 'pipe' })
      return { success: true, output }
    }
    if (isMac()) {
      // macOS uses launchctl
      const output = execFileSync('sudo', ['launchctl', 'kickstart', '-k', `system/${serviceName}`], {
        timeout: 15000, encoding: 'utf8', stdio: 'pipe'
      })
      return { success: true, output }
    }
    // Linux: systemctl
    const output = execFileSync('systemctl', ['restart', serviceName], {
      timeout: 15000, encoding: 'utf8', stdio: 'pipe'
    })
    return { success: true, output }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn(`Failed to restart service ${serviceName}: ${message}`)
    return { success: false, output: message }
  }
}

/**
 * Get DNS flush command per platform
 */
export function getDnsFlushCommand(): { command: string; args: string[] } {
  if (isWindows()) {
    return { command: 'ipconfig', args: ['/flushdns'] }
  }
  if (isMac()) {
    return { command: 'sudo', args: ['dscacheutil', '-flushcache'] }
  }
  // Linux
  if (isToolAvailable('systemd-resolve')) {
    return { command: 'systemd-resolve', args: ['--flush-caches'] }
  }
  if (isToolAvailable('resolvectl')) {
    return { command: 'resolvectl', args: ['flush-caches'] }
  }
  return { command: 'systemctl', args: ['restart', 'systemd-resolved'] }
}

/**
 * Get temp directory path per platform
 */
export function getTempDir(): string {
  if (isWindows()) {
    return process.env['TEMP'] || process.env['TMP'] || 'C:\\Windows\\Temp'
  }
  return '/tmp'
}

/**
 * Check if running with admin/root privileges
 */
export function isElevated(): boolean {
  try {
    if (isWindows()) {
      execFileSync('net', ['session'], { timeout: 5000, stdio: 'pipe' })
      return true
    }
    return process.getuid?.() === 0
  } catch {
    return false
  }
}

/**
 * Get the platform-appropriate network reset commands
 */
export function getNetworkResetCommands(): Array<{ description: string; command: string; args: string[] }> {
  if (isWindows()) {
    return [
      { description: 'Flush DNS', command: 'ipconfig', args: ['/flushdns'] },
      { description: 'Reset Winsock', command: 'netsh', args: ['winsock', 'reset'] },
      { description: 'Reset TCP/IP', command: 'netsh', args: ['int', 'ip', 'reset'] }
    ]
  }
  if (isMac()) {
    return [
      { description: 'Flush DNS', command: 'sudo', args: ['dscacheutil', '-flushcache'] },
      { description: 'Kill mDNSResponder', command: 'sudo', args: ['killall', '-HUP', 'mDNSResponder'] }
    ]
  }
  // Linux
  return [
    { description: 'Flush DNS', command: 'systemd-resolve', args: ['--flush-caches'] },
    { description: 'Restart NetworkManager', command: 'systemctl', args: ['restart', 'NetworkManager'] }
  ]
}

/**
 * Platform-specific power plan optimization
 */
export function getPowerOptimizeCommands(): Array<{ description: string; command: string; args: string[] }> {
  if (isWindows()) {
    return [
      { description: 'Set High Performance', command: 'powercfg', args: ['/setactive', '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'] },
      { description: 'Disable hibernation', command: 'powercfg', args: ['/hibernate', 'off'] }
    ]
  }
  if (isMac()) {
    return [
      { description: 'Set performance mode', command: 'sudo', args: ['pmset', '-a', 'highpowermode', '1'] }
    ]
  }
  // Linux
  return [
    { description: 'Set performance governor', command: 'cpupower', args: ['frequency-set', '-g', 'performance'] }
  ]
}
