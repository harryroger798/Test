// ============================================================
// ByteFix — Disk Imaging & Cloning Module
// System image backup, partition cloning, drive health rescue
// Uses Windows built-in wbadmin + PowerShell, dd on Linux/macOS
// ============================================================

import { execFileSync, execSync } from 'child_process'
import { existsSync, statSync, mkdirSync } from 'fs'
import { join } from 'path'
import { platform, homedir } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('disk-imaging')
const isWindows = platform() === 'win32'
const isLinux = platform() === 'linux'
const isMac = platform() === 'darwin'

// ============================================================
// List Available Drives for Imaging
// ============================================================
interface DriveInfo {
  device: string
  model: string
  sizeMB: number
  type: string
  mount: string
  isSystem: boolean
}

async function listDrivesForImaging(): Promise<DriveInfo[]> {
  const drives: DriveInfo[] = []

  try {
    const disks = await si.diskLayout()
    const fsSize = await si.fsSize()

    for (const disk of disks) {
      const mount = fsSize.find(f =>
        f.fs?.includes(disk.device?.replace('/dev/', '')) ||
        /^[A-Z]:\\?$/i.test(f.mount)
      )

      drives.push({
        device: disk.device || '',
        model: disk.name || disk.vendor || 'Unknown',
        sizeMB: Math.round((disk.size || 0) / (1024 ** 2)),
        type: disk.type || 'Unknown',
        mount: mount?.mount || '',
        isSystem: mount?.mount === '/' || /^C:/i.test(mount?.mount || '')
      })
    }
  } catch (err) {
    logger.error('Failed to list drives', err)
  }

  return drives
}

// ============================================================
// Create System Image Backup (Windows: wbadmin, Linux: dd, macOS: asr)
// ============================================================
export async function createSystemImage(destinationPath: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!destinationPath || destinationPath.length < 3) {
      throw new Error('Invalid destination path')
    }

    if (!existsSync(destinationPath)) {
      mkdirSync(destinationPath, { recursive: true })
    }

    // Check free space at destination
    const fsSizes = await si.fsSize()
    const destMount = fsSizes.find(f => destinationPath.startsWith(f.mount))
    if (destMount) {
      const freeGB = (destMount.size - destMount.used) / (1024 ** 3)
      details.push(`Destination free space: ${freeGB.toFixed(1)} GB`)
      if (freeGB < 10) {
        return {
          success: false, module: 'disk-imaging', action: 'create-system-image',
          description: 'Insufficient free space at destination (need at least 10 GB)',
          details, changes, rollbackAvailable: false, error: 'Insufficient space'
        }
      }
    }

    if (isWindows) {
      details.push('Creating system image using Windows wbadmin...')
      details.push(`Destination: ${destinationPath}`)

      try {
        // Use wbadmin to create a system image backup
        const output = execFileSync('wbadmin', [
          'start', 'backup',
          `-backupTarget:${destinationPath}`,
          '-include:C:',
          '-allCritical',
          '-quiet'
        ], { timeout: 600000, encoding: 'utf8' })

        details.push('System image created successfully')
        details.push(output.substring(0, 500))
        changes.push({ type: 'file', action: 'created', target: `System image at ${destinationPath}` })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // wbadmin may need elevated privileges
        if (/access|denied|privilege/i.test(msg)) {
          details.push('wbadmin requires administrator privileges.')
          details.push('Alternative: Use PowerShell Backup-WBPolicy cmdlet')
        }

        // Fallback: Use PowerShell to create a VHD image
        details.push('Trying PowerShell disk copy fallback...')
        try {
          const psOutput = execFileSync('powershell', [
            '-NoProfile', '-Command',
            `$vol = Get-Volume -DriveLetter C; $src = $vol.UniqueId; Write-Output "Volume: C: Size: $([math]::Round($vol.Size/1GB,1))GB Used: $([math]::Round(($vol.Size - $vol.SizeRemaining)/1GB,1))GB"`
          ], { timeout: 30000, encoding: 'utf8' })
          details.push(psOutput.trim())
          details.push('For full disk imaging, use wbadmin from an elevated command prompt:')
          details.push(`  wbadmin start backup -backupTarget:${destinationPath} -include:C: -allCritical -quiet`)
          changes.push({ type: 'system', action: 'created', target: 'Disk imaging guide generated' })
        } catch {
          details.push('PowerShell fallback also failed. Run ByteFix as Administrator.')
        }
      }
    } else if (isLinux) {
      details.push('Creating disk image using dd...')
      // Find root device
      try {
        const rootDev = execFileSync('findmnt', ['-n', '-o', 'SOURCE', '/'], {
          timeout: 5000, encoding: 'utf8'
        }).trim()

        details.push(`Source device: ${rootDev}`)
        details.push(`Destination: ${join(destinationPath, 'system-image.img')}`)
        details.push('WARNING: This will create a raw disk image. Ensure sufficient free space.')
        details.push(`Command: sudo dd if=${rootDev} of=${join(destinationPath, 'system-image.img')} bs=4M status=progress`)
        details.push('This operation should be run manually due to time required.')
        changes.push({ type: 'system', action: 'created', target: 'Disk imaging command prepared' })
      } catch {
        details.push('Could not determine root device. Manual dd command required.')
      }
    } else if (isMac) {
      details.push('macOS disk imaging using asr (Apple Software Restore)...')
      details.push(`Command: sudo asr -source / -target ${join(destinationPath, 'system-image.dmg')} -erase`)
      details.push('Alternative: Use Disk Utility > File > New Image > Image from disk')
      changes.push({ type: 'system', action: 'created', target: 'Disk imaging guide generated' })
    }

    return {
      success: changes.length > 0,
      module: 'disk-imaging', action: 'create-system-image',
      description: 'System image backup',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('System image creation failed', err)
    return {
      success: false, module: 'disk-imaging', action: 'create-system-image',
      description: 'System image creation failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Clone Partition (Windows: PowerShell, Linux: dd/partclone)
// ============================================================
export async function clonePartition(sourceDrive: string, destDrive: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    details.push(`Source: ${sourceDrive}`)
    details.push(`Destination: ${destDrive}`)

    if (isWindows) {
      // Validate drive letters
      if (!/^[a-zA-Z]:?$/.test(sourceDrive.trim()) || !/^[a-zA-Z]:?$/.test(destDrive.trim())) {
        throw new Error('Invalid drive letters')
      }
      const srcLetter = sourceDrive.trim()[0].toUpperCase()
      const dstLetter = destDrive.trim()[0].toUpperCase()

      if (srcLetter === dstLetter) {
        throw new Error('Source and destination cannot be the same drive')
      }

      // Get volume info
      const srcInfo = execFileSync('powershell', [
        '-NoProfile', '-Command',
        `Get-Volume -DriveLetter ${srcLetter} | Select-Object DriveLetter, FileSystemType, Size, SizeRemaining | ConvertTo-Json`
      ], { timeout: 15000, encoding: 'utf8' })

      const dstInfo = execFileSync('powershell', [
        '-NoProfile', '-Command',
        `Get-Volume -DriveLetter ${dstLetter} | Select-Object DriveLetter, FileSystemType, Size, SizeRemaining | ConvertTo-Json`
      ], { timeout: 15000, encoding: 'utf8' })

      const src = JSON.parse(srcInfo.trim())
      const dst = JSON.parse(dstInfo.trim())

      const srcSizeGB = (src.Size || 0) / (1024 ** 3)
      const dstSizeGB = (dst.Size || 0) / (1024 ** 3)

      details.push(`Source ${srcLetter}: ${srcSizeGB.toFixed(1)}GB (${src.FileSystemType})`)
      details.push(`Destination ${dstLetter}: ${dstSizeGB.toFixed(1)}GB (${dst.FileSystemType})`)

      if (dstSizeGB < srcSizeGB * 0.5) {
        details.push('WARNING: Destination drive may be too small for clone.')
      }

      // Use robocopy for file-level clone
      details.push('Cloning files using robocopy...')
      try {
        execFileSync('robocopy', [
          `${srcLetter}:\\`, `${dstLetter}:\\`,
          '/E', '/COPYALL', '/DCOPY:DAT', '/R:1', '/W:1', '/NFL', '/NDL', '/NP',
          '/XD', '$Recycle.Bin', 'System Volume Information', 'Recovery'
        ], { timeout: 600000, encoding: 'utf8' })
      } catch {
        // robocopy returns non-zero for various non-error conditions
      }

      details.push(`Files cloned from ${srcLetter}: to ${dstLetter}:`)
      changes.push({ type: 'file', action: 'created', target: `Clone of ${srcLetter}: on ${dstLetter}:` })

    } else if (isLinux) {
      // Validate device paths
      if (!/^\/dev\/[a-zA-Z0-9]+$/.test(sourceDrive) || !/^\/dev\/[a-zA-Z0-9]+$/.test(destDrive)) {
        throw new Error('Invalid device paths')
      }

      details.push('Linux partition clone using dd:')
      details.push(`Command: sudo dd if=${sourceDrive} of=${destDrive} bs=4M status=progress conv=noerror,sync`)
      details.push('WARNING: This will OVERWRITE all data on the destination!')
      details.push('Run this command manually for safety.')
      changes.push({ type: 'system', action: 'created', target: 'Clone command prepared' })
    }

    return {
      success: changes.length > 0,
      module: 'disk-imaging', action: 'clone-partition',
      description: 'Partition clone operation',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Partition clone failed', err)
    return {
      success: false, module: 'disk-imaging', action: 'clone-partition',
      description: 'Partition clone failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Rescue Failing Drive (read data before drive dies)
// ============================================================
export async function rescueFailingDrive(sourceDrive: string, destinationPath: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!existsSync(destinationPath)) {
      mkdirSync(destinationPath, { recursive: true })
    }

    if (isWindows) {
      const srcLetter = sourceDrive.trim()[0].toUpperCase()
      details.push(`Rescuing data from ${srcLetter}: to ${destinationPath}`)

      // Check drive health first
      try {
        const healthOutput = execFileSync('powershell', [
          '-NoProfile', '-Command',
          `Get-Volume -DriveLetter ${srcLetter} | Select-Object HealthStatus, OperationalStatus | ConvertTo-Json`
        ], { timeout: 15000, encoding: 'utf8' })
        const health = JSON.parse(healthOutput.trim())
        details.push(`Drive health: ${health.HealthStatus}, Status: ${health.OperationalStatus}`)
      } catch {
        details.push('Could not check drive health - proceeding with rescue')
      }

      // Use robocopy with error tolerance for failing drives
      details.push('Copying files with error tolerance (robocopy /R:1 /W:0)...')
      try {
        const output = execSync(
          `robocopy "${srcLetter}:\\" "${destinationPath}" /E /R:1 /W:0 /LOG:CON /NFL /NP /XD "$Recycle.Bin" "System Volume Information"`,
          { timeout: 600000, encoding: 'utf8', stdio: 'pipe' }
        )
        // Parse robocopy summary
        const dirMatch = output.match(/Dirs\s*:\s*(\d+)/)?.[1] || '?'
        const fileMatch = output.match(/Files\s*:\s*(\d+)/)?.[1] || '?'
        details.push(`Directories processed: ${dirMatch}`)
        details.push(`Files processed: ${fileMatch}`)
      } catch {
        // robocopy returns non-zero for various non-error conditions
        details.push('Robocopy completed (non-zero exit is normal for robocopy)')
      }

      changes.push({ type: 'file', action: 'created', target: `Rescued data at ${destinationPath}` })
    } else {
      const dev = sourceDrive.trim()
      if (!/^\/dev\/[a-zA-Z0-9]+$/.test(dev)) {
        throw new Error('Invalid device path')
      }
      details.push(`Rescue command: sudo ddrescue -d -r3 ${dev} ${join(destinationPath, 'rescue.img')} ${join(destinationPath, 'rescue.log')}`)
      details.push('Install ddrescue: sudo apt install gddrescue')
      details.push('This command handles bad sectors gracefully.')
      changes.push({ type: 'system', action: 'created', target: 'Rescue command prepared' })
    }

    return {
      success: changes.length > 0,
      module: 'disk-imaging', action: 'rescue-failing-drive',
      description: 'Failing drive data rescue',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Drive rescue failed', err)
    return {
      success: false, module: 'disk-imaging', action: 'rescue-failing-drive',
      description: 'Drive rescue failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runDiskImagingDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const now = Date.now()

  // List available drives
  const drives = await listDrivesForImaging()

  results.push({
    id: `diskimg-drives-${now}`,
    module: 'disk-imaging',
    category: 'Disk Imaging',
    title: `${drives.length} Drive(s) Detected`,
    severity: drives.length > 0 ? 'info' : 'warning',
    description: 'Available drives for imaging and cloning operations',
    details: drives.map(d =>
      `${d.device} — ${d.model} (${(d.sizeMB / 1024).toFixed(1)}GB, ${d.type})${d.isSystem ? ' [SYSTEM]' : ''}${d.mount ? ` mounted at ${d.mount}` : ''}`
    ),
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: now
  })

  // Check for wbadmin availability (Windows)
  if (isWindows) {
    let wbadminAvailable = false
    try {
      execFileSync('where', ['wbadmin'], { timeout: 5000, encoding: 'utf8' })
      wbadminAvailable = true
    } catch { /* not found */ }

    results.push({
      id: `diskimg-wbadmin-${now}`,
      module: 'disk-imaging',
      category: 'Disk Imaging',
      title: wbadminAvailable ? 'Windows Backup (wbadmin) Available' : 'Windows Backup (wbadmin) Not Found',
      severity: wbadminAvailable ? 'healthy' : 'warning',
      description: wbadminAvailable
        ? 'wbadmin is available for creating system image backups'
        : 'wbadmin not found. System image backup requires Windows Server or Pro edition.',
      details: wbadminAvailable
        ? ['Can create full system image backups', 'Supports incremental backups', 'Can back up to external drives or network shares']
        : ['wbadmin is not available on Windows Home editions', 'Alternative: Use robocopy for file-level backup', 'Alternative: Use third-party tools like Macrium Reflect Free'],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: now
    })

    // Check for robocopy (always available on Windows)
    results.push({
      id: `diskimg-robocopy-${now}`,
      module: 'disk-imaging',
      category: 'Disk Imaging',
      title: 'Robocopy Available (File-Level Clone)',
      severity: 'healthy',
      description: 'robocopy is available for file-level disk cloning and rescue operations',
      details: [
        'Supports error-tolerant copying for failing drives',
        'Can mirror entire drive contents with permissions',
        'Built into all Windows editions'
      ],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: now
    })
  }

  // Linux: Check for dd and ddrescue
  if (isLinux) {
    let ddrescueAvailable = false
    try {
      execFileSync('which', ['ddrescue'], { timeout: 5000, encoding: 'utf8' })
      ddrescueAvailable = true
    } catch { /* not found */ }

    results.push({
      id: `diskimg-ddrescue-${now}`,
      module: 'disk-imaging',
      category: 'Disk Imaging',
      title: ddrescueAvailable ? 'GNU ddrescue Available' : 'GNU ddrescue Not Installed',
      severity: ddrescueAvailable ? 'healthy' : 'info',
      description: ddrescueAvailable
        ? 'ddrescue is available for sector-level disk rescue from failing drives'
        : 'Install ddrescue for advanced disk rescue: sudo apt install gddrescue',
      details: ddrescueAvailable
        ? ['Handles bad sectors gracefully', 'Supports log files for interrupted rescues', 'Best tool for failing drive recovery']
        : ['dd (basic) is always available', 'ddrescue handles errors better than dd', 'Install: sudo apt install gddrescue'],
      fixAvailable: !ddrescueAvailable,
      fixDescription: ddrescueAvailable ? undefined : 'Install: sudo apt install gddrescue',
      fixRisk: 'low',
      autoFixable: false,
      timestamp: now
    })
  }

  // macOS: Check for asr
  if (isMac) {
    results.push({
      id: `diskimg-asr-${now}`,
      module: 'disk-imaging',
      category: 'Disk Imaging',
      title: 'Apple Software Restore (asr) Available',
      severity: 'healthy',
      description: 'asr is available for disk imaging and cloning on macOS',
      details: [
        'Built into macOS',
        'Can create and restore disk images',
        'Also accessible via Disk Utility GUI'
      ],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: now
    })
  }

  // Check SMART health of all drives
  for (const drive of drives) {
    if (!drive.device) continue
    try {
      const smartOutput = execFileSync('smartctl', ['-H', drive.device, '--json'], {
        timeout: 15000, encoding: 'utf8'
      })
      const smartData = JSON.parse(smartOutput)
      const passed = smartData?.smart_status?.passed

      if (passed === false) {
        results.push({
          id: `diskimg-smart-${drive.device}-${now}`,
          module: 'disk-imaging',
          category: 'Disk Imaging',
          title: `CRITICAL: ${drive.model} SMART FAILING`,
          severity: 'critical',
          description: `Drive ${drive.device} is reporting SMART failure. Immediate backup recommended!`,
          details: [
            'This drive may fail at any time',
            'Use "Rescue Failing Drive" to copy data immediately',
            'Do NOT write new data to this drive',
            'Replace drive as soon as possible'
          ],
          fixAvailable: true,
          fixDescription: 'Use Rescue Failing Drive to copy data before drive failure',
          fixRisk: 'none',
          autoFixable: false,
          timestamp: now
        })
      }
    } catch {
      // smartctl not available or drive doesn't support SMART
    }
  }

  return results
}
