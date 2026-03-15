// ============================================================
// ByteFix — Firmware & BIOS Tools Module
// BIOS version check, firmware update detection, driver update check
// Uses PowerShell/WMI on Windows, fwupdmgr on Linux, system_profiler on macOS
// ============================================================

import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { platform } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('firmware-manager')
const isWindows = platform() === 'win32'
const isLinux = platform() === 'linux'
const isMac = platform() === 'darwin'

// ============================================================
// BIOS/UEFI Information
// ============================================================
interface BiosInfo {
  vendor: string
  version: string
  date: string
  isUefi: boolean
  secureBootEnabled: boolean
  tpmVersion: string
  tpmEnabled: boolean
}

async function getBiosInfo(): Promise<BiosInfo> {
  const info: BiosInfo = {
    vendor: 'Unknown',
    version: 'Unknown',
    date: 'Unknown',
    isUefi: false,
    secureBootEnabled: false,
    tpmVersion: 'Not detected',
    tpmEnabled: false
  }

  try {
    const bios = await si.bios()
    info.vendor = bios.vendor || 'Unknown'
    info.version = bios.version || 'Unknown'
    info.date = bios.releaseDate || 'Unknown'
  } catch {
    logger.warn('Failed to get BIOS info via systeminformation')
  }

  if (isWindows) {
    // Check UEFI
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        '$env:firmware_type'
      ], { timeout: 10000, encoding: 'utf8' })
      info.isUefi = output.trim() === 'UEFI'
    } catch { /* ignore */ }

    // Check Secure Boot
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Confirm-SecureBootUEFI'
      ], { timeout: 10000, encoding: 'utf8' })
      info.secureBootEnabled = output.trim().toLowerCase() === 'true'
    } catch { /* not available */ }

    // Check TPM
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-Tpm | Select-Object TpmPresent, TpmReady, ManufacturerVersion | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })
      if (output.trim()) {
        const tpm = JSON.parse(output.trim())
        info.tpmEnabled = tpm.TpmPresent === true && tpm.TpmReady === true
        info.tpmVersion = tpm.ManufacturerVersion || (info.tpmEnabled ? 'Present' : 'Not ready')
      }
    } catch { /* TPM not available */ }
  }

  if (isLinux) {
    info.isUefi = existsSync('/sys/firmware/efi')

    // Check Secure Boot
    try {
      const output = execFileSync('mokutil', ['--sb-state'], {
        timeout: 5000, encoding: 'utf8'
      })
      info.secureBootEnabled = /enabled/i.test(output)
    } catch { /* mokutil not available */ }

    // Read BIOS info from DMI
    try {
      if (existsSync('/sys/class/dmi/id/bios_vendor')) {
        info.vendor = readFileSync('/sys/class/dmi/id/bios_vendor', 'utf8').trim()
      }
      if (existsSync('/sys/class/dmi/id/bios_version')) {
        info.version = readFileSync('/sys/class/dmi/id/bios_version', 'utf8').trim()
      }
      if (existsSync('/sys/class/dmi/id/bios_date')) {
        info.date = readFileSync('/sys/class/dmi/id/bios_date', 'utf8').trim()
      }
    } catch { /* DMI not available */ }

    // Check TPM
    if (existsSync('/sys/class/tpm/tpm0')) {
      info.tpmEnabled = true
      try {
        info.tpmVersion = readFileSync('/sys/class/tpm/tpm0/tpm_version_major', 'utf8').trim()
      } catch { /* ignore */ }
    }
  }

  if (isMac) {
    info.isUefi = true // All Macs use UEFI
    info.secureBootEnabled = true // Modern Macs have Secure Boot
    try {
      const output = execFileSync('system_profiler', ['SPHardwareDataType'], {
        timeout: 15000, encoding: 'utf8'
      })
      const versionMatch = output.match(/Boot ROM Version:\s*(.+)/i)
      if (versionMatch) {
        info.version = versionMatch[1].trim()
        info.vendor = 'Apple'
      }
    } catch { /* ignore */ }
  }

  return info
}

// ============================================================
// Check for Driver Updates (Windows)
// ============================================================
interface DriverInfo {
  name: string
  version: string
  date: string
  provider: string
  deviceClass: string
  needsUpdate: boolean
  updateReason: string
}

async function checkDrivers(): Promise<DriverInfo[]> {
  const drivers: DriverInfo[] = []

  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceName -ne $null } | Select-Object DeviceName, DriverVersion, DriverDate, DriverProviderName, DeviceClass -First 50 | ConvertTo-Json'
      ], { timeout: 30000, encoding: 'utf8' })

      if (output.trim()) {
        const parsed = JSON.parse(output.trim())
        const driverArr = Array.isArray(parsed) ? parsed : [parsed]

        for (const d of driverArr) {
          if (!d.DeviceName) continue

          // Parse driver date
          let dateStr = 'Unknown'
          let isOld = false
          if (d.DriverDate) {
            try {
              const dateMatch = d.DriverDate.match(/(\d{4})(\d{2})(\d{2})/)
              if (dateMatch) {
                dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
                const driverYear = parseInt(dateMatch[1])
                const currentYear = new Date().getFullYear()
                isOld = currentYear - driverYear > 3
              }
            } catch { /* ignore parse errors */ }
          }

          const isMicrosoftGeneric = /microsoft/i.test(d.DriverProviderName || '') &&
            !/surface|xbox/i.test(d.DeviceName || '')

          drivers.push({
            name: d.DeviceName || 'Unknown',
            version: d.DriverVersion || 'Unknown',
            date: dateStr,
            provider: d.DriverProviderName || 'Unknown',
            deviceClass: d.DeviceClass || 'Unknown',
            needsUpdate: isOld || isMicrosoftGeneric,
            updateReason: isOld ? `Driver is ${new Date().getFullYear() - parseInt(dateStr)}+ years old`
              : isMicrosoftGeneric ? 'Using generic Microsoft driver (manufacturer driver may be better)'
              : ''
          })
        }
      }
    } catch (err) {
      logger.warn('Failed to enumerate drivers', err)
    }
  }

  if (isLinux) {
    // Check for firmware updates via fwupd
    try {
      const output = execFileSync('fwupdmgr', ['get-devices', '--json'], {
        timeout: 30000, encoding: 'utf8'
      })
      const devices = JSON.parse(output)
      const deviceArr = devices?.Devices || []
      for (const dev of deviceArr) {
        drivers.push({
          name: dev.Name || 'Unknown',
          version: dev.Version || 'Unknown',
          date: dev.Created || 'Unknown',
          provider: dev.Vendor || 'Unknown',
          deviceClass: dev.Plugin || 'Unknown',
          needsUpdate: dev.UpdateState === 'pending' || false,
          updateReason: dev.UpdateState === 'pending' ? 'Firmware update available' : ''
        })
      }
    } catch {
      // fwupd not available
    }
  }

  return drivers
}

// ============================================================
// Check for Firmware Updates (Linux fwupd)
// ============================================================
export async function checkFirmwareUpdates(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (isLinux) {
      // Check if fwupd is available
      try {
        execFileSync('which', ['fwupdmgr'], { timeout: 5000, encoding: 'utf8' })
      } catch {
        return {
          success: false, module: 'firmware', action: 'check-firmware-updates',
          description: 'fwupd not installed',
          details: ['Install fwupd: sudo apt install fwupd', 'Then run: fwupdmgr refresh && fwupdmgr get-updates'],
          changes, rollbackAvailable: false, error: 'fwupd not installed'
        }
      }

      // Refresh metadata
      try {
        execFileSync('fwupdmgr', ['refresh'], { timeout: 60000, encoding: 'utf8' })
        details.push('Firmware metadata refreshed')
      } catch {
        details.push('Could not refresh firmware metadata (may need root)')
      }

      // Check for updates
      try {
        const output = execFileSync('fwupdmgr', ['get-updates'], {
          timeout: 30000, encoding: 'utf8'
        })
        if (output.trim()) {
          details.push('Available firmware updates:')
          details.push(output.substring(0, 1000))
          changes.push({ type: 'system', action: 'created', target: 'Firmware update list' })
        } else {
          details.push('No firmware updates available')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/no updates/i.test(msg)) {
          details.push('All firmware is up to date')
        } else {
          details.push(`Update check: ${msg}`)
        }
      }
    } else if (isWindows) {
      details.push('Windows firmware updates are delivered through Windows Update.')
      details.push('Checking Windows Update status...')

      try {
        const output = execFileSync('powershell', [
          '-NoProfile', '-Command',
          '$session = New-Object -ComObject Microsoft.Update.Session; $searcher = $session.CreateUpdateSearcher(); $result = $searcher.Search("IsInstalled=0"); $result.Updates | Where-Object { $_.Title -match "firmware|bios|uefi" } | Select-Object Title, Description -First 5 | ConvertTo-Json'
        ], { timeout: 60000, encoding: 'utf8' })

        if (output.trim() && output.trim() !== 'null') {
          const updates = JSON.parse(output.trim())
          const updateArr = Array.isArray(updates) ? updates : [updates]
          if (updateArr.length > 0) {
            details.push(`Found ${updateArr.length} firmware-related update(s):`)
            for (const u of updateArr) {
              details.push(`  - ${u.Title}`)
            }
            changes.push({ type: 'system', action: 'created', target: 'Firmware update list' })
          } else {
            details.push('No firmware updates pending in Windows Update')
          }
        } else {
          details.push('No firmware updates pending in Windows Update')
        }
      } catch {
        details.push('Could not query Windows Update. Check Settings > Windows Update manually.')
      }
    } else if (isMac) {
      details.push('macOS firmware updates are delivered through Software Update.')
      try {
        const output = execFileSync('softwareupdate', ['-l'], {
          timeout: 60000, encoding: 'utf8'
        })
        if (/firmware|efi|supplemental/i.test(output)) {
          details.push('Firmware-related updates found:')
          details.push(output.substring(0, 500))
          changes.push({ type: 'system', action: 'created', target: 'Firmware update list' })
        } else {
          details.push('No firmware updates available')
        }
      } catch {
        details.push('Could not check for updates')
      }
    }

    return {
      success: true, module: 'firmware', action: 'check-firmware-updates',
      description: 'Firmware update check',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Firmware update check failed', err)
    return {
      success: false, module: 'firmware', action: 'check-firmware-updates',
      description: 'Firmware update check failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Update All Drivers (Windows - uses pnputil)
// ============================================================
export async function updateDrivers(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (isWindows) {
      // Scan for hardware changes first
      details.push('Scanning for hardware changes...')
      try {
        execFileSync('powershell', [
          '-NoProfile', '-Command',
          '$scanResult = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search("IsInstalled=0 AND Type=\'Driver\'"); Write-Output "$($scanResult.Updates.Count) driver updates available"'
        ], { timeout: 60000, encoding: 'utf8' })
      } catch {
        details.push('Could not scan Windows Update for driver updates')
      }

      // Use pnputil to scan and install driver updates
      try {
        const output = execFileSync('pnputil', ['/scan-devices'], {
          timeout: 30000, encoding: 'utf8'
        })
        details.push(`Device scan: ${output.trim()}`)
        changes.push({ type: 'driver', action: 'repaired', target: 'Device driver scan completed' })
      } catch {
        details.push('pnputil scan failed (may need administrator)')
      }

      details.push('')
      details.push('For driver updates, also check:')
      details.push('  - Windows Update > Advanced Options > Optional Updates')
      details.push('  - Device Manager > Right-click device > Update driver')
      details.push('  - Manufacturer website for latest drivers')

    } else if (isLinux) {
      // Use fwupd for firmware
      try {
        execFileSync('fwupdmgr', ['update', '-y'], { timeout: 120000, encoding: 'utf8' })
        details.push('Firmware updates applied via fwupd')
        changes.push({ type: 'system', action: 'repaired', target: 'Firmware updated' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/no updates/i.test(msg)) {
          details.push('All firmware is already up to date')
        } else {
          details.push(`fwupd update: ${msg}`)
        }
      }
    } else if (isMac) {
      details.push('macOS drivers are updated through Software Update.')
      details.push('Run: softwareupdate --install --all')
    }

    return {
      success: true, module: 'firmware', action: 'update-drivers',
      description: 'Driver and firmware update',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Driver update failed', err)
    return {
      success: false, module: 'firmware', action: 'update-drivers',
      description: 'Driver update failed',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runFirmwareDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const now = Date.now()

  // BIOS Information
  const bios = await getBiosInfo()

  results.push({
    id: `fw-bios-${now}`,
    module: 'firmware',
    category: 'Firmware & BIOS',
    title: `BIOS: ${bios.vendor} v${bios.version}`,
    severity: 'info',
    description: `BIOS/UEFI firmware information`,
    details: [
      `Vendor: ${bios.vendor}`,
      `Version: ${bios.version}`,
      `Date: ${bios.date}`,
      `Boot Mode: ${bios.isUefi ? 'UEFI' : 'Legacy BIOS'}`,
      `Secure Boot: ${bios.secureBootEnabled ? 'Enabled' : 'Disabled'}`,
      `TPM: ${bios.tpmEnabled ? `Enabled (v${bios.tpmVersion})` : 'Not detected or disabled'}`
    ],
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: now
  })

  // TPM status (important for Windows 11)
  if (isWindows) {
    results.push({
      id: `fw-tpm-${now}`,
      module: 'firmware',
      category: 'Firmware & BIOS',
      title: bios.tpmEnabled ? 'TPM 2.0 Active' : 'TPM Not Active',
      severity: bios.tpmEnabled ? 'healthy' : 'warning',
      description: bios.tpmEnabled
        ? 'Trusted Platform Module is active. Required for Windows 11 and BitLocker.'
        : 'TPM is not detected or not enabled. Required for Windows 11 and BitLocker encryption.',
      details: bios.tpmEnabled
        ? [`TPM Version: ${bios.tpmVersion}`, 'BitLocker encryption is available', 'Windows 11 compatible']
        : ['Enable TPM in BIOS/UEFI settings', 'Look for "Security" or "Trusted Computing" section in BIOS', 'TPM 2.0 is required for Windows 11'],
      fixAvailable: !bios.tpmEnabled,
      fixDescription: bios.tpmEnabled ? undefined : 'Enable TPM in BIOS settings (requires restart)',
      fixRisk: 'low',
      autoFixable: false,
      timestamp: now
    })
  }

  // Secure Boot status
  if (!bios.secureBootEnabled && bios.isUefi) {
    results.push({
      id: `fw-secboot-${now}`,
      module: 'firmware',
      category: 'Firmware & BIOS',
      title: 'Secure Boot Disabled',
      severity: 'warning',
      description: 'Secure Boot is disabled. This reduces protection against boot-level malware.',
      details: [
        'Secure Boot prevents unsigned bootloaders from running',
        'Enable in BIOS/UEFI settings under "Security" or "Boot"',
        'Note: Some Linux distributions may need Secure Boot disabled'
      ],
      fixAvailable: true,
      fixDescription: 'Enable Secure Boot in BIOS settings (requires restart)',
      fixRisk: 'medium',
      autoFixable: false,
      timestamp: now
    })
  }

  // Driver check
  const drivers = await checkDrivers()
  const outdatedDrivers = drivers.filter(d => d.needsUpdate)

  if (outdatedDrivers.length > 0) {
    results.push({
      id: `fw-drivers-${now}`,
      module: 'firmware',
      category: 'Firmware & BIOS',
      title: `${outdatedDrivers.length} Driver(s) May Need Update`,
      severity: outdatedDrivers.length > 5 ? 'warning' : 'info',
      description: `Found ${outdatedDrivers.length} drivers that may benefit from updates`,
      details: outdatedDrivers.slice(0, 10).map(d =>
        `${d.name} (v${d.version}, ${d.date}) — ${d.updateReason}`
      ),
      fixAvailable: true,
      fixDescription: 'Check Windows Update > Optional Updates for driver updates',
      fixRisk: 'low',
      autoFixable: false,
      timestamp: now
    })
  } else if (drivers.length > 0) {
    results.push({
      id: `fw-drivers-${now}`,
      module: 'firmware',
      category: 'Firmware & BIOS',
      title: `${drivers.length} Drivers Checked — All Current`,
      severity: 'healthy',
      description: 'All enumerated drivers appear to be reasonably current',
      details: [`Checked ${drivers.length} device drivers`, 'No outdated or generic drivers detected'],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: now
    })
  }

  return results
}
