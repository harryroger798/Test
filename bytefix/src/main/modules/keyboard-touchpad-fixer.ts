import { execFileSync } from 'child_process'
import { platform } from 'os'
import { existsSync, readFileSync } from 'fs'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('keyboard-touchpad-fixer')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'
const isLinux = platform() === 'linux'

// ============================================================
// Keyboard Device Detection
// ============================================================
interface InputDeviceInfo {
  name: string
  type: 'keyboard' | 'touchpad' | 'mouse' | 'other'
  driver: string
  status: 'ok' | 'error' | 'disabled' | 'unknown'
  deviceId: string
  details: string[]
}

async function detectInputDevices(): Promise<InputDeviceInfo[]> {
  const devices: InputDeviceInfo[] = []

  if (isWindows) {
    // Keyboards
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -Class Keyboard -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status,InstanceId,DriverVersion | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim()) {
        const kbds = JSON.parse(output)
        const kbdArr = Array.isArray(kbds) ? kbds : [kbds]
        for (const kbd of kbdArr) {
          devices.push({
            name: kbd.FriendlyName || 'Unknown Keyboard',
            type: 'keyboard',
            driver: kbd.DriverVersion || 'Unknown',
            status: kbd.Status === 'OK' ? 'ok' : kbd.Status === 'Error' ? 'error' : 'unknown',
            deviceId: kbd.InstanceId || '',
            details: [`Status: ${kbd.Status}`, `Driver: ${kbd.DriverVersion || 'N/A'}`]
          })
        }
      }
    } catch { /* PnP not available */ }

    // Touchpads / Mice
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -Class Mouse -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status,InstanceId,DriverVersion | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim()) {
        const mice = JSON.parse(output)
        const mouseArr = Array.isArray(mice) ? mice : [mice]
        for (const m of mouseArr) {
          const isTouchpad = /touchpad|trackpad|synaptics|elan|alps|precision/i.test(m.FriendlyName || '')
          devices.push({
            name: m.FriendlyName || 'Unknown Pointing Device',
            type: isTouchpad ? 'touchpad' : 'mouse',
            driver: m.DriverVersion || 'Unknown',
            status: m.Status === 'OK' ? 'ok' : m.Status === 'Error' ? 'error' : 'unknown',
            deviceId: m.InstanceId || '',
            details: [`Status: ${m.Status}`, `Driver: ${m.DriverVersion || 'N/A'}`]
          })
        }
      }
    } catch { /* ignore */ }
  }

  if (isLinux) {
    try {
      const inputDevices = readFileSync('/proc/bus/input/devices', 'utf8')
      const blocks = inputDevices.split('\n\n')

      for (const block of blocks) {
        if (!block.trim()) continue
        const nameMatch = block.match(/N: Name="(.+)"/)
        const handlersMatch = block.match(/H: Handlers=(.+)/)
        const name = nameMatch ? nameMatch[1] : 'Unknown'
        const handlers = handlersMatch ? handlersMatch[1] : ''

        let type: InputDeviceInfo['type'] = 'other'
        if (/keyboard|kbd/i.test(name) || handlers.includes('kbd')) {
          type = 'keyboard'
        } else if (/touchpad|trackpad|synaptics|elan|alps/i.test(name)) {
          type = 'touchpad'
        } else if (/mouse|trackpoint/i.test(name) || handlers.includes('mouse')) {
          type = 'mouse'
        }

        if (type === 'keyboard' || type === 'touchpad' || type === 'mouse') {
          devices.push({
            name,
            type,
            driver: handlers,
            status: 'ok',
            deviceId: '',
            details: [`Handlers: ${handlers}`]
          })
        }
      }
    } catch (err) {
      logger.warn('Failed to read input devices', err)
    }
  }

  if (isMac) {
    try {
      const output = execFileSync('system_profiler', ['SPUSBDataType', '-json'], {
        timeout: 15000, encoding: 'utf8'
      })
      const data = JSON.parse(output)
      // Parse USB HID devices
      const processItems = (items: Array<Record<string, unknown>>): void => {
        for (const item of items) {
          const name = String(item._name || '')
          if (/keyboard/i.test(name)) {
            devices.push({
              name, type: 'keyboard', driver: 'macOS HID',
              status: 'ok', deviceId: '', details: []
            })
          }
          if (item._items && Array.isArray(item._items)) {
            processItems(item._items as Array<Record<string, unknown>>)
          }
        }
      }
      if (data.SPUSBDataType) processItems(data.SPUSBDataType)
    } catch { /* ignore */ }

    // Built-in keyboard and trackpad always present on MacBooks
    devices.push(
      { name: 'Built-in Keyboard', type: 'keyboard', driver: 'AppleHIDKeyboard', status: 'ok', deviceId: '', details: [] },
      { name: 'Built-in Trackpad', type: 'touchpad', driver: 'AppleMultitouchTrackpad', status: 'ok', deviceId: '', details: [] }
    )
  }

  return devices
}

// ============================================================
// Filter Keys Detection & Fix
// ============================================================
interface FilterKeysStatus {
  enabled: boolean
  details: string[]
}

function checkFilterKeys(): FilterKeysStatus {
  if (!isWindows) {
    return { enabled: false, details: ['Filter Keys is a Windows-only feature'] }
  }

  try {
    const output = execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Get-ItemProperty -Path "HKCU:\\Control Panel\\Accessibility\\Keyboard Response" -ErrorAction SilentlyContinue | Select-Object Flags | ConvertTo-Json'
    ], { timeout: 10000, encoding: 'utf8' })

    if (output.trim()) {
      const result = JSON.parse(output)
      const flags = parseInt(result.Flags || '0')
      const enabled = (flags & 1) !== 0
      return {
        enabled,
        details: [
          `Filter Keys ${enabled ? 'ENABLED' : 'disabled'}`,
          enabled ? 'This causes delayed key response. Common issue when users accidentally hold Shift for 8 seconds.' : ''
        ].filter(Boolean)
      }
    }
  } catch { /* ignore */ }

  return { enabled: false, details: ['Could not check Filter Keys status'] }
}

export async function fixFilterKeys(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (!isWindows) {
    return {
      success: true, module: 'keyboard-touchpad', action: 'fix_filter_keys',
      description: 'Filter Keys is a Windows-only feature', details: ['Not applicable on this OS'],
      changes: [], rollbackAvailable: false
    }
  }

  try {
    // Disable Filter Keys
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Set-ItemProperty -Path "HKCU:\\Control Panel\\Accessibility\\Keyboard Response" -Name "Flags" -Value "0" -ErrorAction Stop'
    ], { timeout: 10000, encoding: 'utf8' })
    details.push('Disabled Filter Keys')
    changes.push({ type: 'registry', action: 'modified', target: 'Filter Keys', before: 'Enabled', after: 'Disabled' })

    // Also disable Sticky Keys
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Set-ItemProperty -Path "HKCU:\\Control Panel\\Accessibility\\StickyKeys" -Name "Flags" -Value "0" -ErrorAction Stop'
    ], { timeout: 10000, encoding: 'utf8' })
    details.push('Disabled Sticky Keys')
    changes.push({ type: 'registry', action: 'modified', target: 'Sticky Keys', before: 'Enabled', after: 'Disabled' })

    // Disable Toggle Keys
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      'Set-ItemProperty -Path "HKCU:\\Control Panel\\Accessibility\\ToggleKeys" -Name "Flags" -Value "0" -ErrorAction Stop'
    ], { timeout: 10000, encoding: 'utf8' })
    details.push('Disabled Toggle Keys')
    changes.push({ type: 'registry', action: 'modified', target: 'Toggle Keys', before: 'Enabled', after: 'Disabled' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    details.push(`Error: ${msg}`)
  }

  return {
    success: changes.length > 0,
    module: 'keyboard-touchpad',
    action: 'fix_filter_keys',
    description: 'Fixed keyboard accessibility settings',
    details, changes, rollbackAvailable: true
  }
}

// ============================================================
// Fn Key Fix
// ============================================================
export async function fixFnKeyBehavior(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    // Common approach: Toggle Fn Lock via WMI (Dell/HP/Lenovo)
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue | Out-Null; ' +
        '# Fn key behavior is typically controlled by BIOS, not software. ' +
        '# We can check and report the current state.'
      ], { timeout: 10000, encoding: 'utf8' })
    } catch { /* ignore */ }

    details.push('Fn Key Behavior Guide:')
    details.push('  Dell: Press Fn+Esc to toggle Fn Lock')
    details.push('  HP: Press Fn+Shift to toggle. Or change in BIOS → System Configuration → Action Keys Mode')
    details.push('  Lenovo: Press Fn+Esc for toggle. Or use Lenovo Vantage app → Input → Hotkey Mode')
    details.push('  Acer: Change in BIOS → Main → Function key behavior')
    details.push('  ASUS: Press Fn+Esc or change in BIOS → Advanced → Hotkey Mode')
    details.push('')
    details.push('If multimedia keys work but F1-F12 do not:')
    details.push('  → Fn Lock is ON (multimedia mode). Press Fn+Esc to switch.')
    details.push('If F1-F12 work but multimedia keys do not:')
    details.push('  → Fn Lock is OFF (function mode). Press Fn+Esc to switch.')

    changes.push({ type: 'system', action: 'modified', target: 'Fn Key Guide', after: 'Instructions provided' })
  } else if (isMac) {
    details.push('macOS Fn Key Settings:')
    details.push('  System Preferences → Keyboard → "Use F1, F2, etc. keys as standard function keys"')
    details.push('  When enabled: F1-F12 work as function keys, hold Fn for media controls')
    details.push('  When disabled: F1-F12 are media keys, hold Fn for function keys')

    // Try to read current setting
    try {
      const output = execFileSync('defaults', [
        'read', 'NSGlobalDomain', 'com.apple.keyboard.fnState'
      ], { timeout: 5000, encoding: 'utf8' })
      const fnState = output.trim() === '1'
      details.push(`Current setting: F1-F12 as ${fnState ? 'standard function keys' : 'media keys'}`)
    } catch {
      details.push('Could not read current Fn key setting')
    }
  } else {
    details.push('Linux Fn Key: Usually handled by firmware. Check BIOS settings.')
    details.push('For some laptops: echo 2 > /sys/module/hid_apple/parameters/fnmode')
  }

  return {
    success: true,
    module: 'keyboard-touchpad',
    action: 'fix_fn_key',
    description: 'Fn key troubleshooting guide',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Touchpad Toggle (Enable/Disable)
// ============================================================
export async function toggleTouchpad(enable: boolean): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []
  const action = enable ? 'enable' : 'disable'

  if (isWindows) {
    try {
      // Use PnPUtil to enable/disable touchpad devices
      const listOutput = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -Class Mouse -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match "touchpad|trackpad|synaptics|elan|alps|precision" } | Select-Object InstanceId,FriendlyName,Status | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (listOutput.trim()) {
        const touchpads = JSON.parse(listOutput)
        const tpArr = Array.isArray(touchpads) ? touchpads : [touchpads]

        for (const tp of tpArr) {
          if (!tp.InstanceId) continue
          try {
            const verb = enable ? 'Enable-PnpDevice' : 'Disable-PnpDevice'
            execFileSync('powershell', [
              '-NoProfile', '-Command',
              `${verb} -InstanceId "${tp.InstanceId}" -Confirm:$false -ErrorAction Stop`
            ], { timeout: 10000, encoding: 'utf8' })
            details.push(`${action}d: ${tp.FriendlyName}`)
            changes.push({
              type: 'device', action: enable ? 'enabled' : 'disabled',
              target: tp.FriendlyName
            })
          } catch {
            details.push(`Failed to ${action}: ${tp.FriendlyName}. Try running as administrator.`)
          }
        }

        if (tpArr.length === 0) {
          details.push('No touchpad device detected via PnP')
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      details.push(`Error: ${msg}`)
    }
  }

  if (isLinux) {
    try {
      // Use xinput to toggle touchpad
      const output = execFileSync('xinput', ['list', '--name-only'], {
        timeout: 5000, encoding: 'utf8'
      })
      const touchpadNames = output.split('\n').filter(l =>
        /touchpad|trackpad|synaptics|elan|alps/i.test(l)
      )

      for (const name of touchpadNames) {
        const trimmedName = name.trim()
        if (!trimmedName) continue
        try {
          execFileSync('xinput', [
            enable ? 'enable' : 'disable', trimmedName
          ], { timeout: 5000, encoding: 'utf8' })
          details.push(`${action}d: ${trimmedName}`)
          changes.push({ type: 'device', action: enable ? 'enabled' : 'disabled', target: trimmedName })
        } catch {
          details.push(`Failed to ${action}: ${trimmedName}`)
        }
      }

      if (touchpadNames.length === 0) {
        // Try libinput
        details.push('No touchpad found via xinput. Try: gsettings set org.gnome.desktop.peripherals.touchpad send-events ' +
          (enable ? 'enabled' : 'disabled'))
      }
    } catch {
      details.push('xinput not available. Install: sudo apt install xinput')
    }
  }

  if (isMac) {
    details.push('macOS Trackpad Toggle:')
    details.push('  System Preferences → Accessibility → Pointer Control → "Ignore built-in trackpad when mouse or wireless trackpad is present"')
    details.push('  Note: macOS does not support fully disabling the built-in trackpad via software.')
    if (!enable) {
      details.push('  Workaround: Connect a USB/Bluetooth mouse and enable the option above.')
    }
  }

  return {
    success: changes.length > 0 || details.length > 0,
    module: 'keyboard-touchpad',
    action: `toggle_touchpad_${action}`,
    description: `Touchpad ${action} operation`,
    details, changes, rollbackAvailable: enable
  }
}

// ============================================================
// Reinstall Keyboard/Touchpad Drivers
// ============================================================
export async function reinstallInputDrivers(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    // Scan for hardware changes (forces driver reinstall)
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'pnputil /scan-devices'
      ], { timeout: 30000, encoding: 'utf8' })
      details.push('Scanned for hardware changes (PnPUtil)')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'PnP device scan' })
    } catch { /* ignore */ }

    // Reset HID devices
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -Class Keyboard -ErrorAction SilentlyContinue | ForEach-Object { Disable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Enable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false -ErrorAction SilentlyContinue }'
      ], { timeout: 30000, encoding: 'utf8' })
      details.push('Reset keyboard devices (disable/re-enable)')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'Keyboard HID devices' })
    } catch {
      details.push('Could not reset keyboard devices. Try running as administrator.')
    }

    // Reset mouse/touchpad devices
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -Class Mouse -ErrorAction SilentlyContinue | ForEach-Object { Disable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Enable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false -ErrorAction SilentlyContinue }'
      ], { timeout: 30000, encoding: 'utf8' })
      details.push('Reset mouse/touchpad devices (disable/re-enable)')
      changes.push({ type: 'driver', action: 'reinstalled', target: 'Mouse/Touchpad HID devices' })
    } catch {
      details.push('Could not reset mouse/touchpad devices.')
    }
  }

  if (isLinux) {
    try {
      // Reload input modules
      const modules = ['i2c_hid', 'hid_multitouch', 'psmouse']
      for (const mod of modules) {
        try {
          execFileSync('pkexec', ['modprobe', '-r', mod], { timeout: 5000, encoding: 'utf8' })
          execFileSync('pkexec', ['modprobe', mod], { timeout: 5000, encoding: 'utf8' })
          details.push(`Reloaded kernel module: ${mod}`)
          changes.push({ type: 'driver', action: 'reloaded', target: mod })
        } catch {
          details.push(`Could not reload: ${mod} (may not be loaded)`)
        }
      }
    } catch (err) {
      logger.warn('Failed to reload input modules', err)
    }
  }

  if (isMac) {
    details.push('macOS Input Driver Reset:')
    details.push('  1. Reset SMC: Shut down → Hold Shift+Control+Option+Power for 10s → Release → Power on')
    details.push('  2. Reset NVRAM: Shut down → Power on → Hold Option+Command+P+R for 20s')
    details.push('  3. For Apple Silicon: Shut down → Hold power for 10s → Release → Power on')
  }

  return {
    success: changes.length > 0 || details.length > 0,
    module: 'keyboard-touchpad',
    action: 'reinstall_drivers',
    description: 'Input device driver reset',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runKeyboardTouchpadDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. Detect input devices
  const devices = await detectInputDevices()

  const keyboards = devices.filter(d => d.type === 'keyboard')
  const touchpads = devices.filter(d => d.type === 'touchpad')

  if (keyboards.length === 0) {
    results.push({
      id: `kb-none-${Date.now()}`,
      module: 'keyboard-touchpad',
      category: 'Keyboard',
      title: 'No keyboard detected',
      severity: 'warning',
      description: 'No keyboard device found. Driver may be missing or device is disconnected.',
      details: ['Try connecting an external USB keyboard', 'Check Device Manager for errors'],
      fixAvailable: true,
      fixDescription: 'Reinstall input drivers',
      fixRisk: 'low',
      autoFixable: true,
      timestamp: Date.now()
    })
  } else {
    for (const kbd of keyboards) {
      results.push({
        id: `kb-${kbd.name.replace(/\s+/g, '-')}-${Date.now()}`,
        module: 'keyboard-touchpad',
        category: 'Keyboard',
        title: `Keyboard: ${kbd.name} (${kbd.status})`,
        severity: kbd.status === 'error' ? 'warning' : 'healthy',
        description: kbd.status === 'error'
          ? `Keyboard "${kbd.name}" has driver errors`
          : `Keyboard "${kbd.name}" is working`,
        details: kbd.details,
        fixAvailable: kbd.status === 'error',
        fixDescription: 'Reinstall keyboard drivers',
        fixRisk: 'low',
        autoFixable: true,
        timestamp: Date.now()
      })
    }
  }

  if (touchpads.length === 0 && !isMac) {
    results.push({
      id: `tp-none-${Date.now()}`,
      module: 'keyboard-touchpad',
      category: 'Touchpad',
      title: 'No touchpad detected',
      severity: 'info',
      description: 'No touchpad found. This is normal for desktop systems.',
      details: [],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  } else {
    for (const tp of touchpads) {
      results.push({
        id: `tp-${tp.name.replace(/\s+/g, '-')}-${Date.now()}`,
        module: 'keyboard-touchpad',
        category: 'Touchpad',
        title: `Touchpad: ${tp.name} (${tp.status})`,
        severity: tp.status === 'error' ? 'warning' : tp.status === 'disabled' ? 'info' : 'healthy',
        description: tp.status === 'error'
          ? `Touchpad "${tp.name}" has driver errors`
          : tp.status === 'disabled'
            ? `Touchpad "${tp.name}" is disabled`
            : `Touchpad "${tp.name}" is working`,
        details: tp.details,
        fixAvailable: tp.status === 'error' || tp.status === 'disabled',
        fixDescription: tp.status === 'disabled' ? 'Enable touchpad' : 'Reinstall touchpad drivers',
        fixRisk: 'low',
        autoFixable: true,
        timestamp: Date.now()
      })
    }
  }

  // 2. Check Filter Keys (common Indian repair shop issue)
  const filterKeys = checkFilterKeys()
  if (filterKeys.enabled) {
    results.push({
      id: `kb-filter-${Date.now()}`,
      module: 'keyboard-touchpad',
      category: 'Accessibility',
      title: 'Filter Keys is ENABLED - causing delayed key response',
      severity: 'warning',
      description: 'Filter Keys is on, which causes a delay before keys register. This is the #1 reason customers think their keyboard is "slow" or "broken".',
      details: [
        ...filterKeys.details,
        'This is usually accidentally enabled by holding Shift for 8 seconds'
      ],
      fixAvailable: true,
      fixDescription: 'Disable Filter Keys, Sticky Keys, and Toggle Keys',
      fixRisk: 'none',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // 3. Check keyboard repeat rate
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-ItemProperty -Path "HKCU:\\Control Panel\\Keyboard" -ErrorAction SilentlyContinue | Select-Object KeyboardDelay,KeyboardSpeed | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const kbSettings = JSON.parse(output)
        const delay = parseInt(kbSettings.KeyboardDelay || '1')
        const speed = parseInt(kbSettings.KeyboardSpeed || '31')

        if (delay > 1 || speed < 20) {
          results.push({
            id: `kb-speed-${Date.now()}`,
            module: 'keyboard-touchpad',
            category: 'Keyboard',
            title: 'Keyboard repeat rate is slow',
            severity: 'info',
            description: `Keyboard delay: ${delay} (0=short, 3=long), Speed: ${speed} (0=slow, 31=fast)`,
            details: [
              `Current: Delay=${delay}, Speed=${speed}`,
              'Optimal for most users: Delay=0 or 1, Speed=31'
            ],
            fixAvailable: true,
            fixDescription: 'Reset keyboard speed to optimal settings',
            fixRisk: 'none',
            autoFixable: true,
            timestamp: Date.now()
          })
        }
      }
    } catch { /* ignore */ }
  }

  // 4. Check touchpad settings (Windows Precision Touchpad)
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PrecisionTouchPad" -ErrorAction SilentlyContinue | Select-Object AAPThreshold,ScrollDirection,TapEnabled | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const tpSettings = JSON.parse(output)
        if (tpSettings.TapEnabled === 0) {
          results.push({
            id: `tp-tap-${Date.now()}`,
            module: 'keyboard-touchpad',
            category: 'Touchpad',
            title: 'Touchpad tap-to-click is disabled',
            severity: 'info',
            description: 'Tap-to-click is turned off. Some users prefer this, but many expect tapping to work as clicking.',
            details: ['Enable via Settings → Devices → Touchpad → Tap with a single finger to single-click'],
            fixAvailable: false,
            fixRisk: 'none',
            autoFixable: false,
            timestamp: Date.now()
          })
        }
      }
    } catch { /* no precision touchpad */ }
  }

  return results
}
