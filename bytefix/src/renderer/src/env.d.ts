/// <reference types="vite/client" />

interface ByteFixAPI {
  getSystemInfo: () => Promise<import('../../../shared/types').SystemInfo>
  getProcesses: () => Promise<import('../../../shared/types').ProcessInfo[]>
  getPlatform: () => Promise<string>
  getStartupItems: () => Promise<import('../../../shared/types').StartupItem[]>
  disableStartupItem: (name: string, path: string) => Promise<import('../../../shared/types').FixResult>
  getCleanupItems: () => Promise<import('../../../shared/types').CleanupItem[]>
  runCleanup: (items: import('../../../shared/types').CleanupItem[]) => Promise<import('../../../shared/types').FixResult>
  optimizeRam: () => Promise<import('../../../shared/types').FixResult>
  optimizeDisk: (drive: string) => Promise<import('../../../shared/types').FixResult>
  quickMalwareScan: () => Promise<import('../../../shared/types').MalwareScanResult>
  fullMalwareScan: () => Promise<import('../../../shared/types').MalwareScanResult>
  diagnoseNetwork: () => Promise<import('../../../shared/types').NetworkDiagnostic>
  resetAdapter: (iface: string) => Promise<import('../../../shared/types').FixResult>
  flushDns: () => Promise<import('../../../shared/types').FixResult>
  resetWinsock: () => Promise<import('../../../shared/types').FixResult>
  resetTcpIp: () => Promise<import('../../../shared/types').FixResult>
  runSfc: () => Promise<import('../../../shared/types').FixResult>
  runDism: () => Promise<import('../../../shared/types').FixResult>
  repairWindowsUpdate: () => Promise<import('../../../shared/types').FixResult>
  cleanRegistry: () => Promise<import('../../../shared/types').FixResult>
  getBatteryReport: () => Promise<import('../../../shared/types').BatteryInfo>
  optimizePower: () => Promise<import('../../../shared/types').FixResult>
  getSmartData: (device: string) => Promise<import('../../../shared/types').SmartData>
  runChkdsk: (drive: string) => Promise<import('../../../shared/types').FixResult>
  quickScan: () => Promise<import('../../../shared/types').ScanResult>
  fullScan: (config: import('../../../shared/types').ScanConfig) => Promise<import('../../../shared/types').ScanResult>
  generateReport: (scanId: string) => Promise<{ filePath: string }>
  getJobs: () => Promise<import('../../../shared/types').Job[]>
  cancelJob: (jobId: string) => Promise<void>

  // Phase 2: Data Recovery
  recoveryDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  restoreShadowCopy: (filePath: string, outputDir: string) => Promise<import('../../../shared/types').FixResult>
  restoreRecycleBin: () => Promise<import('../../../shared/types').FixResult>
  runPhotorec: (sourceDrive: string, outputDir: string) => Promise<import('../../../shared/types').FixResult>
  repairFilesystem: (drive: string) => Promise<import('../../../shared/types').FixResult>

  // Phase 2: Password Recovery
  passwordDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  enableAdmin: () => Promise<import('../../../shared/types').FixResult>
  disableAdmin: () => Promise<import('../../../shared/types').FixResult>

  // Phase 2: Audio Fixer
  audioDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  restartAudioServices: () => Promise<import('../../../shared/types').FixResult>
  reinstallAudioDrivers: () => Promise<import('../../../shared/types').FixResult>
  enableMicPrivacy: () => Promise<import('../../../shared/types').FixResult>
  disableAudioEnhancements: () => Promise<import('../../../shared/types').FixResult>

  // Phase 2: Bluetooth Fixer
  bluetoothDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  restartBluetoothService: () => Promise<import('../../../shared/types').FixResult>
  clearBluetoothCache: () => Promise<import('../../../shared/types').FixResult>
  reinstallBluetoothDrivers: () => Promise<import('../../../shared/types').FixResult>
  fixBluetoothAudio: () => Promise<import('../../../shared/types').FixResult>

  // Phase 2: Printer Fixer
  printerDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  restartSpooler: () => Promise<import('../../../shared/types').FixResult>
  clearPrintQueue: () => Promise<import('../../../shared/types').FixResult>
  convertWsdToTcpIp: (printerName: string, ipAddress: string) => Promise<import('../../../shared/types').FixResult>
  enablePrinterDiscovery: () => Promise<import('../../../shared/types').FixResult>

  // Phase 2: Display Fixer
  displayDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  reinstallDisplayDrivers: () => Promise<import('../../../shared/types').FixResult>
  fixTdr: () => Promise<import('../../../shared/types').FixResult>
  disableHwAccel: () => Promise<import('../../../shared/types').FixResult>
  detectMonitors: () => Promise<import('../../../shared/types').FixResult>

  // Phase 2: Webcam Fixer
  webcamDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  enableCameraPrivacy: () => Promise<import('../../../shared/types').FixResult>
  reinstallCameraDrivers: () => Promise<import('../../../shared/types').FixResult>
  powerCycleCamera: () => Promise<import('../../../shared/types').FixResult>

  // Phase 2: USB Fixer
  usbDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  disableSelectiveSuspend: () => Promise<import('../../../shared/types').FixResult>
  reinstallUsbDrivers: () => Promise<import('../../../shared/types').FixResult>
  repairRawDrive: (driveLetter: string) => Promise<import('../../../shared/types').FixResult>
  disableUsbPowerMgmt: () => Promise<import('../../../shared/types').FixResult>

  // Phase 2: India Apps
  indiaDiagnose: () => Promise<import('../../../shared/types').DiagnosticResult[]>
  repairOffice: () => Promise<import('../../../shared/types').FixResult>
  repairPst: () => Promise<import('../../../shared/types').FixResult>
  fixJavaBanking: () => Promise<import('../../../shared/types').FixResult>
  cleanChrome: () => Promise<import('../../../shared/types').FixResult>
  enableDotNet35: () => Promise<import('../../../shared/types').FixResult>
}

interface Window {
  bytefix: ByteFixAPI
}
