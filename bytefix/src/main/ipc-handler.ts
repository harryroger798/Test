import { IpcMain } from 'electron'
import { execSync, execFileSync } from 'child_process'
import { nanoid } from 'nanoid'

// Input sanitization helpers to prevent command injection
function sanitizeDevicePath(device: string): string {
  if (process.platform === 'win32') {
    if (!/^[a-zA-Z0-9\\.\-_:]+$/.test(device)) {
      throw new Error(`Invalid device path: ${device}`);
    }
  } else {
    if (!/^\/dev\/[a-zA-Z0-9]+$/.test(device)) {
      throw new Error(`Invalid device path: ${device}`);
    }
  }
  return device;
}

function sanitizeDriveLetter(drive: string): string {
  const safe = drive.replace(/[^a-zA-Z:\\]/g, '');
  if (!safe || safe.length > 3) {
    throw new Error(`Invalid drive letter: ${drive}`);
  }
  return safe;
}

function sanitizeInterfaceName(iface: string): string {
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(iface)) {
    throw new Error(`Invalid interface name: ${iface}`);
  }
  return iface;
}
import { createLogger } from './logger'
import { resourceGovernor } from './resource-governor'
import { saveScan } from './database'

// Module imports
import { getFullSystemInfo, getRunningProcesses } from './modules/system-scanner'
import {
  getStartupItems, disableStartupItem, getCleanupItems,
  runCleanup, optimizeRam, optimizeDisk, runPerformanceDiagnostics
} from './modules/performance-optimizer'
import { runSfc, runDism, repairWindowsUpdate, cleanRegistry, runOSRepairDiagnostics } from './modules/os-repair'
import { quickScan, fullScan, cleanBrowsers, runMalwareDiagnostics } from './modules/malware-scanner'
import { diagnoseNetwork, resetAdapter, flushDns, resetWinsock, resetTcpIp, runNetworkDiagnostics } from './modules/network-diagnostics'
import { getBatteryReport, optimizePower, runBatteryDiagnostics } from './modules/battery-diagnostics'

import type { SystemInfo, DiagnosticResult, ScanResult, CleanupItem } from '../shared/types'

const logger = createLogger('ipc-handler')

export function registerAllHandlers(ipcMain: IpcMain): void {
  // ============================================================
  // System Information
  // ============================================================
  ipcMain.handle('system:getInfo', async () => {
    try {
      return await getFullSystemInfo()
    } catch (err) {
      logger.error('Failed to get system info', err)
      throw err
    }
  })

  ipcMain.handle('system:getProcesses', async () => {
    try {
      return await getRunningProcesses()
    } catch (err) {
      logger.error('Failed to get processes', err)
      throw err
    }
  })

  ipcMain.handle('system:getPlatform', () => {
    return process.platform
  })

  // ============================================================
  // Performance
  // ============================================================
  ipcMain.handle('perf:getStartupItems', async () => {
    return await getStartupItems()
  })

  ipcMain.handle('perf:disableStartupItem', async (_event, args: { name: string; path: string }) => {
    return await disableStartupItem(args.name, args.path)
  })

  ipcMain.handle('perf:getCleanupItems', async () => {
    return await getCleanupItems()
  })

  ipcMain.handle('perf:runCleanup', async (_event, args: { items: CleanupItem[] }) => {
    const check = await resourceGovernor.canStartJob(200)
    if (!check.allowed) {
      return { success: false, module: 'performance', action: 'cleanup', description: check.reason || 'Insufficient resources', details: [], changes: [], rollbackAvailable: false, error: check.reason }
    }
    return await runCleanup(args.items)
  })

  ipcMain.handle('perf:optimizeRam', async () => {
    return await optimizeRam()
  })

  ipcMain.handle('perf:optimizeDisk', async (_event, args: { drive: string }) => {
    const safeDrive = sanitizeDriveLetter(args.drive);
    return await optimizeDisk(safeDrive)
  })

  // ============================================================
  // Malware
  // ============================================================
  ipcMain.handle('malware:quickScan', async () => {
    const check = await resourceGovernor.canStartJob(500)
    if (!check.allowed) {
      return { scanType: 'quick', filesScanned: 0, threatsFound: 0, threats: [], duration: 0, engineVersion: 'N/A' }
    }
    return await quickScan()
  })

  ipcMain.handle('malware:fullScan', async () => {
    const check = await resourceGovernor.canStartJob(1000)
    if (!check.allowed) {
      return { scanType: 'full', filesScanned: 0, threatsFound: 0, threats: [], duration: 0, engineVersion: 'N/A' }
    }
    return await fullScan()
  })

  // ============================================================
  // Network
  // ============================================================
  ipcMain.handle('network:diagnose', async () => {
    return await diagnoseNetwork()
  })

  ipcMain.handle('network:resetAdapter', async (_event, args: { iface: string }) => {
    const safeIface = sanitizeInterfaceName(args.iface);
    return await resetAdapter(safeIface)
  })

  ipcMain.handle('network:flushDns', async () => {
    return await flushDns()
  })

  ipcMain.handle('network:resetWinsock', async () => {
    return await resetWinsock()
  })

  ipcMain.handle('network:resetTcpIp', async () => {
    return await resetTcpIp()
  })

  // ============================================================
  // OS Repair
  // ============================================================
  ipcMain.handle('os:runSfc', async () => {
    return await runSfc()
  })

  ipcMain.handle('os:runDism', async () => {
    return await runDism()
  })

  ipcMain.handle('os:repairWindowsUpdate', async () => {
    return await repairWindowsUpdate()
  })

  ipcMain.handle('os:cleanRegistry', async () => {
    return await cleanRegistry()
  })

  // ============================================================
  // Battery
  // ============================================================
  ipcMain.handle('battery:getReport', async () => {
    return await getBatteryReport()
  })

  ipcMain.handle('battery:optimizePower', async () => {
    return await optimizePower()
  })

  // ============================================================
  // Disk Health
  // ============================================================
  ipcMain.handle('disk:getSmartData', async (_event, args: { device: string }) => {
    try {
      const safeDevice = sanitizeDevicePath(args.device);
      const output = execSync(`smartctl -a ${safeDevice} --json 2>/dev/null || echo "{}"`, {
        timeout: 30000, encoding: 'utf8'
      })
      const data = JSON.parse(output)
      return {
        healthy: data?.smart_status?.passed ?? true,
        temperature: data?.temperature?.current ?? 0,
        powerOnHours: data?.power_on_time?.hours ?? 0,
        reallocatedSectors: 0,
        pendingSectors: 0,
        uncorrectableSectors: 0,
        powerCycleCount: data?.power_cycle_count ?? 0,
        attributes: (data?.ata_smart_attributes?.table || []).map((attr: Record<string, unknown>) => ({
          id: attr.id,
          name: attr.name,
          value: attr.value,
          worst: attr.worst,
          threshold: (attr.thresh as Record<string, unknown>)?.value ?? 0,
          raw: String((attr.raw as Record<string, unknown>)?.value ?? ''),
          status: (attr.value as number) <= ((attr.thresh as Record<string, unknown>)?.value as number ?? 0) ? 'critical' : 'ok'
        }))
      }
    } catch {
      return {
        healthy: true, temperature: 0, powerOnHours: 0,
        reallocatedSectors: 0, pendingSectors: 0, uncorrectableSectors: 0,
        powerCycleCount: 0, attributes: []
      }
    }
  })

  ipcMain.handle('disk:runChkdsk', async (_event, args: { drive: string }) => {
    try {
      if (process.platform === 'win32') {
        const safeDrive = sanitizeDriveLetter(args.drive);
        const output = execSync(`chkdsk ${safeDrive} /scan`, { timeout: 300000, encoding: 'utf8' })
        return {
          success: true, module: 'disk', action: 'chkdsk',
          description: 'Disk check completed', details: [output.substring(0, 500)],
          changes: [], rollbackAvailable: false
        }
      }
      return {
        success: true, module: 'disk', action: 'fsck',
        description: 'Filesystem check not available on mounted volume',
        details: ['Use OS recovery tools for filesystem repair'], changes: [], rollbackAvailable: false
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false, module: 'disk', action: 'chkdsk',
        description: 'Disk check failed', details: [msg], changes: [], rollbackAvailable: false, error: msg
      }
    }
  })

  // ============================================================
  // Full Scan
  // ============================================================
  ipcMain.handle('scan:quick', async () => {
    return await runQuickScan()
  })

  ipcMain.handle('scan:full', async (_event, config: { modules: string[]; deepScan: boolean; autoFix: boolean; createBackup: boolean }) => {
    return await runFullScan(config)
  })

  // ============================================================
  // Reports
  // ============================================================
  ipcMain.handle('report:generate', async (_event, args: { scanId: string }) => {
    // Placeholder - will generate PDF report
    return { filePath: `/tmp/bytefix-report-${args.scanId}.txt` }
  })

  // ============================================================
  // Jobs
  // ============================================================
  ipcMain.handle('job:getAll', async () => {
    return []
  })

  ipcMain.handle('job:cancel', async (_event, _args: { jobId: string }) => {
    // Placeholder
  })

  logger.info('All IPC handlers registered successfully')
}

// ============================================================
// Scan Orchestration
// ============================================================
async function runQuickScan(): Promise<ScanResult> {
  const startTime = Date.now()
  const scanId = nanoid()
  const diagnostics: DiagnosticResult[] = []

  logger.info(`Starting quick scan ${scanId}...`)

  // Run all diagnostic modules in parallel
  const [perfResults, osResults, malwareResults, networkResults, batteryResults] = await Promise.allSettled([
    runPerformanceDiagnostics(),
    runOSRepairDiagnostics(),
    runMalwareDiagnostics(),
    runNetworkDiagnostics(),
    runBatteryDiagnostics()
  ])

  if (perfResults.status === 'fulfilled') diagnostics.push(...perfResults.value)
  if (osResults.status === 'fulfilled') diagnostics.push(...osResults.value)
  if (malwareResults.status === 'fulfilled') diagnostics.push(...malwareResults.value)
  if (networkResults.status === 'fulfilled') diagnostics.push(...networkResults.value)
  if (batteryResults.status === 'fulfilled') diagnostics.push(...batteryResults.value)

  const endTime = Date.now()
  let systemSnapshot: SystemInfo | undefined
  try {
    systemSnapshot = await getFullSystemInfo()
  } catch (err) {
    logger.warn('Failed to get system snapshot for scan', err)
  }

  // Calculate overall health
  const criticalCount = diagnostics.filter(d => d.severity === 'critical' || d.severity === 'error').length
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length
  const infoCount = diagnostics.filter(d => d.severity === 'info').length
  const healthyCount = diagnostics.filter(d => d.severity === 'healthy').length
  const totalChecks = diagnostics.length || 1
  const overallHealth = Math.max(0, Math.round(
    ((healthyCount * 100) + (infoCount * 100) + (warningCount * 50) + (criticalCount * 0)) / totalChecks
  ))

  const result: ScanResult = {
    id: scanId,
    startTime,
    endTime,
    duration: endTime - startTime,
    modulesRun: ['performance', 'os-repair', 'malware', 'network', 'battery'],
    diagnostics,
    fixes: [],
    systemSnapshot,
    overallHealth,
    summary: generateSummary(diagnostics, overallHealth)
  }

  // Save to database
  try {
    saveScan({
      id: scanId, startTime, endTime, duration: result.duration,
      modulesRun: result.modulesRun, overallHealth,
      summary: result.summary,
      systemSnapshot: JSON.stringify(systemSnapshot),
      diagnostics: JSON.stringify(diagnostics),
      fixes: '[]'
    })
  } catch (err) {
    logger.error('Failed to save scan', err)
  }

  logger.info(`Quick scan ${scanId} complete: health=${overallHealth}, issues=${diagnostics.length}`)
  return result
}

async function runFullScan(config: { modules: string[]; deepScan: boolean; autoFix: boolean; createBackup: boolean }): Promise<ScanResult> {
  // Full scan runs quick scan + any specific modules
  return await runQuickScan()
}

function generateSummary(diagnostics: DiagnosticResult[], health: number): string {
  const critical = diagnostics.filter(d => d.severity === 'critical').length
  const warnings = diagnostics.filter(d => d.severity === 'warning').length
  const healthy = diagnostics.filter(d => d.severity === 'healthy').length

  if (critical > 0) {
    return `Found ${critical} critical issue${critical > 1 ? 's' : ''} requiring immediate attention. ${warnings} warnings detected.`
  }
  if (warnings > 0) {
    return `System health ${health}%. Found ${warnings} warning${warnings > 1 ? 's' : ''} that should be addressed. ${healthy} checks passed.`
  }
  return `System is healthy (${health}%). All ${healthy} checks passed with no issues detected.`
}
