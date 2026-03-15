// ============================================================
// ByteFix Phase 2 — Display/Graphics Fixer Module
// Driver update/rollback, resolution fix, scaling fix, external display
// ============================================================

import { execSync, execFileSync } from 'child_process'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('display-fixer')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

function getGpuInfo(): { name: string; driver: string; driverDate: string; status: string; resolution: string }[] {
  const gpus: { name: string; driver: string; driverDate: string; status: string; resolution: string }[] = []

  try {
    if (isWin) {
      const output = execSync(
        'powershell -NoProfile -Command "Get-WmiObject Win32_VideoController | Select-Object Name, DriverVersion, DriverDate, Status, CurrentHorizontalResolution, CurrentVerticalResolution | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
      ).trim()
      if (output) {
        const parsed = JSON.parse(output)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const gpu of items) {
          gpus.push({
            name: String(gpu.Name || 'Unknown'),
            driver: String(gpu.DriverVersion || 'Unknown'),
            driverDate: String(gpu.DriverDate || 'Unknown'),
            status: String(gpu.Status || 'Unknown'),
            resolution: `${gpu.CurrentHorizontalResolution || '?'}x${gpu.CurrentVerticalResolution || '?'}`,
          })
        }
      }
    } else if (isMac) {
      const output = execFileSync('system_profiler', ['SPDisplaysDataType'], {
        encoding: 'utf8', timeout: 10000, stdio: 'pipe'
      })
      const gpuMatch = output.match(/Chipset Model:\s*(.+)/g) || []
      const resMatch = output.match(/Resolution:\s*(.+)/g) || []
      for (let i = 0; i < gpuMatch.length; i++) {
        gpus.push({
          name: gpuMatch[i].replace('Chipset Model:', '').trim(),
          driver: 'macOS built-in',
          driverDate: 'N/A',
          status: 'OK',
          resolution: resMatch[i] ? resMatch[i].replace('Resolution:', '').trim() : 'Unknown',
        })
      }
    } else {
      try {
        const output = execFileSync('lspci', ['-v'], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' })
        const vgaLines = output.match(/VGA compatible controller:.+/g) || []
        for (const line of vgaLines) {
          gpus.push({
            name: line.replace('VGA compatible controller:', '').trim(),
            driver: 'Linux',
            driverDate: 'N/A',
            status: 'OK',
            resolution: 'Unknown',
          })
        }
      } catch { /* lspci not available */ }
    }
  } catch (err) {
    logger.warn('Failed to get GPU info', err)
  }
  return gpus
}

function checkTdrEvents(): number {
  if (!isWin) return 0
  try {
    const output = execSync(
      'powershell -NoProfile -Command "(Get-WinEvent -FilterHashtable @{LogName=\'System\'; Id=4101} -MaxEvents 20 -ErrorAction SilentlyContinue).Count"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    return parseInt(output, 10) || 0
  } catch { return 0 }
}

function checkDisplayDevices(): { name: string; status: string; instanceId: string }[] {
  const devices: { name: string; status: string; instanceId: string }[] = []
  if (!isWin) return devices

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-PnpDevice -Class Display -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json"',
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
  } catch { /* no display devices */ }
  return devices
}

function checkMonitors(): { name: string; status: string }[] {
  const monitors: { name: string; status: string }[] = []
  if (!isWin) return monitors

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-PnpDevice -Class Monitor -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const mon of items) {
        monitors.push({
          name: String(mon.FriendlyName || 'Generic Monitor'),
          status: String(mon.Status || 'Unknown'),
        })
      }
    }
  } catch { /* no monitors */ }
  return monitors
}

export async function runDisplayDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    // 1. GPU information
    const gpus = getGpuInfo()
    if (gpus.length > 0) {
      for (const gpu of gpus) {
        results.push({
          id: `disp-gpu-${timestamp}-${results.length}`,
          module: 'display-fixer',
          category: 'Graphics Adapter',
          title: gpu.name,
          severity: gpu.status === 'OK' ? 'healthy' : 'warning',
          description: `Driver: ${gpu.driver}, Resolution: ${gpu.resolution}`,
          details: [
            `Name: ${gpu.name}`,
            `Driver Version: ${gpu.driver}`,
            `Driver Date: ${gpu.driverDate}`,
            `Status: ${gpu.status}`,
            `Resolution: ${gpu.resolution}`,
          ],
          fixAvailable: gpu.status !== 'OK',
          fixDescription: gpu.status !== 'OK' ? 'Reinstall display driver' : undefined,
          fixRisk: 'medium',
          autoFixable: false, // Display driver changes can render screen blank
          timestamp,
        })
      }
    } else {
      results.push({
        id: `disp-no-gpu-${timestamp}`,
        module: 'display-fixer',
        category: 'Graphics Adapter',
        title: 'No Graphics Adapter Detected',
        severity: 'error',
        description: 'No GPU or display adapter found',
        details: ['This may indicate a driver issue or disabled hardware'],
        fixAvailable: isWin,
        fixDescription: 'Scan for hardware changes',
        fixRisk: 'medium',
        autoFixable: false,
        timestamp,
      })
    }

    // 2. TDR (display driver crash) events
    if (isWin) {
      const tdrCount = checkTdrEvents()
      if (tdrCount > 0) {
        results.push({
          id: `disp-tdr-${timestamp}`,
          module: 'display-fixer',
          category: 'Driver Stability',
          title: `${tdrCount} Display Driver Crash(es) Detected`,
          severity: tdrCount > 5 ? 'error' : 'warning',
          description: `Found ${tdrCount} TDR (Timeout Detection and Recovery) events in system log`,
          details: [
            `${tdrCount} display driver crashes recorded`,
            'Symptoms: Screen flickering, brief blackouts, "Display driver stopped responding" messages',
            'Common causes: Outdated driver, overheating GPU, incompatible software',
          ],
          fixAvailable: true,
          fixDescription: 'Increase TDR timeout and reinstall display driver',
          fixRisk: 'medium',
          autoFixable: false,
          timestamp,
        })
      }

      // 3. Display devices with errors
      const devices = checkDisplayDevices()
      const errorDevices = devices.filter(d => d.status !== 'OK')
      if (errorDevices.length > 0) {
        results.push({
          id: `disp-dev-error-${timestamp}`,
          module: 'display-fixer',
          category: 'Display Devices',
          title: `${errorDevices.length} Display Device(s) with Errors`,
          severity: 'error',
          description: `Problem devices: ${errorDevices.map(d => d.name).join(', ')}`,
          details: errorDevices.map(d => `${d.name}: ${d.status}`),
          fixAvailable: true,
          fixDescription: 'Reinstall display drivers for problem devices',
          fixRisk: 'medium',
          autoFixable: false,
          timestamp,
        })
      }

      // 4. Connected monitors
      const monitors = checkMonitors()
      results.push({
        id: `disp-monitors-${timestamp}`,
        module: 'display-fixer',
        category: 'Monitors',
        title: `${monitors.length} Monitor(s) Connected`,
        severity: monitors.length > 0 ? 'info' : 'warning',
        description: monitors.length > 0
          ? monitors.map(m => m.name).join(', ')
          : 'No monitors detected',
        details: monitors.map(m => `${m.name}: ${m.status}`),
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp,
      })
    }
  } catch (err) {
    logger.error('Display diagnostics failed', err)
    results.push({
      id: `disp-error-${timestamp}`,
      module: 'display-fixer',
      category: 'Error',
      title: 'Display Diagnostics Error',
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

// Fix: Reinstall display drivers
export async function reinstallDisplayDrivers(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Remove and rescan display adapters
      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class Display -ErrorAction SilentlyContinue | ForEach-Object { pnputil /remove-device $_.InstanceId 2>$null }"',
        { timeout: 30000, stdio: 'pipe' }
      )
      details.push('Display drivers removed')

      execSync('pnputil /scan-devices', { timeout: 30000, stdio: 'pipe' })
      details.push('Hardware scan completed — drivers will be reinstalled from Windows driver store')
      details.push('NOTE: Screen may go blank briefly during driver installation')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'Display drivers' })
    } else if (isMac) {
      details.push('macOS manages display drivers automatically')
      details.push('If display issues persist, reset NVRAM: Shut down → Power on → Hold Option+Command+P+R for 20 seconds')
    } else {
      details.push('On Linux, reinstall GPU driver via package manager (nvidia-driver, mesa, etc.)')
    }

    return {
      success: true, module: 'display-fixer', action: 'reinstall-drivers',
      description: 'Display drivers reinstalled',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'display-fixer', action: 'reinstall-drivers',
      description: 'Failed to reinstall display drivers',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Increase TDR timeout (prevents display driver timeout crashes)
export async function fixTdrTimeout(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'display-fixer', action: 'fix-tdr',
        description: 'TDR settings are Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    execSync(
      'powershell -NoProfile -Command "Set-ItemProperty \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\' -Name \'TdrDelay\' -Value 8 -Type DWord -Force"',
      { timeout: 10000, stdio: 'pipe' }
    )
    details.push('TDR timeout increased to 8 seconds (default: 2)')
    details.push('This gives the GPU more time to respond before Windows resets the driver')
    changes.push({ type: 'registry', action: 'modified', target: 'TdrDelay' })

    return {
      success: true, module: 'display-fixer', action: 'fix-tdr',
      description: 'TDR timeout increased. Reboot required for changes to take effect.',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'display-fixer', action: 'fix-tdr',
      description: 'Failed to update TDR settings',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Disable hardware acceleration (fixes flickering on weak GPUs)
export async function disableHardwareAcceleration(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync(
        'powershell -NoProfile -Command "Set-ItemProperty \'HKCU:\\SOFTWARE\\Microsoft\\Avalon.Graphics\' -Name \'DisableHWAcceleration\' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('WPF hardware acceleration disabled')

      execSync(
        'powershell -NoProfile -Command "Set-ItemProperty \'HKCU:\\Control Panel\\Desktop\\WindowMetrics\' -Name \'MinAnimate\' -Value 0 -Force -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Window animations disabled')
      changes.push({ type: 'registry', action: 'modified', target: 'Hardware acceleration settings' })
    } else if (isMac) {
      details.push('On macOS, reduce transparency: System Preferences → Accessibility → Display → Reduce transparency')
    }

    return {
      success: true, module: 'display-fixer', action: 'disable-hw-accel',
      description: 'Hardware acceleration disabled to reduce flickering',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'display-fixer', action: 'disable-hw-accel',
      description: 'Failed to disable hardware acceleration',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Force detect external monitors
export async function detectExternalMonitors(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Try DisplaySwitch to extend
      try {
        execSync('DisplaySwitch.exe /extend', { timeout: 5000, stdio: 'pipe' })
        details.push('Display mode set to Extend')
      } catch {
        details.push('DisplaySwitch not available')
      }

      // Reinstall display adapters to force detection
      execSync('pnputil /scan-devices', { timeout: 30000, stdio: 'pipe' })
      details.push('Hardware scan completed')
      changes.push({ type: 'system', action: 'modified', target: 'Display detection' })

      details.push('If monitor still not detected:')
      details.push('  1. Try a different cable (HDMI/DP/USB-C)')
      details.push('  2. Check monitor input source selection')
      details.push('  3. Try Win+P keyboard shortcut to cycle display modes')
    } else if (isMac) {
      details.push('On macOS: Hold Option key → Click "Detect Displays" in System Preferences → Displays')
    }

    return {
      success: true, module: 'display-fixer', action: 'detect-monitors',
      description: 'External monitor detection triggered',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'display-fixer', action: 'detect-monitors',
      description: 'Failed to detect external monitors',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}
