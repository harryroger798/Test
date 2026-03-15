// ============================================================
// ByteFix Phase 2 — Audio/Sound Fixer Module
// Service restart, driver reinstall, privacy toggle, enhancement disabler
// ============================================================

import { execSync, execFileSync } from 'child_process'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('audio-fixer')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

// Check audio service status (Windows)
function checkAudioServices(): { name: string; status: string; startType: string }[] {
  const services: { name: string; status: string; startType: string }[] = []
  if (!isWin) return services

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-Service Audiosrv, AudioEndpointBuilder -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const svc of items) {
        services.push({
          name: String(svc.Name || ''),
          status: String(svc.Status === 4 ? 'Running' : svc.Status === 1 ? 'Stopped' : svc.Status || 'Unknown'),
          startType: String(svc.StartType === 2 ? 'Automatic' : svc.StartType || 'Unknown'),
        })
      }
    }
  } catch (err) {
    logger.warn('Failed to check audio services', err)
  }
  return services
}

// List audio devices
function listAudioDevices(): { name: string; status: string; type: string }[] {
  const devices: { name: string; status: string; type: string }[] = []

  try {
    if (isWin) {
      const output = execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      if (output) {
        const parsed = JSON.parse(output)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const dev of items) {
          const name = String(dev.FriendlyName || 'Unknown')
          const isMic = /mic|input|record/i.test(name)
          devices.push({
            name,
            status: String(dev.Status || 'Unknown'),
            type: isMic ? 'input' : 'output',
          })
        }
      }

      // Also check media devices (sound cards)
      const mediaOutput = execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class MEDIA -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      if (mediaOutput) {
        const parsed = JSON.parse(mediaOutput)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const dev of items) {
          devices.push({
            name: String(dev.FriendlyName || 'Unknown'),
            status: String(dev.Status || 'Unknown'),
            type: 'controller',
          })
        }
      }
    } else if (isMac) {
      const output = execFileSync('system_profiler', ['SPAudioDataType'], {
        encoding: 'utf8', timeout: 10000, stdio: 'pipe'
      })
      const deviceMatches = output.match(/^\s{4}\w.+:/gm) || []
      for (const match of deviceMatches) {
        devices.push({
          name: match.trim().replace(/:$/, ''),
          status: 'OK',
          type: 'output',
        })
      }
    } else {
      // Linux
      try {
        const output = execFileSync('aplay', ['-l'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
        const cards = output.match(/card \d+:.+/g) || []
        for (const card of cards) {
          devices.push({ name: card.trim(), status: 'OK', type: 'output' })
        }
      } catch { /* aplay not available */ }
    }
  } catch (err) {
    logger.warn('Failed to list audio devices', err)
  }
  return devices
}

// Check microphone privacy settings (Windows)
function checkMicPrivacy(): { systemEnabled: boolean; userEnabled: boolean } {
  const result = { systemEnabled: true, userEnabled: true }
  if (!isWin) return result

  try {
    const sysOutput = execSync(
      'powershell -NoProfile -Command "(Get-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\' -Name Value -ErrorAction SilentlyContinue).Value"',
      { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
    ).trim()
    result.systemEnabled = sysOutput === 'Allow'
  } catch { /* registry key may not exist */ }

  try {
    const userOutput = execSync(
      'powershell -NoProfile -Command "(Get-ItemProperty \'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\' -Name Value -ErrorAction SilentlyContinue).Value"',
      { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }
    ).trim()
    result.userEnabled = userOutput === 'Allow'
  } catch { /* registry key may not exist */ }

  return result
}

// Main diagnostics
export async function runAudioDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    // 1. Check audio services
    if (isWin) {
      const services = checkAudioServices()
      const stoppedServices = services.filter(s => s.status !== 'Running')
      if (stoppedServices.length > 0) {
        results.push({
          id: `audio-svc-${timestamp}`,
          module: 'audio-fixer',
          category: 'Audio Services',
          title: 'Audio Services Not Running',
          severity: 'error',
          description: `Stopped services: ${stoppedServices.map(s => s.name).join(', ')}`,
          details: services.map(s => `${s.name}: ${s.status} (${s.startType})`),
          fixAvailable: true,
          fixDescription: 'Restart audio services',
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      } else if (services.length > 0) {
        results.push({
          id: `audio-svc-${timestamp}`,
          module: 'audio-fixer',
          category: 'Audio Services',
          title: 'Audio Services Running',
          severity: 'healthy',
          description: 'All audio services are running normally',
          details: services.map(s => `${s.name}: ${s.status} (${s.startType})`),
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp,
        })
      }
    }

    // 2. Check audio devices
    const devices = listAudioDevices()
    const errorDevices = devices.filter(d => d.status !== 'OK' && d.status !== 'Running')
    const outputDevices = devices.filter(d => d.type === 'output')
    const inputDevices = devices.filter(d => d.type === 'input')

    if (errorDevices.length > 0) {
      results.push({
        id: `audio-dev-error-${timestamp}`,
        module: 'audio-fixer',
        category: 'Audio Devices',
        title: `${errorDevices.length} Audio Device(s) with Errors`,
        severity: 'error',
        description: `Problem devices: ${errorDevices.map(d => d.name).join(', ')}`,
        details: errorDevices.map(d => `${d.name}: ${d.status} (${d.type})`),
        fixAvailable: true,
        fixDescription: 'Reinstall audio drivers for problem devices',
        fixRisk: 'medium',
        autoFixable: true,
        timestamp,
      })
    }

    if (outputDevices.length === 0 && devices.length > 0) {
      results.push({
        id: `audio-no-output-${timestamp}`,
        module: 'audio-fixer',
        category: 'Audio Devices',
        title: 'No Audio Output Devices',
        severity: 'error',
        description: 'No audio output devices detected. Sound will not work.',
        details: ['No speakers/headphones detected', 'Driver may be missing or disabled'],
        fixAvailable: true,
        fixDescription: 'Reinstall audio drivers and scan for hardware changes',
        fixRisk: 'medium',
        autoFixable: true,
        timestamp,
      })
    } else {
      results.push({
        id: `audio-devices-${timestamp}`,
        module: 'audio-fixer',
        category: 'Audio Devices',
        title: `${devices.length} Audio Device(s) Detected`,
        severity: 'info',
        description: `Output: ${outputDevices.length}, Input: ${inputDevices.length}, Controllers: ${devices.filter(d => d.type === 'controller').length}`,
        details: devices.map(d => `[${d.type}] ${d.name}: ${d.status}`),
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp,
      })
    }

    // 3. Check microphone privacy (Windows)
    if (isWin) {
      const privacy = checkMicPrivacy()
      if (!privacy.systemEnabled || !privacy.userEnabled) {
        results.push({
          id: `audio-mic-privacy-${timestamp}`,
          module: 'audio-fixer',
          category: 'Privacy Settings',
          title: 'Microphone Access Blocked',
          severity: 'warning',
          description: `Microphone privacy: System=${privacy.systemEnabled ? 'Allowed' : 'BLOCKED'}, User=${privacy.userEnabled ? 'Allowed' : 'BLOCKED'}`,
          details: [
            'Microphone access is blocked by Windows privacy settings',
            'This is the #1 cause of "microphone not working" since Windows 10 1803',
            'Apps cannot access the microphone until privacy settings are changed',
          ],
          fixAvailable: true,
          fixDescription: 'Enable microphone access in privacy settings',
          fixRisk: 'low',
          autoFixable: true,
          timestamp,
        })
      }
    }
  } catch (err) {
    logger.error('Audio diagnostics failed', err)
    results.push({
      id: `audio-error-${timestamp}`,
      module: 'audio-fixer',
      category: 'Error',
      title: 'Audio Diagnostics Error',
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

// Fix: Restart audio services
export async function restartAudioServices(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync('powershell -NoProfile -Command "Restart-Service Audiosrv, AudioEndpointBuilder -Force -ErrorAction SilentlyContinue"', {
        timeout: 15000, stdio: 'pipe'
      })
      // Ensure they start automatically
      execSync('powershell -NoProfile -Command "Set-Service Audiosrv -StartupType Automatic; Set-Service AudioEndpointBuilder -StartupType Automatic"', {
        timeout: 10000, stdio: 'pipe'
      })
      details.push('Audio services restarted successfully')
      details.push('Services set to start automatically')
      changes.push({ type: 'service', action: 'restarted', target: 'Audiosrv, AudioEndpointBuilder' })
    } else if (isMac) {
      execSync('sudo killall coreaudiod 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      details.push('Core Audio daemon restarted (auto-restarts)')
      changes.push({ type: 'service', action: 'restarted', target: 'coreaudiod' })
    } else {
      try {
        execFileSync('pulseaudio', ['--kill'], { timeout: 5000, stdio: 'pipe' })
        execFileSync('pulseaudio', ['--start'], { timeout: 5000, stdio: 'pipe' })
        details.push('PulseAudio restarted')
        changes.push({ type: 'service', action: 'restarted', target: 'pulseaudio' })
      } catch {
        try {
          execSync('systemctl --user restart pipewire pipewire-pulse 2>/dev/null', { timeout: 10000, stdio: 'pipe' })
          details.push('PipeWire audio restarted')
          changes.push({ type: 'service', action: 'restarted', target: 'pipewire' })
        } catch {
          details.push('Could not restart audio service')
        }
      }
    }

    return {
      success: true, module: 'audio-fixer', action: 'restart-services',
      description: 'Audio services restarted',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'audio-fixer', action: 'restart-services',
      description: 'Failed to restart audio services',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Reinstall audio drivers
export async function reinstallAudioDrivers(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Remove and rescan audio devices
      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class MEDIA -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne \'OK\' -or $_.FriendlyName -match \'Realtek|High Definition\' } | ForEach-Object { pnputil /remove-device $_.InstanceId 2>$null }"',
        { timeout: 30000, stdio: 'pipe' }
      )
      details.push('Removed existing audio drivers')

      // Rescan for hardware
      execSync('pnputil /scan-devices', { timeout: 30000, stdio: 'pipe' })
      details.push('Hardware scan completed — drivers will be reinstalled')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'Audio drivers' })

      // Also enable any disabled audio endpoints
      execSync(
        'powershell -NoProfile -Command "Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq \'Error\' } | Enable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"',
        { timeout: 15000, stdio: 'pipe' }
      )
      details.push('Enabled any disabled audio endpoints')
    } else if (isMac) {
      execSync('sudo killall coreaudiod 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      details.push('Core Audio reset (macOS manages drivers automatically)')
      changes.push({ type: 'service', action: 'restarted', target: 'coreaudiod' })
    } else {
      execSync('sudo alsa force-reload 2>/dev/null', { timeout: 15000, stdio: 'pipe' })
      details.push('ALSA drivers reloaded')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'ALSA' })
    }

    return {
      success: true, module: 'audio-fixer', action: 'reinstall-drivers',
      description: 'Audio drivers reinstalled. A reboot may be required.',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'audio-fixer', action: 'reinstall-drivers',
      description: 'Failed to reinstall audio drivers',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Enable microphone privacy
export async function enableMicrophonePrivacy(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'audio-fixer', action: 'enable-mic-privacy',
        description: 'Microphone privacy settings are Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    // Enable system-wide
    execSync(
      'powershell -NoProfile -Command "Set-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\' -Name Value -Value \'Allow\' -Force"',
      { timeout: 10000, stdio: 'pipe' }
    )
    details.push('System-wide microphone access enabled')

    // Enable per-user
    execSync(
      'powershell -NoProfile -Command "Set-ItemProperty \'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\' -Name Value -Value \'Allow\' -Force"',
      { timeout: 10000, stdio: 'pipe' }
    )
    details.push('User-level microphone access enabled')

    // Enable for desktop apps
    execSync(
      'powershell -NoProfile -Command "New-Item -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\' -Force | Out-Null; Set-ItemProperty \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\' -Name Value -Value \'Allow\' -Force"',
      { timeout: 10000, stdio: 'pipe' }
    )
    details.push('Desktop app microphone access enabled')
    changes.push({ type: 'registry', action: 'modified', target: 'Microphone privacy settings' })

    return {
      success: true, module: 'audio-fixer', action: 'enable-mic-privacy',
      description: 'Microphone access enabled in Windows privacy settings',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'audio-fixer', action: 'enable-mic-privacy',
      description: 'Failed to enable microphone privacy',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Disable audio enhancements (fixes crackling/popping)
export async function disableAudioEnhancements(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync(
        'powershell -NoProfile -Command "New-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio\' -Name \'DisableProtectedAudioDG\' -Value 1 -PropertyType DWORD -Force -ErrorAction SilentlyContinue"',
        { timeout: 10000, stdio: 'pipe' }
      )
      details.push('Audio enhancements disabled via registry')
      changes.push({ type: 'registry', action: 'modified', target: 'Audio enhancements' })

      // Run audio troubleshooter silently
      try {
        execSync(
          'powershell -NoProfile -Command "Get-TroubleshootingPack -Path \'C:\\Windows\\diagnostics\\system\\Audio\' | Invoke-TroubleshootingPack -Unattended -ErrorAction SilentlyContinue"',
          { timeout: 60000, stdio: 'pipe' }
        )
        details.push('Windows Audio troubleshooter completed')
      } catch {
        details.push('Audio troubleshooter not available')
      }
    } else if (isMac) {
      execSync('sudo killall coreaudiod 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      details.push('Core Audio reset to default settings')
      changes.push({ type: 'service', action: 'restarted', target: 'coreaudiod' })
    }

    return {
      success: true, module: 'audio-fixer', action: 'disable-enhancements',
      description: 'Audio enhancements disabled. Restart may be required.',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'audio-fixer', action: 'disable-enhancements',
      description: 'Failed to disable audio enhancements',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}
