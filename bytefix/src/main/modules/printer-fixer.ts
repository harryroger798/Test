// ============================================================
// ByteFix Phase 2 — Printer Fixer Module
// Spooler repair, queue cleanup, port reconfig, driver management
// ============================================================

import { execSync, execFileSync } from 'child_process'
import { platform } from 'os'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('printer-fixer')

const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

function checkSpoolerService(): { running: boolean; startType: string } {
  if (!isWin) return { running: true, startType: 'N/A' }
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-Service Spooler | Select-Object Status, StartType | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const svc = JSON.parse(output)
      return {
        running: svc.Status === 4 || String(svc.Status) === 'Running',
        startType: svc.StartType === 2 ? 'Automatic' : String(svc.StartType || 'Unknown'),
      }
    }
  } catch { /* service query failed */ }
  return { running: false, startType: 'Unknown' }
}

function listPrinters(): { name: string; port: string; driver: string; status: string }[] {
  const printers: { name: string; port: string; driver: string; status: string }[] = []

  try {
    if (isWin) {
      const output = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }
      ).trim()
      if (output) {
        const parsed = JSON.parse(output)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const p of items) {
          const statusMap: Record<number, string> = { 0: 'Normal', 1: 'Paused', 2: 'Error', 3: 'Pending Deletion', 4: 'Paper Jam', 5: 'Paper Out', 6: 'Manual Feed', 7: 'Paper Problem' }
          printers.push({
            name: String(p.Name || ''),
            port: String(p.PortName || ''),
            driver: String(p.DriverName || ''),
            status: statusMap[p.PrinterStatus] || String(p.PrinterStatus || 'Unknown'),
          })
        }
      }
    } else if (isMac) {
      const output = execFileSync('lpstat', ['-p', '-d'], { encoding: 'utf8', timeout: 10000, stdio: 'pipe' })
      const printerLines = output.match(/printer\s+\S+/g) || []
      for (const line of printerLines) {
        const name = line.replace(/^printer\s+/, '').trim()
        printers.push({ name, port: '', driver: '', status: 'Detected' })
      }
    } else {
      try {
        const output = execFileSync('lpstat', ['-p'], { encoding: 'utf8', timeout: 5000, stdio: 'pipe' })
        const lines = output.split('\n').filter(Boolean)
        for (const line of lines) {
          const match = line.match(/printer\s+(\S+)\s+/)
          if (match) {
            printers.push({ name: match[1], port: '', driver: '', status: line.includes('enabled') ? 'Enabled' : 'Disabled' })
          }
        }
      } catch { /* no printers */ }
    }
  } catch (err) {
    logger.warn('Failed to list printers', err)
  }
  return printers
}

function countStuckJobs(): number {
  if (!isWin) return 0
  try {
    const output = execSync(
      'powershell -NoProfile -Command "(Get-ChildItem C:\\Windows\\System32\\spool\\PRINTERS\\ -ErrorAction SilentlyContinue).Count"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    return parseInt(output, 10) || 0
  } catch { return 0 }
}

function checkWsdPorts(): { name: string; address: string }[] {
  const wsdPorts: { name: string; address: string }[] = []
  if (!isWin) return wsdPorts

  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-PrinterPort | Where-Object { $_.Name -match \'WSD\' } | Select-Object Name, PrinterHostAddress | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
    ).trim()
    if (output) {
      const parsed = JSON.parse(output)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const port of items) {
        wsdPorts.push({
          name: String(port.Name || ''),
          address: String(port.PrinterHostAddress || ''),
        })
      }
    }
  } catch { /* no WSD ports */ }
  return wsdPorts
}

export async function runPrinterDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const timestamp = Date.now()

  try {
    if (isWin) {
      // 1. Check spooler service
      const spooler = checkSpoolerService()
      results.push({
        id: `prt-spooler-${timestamp}`,
        module: 'printer-fixer',
        category: 'Print Spooler',
        title: spooler.running ? 'Print Spooler Running' : 'Print Spooler Stopped',
        severity: spooler.running ? 'healthy' : 'error',
        description: spooler.running
          ? `Print Spooler service is active (${spooler.startType})`
          : 'Print Spooler service is stopped — printing will not work',
        details: [`Status: ${spooler.running ? 'Running' : 'Stopped'}`, `StartType: ${spooler.startType}`],
        fixAvailable: !spooler.running,
        fixDescription: 'Restart Print Spooler service',
        fixRisk: 'low',
        autoFixable: true,
        timestamp,
      })

      // 2. Check stuck print jobs
      const stuckJobs = countStuckJobs()
      if (stuckJobs > 0) {
        results.push({
          id: `prt-stuck-${timestamp}`,
          module: 'printer-fixer',
          category: 'Print Queue',
          title: `${stuckJobs} Stuck Print Job(s)`,
          severity: 'warning',
          description: `${stuckJobs} print job files found in spooler directory. These may be causing printing issues.`,
          details: [`Stuck spool files: ${stuckJobs}`, 'Clearing these will cancel all pending print jobs'],
          fixAvailable: true,
          fixDescription: 'Clear all stuck print jobs (nuclear spooler flush)',
          fixRisk: 'medium',
          autoFixable: false, // User should confirm — kills active jobs
          timestamp,
        })
      }

      // 3. Check WSD ports (unreliable)
      const wsdPorts = checkWsdPorts()
      if (wsdPorts.length > 0) {
        results.push({
          id: `prt-wsd-${timestamp}`,
          module: 'printer-fixer',
          category: 'Printer Ports',
          title: `${wsdPorts.length} WSD Port(s) Detected`,
          severity: 'info',
          description: 'WSD (Web Services for Devices) ports can be unreliable. Consider switching to TCP/IP.',
          details: [
            ...wsdPorts.map(p => `${p.name}: ${p.address}`),
            'WSD ports often cause "Printer Offline" issues',
            'Switching to TCP/IP port is more reliable',
          ],
          fixAvailable: wsdPorts.some(p => p.address),
          fixDescription: 'Convert WSD ports to TCP/IP for reliability',
          fixRisk: 'medium',
          autoFixable: false,
          timestamp,
        })
      }
    }

    // 4. List all printers
    const printers = listPrinters()
    if (printers.length > 0) {
      const offlinePrinters = printers.filter(p =>
        /offline|error|paused/i.test(p.status)
      )
      results.push({
        id: `prt-list-${timestamp}`,
        module: 'printer-fixer',
        category: 'Installed Printers',
        title: `${printers.length} Printer(s) Installed`,
        severity: offlinePrinters.length > 0 ? 'warning' : 'healthy',
        description: offlinePrinters.length > 0
          ? `${offlinePrinters.length} printer(s) offline or with errors`
          : 'All printers are in normal state',
        details: printers.map(p => `${p.name} [${p.status}] Port: ${p.port} Driver: ${p.driver}`),
        fixAvailable: offlinePrinters.length > 0,
        fixDescription: offlinePrinters.length > 0 ? 'Restart spooler and refresh printer connections' : undefined,
        fixRisk: 'low',
        autoFixable: true,
        timestamp,
      })
    } else {
      results.push({
        id: `prt-none-${timestamp}`,
        module: 'printer-fixer',
        category: 'Installed Printers',
        title: 'No Printers Found',
        severity: 'info',
        description: 'No printers are currently installed on this system',
        details: ['Connect a printer via USB or network to get started'],
        fixAvailable: isWin,
        fixDescription: 'Scan for printers and enable discovery services',
        fixRisk: 'low',
        autoFixable: true,
        timestamp,
      })
    }
  } catch (err) {
    logger.error('Printer diagnostics failed', err)
    results.push({
      id: `prt-error-${timestamp}`,
      module: 'printer-fixer',
      category: 'Error',
      title: 'Printer Diagnostics Error',
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

// Fix: Restart spooler
export async function restartSpooler(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync('powershell -NoProfile -Command "Restart-Service Spooler -Force"', { timeout: 15000, stdio: 'pipe' })
      details.push('Print Spooler service restarted')
      changes.push({ type: 'service', action: 'restarted', target: 'Spooler' })
    } else if (isMac) {
      try {
        execSync('osascript -e \'do shell script "launchctl stop org.cups.cupsd && launchctl start org.cups.cupsd" with administrator privileges\'', {
          timeout: 30000, stdio: 'pipe'
        })
        details.push('CUPS service restarted')
        changes.push({ type: 'service', action: 'restarted', target: 'cupsd' })
      } catch {
        details.push('Could not restart CUPS - administrator privileges required')
      }
    } else {
      try {
        execSync('pkexec systemctl restart cups', { timeout: 30000, stdio: 'pipe' })
        details.push('CUPS service restarted')
        changes.push({ type: 'service', action: 'restarted', target: 'cups' })
      } catch {
        details.push('Could not restart CUPS - elevated privileges required')
      }
    }

    return {
      success: true, module: 'printer-fixer', action: 'restart-spooler',
      description: 'Print spooler/CUPS service restarted',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'printer-fixer', action: 'restart-spooler',
      description: 'Failed to restart print spooler',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Clear all stuck print jobs (nuclear flush)
export async function clearPrintQueue(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      // Stop spooler
      execSync('powershell -NoProfile -Command "Stop-Service Spooler -Force"', { timeout: 15000, stdio: 'pipe' })
      details.push('Spooler stopped')

      // Clear spool directory
      execSync(
        'powershell -NoProfile -Command "Remove-Item \'C:\\Windows\\System32\\spool\\PRINTERS\\*\' -Force -Recurse -ErrorAction SilentlyContinue"',
        { timeout: 15000, stdio: 'pipe' }
      )
      details.push('Spool directory cleared')

      // Restart spooler
      execSync('powershell -NoProfile -Command "Start-Service Spooler"', { timeout: 15000, stdio: 'pipe' })
      details.push('Spooler restarted')
      changes.push({ type: 'file', action: 'cleared', target: 'Print spool directory' })
    } else if (isMac) {
      execSync('cancel -a 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      details.push('All print jobs cancelled')
      changes.push({ type: 'system', action: 'cleared', target: 'Print queue' })
    } else {
      execSync('cancel -a 2>/dev/null', { timeout: 5000, stdio: 'pipe' })
      details.push('All print jobs cancelled')
      changes.push({ type: 'system', action: 'cleared', target: 'Print queue' })
    }

    return {
      success: true, module: 'printer-fixer', action: 'clear-queue',
      description: 'All print jobs cleared and spooler restarted',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'printer-fixer', action: 'clear-queue',
      description: 'Failed to clear print queue',
      details: [...details, errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Convert WSD ports to TCP/IP
export async function convertWsdToTcpIp(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (!isWin) {
      return {
        success: false, module: 'printer-fixer', action: 'convert-wsd',
        description: 'WSD to TCP/IP conversion is Windows only',
        details: [], changes: [], rollbackAvailable: false, error: 'Windows only'
      }
    }

    const wsdPorts = checkWsdPorts()
    let converted = 0

    for (const port of wsdPorts) {
      if (!port.address) continue
      try {
        const newPortName = `TCPIP_${port.address}`
        // Add TCP/IP port
        execSync(
          `powershell -NoProfile -Command "Add-PrinterPort -Name '${newPortName}' -PrinterHostAddress '${port.address}' -ErrorAction Stop"`,
          { timeout: 10000, stdio: 'pipe' }
        )
        // Move printers from WSD to TCP/IP
        execSync(
          `powershell -NoProfile -Command "Get-Printer | Where-Object { $_.PortName -eq '${port.name}' } | Set-Printer -PortName '${newPortName}'"`,
          { timeout: 10000, stdio: 'pipe' }
        )
        details.push(`Converted ${port.name} → ${newPortName}`)
        converted++
        changes.push({ type: 'system', action: 'modified', target: `Printer port ${port.name}` })
      } catch (err) {
        details.push(`Failed to convert ${port.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return {
      success: converted > 0, module: 'printer-fixer', action: 'convert-wsd',
      description: `Converted ${converted} WSD port(s) to TCP/IP`,
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'printer-fixer', action: 'convert-wsd',
      description: 'WSD to TCP/IP conversion failed',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}

// Fix: Enable printer discovery services
export async function enablePrinterDiscovery(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  try {
    if (isWin) {
      execSync(
        'powershell -NoProfile -Command "Get-Service FDResPub, SSDPSRV -ErrorAction SilentlyContinue | Set-Service -StartupType Automatic; Get-Service FDResPub, SSDPSRV -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue"',
        { timeout: 15000, stdio: 'pipe' }
      )
      details.push('Function Discovery Resource Publication (FDResPub) enabled')
      details.push('SSDP Discovery (SSDPSRV) enabled')
      changes.push({ type: 'service', action: 'enabled', target: 'Printer discovery services' })

      // Scan for devices
      execSync('pnputil /scan-devices', { timeout: 30000, stdio: 'pipe' })
      details.push('Hardware scan completed')
    }

    return {
      success: true, module: 'printer-fixer', action: 'enable-discovery',
      description: 'Printer discovery services enabled',
      details, changes, rollbackAvailable: false
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false, module: 'printer-fixer', action: 'enable-discovery',
      description: 'Failed to enable printer discovery',
      details: [errMsg], changes, rollbackAvailable: false, error: errMsg
    }
  }
}
