import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const api = {
  // System
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  getProcesses: () => ipcRenderer.invoke('system:getProcesses'),
  getPlatform: () => ipcRenderer.invoke('system:getPlatform'),

  // Performance
  getStartupItems: () => ipcRenderer.invoke('perf:getStartupItems'),
  disableStartupItem: (name: string, path: string) =>
    ipcRenderer.invoke('perf:disableStartupItem', { name, path }),
  getCleanupItems: () => ipcRenderer.invoke('perf:getCleanupItems'),
  runCleanup: (items: unknown[]) => ipcRenderer.invoke('perf:runCleanup', { items }),
  optimizeRam: () => ipcRenderer.invoke('perf:optimizeRam'),
  optimizeDisk: (drive: string) => ipcRenderer.invoke('perf:optimizeDisk', { drive }),

  // Malware
  quickMalwareScan: () => ipcRenderer.invoke('malware:quickScan'),
  fullMalwareScan: () => ipcRenderer.invoke('malware:fullScan'),

  // Network
  diagnoseNetwork: () => ipcRenderer.invoke('network:diagnose'),
  resetAdapter: (iface: string) => ipcRenderer.invoke('network:resetAdapter', { iface }),
  flushDns: () => ipcRenderer.invoke('network:flushDns'),
  resetWinsock: () => ipcRenderer.invoke('network:resetWinsock'),
  resetTcpIp: () => ipcRenderer.invoke('network:resetTcpIp'),

  // OS Repair
  runSfc: () => ipcRenderer.invoke('os:runSfc'),
  runDism: () => ipcRenderer.invoke('os:runDism'),
  repairWindowsUpdate: () => ipcRenderer.invoke('os:repairWindowsUpdate'),
  cleanRegistry: (confirm = false) => ipcRenderer.invoke('os:cleanRegistry', { confirm }),

  // Battery
  getBatteryReport: () => ipcRenderer.invoke('battery:getReport'),
  optimizePower: () => ipcRenderer.invoke('battery:optimizePower'),

  // Disk
  getSmartData: (device: string) => ipcRenderer.invoke('disk:getSmartData', { device }),
  runChkdsk: (drive: string) => ipcRenderer.invoke('disk:runChkdsk', { drive }),

  // Phase 2: Data Recovery
  recoveryDiagnose: () => ipcRenderer.invoke('recovery:diagnose'),
  restoreShadowCopy: (filePath: string, outputDir: string) =>
    ipcRenderer.invoke('recovery:restoreShadowCopy', { filePath, outputDir }),
  restoreRecycleBin: () => ipcRenderer.invoke('recovery:restoreRecycleBin'),
  runPhotorec: (sourceDrive: string, outputDir: string) =>
    ipcRenderer.invoke('recovery:runPhotorec', { sourceDrive, outputDir }),
  repairFilesystem: (drive: string, confirm = false) => ipcRenderer.invoke('recovery:repairFilesystem', { drive, confirm }),

  // Phase 2: Password Recovery
  passwordDiagnose: () => ipcRenderer.invoke('password:diagnose'),
  enableAdmin: (confirm = false) => ipcRenderer.invoke('password:enableAdmin', { confirm }),
  disableAdmin: (confirm = false) => ipcRenderer.invoke('password:disableAdmin', { confirm }),

  // Phase 2: Audio Fixer
  audioDiagnose: () => ipcRenderer.invoke('audio:diagnose'),
  restartAudioServices: () => ipcRenderer.invoke('audio:restartServices'),
  reinstallAudioDrivers: () => ipcRenderer.invoke('audio:reinstallDrivers'),
  enableMicPrivacy: () => ipcRenderer.invoke('audio:enableMicPrivacy'),
  disableAudioEnhancements: () => ipcRenderer.invoke('audio:disableEnhancements'),

  // Phase 2: Bluetooth Fixer
  bluetoothDiagnose: () => ipcRenderer.invoke('bluetooth:diagnose'),
  restartBluetoothService: () => ipcRenderer.invoke('bluetooth:restartService'),
  clearBluetoothCache: () => ipcRenderer.invoke('bluetooth:clearCache'),
  reinstallBluetoothDrivers: () => ipcRenderer.invoke('bluetooth:reinstallDrivers'),
  fixBluetoothAudio: () => ipcRenderer.invoke('bluetooth:fixAudio'),

  // Phase 2: Printer Fixer
  printerDiagnose: () => ipcRenderer.invoke('printer:diagnose'),
  restartSpooler: () => ipcRenderer.invoke('printer:restartSpooler'),
  clearPrintQueue: () => ipcRenderer.invoke('printer:clearQueue'),
  convertWsdToTcpIp: (printerName: string, ipAddress: string) =>
    ipcRenderer.invoke('printer:convertWsdToTcpIp', { printerName, ipAddress }),
  enablePrinterDiscovery: () => ipcRenderer.invoke('printer:enableDiscovery'),

  // Phase 2: Display Fixer
  displayDiagnose: () => ipcRenderer.invoke('display:diagnose'),
  reinstallDisplayDrivers: () => ipcRenderer.invoke('display:reinstallDrivers'),
  fixTdr: () => ipcRenderer.invoke('display:fixTdr'),
  disableHwAccel: () => ipcRenderer.invoke('display:disableHwAccel'),
  detectMonitors: () => ipcRenderer.invoke('display:detectMonitors'),

  // Phase 2: Webcam Fixer
  webcamDiagnose: () => ipcRenderer.invoke('webcam:diagnose'),
  enableCameraPrivacy: () => ipcRenderer.invoke('webcam:enablePrivacy'),
  reinstallCameraDrivers: () => ipcRenderer.invoke('webcam:reinstallDrivers'),
  powerCycleCamera: () => ipcRenderer.invoke('webcam:powerCycle'),

  // Phase 2: USB Fixer
  usbDiagnose: () => ipcRenderer.invoke('usb:diagnose'),
  disableSelectiveSuspend: () => ipcRenderer.invoke('usb:disableSelectiveSuspend'),
  reinstallUsbDrivers: () => ipcRenderer.invoke('usb:reinstallDrivers'),
  repairRawDrive: (driveLetter: string, confirm = false) => ipcRenderer.invoke('usb:repairRawDrive', { driveLetter, confirm }),
  disableUsbPowerMgmt: () => ipcRenderer.invoke('usb:disablePowerMgmt'),

  // Phase 2: India Apps
  indiaDiagnose: () => ipcRenderer.invoke('india:diagnose'),
  repairOffice: () => ipcRenderer.invoke('india:repairOffice'),
  repairPst: () => ipcRenderer.invoke('india:repairPst'),
  fixJavaBanking: () => ipcRenderer.invoke('india:fixJavaBanking'),
  cleanChrome: () => ipcRenderer.invoke('india:cleanChrome'),
  enableDotNet35: () => ipcRenderer.invoke('india:enableDotNet35'),

  // Phase 3: Overheating Analyzer
  thermalDiagnose: () => ipcRenderer.invoke('thermal:diagnose'),
  optimizeCooling: () => ipcRenderer.invoke('thermal:optimizeCooling'),
  killHighCpu: () => ipcRenderer.invoke('thermal:killHighCpu'),

  // Phase 3: Hardware Deep Diagnostics
  hardwareDiagnose: () => ipcRenderer.invoke('hardware:diagnose'),
  cpuStressTest: (durationSeconds: number) =>
    ipcRenderer.invoke('hardware:stressTest', { durationSeconds }),
  guideMemTest: () => ipcRenderer.invoke('hardware:guideMemTest'),

  // Phase 3: Keyboard/Touchpad Fixer
  keyboardDiagnose: () => ipcRenderer.invoke('keyboard:diagnose'),
  fixFilterKeys: () => ipcRenderer.invoke('keyboard:fixFilterKeys'),
  toggleTouchpad: (enable: boolean) =>
    ipcRenderer.invoke('keyboard:toggleTouchpad', { enable }),
  reinstallInputDrivers: () => ipcRenderer.invoke('keyboard:reinstallDrivers'),

  // Phase 3: Gaming Optimizer
  gamingDiagnose: () => ipcRenderer.invoke('gaming:diagnose'),
  enableGameMode: () => ipcRenderer.invoke('gaming:enableGameMode'),
  setHighPerformance: () => ipcRenderer.invoke('gaming:setHighPerformance'),
  cleanupRamForGaming: () => ipcRenderer.invoke('gaming:cleanupRam'),
  repairDirectX: () => ipcRenderer.invoke('gaming:repairDirectX'),
  optimizeGpu: () => ipcRenderer.invoke('gaming:optimizeGpu'),

  // Phase 3: Partition/Boot Manager
  partitionDiagnose: () => ipcRenderer.invoke('partition:diagnose'),
  repairBcd: (confirm = false) => ipcRenderer.invoke('partition:repairBcd', { confirm }),
  repairGrub: (confirm = false) => ipcRenderer.invoke('partition:repairGrub', { confirm }),
  verifyBootDrive: () => ipcRenderer.invoke('partition:verifyBootDrive'),

  // Phase 3: Windows Activation
  activationDiagnose: () => ipcRenderer.invoke('activation:diagnose'),
  activationTroubleshoot: () => ipcRenderer.invoke('activation:troubleshoot'),

  // Phase 3: Email/Account Setup
  emailDiagnose: () => ipcRenderer.invoke('email:diagnose'),
  autoConfigureEmail: (email: string) =>
    ipcRenderer.invoke('email:autoConfigure', { email }),
  repairOutlookProfile: () => ipcRenderer.invoke('email:repairOutlook'),
  clearEmailCredentials: (target: string, confirm = false) =>
    ipcRenderer.invoke('email:clearCredentials', { target, confirm }),

  // Phase 3: Phone Data Transfer
  phoneDiagnose: () => ipcRenderer.invoke('phone:diagnose'),
  guideUsbDebugging: () => ipcRenderer.invoke('phone:guideUsbDebugging'),
  pullPhoneFiles: (sourcePath: string, destinationPath: string) =>
    ipcRenderer.invoke('phone:pullFiles', { sourcePath, destinationPath }),

  // Phase 4: GST Billing
  createInvoice: (data: unknown) => ipcRenderer.invoke('billing:createInvoice', data),
  getInvoice: (id: string) => ipcRenderer.invoke('billing:getInvoice', { id }),
  getInvoicesByCustomer: (customerId: string) => ipcRenderer.invoke('billing:getInvoicesByCustomer', { customerId }),
  getAllInvoices: (limit?: number) => ipcRenderer.invoke('billing:getAllInvoices', { limit }),
  updatePaymentStatus: (invoiceId: string, status: string, method?: string) =>
    ipcRenderer.invoke('billing:updatePaymentStatus', { invoiceId, status, method }),
  getInvoiceStats: () => ipcRenderer.invoke('billing:getStats'),
  getHsnCodes: () => ipcRenderer.invoke('billing:getHsnCodes'),
  getIndianStates: () => ipcRenderer.invoke('billing:getIndianStates'),

  // Phase 4: UPI Payment
  generateUPIPayment: (data: { vpa: string; payeeName: string; amount: number; note?: string; invoiceNumber?: string }) =>
    ipcRenderer.invoke('upi:generatePayment', data),
  generateInvoiceQR: (vpa: string, payeeName: string, invoiceNumber: string, amount: number) =>
    ipcRenderer.invoke('upi:generateInvoiceQR', { vpa, payeeName, invoiceNumber, amount }),
  validateUPIAddress: (vpa: string) => ipcRenderer.invoke('upi:validateVPA', { vpa }),

  // Phase 4: WhatsApp Integration
  sendWhatsAppJobStatus: (data: { phone: string; status: string; customerName: string; ticketNumber: string; shopName: string; deviceInfo?: string; estimatedCost?: number; diagnosis?: string }) =>
    ipcRenderer.invoke('whatsapp:sendJobStatus', data),
  sendWhatsAppPaymentLink: (phone: string, shopName: string, invoiceNumber: string, amount: number, upiLink?: string) =>
    ipcRenderer.invoke('whatsapp:sendPaymentLink', { phone, shopName, invoiceNumber, amount, upiLink }),
  sendWhatsAppDiagnosticReport: (phone: string, shopName: string, customerName: string, ticketNumber: string, issues: string[], healthScore: number) =>
    ipcRenderer.invoke('whatsapp:sendDiagnosticReport', { phone, shopName, customerName, ticketNumber, issues, healthScore }),
  sendWhatsAppCustomMessage: (phone: string, message: string) =>
    ipcRenderer.invoke('whatsapp:sendCustomMessage', { phone, message }),
  validateIndianPhone: (phone: string) => ipcRenderer.invoke('whatsapp:validatePhone', { phone }),

  // Phase 4: CRM / Customer & Job Management
  createCustomer: (data: { phone: string; name: string; email?: string; address?: string; gstin?: string; stateCode?: string; notes?: string }) =>
    ipcRenderer.invoke('crm:createCustomer', data),
  updateCustomer: (id: string, data: unknown) =>
    ipcRenderer.invoke('crm:updateCustomer', { id, data }),
  getCustomer: (id: string) => ipcRenderer.invoke('crm:getCustomer', { id }),
  getCustomerByPhone: (phone: string) => ipcRenderer.invoke('crm:getCustomerByPhone', { phone }),
  searchCustomers: (query: string) => ipcRenderer.invoke('crm:searchCustomers', { query }),
  getAllCustomers: (limit?: number) => ipcRenderer.invoke('crm:getAllCustomers', { limit }),
  deleteCustomer: (id: string) => ipcRenderer.invoke('crm:deleteCustomer', { id }),
  createRepairJob: (data: { customerId: string; deviceBrand?: string; deviceModel?: string; deviceSerial?: string; complaint: string; technician?: string; promisedDate?: number; notes?: string }) =>
    ipcRenderer.invoke('crm:createJob', data),
  updateJobStatus: (jobId: string, status: string, notes?: string) =>
    ipcRenderer.invoke('crm:updateJobStatus', { jobId, status, notes }),
  updateJobDiagnosis: (jobId: string, diagnosis: string, estimatedCost?: number, scanId?: string) =>
    ipcRenderer.invoke('crm:updateJobDiagnosis', { jobId, diagnosis, estimatedCost, scanId }),
  getRepairJob: (id: string) => ipcRenderer.invoke('crm:getJob', { id }),
  getRepairJobByTicket: (ticketNumber: string) => ipcRenderer.invoke('crm:getJobByTicket', { ticketNumber }),
  getJobsByCustomer: (customerId: string) => ipcRenderer.invoke('crm:getJobsByCustomer', { customerId }),
  getJobsByStatus: (status: string) => ipcRenderer.invoke('crm:getJobsByStatus', { status }),
  getAllJobs: (limit?: number) => ipcRenderer.invoke('crm:getAllJobs', { limit }),
  getActiveJobs: () => ipcRenderer.invoke('crm:getActiveJobs'),
  getJobStats: () => ipcRenderer.invoke('crm:getJobStats'),
  getCustomerWithJobs: (customerId: string) => ipcRenderer.invoke('crm:getCustomerWithJobs', { customerId }),

  // Phase 4: Backup Wizard
  discoverBackupTargets: () => ipcRenderer.invoke('backup:discoverTargets'),
  createBackupPlan: (targetPaths?: string[], destinationPath?: string) =>
    ipcRenderer.invoke('backup:createPlan', { targetPaths, destinationPath }),
  executeBackup: (targetPaths: string[], destinationPath: string) =>
    ipcRenderer.invoke('backup:execute', { targetPaths, destinationPath }),
  discoverBrowserProfiles: () => ipcRenderer.invoke('backup:discoverBrowsers'),
  backupBrowserData: (browserName: string, destinationPath: string) =>
    ipcRenderer.invoke('backup:backupBrowser', { browserName, destinationPath }),
  getBackupStatus: () => ipcRenderer.invoke('backup:getStatus'),
  getMigrationGuide: (type: string) => ipcRenderer.invoke('backup:getMigrationGuide', { type }),

  // Phase 4: i18n
  setLanguage: (lang: string) => ipcRenderer.invoke('i18n:setLanguage', { lang }),
  getLanguage: () => ipcRenderer.invoke('i18n:getLanguage'),
  getSupportedLanguages: () => ipcRenderer.invoke('i18n:getSupportedLanguages'),
  getTranslations: (lang: string) => ipcRenderer.invoke('i18n:getTranslations', { lang }),

  // Phase 6: Disk Imaging
  diskImgDiagnose: () => ipcRenderer.invoke('diskimg:diagnose'),
  createSystemImage: (destinationPath: string) =>
    ipcRenderer.invoke('diskimg:createSystemImage', { destinationPath }),
  clonePartition: (sourceDrive: string, destDrive: string, confirm = false) =>
    ipcRenderer.invoke('diskimg:clonePartition', { sourceDrive, destDrive, confirm }),
  rescueDrive: (sourceDrive: string, destinationPath: string) =>
    ipcRenderer.invoke('diskimg:rescueDrive', { sourceDrive, destinationPath }),

  // Phase 6: Partition Manager
  partMgrDiagnose: () => ipcRenderer.invoke('partmgr:diagnose'),
  resizePartition: (driveLetter: string, newSizeMB: number, confirm = false) =>
    ipcRenderer.invoke('partmgr:resize', { driveLetter, newSizeMB, confirm }),
  formatPartition: (driveLetter: string, fileSystem: string, label: string, confirm = false) =>
    ipcRenderer.invoke('partmgr:format', { driveLetter, fileSystem, label, confirm }),
  createPartition: (diskNumber: number, sizeMB: number, fileSystem: string, label: string, confirm = false) =>
    ipcRenderer.invoke('partmgr:create', { diskNumber, sizeMB, fileSystem, label, confirm }),

  // Phase 6: Memory Diagnostics
  memDiagDiagnose: () => ipcRenderer.invoke('memdiag:diagnose'),
  runMemPatternTest: (testSizeMB: number) =>
    ipcRenderer.invoke('memdiag:runPatternTest', { testSizeMB }),
  scheduleWinMemTest: () => ipcRenderer.invoke('memdiag:scheduleWinTest'),

  // Phase 6: Firmware & BIOS
  firmwareDiagnose: () => ipcRenderer.invoke('firmware:diagnose'),
  checkFirmwareUpdates: () => ipcRenderer.invoke('firmware:checkUpdates'),
  updateDrivers: (confirm = false) => ipcRenderer.invoke('firmware:updateDrivers', { confirm }),

  // Phase 6: Remote Access
  remoteDiagnose: () => ipcRenderer.invoke('remote:diagnose'),
  enableRemoteDesktop: (confirm = false) => ipcRenderer.invoke('remote:enableRdp', { confirm }),
  disableRemoteDesktop: () => ipcRenderer.invoke('remote:disableRdp'),
  generateRemoteInvite: () => ipcRenderer.invoke('remote:generateInvite'),
  configureWakeOnLan: () => ipcRenderer.invoke('remote:configureWol'),

  // AI Diagnostics (ONNX-powered local AI)
  aiRunDiagnosis: () => ipcRenderer.invoke('ai:runDiagnosis'),
  aiGetHealthScore: () => ipcRenderer.invoke('ai:getHealthScore'),
  aiCollectMetrics: () => ipcRenderer.invoke('ai:collectMetrics'),
  aiGetProviderConfig: () => ipcRenderer.invoke('ai:getProviderConfig'),
  aiSetProviderConfig: (config: unknown) => ipcRenderer.invoke('ai:setProviderConfig', config),
  getRecentActivity: (limit?: number) => ipcRenderer.invoke('activity:getRecent', limit),

  // Phase 5: Production Hardening - Error Logging
  logError: (data: { module: string; message: string; stack?: string; componentStack?: string; timestamp: number }) =>
    ipcRenderer.invoke('app:logError', data),

  // Phase 5: App Info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAppLogPath: () => ipcRenderer.invoke('app:getLogPath'),
  getAppLogDir: () => ipcRenderer.invoke('app:getLogDir'),
  getAppPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  getAppArch: () => ipcRenderer.invoke('app:getArch'),

  // Phase 5: Auto-Updater
  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),

  // Phase 5: Offline Manager
  getOfflineStatus: () => ipcRenderer.invoke('offline:getStatus'),
  queueOfflineAction: (action: { type: string; payload: Record<string, unknown> }) =>
    ipcRenderer.invoke('offline:queueAction', action),
  getOfflineQueue: () => ipcRenderer.invoke('offline:getQueue'),
  clearOfflineQueue: () => ipcRenderer.invoke('offline:clearQueue'),
  forceConnectivityCheck: () => ipcRenderer.invoke('offline:forceCheck'),

  // Scan
  quickScan: () => ipcRenderer.invoke('scan:quick'),
  fullScan: (config: unknown) => ipcRenderer.invoke('scan:full', config),

  // Reports
  generateReport: (scanId: string) => ipcRenderer.invoke('report:generate', { scanId }),

  // Jobs
  getJobs: () => ipcRenderer.invoke('job:getAll'),
  cancelJob: (jobId: string) => ipcRenderer.invoke('job:cancel', { jobId })
}

// Forward main process events to renderer as custom DOM events
// Remove existing listeners first to prevent leaks on renderer reload
const eventChannels = [
  'updater:status',
  'offline:statusChanged',
  'offline:processingQueue',
  'offline:replayAction',
  'offline:actionFailed'
] as const

for (const channel of eventChannels) {
  ipcRenderer.removeAllListeners(channel)
}

ipcRenderer.on('updater:status', (_event, data) => {
  window.dispatchEvent(new CustomEvent('bytefix:updater-status', { detail: data }))
})

ipcRenderer.on('offline:statusChanged', (_event, data) => {
  window.dispatchEvent(new CustomEvent('bytefix:offline-status', { detail: data }))
})

ipcRenderer.on('offline:processingQueue', (_event, data) => {
  window.dispatchEvent(new CustomEvent('bytefix:queue-update', { detail: data }))
})

ipcRenderer.on('offline:replayAction', (_event, data) => {
  window.dispatchEvent(new CustomEvent('bytefix:replay-action', { detail: data }))
})

ipcRenderer.on('offline:actionFailed', (_event, data) => {
  window.dispatchEvent(new CustomEvent('bytefix:action-failed', { detail: data }))
})

contextBridge.exposeInMainWorld('bytefix', api)

export type ByteFixAPI = typeof api
