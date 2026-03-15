import { execSync } from 'child_process'
import { platform, tmpdir } from 'os'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { BatteryInfo, FixResult, FixChange, DiagnosticResult } from '../../shared/types'

const logger = createLogger('battery-diagnostics')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'

// ============================================================
// Battery Report
// ============================================================
export async function getBatteryReport(): Promise<BatteryInfo> {
  const battery = await si.battery()

  const info: BatteryInfo = {
    hasBattery: battery.hasBattery,
    isCharging: battery.isCharging,
    percent: battery.percent,
    cycleCount: battery.cycleCount || 0,
    designCapacity: battery.designedCapacity || 0,
    currentCapacity: battery.currentCapacity || 0,
    healthPercent: battery.designedCapacity > 0
      ? Math.round((battery.currentCapacity / battery.designedCapacity) * 100)
      : 100,
    voltage: battery.voltage || 0,
    timeRemaining: battery.timeRemaining || 0,
    manufacturer: battery.manufacturer || 'Unknown',
    model: battery.model || 'Unknown',
    powerSource: battery.isCharging || !battery.hasBattery ? 'AC' : 'Battery'
  }

  // Windows: Get detailed battery report via powercfg
  if (isWindows && battery.hasBattery) {
    try {
      const reportPath = join(tmpdir(), 'battery-report.html')
      execSync(`powercfg /batteryreport /output "${reportPath}" 2>nul`, { timeout: 15000 })
      if (existsSync(reportPath)) {
        const html = readFileSync(reportPath, 'utf8')
        // Parse design capacity
        const designMatch = html.match(/DESIGN CAPACITY.*?(\d[\d,]+)\s*mWh/i)
        if (designMatch) info.designCapacity = parseInt(designMatch[1].replace(',', ''))
        // Parse full charge capacity
        const fullMatch = html.match(/FULL CHARGE CAPACITY.*?(\d[\d,]+)\s*mWh/i)
        if (fullMatch) {
          info.currentCapacity = parseInt(fullMatch[1].replace(',', ''))
          if (info.designCapacity > 0) {
            info.healthPercent = Math.round((info.currentCapacity / info.designCapacity) * 100)
          }
        }
        // Parse cycle count
        const cycleMatch = html.match(/CYCLE COUNT.*?(\d+)/i)
        if (cycleMatch) info.cycleCount = parseInt(cycleMatch[1])
      }
    } catch (err) {
      logger.warn('Could not generate powercfg battery report', err)
    }
  }

  // macOS: Get detailed battery info via ioreg
  if (isMac && battery.hasBattery) {
    try {
      const ioregOutput = execSync('ioreg -l -w0 | grep -i "\"CycleCount\\|\"DesignCapacity\\|\"MaxCapacity"', {
        timeout: 5000, encoding: 'utf8'
      })
      const cycleMatch = ioregOutput.match(/"CycleCount"\s*=\s*(\d+)/)
      if (cycleMatch) info.cycleCount = parseInt(cycleMatch[1])
      const designMatch = ioregOutput.match(/"DesignCapacity"\s*=\s*(\d+)/)
      if (designMatch) info.designCapacity = parseInt(designMatch[1])
      const maxMatch = ioregOutput.match(/"MaxCapacity"\s*=\s*(\d+)/)
      if (maxMatch) {
        info.currentCapacity = parseInt(maxMatch[1])
        if (info.designCapacity > 0) {
          info.healthPercent = Math.round((info.currentCapacity / info.designCapacity) * 100)
        }
      }
    } catch { /* Ignore */ }
  }

  return info
}

// ============================================================
// Power Optimization
// ============================================================
export async function optimizePower(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    // Set balanced power plan
    try {
      execSync('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>nul', { timeout: 5000 })
      details.push('Set Balanced power plan')
      changes.push({ type: 'system', action: 'modified', target: 'Power plan', after: 'Balanced' })
    } catch { /* Ignore */ }

    // Disable power-hungry background apps
    try {
      execSync('powershell -NoProfile -Command "Get-AppxPackage | ForEach-Object { if ($_.PackageFamilyName) { Set-AppBackgroundTaskResourcePolicy -PackageFamilyName $_.PackageFamilyName -Policy \'Conservative\' 2>$null } }"', { timeout: 30000 })
      details.push('Set background apps to conservative mode')
    } catch { /* Ignore */ }

    // Optimize screen timeout
    try {
      execSync('powercfg /change monitor-timeout-dc 5', { timeout: 5000 })
      execSync('powercfg /change monitor-timeout-ac 15', { timeout: 5000 })
      details.push('Optimized screen timeout (5min battery, 15min AC)')
      changes.push({ type: 'system', action: 'modified', target: 'Screen timeout' })
    } catch { /* Ignore */ }

    // Optimize sleep timeout
    try {
      execSync('powercfg /change standby-timeout-dc 15', { timeout: 5000 })
      execSync('powercfg /change standby-timeout-ac 30', { timeout: 5000 })
      details.push('Optimized sleep timeout (15min battery, 30min AC)')
    } catch { /* Ignore */ }

    // Disable wake timers
    try {
      execSync('powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 0 2>nul', { timeout: 5000 })
      execSync('powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 0 2>nul', { timeout: 5000 })
      details.push('Disabled wake timers')
      changes.push({ type: 'system', action: 'disabled', target: 'Wake timers' })
    } catch { /* Ignore */ }

    // Apply changes
    try {
      execSync('powercfg /setactive SCHEME_CURRENT 2>nul', { timeout: 5000 })
    } catch { /* Ignore */ }
  } else if (isMac) {
    try {
      execSync('sudo pmset -b displaysleep 5 2>/dev/null || true', { timeout: 5000 })
      execSync('sudo pmset -b sleep 15 2>/dev/null || true', { timeout: 5000 })
      details.push('Optimized macOS power settings')
    } catch { /* Ignore */ }
  } else {
    // Linux
    try {
      // Check for TLP
      const hasTlp = execSync('which tlp 2>/dev/null || echo ""', { encoding: 'utf8' }).trim()
      if (hasTlp) {
        execSync('sudo tlp bat 2>/dev/null || true', { timeout: 5000 })
        details.push('Activated TLP battery mode')
      } else {
        details.push('TLP not installed - consider installing for better battery management')
      }
    } catch { /* Ignore */ }
  }

  return {
    success: true, module: 'battery', action: 'optimize_power',
    description: 'Power optimization complete', details, changes, rollbackAvailable: true
  }
}

// ============================================================
// Battery Diagnostics
// ============================================================
export async function runBatteryDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  const battery = await getBatteryReport()

  if (!battery.hasBattery) {
    results.push({
      id: `bat-none-${Date.now()}`, module: 'battery', category: 'Battery',
      title: 'No battery detected',
      severity: 'info',
      description: 'This system does not have a battery (desktop or battery not detected)',
      details: [], fixAvailable: false, fixRisk: 'none', autoFixable: false, timestamp: Date.now()
    })
    return results
  }

  // Battery health check
  if (battery.healthPercent < 40) {
    results.push({
      id: `bat-health-${Date.now()}`, module: 'battery', category: 'Battery Health',
      title: `Battery health critical: ${battery.healthPercent}%`,
      severity: 'critical',
      description: `Battery has degraded to ${battery.healthPercent}% of original capacity. Replacement recommended.`,
      details: [
        `Design capacity: ${battery.designCapacity} mWh`,
        `Current capacity: ${battery.currentCapacity} mWh`,
        `Cycle count: ${battery.cycleCount}`,
        `Health: ${battery.healthPercent}%`
      ],
      fixAvailable: false, fixDescription: 'Battery replacement needed - hardware issue',
      fixRisk: 'none', autoFixable: false, timestamp: Date.now()
    })
  } else if (battery.healthPercent < 70) {
    results.push({
      id: `bat-health-${Date.now()}`, module: 'battery', category: 'Battery Health',
      title: `Battery health degraded: ${battery.healthPercent}%`,
      severity: 'warning',
      description: `Battery has degraded to ${battery.healthPercent}%. Consider replacement within 6 months.`,
      details: [
        `Design: ${battery.designCapacity} mWh | Current: ${battery.currentCapacity} mWh`,
        `Cycles: ${battery.cycleCount}`
      ],
      fixAvailable: true, fixDescription: 'Optimize power settings to extend battery life',
      fixRisk: 'none', autoFixable: true, timestamp: Date.now()
    })
  } else {
    results.push({
      id: `bat-health-${Date.now()}`, module: 'battery', category: 'Battery Health',
      title: `Battery health good: ${battery.healthPercent}%`,
      severity: 'healthy',
      description: `Battery is at ${battery.healthPercent}% of original capacity`,
      details: [
        `Design: ${battery.designCapacity} mWh | Current: ${battery.currentCapacity} mWh`,
        `Cycles: ${battery.cycleCount} | Charge: ${battery.percent}%`
      ],
      fixAvailable: false, fixRisk: 'none', autoFixable: false, timestamp: Date.now()
    })
  }

  // High cycle count warning
  if (battery.cycleCount > 500) {
    results.push({
      id: `bat-cycles-${Date.now()}`, module: 'battery', category: 'Battery Cycles',
      title: `High cycle count: ${battery.cycleCount}`,
      severity: battery.cycleCount > 1000 ? 'warning' : 'info',
      description: `Battery has been through ${battery.cycleCount} charge cycles`,
      details: ['Most batteries are rated for 300-500 cycles', `Current: ${battery.cycleCount} cycles`],
      fixAvailable: false, fixRisk: 'none', autoFixable: false, timestamp: Date.now()
    })
  }

  return results
}
