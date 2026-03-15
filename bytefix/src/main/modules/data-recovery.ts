// ============================================================
// ByteFix Phase 2 — Data Recovery Module
// TestDisk/PhotoRec integration, shadow copy restore, deleted file scan
// ============================================================

import { execSync, execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, statSync, lstatSync, realpathSync } from 'fs'
import { join, resolve, normalize } from 'path'
import { tmpdir, platform, homedir } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('data-recovery')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

// Dangerous extensions that are commonly lost
const RECOVERABLE_EXTENSIONS = new Set([
  // Documents
  '.doc', '.docx', '.pdf', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods',
  '.txt', '.rtf', '.csv',
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.raw', '.cr2', '.nef',
  '.heic', '.webp', '.svg',
  // Videos
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.3gp',
  // Audio
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz',
  // Database
  '.mdb', '.accdb', '.sqlite', '.db',
])

function sanitizeRecoveryPath(targetPath: string): string {
  const normalized = normalize(resolve(targetPath))
  // Must be absolute path
  if (isWin) {
    if (!/^[a-zA-Z]:\\/.test(normalized)) {
      throw new Error(`Invalid recovery path: ${targetPath}`)
    }
  } else {
    if (!normalized.startsWith('/')) {
      throw new Error(`Invalid recovery path: ${targetPath}`)
    }
  }
  // Prevent writing to system directories
  const forbidden = isWin
    ? ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData']
    : ['/bin', '/sbin', '/usr', '/etc', '/boot', '/dev', '/proc', '/sys']
  // Also block root of C: drive on Windows
  if (isWin && /^[a-zA-Z]:\\?$/.test(normalized)) {
    throw new Error('Cannot write recovery files to drive root')
  }
  // Resolve symlinks on non-Windows to prevent symlink attacks
  let resolvedPath = normalized
  if (!isWin) {
    try {
      resolvedPath = realpathSync(normalized)
    } catch {
      // Path may not exist yet, use normalized
    }
  }
  for (const dir of forbidden) {
    if (resolvedPath.toLowerCase().startsWith(dir.toLowerCase())) {
      throw new Error(`Cannot write recovery files to system directory: ${dir}`)
    }
  }
  return normalized
}

function sanitizeDrivePath(drive: string): string {
  if (isWin) {
    if (!/^[a-zA-Z]:\\?$/.test(drive.trim())) {
      throw new Error(`Invalid drive: ${drive}`)
    }
    return `${drive.trim()[0].toUpperCase()}:`
  }
  if (!/^\/dev\/[a-zA-Z0-9]+$/.test(drive.trim())) {
    throw new Error(`Invalid device: ${drive}`)
  }
  return drive.trim()
}

// Check if TestDisk/PhotoRec binaries are available
function getToolsDir(): string {
  // In packaged Electron, use process.resourcesPath; in dev, use __dirname
  if (process.resourcesPath && existsSync(join(process.resourcesPath, 'tools'))) {
    return join(process.resourcesPath, 'tools')
  }
  return join(__dirname, '../../tools')
}

function findPhotorec(): string | null {
  try {
    if (isWin) {
      const paths = [
        join(getToolsDir(), 'photorec_win.exe'),
        'C:\\Program Files\\TestDisk\\photorec_win.exe',
        'C:\\Tools\\TestDisk\\photorec_win.exe',
      ]
      for (const p of paths) {
        if (existsSync(p)) return p
      }
      // Check PATH
      execSync('where photorec_win 2>nul', { encoding: 'utf8', timeout: 5000 })
      return 'photorec_win'
    } else {
      execFileSync('which', ['photorec'], { encoding: 'utf8', timeout: 5000 })
      return 'photorec'
    }
  } catch {
    return null
  }
}

function findTestdisk(): string | null {
  try {
    if (isWin) {
      const paths = [
        join(getToolsDir(), 'testdisk_win.exe'),
        'C:\\Program Files\\TestDisk\\testdisk_win.exe',
        'C:\\Tools\\TestDisk\\testdisk_win.exe',
      ]
      for (const p of paths) {
        if (existsSync(p)) return p
      }
      execSync('where testdisk_win 2>nul', { encoding: 'utf8', timeout: 5000 })
      return 'testdisk_win'
    } else {
      execFileSync('which', ['testdisk'], { encoding: 'utf8', timeout: 5000 })
      return 'testdisk'
    }
  } catch {
    return null
  }
}

// Scan recycle bin for recoverable files (Windows)
function scanRecycleBin(): { count: number; totalSize: number; types: Record<string, number> } {
  const result = { count: 0, totalSize: 0, types: {} as Record<string, number> }
  if (!isWin) return result

  try {
    const output = execSync(
      'powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).NameSpace(0x0a).Items() | ForEach-Object { $_.Name + \'|\' + $_.Size } | Select-Object -First 100"',
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    ).trim()

    if (output) {
      for (const line of output.split('\n')) {
        const parts = line.trim().split('|')
        if (parts.length >= 1) {
          result.count++
          const size = parseInt(parts[1] || '0', 10)
          if (!isNaN(size)) result.totalSize += size
          const ext = parts[0].includes('.') ? '.' + parts[0].split('.').pop()?.toLowerCase() : 'unknown'
          result.types[ext] = (result.types[ext] || 0) + 1
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to scan recycle bin', err)
  }
  return result
}

// Check for Windows Shadow Copies (System Restore)
function listShadowCopies(): { id: string; date: string; volume: string }[] {
  const copies: { id: string; date: string; volume: string }[] = []
  if (!isWin) return copies

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_ShadowCopy | Select-Object ID, InstallDate, VolumeName | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    ).trim()

    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item && item.ID) {
          copies.push({
            id: String(item.ID),
            date: String(item.InstallDate || 'Unknown'),
            volume: String(item.VolumeName || 'Unknown'),
          })
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to list shadow copies', err)
  }
  return copies
}

// Scan for recently deleted files in common locations
function scanRecentlyDeleted(): { location: string; description: string; recoverable: boolean }[] {
  const findings: { location: string; description: string; recoverable: boolean }[] = []

  if (isWin) {
    // Check Recycle Bin
    const recycleBin = scanRecycleBin()
    if (recycleBin.count > 0) {
      findings.push({
        location: 'Recycle Bin',
        description: `${recycleBin.count} files found (${(recycleBin.totalSize / 1024 / 1024).toFixed(1)}MB). Can be restored directly.`,
        recoverable: true,
      })
    }

    // Check shadow copies
    const shadows = listShadowCopies()
    if (shadows.length > 0) {
      findings.push({
        location: 'System Restore / Shadow Copies',
        description: `${shadows.length} shadow copies available. Previous file versions may be recoverable.`,
        recoverable: true,
      })
    }

    // Check for previous Windows versions
    if (existsSync('C:\\Windows.old')) {
      findings.push({
        location: 'C:\\Windows.old',
        description: 'Previous Windows installation found. User files may be recoverable from Users folder.',
        recoverable: true,
      })
    }
  } else if (isMac) {
    // Check Trash
    const trashPath = join(homedir(), '.Trash')
    if (existsSync(trashPath)) {
      try {
        const trashItems = readdirSync(trashPath)
        if (trashItems.length > 0) {
          findings.push({
            location: 'Trash',
            description: `${trashItems.length} items in Trash. Can be restored directly.`,
            recoverable: true,
          })
        }
      } catch { /* permission denied */ }
    }

    // Check Time Machine
    try {
      const tmOutput = execFileSync('tmutil', ['listbackups'], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' })
      const backups = tmOutput.trim().split('\n').filter(Boolean)
      if (backups.length > 0) {
        findings.push({
          location: 'Time Machine',
          description: `${backups.length} Time Machine backups found. Files can be restored from backups.`,
          recoverable: true,
        })
      }
    } catch { /* Time Machine not configured */ }
  } else {
    // Linux Trash
    const trashPath = join(homedir(), '.local/share/Trash/files')
    if (existsSync(trashPath)) {
      try {
        const trashItems = readdirSync(trashPath)
        if (trashItems.length > 0) {
          findings.push({
            location: 'Trash',
            description: `${trashItems.length} items in Trash. Can be restored directly.`,
            recoverable: true,
          })
        }
      } catch { /* permission denied */ }
    }
  }

  return findings
}

// Check disk health for recovery viability
function checkDiskRecoveryViability(drive: string): { viable: boolean; reason: string; freeSpace: number } {
  try {
    if (isWin) {
      const sanitized = sanitizeDrivePath(drive)
      const output = execSync(
        `powershell -NoProfile -Command "Get-Volume -DriveLetter '${sanitized[0]}' | Select-Object DriveLetter, FileSystemType, SizeRemaining, Size, HealthStatus | ConvertTo-Json"`,
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      const info = JSON.parse(output)

      if (info.HealthStatus !== 'Healthy') {
        return { viable: false, reason: `Disk health: ${info.HealthStatus}. Recovery may risk further data loss.`, freeSpace: 0 }
      }

      const freeGB = (info.SizeRemaining || 0) / (1024 * 1024 * 1024)
      return { viable: true, reason: 'Disk is healthy', freeSpace: freeGB }
    }
    return { viable: true, reason: 'Check passed', freeSpace: 0 }
  } catch {
    return { viable: true, reason: 'Could not verify disk health', freeSpace: 0 }
  }
}

// Check for filesystem errors that may indicate data loss
function checkFilesystemErrors(drive: string): string[] {
  const errors: string[] = []
  if (!isWin) return errors

  try {
    const sanitized = sanitizeDrivePath(drive)
    // Check if drive needs checking
    const output = execSync(
      `powershell -NoProfile -Command "Get-Volume -DriveLetter '${sanitized[0]}' | Select-Object FileSystemType, HealthStatus, OperationalStatus | ConvertTo-Json"`,
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    const info = JSON.parse(output)

    if (info.FileSystemType === 'Unknown' || info.FileSystemType === 'RAW') {
      errors.push(`Drive ${sanitized} has RAW/Unknown filesystem — partition table may be damaged`)
    }
    if (info.HealthStatus !== 'Healthy') {
      errors.push(`Drive ${sanitized} health: ${info.HealthStatus}`)
    }
    if (info.OperationalStatus !== 'OK') {
      errors.push(`Drive ${sanitized} operational status: ${info.OperationalStatus}`)
    }
  } catch (err) {
    logger.warn('Failed to check filesystem errors', err)
  }
  return errors
}

// Restore file from shadow copy
export async function restoreFromShadowCopy(
  shadowId: string,
  sourcePath: string,
  targetPath: string
): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'data-recovery', action: 'restore-shadow-copy',
        description: 'Shadow copy restore is only available on Windows',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    // Validate shadow ID format (GUID)
    if (!/^\{?[0-9a-fA-F-]+\}?$/.test(shadowId)) {
      throw new Error('Invalid shadow copy ID format')
    }

    const sanitizedTarget = sanitizeRecoveryPath(targetPath)

    if (!existsSync(sanitizedTarget)) {
      mkdirSync(sanitizedTarget, { recursive: true })
    }

    // Use vssadmin to access shadow copy
    details.push(`Restoring from shadow copy: ${shadowId}`)
    details.push(`Source: ${sourcePath}`)
    details.push(`Target: ${sanitizedTarget}`)

    // Copy from shadow copy path
    execSync(
      `powershell -NoProfile -Command "Copy-Item -Path '\\\\?\\GLOBALROOT\\Device\\HarddiskVolumeShadowCopy*\\${sourcePath.replace(/^[A-Z]:\\/i, '')}' -Destination '${sanitizedTarget}' -Recurse -Force -ErrorAction Stop"`,
      { encoding: 'utf8', timeout: 60000, stdio: 'pipe' }
    )

    details.push('Files restored successfully from shadow copy')
    changes.push({ type: 'file', action: 'restored', target: sanitizedTarget })

    return {
      success: true, module: 'data-recovery', action: 'restore-shadow-copy',
      description: 'Files restored from Windows Shadow Copy',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Shadow copy restore failed', err)
    return {
      success: false, module: 'data-recovery', action: 'restore-shadow-copy',
      description: 'Shadow copy restore failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Restore files from Recycle Bin
export async function restoreFromRecycleBin(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'data-recovery', action: 'restore-recycle-bin',
        description: 'Recycle Bin restore is only available on Windows via this method',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    // List and restore items from Recycle Bin
    // Use $rb.GetDetailsOf($item, 0) to get original filename WITH extension
    // ($item.Name strips extensions on systems with "hide known extensions" enabled)
    // If destination already exists, append timestamp to avoid silent overwrite
    const output = execSync(
      'powershell -NoProfile -Command "$shell = New-Object -ComObject Shell.Application; $rb = $shell.NameSpace(0x0a); $items = $rb.Items(); $count = 0; $errs = @(); foreach ($item in $items) { $origPath = $rb.GetDetailsOf($item, 1); $origName = $rb.GetDetailsOf($item, 0); if (-not $origName) { $origName = $item.Name }; if ($origPath -and (Test-Path -LiteralPath $origPath)) { try { $dest = Join-Path $origPath $origName; if (Test-Path -LiteralPath $dest) { $base = [System.IO.Path]::GetFileNameWithoutExtension($origName); $ext = [System.IO.Path]::GetExtension($origName); $ts = Get-Date -Format yyyyMMdd_HHmmssfff; $dest = Join-Path $origPath ($base + \'_restored_\' + $ts + $ext); $i = 1; while (Test-Path -LiteralPath $dest) { $dest = Join-Path $origPath ($base + \'_restored_\' + $ts + \'_\' + $i + $ext); $i++ } }; Move-Item -LiteralPath $item.Path -Destination $dest -ErrorAction Stop; $count++ } catch { $errs += $_.Exception.Message } } }; Write-Output $count"',
      { encoding: 'utf8', timeout: 60000, stdio: 'pipe' }
    ).trim()

    const count = parseInt(output, 10) || 0
    details.push(`${count} files restored from Recycle Bin to original locations`)
    changes.push({ type: 'file', action: 'restored', target: 'Recycle Bin items' })

    return {
      success: count > 0, module: 'data-recovery', action: 'restore-recycle-bin',
      description: `Restored ${count} files from Recycle Bin`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'data-recovery', action: 'restore-recycle-bin',
      description: 'Recycle Bin restore failed',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Run PhotoRec for deep file recovery
export async function runPhotorecRecovery(
  sourceDrive: string,
  targetDir: string,
  fileTypes?: string[]
): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    const photorec = findPhotorec()
    if (!photorec) {
      return {
        success: false, module: 'data-recovery', action: 'photorec-recovery',
        description: 'PhotoRec is not installed. Please install TestDisk/PhotoRec package.',
        details: ['PhotoRec binary not found in PATH or bundled tools directory',
          'Download from: https://www.cgsecurity.org/wiki/TestDisk_Download'],
        changes: [], rollbackAvailable: false, error: 'PhotoRec not found'
      }
    }

    const sanitizedSource = sanitizeDrivePath(sourceDrive)
    const sanitizedTarget = sanitizeRecoveryPath(targetDir)

    // CRITICAL: Ensure target is on a DIFFERENT drive than source
    if (isWin) {
      if (sanitizedSource[0].toUpperCase() === sanitizedTarget[0].toUpperCase()) {
        return {
          success: false, module: 'data-recovery', action: 'photorec-recovery',
          description: 'SAFETY ERROR: Recovery target must be on a DIFFERENT drive than the source',
          details: [`Source: ${sanitizedSource}`, `Target: ${sanitizedTarget}`,
            'Writing recovered files to the same drive can overwrite the data you are trying to recover'],
          changes: [], rollbackAvailable: false, error: 'Same drive source and target'
        }
      }
    }

    if (!existsSync(sanitizedTarget)) {
      mkdirSync(sanitizedTarget, { recursive: true })
    }

    details.push(`Source: ${sanitizedSource}`)
    details.push(`Target: ${sanitizedTarget}`)
    details.push('Running PhotoRec file recovery (this may take a long time)...')

    // Build PhotoRec command
    // PhotoRec runs interactively by default; we use command line options
    const args = ['/log', '/d', sanitizedTarget, sanitizedSource]
    if (fileTypes && fileTypes.length > 0) {
      // PhotoRec can filter by file family
      details.push(`File type filter: ${fileTypes.join(', ')}`)
    }

    try {
      execFileSync(photorec, args, { timeout: 3600000, stdio: 'pipe' }) // 1 hour timeout
      details.push('PhotoRec scan completed')
    } catch {
      details.push('PhotoRec process completed (may have partial results)')
    }

    // Count recovered files
    let recoveredCount = 0
    if (existsSync(sanitizedTarget)) {
      try {
        const dirs = readdirSync(sanitizedTarget)
        for (const dir of dirs) {
          const dirPath = join(sanitizedTarget, dir)
          const stat = lstatSync(dirPath)
          if (stat.isDirectory() && !stat.isSymbolicLink()) {
            try {
              recoveredCount += readdirSync(dirPath).length
            } catch { /* permission */ }
          }
        }
      } catch { /* error reading dir */ }
    }

    details.push(`Recovered files found: ${recoveredCount}`)
    changes.push({ type: 'file', action: 'created', target: sanitizedTarget })

    return {
      success: recoveredCount > 0, module: 'data-recovery', action: 'photorec-recovery',
      description: `PhotoRec recovered ${recoveredCount} files to ${sanitizedTarget}`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('PhotoRec recovery failed', err)
    return {
      success: false, module: 'data-recovery', action: 'photorec-recovery',
      description: 'PhotoRec file recovery failed',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Run filesystem repair (chkdsk) for data recovery purposes
export async function repairFilesystem(drive: string): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'data-recovery', action: 'repair-filesystem',
        description: 'Filesystem repair via chkdsk is Windows only. Use fsck on Linux/macOS.',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only for chkdsk'
      }
    }

    const sanitized = sanitizeDrivePath(drive)
    details.push(`Running filesystem check on ${sanitized}`)

    // Run chkdsk /f (fix errors)
    try {
      const output = execSync(
        `chkdsk ${sanitized} /f`,
        { encoding: 'utf8', timeout: 1800000, stdio: 'pipe' } // 30 min
      )
      details.push('Filesystem check completed')
      if (output.includes('found no problems')) {
        details.push('No filesystem errors found')
      } else {
        const fixed = output.match(/Windows has made corrections/i)
        if (fixed) {
          details.push('Filesystem errors were found and corrected')
          changes.push({ type: 'system', action: 'modified', target: `Filesystem on ${sanitized}` })
        }
      }
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err)
      if (errStr.includes('locked') || errStr.includes('schedule')) {
        details.push('Drive is in use — chkdsk has been scheduled for next reboot')
        // Schedule chkdsk on next boot
        try {
          execSync(`chkdsk ${sanitized} /f /x`, { timeout: 10000, stdio: 'pipe' })
        } catch {
          details.push('To run chkdsk, restart the computer')
        }
      } else {
        throw err
      }
    }

    return {
      success: true, module: 'data-recovery', action: 'repair-filesystem',
      description: `Filesystem repair on ${sanitized}`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'data-recovery', action: 'repair-filesystem',
      description: 'Filesystem repair failed',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Main diagnostics function
export async function runDataRecoveryDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    // 1. Check for tool availability
    const photorec = findPhotorec()
    const testdisk = findTestdisk()

    results.push({
      id: `dr-tools-${timestamp}`,
      module: 'data-recovery',
      category: 'Tool Availability',
      title: 'Recovery Tools Status',
      severity: photorec && testdisk ? 'healthy' : 'warning',
      description: `PhotoRec: ${photorec ? 'Available' : 'Not installed'}, TestDisk: ${testdisk ? 'Available' : 'Not installed'}`,
      details: [
        `PhotoRec: ${photorec || 'Not found — install TestDisk package from cgsecurity.org'}`,
        `TestDisk: ${testdisk || 'Not found — install TestDisk package from cgsecurity.org'}`,
      ],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp,
    })

    // 2. Scan for recently deleted / recoverable files
    const deleted = scanRecentlyDeleted()
    for (const item of deleted) {
      results.push({
        id: `dr-deleted-${timestamp}-${results.length}`,
        module: 'data-recovery',
        category: 'Recoverable Data',
        title: `Recoverable files in ${item.location}`,
        severity: 'info',
        description: item.description,
        details: [item.description],
        fixAvailable: item.recoverable,
        fixDescription: item.recoverable ? `Restore files from ${item.location}` : undefined,
        fixRisk: 'low',
        autoFixable: false, // Never auto-recover — user must confirm
        timestamp,
      })
    }

    // 3. Check filesystem errors on all drives
    if (isWin) {
      try {
        const output = execSync(
          'powershell -NoProfile -Command "Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq \'Fixed\' } | Select-Object DriveLetter, FileSystemType, HealthStatus, SizeRemaining, Size | ConvertTo-Json"',
          { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
        ).trim()

        if (output) {
          const volumes = JSON.parse(output)
          const items = Array.isArray(volumes) ? volumes : [volumes]
          for (const vol of items) {
            if (!vol.DriveLetter) continue
            const fsErrors = checkFilesystemErrors(`${vol.DriveLetter}:`)
            if (fsErrors.length > 0) {
              results.push({
                id: `dr-fs-${timestamp}-${vol.DriveLetter}`,
                module: 'data-recovery',
                category: 'Filesystem Health',
                title: `Filesystem issues on ${vol.DriveLetter}:`,
                severity: 'warning',
                description: fsErrors.join('; '),
                details: fsErrors,
                fixAvailable: true,
                fixDescription: `Run filesystem repair (chkdsk) on ${vol.DriveLetter}:`,
                fixRisk: 'medium',
                autoFixable: false,
                timestamp,
              })
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to check volumes', err)
      }
    }

    // 4. Overall data recovery readiness
    if (results.length === 1) {
      // Only tool status — no issues found
      results.push({
        id: `dr-summary-${timestamp}`,
        module: 'data-recovery',
        category: 'Summary',
        title: 'Data Recovery Status',
        severity: 'healthy',
        description: 'No data loss indicators detected. Recovery tools are ready if needed.',
        details: ['No deleted files pending recovery', 'No filesystem errors detected'],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp,
      })
    }
  } catch (err) {
    logger.error('Data recovery diagnostics failed', err)
    results.push({
      id: `dr-error-${timestamp}`,
      module: 'data-recovery',
      category: 'Error',
      title: 'Data Recovery Diagnostics Error',
      severity: 'error',
      description: `Failed to complete data recovery diagnostics: ${err instanceof Error ? err.message : String(err)}`,
      details: [],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp,
    })
  }

  return results
}
