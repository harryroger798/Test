import { execFileSync } from 'child_process'
import { platform } from 'os'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('partition-boot-manager')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'
const isLinux = platform() === 'linux'

// ============================================================
// Partition Information (Read-Only)
// ============================================================
interface PartitionInfo {
  device: string
  mountPoint: string
  label: string
  filesystem: string
  sizeMB: number
  usedMB: number
  freePercent: number
  type: 'primary' | 'logical' | 'efi' | 'recovery' | 'swap' | 'unknown'
  bootable: boolean
}

async function listPartitions(): Promise<PartitionInfo[]> {
  const partitions: PartitionInfo[] = []

  try {
    const fsSize = await si.fsSize()
    const blockDevices = await si.blockDevices()

    for (const fs of fsSize) {
      const blockDev = blockDevices.find(b =>
        b.mount === fs.mount || b.name === fs.fs?.replace('/dev/', '')
      )

      let ptype: PartitionInfo['type'] = 'unknown'
      const mount = fs.mount || ''
      const fsType = fs.type || ''

      if (/efi|esp/i.test(mount) || /efi|esp/i.test(fsType) || /EFI/i.test(blockDev?.label || '')) {
        ptype = 'efi'
      } else if (/recovery|winre/i.test(mount) || /recovery/i.test(blockDev?.label || '')) {
        ptype = 'recovery'
      } else if (fsType === 'swap') {
        ptype = 'swap'
      } else if (mount === '/' || mount === 'C:\\' || /^[A-Z]:\\$/i.test(mount)) {
        ptype = 'primary'
      } else {
        ptype = 'logical'
      }

      partitions.push({
        device: fs.fs || '',
        mountPoint: mount,
        label: blockDev?.label || '',
        filesystem: fsType,
        sizeMB: Math.round(fs.size / (1024 ** 2)),
        usedMB: Math.round(fs.used / (1024 ** 2)),
        freePercent: fs.size > 0 ? Math.round(((fs.size - fs.used) / fs.size) * 100) : 0,
        type: ptype,
        bootable: ptype === 'efi' || mount === '/' || /^C:/i.test(mount)
      })
    }
  } catch (err) {
    logger.error('Failed to list partitions', err)
  }

  // Windows: Get additional disk info via diskpart
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-Partition -ErrorAction SilentlyContinue | Select-Object DiskNumber,PartitionNumber,DriveLetter,Size,Type,IsActive,IsBoot | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim()) {
        const winParts = JSON.parse(output)
        const winArr = Array.isArray(winParts) ? winParts : [winParts]
        for (const wp of winArr) {
          // Enrich existing entries
          const letter = wp.DriveLetter ? `${wp.DriveLetter}:\\` : ''
          const existing = partitions.find(p => p.mountPoint === letter)
          if (existing) {
            if (wp.Type === 'System') existing.type = 'efi'
            if (wp.Type === 'Recovery') existing.type = 'recovery'
            if (wp.IsActive || wp.IsBoot) existing.bootable = true
          }
        }
      }
    } catch { /* ignore */ }
  }

  return partitions
}

// ============================================================
// Boot Method Detection (UEFI vs Legacy BIOS)
// ============================================================
interface BootInfo {
  method: 'UEFI' | 'Legacy BIOS' | 'Unknown'
  secureBootEnabled: boolean
  bootEntries: BootEntry[]
  efiPartitionFound: boolean
  bootIssues: string[]
}

interface BootEntry {
  number: string
  label: string
  active: boolean
  path: string
}

async function detectBootInfo(): Promise<BootInfo> {
  const info: BootInfo = {
    method: 'Unknown',
    secureBootEnabled: false,
    bootEntries: [],
    efiPartitionFound: false,
    bootIssues: []
  }

  if (isWindows) {
    // Detect UEFI vs Legacy
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        '$env:firmware_type; if (Test-Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State") { (Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State" -ErrorAction SilentlyContinue).UEFISecureBootEnabled } else { "N/A" }'
      ], { timeout: 10000, encoding: 'utf8' })

      const lines = output.trim().split('\n').map(l => l.trim())
      if (lines[0] === 'UEFI') {
        info.method = 'UEFI'
      } else if (lines[0] === 'Legacy') {
        info.method = 'Legacy BIOS'
      }
      if (lines[1] === '1') {
        info.secureBootEnabled = true
      }
    } catch { /* ignore */ }

    // Get BCD boot entries
    try {
      const output = execFileSync('bcdedit', ['/enum'], {
        timeout: 15000, encoding: 'utf8'
      })

      const entries = output.split(/\r?\n\r?\n/)
      for (const entry of entries) {
        const idMatch = entry.match(/identifier\s+(.+)/i)
        const descMatch = entry.match(/description\s+(.+)/i)
        const deviceMatch = entry.match(/device\s+(.+)/i)

        if (idMatch && descMatch) {
          info.bootEntries.push({
            number: idMatch[1].trim(),
            label: descMatch[1].trim(),
            active: /\{current\}/i.test(idMatch[1]),
            path: deviceMatch ? deviceMatch[1].trim() : ''
          })
        }
      }
    } catch {
      info.bootIssues.push('Could not read BCD entries. Run as administrator.')
    }

    // Check EFI partition
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-Partition -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq "System" } | Select-Object DiskNumber,Size | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        info.efiPartitionFound = true
      }
    } catch { /* ignore */ }
  }

  if (isLinux) {
    // Check for EFI
    if (existsSync('/sys/firmware/efi')) {
      info.method = 'UEFI'
      info.efiPartitionFound = existsSync('/boot/efi') || existsSync('/efi')

      // Check Secure Boot
      try {
        const mokutil = execFileSync('mokutil', ['--sb-state'], {
          timeout: 5000, encoding: 'utf8'
        })
        info.secureBootEnabled = /enabled/i.test(mokutil)
      } catch { /* mokutil not available */ }
    } else {
      info.method = 'Legacy BIOS'
    }

    // Get boot entries (UEFI)
    if (info.method === 'UEFI') {
      try {
        const output = execFileSync('efibootmgr', ['-v'], {
          timeout: 5000, encoding: 'utf8'
        })
        const lines = output.split('\n')
        for (const line of lines) {
          const match = line.match(/Boot(\w+)\*?\s+(.+?)(?:\t|$)/)
          if (match) {
            info.bootEntries.push({
              number: match[1],
              label: match[2].trim(),
              active: line.includes('*'),
              path: line.includes('\t') ? line.split('\t').pop()?.trim() || '' : ''
            })
          }
        }
      } catch {
        info.bootIssues.push('efibootmgr not available. Install: sudo apt install efibootmgr')
      }
    }

    // Check GRUB
    if (existsSync('/boot/grub/grub.cfg') || existsSync('/boot/grub2/grub.cfg')) {
      const grubPath = existsSync('/boot/grub/grub.cfg')
        ? '/boot/grub/grub.cfg'
        : '/boot/grub2/grub.cfg'

      try {
        const grubCfg = readFileSync(grubPath, 'utf8')
        const menuEntries = grubCfg.match(/menuentry\s+'([^']+)'/g)
        if (menuEntries) {
          for (const entry of menuEntries) {
            const name = entry.match(/menuentry\s+'([^']+)'/)?.[1] || ''
            info.bootEntries.push({
              number: '',
              label: name,
              active: false,
              path: grubPath
            })
          }
        }
      } catch {
        info.bootIssues.push('Could not read GRUB configuration')
      }
    }
  }

  if (isMac) {
    info.method = 'UEFI'
    info.secureBootEnabled = true // All modern Macs use Secure Boot

    try {
      const output = execFileSync('bless', ['--info', '--getBoot'], {
        timeout: 5000, encoding: 'utf8'
      })
      info.bootEntries.push({
        number: '0',
        label: 'macOS Boot',
        active: true,
        path: output.trim()
      })
    } catch { /* bless may need root */ }

    // Check for Boot Camp
    try {
      const output = execFileSync('diskutil', ['list'], {
        timeout: 10000, encoding: 'utf8'
      })
      if (/BOOTCAMP|Microsoft Basic Data|Windows/i.test(output)) {
        info.bootEntries.push({
          number: '',
          label: 'Windows (Boot Camp)',
          active: false,
          path: ''
        })
      }
    } catch { /* ignore */ }
  }

  // Validate boot configuration
  if (info.method === 'UEFI' && !info.efiPartitionFound) {
    info.bootIssues.push('UEFI system but no EFI partition found - boot may be compromised')
  }
  if (info.bootEntries.length === 0) {
    info.bootIssues.push('No boot entries detected')
  }

  return info
}

// ============================================================
// Detect Installed Operating Systems
// ============================================================
interface InstalledOS {
  name: string
  version: string
  partition: string
  bootLoader: string
  current: boolean
}

async function detectInstalledOSes(): Promise<InstalledOS[]> {
  const oses: InstalledOS[] = []

  // Current OS
  try {
    const osInfo = await si.osInfo()
    oses.push({
      name: osInfo.distro || osInfo.platform,
      version: osInfo.release || '',
      partition: isWindows ? 'C:\\' : '/',
      bootLoader: isWindows ? 'Windows Boot Manager' : isLinux ? 'GRUB' : 'Apple Boot',
      current: true
    })
  } catch { /* ignore */ }

  if (isWindows) {
    // Check for other Windows installations
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter -and $_.FileSystemType -eq "NTFS" } | ForEach-Object { $dl = $_.DriveLetter; if (Test-Path "${dl}:\\Windows\\System32\\config\\SOFTWARE") { [PSCustomObject]@{Drive="${dl}:"; HasWindows=$true} } } | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim()) {
        const wins = JSON.parse(output)
        const winArr = Array.isArray(wins) ? wins : [wins]
        for (const w of winArr) {
          if (w.Drive && w.Drive !== 'C:') {
            oses.push({
              name: 'Windows (secondary)',
              version: '',
              partition: w.Drive,
              bootLoader: 'BCD',
              current: false
            })
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (isLinux) {
    // Check /etc/os-release on other partitions
    try {
      const mounts = readFileSync('/proc/mounts', 'utf8')
      const mountLines = mounts.split('\n')
      for (const line of mountLines) {
        const parts = line.split(' ')
        if (parts.length < 2) continue
        const mountPoint = parts[1]
        if (mountPoint === '/' || !mountPoint.startsWith('/')) continue

        const osRelease = join(mountPoint, 'etc', 'os-release')
        if (existsSync(osRelease)) {
          try {
            const content = readFileSync(osRelease, 'utf8')
            const nameMatch = content.match(/PRETTY_NAME="([^"]+)"/)
            if (nameMatch) {
              oses.push({
                name: nameMatch[1],
                version: '',
                partition: mountPoint,
                bootLoader: 'GRUB',
                current: false
              })
            }
          } catch { /* ignore */ }
        }

        // Check for Windows on NTFS
        const windowsDir = join(mountPoint, 'Windows', 'System32')
        if (existsSync(windowsDir)) {
          oses.push({
            name: 'Windows',
            version: '',
            partition: mountPoint,
            bootLoader: 'Windows Boot Manager',
            current: false
          })
        }
      }
    } catch { /* ignore */ }
  }

  return oses
}

// ============================================================
// BCD Repair (Windows) - Safe Operation
// ============================================================
export async function repairBcd(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'partition-boot', action: 'repair_bcd',
      description: 'BCD repair is Windows-only',
      details: [isLinux ? 'Use GRUB repair instead' : 'macOS uses its own boot system'],
      changes: [], rollbackAvailable: false
    }
  }

  // Step 1: Rebuild BCD
  try {
    const output = execFileSync('bootrec', ['/rebuildbcd'], {
      timeout: 60000, encoding: 'utf8'
    })
    details.push(`BCD rebuild: ${output.trim() || 'Completed'}`)
    changes.push({ type: 'system', action: 'repaired', target: 'Boot Configuration Data' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    details.push(`BCD rebuild failed: ${msg}`)
    details.push('This command typically needs to run from Windows Recovery Environment')
  }

  // Step 2: Fix MBR
  try {
    execFileSync('bootrec', ['/fixmbr'], { timeout: 30000, encoding: 'utf8' })
    details.push('Fixed Master Boot Record')
    changes.push({ type: 'system', action: 'repaired', target: 'MBR' })
  } catch {
    details.push('MBR fix: Not available (may need Recovery Environment)')
  }

  // Step 3: Fix boot sector
  try {
    execFileSync('bootrec', ['/fixboot'], { timeout: 30000, encoding: 'utf8' })
    details.push('Fixed boot sector')
    changes.push({ type: 'system', action: 'repaired', target: 'Boot sector' })
  } catch {
    details.push('Boot sector fix: Not available (may need Recovery Environment)')
  }

  // Step 4: Scan for Windows installations
  try {
    execFileSync('bootrec', ['/scanos'], { timeout: 60000, encoding: 'utf8' })
    details.push('Scanned for Windows installations')
  } catch {
    details.push('OS scan: Not available')
  }

  if (changes.length === 0) {
    details.push('')
    details.push('Boot repair commands need to be run from Windows Recovery Environment:')
    details.push('  1. Boot from Windows USB/DVD')
    details.push('  2. Click "Repair your computer"')
    details.push('  3. Troubleshoot → Command Prompt')
    details.push('  4. Run: bootrec /rebuildbcd')
    details.push('  5. Run: bootrec /fixmbr')
    details.push('  6. Run: bootrec /fixboot')
    details.push('  7. Run: bcdboot C:\\Windows /s S: /f ALL')
  }

  return {
    success: changes.length > 0,
    module: 'partition-boot',
    action: 'repair_bcd',
    description: 'Boot Configuration Data repair',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// GRUB Repair Helper (Linux)
// ============================================================
export async function repairGrub(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isLinux) {
    return {
      success: true, module: 'partition-boot', action: 'repair_grub',
      description: 'GRUB repair is Linux-only',
      details: [isWindows ? 'Use BCD repair for Windows boot issues' : 'macOS uses its own boot system'],
      changes: [], rollbackAvailable: false
    }
  }

  // Update GRUB configuration
  try {
    execFileSync('pkexec', ['update-grub'], { timeout: 60000, encoding: 'utf8' })
    details.push('Updated GRUB configuration')
    changes.push({ type: 'system', action: 'repaired', target: 'GRUB configuration' })
  } catch {
    // Try grub2-mkconfig on RHEL-based
    try {
      execFileSync('pkexec', ['grub2-mkconfig', '-o', '/boot/grub2/grub.cfg'], {
        timeout: 60000, encoding: 'utf8'
      })
      details.push('Updated GRUB2 configuration')
      changes.push({ type: 'system', action: 'repaired', target: 'GRUB2 configuration' })
    } catch {
      details.push('Could not update GRUB. May need to boot from live USB.')
    }
  }

  // Reinstall GRUB to disk
  try {
    // Detect boot disk
    const rootDev = execFileSync('findmnt', ['-n', '-o', 'SOURCE', '/'], {
      timeout: 5000, encoding: 'utf8'
    }).trim()
    // Strip partition number to get disk device
    const diskDev = rootDev.replace(/[0-9]+$/, '').replace(/p[0-9]+$/, '')

    if (diskDev && existsSync(diskDev)) {
      execFileSync('pkexec', ['grub-install', diskDev], {
        timeout: 60000, encoding: 'utf8'
      })
      details.push(`Reinstalled GRUB to ${diskDev}`)
      changes.push({ type: 'system', action: 'repaired', target: `GRUB bootloader on ${diskDev}` })
    }
  } catch {
    details.push('Could not reinstall GRUB bootloader')
  }

  if (changes.length === 0) {
    details.push('')
    details.push('GRUB Repair from Live USB:')
    details.push('  1. Boot from Ubuntu/Linux live USB')
    details.push('  2. Open terminal')
    details.push('  3. sudo mount /dev/sdaX /mnt  (replace sdaX with your Linux partition)')
    details.push('  4. sudo mount /dev/sda1 /mnt/boot/efi  (if UEFI)')
    details.push('  5. sudo grub-install --root-directory=/mnt /dev/sda')
    details.push('  6. sudo chroot /mnt update-grub')
    details.push('  7. Reboot')
  }

  return {
    success: changes.length > 0,
    module: 'partition-boot',
    action: 'repair_grub',
    description: 'GRUB bootloader repair',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Verify Disk Health for Boot Drive
// ============================================================
export async function verifyBootDrive(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    try {
      const output = execFileSync('chkdsk', ['C:', '/scan'], {
        timeout: 300000, encoding: 'utf8'
      })
      const lines = output.split('\n').filter(l => l.trim())
      details.push(...lines.slice(-5))
      if (/no problems/i.test(output)) {
        details.push('Boot drive filesystem is healthy')
      } else {
        details.push('Issues detected. Run chkdsk /r from Recovery Environment to fix.')
      }
    } catch {
      details.push('chkdsk requires administrator privileges')
    }
  }

  if (isLinux) {
    // Cannot fsck mounted root, but can check for errors
    try {
      const output = execFileSync('dmesg', [], {
        timeout: 5000, encoding: 'utf8'
      })
      const fsErrors = output.split('\n').filter(l =>
        /ext4|btrfs|xfs/i.test(l) && /error|corrupt|fail/i.test(l)
      )
      if (fsErrors.length > 0) {
        details.push('Filesystem errors detected in kernel log:')
        details.push(...fsErrors.slice(0, 10))
      } else {
        details.push('No filesystem errors in kernel log')
      }
    } catch {
      details.push('Could not read kernel log')
    }
  }

  if (isMac) {
    try {
      const output = execFileSync('diskutil', ['verifyVolume', '/'], {
        timeout: 120000, encoding: 'utf8'
      })
      details.push(output.trim().split('\n').pop() || 'Verification complete')
      if (/appears to be ok/i.test(output)) {
        details.push('Boot volume is healthy')
      } else {
        details.push('Issues detected. Run "diskutil repairVolume /" or use Disk Utility in Recovery mode.')
      }
    } catch {
      details.push('Volume verification requires admin access')
    }
  }

  return {
    success: true,
    module: 'partition-boot',
    action: 'verify_boot_drive',
    description: 'Boot drive verification',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runPartitionBootDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. Partition listing
  const partitions = await listPartitions()

  for (const part of partitions) {
    const lowSpace = part.freePercent < 10
    const veryLowSpace = part.freePercent < 5

    results.push({
      id: `part-${part.mountPoint.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`,
      module: 'partition-boot',
      category: 'Partitions',
      title: `${part.mountPoint || part.device}: ${Math.round(part.sizeMB / 1024)}GB ${part.filesystem} (${part.freePercent}% free)`,
      severity: veryLowSpace ? 'critical' : lowSpace ? 'warning' : 'healthy',
      description: veryLowSpace
        ? `Partition ${part.mountPoint} is almost full! Only ${part.freePercent}% free.`
        : lowSpace
          ? `Partition ${part.mountPoint} is running low on space`
          : `Partition ${part.mountPoint} has adequate space`,
      details: [
        `Device: ${part.device}`,
        `Mount: ${part.mountPoint}`,
        `Label: ${part.label || 'None'}`,
        `Filesystem: ${part.filesystem}`,
        `Size: ${Math.round(part.sizeMB / 1024)}GB | Used: ${Math.round(part.usedMB / 1024)}GB | Free: ${part.freePercent}%`,
        `Type: ${part.type} | Bootable: ${part.bootable ? 'Yes' : 'No'}`
      ],
      fixAvailable: lowSpace,
      fixDescription: 'Use ByteFix Performance Optimizer → Disk Cleanup',
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // 2. Boot information
  const bootInfo = await detectBootInfo()

  results.push({
    id: `boot-method-${Date.now()}`,
    module: 'partition-boot',
    category: 'Boot Configuration',
    title: `Boot Method: ${bootInfo.method} | Secure Boot: ${bootInfo.secureBootEnabled ? 'Enabled' : 'Disabled'}`,
    severity: 'info',
    description: `System boots via ${bootInfo.method}${bootInfo.secureBootEnabled ? ' with Secure Boot' : ''}`,
    details: [
      `Boot method: ${bootInfo.method}`,
      `Secure Boot: ${bootInfo.secureBootEnabled ? 'Enabled' : 'Disabled'}`,
      `EFI partition: ${bootInfo.efiPartitionFound ? 'Found' : 'Not found'}`,
      `Boot entries: ${bootInfo.bootEntries.length}`
    ],
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: Date.now()
  })

  // Boot entries
  if (bootInfo.bootEntries.length > 0) {
    results.push({
      id: `boot-entries-${Date.now()}`,
      module: 'partition-boot',
      category: 'Boot Entries',
      title: `${bootInfo.bootEntries.length} boot entries found`,
      severity: 'info',
      description: 'Detected boot loader entries',
      details: bootInfo.bootEntries.map(e =>
        `${e.active ? '→ ' : '  '}${e.label} [${e.number}]${e.path ? ` (${e.path})` : ''}`
      ),
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // Boot issues
  for (const issue of bootInfo.bootIssues) {
    results.push({
      id: `boot-issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      module: 'partition-boot',
      category: 'Boot Issues',
      title: issue,
      severity: 'warning',
      description: issue,
      details: [],
      fixAvailable: true,
      fixDescription: isWindows ? 'Repair BCD' : 'Repair GRUB',
      fixRisk: 'medium',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // 3. Detect installed OSes
  const oses = await detectInstalledOSes()

  if (oses.length > 1) {
    results.push({
      id: `boot-multiOS-${Date.now()}`,
      module: 'partition-boot',
      category: 'Multi-Boot',
      title: `${oses.length} operating systems detected (Dual/Multi-boot)`,
      severity: 'info',
      description: 'Multiple operating systems found on this machine',
      details: oses.map(os =>
        `${os.current ? '→ ' : '  '}${os.name} ${os.version} on ${os.partition} (${os.bootLoader})`
      ),
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // 4. EFI partition health
  if (bootInfo.method === 'UEFI') {
    const efiPart = partitions.find(p => p.type === 'efi')
    if (efiPart) {
      const efiSizeMB = efiPart.sizeMB
      if (efiSizeMB < 100) {
        results.push({
          id: `boot-efi-small-${Date.now()}`,
          module: 'partition-boot',
          category: 'EFI Partition',
          title: `EFI partition is small: ${efiSizeMB}MB`,
          severity: 'warning',
          description: 'EFI System Partition is smaller than recommended (200MB minimum)',
          details: [
            `Current size: ${efiSizeMB}MB`,
            'Recommended: 200-500MB',
            'Small EFI partition can cause boot problems when updating OS'
          ],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp: Date.now()
        })
      }
    } else if (!bootInfo.efiPartitionFound) {
      results.push({
        id: `boot-efi-missing-${Date.now()}`,
        module: 'partition-boot',
        category: 'EFI Partition',
        title: 'EFI partition not found',
        severity: 'critical',
        description: 'System is UEFI but no EFI System Partition was detected. Boot may be at risk.',
        details: [
          'The EFI partition is required for UEFI boot',
          'This may indicate a corrupted partition table',
          'Use Windows Recovery or Linux Live USB to recreate'
        ],
        fixAvailable: true,
        fixDescription: isWindows ? 'Attempt BCD repair' : 'Attempt GRUB repair',
        fixRisk: 'high',
        autoFixable: true,
        timestamp: Date.now()
      })
    }
  }

  return results
}
