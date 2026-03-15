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
