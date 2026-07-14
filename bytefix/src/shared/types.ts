// ============================================================
// ByteFix Shared Types - Used by Main, Preload, and Renderer
// ============================================================

// System Information
export interface SystemInfo {
  os: {
    platform: string
    distro: string
    release: string
    arch: string
    hostname: string
    build: string
  }
  cpu: {
    manufacturer: string
    brand: string
    speed: number
    cores: number
    physicalCores: number
    temperature?: number
  }
  memory: {
    total: number
    free: number
    used: number
    usedPercent: number
    swapTotal: number
    swapUsed: number
  }
  disk: DiskInfo[]
  battery: BatteryInfo
  graphics: {
    controllers: GraphicsController[]
    displays: DisplayInfo[]
  }
  network: NetworkInterface[]
  uptime: number
}

export interface DiskInfo {
  device: string
  name: string
  type: 'HDD' | 'SSD' | 'NVMe' | 'Unknown'
  size: number
  used: number
  available: number
  usedPercent: number
  mount: string
  fs: string
  smart?: SmartData
}

export interface SmartData {
  healthy: boolean
  temperature: number
  powerOnHours: number
  reallocatedSectors: number
  pendingSectors: number
  uncorrectableSectors: number
  powerCycleCount: number
  wearLeveling?: number
  attributes: SmartAttribute[]
}

export interface SmartAttribute {
  id: number
  name: string
  value: number
  worst: number
  threshold: number
  raw: string
  status: 'ok' | 'warning' | 'critical'
}

export interface BatteryInfo {
  hasBattery: boolean
  isCharging: boolean
  percent: number
  cycleCount: number
  designCapacity: number
  currentCapacity: number
  healthPercent: number
  voltage: number
  timeRemaining: number
  manufacturer: string
  model: string
  powerSource: 'AC' | 'Battery'
}

export interface GraphicsController {
  vendor: string
  model: string
  vram: number
  driverVersion: string
  temperature?: number
}

export interface DisplayInfo {
  model: string
  resolution: string
  refreshRate: number
  connection: string
  primary: boolean
}

export interface NetworkInterface {
  iface: string
  type: string
  ip4: string
  ip6: string
  mac: string
  speed: number
  operstate: 'up' | 'down'
  ssid?: string
  signalLevel?: number
}

// Diagnostic Results
export type DiagnosticSeverity = 'healthy' | 'info' | 'warning' | 'critical' | 'error'

export interface DiagnosticResult {
  id: string
  module: string
  category: string
  title: string
  severity: DiagnosticSeverity
  description: string
  details: string[]
  fixAvailable: boolean
  fixDescription?: string
  fixRisk: 'none' | 'low' | 'medium' | 'high'
  autoFixable: boolean
  timestamp: number
}

export type AIProviderId = 'cloudflare' | 'custom' | 'onnx' | 'rules'

export interface AIProviderConfig {
  priority: AIProviderId[]
  cloudUrl: string
  cloudToken: string
  customBaseUrl: string
  customApiKey: string
  customModel: string
  cloudConsent: boolean
}

export interface DiagnosticProgress {
  runId: string
  module: string
  phase: string
  percent: number
  message: string
  currentAction: string
}

// Fix Operations
export interface FixResult {
  success: boolean
  module: string
  action: string
  description: string
  details: string[]
  changes: FixChange[]
  rollbackAvailable: boolean
  error?: string
}

export interface FixChange {
  type: 'service' | 'registry' | 'file' | 'process' | 'network' | 'system' | 'driver' | 'device' | 'application'
  action: 'disabled' | 'enabled' | 'modified' | 'deleted' | 'created' | 'restored' | 'killed' | 'reinstalled' | 'restarted' | 'repaired' | 'cleared' | 'reloaded' | 'power-cycled' | 'optimized'
  target: string
  before?: string
  after?: string
}

// Scan Types
export interface ScanConfig {
  modules: string[]
  deepScan: boolean
  autoFix: boolean
  createBackup: boolean
}

export interface ScanResult {
  id: string
  startTime: number
  endTime: number
  duration: number
  modulesRun: string[]
  diagnostics: DiagnosticResult[]
  fixes: FixResult[]
  systemSnapshot?: SystemInfo
  overallHealth: number
  summary: string
}

// Performance specific
export interface StartupItem {
  name: string
  path: string
  publisher: string
  enabled: boolean
  impact: 'high' | 'medium' | 'low' | 'none'
  isBloatware: boolean
  isSystem: boolean
  recommendation: 'disable' | 'keep' | 'remove'
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  memoryMB: number
  path: string
  user: string
  isSafe: boolean
}

export interface CleanupItem {
  category: string
  path: string
  size: number
  description: string
  safe: boolean
  selected: boolean
}

// Malware
export interface MalwareScanResult {
  scanType: 'quick' | 'full' | 'custom'
  filesScanned: number
  threatsFound: number
  threats: MalwareThreat[]
  duration: number
  engineVersion: string
}

export interface MalwareThreat {
  name: string
  type: 'virus' | 'trojan' | 'adware' | 'pup' | 'spyware' | 'ransomware' | 'worm' | 'rootkit'
  severity: 'low' | 'medium' | 'high' | 'critical'
  path: string
  action: 'quarantined' | 'deleted' | 'detected' | 'failed'
}

// Network
export interface NetworkDiagnostic {
  internetConnected: boolean
  dnsWorking: boolean
  gatewayReachable: boolean
  latency: number
  downloadSpeed?: number
  uploadSpeed?: number
  dnsServer: string
  gateway: string
  publicIp?: string
  issues: NetworkIssue[]
}

export interface NetworkIssue {
  type: string
  severity: DiagnosticSeverity
  description: string
  fixAvailable: boolean
  fixDescription?: string
}

// OS Repair
export interface OSRepairResult {
  sfcResult?: { ran: boolean; issuesFound: number; issuesFixed: number; log: string }
  dismResult?: { ran: boolean; issuesFound: number; issuesFixed: number; log: string }
  windowsUpdate?: { status: string; pendingUpdates: number; failedUpdates: number }
  registryIssues?: { found: number; fixed: number; details: string[] }
  systemFiles?: { corrupted: number; repaired: number; details: string[] }
}

// Job/Task Management
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Job {
  id: string
  type: 'scan' | 'fix' | 'report'
  module: string
  status: JobStatus
  progress: number
  message: string
  startTime: number
  endTime?: number
  result?: unknown
  error?: string
}

// IPC Channel definitions
export interface IPCChannels {
  // System
  'system:getInfo': { request: void; response: SystemInfo }
  'system:getProcesses': { request: void; response: ProcessInfo[] }
  'system:getPlatform': { request: void; response: string }

  // Performance
  'perf:getStartupItems': { request: void; response: StartupItem[] }
  'perf:disableStartupItem': { request: { name: string; path: string }; response: FixResult }
  'perf:getCleanupItems': { request: void; response: CleanupItem[] }
  'perf:runCleanup': { request: { items: CleanupItem[] }; response: FixResult }
  'perf:optimizeRam': { request: void; response: FixResult }
  'perf:optimizeDisk': { request: { drive: string }; response: FixResult }

  // Malware
  'malware:quickScan': { request: void; response: MalwareScanResult }
  'malware:fullScan': { request: void; response: MalwareScanResult }

  // Network
  'network:diagnose': { request: void; response: NetworkDiagnostic }
  'network:resetAdapter': { request: { iface: string }; response: FixResult }
  'network:flushDns': { request: void; response: FixResult }
  'network:resetWinsock': { request: void; response: FixResult }
  'network:resetTcpIp': { request: void; response: FixResult }

  // OS Repair
  'os:runSfc': { request: void; response: FixResult }
  'os:runDism': { request: void; response: FixResult }
  'os:repairWindowsUpdate': { request: void; response: FixResult }
  'os:cleanRegistry': { request: void; response: FixResult }

  // Battery
  'battery:getReport': { request: void; response: BatteryInfo }
  'battery:optimizePower': { request: void; response: FixResult }

  // Disk Health
  'disk:getSmartData': { request: { device: string }; response: SmartData }
  'disk:runChkdsk': { request: { drive: string }; response: FixResult }

  // Data Recovery (Phase 2)
  'recovery:diagnose': { request: void; response: DiagnosticResult[] }
  'recovery:restoreShadowCopy': { request: { filePath: string; outputDir: string }; response: FixResult }
  'recovery:restoreRecycleBin': { request: void; response: FixResult }
  'recovery:runPhotorec': { request: { sourceDrive: string; outputDir: string }; response: FixResult }
  'recovery:repairFilesystem': { request: { drive: string }; response: FixResult }

  // Password Recovery (Phase 2)
  'password:diagnose': { request: void; response: DiagnosticResult[] }
  'password:enableAdmin': { request: void; response: FixResult }
  'password:disableAdmin': { request: void; response: FixResult }

  // Audio Fixer (Phase 2)
  'audio:diagnose': { request: void; response: DiagnosticResult[] }
  'audio:restartServices': { request: void; response: FixResult }
  'audio:reinstallDrivers': { request: void; response: FixResult }
  'audio:enableMicPrivacy': { request: void; response: FixResult }
  'audio:disableEnhancements': { request: void; response: FixResult }

  // Bluetooth Fixer (Phase 2)
  'bluetooth:diagnose': { request: void; response: DiagnosticResult[] }
  'bluetooth:restartService': { request: void; response: FixResult }
  'bluetooth:clearCache': { request: void; response: FixResult }
  'bluetooth:reinstallDrivers': { request: void; response: FixResult }
  'bluetooth:fixAudio': { request: void; response: FixResult }

  // Printer Fixer (Phase 2)
  'printer:diagnose': { request: void; response: DiagnosticResult[] }
  'printer:restartSpooler': { request: void; response: FixResult }
  'printer:clearQueue': { request: void; response: FixResult }
  'printer:convertWsdToTcpIp': { request: { printerName: string; ipAddress: string }; response: FixResult }
  'printer:enableDiscovery': { request: void; response: FixResult }

  // Display Fixer (Phase 2)
  'display:diagnose': { request: void; response: DiagnosticResult[] }
  'display:reinstallDrivers': { request: void; response: FixResult }
  'display:fixTdr': { request: void; response: FixResult }
  'display:disableHwAccel': { request: void; response: FixResult }
  'display:detectMonitors': { request: void; response: FixResult }

  // Webcam Fixer (Phase 2)
  'webcam:diagnose': { request: void; response: DiagnosticResult[] }
  'webcam:enablePrivacy': { request: void; response: FixResult }
  'webcam:reinstallDrivers': { request: void; response: FixResult }
  'webcam:powerCycle': { request: void; response: FixResult }

  // USB Fixer (Phase 2)
  'usb:diagnose': { request: void; response: DiagnosticResult[] }
  'usb:disableSelectiveSuspend': { request: void; response: FixResult }
  'usb:reinstallDrivers': { request: void; response: FixResult }
  'usb:repairRawDrive': { request: { driveLetter: string }; response: FixResult }
  'usb:disablePowerMgmt': { request: void; response: FixResult }

  // India Apps (Phase 2)
  'india:diagnose': { request: void; response: DiagnosticResult[] }
  'india:repairOffice': { request: void; response: FixResult }
  'india:repairPst': { request: void; response: FixResult }
  'india:fixJavaBanking': { request: void; response: FixResult }
  'india:cleanChrome': { request: void; response: FixResult }
  'india:enableDotNet35': { request: void; response: FixResult }

  // Phase 3: Overheating Analyzer
  'thermal:diagnose': { request: void; response: DiagnosticResult[] }
  'thermal:optimizeCooling': { request: void; response: FixResult }
  'thermal:killHighCpu': { request: void; response: FixResult }

  // Phase 3: Hardware Deep Diagnostics
  'hardware:diagnose': { request: void; response: DiagnosticResult[] }
  'hardware:stressTest': { request: { durationSeconds: number }; response: FixResult }
  'hardware:guideMemTest': { request: void; response: FixResult }

  // Phase 3: Keyboard/Touchpad Fixer
  'keyboard:diagnose': { request: void; response: DiagnosticResult[] }
  'keyboard:fixFilterKeys': { request: void; response: FixResult }
  'keyboard:toggleTouchpad': { request: { enable: boolean }; response: FixResult }
  'keyboard:reinstallDrivers': { request: void; response: FixResult }

  // Phase 3: Gaming Optimizer
  'gaming:diagnose': { request: void; response: DiagnosticResult[] }
  'gaming:enableGameMode': { request: void; response: FixResult }
  'gaming:setHighPerformance': { request: void; response: FixResult }
  'gaming:cleanupRam': { request: void; response: FixResult }
  'gaming:repairDirectX': { request: void; response: FixResult }
  'gaming:optimizeGpu': { request: void; response: FixResult }

  // Phase 3: Partition/Boot Manager
  'partition:diagnose': { request: void; response: DiagnosticResult[] }
  'partition:repairBcd': { request: void; response: FixResult }
  'partition:repairGrub': { request: void; response: FixResult }
  'partition:verifyBootDrive': { request: void; response: FixResult }

  // Phase 3: Windows Activation
  'activation:diagnose': { request: void; response: DiagnosticResult[] }
  'activation:troubleshoot': { request: void; response: FixResult }

  // Phase 3: Email/Account Setup
  'email:diagnose': { request: void; response: DiagnosticResult[] }
  'email:autoConfigure': { request: { email: string }; response: FixResult }
  'email:repairOutlook': { request: void; response: FixResult }
  'email:clearCredentials': { request: { target: string }; response: FixResult }

  // Phase 3: Phone Data Transfer
  'phone:diagnose': { request: void; response: DiagnosticResult[] }
  'phone:guideUsbDebugging': { request: void; response: FixResult }
  'phone:pullFiles': { request: { sourcePath: string; destinationPath: string }; response: FixResult }

  // Phase 4: GST Billing
  'billing:createInvoice': { request: { jobId?: string; customerId: string; shopName: string; shopGstin?: string; shopAddress?: string; shopStateCode: string; customerGstin?: string; customerStateCode?: string; lineItems: { description: string; hsnCode: string; quantity: number; rate: number; amount: number; gstRate: number }[]; paymentMethod?: string; notes?: string }; response: unknown }
  'billing:getInvoice': { request: { id: string }; response: unknown }
  'billing:getInvoicesByCustomer': { request: { customerId: string }; response: unknown[] }
  'billing:getAllInvoices': { request: { limit?: number }; response: unknown[] }
  'billing:updatePaymentStatus': { request: { invoiceId: string; status: string; method?: string }; response: unknown }
  'billing:getStats': { request: void; response: unknown }
  'billing:getHsnCodes': { request: void; response: unknown }
  'billing:getIndianStates': { request: void; response: unknown }

  // Phase 4: UPI Payment
  'upi:generatePayment': { request: { vpa: string; payeeName: string; amount: number; note?: string; invoiceNumber?: string }; response: unknown }
  'upi:generateInvoiceQR': { request: { vpa: string; payeeName: string; invoiceNumber: string; amount: number }; response: unknown }
  'upi:validateVPA': { request: { vpa: string }; response: { valid: boolean; error?: string } }

  // Phase 4: WhatsApp Integration
  'whatsapp:sendJobStatus': { request: { phone: string; status: string; customerName: string; ticketNumber: string; shopName: string; deviceInfo?: string; estimatedCost?: number; diagnosis?: string }; response: unknown }
  'whatsapp:sendPaymentLink': { request: { phone: string; shopName: string; invoiceNumber: string; amount: number; upiLink?: string }; response: unknown }
  'whatsapp:sendDiagnosticReport': { request: { phone: string; shopName: string; customerName: string; ticketNumber: string; issues: string[]; healthScore: number }; response: unknown }
  'whatsapp:sendCustomMessage': { request: { phone: string; message: string }; response: unknown }
  'whatsapp:validatePhone': { request: { phone: string }; response: { valid: boolean; error?: string; cleaned?: string } }

  // Phase 4: CRM / Customer & Job Management
  'crm:createCustomer': { request: { phone: string; name: string; email?: string; address?: string; gstin?: string; stateCode?: string; notes?: string }; response: unknown }
  'crm:updateCustomer': { request: { id: string; data: { phone?: string; name?: string; email?: string; address?: string; gstin?: string; stateCode?: string; notes?: string } }; response: unknown }
  'crm:getCustomer': { request: { id: string }; response: unknown }
  'crm:getCustomerByPhone': { request: { phone: string }; response: unknown }
  'crm:searchCustomers': { request: { query: string }; response: unknown[] }
  'crm:getAllCustomers': { request: { limit?: number }; response: unknown[] }
  'crm:deleteCustomer': { request: { id: string }; response: boolean }
  'crm:createJob': { request: { customerId: string; deviceBrand?: string; deviceModel?: string; deviceSerial?: string; complaint: string; technician?: string; promisedDate?: number; notes?: string }; response: unknown }
  'crm:updateJobStatus': { request: { jobId: string; status: string; notes?: string }; response: unknown }
  'crm:updateJobDiagnosis': { request: { jobId: string; diagnosis: string; estimatedCost?: number; scanId?: string }; response: unknown }
  'crm:getJob': { request: { id: string }; response: unknown }
  'crm:getJobByTicket': { request: { ticketNumber: string }; response: unknown }
  'crm:getJobsByCustomer': { request: { customerId: string }; response: unknown[] }
  'crm:getJobsByStatus': { request: { status: string }; response: unknown[] }
  'crm:getAllJobs': { request: { limit?: number }; response: unknown[] }
  'crm:getActiveJobs': { request: void; response: unknown[] }
  'crm:getJobStats': { request: void; response: unknown }
  'crm:getCustomerWithJobs': { request: { customerId: string }; response: unknown }

  // Phase 4: Backup Wizard
  'backup:discoverTargets': { request: void; response: unknown[] }
  'backup:createPlan': { request: { targetPaths?: string[]; destinationPath?: string }; response: unknown }
  'backup:execute': { request: { targetPaths: string[]; destinationPath: string }; response: unknown }
  'backup:discoverBrowsers': { request: void; response: unknown[] }
  'backup:backupBrowser': { request: { browserName: string; destinationPath: string }; response: unknown }
  'backup:getStatus': { request: void; response: unknown }
  'backup:getMigrationGuide': { request: { type: string }; response: unknown }

  // Phase 4: i18n
  'i18n:setLanguage': { request: { lang: string }; response: void }
  'i18n:getLanguage': { request: void; response: string }
  'i18n:getSupportedLanguages': { request: void; response: unknown[] }
  'i18n:getTranslations': { request: { lang: string }; response: Record<string, string> }

  // Full Scan
  'scan:full': { request: ScanConfig; response: ScanResult }
  'scan:quick': { request: void; response: ScanResult }

  // Reports
  'report:generate': { request: { scanId: string }; response: { filePath: string } }

  // AI Diagnostics
  'ai:runDiagnosis': { request: void; response: unknown }
  'ai:getHealthScore': { request: void; response: unknown }
  'ai:collectMetrics': { request: void; response: unknown }
  'ai:getProviderConfig': { request: void; response: AIProviderConfig }
  'ai:setProviderConfig': { request: AIProviderConfig; response: AIProviderConfig }

  // Jobs
  'job:getAll': { request: void; response: Job[] }
  'job:cancel': { request: { jobId: string }; response: void }
}

// App State
export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  language: string
  autoScan: boolean
  scanInterval: number
  notifications: boolean
  backupBeforeFix: boolean
  maxMemoryPercent: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  autoScan: false,
  scanInterval: 24,
  notifications: true,
  backupBeforeFix: true,
  maxMemoryPercent: 15
}
