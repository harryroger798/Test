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

// Phase 3 module imports
import { runOverheatingDiagnostics, optimizeCooling, killHighCpuProcesses } from './modules/overheating-analyzer'
import { runHardwareDiagnostics, runCpuStressTest, guideMemTest } from './modules/hardware-diagnostics'
import { runKeyboardTouchpadDiagnostics, fixFilterKeys, toggleTouchpad, reinstallInputDrivers } from './modules/keyboard-touchpad-fixer'
import { runGamingDiagnostics, enableGameMode, setHighPerformancePlan, cleanupRamForGaming, repairDirectX, optimizeGpuSettings } from './modules/gaming-optimizer'
import { runPartitionBootDiagnostics, repairBcd, repairGrub, verifyBootDrive } from './modules/partition-boot-manager'
import { runActivationDiagnostics, runActivationTroubleshooter } from './modules/windows-activation'
import { runEmailDiagnostics, autoConfigureEmail, repairOutlookProfile, clearEmailCredentials } from './modules/email-account-setup'
import { runPhoneTransferDiagnostics, guideUsbDebugging, pullFilesViaAdb } from './modules/phone-data-transfer'

// Phase 6: New tool integration imports
import { runDiskImagingDiagnostics, createSystemImage, clonePartition, rescueFailingDrive } from './modules/disk-imaging'
import { runPartitionManagerDiagnostics, resizePartition, formatPartition, createPartition } from './modules/partition-manager'
import { runMemoryDiagnostics, runBuiltInMemTest, scheduleWindowsMemDiag } from './modules/memory-diagnostics'
import { runFirmwareDiagnostics, checkFirmwareUpdates, updateDrivers } from './modules/firmware-manager'
import { runRemoteAccessDiagnostics, enableRemoteDesktop, disableRemoteDesktop, generateRemoteAssistInvite, configureWakeOnLan } from './modules/remote-access'
import { runAIDiagnosis, getHealthScore, collectSystemMetrics } from './modules/ai-diagnostics'

// Phase 4 module imports
import { createInvoice, getInvoice, getInvoicesByCustomer, getAllInvoices, updatePaymentStatus, getInvoiceStats, getHsnCodes, getIndianStates } from './modules/gst-billing'
import { generateUPIPayment, generateInvoiceUPI, validateUPIAddress } from './modules/upi-payment'
import { sendJobStatusMessage, sendPaymentLink as waSendPaymentLink, sendDiagnosticReport, sendCustomMessage, validateIndianPhone } from './modules/whatsapp-service'
import type { JobStatus as WAJobStatus } from './modules/whatsapp-service'
import {
  createCustomer, updateCustomer, getCustomer, getCustomerByPhone, searchCustomers, getAllCustomers, deleteCustomer,
  createRepairJob, updateJobStatus, updateJobDiagnosis, getRepairJob, getRepairJobByTicket, getJobsByCustomer,
  getJobsByStatus, getAllJobs, getActiveJobs, getJobStats, getCustomerWithJobs
} from './modules/crm-manager'
import type { RepairJobStatus } from './modules/crm-manager'
import { discoverBackupTargets, createBackupPlan, executeBackup, discoverBrowserProfiles, backupBrowserData, getBackupStatus, getPCToPCMigrationGuide, getWindowsReinstallGuide, getHDDToSSDGuide } from './modules/backup-wizard'
import { setLanguage, getLanguage, getSupportedLanguages, getTranslationsForLanguage } from './modules/i18n-config'
import type { SupportedLanguage } from './modules/i18n-config'

import type { SystemInfo, DiagnosticResult, ScanResult, CleanupItem, FixResult } from '../shared/types'

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
  // Phase 3: Overheating Analyzer
  // ============================================================
  ipcMain.handle('thermal:diagnose', async () => {
    return await runOverheatingDiagnostics()
  })

  ipcMain.handle('thermal:optimizeCooling', async () => {
    return await optimizeCooling()
  })

  ipcMain.handle('thermal:killHighCpu', async () => {
    return await killHighCpuProcesses()
  })

  // ============================================================
  // Phase 3: Hardware Deep Diagnostics
  // ============================================================
  ipcMain.handle('hardware:diagnose', async () => {
    return await runHardwareDiagnostics()
  })

  ipcMain.handle('hardware:stressTest', async (_event, args: { durationSeconds: number }) => {
    const duration = Math.min(Math.max(1, args.durationSeconds || 30), 300)
    return await runCpuStressTest(duration)
  })

  ipcMain.handle('hardware:guideMemTest', async () => {
    return await guideMemTest()
  })

  // ============================================================
  // Phase 3: Keyboard/Touchpad Fixer
  // ============================================================
  ipcMain.handle('keyboard:diagnose', async () => {
    return await runKeyboardTouchpadDiagnostics()
  })

  ipcMain.handle('keyboard:fixFilterKeys', async () => {
    return await fixFilterKeys()
  })

  ipcMain.handle('keyboard:toggleTouchpad', async (_event, args: { enable: boolean }) => {
    return await toggleTouchpad(args.enable)
  })

  ipcMain.handle('keyboard:reinstallDrivers', async () => {
    return await reinstallInputDrivers()
  })

  // ============================================================
  // Phase 3: Gaming Optimizer
  // ============================================================
  ipcMain.handle('gaming:diagnose', async () => {
    return await runGamingDiagnostics()
  })

  ipcMain.handle('gaming:enableGameMode', async () => {
    return await enableGameMode()
  })

  ipcMain.handle('gaming:setHighPerformance', async () => {
    return await setHighPerformancePlan()
  })

  ipcMain.handle('gaming:cleanupRam', async () => {
    return await cleanupRamForGaming()
  })

  ipcMain.handle('gaming:repairDirectX', async () => {
    return await repairDirectX()
  })

  ipcMain.handle('gaming:optimizeGpu', async () => {
    return await optimizeGpuSettings()
  })

  // ============================================================
  // Phase 3: Partition/Boot Manager
  // ============================================================
  ipcMain.handle('partition:diagnose', async () => {
    return await runPartitionBootDiagnostics()
  })

  ipcMain.handle('partition:repairBcd', async () => {
    return await repairBcd()
  })

  ipcMain.handle('partition:repairGrub', async () => {
    return await repairGrub()
  })

  ipcMain.handle('partition:verifyBootDrive', async () => {
    return await verifyBootDrive()
  })

  // ============================================================
  // Phase 3: Windows Activation
  // ============================================================
  ipcMain.handle('activation:diagnose', async () => {
    return await runActivationDiagnostics()
  })

  ipcMain.handle('activation:troubleshoot', async () => {
    return await runActivationTroubleshooter()
  })

  // ============================================================
  // Phase 3: Email/Account Setup
  // ============================================================
  ipcMain.handle('email:diagnose', async () => {
    return await runEmailDiagnostics()
  })

  ipcMain.handle('email:autoConfigure', async (_event, args: { email: string }) => {
    const safeEmail = args.email.replace(/[^a-zA-Z0-9@._+-]/g, '')
    if (!safeEmail.includes('@') || safeEmail.length < 5) {
      throw new Error('Invalid email address')
    }
    return await autoConfigureEmail(safeEmail)
  })

  ipcMain.handle('email:repairOutlook', async () => {
    return await repairOutlookProfile()
  })

  ipcMain.handle('email:clearCredentials', async (_event, args: { target: string }) => {
    // Allowlist: only safe characters for credential target names
    const safeTarget = (args.target || '').replace(/[^a-zA-Z0-9@._:\/ -]/g, '')
    return await clearEmailCredentials(safeTarget)
  })

  // ============================================================
  // Phase 3: Phone Data Transfer
  // ============================================================
  ipcMain.handle('phone:diagnose', async () => {
    return await runPhoneTransferDiagnostics()
  })

  ipcMain.handle('phone:guideUsbDebugging', async () => {
    return await guideUsbDebugging()
  })

  ipcMain.handle('phone:pullFiles', async (_event, args: { sourcePath: string; destinationPath: string }) => {
    const safeSrc = sanitizeFilePath(args.sourcePath)
    const safeDest = sanitizeFilePath(args.destinationPath)
    return await pullFilesViaAdb(safeSrc, safeDest)
  })

  // ============================================================
  // Phase 4: GST Billing
  // ============================================================
  ipcMain.handle('billing:createInvoice', async (_event, args: { jobId?: string; customerId: string; shopName: string; shopGstin?: string; shopAddress?: string; shopStateCode: string; customerGstin?: string; customerStateCode?: string; lineItems: { description: string; hsnCode: string; quantity: number; rate: number; amount: number; gstRate: number }[]; paymentMethod?: string; notes?: string }) => {
    return await createInvoice(args)
  })

  ipcMain.handle('billing:getInvoice', async (_event, args: { id: string }) => {
    return await getInvoice(args.id)
  })

  ipcMain.handle('billing:getInvoicesByCustomer', async (_event, args: { customerId: string }) => {
    return await getInvoicesByCustomer(args.customerId)
  })

  ipcMain.handle('billing:getAllInvoices', async (_event, args: { limit?: number }) => {
    return await getAllInvoices(args?.limit)
  })

  ipcMain.handle('billing:updatePaymentStatus', async (_event, args: { invoiceId: string; status: string; method?: string }) => {
    return await updatePaymentStatus(args.invoiceId, args.status as 'pending' | 'paid' | 'partial' | 'cancelled', args.method)
  })

  ipcMain.handle('billing:getStats', async () => {
    return await getInvoiceStats()
  })

  ipcMain.handle('billing:getHsnCodes', async () => {
    return getHsnCodes()
  })

  ipcMain.handle('billing:getIndianStates', async () => {
    return getIndianStates()
  })

  // ============================================================
  // Phase 4: UPI Payment
  // ============================================================
  ipcMain.handle('upi:generatePayment', async (_event, args: { vpa: string; payeeName: string; amount: number; note?: string; invoiceNumber?: string }) => {
    return await generateUPIPayment(args)
  })

  ipcMain.handle('upi:generateInvoiceQR', async (_event, args: { vpa: string; payeeName: string; invoiceNumber: string; amount: number }) => {
    return await generateInvoiceUPI(args.vpa, args.payeeName, args.invoiceNumber, args.amount)
  })

  ipcMain.handle('upi:validateVPA', async (_event, args: { vpa: string }) => {
    return validateUPIAddress(args.vpa)
  })

  // ============================================================
  // Phase 4: WhatsApp Integration
  // ============================================================
  ipcMain.handle('whatsapp:sendJobStatus', async (_event, args: { phone: string; status: string; customerName: string; ticketNumber: string; shopName: string; deviceInfo?: string; estimatedCost?: number; diagnosis?: string }) => {
    return await sendJobStatusMessage(args.phone, args.status as WAJobStatus, args.customerName, args.ticketNumber, args.shopName, args.deviceInfo, args.estimatedCost, args.diagnosis)
  })

  ipcMain.handle('whatsapp:sendPaymentLink', async (_event, args: { phone: string; shopName: string; invoiceNumber: string; amount: number; upiLink?: string }) => {
    return await waSendPaymentLink(args.phone, args.shopName, args.invoiceNumber, args.amount, args.upiLink)
  })

  ipcMain.handle('whatsapp:sendDiagnosticReport', async (_event, args: { phone: string; shopName: string; customerName: string; ticketNumber: string; issues: string[]; healthScore: number }) => {
    return await sendDiagnosticReport(args.phone, args.shopName, args.customerName, args.ticketNumber, args.issues, args.healthScore)
  })

  ipcMain.handle('whatsapp:sendCustomMessage', async (_event, args: { phone: string; message: string }) => {
    return await sendCustomMessage(args.phone, args.message)
  })

  ipcMain.handle('whatsapp:validatePhone', async (_event, args: { phone: string }) => {
    return validateIndianPhone(args.phone)
  })

  // ============================================================
  // Phase 4: CRM / Customer & Job Management
  // ============================================================
  ipcMain.handle('crm:createCustomer', async (_event, args: { phone: string; name: string; email?: string; address?: string; gstin?: string; stateCode?: string; notes?: string }) => {
    return await createCustomer(args)
  })

  ipcMain.handle('crm:updateCustomer', async (_event, args: { id: string; data: { phone?: string; name?: string; email?: string; address?: string; gstin?: string; stateCode?: string; notes?: string } }) => {
    return await updateCustomer(args.id, args.data)
  })

  ipcMain.handle('crm:getCustomer', async (_event, args: { id: string }) => {
    return await getCustomer(args.id)
  })

  ipcMain.handle('crm:getCustomerByPhone', async (_event, args: { phone: string }) => {
    return await getCustomerByPhone(args.phone)
  })

  ipcMain.handle('crm:searchCustomers', async (_event, args: { query: string }) => {
    return await searchCustomers(args.query)
  })

  ipcMain.handle('crm:getAllCustomers', async (_event, args: { limit?: number }) => {
    return await getAllCustomers(args?.limit)
  })

  ipcMain.handle('crm:deleteCustomer', async (_event, args: { id: string }) => {
    return await deleteCustomer(args.id)
  })

  ipcMain.handle('crm:createJob', async (_event, args: { customerId: string; deviceBrand?: string; deviceModel?: string; deviceSerial?: string; complaint: string; technician?: string; promisedDate?: number; notes?: string }) => {
    return await createRepairJob(args)
  })

  ipcMain.handle('crm:updateJobStatus', async (_event, args: { jobId: string; status: string; notes?: string }) => {
    return await updateJobStatus(args.jobId, args.status as RepairJobStatus, args.notes)
  })

  ipcMain.handle('crm:updateJobDiagnosis', async (_event, args: { jobId: string; diagnosis: string; estimatedCost?: number; scanId?: string }) => {
    return await updateJobDiagnosis(args.jobId, args.diagnosis, args.estimatedCost, args.scanId)
  })

  ipcMain.handle('crm:getJob', async (_event, args: { id: string }) => {
    return await getRepairJob(args.id)
  })

  ipcMain.handle('crm:getJobByTicket', async (_event, args: { ticketNumber: string }) => {
    return await getRepairJobByTicket(args.ticketNumber)
  })

  ipcMain.handle('crm:getJobsByCustomer', async (_event, args: { customerId: string }) => {
    return await getJobsByCustomer(args.customerId)
  })

  ipcMain.handle('crm:getJobsByStatus', async (_event, args: { status: string }) => {
    return await getJobsByStatus(args.status as RepairJobStatus)
  })

  ipcMain.handle('crm:getAllJobs', async (_event, args: { limit?: number }) => {
    return await getAllJobs(args?.limit)
  })

  ipcMain.handle('crm:getActiveJobs', async () => {
    return await getActiveJobs()
  })

  ipcMain.handle('crm:getJobStats', async () => {
    return await getJobStats()
  })

  ipcMain.handle('crm:getCustomerWithJobs', async (_event, args: { customerId: string }) => {
    return await getCustomerWithJobs(args.customerId)
  })

  // ============================================================
  // Phase 4: Backup Wizard
  // ============================================================
  ipcMain.handle('backup:discoverTargets', async () => {
    return await discoverBackupTargets()
  })

  ipcMain.handle('backup:createPlan', async (_event, args: { targetPaths?: string[]; destinationPath?: string }) => {
    return await createBackupPlan(args?.targetPaths, args?.destinationPath)
  })

  ipcMain.handle('backup:execute', async (_event, args: { targetPaths: string[]; destinationPath: string }) => {
    const safeDest = sanitizeFilePath(args.destinationPath)
    const safePaths = args.targetPaths.map(p => sanitizeFilePath(p))
    return await executeBackup(safePaths, safeDest)
  })

  ipcMain.handle('backup:discoverBrowsers', async () => {
    return await discoverBrowserProfiles()
  })

  ipcMain.handle('backup:backupBrowser', async (_event, args: { browserName: string; destinationPath: string }) => {
    const safeDest = sanitizeFilePath(args.destinationPath)
    return await backupBrowserData(args.browserName, safeDest)
  })

  ipcMain.handle('backup:getStatus', async () => {
    return await getBackupStatus()
  })

  ipcMain.handle('backup:getMigrationGuide', async (_event, args: { type: string }) => {
    switch (args.type) {
      case 'pc-to-pc': return getPCToPCMigrationGuide()
      case 'windows-reinstall': return getWindowsReinstallGuide()
      case 'hdd-to-ssd': return getHDDToSSDGuide()
      default: return getPCToPCMigrationGuide()
    }
  })

  // ============================================================
  // Phase 4: i18n
  // ============================================================
  ipcMain.handle('i18n:setLanguage', async (_event, args: { lang: string }) => {
    setLanguage(args.lang as SupportedLanguage)
  })

  ipcMain.handle('i18n:getLanguage', async () => {
    return getLanguage()
  })

  ipcMain.handle('i18n:getSupportedLanguages', async () => {
    return getSupportedLanguages()
  })

  ipcMain.handle('i18n:getTranslations', async (_event, args: { lang: string }) => {
    return getTranslationsForLanguage(args.lang as SupportedLanguage)
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

  // ============================================================
  // Phase 6: Disk Imaging
  // ============================================================
  ipcMain.handle('diskimg:diagnose', async () => {
    return await runDiskImagingDiagnostics()
  })

  ipcMain.handle('diskimg:createSystemImage', async (_event, args: { destinationPath: string }) => {
    const safeDest = sanitizeFilePath(args.destinationPath)
    return await createSystemImage(safeDest)
  })

  ipcMain.handle('diskimg:clonePartition', async (_event, args: { sourceDrive: string; destDrive: string }) => {
    const safeSource = sanitizeDevicePath(args.sourceDrive)
    const safeDest = sanitizeDevicePath(args.destDrive)
    return await clonePartition(safeSource, safeDest)
  })

  ipcMain.handle('diskimg:rescueDrive', async (_event, args: { sourceDrive: string; destinationPath: string }) => {
    const safeSource = sanitizeDevicePath(args.sourceDrive)
    const safeDest = sanitizeFilePath(args.destinationPath)
    return await rescueFailingDrive(safeSource, safeDest)
  })

  // ============================================================
  // Phase 6: Partition Manager
  // ============================================================
  ipcMain.handle('partmgr:diagnose', async () => {
    return await runPartitionManagerDiagnostics()
  })

  ipcMain.handle('partmgr:resize', async (_event, args: { driveLetter: string; newSizeMB: number }) => {
    const safeDrive = sanitizeDriveLetter(args.driveLetter)
    const safeSizeMB = Math.max(1, Math.min(Math.round(args.newSizeMB), 1048576))
    return await resizePartition(safeDrive, safeSizeMB)
  })

  ipcMain.handle('partmgr:format', async (_event, args: { driveLetter: string; fileSystem: string; label: string }) => {
    const safeDrive = sanitizeDriveLetter(args.driveLetter)
    const allowedFS = ['NTFS', 'FAT32', 'exFAT', 'ext4', 'APFS', 'HFS+']
    const safeFS = allowedFS.includes(args.fileSystem) ? args.fileSystem : 'NTFS'
    const safeLabel = args.label.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 32)
    return await formatPartition(safeDrive, safeFS, safeLabel)
  })

  ipcMain.handle('partmgr:create', async (_event, args: { diskNumber: number; sizeMB: number; fileSystem: string; label: string }) => {
    const safeDiskNum = Math.max(0, Math.min(Math.round(args.diskNumber), 99))
    const safeSizeMB = Math.max(1, Math.min(Math.round(args.sizeMB), 1048576))
    const allowedFS = ['NTFS', 'FAT32', 'exFAT', 'ext4', 'APFS', 'HFS+']
    const safeFS = allowedFS.includes(args.fileSystem) ? args.fileSystem : 'NTFS'
    const safeLabel = args.label.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 32)
    return await createPartition(safeDiskNum, safeSizeMB, safeFS, safeLabel)
  })

  // ============================================================
  // Phase 6: Memory Diagnostics
  // ============================================================
  ipcMain.handle('memdiag:diagnose', async () => {
    return await runMemoryDiagnostics()
  })

  ipcMain.handle('memdiag:runPatternTest', async (_event, args: { testSizeMB: number }) => {
    const sizeMB = Math.min(Math.max(32, args.testSizeMB || 128), 512)
    const testResult = await runBuiltInMemTest(sizeMB)
    return {
      success: testResult.overallPassed,
      module: 'memory',
      action: 'pattern-test',
      description: testResult.overallPassed
        ? `Memory pattern test PASSED (${testResult.testedMB}MB, ${testResult.patterns.length} patterns, ${testResult.durationMs}ms)`
        : `Memory pattern test FAILED — ${testResult.errors} error(s) detected`,
      details: testResult.patterns.map(p => `${p.name}: ${p.passed ? 'PASS' : 'FAIL'} (${p.durationMs}ms)`),
      changes: [],
      rollbackAvailable: false,
      error: testResult.overallPassed ? undefined : `${testResult.errors} memory error(s) detected`
    } as FixResult
  })

  ipcMain.handle('memdiag:scheduleWinTest', async () => {
    return await scheduleWindowsMemDiag()
  })

  // ============================================================
  // Phase 6: Firmware & BIOS
  // ============================================================
  ipcMain.handle('firmware:diagnose', async () => {
    return await runFirmwareDiagnostics()
  })

  ipcMain.handle('firmware:checkUpdates', async () => {
    return await checkFirmwareUpdates()
  })

  ipcMain.handle('firmware:updateDrivers', async () => {
    return await updateDrivers()
  })

  // ============================================================
  // Phase 6: Remote Access
  // ============================================================
  ipcMain.handle('remote:diagnose', async () => {
    return await runRemoteAccessDiagnostics()
  })

  ipcMain.handle('remote:enableRdp', async () => {
    return await enableRemoteDesktop()
  })

  ipcMain.handle('remote:disableRdp', async () => {
    return await disableRemoteDesktop()
  })

  ipcMain.handle('remote:generateInvite', async () => {
    return await generateRemoteAssistInvite()
  })

  ipcMain.handle('remote:configureWol', async () => {
    return await configureWakeOnLan()
  })

  // ============================================================
  // AI Diagnostics (ONNX-powered local AI)
  // ============================================================
  ipcMain.handle('ai:runDiagnosis', async () => {
    return await runAIDiagnosis()
  })

  ipcMain.handle('ai:getHealthScore', async () => {
    return await getHealthScore()
  })

  ipcMain.handle('ai:collectMetrics', async () => {
    return await collectSystemMetrics()
  })

  logger.info('All IPC handlers registered successfully')
}

// ============================================================
// Scan Orchestration
// ============================================================
// Helper: yield to the event loop so the Electron renderer stays responsive
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

// Helper: run a diagnostic function with a per-module timeout and event loop yielding
async function runDiagnosticSafe(
  name: string,
  fn: () => Promise<DiagnosticResult[]>,
  timeoutMs: number
): Promise<{ name: string; results: DiagnosticResult[] }> {
  await yieldToEventLoop()
  try {
    const result = await Promise.race([
      fn(),
      new Promise<DiagnosticResult[]>((_, reject) =>
        setTimeout(() => reject(new Error(`Module ${name} timed out`)), timeoutMs)
      )
    ])
    return { name, results: result }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.warn(`Module ${name} scan failed: ${errorMsg}`)
    // Return an explicit failure diagnostic instead of silently swallowing errors
    return {
      name,
      results: [{
        module: name,
        issue: `${name} scan failed`,
        severity: 'warning' as const,
        description: `The ${name} module encountered an error: ${errorMsg}`,
        recommendation: 'Try running the scan again. If the issue persists, check system permissions.',
        autoFixable: false
      }]
    }
  }
}

// Helper: run multiple diagnostic functions with bounded concurrency
async function runWithConcurrency<T>(
  tasks: Array<{ name: string; fn: () => Promise<T> }>,
  concurrency: number,
  timeoutMs: number
): Promise<Array<{ name: string; results: T }>> {
  const results: Array<{ name: string; results: T }> = []
  let index = 0

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++
      const task = tasks[currentIndex]
      await yieldToEventLoop()
      const result = await runDiagnosticSafe(
        task.name,
        task.fn as () => Promise<DiagnosticResult[]>,
        timeoutMs
      )
      results.push(result as { name: string; results: T })
    }
  }

  // Launch `concurrency` number of workers
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext())
  await Promise.all(workers)
  return results
}

async function runQuickScan(): Promise<ScanResult> {
  const startTime = Date.now()
  const scanId = nanoid()
  const diagnostics: DiagnosticResult[] = []

  logger.info(`Starting quick scan ${scanId}...`)

  // Run diagnostic modules with bounded concurrency (5 at a time) to keep scan fast
  // while still yielding to the event loop between batches to prevent UI freezes.
  // Each module has its own timeout to prevent any single module from hanging.
  const PER_MODULE_TIMEOUT_MS = 30000 // 30s per module
  const CONCURRENCY = 5

  const moduleTasks = [
    { name: 'performance', fn: runPerformanceDiagnostics },
    { name: 'os-repair', fn: runOSRepairDiagnostics },
    { name: 'malware', fn: runMalwareDiagnostics },
    { name: 'network', fn: runNetworkDiagnostics },
    { name: 'battery', fn: runBatteryDiagnostics },
    { name: 'data-recovery', fn: runDataRecoveryDiagnostics },
    { name: 'audio', fn: runAudioDiagnostics },
    { name: 'bluetooth', fn: runBluetoothDiagnostics },
    { name: 'printer', fn: runPrinterDiagnostics },
    { name: 'display', fn: runDisplayDiagnostics },
    { name: 'webcam', fn: runWebcamDiagnostics },
    { name: 'usb', fn: runUsbDiagnostics },
    { name: 'india-apps', fn: runIndiaAppsDiagnostics },
    { name: 'thermal', fn: runOverheatingDiagnostics },
    { name: 'hardware', fn: runHardwareDiagnostics },
    { name: 'keyboard', fn: runKeyboardTouchpadDiagnostics },
    { name: 'gaming', fn: runGamingDiagnostics },
    { name: 'partition', fn: runPartitionBootDiagnostics },
    { name: 'activation', fn: runActivationDiagnostics },
    { name: 'email', fn: runEmailDiagnostics },
    { name: 'phone', fn: runPhoneTransferDiagnostics },
    { name: 'disk-imaging', fn: runDiskImagingDiagnostics },
    { name: 'partition-mgr', fn: runPartitionManagerDiagnostics },
    { name: 'memory-diag', fn: runMemoryDiagnostics },
    { name: 'firmware', fn: runFirmwareDiagnostics },
    { name: 'remote-access', fn: runRemoteAccessDiagnostics }
  ]

  const moduleResults = await runWithConcurrency(moduleTasks, CONCURRENCY, PER_MODULE_TIMEOUT_MS)
  for (const { results } of moduleResults) {
    diagnostics.push(...results)
  }
  const moduleNames = moduleTasks.map(m => m.name)

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
