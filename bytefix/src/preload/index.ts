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
  cleanRegistry: () => ipcRenderer.invoke('os:cleanRegistry'),

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
  repairFilesystem: (drive: string) => ipcRenderer.invoke('recovery:repairFilesystem', { drive }),

  // Phase 2: Password Recovery
  passwordDiagnose: () => ipcRenderer.invoke('password:diagnose'),
  enableAdmin: () => ipcRenderer.invoke('password:enableAdmin'),
  disableAdmin: () => ipcRenderer.invoke('password:disableAdmin'),

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
  repairRawDrive: (driveLetter: string) => ipcRenderer.invoke('usb:repairRawDrive', { driveLetter }),
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
  repairBcd: () => ipcRenderer.invoke('partition:repairBcd'),
  repairGrub: () => ipcRenderer.invoke('partition:repairGrub'),
  verifyBootDrive: () => ipcRenderer.invoke('partition:verifyBootDrive'),

  // Phase 3: Windows Activation
  activationDiagnose: () => ipcRenderer.invoke('activation:diagnose'),
  activationTroubleshoot: () => ipcRenderer.invoke('activation:troubleshoot'),

  // Phase 3: Email/Account Setup
  emailDiagnose: () => ipcRenderer.invoke('email:diagnose'),
  autoConfigureEmail: (email: string) =>
    ipcRenderer.invoke('email:autoConfigure', { email }),
  repairOutlookProfile: () => ipcRenderer.invoke('email:repairOutlook'),
  clearEmailCredentials: (target: string) =>
    ipcRenderer.invoke('email:clearCredentials', { target }),

  // Phase 3: Phone Data Transfer
  phoneDiagnose: () => ipcRenderer.invoke('phone:diagnose'),
  guideUsbDebugging: () => ipcRenderer.invoke('phone:guideUsbDebugging'),
  pullPhoneFiles: (sourcePath: string, destinationPath: string) =>
    ipcRenderer.invoke('phone:pullFiles', { sourcePath, destinationPath }),

  // Scan
  quickScan: () => ipcRenderer.invoke('scan:quick'),
  fullScan: (config: unknown) => ipcRenderer.invoke('scan:full', config),

  // Reports
  generateReport: (scanId: string) => ipcRenderer.invoke('report:generate', { scanId }),

  // Jobs
  getJobs: () => ipcRenderer.invoke('job:getAll'),
  cancelJob: (jobId: string) => ipcRenderer.invoke('job:cancel', { jobId })
}

contextBridge.exposeInMainWorld('bytefix', api)

export type ByteFixAPI = typeof api
