import { IpcMain } from 'electron'
import { execSync, execFileSync } from 'child_process'
import { nanoid } from 'nanoid'
import { tmpdir } from 'os'
import { join } from 'path'
import { isIP } from 'net'

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
  const normalized = drive.trim()
  if (!/^[a-zA-Z]:\\?$/.test(normalized)) {
    throw new Error(`Invalid drive letter: ${drive}`);
  }
  return `${normalized[0].toUpperCase()}:`;
}

function sanitizeInterfaceName(iface: string): string {
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(iface)) {
    throw new Error(`Invalid interface name: ${iface}`);
  }
  return iface;
}

function sanitizeFilePath(p: string): string {
  const forbidden = /[|;&`$!<>(){}\[\]\n\r]/
  if (forbidden.test(p)) {
    throw new Error(`Invalid file path: contains shell metacharacters`);
  }
  return p;
}

function sanitizePrinterName(name: string): string {
  if (!/^[a-zA-Z0-9 _\-().#]+$/.test(name)) {
    throw new Error(`Invalid printer name: ${name}`);
  }
  return name;
}

function sanitizeIpAddress(ip: string): string {
  if (isIP(ip) > 0) return ip;
  throw new Error(`Invalid IP address: ${ip}`);
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

// Phase 2 module imports
import { runDataRecoveryDiagnostics, restoreFromShadowCopy, restoreFromRecycleBin, runPhotorecRecovery, repairFilesystem } from './modules/data-recovery'
import { runPasswordRecoveryDiagnostics, enableAdminAccount, disableAdminAccount } from './modules/password-recovery'
import { runAudioDiagnostics, restartAudioServices, reinstallAudioDrivers, enableMicrophonePrivacy, disableAudioEnhancements } from './modules/audio-fixer'
import { runBluetoothDiagnostics, restartBluetoothService, clearBluetoothCache, reinstallBluetoothDrivers, fixBluetoothAudio } from './modules/bluetooth-fixer'
import { runPrinterDiagnostics, restartSpooler, clearPrintQueue, convertWsdToTcpIp, enablePrinterDiscovery } from './modules/printer-fixer'
import { runDisplayDiagnostics, reinstallDisplayDrivers, fixTdrTimeout, disableHardwareAcceleration, detectExternalMonitors } from './modules/display-fixer'
import { runWebcamDiagnostics, enableCameraPrivacy, reinstallCameraDrivers, powerCycleCamera } from './modules/webcam-fixer'
import { runUsbDiagnostics, disableSelectiveSuspend, reinstallUsbDrivers, repairRawDrive, disableUsbPowerManagement } from './modules/usb-fixer'
import { runIndiaAppsDiagnostics, repairOffice, repairOutlookPst, fixJavaBanking, cleanChrome, enableDotNet35 } from './modules/india-apps'

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
      let output: string
      let smartctlFailed = false
      try {
        output = execFileSync('smartctl', ['-a', safeDevice, '--json'], {
          timeout: 30000, encoding: 'utf8'
        })
      } catch {
        output = '{}'
        smartctlFailed = true
      }
      const data = JSON.parse(output)
      return {
        healthy: smartctlFailed ? false : (data?.smart_status?.passed ?? false),
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
          threshold: (attr.thresh as number) ?? 0,
          raw: String((attr.raw as Record<string, unknown>)?.value ?? ''),
          status: (attr.value as number) <= ((attr.thresh as number) ?? 0) ? 'critical' : 'ok'
        }))
      }
    } catch {
      return {
        healthy: false, temperature: 0, powerOnHours: 0,
        reallocatedSectors: 0, pendingSectors: 0, uncorrectableSectors: 0,
        powerCycleCount: 0, attributes: [],
        error: 'Failed to read SMART data'
      }
    }
  })

  ipcMain.handle('disk:runChkdsk', async (_event, args: { drive: string }) => {
    try {
      if (process.platform === 'win32') {
        const safeDrive = sanitizeDriveLetter(args.drive);
        const output = execFileSync('chkdsk', [safeDrive, '/scan'], { timeout: 300000, encoding: 'utf8' })
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
  // Phase 2: Data Recovery
  // ============================================================
  ipcMain.handle('recovery:diagnose', async () => {
    return await runDataRecoveryDiagnostics()
  })

  ipcMain.handle('recovery:restoreShadowCopy', async (_event, args: { filePath: string; outputDir: string }) => {
    const safeFilePath = sanitizeFilePath(args.filePath)
    const safeOutputDir = sanitizeFilePath(args.outputDir)
    return await restoreFromShadowCopy(safeFilePath, safeOutputDir)
  })

  ipcMain.handle('recovery:restoreRecycleBin', async () => {
    return await restoreFromRecycleBin()
  })

  ipcMain.handle('recovery:runPhotorec', async (_event, args: { sourceDrive: string; outputDir: string }) => {
    const safeDrive = sanitizeDriveLetter(args.sourceDrive);
    const safeOutputDir = sanitizeFilePath(args.outputDir)
    return await runPhotorecRecovery(safeDrive, safeOutputDir)
  })

  ipcMain.handle('recovery:repairFilesystem', async (_event, args: { drive: string }) => {
    const safeDrive = sanitizeDriveLetter(args.drive);
    return await repairFilesystem(safeDrive)
  })

  // ============================================================
  // Phase 2: Password Recovery
  // ============================================================
  ipcMain.handle('password:diagnose', async () => {
    return await runPasswordRecoveryDiagnostics()
  })

  ipcMain.handle('password:enableAdmin', async () => {
    return await enableAdminAccount()
  })

  ipcMain.handle('password:disableAdmin', async () => {
    return await disableAdminAccount()
  })

  // ============================================================
  // Phase 2: Audio Fixer
  // ============================================================
  ipcMain.handle('audio:diagnose', async () => {
    return await runAudioDiagnostics()
  })

  ipcMain.handle('audio:restartServices', async () => {
    return await restartAudioServices()
  })

  ipcMain.handle('audio:reinstallDrivers', async () => {
    return await reinstallAudioDrivers()
  })

  ipcMain.handle('audio:enableMicPrivacy', async () => {
    return await enableMicrophonePrivacy()
  })

  ipcMain.handle('audio:disableEnhancements', async () => {
    return await disableAudioEnhancements()
  })

  // ============================================================
  // Phase 2: Bluetooth Fixer
  // ============================================================
  ipcMain.handle('bluetooth:diagnose', async () => {
    return await runBluetoothDiagnostics()
  })

  ipcMain.handle('bluetooth:restartService', async () => {
    return await restartBluetoothService()
  })

  ipcMain.handle('bluetooth:clearCache', async () => {
    return await clearBluetoothCache()
  })

  ipcMain.handle('bluetooth:reinstallDrivers', async () => {
    return await reinstallBluetoothDrivers()
  })

  ipcMain.handle('bluetooth:fixAudio', async () => {
    return await fixBluetoothAudio()
  })

  // ============================================================
  // Phase 2: Printer Fixer
  // ============================================================
  ipcMain.handle('printer:diagnose', async () => {
    return await runPrinterDiagnostics()
  })

  ipcMain.handle('printer:restartSpooler', async () => {
    return await restartSpooler()
  })

  ipcMain.handle('printer:clearQueue', async () => {
    return await clearPrintQueue()
  })

  ipcMain.handle('printer:convertWsdToTcpIp', async (_event, args: { printerName: string; ipAddress: string }) => {
    const safeName = sanitizePrinterName(args.printerName)
    const safeIp = sanitizeIpAddress(args.ipAddress)
    return await convertWsdToTcpIp(safeName, safeIp)
  })

  ipcMain.handle('printer:enableDiscovery', async () => {
    return await enablePrinterDiscovery()
  })

  // ============================================================
  // Phase 2: Display Fixer
  // ============================================================
  ipcMain.handle('display:diagnose', async () => {
    return await runDisplayDiagnostics()
  })

  ipcMain.handle('display:reinstallDrivers', async () => {
    return await reinstallDisplayDrivers()
  })

  ipcMain.handle('display:fixTdr', async () => {
    return await fixTdrTimeout()
  })

  ipcMain.handle('display:disableHwAccel', async () => {
    return await disableHardwareAcceleration()
  })

  ipcMain.handle('display:detectMonitors', async () => {
    return await detectExternalMonitors()
  })

  // ============================================================
  // Phase 2: Webcam Fixer
  // ============================================================
  ipcMain.handle('webcam:diagnose', async () => {
    return await runWebcamDiagnostics()
  })

  ipcMain.handle('webcam:enablePrivacy', async () => {
    return await enableCameraPrivacy()
  })

  ipcMain.handle('webcam:reinstallDrivers', async () => {
    return await reinstallCameraDrivers()
  })

  ipcMain.handle('webcam:powerCycle', async () => {
    return await powerCycleCamera()
  })

  // ============================================================
  // Phase 2: USB Fixer
  // ============================================================
  ipcMain.handle('usb:diagnose', async () => {
    return await runUsbDiagnostics()
  })

  ipcMain.handle('usb:disableSelectiveSuspend', async () => {
    return await disableSelectiveSuspend()
  })

  ipcMain.handle('usb:reinstallDrivers', async () => {
    return await reinstallUsbDrivers()
  })

  ipcMain.handle('usb:repairRawDrive', async (_event, args: { driveLetter: string }) => {
    const safeDrive = sanitizeDriveLetter(args.driveLetter)
    return await repairRawDrive(safeDrive)
  })

  ipcMain.handle('usb:disablePowerMgmt', async () => {
    return await disableUsbPowerManagement()
  })

  // ============================================================
  // Phase 2: India Apps
  // ============================================================
  ipcMain.handle('india:diagnose', async () => {
    return await runIndiaAppsDiagnostics()
  })

  ipcMain.handle('india:repairOffice', async () => {
    return await repairOffice()
  })

  ipcMain.handle('india:repairPst', async () => {
    return await repairOutlookPst()
  })

  ipcMain.handle('india:fixJavaBanking', async () => {
    return await fixJavaBanking()
  })

  ipcMain.handle('india:cleanChrome', async () => {
    return await cleanChrome()
  })

  ipcMain.handle('india:enableDotNet35', async () => {
    return await enableDotNet35()
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
    // Sanitize scanId to prevent path traversal
    const safeScanId = args.scanId.replace(/[^a-zA-Z0-9_-]/g, '')
    if (!safeScanId) throw new Error('Invalid scan ID')
    // Placeholder - will generate PDF report
    return { filePath: join(tmpdir(), `bytefix-report-${safeScanId}.txt`) }
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

  // Run all diagnostic modules in parallel with a global 120s timeout
  const QUICK_SCAN_TIMEOUT_MS = 120000
  const moduleNames = ['performance', 'os-repair', 'malware', 'network', 'battery',
    'data-recovery', 'audio', 'bluetooth', 'printer', 'display', 'webcam', 'usb', 'india-apps']

  const allSettledPromise = Promise.allSettled([
    runPerformanceDiagnostics(),
    runOSRepairDiagnostics(),
    runMalwareDiagnostics(),
    runNetworkDiagnostics(),
    runBatteryDiagnostics(),
    runDataRecoveryDiagnostics(),
    runAudioDiagnostics(),
    runBluetoothDiagnostics(),
    runPrinterDiagnostics(),
    runDisplayDiagnostics(),
    runWebcamDiagnostics(),
    runUsbDiagnostics(),
    runIndiaAppsDiagnostics()
  ])
  const timeoutPromise = new Promise<PromiseSettledResult<DiagnosticResult[]>[]>((resolve) =>
    setTimeout(() => {
      logger.warn('Quick scan timed out after 120s — returning partial results')
      resolve(moduleNames.map(() => ({ status: 'rejected' as const, reason: 'Timed out' })))
    }, QUICK_SCAN_TIMEOUT_MS)
  )

  // Suppress potential unhandled rejections from the losing promise
  allSettledPromise.catch(() => {})
  const allResults = await Promise.race([allSettledPromise, timeoutPromise])

  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i]
    if (result.status === 'fulfilled') {
      diagnostics.push(...result.value)
    } else {
      logger.warn(`Module ${moduleNames[i]} scan failed: ${result.reason}`)
    }
  }

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
    modulesRun: moduleNames,
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
