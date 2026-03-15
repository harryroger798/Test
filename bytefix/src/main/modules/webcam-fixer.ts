// ============================================================
// ByteFix Phase 2 — Webcam/Camera Fixer Module
// Driver reinstall, privacy toggle, app permission repair
// ============================================================

import { execSync, execFileSync } from 'child_process'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('webcam-fixer')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

function listCameraDevices(): { name: string; status: string; deviceClass: string }[] {
  const devices: { name: string; status: string; deviceClass: string }[] = []

  try {
    if (isWin) {
      // Check Camera class
      const cameraOutput = execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class Camera -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      if (cameraOutput && cameraOutput !== '[]') {
        const parsed = JSON.parse(cameraOutput)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const dev of items) {
          devices.push({
            name: String(dev.FriendlyName || 'Unknown Camera'),
            status: String(dev.Status || 'Unknown'),
            deviceClass: 'Camera',
          })
        }
      }

      // Check Image class (some webcams register here)
      const imageOutput = execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class Image -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      if (imageOutput && imageOutput !== '[]') {
        const parsed = JSON.parse(imageOutput)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const dev of items) {
          devices.push({
            name: String(dev.FriendlyName || 'Unknown Imaging Device'),
            status: String(dev.Status || 'Unknown'),
            deviceClass: 'Image',
          })
        }
      }
    } else if (isMac) {
      const output = execFileSync('system_profiler', ['SPCameraDataType'], {
        encoding: 'utf8', timeout: 10000, stdio: 'pipe'
      })
      const cameraMatches = output.match(/^\s{4}\w.+:/gm) || []
      for (const match of cameraMatches) {
        devices.push({
          name: match.trim().replace(/:$/, ''),
          status: 'OK',
          deviceClass: 'Camera',
        })
      }
    } else {
      // Linux — check /dev/video*
      try {
        const output = execSync('ls /dev/video* 2>/dev/null', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
        const videoDevices = output.trim().split('\n').filter(Boolean)
        for (const dev of videoDevices) {
          devices.push({ name: dev, status: 'OK', deviceClass: 'Video' })
        }
      } catch { /* no video devices */ }
    }
  } catch (err) {
    logger.warn('Failed to list camera devices', err)
  }
  return devices
}

function checkCameraPrivacy(): { systemEnabled: boolean; userEnabled: boolean } {
  const result = { systemEnabled: true, userEnabled: true }
  if (!isWin) return result

  try {
    const sysOutput = execSync(
      'powershell -NoProfile -Command "(Get-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\' -Name Value -ErrorAction SilentlyContinue).Value"',
      { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
    ).trim()
    result.systemEnabled = sysOutput === 'Allow'
  } catch { /* registry key may not exist */ }

  try {
    const userOutput = execSync(
      'powershell -NoProfile -Command "(Get-ItemProperty \'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\' -Name Value -ErrorAction SilentlyContinue).Value"',
      { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
    ).trim()
    result.userEnabled = userOutput === 'Allow'
  } catch { /* registry key may not exist */ }

  return result
}

function checkConflictingApps(): string[] {
  const conflicts: string[] = []
  if (!isWin) return conflicts

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -match \'Zoom|Teams|Meet|Skype|Camera|OBS|Discord\' } | Select-Object Name, Id | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output && output !== '[]') {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const proc of items) {
        conflicts.push(`${proc.Name} (PID: ${proc.Id})`)
      }
    }
  } catch { /* no conflicts */ }
  return conflicts
}

export async function runWebcamDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    // 1. List camera devices
    const devices = listCameraDevices()
    const errorDevices = devices.filter(d => d.status !== 'OK')

    if (devices.length === 0) {
      results.push({
        id: `cam-none-${timestamp}`,
        module: 'webcam-fixer',
        category: 'Camera Hardware',
        title: 'No Camera Detected',
        severity: 'error',
        description: 'No webcam or camera device found on this system',
        details: [
          'No camera devices detected in Device Manager',
          'Check if camera is disabled in BIOS/UEFI settings',
          'Check for physical camera shutter switch (common on Lenovo ThinkPads)',
          'USB webcam may need to be reconnected',
        ],
        fixAvailable: isWin,
        fixDescription: 'Scan for hardware changes to detect camera',
        fixRisk: 'low',
        autoFixable: true,
        timestamp,
      })
    } else if (errorDevices.length > 0) {
      results.push({
        id: `cam-error-${timestamp}`,
        module: 'webcam-fixer',
        category: 'Camera Hardware',
        title: `${errorDevices.length} Camera(s) with Errors`,
        severity: 'error',
        description: `Problem cameras: ${errorDevices.map(d => d.name).join(', ')}`,
        details: errorDevices.map(d => `${d.name}: ${d.status} (${d.deviceClass})`),
        fixAvailable: true,
        fixDescription: 'Reinstall camera drivers',
        fixRisk: 'low',
        autoFixable: true,
        timestamp,
      })
    } else {
      results.push({
        id: `cam-ok-${timestamp}`,
        module: 'webcam-fixer',
        category: 'Camera Hardware',
        title: `${devices.length} Camera(s) Detected`,
        severity: 'healthy',
        description: devices.map(d => d.name).join(', '),
        details: devices.map(d => `${d.name}: ${d.status} (${d.deviceClass})`),
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp,
      })
    }

    // 2. Check camera privacy (Windows)
    if (isWin) {
      const privacy = checkCameraPrivacy()
      if (!privacy.systemEnabled || !privacy.userEnabled) {
        results.push({
          id: `cam-privacy-${timestamp}`,
          module: 'webcam-fixer',
          category: 'Privacy Settings',
          title: 'Camera Access Blocked',
          severity: 'warning',
          description: `Camera privacy: System=${privacy.systemEnabled ? 'Allowed' : 'BLOCKED'}, User=${privacy.userEnabled ? 'Allowed' : 'BLOCKED'}`,
          details: [
            'Camera access is blocked by Windows privacy settings',
            'Apps cannot use the camera until privacy settings are changed',
            'This is a common issue after Windows updates',
          ],
          fixAvailable: true,
          fixDescription: 'Enable camera access in privacy settings',
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      }
    }

    // 3. Check for conflicting apps
    const conflicts = checkConflictingApps()
    if (conflicts.length > 1) {
      results.push({
        id: `cam-conflicts-${timestamp}`,
        module: 'webcam-fixer',
        category: 'App Conflicts',
        title: 'Multiple Apps Using Camera',
        severity: 'warning',
        description: `${conflicts.length} apps may be competing for camera access`,
        details: [
          'Multiple camera-using applications detected:',
          ...conflicts,
          'Only one app can use the camera at a time',
          'Close other apps to fix black screen in video calls',
        ],
        fixAvailable: true,
        fixDescription: 'Close conflicting camera applications',
        fixRisk: 'low',
        autoFixable: false,
        timestamp,
      })
    }
  } catch (err) {
    logger.error('Webcam diagnostics failed', err)
    results.push({
      id: `cam-diag-error-${timestamp}`,
      module: 'webcam-fixer',
      category: 'Error',
      title: 'Webcam Diagnostics Error',
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

// Fix: Enable camera privacy
export async function enableCameraPrivacy(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      if (isMac) {
        try {
          execSync('tccutil reset Camera 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
          details.push('Camera privacy reset for all apps (macOS TCC)')
          changes.push({ type: 'system', action: 'modified', target: 'Camera TCC permissions' })
          return {
            success: true, module: 'webcam-fixer', action: 'enable-camera-privacy',
            description: 'Camera permissions reset on macOS', details, changes, rollbackAvailable: false
          }
        } catch {
          return {
            success: false, module: 'webcam-fixer', action: 'enable-camera-privacy',
            description: 'Failed to reset camera permissions',
            details: ['tccutil not available'], changes, rollbackAvailable: false, error: 'macOS tccutil failed'
          }
        }
      }
      return {
        success: false, module: 'webcam-fixer', action: 'enable-camera-privacy',
        description: 'Camera privacy settings management varies by OS',
        details: [], changes: [], rollbackAvailable: false, error: 'Not supported'
      }
    }

    // Enable system-wide
    execSync(
      'powershell -NoProfile -Command "Set-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\' -Name Value -Value \'Allow\' -Force"',
      { timeout: 10000, stdio: 'pipe' }
    )
    details.push('System-wide camera access enabled')

    // Enable per-user
    execSync(
      'powershell -NoProfile -Command "Set-ItemProperty \'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\' -Name Value -Value \'Allow\' -Force"',
      { timeout: 10000, stdio: 'pipe' }
    )
    details.push('User-level camera access enabled')
    changes.push({ type: 'registry', action: 'modified', target: 'Camera privacy settings' })

    return {
      success: true, module: 'webcam-fixer', action: 'enable-camera-privacy',
      description: 'Camera access enabled in Windows privacy settings',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'webcam-fixer', action: 'enable-camera-privacy',
      description: 'Failed to enable camera privacy',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Reinstall camera drivers
export async function reinstallCameraDrivers(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Remove camera and image devices
      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class Camera, Image -ErrorAction SilentlyContinue | ForEach-Object { pnputil /remove-device $_.InstanceId 2>$null }"',
        { timeout: 30000, stdio: 'pipe' }
      )
      details.push('Camera drivers removed')

      // Rescan for hardware
      execSync('pnputil /scan-devices', { timeout: 30000, stdio: 'pipe' })
      details.push('Hardware scan completed — camera drivers will be reinstalled')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'Camera drivers' })

      // Reset Camera UWP app
      try {
        execSync(
          'powershell -NoProfile -Command "Get-AppxPackage *WindowsCamera* -ErrorAction SilentlyContinue | Reset-AppxPackage -ErrorAction SilentlyContinue"',
          { timeout: 15000, stdio: 'pipe' }
        )
        details.push('Windows Camera app reset')
      } catch {
        details.push('Windows Camera app reset skipped (not available)')
      }
    } else if (isMac) {
      execSync('sudo killall VDCAssistant 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      execSync('sudo killall AppleCameraAssistant 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      details.push('Camera processes restarted (VDCAssistant, AppleCameraAssistant)')
      changes.push({ type: 'service', action: 'restarted', target: 'Camera services' })
    } else {
      // Linux — reload UVC driver
      try {
        execSync('sudo modprobe -r uvcvideo 2>/dev/null && sudo modprobe uvcvideo 2>/dev/null', {
          timeout: 10000, stdio: 'pipe'
        })
        details.push('UVC camera driver reloaded')
        changes.push({ type: 'driver', action: 'reloaded', target: 'uvcvideo' })
      } catch {
        details.push('Could not reload camera driver')
      }
    }

    return {
      success: true, module: 'webcam-fixer', action: 'reinstall-drivers',
      description: 'Camera drivers reinstalled',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'webcam-fixer', action: 'reinstall-drivers',
      description: 'Failed to reinstall camera drivers',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Power-cycle camera (disable/enable)
export async function powerCycleCamera(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class Camera -ErrorAction SilentlyContinue | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Camera disabled')

      // Wait 2 seconds
      execSync('powershell -NoProfile -Command "Start-Sleep 2"', { timeout: 5000, stdio: 'pipe' })

      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class Camera -ErrorAction SilentlyContinue | Enable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Camera re-enabled')
      changes.push({ type: 'device', action: 'power-cycled', target: 'Camera' })
    } else if (isMac) {
      execSync('sudo killall VDCAssistant 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      details.push('Camera process restarted')
      changes.push({ type: 'service', action: 'restarted', target: 'VDCAssistant' })
    }

    return {
      success: true, module: 'webcam-fixer', action: 'power-cycle',
      description: 'Camera power-cycled (disabled and re-enabled)',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'webcam-fixer', action: 'power-cycle',
      description: 'Failed to power-cycle camera',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}
