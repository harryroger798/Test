// ============================================================
// ByteFix — Partition Management Module
// Create, resize, delete, format partitions
// Uses diskpart/PowerShell on Windows, parted/fdisk on Linux, diskutil on macOS
// ============================================================

import { execFileSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir, platform } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('partition-manager')
const isWindows = platform() === 'win32'
const isLinux = platform() === 'linux'
const isMac = platform() === 'darwin'

// ============================================================
// Detailed Partition Listing
// ============================================================
interface PartitionInfo {
  number: number
  label: string
  letter: string
  fileSystem: string
  sizeMB: number
  usedMB: number
  freeMB: number
  type: string
  isSystem: boolean
  isBoot: boolean
  isActive: boolean
  diskNumber: number
  diskModel: string
}

async function getDetailedPartitions(): Promise<PartitionInfo[]> {
  const partitions: PartitionInfo[] = []

  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        `Get-Partition | ForEach-Object {
          $vol = Get-Volume -Partition $_ -ErrorAction SilentlyContinue
          $disk = Get-Disk -Number $_.DiskNumber -ErrorAction SilentlyContinue
          [PSCustomObject]@{
            Number = $_.PartitionNumber
            DriveLetter = if($_.DriveLetter){$_.DriveLetter}else{''}
            Size = $_.Size
            Type = $_.Type
            IsSystem = $_.IsSystem
            IsBoot = $_.IsBoot
            IsActive = $_.IsActive
            DiskNumber = $_.DiskNumber
            DiskModel = if($disk){$disk.FriendlyName}else{'Unknown'}
            FileSystem = if($vol){$vol.FileSystemType}else{''}
            Label = if($vol){$vol.FileSystemLabel}else{''}
            SizeRemaining = if($vol){$vol.SizeRemaining}else{0}
          }
        } | ConvertTo-Json`
      ], { timeout: 30000, encoding: 'utf8' })

      if (output.trim()) {
        const parsed = JSON.parse(output.trim())
        const arr = Array.isArray(parsed) ? parsed : [parsed]

        for (const p of arr) {
          const sizeMB = Math.round((p.Size || 0) / (1024 ** 2))
          const freeMB = Math.round((p.SizeRemaining || 0) / (1024 ** 2))
          partitions.push({
            number: p.Number || 0,
            label: p.Label || '',
            letter: p.DriveLetter || '',
            fileSystem: p.FileSystem || '',
            sizeMB,
            usedMB: sizeMB - freeMB,
            freeMB,
            type: p.Type || '',
            isSystem: p.IsSystem || false,
            isBoot: p.IsBoot || false,
            isActive: p.IsActive || false,
            diskNumber: p.DiskNumber || 0,
            diskModel: p.DiskModel || 'Unknown'
          })
        }
      }
    } catch (err) {
      logger.warn('Failed to get detailed partitions', err)
    }
  }

  if (isLinux) {
    try {
      const output = execFileSync('lsblk', ['-J', '-b', '-o', 'NAME,SIZE,FSTYPE,MOUNTPOINT,LABEL,TYPE,PKNAME'], {
        timeout: 10000, encoding: 'utf8'
      })
      const data = JSON.parse(output)
      const devices = data.blockdevices || []
      let diskIdx = 0

      for (const dev of devices) {
        if (dev.type === 'disk') {
          const children = dev.children || []
          for (const child of children) {
            if (child.type === 'part') {
              const sizeMB = Math.round((child.size || 0) / (1024 ** 2))
              partitions.push({
                number: parseInt(child.name.replace(/\D/g, '')) || 0,
                label: child.label || '',
                letter: child.mountpoint || '',
                fileSystem: child.fstype || '',
                sizeMB,
                usedMB: 0,
                freeMB: 0,
                type: child.fstype || 'Unknown',
                isSystem: child.mountpoint === '/',
                isBoot: child.mountpoint === '/boot' || child.mountpoint === '/boot/efi',
                isActive: !!child.mountpoint,
                diskNumber: diskIdx,
                diskModel: dev.name || 'Unknown'
              })
            }
          }
          diskIdx++
        }
      }
    } catch (err) {
      logger.warn('Failed to get Linux partitions', err)
    }
  }

  if (isMac) {
    try {
      const output = execFileSync('diskutil', ['list', '-plist'], {
        timeout: 10000, encoding: 'utf8'
      })
      // Basic parsing - diskutil plist output
      const disks = await si.fsSize()
      for (const [i, d] of disks.entries()) {
        partitions.push({
          number: i + 1,
          label: d.fs || '',
          letter: d.mount || '',
          fileSystem: d.type || '',
          sizeMB: Math.round(d.size / (1024 ** 2)),
          usedMB: Math.round(d.used / (1024 ** 2)),
          freeMB: Math.round((d.size - d.used) / (1024 ** 2)),
          type: d.type || '',
          isSystem: d.mount === '/',
          isBoot: d.mount === '/',
          isActive: true,
          diskNumber: 0,
          diskModel: 'Disk'
        })
      }
    } catch (err) {
      logger.warn('Failed to get macOS partitions', err)
    }
  }

  return partitions
}

// ============================================================
// Resize Partition (Windows only via PowerShell)
// ============================================================
export async function resizePartition(driveLetter: string, newSizeMB: number): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!isWindows) {
      return {
        success: false, module: 'partition', action: 'resize',
        description: 'Partition resize requires Windows (diskpart/PowerShell)',
        details: ['On Linux, use: sudo parted /dev/sdX resizepart N SIZE', 'On macOS, use Disk Utility'],
        changes, rollbackAvailable: false, error: 'Wrong platform'
      }
    }

    const letter = driveLetter.trim()[0].toUpperCase()
    if (!/^[A-Z]$/.test(letter)) {
      throw new Error('Invalid drive letter')
    }

    // Get current size
    const currentInfo = execFileSync('powershell', [
      '-NoProfile', '-Command',
      `$part = Get-Partition -DriveLetter ${letter}; $min = (Get-PartitionSupportedSize -DriveLetter ${letter}).SizeMin; $max = (Get-PartitionSupportedSize -DriveLetter ${letter}).SizeMax; [PSCustomObject]@{Current=$part.Size; Min=$min; Max=$max} | ConvertTo-Json`
    ], { timeout: 15000, encoding: 'utf8' })

    const info = JSON.parse(currentInfo.trim())
    const currentMB = Math.round(info.Current / (1024 ** 2))
    const minMB = Math.round(info.Min / (1024 ** 2))
    const maxMB = Math.round(info.Max / (1024 ** 2))

    details.push(`Current size: ${currentMB} MB`)
    details.push(`Requested size: ${newSizeMB} MB`)
    details.push(`Allowed range: ${minMB} MB - ${maxMB} MB`)

    if (newSizeMB < minMB || newSizeMB > maxMB) {
      return {
        success: false, module: 'partition', action: 'resize',
        description: `Size ${newSizeMB}MB is outside allowed range (${minMB}-${maxMB}MB)`,
        details, changes, rollbackAvailable: false, error: 'Size out of range'
      }
    }

    const newSizeBytes = newSizeMB * 1024 * 1024
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Resize-Partition -DriveLetter ${letter} -Size ${newSizeBytes}`
    ], { timeout: 120000, encoding: 'utf8' })

    details.push(`Partition ${letter}: resized from ${currentMB}MB to ${newSizeMB}MB`)
    changes.push({
      type: 'system', action: 'modified',
      target: `Partition ${letter}:`,
      before: `${currentMB} MB`,
      after: `${newSizeMB} MB`
    })

    return {
      success: true, module: 'partition', action: 'resize',
      description: `Partition ${letter}: resized successfully`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Partition resize failed', err)
    return {
      success: false, module: 'partition', action: 'resize',
      description: 'Partition resize failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Format Partition
// ============================================================
export async function formatPartition(driveLetter: string, fileSystem: string, label: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!isWindows) {
      return {
        success: false, module: 'partition', action: 'format',
        description: 'Use mkfs on Linux or Disk Utility on macOS',
        details: [`Linux: sudo mkfs.${fileSystem.toLowerCase()} /dev/sdXN`],
        changes, rollbackAvailable: false, error: 'Wrong platform'
      }
    }

    const letter = driveLetter.trim()[0].toUpperCase()
    if (!/^[A-Z]$/.test(letter)) throw new Error('Invalid drive letter')

    const validFs = ['NTFS', 'FAT32', 'exFAT', 'ReFS']
    const fs = fileSystem.toUpperCase()
    if (!validFs.includes(fs)) throw new Error(`Invalid filesystem: ${fs}. Use: ${validFs.join(', ')}`)

    // Safety: prevent formatting system drive
    const systemDrive = (process.env.SystemDrive || 'C:')[0].toUpperCase()
    if (letter === systemDrive) {
      throw new Error('Cannot format the system drive!')
    }

    const safeLabel = (label || 'ByteFix').replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 32)

    details.push(`Formatting ${letter}: as ${fs} with label "${safeLabel}"`)
    details.push('WARNING: This will erase all data on the partition!')

    // Use diskpart script for format
    const scriptPath = join(tmpdir(), `bytefix-format-${Date.now()}.txt`)
    writeFileSync(scriptPath, `select volume ${letter}\nformat fs=${fs} label="${safeLabel}" quick\nexit\n`)

    try {
      execFileSync('diskpart', ['/s', scriptPath], {
        timeout: 120000, encoding: 'utf8'
      })
      details.push(`Format complete: ${letter}: is now ${fs}`)
      changes.push({ type: 'system', action: 'modified', target: `Partition ${letter}:`, before: 'old filesystem', after: `${fs} (${safeLabel})` })
    } finally {
      try { unlinkSync(scriptPath) } catch { /* cleanup */ }
    }

    return {
      success: changes.length > 0,
      module: 'partition', action: 'format',
      description: `Partition ${letter}: formatted as ${fs}`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Partition format failed', err)
    return {
      success: false, module: 'partition', action: 'format',
      description: 'Format failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Create New Partition (from unallocated space)
// ============================================================
export async function createPartition(diskNumber: number, sizeMB: number, fileSystem: string, label: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!isWindows) {
      return {
        success: false, module: 'partition', action: 'create',
        description: 'Use parted/fdisk on Linux or Disk Utility on macOS',
        details: ['Linux: sudo parted /dev/sdX mkpart primary ext4 0% 100%'],
        changes, rollbackAvailable: false, error: 'Wrong platform'
      }
    }

    if (diskNumber < 0 || diskNumber > 99) throw new Error('Invalid disk number')
    if (sizeMB < 100) throw new Error('Minimum partition size is 100 MB')

    const validFs = ['NTFS', 'FAT32', 'exFAT', 'ReFS']
    const fs = fileSystem.toUpperCase()
    if (!validFs.includes(fs)) throw new Error(`Invalid filesystem: ${fs}`)

    const safeLabel = (label || 'New Volume').replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 32)

    details.push(`Creating ${sizeMB}MB ${fs} partition on Disk ${diskNumber}`)

    const sizeBytes = sizeMB * 1024 * 1024
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `New-Partition -DiskNumber ${diskNumber} -Size ${sizeBytes} -AssignDriveLetter | Format-Volume -FileSystem ${fs} -NewFileSystemLabel "${safeLabel}" -Confirm:$false`
    ], { timeout: 120000, encoding: 'utf8' })

    details.push(`Partition created and formatted as ${fs} (${safeLabel})`)
    changes.push({ type: 'system', action: 'created', target: `New ${fs} partition on Disk ${diskNumber}` })

    return {
      success: true, module: 'partition', action: 'create',
      description: `New ${sizeMB}MB ${fs} partition created`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Partition creation failed', err)
    return {
      success: false, module: 'partition', action: 'create',
      description: 'Partition creation failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runPartitionManagerDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const now = Date.now()

  const partitions = await getDetailedPartitions()

  // Partition overview
  results.push({
    id: `partmgr-overview-${now}`,
    module: 'partition-mgr',
    category: 'Partition Management',
    title: `${partitions.length} Partition(s) Found`,
    severity: 'info',
    description: 'Detailed partition listing with sizes, filesystems, and types',
    details: partitions.map(p => {
      const sizeGB = (p.sizeMB / 1024).toFixed(1)
      const letter = p.letter ? `${p.letter}: ` : ''
      const label = p.label ? `"${p.label}" ` : ''
      const flags = [p.isSystem ? 'SYSTEM' : '', p.isBoot ? 'BOOT' : '', p.isActive ? 'ACTIVE' : ''].filter(Boolean).join(', ')
      return `${letter}${label}${sizeGB}GB ${p.fileSystem || 'raw'} (${p.type}) on Disk ${p.diskNumber} ${p.diskModel}${flags ? ` [${flags}]` : ''}`
    }),
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: now
  })

  // Check for unallocated space
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-Disk | ForEach-Object { $unalloc = $_.Size - ($_.AllocatedSize); if($unalloc -gt 104857600) { [PSCustomObject]@{DiskNumber=$_.Number; Model=$_.FriendlyName; UnallocatedMB=[math]::Round($unalloc/1MB)} } } | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim() && output.trim() !== 'null') {
        const unalloc = JSON.parse(output.trim())
        const arr = Array.isArray(unalloc) ? unalloc : [unalloc]
        if (arr.length > 0) {
          results.push({
            id: `partmgr-unalloc-${now}`,
            module: 'partition-mgr',
            category: 'Partition Management',
            title: 'Unallocated Space Available',
            severity: 'info',
            description: 'Free space available for creating new partitions',
            details: arr.map(u => `Disk ${u.DiskNumber} (${u.Model}): ${u.UnallocatedMB} MB unallocated`),
            fixAvailable: true,
            fixDescription: 'Create a new partition in the unallocated space',
            fixRisk: 'medium',
            autoFixable: false,
            timestamp: now
          })
        }
      }
    } catch { /* ignore */ }
  }

  // Check for partitions with low free space
  for (const p of partitions) {
    if (p.freeMB > 0 && p.sizeMB > 0) {
      const freePercent = (p.freeMB / p.sizeMB) * 100
      if (freePercent < 10 && p.sizeMB > 1024) {
        results.push({
          id: `partmgr-lowspace-${p.letter || p.number}-${now}`,
          module: 'partition-mgr',
          category: 'Partition Management',
          title: `Low Space: ${p.letter || `Partition ${p.number}`} (${freePercent.toFixed(0)}% free)`,
          severity: freePercent < 5 ? 'critical' : 'warning',
          description: `Only ${(p.freeMB / 1024).toFixed(1)}GB free out of ${(p.sizeMB / 1024).toFixed(1)}GB`,
          details: [
            `Free: ${p.freeMB} MB (${freePercent.toFixed(1)}%)`,
            'Consider cleaning up files or resizing the partition',
            p.isSystem ? 'This is the system drive — critical to maintain free space' : ''
          ].filter(Boolean),
          fixAvailable: true,
          fixDescription: 'Run disk cleanup or resize partition to add more space',
          fixRisk: 'low',
          autoFixable: false,
          timestamp: now
        })
      }
    }
  }

  // Disk health summary
  const diskLayout = await si.diskLayout()
  for (const disk of diskLayout) {
    const tempC = disk.temperature || 0
    if (tempC > 50) {
      results.push({
        id: `partmgr-temp-${disk.device}-${now}`,
        module: 'partition-mgr',
        category: 'Partition Management',
        title: `Disk Temperature: ${tempC}°C (${disk.name || disk.device})`,
        severity: tempC > 60 ? 'critical' : 'warning',
        description: `Disk ${disk.name || disk.device} is running warm. Normal range is below 45°C.`,
        details: [
          `Temperature: ${tempC}°C`,
          tempC > 60 ? 'CRITICAL: Risk of data loss! Improve cooling immediately.' : 'Warm but not dangerous. Ensure adequate airflow.'
        ],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp: now
      })
    }
  }

  return results
}
