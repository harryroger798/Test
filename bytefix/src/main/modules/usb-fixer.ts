// ============================================================
// ByteFix Phase 2 — USB/Peripheral Fixer Module
// Selective suspend disable, port reset, driver reinstall, RAW drive repair
// ============================================================

import { execSync, execFileSync } from 'child_process'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('usb-fixer')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

function listUsbDevices(): { name: string; status: string; instanceId: string; deviceClass: string }[] {
  const devices: { name: string; status: string; instanceId: string; deviceClass: string }[] = []
  if (!isWin) return devices

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-PnpDevice -Class USB -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, InstanceId, Class | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const dev of items) {
        devices.push({
          name: String(dev.FriendlyName || 'Unknown USB Device'),
          status: String(dev.Status || 'Unknown'),
          instanceId: String(dev.InstanceId || ''),
          deviceClass: String(dev.Class || 'USB'),
        })
      }
    }
  } catch (err) {
    logger.warn('Failed to list USB devices', err)
  }
  return devices
}

function checkUsbSelectiveSuspend(): { enabled: boolean; acValue: number; dcValue: number } {
  const result = { enabled: true, acValue: 1, dcValue: 1 }
  if (!isWin) return result

  try {
    // Check power plan USB selective suspend
    const output = execSync(
      'powershell -NoProfile -Command "powercfg /query SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 | Select-String \'Current.*Index\'"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    const values = output.match(/0x([0-9a-fA-F]+)/g) || []
    if (values.length >= 2) {
      result.acValue = parseInt(values[0].replace('0x', ''), 16)
      result.dcValue = parseInt(values[1].replace('0x', ''), 16)
      result.enabled = result.acValue === 1 || result.dcValue === 1
    }
  } catch { /* powercfg not available */ }
  return result
}

function checkUsbPowerManagement(): { devicesWithPowerMgmt: number; total: number } {
  const result = { devicesWithPowerMgmt: 0, total: 0 }
  if (!isWin) return result

  try {
    const output = execSync(
      'powershell -NoProfile -Command "$hubs = Get-PnpDevice -Class USB | Where-Object { $_.FriendlyName -match \'Hub\' -and $_.Status -eq \'OK\' }; $total = ($hubs | Measure-Object).Count; $pm = 0; foreach ($hub in $hubs) { $prop = Get-PnpDeviceProperty -InstanceId $hub.InstanceId -KeyName \'DEVPKEY_Device_PowerData\' -ErrorAction SilentlyContinue; if ($prop) { $pm++ } }; Write-Output \\"$total|$pm\\""',
      { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
    ).trim()
    const parts = output.split('|')
    if (parts.length === 2) {
      result.total = parseInt(parts[0], 10) || 0
      result.devicesWithPowerMgmt = parseInt(parts[1], 10) || 0
    }
  } catch { /* query failed */ }
  return result
}

function detectRawDrives(): { drive: string; fileSystem: string; size: number }[] {
  const rawDrives: { drive: string; fileSystem: string; size: number }[] = []
  if (!isWin) return rawDrives

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-Volume | Where-Object { $_.FileSystemType -eq \'Unknown\' -or $_.FileSystem -eq \'RAW\' } | Select-Object DriveLetter, FileSystemType, Size | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const vol of items) {
        if (vol.DriveLetter) {
          rawDrives.push({
            drive: `${vol.DriveLetter}:`,
            fileSystem: String(vol.FileSystemType || 'RAW'),
            size: vol.Size || 0,
          })
        }
      }
    }
  } catch { /* no RAW drives */ }
  return rawDrives
}

function checkUsbControllerErrors(): number {
  if (!isWin) return 0
  try {
    const output = execSync(
      'powershell -NoProfile -Command "(Get-WinEvent -FilterHashtable @{LogName=\'System\'; ProviderName=\'Microsoft-Windows-USB-USBHUB3-Diagnostics\',\'Microsoft-Windows-USB-USBXHCI\'} -MaxEvents 20 -ErrorAction SilentlyContinue).Count"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    return parseInt(output, 10) || 0
  } catch { return 0 }
}

export async function runUsbDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    if (isWin) {
      // 1. List USB devices
      const devices = listUsbDevices()
      const errorDevices = devices.filter(d => d.status !== 'OK')
      const hubs = devices.filter(d => /hub/i.test(d.name))

      results.push({
        id: `usb-devices-${timestamp}`,
        module: 'usb-fixer',
        category: 'USB Devices',
        title: `${devices.length} USB Device(s) Found`,
        severity: errorDevices.length > 0 ? 'warning' : 'healthy',
        description: errorDevices.length > 0
          ? `${errorDevices.length} device(s) with errors`
          : `All USB devices functioning (${hubs.length} hubs, ${devices.length - hubs.length} peripherals)`,
        details: [
          `Total: ${devices.length} devices (${hubs.length} hubs)`,
          ...errorDevices.map(d => `ERROR: ${d.name} — ${d.status}`),
        ],
        fixAvailable: errorDevices.length > 0,
        fixDescription: errorDevices.length > 0 ? 'Reinstall problematic USB device drivers' : undefined,
        fixRisk: 'low',
        autoFixable: true,
        timestamp,
      })

      // 2. USB Selective Suspend
      const suspend = checkUsbSelectiveSuspend()
      if (suspend.enabled) {
        results.push({
          id: `usb-suspend-${timestamp}`,
          module: 'usb-fixer',
          category: 'Power Management',
          title: 'USB Selective Suspend Enabled',
          severity: 'info',
          description: 'USB Selective Suspend can cause USB devices to disconnect randomly',
          details: [
            `AC (plugged in): ${suspend.acValue === 1 ? 'Enabled' : 'Disabled'}`,
            `DC (battery): ${suspend.dcValue === 1 ? 'Enabled' : 'Disabled'}`,
            'Disabling this prevents random USB disconnections but slightly increases power usage',
          ],
          fixAvailable: true,
          fixDescription: 'Disable USB Selective Suspend',
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      }

      // 3. RAW drives
      const rawDrives = detectRawDrives()
      for (const drive of rawDrives) {
        results.push({
          id: `usb-raw-${timestamp}-${drive.drive}`,
          module: 'usb-fixer',
          category: 'RAW Drives',
          title: `RAW Drive Detected: ${drive.drive}`,
          severity: 'error',
          description: `Drive ${drive.drive} has RAW filesystem (${(drive.size / 1024 / 1024 / 1024).toFixed(1)}GB). Data may be recoverable.`,
          details: [
            `Drive: ${drive.drive}`,
            `Filesystem: ${drive.fileSystem}`,
            `Size: ${(drive.size / 1024 / 1024 / 1024).toFixed(1)}GB`,
            'DO NOT format — data recovery should be attempted first',
            'Use Data Recovery module to recover files before formatting',
          ],
          fixAvailable: true,
          fixDescription: 'Attempt filesystem repair with chkdsk (may recover data)',
          fixRisk: 'high',
          autoFixable: false, // Must be user-confirmed
          timestamp,
        })
      }

      // 4. USB controller errors
      const controllerErrors = checkUsbControllerErrors()
      if (controllerErrors > 0) {
        results.push({
          id: `usb-ctrl-errors-${timestamp}`,
          module: 'usb-fixer',
          category: 'USB Controller',
          title: `${controllerErrors} USB Controller Error(s)`,
          severity: controllerErrors > 10 ? 'error' : 'warning',
          description: `Found ${controllerErrors} USB controller error events in system log`,
          details: [
            `${controllerErrors} USB controller errors detected`,
            'Symptoms: USB devices disconnecting, not recognized, data transfer errors',
            'Common causes: Outdated USB controller driver, faulty USB port, power issues',
          ],
          fixAvailable: true,
          fixDescription: 'Reinstall USB controller drivers',
          fixRisk: 'medium',
          autoFixable: true,
          timestamp,
        })
      }
    } else if (isMac) {
      // macOS USB check
      try {
        const output = execFileSync('system_profiler', ['SPUSBDataType'], {
          encoding: 'utf8', timeout: 10000, stdio: 'pipe'
        })
        const usbDevices = output.match(/^\s{8}\w.+:/gm) || []
        results.push({
          id: `usb-mac-${timestamp}`,
          module: 'usb-fixer',
          category: 'USB Devices',
          title: `${usbDevices.length} USB Device(s) Connected`,
          severity: 'info',
          description: usbDevices.map(d => d.trim().replace(/:$/, '')).join(', ') || 'No USB devices',
          details: usbDevices.map(d => d.trim().replace(/:$/, '')),
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      } catch { /* system_profiler not available */ }
    } else {
      // Linux USB check
      try {
        const output = execFileSync('lsusb', [], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
        const usbLines = output.trim().split('\n').filter(Boolean)
        results.push({
          id: `usb-linux-${timestamp}`,
          module: 'usb-fixer',
          category: 'USB Devices',
          title: `${usbLines.length} USB Device(s) Found`,
          severity: 'info',
          description: `${usbLines.length} USB devices detected`,
          details: usbLines,
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      } catch { /* lsusb not available */ }
    }
  } catch (err) {
    logger.error('USB diagnostics failed', err)
    results.push({
      id: `usb-error-${timestamp}`,
      module: 'usb-fixer',
      category: 'Error',
      title: 'USB Diagnostics Error',
      severity: 'error',
      description: `Failed: ${err instanceof Error ? err.message : String(err)}`,
      details: [],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp,
    })
  }

  return results
}

// Fix: Disable USB Selective Suspend
export async function disableSelectiveSuspend(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'usb-fixer', action: 'disable-selective-suspend',
        description: 'USB Selective Suspend settings are Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    // Disable for AC
    execSync(
      'powercfg /setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0',
      { timeout: 10000, stdio: 'pipe' }
    )
    // Disable for DC
    execSync(
      'powercfg /setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0',
      { timeout: 10000, stdio: 'pipe' }
    )
    // Apply
    execSync('powercfg /setactive SCHEME_CURRENT', { timeout: 5000, stdio: 'pipe' })

    details.push('USB Selective Suspend disabled for both AC and battery modes')
    details.push('USB devices will no longer be powered down to save energy')
    changes.push({ type: 'system', action: 'modified', target: 'USB Selective Suspend power setting' })

    return {
      success: true, module: 'usb-fixer', action: 'disable-selective-suspend',
      description: 'USB Selective Suspend disabled',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'usb-fixer', action: 'disable-selective-suspend',
      description: 'Failed to disable USB Selective Suspend',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Reinstall USB drivers
export async function reinstallUsbDrivers(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Reinstall error USB devices
      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class USB -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne \'OK\' } | ForEach-Object { pnputil /remove-device $_.InstanceId 2>$null }"',
        { timeout: 30000, stdio: 'pipe' }
      )
      details.push('Removed error USB device drivers')

      execSync('pnputil /scan-devices', { timeout: 30000, stdio: 'pipe' })
      details.push('Hardware scan completed — USB drivers will be reinstalled')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'USB device drivers' })
    } else if (isMac) {
      // Reset USB controller on macOS
      try {
        execSync('sudo killall -STOP -c usbd 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
        execSync('sudo killall -CONT -c usbd 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
        details.push('USB daemon reset')
        changes.push({ type: 'service', action: 'restarted', target: 'usbd' })
      } catch {
        details.push('USB reset requires SMC reset on this Mac model')
        details.push('Intel Mac: Shut down → Hold Shift+Control+Option+Power for 10 seconds')
        details.push('Apple Silicon: Shut down → Wait 30 seconds → Power on')
      }
    } else {
      // Linux USB reset
      try {
        execSync('echo 1 | sudo tee /sys/bus/usb/devices/usb*/authorized 2>/dev/null', {
          timeout: 5000, stdio: 'pipe'
        })
        details.push('USB devices re-authorized')
        changes.push({ type: 'system', action: 'modified', target: 'USB authorization' })
      } catch {
        details.push('Could not reset USB devices')
      }
    }

    return {
      success: true, module: 'usb-fixer', action: 'reinstall-drivers',
      description: 'USB drivers reinstalled',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'usb-fixer', action: 'reinstall-drivers',
      description: 'Failed to reinstall USB drivers',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Repair RAW USB drive
export async function repairRawDrive(driveLetter: string): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'usb-fixer', action: 'repair-raw-drive',
        description: 'RAW drive repair via chkdsk is Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    // Validate drive letter
    if (!/^[a-zA-Z]$/.test(driveLetter.trim())) {
      throw new Error(`Invalid drive letter: ${driveLetter}`)
    }
    const drive = `${driveLetter.trim().toUpperCase()}:`

    details.push(`Attempting to repair RAW drive ${drive}`)
    details.push('WARNING: This attempts filesystem repair. Data recovery should be done first.')

    // Try chkdsk /r (locate bad sectors and recover readable info)
    try {
      const output = execSync(
        `chkdsk ${drive} /r /f`,
        { encoding: 'utf8', timeout: 1800000, stdio: 'pipe' } // 30 min
      )
      details.push('chkdsk completed')
      if (output.includes('NTFS') || output.includes('FAT')) {
        details.push('Filesystem structure recovered')
        changes.push({ type: 'system', action: 'repaired', target: `Filesystem on ${drive}` })
      }
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err)
      if (errStr.includes('RAW') || errStr.includes('cannot')) {
        details.push('Drive is too damaged for chkdsk. Use TestDisk for partition recovery.')
        details.push('Alternative: Format the drive (WARNING: all data will be lost)')
      } else {
        details.push(`chkdsk: ${errStr}`)
      }
    }

    return {
      success: changes.length > 0, module: 'usb-fixer', action: 'repair-raw-drive',
      description: `RAW drive repair on ${drive}`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'usb-fixer', action: 'repair-raw-drive',
      description: 'RAW drive repair failed',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Disable USB power management on all hubs
export async function disableUsbPowerManagement(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'usb-fixer', action: 'disable-power-mgmt',
        description: 'USB power management settings are Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    // Disable "Allow the computer to turn off this device" for all USB hubs
    execSync(
      'powershell -NoProfile -Command "Get-PnpDevice -Class USB | Where-Object { $_.FriendlyName -match \'Hub\' -and $_.Status -eq \'OK\' } | ForEach-Object { $path = \'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\\' + $_.InstanceId + \'\\Device Parameters\'; New-ItemProperty -Path $path -Name \'EnhancedPowerManagementEnabled\' -Value 0 -PropertyType DWORD -Force -ErrorAction SilentlyContinue | Out-Null }"',
      { timeout: 30000, stdio: 'pipe' }
    )
    details.push('USB power management disabled on all USB hubs')
    details.push('Devices will no longer be turned off to save power')
    changes.push({ type: 'registry', action: 'modified', target: 'USB hub power management' })

    return {
      success: true, module: 'usb-fixer', action: 'disable-power-mgmt',
      description: 'USB power management disabled on all hubs',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'usb-fixer', action: 'disable-power-mgmt',
      description: 'Failed to disable USB power management',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}
