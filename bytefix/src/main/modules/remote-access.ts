// ============================================================
// ByteFix — Remote Access Module
// Remote desktop setup, RDP configuration, remote assistance tools
// Uses Windows RDP built-in, VNC on Linux, Screen Sharing on macOS
// ============================================================

import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { platform, hostname } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('remote-access')
const isWindows = platform() === 'win32'
const isLinux = platform() === 'linux'
const isMac = platform() === 'darwin'

// ============================================================
// Enable Windows Remote Desktop (RDP)
// ============================================================
export async function enableRemoteDesktop(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!isWindows) {
      if (isLinux) {
        details.push('Linux Remote Access Options:')
        details.push('  1. VNC: sudo apt install tigervnc-standalone-server')
        details.push('  2. SSH: sudo systemctl enable ssh && sudo systemctl start ssh')
        details.push('  3. RustDesk: Download from https://rustdesk.com')
        return {
          success: true, module: 'remote', action: 'enable-rdp',
          description: 'Linux remote access guide',
          details, changes, rollbackAvailable: false
        }
      }
      if (isMac) {
        details.push('macOS Remote Access Options:')
        details.push('  1. Screen Sharing: System Preferences > Sharing > Screen Sharing')
        details.push('  2. Remote Login (SSH): System Preferences > Sharing > Remote Login')
        details.push('  3. Remote Management: System Preferences > Sharing > Remote Management')
        return {
          success: true, module: 'remote', action: 'enable-rdp',
          description: 'macOS remote access guide',
          details, changes, rollbackAvailable: false
        }
      }
    }

    // Enable RDP via registry
    details.push('Enabling Windows Remote Desktop...')

    try {
      execFileSync('reg', [
        'add', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server',
        '/v', 'fDenyTSConnections', '/t', 'REG_DWORD', '/d', '0', '/f'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Remote Desktop enabled in registry')
      changes.push({ type: 'registry', action: 'modified', target: 'fDenyTSConnections', before: '1', after: '0' })
    } catch {
      details.push('Could not modify registry (run as Administrator)')
    }

    // Enable RDP through Windows Firewall
    try {
      execFileSync('netsh', [
        'advfirewall', 'firewall', 'set', 'rule',
        'group=remote desktop', 'new', 'enable=Yes'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Firewall rules updated for Remote Desktop')
      changes.push({ type: 'network', action: 'modified', target: 'Firewall: Remote Desktop rule enabled' })
    } catch {
      details.push('Could not update firewall rules')
    }

    // Enable NLA (Network Level Authentication) for security
    try {
      execFileSync('reg', [
        'add', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp',
        '/v', 'UserAuthentication', '/t', 'REG_DWORD', '/d', '1', '/f'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Network Level Authentication (NLA) enabled for security')
      changes.push({ type: 'registry', action: 'modified', target: 'NLA enabled' })
    } catch { /* ignore */ }

    // Get computer name and IP for connection info
    const networkInfo = await si.networkInterfaces()
    const activeIface = (networkInfo as si.Systeminformation.NetworkInterfacesData[]).find(
      (n: si.Systeminformation.NetworkInterfacesData) => n.operstate === 'up' && n.ip4 && !n.internal
    )
    const localIp = activeIface?.ip4 || 'Unknown'

    details.push('')
    details.push('Connection Info:')
    details.push(`  Computer Name: ${hostname()}`)
    details.push(`  Local IP: ${localIp}`)
    details.push(`  Port: 3389 (default RDP)`)
    details.push('')
    details.push('To connect: Open Remote Desktop Connection (mstsc) and enter the IP address above.')

    return {
      success: changes.length > 0,
      module: 'remote', action: 'enable-rdp',
      description: 'Remote Desktop configuration',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Enable RDP failed', err)
    return {
      success: false, module: 'remote', action: 'enable-rdp',
      description: 'Failed to enable Remote Desktop',
      details: [...details, `Error: ${errMsg}`], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Disable Windows Remote Desktop
// ============================================================
export async function disableRemoteDesktop(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!isWindows) {
      return {
        success: false, module: 'remote', action: 'disable-rdp',
        description: 'Only available on Windows',
        details: [], changes, rollbackAvailable: false, error: 'Wrong platform'
      }
    }

    // Disable RDP via registry
    try {
      execFileSync('reg', [
        'add', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server',
        '/v', 'fDenyTSConnections', '/t', 'REG_DWORD', '/d', '1', '/f'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Remote Desktop disabled')
      changes.push({ type: 'registry', action: 'modified', target: 'fDenyTSConnections', before: '0', after: '1' })
    } catch {
      details.push('Could not modify registry (run as Administrator)')
    }

    // Disable RDP firewall rule
    try {
      execFileSync('netsh', [
        'advfirewall', 'firewall', 'set', 'rule',
        'group=remote desktop', 'new', 'enable=No'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Firewall rules disabled for Remote Desktop')
      changes.push({ type: 'network', action: 'modified', target: 'Firewall: Remote Desktop rule disabled' })
    } catch { /* ignore */ }

    return {
      success: changes.length > 0,
      module: 'remote', action: 'disable-rdp',
      description: 'Remote Desktop disabled',
      details, changes, rollbackAvailable: true
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'remote', action: 'disable-rdp',
      description: 'Failed to disable Remote Desktop',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Generate Remote Assistance Invitation (Windows)
// ============================================================
export async function generateRemoteAssistInvite(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (!isWindows) {
      details.push('Remote assistance invitation is a Windows feature.')
      details.push('Alternatives:')
      details.push('  - RustDesk (cross-platform): https://rustdesk.com')
      details.push('  - AnyDesk (cross-platform): https://anydesk.com')
      details.push('  - TeamViewer (cross-platform): https://teamviewer.com')
      return {
        success: true, module: 'remote', action: 'generate-invite',
        description: 'Remote assistance alternatives',
        details, changes, rollbackAvailable: false
      }
    }

    // Enable Remote Assistance
    try {
      execFileSync('reg', [
        'add', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Remote Assistance',
        '/v', 'fAllowToGetHelp', '/t', 'REG_DWORD', '/d', '1', '/f'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Remote Assistance enabled')
      changes.push({ type: 'registry', action: 'modified', target: 'Remote Assistance enabled' })
    } catch {
      details.push('Could not enable Remote Assistance')
    }

    // Open Quick Assist (modern Windows remote help)
    details.push('')
    details.push('Quick Assist (Recommended for Windows 10/11):')
    details.push('  1. Press Win+Ctrl+Q to open Quick Assist')
    details.push('  2. Click "Help someone" (technician) or "Get help" (customer)')
    details.push('  3. Share the 6-digit security code')
    details.push('')
    details.push('Legacy Remote Assistance:')
    details.push('  1. Run: msra /saveinvitation')
    details.push('  2. Save invitation file and share with technician')

    // Get connection info
    const networkInfo = await si.networkInterfaces()
    const activeIface = (networkInfo as si.Systeminformation.NetworkInterfacesData[]).find(
      (n: si.Systeminformation.NetworkInterfacesData) => n.operstate === 'up' && n.ip4 && !n.internal
    )

    details.push('')
    details.push('Connection Details:')
    details.push(`  Computer: ${hostname()}`)
    details.push(`  IP: ${activeIface?.ip4 || 'Unknown'}`)

    return {
      success: true, module: 'remote', action: 'generate-invite',
      description: 'Remote assistance setup',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'remote', action: 'generate-invite',
      description: 'Failed to generate invitation',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Configure Wake-on-LAN
// ============================================================
export async function configureWakeOnLan(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    if (isWindows) {
      // Get network adapter and enable WoL
      try {
        const output = execFileSync('powershell', [
          '-NoProfile', '-Command',
          `$adapters = Get-NetAdapter | Where-Object {$_.Status -eq 'Up'}; foreach($a in $adapters) { $wol = Get-NetAdapterPowerManagement -Name $a.Name -ErrorAction SilentlyContinue; if($wol) { Write-Output "Adapter: $($a.Name) - WakeOnMagicPacket: $($wol.WakeOnMagicPacket)" } }`
        ], { timeout: 15000, encoding: 'utf8' })
        details.push('Current Wake-on-LAN status:')
        details.push(output.trim())
      } catch {
        details.push('Could not check WoL status')
      }

      // Enable WoL on all active adapters
      try {
        execFileSync('powershell', [
          '-NoProfile', '-Command',
          `Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object { Set-NetAdapterPowerManagement -Name $_.Name -WakeOnMagicPacket Enabled -ErrorAction SilentlyContinue }`
        ], { timeout: 15000, encoding: 'utf8' })
        details.push('Wake-on-LAN enabled on active adapters')
        changes.push({ type: 'network', action: 'modified', target: 'Wake-on-LAN enabled' })
      } catch {
        details.push('Could not enable WoL (may need Administrator or BIOS support)')
      }

      // Get MAC address for WoL packet
      const networkInfo = await si.networkInterfaces()
      const activeIface = (networkInfo as si.Systeminformation.NetworkInterfacesData[]).find(
        (n: si.Systeminformation.NetworkInterfacesData) => n.operstate === 'up' && n.mac && !n.internal
      )
      if (activeIface?.mac) {
        details.push('')
        details.push(`MAC Address for WoL: ${activeIface.mac}`)
        details.push('Use this MAC address to send a Wake-on-LAN magic packet to wake this computer.')
      }
    } else {
      details.push('Wake-on-LAN configuration:')
      if (isLinux) {
        details.push('  Install ethtool: sudo apt install ethtool')
        details.push('  Enable WoL: sudo ethtool -s eth0 wol g')
        details.push('  Check status: sudo ethtool eth0 | grep Wake-on')
      }
      if (isMac) {
        details.push('  System Preferences > Energy Saver > Wake for network access')
      }
    }

    return {
      success: true, module: 'remote', action: 'configure-wol',
      description: 'Wake-on-LAN configuration',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'remote', action: 'configure-wol',
      description: 'WoL configuration failed',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runRemoteAccessDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const now = Date.now()

  // Get network info
  const networkInfo = await si.networkInterfaces()
  const activeIface = (networkInfo as si.Systeminformation.NetworkInterfacesData[]).find(
    (n: si.Systeminformation.NetworkInterfacesData) => n.operstate === 'up' && n.ip4 && !n.internal
  )

  results.push({
    id: `remote-netinfo-${now}`,
    module: 'remote',
    category: 'Remote Access',
    title: `Network: ${activeIface ? `${activeIface.ip4} (${activeIface.iface})` : 'No active connection'}`,
    severity: activeIface ? 'info' : 'warning',
    description: 'Network connection details for remote access',
    details: activeIface ? [
      `Interface: ${activeIface.iface}`,
      `IP Address: ${activeIface.ip4}`,
      `MAC Address: ${activeIface.mac}`,
      `Speed: ${activeIface.speed ? `${activeIface.speed} Mbps` : 'Unknown'}`,
      `Computer Name: ${hostname()}`
    ] : ['No active network connection found. Remote access requires network connectivity.'],
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: now
  })

  // Check RDP status (Windows)
  if (isWindows) {
    let rdpEnabled = false
    try {
      const output = execFileSync('reg', [
        'query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server',
        '/v', 'fDenyTSConnections'
      ], { timeout: 5000, encoding: 'utf8' })
      rdpEnabled = output.includes('0x0')
    } catch { /* ignore */ }

    results.push({
      id: `remote-rdp-${now}`,
      module: 'remote',
      category: 'Remote Access',
      title: rdpEnabled ? 'Remote Desktop: Enabled' : 'Remote Desktop: Disabled',
      severity: rdpEnabled ? 'healthy' : 'info',
      description: rdpEnabled
        ? `Remote Desktop is enabled. Connect via mstsc to ${activeIface?.ip4 || hostname()}:3389`
        : 'Remote Desktop is disabled. Enable it to allow remote connections.',
      details: rdpEnabled
        ? [`Connect to: ${activeIface?.ip4 || hostname()}`, 'Port: 3389', 'Use Remote Desktop Connection (mstsc) from another Windows PC']
        : ['Click "Enable Remote Desktop" below to turn it on', 'This allows remote connections via RDP (port 3389)'],
      fixAvailable: !rdpEnabled,
      fixDescription: rdpEnabled ? undefined : 'Enable Remote Desktop for remote connections',
      fixRisk: 'medium',
      autoFixable: true,
      timestamp: now
    })

    // Check Remote Assistance
    let raEnabled = false
    try {
      const output = execFileSync('reg', [
        'query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Remote Assistance',
        '/v', 'fAllowToGetHelp'
      ], { timeout: 5000, encoding: 'utf8' })
      raEnabled = output.includes('0x1')
    } catch { /* ignore */ }

    results.push({
      id: `remote-ra-${now}`,
      module: 'remote',
      category: 'Remote Access',
      title: raEnabled ? 'Remote Assistance: Enabled' : 'Remote Assistance: Disabled',
      severity: raEnabled ? 'healthy' : 'info',
      description: raEnabled
        ? 'Windows Remote Assistance is enabled for remote help sessions'
        : 'Remote Assistance is disabled. Enable it for Quick Assist support.',
      details: raEnabled
        ? ['Quick Assist: Win+Ctrl+Q', 'Can receive remote help from technicians']
        : ['Enable to allow technicians to provide remote support', 'Uses Quick Assist (Win+Ctrl+Q) on Windows 10/11'],
      fixAvailable: !raEnabled,
      fixDescription: raEnabled ? undefined : 'Enable Remote Assistance',
      fixRisk: 'low',
      autoFixable: true,
      timestamp: now
    })
  }

  // Check SSH (Linux/macOS)
  if (isLinux || isMac) {
    let sshRunning = false
    try {
      if (isLinux) {
        execFileSync('systemctl', ['is-active', 'ssh'], { timeout: 5000, encoding: 'utf8' })
        sshRunning = true
      }
      if (isMac) {
        const output = execFileSync('systemsetup', ['-getremotelogin'], {
          timeout: 5000, encoding: 'utf8'
        })
        sshRunning = /on/i.test(output)
      }
    } catch { /* not running */ }

    results.push({
      id: `remote-ssh-${now}`,
      module: 'remote',
      category: 'Remote Access',
      title: sshRunning ? 'SSH: Running' : 'SSH: Not Running',
      severity: sshRunning ? 'healthy' : 'info',
      description: sshRunning
        ? `SSH server is running. Connect via: ssh user@${activeIface?.ip4 || hostname()}`
        : 'SSH server is not running. Enable it for remote terminal access.',
      details: sshRunning
        ? [`Connect: ssh user@${activeIface?.ip4 || hostname()}`, 'Port: 22 (default)']
        : isLinux
          ? ['Enable: sudo systemctl enable ssh && sudo systemctl start ssh']
          : ['Enable: System Preferences > Sharing > Remote Login'],
      fixAvailable: !sshRunning,
      fixDescription: sshRunning ? undefined : isLinux ? 'sudo systemctl enable ssh' : 'Enable Remote Login in System Preferences',
      fixRisk: 'low',
      autoFixable: false,
      timestamp: now
    })
  }

  // Third-party remote access tools detection
  const toolChecks = [
    { name: 'RustDesk', winExe: 'rustdesk.exe', linuxCmd: 'rustdesk', desc: 'Open-source remote desktop (recommended)' },
    { name: 'TeamViewer', winExe: 'TeamViewer.exe', linuxCmd: 'teamviewer', desc: 'Popular commercial remote desktop' },
    { name: 'AnyDesk', winExe: 'AnyDesk.exe', linuxCmd: 'anydesk', desc: 'Lightweight remote desktop' }
  ]

  const installedTools: string[] = []
  const missingTools: string[] = []

  for (const tool of toolChecks) {
    let found = false
    if (isWindows) {
      try {
        execFileSync('where', [tool.winExe], { timeout: 5000, encoding: 'utf8' })
        found = true
      } catch { /* not found */ }

      if (!found) {
        // Check common install paths
        const commonPaths = [
          `C:\\Program Files\\${tool.name}\\${tool.winExe}`,
          `C:\\Program Files (x86)\\${tool.name}\\${tool.winExe}`
        ]
        for (const p of commonPaths) {
          if (existsSync(p)) { found = true; break }
        }
      }
    } else {
      try {
        execFileSync('which', [tool.linuxCmd], { timeout: 5000, encoding: 'utf8' })
        found = true
      } catch { /* not found */ }
    }

    if (found) {
      installedTools.push(`${tool.name}: Installed (${tool.desc})`)
    } else {
      missingTools.push(`${tool.name}: Not installed (${tool.desc})`)
    }
  }

  results.push({
    id: `remote-tools-${now}`,
    module: 'remote',
    category: 'Remote Access',
    title: `${installedTools.length} Remote Tool(s) Detected`,
    severity: installedTools.length > 0 ? 'healthy' : 'info',
    description: installedTools.length > 0
      ? 'Third-party remote access tools installed'
      : 'No third-party remote access tools detected. Consider installing RustDesk (free, open-source).',
    details: [...installedTools, ...missingTools],
    fixAvailable: missingTools.length > 0,
    fixDescription: missingTools.length > 0 ? 'Download RustDesk from https://rustdesk.com (free, open-source)' : undefined,
    fixRisk: 'low',
    autoFixable: false,
    timestamp: now
  })

  return results
}
