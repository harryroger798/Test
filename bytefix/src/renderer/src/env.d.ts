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
}

interface Window {
  bytefix: ByteFixAPI
}
