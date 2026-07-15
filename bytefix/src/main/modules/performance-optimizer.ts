import { platform } from 'os'
import { existsSync, statSync, lstatSync, readdirSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import { createLogger } from '../logger'
import { runShellSafe, runCommandSafe, runCommandDetailed } from './async-command'
import type { StartupItem, CleanupItem, FixResult, FixChange, DiagnosticResult } from '../../shared/types'

const logger = createLogger('performance-optimizer')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'

let lastStartupProbe: {
  command: string
  stdout: string
  stderr: string
  error?: string
} | null = null

// ============================================================
// Indian OEM Bloatware Database
// ============================================================
const BLOATWARE_LIST = new Set([
  // HP Bloatware
  'hp jumpstart', 'hp support assistant', 'hp audio switch', 'hp sure connect',
  'hp touchpoint analytics', 'hp wolf security', 'hp documentation',
  // Dell Bloatware
  'dell supportassist', 'dell digital delivery', 'dell mobile connect',
  'dell customer connect', 'dell cinemacolor', 'dell update',
  // Lenovo Bloatware
  'lenovo vantage', 'lenovo now', 'lenovo utility', 'lenovo welcome',
  'lenovo experience improvement', 'lenovo solution center',
  // Acer Bloatware
  'acer care center', 'acer collection', 'acer jumpstart',
  'acer configuration manager', 'acer portal',
  // ASUS Bloatware
  'asus giftbox', 'myasus', 'asus live update',
  // Common PUPs in India
  'mcafee', 'norton', 'avast', 'avg', 'segurazo', 'bytefence',
  'wildtangent', 'candycrush', 'bubblewitch', 'farmville',
  'dolby access', 'fitbit coach', 'phototastic collage',
  'picsart', 'spotify', 'disney+', 'tiktok',
  // Common Indian PUPs
  'uc browser', 'baidu', 'wps office', 'kingsoft',
])

// ============================================================
// Startup Items Management
// ============================================================
export async function getStartupItems(): Promise<StartupItem[]> {
  const items: StartupItem[] = []

  if (isWindows) {
    try {
      const script = `
$items = @()
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKCU:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
)
foreach ($p in $paths) {
  if (Test-Path -LiteralPath $p) {
    $props = Get-ItemProperty -LiteralPath $p -ErrorAction SilentlyContinue
    if ($props) {
      $props.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
        $items += [ordered]@{ Name = [string]$_.Name; Path = [string]$_.Value; Source = [string]$p }
      }
    }
  }
}
try {
  Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction Stop | ForEach-Object {
    $items += [ordered]@{ Name = [string]$_.Name; Path = [string]$_.Command; Source = [string]$_.Location }
  }
} catch {}
foreach ($folder in @(
  [Environment]::GetFolderPath('Startup'),
  [Environment]::GetFolderPath('CommonStartup')
)) {
  if ($folder -and (Test-Path -LiteralPath $folder)) {
    Get-ChildItem -LiteralPath $folder -File -ErrorAction SilentlyContinue | ForEach-Object {
      $items += [ordered]@{ Name = [string]$_.BaseName; Path = [string]$_.FullName; Source = [string]$folder }
    }
  }
}
$items | ConvertTo-Json -Depth 4 -Compress
`
      const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]
      const command = `powershell.exe ${args.slice(0, -1).join(' ')} <startup collection script>`
      const probe = await runCommandDetailed('powershell.exe', args, 15000)
      lastStartupProbe = { command, ...probe }
      if (probe.error && !probe.stdout.trim()) throw new Error(probe.error)
      const output = probe.stdout
      const parsed = JSON.parse(output || '[]')
      const startupEntries = Array.isArray(parsed) ? parsed : [parsed]

      const seen = new Set<string>()
      for (const entry of startupEntries) {
        if (!entry?.Name) continue
        const itemKey = `${entry.Name}\u0000${entry.Path || ''}\u0000${entry.Source || ''}`
        if (seen.has(itemKey)) continue
        seen.add(itemKey)
        const nameLower = entry.Name.toLowerCase()
        const isBloat = BLOATWARE_LIST.has(nameLower) ||
          [...BLOATWARE_LIST].some(b => nameLower.includes(b))

        items.push({
          name: entry.Name,
          path: entry.Path || '',
          source: entry.Source || '',
          publisher: '',
          enabled: true,
          impact: isBloat ? 'high' : 'medium',
          isBloatware: isBloat,
          isSystem: isSystemStartup(entry.Name),
          recommendation: isBloat ? 'disable' : isSystemStartup(entry.Name) ? 'keep' : 'keep'
        })
      }
    } catch (err) {
      logger.error('Failed to get Windows startup items', err)
    }
  } else if (isMac) {
    try {
      // macOS LaunchAgents
      const launchPaths = [
        join(process.env.HOME || '', 'Library/LaunchAgents'),
        '/Library/LaunchAgents',
        '/Library/LaunchDaemons'
      ]
      for (const lp of launchPaths) {
        if (existsSync(lp)) {
          const files = readdirSync(lp).filter(f => f.endsWith('.plist'))
          for (const f of files) {
            items.push({
              name: f.replace('.plist', ''),
              path: join(lp, f),
              publisher: '',
              enabled: true,
              impact: 'medium',
              isBloatware: false,
              isSystem: f.startsWith('com.apple.'),
              recommendation: f.startsWith('com.apple.') ? 'keep' : 'keep'
            })
          }
        }
      }
    } catch (err) {
      logger.error('Failed to get macOS startup items', err)
    }
  } else {
    // Linux
    try {
      const autostartDir = join(process.env.HOME || '', '.config/autostart')
      if (existsSync(autostartDir)) {
        const files = readdirSync(autostartDir).filter(f => f.endsWith('.desktop'))
        for (const f of files) {
          items.push({
            name: f.replace('.desktop', ''),
            path: join(autostartDir, f),
            publisher: '',
            enabled: true,
            impact: 'low',
            isBloatware: false,
            isSystem: false,
            recommendation: 'keep'
          })
        }
      }
      // Also check systemd user services
      const systemdUserDir = join(process.env.HOME || '', '.config/systemd/user')
      if (existsSync(systemdUserDir)) {
        const files = readdirSync(systemdUserDir).filter(f => f.endsWith('.service'))
        for (const f of files) {
          items.push({
            name: f.replace('.service', ''),
            path: join(systemdUserDir, f),
            publisher: '',
            enabled: true,
            impact: 'low',
            isBloatware: false,
            isSystem: false,
            recommendation: 'keep'
          })
        }
      }
    } catch (err) {
      logger.error('Failed to get Linux startup items', err)
    }
  }

  return items
}

export function getLastStartupProbe(): typeof lastStartupProbe {
  return lastStartupProbe
}

// Validate registry value name: only allow alphanumeric, spaces, hyphens, underscores, dots
function sanitizeRegistryValueName(name: string): string {
  if (!/^[a-zA-Z0-9 _\-\.]+$/.test(name)) {
    throw new Error(`Invalid startup item name: ${name}`)
  }
  return name
}

// Validate file path: reject shell metacharacters
function sanitizeFilePath(p: string): string {
  if (/[;&|`$<>!\n\r]/.test(p)) {
    throw new Error(`Invalid file path: ${p}`)
  }
  return p
}

export async function disableStartupItem(name: string, path: string): Promise<FixResult> {
  const changes: FixChange[] = []

  try {
    const safeName = sanitizeRegistryValueName(name)
    const safePath = sanitizeFilePath(path)

    if (isWindows) {
      // Remove from registry Run key
      const regPaths = [
        'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
      ]
      for (const regPath of regPaths) {
        try {
          await runCommandSafe('reg', ['delete', regPath, '/v', safeName, '/f'], 5000)
          changes.push({
            type: 'registry',
            action: 'deleted',
            target: `${regPath}\\${safeName}`,
            before: safePath,
            after: 'Removed'
          })
          break
        } catch {
          // Key might not exist in this path
        }
      }
    } else if (isMac) {
      if (existsSync(safePath)) {
        await runCommandSafe('launchctl', ['unload', safePath], 5000)
        changes.push({ type: 'service', action: 'disabled', target: safePath })
      }
    } else {
      // Linux - rename .desktop file
      if (existsSync(safePath)) {
        const disabledPath = safePath + '.disabled'
        await runCommandSafe('mv', [safePath, disabledPath], 5000)
        changes.push({ type: 'file', action: 'modified', target: safePath, after: disabledPath })
      }
    }

    return {
      success: changes.length > 0,
      module: 'performance',
      action: 'disable_startup',
      description: `Disabled startup item: ${name}`,
      details: [`Removed ${name} from auto-start`],
      changes,
      rollbackAvailable: true
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`Failed to disable startup item ${name}`, err)
    return {
      success: false, module: 'performance', action: 'disable_startup',
      description: `Failed to disable: ${name}`, details: [], changes, rollbackAvailable: false, error: msg
    }
  }
}

// ============================================================
// Disk Cleanup
// ============================================================
export async function getCleanupItems(): Promise<CleanupItem[]> {
  const items: CleanupItem[] = []

  if (isWindows) {
    const tempPaths = [
      { path: process.env.TEMP || 'C:\\Windows\\Temp', cat: 'Temporary Files' },
      { path: 'C:\\Windows\\Temp', cat: 'Windows Temp' },
      { path: join(process.env.USERPROFILE || '', 'AppData\\Local\\Temp'), cat: 'User Temp' },
      { path: 'C:\\Windows\\Prefetch', cat: 'Prefetch Cache' },
      { path: 'C:\\Windows\\SoftwareDistribution\\Download', cat: 'Windows Update Cache' },
      { path: join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\User Data\\Default\\Cache'), cat: 'Chrome Cache' },
      { path: join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\User Data\\Default\\Cache'), cat: 'Edge Cache' },
      { path: join(process.env.APPDATA || '', 'Mozilla\\Firefox\\Profiles'), cat: 'Firefox Cache' },
      { path: 'C:\\$Recycle.Bin', cat: 'Recycle Bin' },
      { path: join(process.env.LOCALAPPDATA || '', 'CrashDumps'), cat: 'Crash Dumps' },
      { path: 'C:\\Windows\\Logs', cat: 'Windows Logs' },
      { path: join(process.env.LOCALAPPDATA || '', 'Temp'), cat: 'Local App Temp' },
    ]

    for (const { path: dirPath, cat } of tempPaths) {
      const size = getDirSize(dirPath)
      if (size > 0) {
        items.push({
          category: cat,
          path: dirPath,
          size,
          description: `${cat} - ${formatBytes(size)}`,
          safe: true,
          selected: size > 10 * 1024 * 1024 // Auto-select if > 10MB
        })
      }
    }
  } else if (isMac) {
    const macPaths = [
      { path: '/tmp', cat: 'System Temp' },
      { path: join(process.env.HOME || '', 'Library/Caches'), cat: 'Application Caches' },
      { path: join(process.env.HOME || '', 'Library/Logs'), cat: 'Application Logs' },
      { path: join(process.env.HOME || '', '.Trash'), cat: 'Trash' },
      { path: join(process.env.HOME || '', 'Library/Application Support/Google/Chrome/Default/Service Worker/CacheStorage'), cat: 'Chrome Cache' },
    ]
    for (const { path: dirPath, cat } of macPaths) {
      const size = getDirSize(dirPath)
      if (size > 0) {
        items.push({ category: cat, path: dirPath, size, description: `${cat} - ${formatBytes(size)}`, safe: true, selected: size > 10 * 1024 * 1024 })
      }
    }
  } else {
    // Linux
    const linuxPaths = [
      { path: '/tmp', cat: 'System Temp' },
      { path: join(process.env.HOME || '', '.cache'), cat: 'User Cache' },
      { path: join(process.env.HOME || '', '.local/share/Trash'), cat: 'Trash' },
      { path: '/var/log', cat: 'System Logs' },
      { path: '/var/tmp', cat: 'Var Temp' },
    ]
    for (const { path: dirPath, cat } of linuxPaths) {
      const size = getDirSize(dirPath)
      if (size > 0) {
        items.push({ category: cat, path: dirPath, size, description: `${cat} - ${formatBytes(size)}`, safe: cat !== 'System Logs', selected: size > 10 * 1024 * 1024 })
      }
    }
  }

  return items
}

export async function runCleanup(items: CleanupItem[]): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []
  let totalCleaned = 0

  for (const item of items) {
    if (!item.selected || !item.safe) continue

    try {
      const beforeSize = getDirSize(item.path)
      cleanDirectory(item.path)
      const afterSize = getDirSize(item.path)
      const cleaned = beforeSize - afterSize
      totalCleaned += cleaned

      if (cleaned > 0) {
        changes.push({
          type: 'file',
          action: 'deleted',
          target: item.path,
          before: formatBytes(beforeSize),
          after: formatBytes(afterSize)
        })
        details.push(`Cleaned ${item.category}: ${formatBytes(cleaned)}`)
      }
    } catch (err) {
      logger.warn(`Failed to clean ${item.path}`, err)
    }
  }

  return {
    success: true,
    module: 'performance',
    action: 'cleanup',
    description: `Cleaned ${formatBytes(totalCleaned)} of temporary files`,
    details,
    changes,
    rollbackAvailable: false
  }
}

// ============================================================
// RAM Optimization
// ============================================================
export async function optimizeRam(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    // Disable resource-hungry services
    const servicesToDisable = [
      { name: 'DiagTrack', desc: 'Connected User Experiences and Telemetry' },
      { name: 'SysMain', desc: 'Superfetch (can cause high disk usage)' },
      { name: 'WSearch', desc: 'Windows Search Indexer' },
      { name: 'XblAuthManager', desc: 'Xbox Live Auth Manager' },
      { name: 'XblGameSave', desc: 'Xbox Live Game Save' },
      { name: 'XboxNetApiSvc', desc: 'Xbox Live Networking Service' },
      { name: 'MapsBroker', desc: 'Downloaded Maps Manager' },
    ]

    for (const svc of servicesToDisable) {
      try {
        await runShellSafe(`sc config "${svc.name}" start= disabled 2>nul`, 5000)
        await runShellSafe(`sc stop "${svc.name}" 2>nul`, 5000)
        changes.push({ type: 'service', action: 'disabled', target: svc.name })
        details.push(`Disabled ${svc.desc} (${svc.name})`)
      } catch {
        // Service might not exist or already disabled
      }
    }

    // Clear standby memory
    try {
      await runShellSafe('powershell -NoProfile -Command "[System.GC]::Collect()"', 5000)
      details.push('Triggered garbage collection')
    } catch {
      // Ignore
    }
  } else if (isMac) {
    try {
      await runShellSafe('purge 2>/dev/null || true', 10000)
      details.push('Purged inactive memory')
    } catch {
      // Ignore
    }
  } else {
    // Linux
    try {
      await runShellSafe('sync && echo 3 | sudo tee /proc/sys/vm/drop_caches 2>/dev/null || true', 5000)
      details.push('Cleared filesystem cache')
    } catch {
      // Ignore
    }
  }

  return {
    success: true,
    module: 'performance',
    action: 'optimize_ram',
    description: 'RAM optimization complete',
    details,
    changes,
    rollbackAvailable: false
  }
}

// ============================================================
// Disk Optimization
// ============================================================
export async function optimizeDisk(drive: string): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  if (isWindows) {
    try {
      // Check if SSD or HDD
      const mediaType = (await runShellSafe(
        'powershell -NoProfile -Command "(Get-PhysicalDisk | Select-Object MediaType).MediaType"',
        10000
      )).trim()

      if (mediaType.includes('SSD')) {
        // TRIM for SSD
        await runCommandSafe('defrag', [drive, '/L', '/U'], 120000)
        details.push(`TRIM optimization run on ${drive} (SSD)`)
        changes.push({ type: 'system', action: 'modified', target: `${drive} TRIM` })
      } else {
        // Defrag for HDD
        await runCommandSafe('defrag', [drive, '/O', '/U'], 300000)
        details.push(`Defragmentation run on ${drive} (HDD)`)
        changes.push({ type: 'system', action: 'modified', target: `${drive} defrag` })
      }
    } catch (err) {
      logger.warn('Disk optimization failed', err)
      details.push('Disk optimization requires elevated privileges')
    }
  } else if (isMac) {
    details.push('macOS manages disk optimization automatically via APFS')
  } else {
    try {
      await runShellSafe('sudo fstrim -v / 2>/dev/null || true', 30000)
      details.push('TRIM run on root filesystem')
    } catch {
      details.push('fstrim not available or not an SSD')
    }
  }

  return {
    success: true,
    module: 'performance',
    action: 'optimize_disk',
    description: `Disk optimization complete for ${drive}`,
    details,
    changes,
    rollbackAvailable: false
  }
}

// ============================================================
// Performance Diagnostics
// ============================================================
export async function runPerformanceDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const startupItems = await getStartupItems()
  const bloatwareCount = startupItems.filter(i => i.isBloatware).length
  const highImpactCount = startupItems.filter(i => i.impact === 'high' && !i.isSystem).length

  if (bloatwareCount > 0) {
    results.push({
      id: `perf-bloatware-${Date.now()}`,
      module: 'performance',
      category: 'Startup',
      title: `${bloatwareCount} bloatware items found in startup`,
      severity: bloatwareCount > 3 ? 'warning' : 'info',
      description: `Found ${bloatwareCount} known bloatware/unnecessary programs starting with your computer`,
      details: startupItems.filter(i => i.isBloatware).map(i => `${i.name} (${i.path})`),
      fixAvailable: true,
      fixDescription: 'Disable bloatware from startup to improve boot time and free RAM',
      fixRisk: 'low',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  if (highImpactCount > 0) {
    results.push({
      id: `perf-startup-${Date.now()}`,
      module: 'performance',
      category: 'Startup',
      title: `${highImpactCount} high-impact startup items`,
      severity: 'info',
      description: `${highImpactCount} programs with high resource impact are starting automatically`,
      details: startupItems.filter(i => i.impact === 'high' && !i.isSystem).map(i => i.name),
      fixAvailable: true,
      fixDescription: 'Review and disable unnecessary high-impact startup items',
      fixRisk: 'low',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // Check disk space
  const cleanupItems = await getCleanupItems()
  const totalCleanable = cleanupItems.reduce((sum, i) => sum + i.size, 0)
  if (totalCleanable > 500 * 1024 * 1024) { // > 500MB
    results.push({
      id: `perf-diskspace-${Date.now()}`,
      module: 'performance',
      category: 'Disk Space',
      title: `${formatBytes(totalCleanable)} of cleanable temporary files`,
      severity: totalCleanable > 2 * 1024 * 1024 * 1024 ? 'warning' : 'info',
      description: `Found ${formatBytes(totalCleanable)} of temporary files, caches, and logs that can be safely removed`,
      details: cleanupItems.filter(i => i.size > 10 * 1024 * 1024).map(i => i.description),
      fixAvailable: true,
      fixDescription: 'Clean temporary files to free disk space and potentially improve performance',
      fixRisk: 'none',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  return results
}

// ============================================================
// Helpers
// ============================================================
function isSystemStartup(name: string): boolean {
  const systemNames = ['securityhealth', 'windows defender', 'realtek', 'intel', 'nvidia', 'amd']
  return systemNames.some(s => name.toLowerCase().includes(s))
}

function getDirSize(dirPath: string): number {
  try {
    if (!existsSync(dirPath)) return 0
    const stat = statSync(dirPath)
    if (stat.isFile()) return stat.size

    let total = 0
    try {
      const entries = readdirSync(dirPath)
      for (const entry of entries.slice(0, 1000)) { // Limit to avoid hanging on huge dirs
        try {
          const entryPath = join(dirPath, entry)
          const entryStat = lstatSync(entryPath)
          if (entryStat.isSymbolicLink()) continue
          if (entryStat.isFile()) {
            total += entryStat.size
          } else if (entryStat.isDirectory()) {
            total += getDirSize(entryPath)
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }
    return total
  } catch {
    return 0
  }
}

function cleanDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) return
  try {
    const entries = readdirSync(dirPath)
    for (const entry of entries) {
      const entryPath = join(dirPath, entry)
      try {
        const stat = lstatSync(entryPath)
        // Skip symlinks to prevent traversal outside directory
        if (stat.isSymbolicLink()) continue
        // Only delete files older than 24 hours
        const ageMs = Date.now() - stat.mtimeMs
        if (ageMs < 86400000) continue

        if (stat.isFile()) {
          unlinkSync(entryPath)
        } else if (stat.isDirectory()) {
          cleanDirectory(entryPath)
          try { rmdirSync(entryPath) } catch { /* non-empty */ }
        }
      } catch {
        // Skip locked/system files
      }
    }
  } catch {
    // Skip inaccessible
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
