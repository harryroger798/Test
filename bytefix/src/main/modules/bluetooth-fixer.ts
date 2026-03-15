// ============================================================
// ByteFix Phase 2 — Bluetooth Fixer Module
// Service reset, cache clear, driver reinstall, profile repair
// ============================================================

import { execSync, execFileSync } from 'child_process'
import { platform, tmpdir } from 'os'
import { join } from 'path'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('bluetooth-fixer')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

const SERVICE_STATUS_MAP: Record<number, string> = {
  1: 'Stopped', 2: 'StartPending', 3: 'StopPending',
  4: 'Running', 5: 'ContinuePending', 6: 'PausePending', 7: 'Paused'
}
const START_TYPE_MAP: Record<number, string> = {
  0: 'Boot', 1: 'System', 2: 'Automatic', 3: 'Manual', 4: 'Disabled'
}

function checkBluetoothService(): { running: boolean; startType: string } {
  if (!isWin) return { running: true, startType: 'Unknown' }
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-Service bthserv -ErrorAction SilentlyContinue | Select-Object Status, StartType | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const svc = JSON.parse(output)
      return {
        running: svc.Status === 4,
        startType: START_TYPE_MAP[svc.StartType] || String(svc.StartType || 'Unknown'),
      }
    }
  } catch { /* service not found */ }
  return { running: false, startType: 'NotFound' }
}

function listBluetoothDevices(): { name: string; status: string; instanceId: string }[] {
  const devices: { name: string; status: string; instanceId: string }[] = []
  if (!isWin) return devices

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const dev of items) {
        devices.push({
          name: String(dev.FriendlyName || 'Unknown'),
          status: String(dev.Status || 'Unknown'),
          instanceId: String(dev.InstanceId || ''),
        })
      }
    }
  } catch (err) {
    logger.warn('Failed to list Bluetooth devices', err)
  }
  return devices
}

function checkFlightMode(): boolean {
  if (!isWin) return false
  try {
    const output = execSync(
      'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\RadioManagement\\SystemRadioState" /ve 2>nul',
      { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
    ).trim()
    // reg query output format: "(Default)    REG_DWORD    0x1"
    return /0x0*1\s*$/.test(output)
  } catch { return false }
}

function checkMacBluetooth(): { power: boolean; available: boolean } {
  const result = { power: false, available: false }
  if (!isMac) return result

  try {
    const output = execFileSync('system_profiler', ['SPBluetoothDataType'], {
      encoding: 'utf8', timeout: 10000, stdio: 'pipe'
    })
    result.available = !output.includes('No information found')
    result.power = output.includes('State: On') || output.includes('Bluetooth Power: On')
  } catch { /* not available */ }
  return result
}

export async function runBluetoothDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    if (isWin) {
      // 1. Check Bluetooth service
      const svc = checkBluetoothService()
      if (!svc.running) {
        results.push({
          id: `bt-svc-${timestamp}`,
          module: 'bluetooth-fixer',
          category: 'Bluetooth Service',
          title: 'Bluetooth Service Not Running',
          severity: 'error',
          description: `Bluetooth service is stopped (StartType: ${svc.startType})`,
          details: ['Bluetooth Support Service (bthserv) is not running', 'Bluetooth will not function without this service'],
          fixAvailable: true,
          fixDescription: 'Start Bluetooth service and set to Automatic',
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      } else {
        results.push({
          id: `bt-svc-${timestamp}`,
          module: 'bluetooth-fixer',
          category: 'Bluetooth Service',
          title: 'Bluetooth Service Running',
          severity: 'healthy',
          description: 'Bluetooth Support Service is active',
          details: [`Status: Running, StartType: ${svc.startType}`],
          fixAvailable: svc.startType !== 'Automatic',
          fixDescription: svc.startType !== 'Automatic' ? 'Set service to start automatically' : undefined,
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      }

      // 2. Check flight mode
      if (checkFlightMode()) {
        results.push({
          id: `bt-flight-${timestamp}`,
          module: 'bluetooth-fixer',
          category: 'Radio State',
          title: 'Airplane Mode is ON',
          severity: 'warning',
          description: 'Airplane mode is enabled, which disables Bluetooth and WiFi',
          details: ['Turn off Airplane mode to restore Bluetooth functionality'],
          fixAvailable: false,
          fixDescription: 'Airplane mode must be disabled from Windows Settings or keyboard shortcut',
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }

      // 3. List Bluetooth devices
      const devices = listBluetoothDevices()
      const errorDevices = devices.filter(d => d.status !== 'OK')
      const adapters = devices.filter(d => /radio|adapter|controller/i.test(d.name))

      if (adapters.length === 0 && devices.length === 0) {
        results.push({
          id: `bt-no-adapter-${timestamp}`,
          module: 'bluetooth-fixer',
          category: 'Hardware',
          title: 'No Bluetooth Adapter Found',
          severity: 'error',
          description: 'No Bluetooth hardware detected. Adapter may be disabled in BIOS or physically absent.',
          details: [
            'Check BIOS/UEFI settings for Bluetooth enable/disable',
            'Check Device Manager for hidden Bluetooth devices',
            'External USB Bluetooth adapter may be needed',
          ],
          fixAvailable: true,
          fixDescription: 'Scan for hardware changes and reinstall drivers',
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      } else {
        results.push({
          id: `bt-devices-${timestamp}`,
          module: 'bluetooth-fixer',
          category: 'Devices',
          title: `${devices.length} Bluetooth Device(s) Found`,
          severity: errorDevices.length > 0 ? 'warning' : 'healthy',
          description: errorDevices.length > 0
            ? `${errorDevices.length} device(s) with errors`
            : 'All Bluetooth devices functioning normally',
          details: devices.map(d => `${d.name}: ${d.status}`),
          fixAvailable: errorDevices.length > 0,
          fixDescription: errorDevices.length > 0 ? 'Reinstall problematic Bluetooth devices' : undefined,
          fixRisk: 'medium',
          autoFixable: true,
          timestamp,
        })
      }
    } else if (isMac) {
      const bt = checkMacBluetooth()
      results.push({
        id: `bt-mac-${timestamp}`,
        module: 'bluetooth-fixer',
        category: 'Bluetooth Status',
        title: bt.available ? (bt.power ? 'Bluetooth Active' : 'Bluetooth Off') : 'Bluetooth Not Available',
        severity: !bt.available ? 'error' : !bt.power ? 'warning' : 'healthy',
        description: bt.available
          ? (bt.power ? 'Bluetooth is on and functioning' : 'Bluetooth is available but turned off')
          : 'No Bluetooth hardware found',
        details: [`Available: ${bt.available}`, `Power: ${bt.power}`],
        fixAvailable: bt.available && !bt.power,
        fixDescription: 'Turn on Bluetooth',
        fixRisk: 'low',
        autoFixable: true,
        timestamp,
      })
    } else {
      // Linux
      try {
        const output = execFileSync('bluetoothctl', ['show'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
        const powered = output.includes('Powered: yes')
        results.push({
          id: `bt-linux-${timestamp}`,
          module: 'bluetooth-fixer',
          category: 'Bluetooth Status',
          title: powered ? 'Bluetooth Active' : 'Bluetooth Off',
          severity: powered ? 'healthy' : 'warning',
          description: powered ? 'Bluetooth adapter is powered on' : 'Bluetooth adapter is powered off',
          details: [output.trim()],
          fixAvailable: !powered,
          fixDescription: 'Power on Bluetooth adapter',
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      } catch {
        results.push({
          id: `bt-linux-${timestamp}`,
          module: 'bluetooth-fixer',
          category: 'Bluetooth Status',
          title: 'Bluetooth Not Available',
          severity: 'error',
          description: 'bluetoothctl not found or no Bluetooth adapter detected',
          details: [],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }
    }
  } catch (err) {
    logger.error('Bluetooth diagnostics failed', err)
    results.push({
      id: `bt-error-${timestamp}`,
      module: 'bluetooth-fixer',
      category: 'Error',
      title: 'Bluetooth Diagnostics Error',
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

export async function restartBluetoothService(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync(
        'powershell -NoProfile -Command "Set-Service bthserv -StartupType Automatic; Restart-Service bthserv -Force"',
        { timeout: 15000, stdio: 'pipe' }
      )
      details.push('Bluetooth service restarted and set to Automatic')
      changes.push({ type: 'service', action: 'restarted', target: 'bthserv' })
    } else if (isMac) {
      try {
        execSync('osascript -e \'do shell script "killall bluetoothd" with administrator privileges\' 2>/dev/null', { timeout: 30000, stdio: 'pipe' })
        details.push('Bluetooth daemon restarted')
        changes.push({ type: 'service', action: 'restarted', target: 'bluetoothd' })
      } catch {
        details.push('Could not restart Bluetooth - administrator privileges required')
      }
    } else {
      try {
        execFileSync('pkexec', ['systemctl', 'restart', 'bluetooth'], { timeout: 30000, stdio: 'pipe' })
        details.push('Bluetooth service restarted')
        changes.push({ type: 'service', action: 'restarted', target: 'bluetooth' })
      } catch {
        details.push('Could not restart Bluetooth - elevated privileges required')
      }
    }

    return {
      success: true, module: 'bluetooth-fixer', action: 'restart-service',
      description: 'Bluetooth service restarted',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'bluetooth-fixer', action: 'restart-service',
      description: 'Failed to restart Bluetooth service',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

export async function clearBluetoothCache(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Stop service first
      execSync(
        'powershell -NoProfile -Command "Stop-Service bthserv -Force -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Bluetooth service stopped')

      // Backup before clearing
      try {
        const backupPath = join(tmpdir(), `bytefix-bt-backup-${Date.now()}.reg`)
        execSync(
          `reg export "HKLM\\SYSTEM\\CurrentControlSet\\Services\\BTHPORT\\Parameters\\Devices" "${backupPath}" /y 2>nul`,
          { timeout: 10000, stdio: 'pipe' }
        )
        details.push(`Backup saved to ${backupPath}`)
      } catch {
        details.push('Could not backup existing pairings (may not exist)')
      }

      execSync(
        'powershell -NoProfile -Command "Remove-Item \'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\BTHPORT\\Parameters\\Devices\\*\' -Recurse -Force -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Bluetooth device cache cleared')
      details.push('WARNING: All paired devices have been removed. They will need to be re-paired.')
      changes.push({ type: 'registry', action: 'cleared', target: 'Bluetooth device cache' })

      execSync(
        'powershell -NoProfile -Command "Start-Service bthserv"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Bluetooth service restarted')
    } else if (isMac) {
      try {
        execSync('osascript -e \'do shell script "defaults delete /Library/Preferences/com.apple.Bluetooth" with administrator privileges\' 2>/dev/null', { timeout: 30000, stdio: 'pipe' })
        execSync('osascript -e \'do shell script "killall bluetoothd" with administrator privileges\' 2>/dev/null', { timeout: 30000, stdio: 'pipe' })
        details.push('Bluetooth preferences and cache cleared')
        details.push('WARNING: All paired devices removed')
        changes.push({ type: 'file', action: 'cleared', target: 'Bluetooth preferences' })
      } catch {
        details.push('Could not clear Bluetooth cache - administrator privileges required')
      }
    } else {
      try {
        // Remove only contents, not the directory itself — preserves /var/lib/bluetooth for the service
        // Use find -delete instead of sh -c to avoid granting a root shell via pkexec
        execFileSync('pkexec', ['find', '/var/lib/bluetooth/', '-mindepth', '1', '-delete'], { timeout: 30000, stdio: 'pipe' })
        execFileSync('pkexec', ['systemctl', 'restart', 'bluetooth'], { timeout: 30000, stdio: 'pipe' })
        details.push('Bluetooth cache cleared and service restarted')
        changes.push({ type: 'file', action: 'cleared', target: '/var/lib/bluetooth' })
      } catch {
        details.push('Could not clear Bluetooth cache - elevated privileges required')
      }
    }

    return {
      success: true, module: 'bluetooth-fixer', action: 'clear-cache',
      description: 'Bluetooth cache cleared. All devices must be re-paired.',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'bluetooth-fixer', action: 'clear-cache',
      description: 'Failed to clear Bluetooth cache',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

export async function reinstallBluetoothDrivers(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match \'Radio|Adapter\' } | ForEach-Object { pnputil /remove-device $_.InstanceId 2>$null }"',
        { timeout: 30000, stdio: 'pipe' }
      )
      details.push('Bluetooth adapter drivers removed')

      execSync('pnputil /scan-devices', { timeout: 30000, stdio: 'pipe' })
      details.push('Hardware scan completed — drivers will be reinstalled')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'Bluetooth adapter' })
    } else if (isMac) {
      try {
        execSync('osascript -e \'do shell script "kextload -b com.apple.iokit.BroadcomBluetoothHostControllerUSBTransport" with administrator privileges\' 2>/dev/null', {
          timeout: 30000, stdio: 'pipe'
        })
        details.push('Bluetooth kernel extension reloaded')
        changes.push({ type: 'driver', action: 'reloaded', target: 'Bluetooth kext' })
      } catch {
        details.push('Could not reload Bluetooth driver - administrator privileges required')
      }
    } else {
      try {
        execFileSync('pkexec', ['sh', '-c', 'modprobe -r btusb && modprobe btusb'], {
          timeout: 30000, stdio: 'pipe'
        })
        details.push('Bluetooth USB driver reloaded')
        changes.push({ type: 'driver', action: 'reloaded', target: 'btusb' })
      } catch {
        details.push('Could not reload Bluetooth driver - elevated privileges required')
      }
    }

    return {
      success: true, module: 'bluetooth-fixer', action: 'reinstall-drivers',
      description: 'Bluetooth drivers reinstalled. Reboot may be required.',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'bluetooth-fixer', action: 'reinstall-drivers',
      description: 'Failed to reinstall Bluetooth drivers',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix choppy Bluetooth audio
export async function fixBluetoothAudio(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Disable Hands-Free Telephony (force A2DP high-quality audio)
      try {
        execSync(
          'powershell -NoProfile -Command "Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match \'Hands-Free\' } | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"',
          { timeout: 10000, stdio: 'pipe' }
        )
        details.push('Disabled Hands-Free Audio profile (forces high-quality A2DP)')
        changes.push({ type: 'device', action: 'disabled', target: 'Hands-Free AG Audio' })
      } catch {
        details.push('No Hands-Free profile found to disable')
      }

      // Disable Absolute Volume
      execSync(
        'powershell -NoProfile -Command "New-ItemProperty -Path \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Bluetooth\\Audio\\AVRCP\\CT\' -Name \'DisableAbsoluteVolume\' -Value 1 -PropertyType DWORD -Force -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Disabled Bluetooth Absolute Volume (fixes volume sync issues)')
      changes.push({ type: 'registry', action: 'modified', target: 'Bluetooth Absolute Volume' })
    } else if (isMac) {
      execSync(
        'defaults write com.apple.BluetoothAudioAgent "Apple Bitpool Min (editable)" -int 53 2>/dev/null',
        { timeout: 5000, stdio: 'pipe' }
      )
      execSync('osascript -e \'do shell script "killall coreaudiod" with administrator privileges\' 2>/dev/null', { timeout: 30000, stdio: 'pipe' })
      details.push('Increased Bluetooth audio bitpool for better quality')
      details.push('Core Audio restarted')
      changes.push({ type: 'system', action: 'modified', target: 'Bluetooth audio bitpool' })
    }

    return {
      success: true, module: 'bluetooth-fixer', action: 'fix-bt-audio',
      description: 'Bluetooth audio quality settings optimized',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'bluetooth-fixer', action: 'fix-bt-audio',
      description: 'Failed to fix Bluetooth audio',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}
