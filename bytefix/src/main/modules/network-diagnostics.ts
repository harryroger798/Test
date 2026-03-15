import { execSync, execFileSync } from 'child_process'
import { platform } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { NetworkDiagnostic, NetworkIssue, FixResult, FixChange, DiagnosticResult } from '../../shared/types'

const logger = createLogger('network-diagnostics')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'

// ============================================================
// Full Network Diagnostics
// ============================================================
export async function diagnoseNetwork(): Promise<NetworkDiagnostic> {
  logger.info('Running network diagnostics...')

  const issues: NetworkIssue[] = []
  let internetConnected = false
  let dnsWorking = false
  let gatewayReachable = false
  let latency = 0
  let dnsServer = ''
  let gateway = ''
  let publicIp: string | undefined

  // Get default gateway
  try {
    const netGateway = await si.networkGatewayDefault()
    gateway = netGateway || ''
  } catch {
    gateway = ''
  }

  // Check gateway reachability
  if (gateway) {
    try {
      const output = isWindows
        ? execFileSync('ping', ['-n', '1', '-w', '3000', gateway], { timeout: 5000, encoding: 'utf8' })
        : execFileSync('ping', ['-c', '1', '-W', '3', gateway], { timeout: 5000, encoding: 'utf8' })
      gatewayReachable = !output.includes('Request timed out') && !output.includes('100% packet loss')

      const timeMatch = output.match(/time[=<](\d+\.?\d*)/i)
      if (timeMatch) latency = parseFloat(timeMatch[1])
    } catch {
      gatewayReachable = false
      issues.push({
        type: 'gateway', severity: 'critical',
        description: `Cannot reach default gateway (${gateway}). Network adapter may be disconnected or misconfigured.`,
        fixAvailable: true, fixDescription: 'Reset network adapter and DHCP'
      })
    }
  } else {
    issues.push({
      type: 'gateway', severity: 'critical',
      description: 'No default gateway configured. The system has no network route.',
      fixAvailable: true, fixDescription: 'Reset network configuration and enable DHCP'
    })
  }

  // Check DNS resolution
  try {
    const dnsCmd = isWindows
      ? 'nslookup google.com 2>nul'
      : 'nslookup google.com 2>/dev/null || host google.com 2>/dev/null'
    const output = execSync(dnsCmd, { timeout: 10000, encoding: 'utf8' })
    dnsWorking = output.includes('Address') || output.includes('has address')

    const serverMatch = output.match(/Server:\s+(.+)/i)
    if (serverMatch) dnsServer = serverMatch[1].trim()
  } catch {
    dnsWorking = false
    issues.push({
      type: 'dns', severity: 'warning',
      description: 'DNS resolution is failing. Cannot resolve domain names.',
      fixAvailable: true, fixDescription: 'Flush DNS cache and set Google/Cloudflare DNS'
    })
  }

  // Check internet connectivity
  try {
    isWindows
      ? execFileSync('ping', ['-n', '1', '-w', '5000', '8.8.8.8'], { timeout: 8000, encoding: 'utf8' })
      : execFileSync('ping', ['-c', '1', '-W', '5', '8.8.8.8'], { timeout: 8000, encoding: 'utf8' })
    internetConnected = true
  } catch {
    internetConnected = false
    if (gatewayReachable) {
      issues.push({
        type: 'internet', severity: 'warning',
        description: 'Gateway is reachable but cannot reach the internet. ISP or firewall issue.',
        fixAvailable: true, fixDescription: 'Check proxy settings and firewall rules'
      })
    }
  }

  // Get public IP if connected
  if (internetConnected) {
    try {
      const ipCmd = isWindows
        ? 'powershell -NoProfile -Command "(Invoke-WebRequest -Uri \'https://api.ipify.org\' -TimeoutSec 5).Content"'
        : 'curl -s --connect-timeout 5 https://api.ipify.org 2>/dev/null || wget -qO- --timeout=5 https://api.ipify.org 2>/dev/null'
      publicIp = execSync(ipCmd, { timeout: 8000, encoding: 'utf8' }).trim()
    } catch {
      // Ignore - not critical
    }
  }

  // Check for proxy hijacking (Windows)
  if (isWindows) {
    try {
      const proxyEnabled = execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable 2>nul',
        { timeout: 5000, encoding: 'utf8' }
      )
      if (proxyEnabled.includes('0x1')) {
        const proxyServer = execSync(
          'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer 2>nul',
          { timeout: 5000, encoding: 'utf8' }
        )
        const rawProxy = proxyServer.match(/ProxyServer\s+REG_SZ\s+(.*)/)?.[1] || 'Unknown'
        const redactedProxy = rawProxy.replace(/\/\/[^/@]+@/, '//***@')
        issues.push({
          type: 'proxy', severity: 'warning',
          description: `Proxy is enabled: ${redactedProxy}. This may be a hijacker.`,
          fixAvailable: true, fixDescription: 'Disable proxy settings'
        })
      }
    } catch { /* Ignore */ }
  }

  // Check WiFi signal strength
  try {
    const wifiConnections = await si.wifiConnections()
    if (Array.isArray(wifiConnections) && wifiConnections.length > 0) {
      const wifi = wifiConnections[0]
      const signal = wifi.signalLevel || 0
      if (signal < -70) {
        issues.push({
          type: 'wifi_signal', severity: 'warning',
          description: `WiFi signal is weak (${signal} dBm). Consider moving closer to the router.`,
          fixAvailable: false
        })
      }
    }
  } catch { /* Ignore */ }

  // Check adapter power management
  if (isWindows) {
    try {
      const powerMgmt = execSync(
        'powershell -NoProfile -Command "Get-NetAdapter | Get-NetAdapterPowerManagement | Where-Object { $_.AllowComputerToTurnOffDevice -eq \'Enabled\' } | Select-Object Name | ConvertTo-Json"',
        { timeout: 10000, encoding: 'utf8' }
      )
      const adapters = JSON.parse(powerMgmt || '[]')
      const adapterList = Array.isArray(adapters) ? adapters : adapters?.Name ? [adapters] : []
      if (adapterList.length > 0) {
        issues.push({
          type: 'power_management', severity: 'info',
          description: `${adapterList.length} network adapter(s) allow Windows to turn them off to save power. This can cause random disconnections.`,
          fixAvailable: true, fixDescription: 'Disable power management for network adapters'
        })
      }
    } catch { /* Ignore */ }
  }

  logger.info(`Network diagnostics complete: internet=${internetConnected}, dns=${dnsWorking}, gateway=${gatewayReachable}`)

  return {
    internetConnected, dnsWorking, gatewayReachable,
    latency, dnsServer, gateway, publicIp, issues
  }
}

// ============================================================
// Network Fixes
// ============================================================
// Validate interface name: only allow alphanumeric, hyphens, underscores, dots, spaces
function sanitizeInterfaceName(name: string): string {
  const trimmed = name.trim()
  if (!/^[a-zA-Z0-9 _\-\.]+$/.test(trimmed) || !trimmed) {
    throw new Error(`Invalid network interface name: ${name}`)
  }
  return trimmed
}

export async function resetAdapter(iface: string): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    const safeIface = sanitizeInterfaceName(iface)
    if (isWindows) {
      execFileSync('netsh', ['interface', 'set', 'interface', safeIface, 'disable'], { timeout: 5000 })
      await new Promise(r => setTimeout(r, 2000))
      execFileSync('netsh', ['interface', 'set', 'interface', safeIface, 'enable'], { timeout: 5000 })
      changes.push({ type: 'network', action: 'modified', target: safeIface, before: 'disabled', after: 'enabled' })
      details.push(`Reset network adapter: ${safeIface}`)
    } else if (isMac) {
      execFileSync('sudo', ['ifconfig', safeIface, 'down'], { timeout: 5000 })
      execFileSync('sudo', ['ifconfig', safeIface, 'up'], { timeout: 5000 })
      changes.push({ type: 'network', action: 'modified', target: safeIface })
      details.push(`Reset network interface: ${safeIface}`)
    } else {
      execFileSync('sudo', ['ip', 'link', 'set', safeIface, 'down'], { timeout: 5000 })
      execFileSync('sudo', ['ip', 'link', 'set', safeIface, 'up'], { timeout: 5000 })
      changes.push({ type: 'network', action: 'modified', target: safeIface })
      details.push(`Reset network interface: ${safeIface}`)
    }

    return {
      success: true, module: 'network', action: 'reset_adapter',
      description: `Network adapter ${iface} reset successfully`, details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'network', action: 'reset_adapter',
      description: `Failed to reset adapter ${iface}`, details: [msg], changes, rollbackAvailable: false, error: msg
    }
  }
}

export async function flushDns(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWindows) {
      execFileSync('ipconfig', ['/flushdns'], { timeout: 5000, encoding: 'utf8' })
      // Detect active network interface and set Google DNS as fallback
      try {
        const ifaceOutput = execFileSync(
          'powershell', ['-NoProfile', '-Command', '(Get-NetAdapter | Where-Object { $_.Status -eq \'Up\' } | Select-Object -First 1).Name'],
          { timeout: 5000, encoding: 'utf8' }
        ).trim()
        if (ifaceOutput) {
          const safeIfaceOutput = sanitizeInterfaceName(ifaceOutput)
          try {
            execFileSync('netsh', ['interface', 'ip', 'set', 'dns', safeIfaceOutput, 'static', '8.8.8.8', 'primary'], { timeout: 5000 })
          } catch { /* best-effort */ }
          try {
            execFileSync('netsh', ['interface', 'ip', 'add', 'dns', safeIfaceOutput, '8.8.4.4', 'index=2'], { timeout: 5000 })
          } catch { /* best-effort */ }
        }
      } catch { /* DNS fallback is best-effort */ }
    } else if (isMac) {
      try {
        execSync('sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
        details.push('DNS cache flushed successfully')
        changes.push({ type: 'network', action: 'modified', target: 'DNS cache' })
      } catch {
        details.push('DNS cache flush failed (may require sudo privileges)')
      }
    } else {
      try {
        execSync('sudo systemd-resolve --flush-caches 2>/dev/null || sudo resolvectl flush-caches 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
        details.push('DNS cache flushed successfully')
        changes.push({ type: 'network', action: 'modified', target: 'DNS cache' })
      } catch {
        details.push('DNS cache flush failed (may require sudo privileges)')
      }
    }
    if (isWindows) {
      details.push('DNS cache flushed successfully')
      changes.push({ type: 'network', action: 'modified', target: 'DNS cache' })
    }

    return {
      success: true, module: 'network', action: 'flush_dns',
      description: 'DNS cache flushed', details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'network', action: 'flush_dns',
      description: 'DNS flush failed', details: [msg], changes, rollbackAvailable: false, error: msg
    }
  }
}

export async function resetWinsock(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  if (!isWindows) {
    return {
      success: true, module: 'network', action: 'reset_winsock',
      description: 'Winsock reset is Windows-only',
      details: ['Network stack reset not applicable on this OS'], changes, rollbackAvailable: false
    }
  }

  try {
    execFileSync('netsh', ['winsock', 'reset'], { timeout: 10000, encoding: 'utf8' })
    details.push('Winsock catalog reset successfully')
    changes.push({ type: 'network', action: 'modified', target: 'Winsock catalog' })

    return {
      success: true, module: 'network', action: 'reset_winsock',
      description: 'Winsock reset completed (restart recommended)', details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'network', action: 'reset_winsock',
      description: 'Winsock reset failed', details: [msg], changes, rollbackAvailable: false, error: msg
    }
  }
}

export async function resetTcpIp(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWindows) {
      execFileSync('netsh', ['int', 'ip', 'reset'], { timeout: 10000, encoding: 'utf8' })
      execFileSync('netsh', ['int', 'tcp', 'reset'], { timeout: 10000, encoding: 'utf8' })
      details.push('TCP/IP stack reset successfully')
      changes.push({ type: 'network', action: 'modified', target: 'TCP/IP stack' })
    } else {
      details.push('TCP/IP reset not required on this platform')
    }

    return {
      success: true, module: 'network', action: 'reset_tcpip',
      description: 'TCP/IP stack reset (restart recommended)', details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'network', action: 'reset_tcpip',
      description: 'TCP/IP reset failed', details: [msg], changes, rollbackAvailable: false, error: msg
    }
  }
}

// ============================================================
// Network Diagnostics Results
// ============================================================
export async function runNetworkDiagnostics(): Promise<DiagnosticResult[]> {
  const diag = await diagnoseNetwork()
  const results: DiagnosticResult[] = []

  if (!diag.internetConnected) {
    results.push({
      id: `net-no-internet-${Date.now()}`, module: 'network', category: 'Connectivity',
      title: 'No internet connection',
      severity: 'critical',
      description: 'This system cannot reach the internet',
      details: [
        `Gateway reachable: ${diag.gatewayReachable ? 'Yes' : 'No'}`,
        `DNS working: ${diag.dnsWorking ? 'Yes' : 'No'}`,
        `Gateway: ${diag.gateway || 'Not configured'}`
      ],
      fixAvailable: true, fixDescription: 'Reset network stack and DNS',
      fixRisk: 'low', autoFixable: true, timestamp: Date.now()
    })
  } else {
    results.push({
      id: `net-connected-${Date.now()}`, module: 'network', category: 'Connectivity',
      title: 'Internet connection active',
      severity: 'healthy',
      description: `Connected with ${diag.latency}ms latency`,
      details: [
        `Public IP: ${diag.publicIp || 'Unknown'}`,
        `DNS Server: ${diag.dnsServer || 'Unknown'}`,
        `Gateway: ${diag.gateway}`
      ],
      fixAvailable: false, fixRisk: 'none', autoFixable: false, timestamp: Date.now()
    })
  }

  for (const issue of diag.issues) {
    results.push({
      id: `net-issue-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      module: 'network', category: 'Network',
      title: issue.description.substring(0, 80),
      severity: issue.severity,
      description: issue.description,
      details: [],
      fixAvailable: issue.fixAvailable,
      fixDescription: issue.fixDescription,
      fixRisk: 'low', autoFixable: issue.fixAvailable, timestamp: Date.now()
    })
  }

  return results
}
