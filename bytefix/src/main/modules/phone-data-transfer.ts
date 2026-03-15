import { execFileSync } from 'child_process'
import { platform } from 'os'
import { existsSync } from 'fs'
import { join } from 'path'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('phone-data-transfer')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'
const isLinux = platform() === 'linux'

// ============================================================
// ADB Detection
// ============================================================
interface AdbStatus {
  installed: boolean
  path: string
  version: string
  devices: AdbDevice[]
}

interface AdbDevice {
  serial: string
  state: 'device' | 'offline' | 'unauthorized' | 'no permissions' | 'unknown'
  model: string
  product: string
  transportId: string
}

function findAdb(): string {
  // Check common ADB locations
  const commonPaths: string[] = []

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || ''
    const userProfile = process.env.USERPROFILE || ''
    commonPaths.push(
      join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      join(userProfile, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      'C:\\platform-tools\\adb.exe',
      'C:\\Android\\platform-tools\\adb.exe',
      'C:\\Program Files\\Android\\platform-tools\\adb.exe',
      'C:\\Program Files (x86)\\Android\\platform-tools\\adb.exe'
    )
  } else if (isMac) {
    const home = process.env.HOME || ''
    commonPaths.push(
      join(home, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
      '/usr/local/bin/adb',
      '/opt/homebrew/bin/adb'
    )
  } else {
    const home = process.env.HOME || ''
    commonPaths.push(
      join(home, 'Android', 'Sdk', 'platform-tools', 'adb'),
      '/usr/bin/adb',
      '/usr/local/bin/adb',
      '/snap/bin/adb'
    )
  }

  // Check PATH first
  try {
    const cmd = isWindows ? 'where' : 'which'
    const output = execFileSync(cmd, ['adb'], {
      timeout: 5000, encoding: 'utf8'
    })
    const adbPath = output.trim().split('\n')[0]
    if (adbPath && existsSync(adbPath)) return adbPath
  } catch { /* not in PATH */ }

  // Check common locations
  for (const p of commonPaths) {
    if (existsSync(p)) return p
  }

  // Check Electron resources path for bundled adb
  try {
    const resourcesPath = process.resourcesPath
    if (resourcesPath) {
      const bundledAdb = isWindows
        ? join(resourcesPath, 'tools', 'adb.exe')
        : join(resourcesPath, 'tools', 'adb')
      if (existsSync(bundledAdb)) return bundledAdb
    }
  } catch { /* not in Electron context */ }

  return ''
}

async function getAdbStatus(): Promise<AdbStatus> {
  const status: AdbStatus = {
    installed: false,
    path: '',
    version: '',
    devices: []
  }

  status.path = findAdb()
  if (!status.path) return status

  status.installed = true

  // Get version
  try {
    const output = execFileSync(status.path, ['version'], {
      timeout: 5000, encoding: 'utf8'
    })
    const versionMatch = output.match(/Android Debug Bridge version ([\d.]+)/)
    if (versionMatch) status.version = versionMatch[1]
  } catch { /* ignore */ }

  // Start ADB server if not running
  try {
    execFileSync(status.path, ['start-server'], {
      timeout: 10000, encoding: 'utf8'
    })
  } catch { /* ignore */ }

  // List connected devices
  try {
    const output = execFileSync(status.path, ['devices', '-l'], {
      timeout: 10000, encoding: 'utf8'
    })

    const lines = output.split('\n').slice(1) // Skip "List of devices attached"
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === '') continue

      const parts = trimmed.split(/\s+/)
      if (parts.length < 2) continue

      const serial = parts[0]
      const state = parts[1] as AdbDevice['state']

      let model = ''
      let product = ''
      let transportId = ''

      const modelMatch = trimmed.match(/model:(\S+)/)
      if (modelMatch) model = modelMatch[1]

      const productMatch = trimmed.match(/product:(\S+)/)
      if (productMatch) product = productMatch[1]

      const transportMatch = trimmed.match(/transport_id:(\S+)/)
      if (transportMatch) transportId = transportMatch[1]

      status.devices.push({ serial, state, model, product, transportId })
    }
  } catch { /* ignore */ }

  return status
}

// ============================================================
// USB Device Detection (MTP/PTP)
// ============================================================
interface UsbPhoneDevice {
  name: string
  type: 'MTP' | 'PTP' | 'Charging' | 'Unknown'
  vendor: string
  serial: string
  os: 'Android' | 'iOS' | 'Unknown'
}

async function detectUsbPhones(): Promise<UsbPhoneDevice[]> {
  const phones: UsbPhoneDevice[] = []

  if (isWindows) {
    // Check for MTP/PTP devices
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -Class "WPD" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "OK" } | Select-Object FriendlyName,InstanceId | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim()) {
        const devices = JSON.parse(output)
        const devArr = Array.isArray(devices) ? devices : [devices]
        for (const dev of devArr) {
          const name = dev.FriendlyName || 'Unknown Device'
          const instanceId = dev.InstanceId || ''

          let os: UsbPhoneDevice['os'] = 'Unknown'
          if (/apple|iphone|ipad/i.test(name) || /apple/i.test(instanceId)) {
            os = 'iOS'
          } else if (/samsung|xiaomi|redmi|poco|realme|oppo|vivo|oneplus|motorola|nokia|huawei|honor|pixel|android/i.test(name)) {
            os = 'Android'
          }

          phones.push({
            name,
            type: 'MTP',
            vendor: os === 'iOS' ? 'Apple' : '',
            serial: '',
            os
          })
        }
      }
    } catch { /* ignore */ }

    // Check for Apple devices via iTunes/Apple Mobile Device
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -FriendlyName "*Apple*" -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const devices = JSON.parse(output)
        const devArr = Array.isArray(devices) ? devices : [devices]
        for (const dev of devArr) {
          if (/mobile device/i.test(dev.FriendlyName || '')) {
            // Check if already added
            if (!phones.some(p => p.os === 'iOS')) {
              phones.push({
                name: 'Apple iPhone/iPad',
                type: 'MTP',
                vendor: 'Apple',
                serial: '',
                os: 'iOS'
              })
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (isLinux) {
    // Check for MTP devices via lsusb
    try {
      const output = execFileSync('lsusb', [], {
        timeout: 5000, encoding: 'utf8'
      })

      const phoneVendors: Record<string, { vendor: string; os: UsbPhoneDevice['os'] }> = {
        '04e8': { vendor: 'Samsung', os: 'Android' },
        '2717': { vendor: 'Xiaomi', os: 'Android' },
        '22b8': { vendor: 'Motorola', os: 'Android' },
        '05c6': { vendor: 'Qualcomm (Android)', os: 'Android' },
        '18d1': { vendor: 'Google', os: 'Android' },
        '2a70': { vendor: 'OnePlus', os: 'Android' },
        '1004': { vendor: 'LG', os: 'Android' },
        '0bb4': { vendor: 'HTC', os: 'Android' },
        '12d1': { vendor: 'Huawei', os: 'Android' },
        '2ae5': { vendor: 'Fairphone', os: 'Android' },
        '0fce': { vendor: 'Sony', os: 'Android' },
        '2a45': { vendor: 'Meizu', os: 'Android' },
        '1949': { vendor: 'Oppo/Realme', os: 'Android' },
        '2d95': { vendor: 'Vivo', os: 'Android' },
        '05ac': { vendor: 'Apple', os: 'iOS' }
      }

      for (const line of output.split('\n')) {
        const match = line.match(/ID\s+([0-9a-f]{4}):([0-9a-f]{4})\s+(.+)/)
        if (match) {
          const vendorId = match[1]
          const known = phoneVendors[vendorId]
          if (known) {
            phones.push({
              name: match[3].trim(),
              type: 'MTP',
              vendor: known.vendor,
              serial: '',
              os: known.os
            })
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (isMac) {
    // Check for connected iOS devices
    try {
      const output = execFileSync('system_profiler', ['SPUSBDataType', '-json'], {
        timeout: 15000, encoding: 'utf8'
      })
      const data = JSON.parse(output)
      const processItems = (items: Array<Record<string, unknown>>): void => {
        for (const item of items) {
          const name = String(item._name || '')
          if (/iphone|ipad|ipod/i.test(name)) {
            phones.push({
              name, type: 'MTP', vendor: 'Apple',
              serial: String(item.serial_num || ''), os: 'iOS'
            })
          } else if (/android|samsung|xiaomi|pixel|oneplus/i.test(name)) {
            phones.push({
              name, type: 'MTP', vendor: '',
              serial: '', os: 'Android'
            })
          }
          if (item._items && Array.isArray(item._items)) {
            processItems(item._items as Array<Record<string, unknown>>)
          }
        }
      }
      if (data.SPUSBDataType) processItems(data.SPUSBDataType)
    } catch { /* ignore */ }
  }

  return phones
}

// ============================================================
// Data Transfer Guide
// ============================================================
interface TransferGuide {
  title: string
  steps: string[]
  tools: string[]
}

function getAndroidTransferGuide(): TransferGuide {
  return {
    title: 'Android Phone Data Transfer Guide',
    steps: [
      '1. Connect phone to computer via USB cable',
      '2. On the phone: Pull down notification bar → Tap "Charging via USB" → Select "File Transfer (MTP)"',
      '3. The phone should appear as a drive in File Explorer/Finder',
      '4. Navigate to folders:',
      '   - Photos/Videos: DCIM/Camera, Pictures, Movies',
      '   - WhatsApp: WhatsApp/Media (or Android/media/com.whatsapp)',
      '   - Downloads: Download',
      '   - Documents: Documents',
      '   - Contacts: Export from Phone → Settings → Contacts → Export → .vcf file',
      '   - Messages: Use "SMS Backup & Restore" app from Play Store',
      '5. Copy files to computer',
      '',
      'For ADB transfer (faster, command-line):',
      '   adb pull /sdcard/DCIM ./photos',
      '   adb pull /sdcard/WhatsApp/Media ./whatsapp',
      '   adb pull /sdcard/Download ./downloads',
      '',
      'For wireless transfer:',
      '   - Use Google Nearby Share / Quick Share',
      '   - Or install AirDroid/Snapdrop for web-based transfer'
    ],
    tools: [
      'ADB (Android Debug Bridge) - developer.android.com/tools/adb',
      'Samsung Smart Switch - samsung.com/smartswitch',
      'Google Files - play.google.com/store/apps/details?id=com.google.android.apps.nbu.files',
      'SMS Backup & Restore - play.google.com/store/apps/details?id=com.riteshsahu.SMSBackupRestore'
    ]
  }
}

function getIosTransferGuide(): TransferGuide {
  return {
    title: 'iPhone/iPad Data Transfer Guide',
    steps: [
      '1. Connect iPhone to computer via Lightning/USB-C cable',
      '2. Trust the computer when prompted on iPhone',
      '',
      'Windows:',
      '   - Install iTunes from microsoft.com/store or apple.com/itunes',
      '   - Open iTunes → Select device → Summary → Back Up Now',
      '   - Photos: Open File Explorer → Apple iPhone → Internal Storage → DCIM',
      '   - Or use Windows Photos app → Import',
      '',
      'macOS:',
      '   - Finder (macOS Catalina+) or iTunes → Select device → Back Up Now',
      '   - Photos: Open Image Capture or Photos app → Import',
      '   - AirDrop: Select files on iPhone → Share → AirDrop → Select Mac',
      '',
      'Contacts & Messages:',
      '   - Contacts: Settings → [Your Name] → iCloud → Contacts ON → Sync to iCloud',
      '   - Messages: Settings → Messages → Text Message Forwarding',
      '   - Full backup: iTunes/Finder → Back Up Now (includes all data)',
      '',
      'WhatsApp:',
      '   - WhatsApp → Settings → Chats → Chat Backup → Back Up Now (to iCloud)',
      '   - For transfer to Android: Use "Move to Android" feature in WhatsApp'
    ],
    tools: [
      'iTunes (Windows) - apple.com/itunes',
      'iCloud.com - Access photos, contacts, documents online',
      '3uTools - free iOS management tool (3u.com)',
      'iMazing - paid but comprehensive (imazing.com)'
    ]
  }
}

// ============================================================
// Enable USB Debugging Guide
// ============================================================
export async function guideUsbDebugging(): Promise<FixResult> {
  const details: string[] = [
    'How to enable USB Debugging on Android:',
    '',
    '1. Go to Settings → About Phone',
    '2. Tap "Build Number" 7 times quickly',
    '3. You should see "You are now a developer!" message',
    '4. Go back to Settings → System → Developer Options',
    '   (On some phones: Settings → Developer Options)',
    '5. Enable "USB Debugging"',
    '6. Connect USB cable to computer',
    '7. Tap "Allow" on the "Allow USB debugging?" prompt',
    '8. Check "Always allow from this computer" for convenience',
    '',
    'Brand-specific paths:',
    '  Samsung: Settings → About Phone → Software Information → Build Number',
    '  Xiaomi/Redmi/POCO: Settings → About Phone → MIUI Version (tap 7x)',
    '  Realme: Settings → About Phone → Build Number',
    '  Oppo: Settings → About Phone → Build Number',
    '  Vivo: Settings → About Phone → Software Version (tap 7x)',
    '  OnePlus: Settings → About Phone → Build Number',
    '',
    'If USB Debugging prompt does not appear:',
    '  1. Revoke USB debugging authorizations in Developer Options',
    '  2. Disconnect and reconnect USB cable',
    '  3. Try a different USB cable (data cable, not charge-only)',
    '  4. Try a different USB port',
    '  5. Install device-specific USB drivers on Windows'
  ]

  return {
    success: true,
    module: 'phone-transfer',
    action: 'guide_usb_debugging',
    description: 'USB debugging setup guide',
    details,
    changes: [{ type: 'system', action: 'created', target: 'USB debugging guide' }],
    rollbackAvailable: false
  }
}

// ============================================================
// ADB File Pull
// ============================================================
export async function pullFilesViaAdb(
  sourcePath: string,
  destinationPath: string
): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  const adbStatus = await getAdbStatus()

  if (!adbStatus.installed) {
    details.push('ADB is not installed.')
    details.push('')
    details.push('Install ADB:')
    if (isWindows) {
      details.push('  1. Download from: developer.android.com/tools/releases/platform-tools')
      details.push('  2. Extract to C:\\platform-tools')
      details.push('  3. Add to PATH: System Properties → Environment Variables → Path → Add C:\\platform-tools')
    } else if (isMac) {
      details.push('  brew install android-platform-tools')
    } else {
      details.push('  sudo apt install android-tools-adb')
    }
    return {
      success: false, module: 'phone-transfer', action: 'adb_pull',
      description: 'ADB not installed', details, changes, rollbackAvailable: false
    }
  }

  if (adbStatus.devices.length === 0) {
    details.push('No Android device connected via ADB.')
    details.push('Ensure USB debugging is enabled and device is connected.')
    return {
      success: false, module: 'phone-transfer', action: 'adb_pull',
      description: 'No device connected', details, changes, rollbackAvailable: false
    }
  }

  const device = adbStatus.devices[0]
  if (device.state === 'unauthorized') {
    details.push('Device connected but NOT authorized.')
    details.push('Check phone screen for "Allow USB debugging?" prompt and tap Allow.')
    return {
      success: false, module: 'phone-transfer', action: 'adb_pull',
      description: 'Device unauthorized', details, changes, rollbackAvailable: false
    }
  }

  // Sanitize paths - only allow safe characters
  const safeSrc = sourcePath.replace(/[;&|`$]/g, '')
  const safeDest = destinationPath.replace(/[;&|`$]/g, '')

  try {
    const output = execFileSync(adbStatus.path, ['pull', safeSrc, safeDest], {
      timeout: 300000, encoding: 'utf8'
    })
    details.push(`Pulled: ${safeSrc} → ${safeDest}`)
    details.push(output.trim())
    changes.push({ type: 'file', action: 'created', target: safeDest })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    details.push(`Failed to pull: ${msg}`)
  }

  return {
    success: changes.length > 0,
    module: 'phone-transfer',
    action: 'adb_pull',
    description: 'ADB file transfer',
    details, changes, rollbackAvailable: false
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runPhoneTransferDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. ADB status
  const adbStatus = await getAdbStatus()

  results.push({
    id: `phone-adb-${Date.now()}`,
    module: 'phone-transfer',
    category: 'ADB Status',
    title: adbStatus.installed
      ? `ADB installed (v${adbStatus.version})`
      : 'ADB not installed',
    severity: adbStatus.installed ? 'healthy' : 'info',
    description: adbStatus.installed
      ? `Android Debug Bridge v${adbStatus.version} at ${adbStatus.path}`
      : 'ADB is not installed. Required for advanced Android data transfer.',
    details: [
      adbStatus.installed ? `Path: ${adbStatus.path}` : '',
      adbStatus.installed ? `Version: ${adbStatus.version}` : '',
      !adbStatus.installed ? 'Install from: developer.android.com/tools/releases/platform-tools' : '',
      !adbStatus.installed && isWindows ? 'Or: Download minimal ADB installer from xda-developers' : '',
      !adbStatus.installed && isMac ? 'Or: brew install android-platform-tools' : '',
      !adbStatus.installed && isLinux ? 'Or: sudo apt install android-tools-adb' : ''
    ].filter(Boolean),
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: Date.now()
  })

  // 2. Connected ADB devices
  if (adbStatus.installed) {
    if (adbStatus.devices.length > 0) {
      for (const dev of adbStatus.devices) {
        const isReady = dev.state === 'device'
        results.push({
          id: `phone-adb-dev-${dev.serial}-${Date.now()}`,
          module: 'phone-transfer',
          category: 'Connected Devices',
          title: `${dev.model || dev.serial}: ${dev.state}`,
          severity: isReady ? 'healthy' : 'warning',
          description: isReady
            ? `Device ${dev.model || dev.serial} is connected and ready`
            : `Device ${dev.serial} is ${dev.state}`,
          details: [
            `Serial: ${dev.serial}`,
            `State: ${dev.state}`,
            dev.model ? `Model: ${dev.model}` : '',
            dev.product ? `Product: ${dev.product}` : '',
            dev.state === 'unauthorized' ? 'Check phone for "Allow USB debugging" prompt' : '',
            dev.state === 'offline' ? 'Try reconnecting USB cable' : ''
          ].filter(Boolean),
          fixAvailable: !isReady,
          fixDescription: dev.state === 'unauthorized'
            ? 'Follow USB debugging authorization guide'
            : 'Reconnect device',
          fixRisk: 'none',
          autoFixable: false,
          timestamp: Date.now()
        })
      }
    } else {
      results.push({
        id: `phone-adb-nodev-${Date.now()}`,
        module: 'phone-transfer',
        category: 'Connected Devices',
        title: 'No Android devices connected via ADB',
        severity: 'info',
        description: 'No Android device detected. Connect via USB with debugging enabled.',
        details: [
          'To connect:',
          '1. Enable USB Debugging on the Android phone',
          '2. Connect via USB cable (must be data cable, not charge-only)',
          '3. Accept "Allow USB debugging" prompt on phone'
        ],
        fixAvailable: true,
        fixDescription: 'View USB debugging setup guide',
        fixRisk: 'none',
        autoFixable: false,
        timestamp: Date.now()
      })
    }
  }

  // 3. USB phone devices (MTP/PTP)
  const usbPhones = await detectUsbPhones()

  for (const phone of usbPhones) {
    results.push({
      id: `phone-usb-${phone.name.replace(/\s+/g, '-')}-${Date.now()}`,
      module: 'phone-transfer',
      category: 'USB Devices',
      title: `${phone.name} (${phone.os}) connected via ${phone.type}`,
      severity: 'healthy',
      description: `${phone.vendor} ${phone.name} detected as ${phone.type} device`,
      details: [
        `Device: ${phone.name}`,
        `Type: ${phone.type}`,
        `OS: ${phone.os}`,
        phone.vendor ? `Vendor: ${phone.vendor}` : ''
      ].filter(Boolean),
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // 4. Transfer guides
  const androidGuide = getAndroidTransferGuide()
  results.push({
    id: `phone-guide-android-${Date.now()}`,
    module: 'phone-transfer',
    category: 'Transfer Guide',
    title: androidGuide.title,
    severity: 'info',
    description: 'Step-by-step guide for transferring data from Android phones',
    details: [
      ...androidGuide.steps,
      '',
      'Recommended tools:',
      ...androidGuide.tools.map(t => `  • ${t}`)
    ],
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: Date.now()
  })

  const iosGuide = getIosTransferGuide()
  results.push({
    id: `phone-guide-ios-${Date.now()}`,
    module: 'phone-transfer',
    category: 'Transfer Guide',
    title: iosGuide.title,
    severity: 'info',
    description: 'Step-by-step guide for transferring data from iPhones/iPads',
    details: [
      ...iosGuide.steps,
      '',
      'Recommended tools:',
      ...iosGuide.tools.map(t => `  • ${t}`)
    ],
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: Date.now()
  })

  // 5. Windows USB driver check
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-PnpDevice -Class "AndroidUsbDeviceClass" -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status | ConvertTo-Json; ' +
        'Get-PnpDevice -FriendlyName "*ADB*" -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim() && output.trim() !== 'null') {
        results.push({
          id: `phone-usb-driver-${Date.now()}`,
          module: 'phone-transfer',
          category: 'USB Drivers',
          title: 'Android USB drivers detected',
          severity: 'healthy',
          description: 'Android USB drivers are installed for ADB communication',
          details: ['Android USB drivers found in device manager'],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp: Date.now()
        })
      }
    } catch { /* no android USB drivers */ }
  }

  return results
}
