import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { uptime as systemUptime } from 'os'
import si from 'systeminformation'
import { createLogger } from '../logger'
import { app } from 'electron'
import { getAIProviderConfig } from './ai-config'
import { buildEvidence, createProviders } from './ai-provider'
import { collectChipTelemetry } from './chip-telemetry'
import type { AIProviderConfig, AIProviderId, SystemInfo } from '../../shared/types'
import { getFullSystemInfo } from './system-scanner'

const logger = createLogger('ai-diagnostics')

// Cached ONNX session to avoid recreating on every call
let cachedOrtSession: unknown = null
let cachedOrtModule: typeof import('onnxruntime-node') | null = null
let cachedModelPath: string | null = null
let lastModelPaths: string[] = []

// Diagnostic labels matching the trained ONNX model
const DIAGNOSTIC_LABELS = [
  'Healthy',
  'Overheating',
  'MemoryIssue',
  'DiskFailing',
  'MalwareInfection',
  'DriverIssue',
  'PerformanceDegraded',
  'NetworkProblem'
] as const

type DiagnosticLabel = (typeof DIAGNOSTIC_LABELS)[number]

// Human-readable descriptions for each diagnosis
const DIAGNOSIS_DESCRIPTIONS: Record<DiagnosticLabel, string> = {
  Healthy: 'System is running normally. No significant issues detected.',
  Overheating: 'System temperatures are elevated. CPU/GPU may be throttling due to heat.',
  MemoryIssue: 'RAM usage is critically high. System may be running out of memory.',
  DiskFailing: 'Disk performance is degraded. Storage may be failing or nearly full.',
  MalwareInfection: 'Suspicious activity detected. High CPU/process count with unusual network activity.',
  DriverIssue: 'Frequent system errors detected. Driver instability causing crashes or reboots.',
  PerformanceDegraded: 'Overall system performance is poor. Multiple resources are under strain.',
  NetworkProblem: 'Network connectivity issues detected. High latency or connection problems.'
}

// Recommended actions for each diagnosis
const DIAGNOSIS_ACTIONS: Record<DiagnosticLabel, string[]> = {
  Healthy: [
    'Continue normal operation',
    'Consider running scheduled maintenance',
    'Keep drivers and OS updated'
  ],
  Overheating: [
    'Clean dust from fans and heatsinks',
    'Check thermal paste condition',
    'Ensure proper ventilation',
    'Reduce CPU-intensive background tasks',
    'Consider replacing thermal pads on laptop'
  ],
  MemoryIssue: [
    'Close unnecessary applications',
    'Check for memory leaks in running programs',
    'Run Memory Diagnostics module',
    'Consider upgrading RAM',
    'Disable startup programs consuming memory'
  ],
  DiskFailing: [
    'Back up important data immediately',
    'Run CHKDSK / fsck to check for errors',
    'Check SMART status with Hardware Diagnostics',
    'Free up disk space (run Performance Optimizer)',
    'Consider replacing the drive'
  ],
  MalwareInfection: [
    'Run full Malware Scan immediately',
    'Check for unknown processes in Task Manager',
    'Disconnect from network if data theft suspected',
    'Update antivirus definitions',
    'Check browser extensions for adware'
  ],
  DriverIssue: [
    'Check Firmware & Driver module for outdated drivers',
    'Review Windows Event Viewer for error codes',
    'Run System File Checker (OS Repair module)',
    'Update or rollback recently changed drivers',
    'Check for Windows updates'
  ],
  PerformanceDegraded: [
    'Restart the computer (uptime may be too high)',
    'Run Performance Optimizer cleanup',
    'Disable unnecessary startup programs',
    'Check for pending Windows updates',
    'Run disk defragmentation (HDD only)'
  ],
  NetworkProblem: [
    'Run Network Diagnostics module',
    'Restart router/modem',
    'Flush DNS cache',
    'Check for IP conflicts',
    'Update network adapter drivers'
  ]
}

// Severity levels for each diagnosis
const DIAGNOSIS_SEVERITY: Record<DiagnosticLabel, 'low' | 'medium' | 'high' | 'critical'> = {
  Healthy: 'low',
  Overheating: 'high',
  MemoryIssue: 'high',
  DiskFailing: 'critical',
  MalwareInfection: 'critical',
  DriverIssue: 'medium',
  PerformanceDegraded: 'medium',
  NetworkProblem: 'medium'
}

export interface DiagnosticResult {
  diagnosis: DiagnosticLabel
  confidence: number
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: string[]
  allProbabilities: Array<{ label: DiagnosticLabel; probability: number }>
  metrics: SystemMetrics
  timestamp: string
  modelVersion: string
  inferenceTimeMs: number
  provider: 'cloudflare' | 'custom' | 'onnx' | 'rules'
  providerLabel: string
  fallbackReason?: string
  inputProvenance: MetricProvenance
}

export type MetricProvenanceState = 'measured' | 'estimated' | 'not_measured'

export type MetricProvenance = Record<keyof Omit<SystemMetrics, 'provenance'>, MetricProvenanceState>

export interface SystemMetrics {
  cpuUsagePercent: number
  ramUsagePercent: number
  diskUsagePercent: number
  temperatureCelsius: number
  processCount: number
  diskIOLatencyMs: number
  networkLatencyMs: number
  errorCount: number
  uptimeHours: number
  fanRPM: number
  provenance: MetricProvenance
}

// Find the ONNX model file
function findModelPath(): string | null {
  const possiblePaths: string[] = []
  // In packaged builds extraResources is outside app.asar and is the
  // authoritative location. Keep it first so a stale working-directory file
  // cannot mask the packaged model.
  if (process.resourcesPath) {
    possiblePaths.push(join(process.resourcesPath, 'models', 'diagnostic-classifier.onnx'))
  }
  try {
    possiblePaths.push(join(app.getAppPath(), 'models', 'diagnostic-classifier.onnx'))
  } catch (error) {
    logger.warn('Unable to resolve Electron app path for ONNX model', { error })
  }
  // Development: models/ directory in the project root.
  possiblePaths.push(
    join(__dirname, '..', '..', '..', 'models', 'diagnostic-classifier.onnx'),
    resolve('models', 'diagnostic-classifier.onnx')
  )
  lastModelPaths = possiblePaths

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      logger.info('ONNX model located', { path: p, packaged: Boolean(app?.isPackaged) })
      return p
    }
  }
  logger.warn('ONNX model not found; tried packaged and development paths', {
    packaged: Boolean(app?.isPackaged),
    resourcesPath: process.resourcesPath,
    paths: possiblePaths
  })
  return null
}

export interface WindowsSensorProbe {
  command: string
  stdout: string
  parsedValue: number | null
  error?: string
}

export interface WindowsSensorReadings {
  temperatureCelsius: number | null
  networkLatencyMs: number | null
  fanRPM: number | null
  probes: {
    temperature: WindowsSensorProbe
    network: WindowsSensorProbe
    fan: WindowsSensorProbe
  }
}

export async function collectWindowsSensorReadings(): Promise<WindowsSensorReadings> {
  const unavailable: WindowsSensorReadings = {
    temperatureCelsius: null,
    networkLatencyMs: null,
    fanRPM: null,
    probes: {
      temperature: { command: '', stdout: '', parsedValue: null },
      network: { command: '', stdout: '', parsedValue: null },
      fan: { command: '', stdout: '', parsedValue: null }
    }
  }
  if (process.platform !== 'win32') return unavailable

  const { execFile } = await import('child_process')
  const runPowerShell = (command: string): Promise<string> => new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-Command', command],
      { encoding: 'utf8', timeout: 2500, windowsHide: true },
      (error, stdout) => error ? reject(error) : resolve(stdout.trim())
    )
  })
  const readNumber = async (command: string): Promise<WindowsSensorProbe> => {
    try {
      const stdout = await runPowerShell(command)
      const value = Number(stdout)
      return {
        command,
        stdout,
        parsedValue: Number.isFinite(value) && value > 0 ? value : null
      }
    } catch (error) {
      return {
        command,
        stdout: '',
        parsedValue: null,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  const [temperatureProbe, networkProbe, fanProbe] = await Promise.all([
    readNumber(
      "(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature " +
      "-ErrorAction Stop | Select-Object -First 1 -ExpandProperty CurrentTemperature)"
    ),
    readNumber(
      "$ping=New-Object System.Net.NetworkInformation.Ping; " +
      "$samples=@(1..2 | ForEach-Object { try { $reply=$ping.Send('1.1.1.1',1000); " +
      "if ($reply.Status -eq 'Success') { $reply.RoundtripTime } } catch {} }); " +
      "if ($samples.Count -gt 0) { ($samples | Measure-Object -Average).Average }"
    ),
    readNumber(
      "$values=@(); " +
      "$values += @(Get-CimInstance -ClassName Win32_Fan -ErrorAction SilentlyContinue | " +
      "ForEach-Object { $_.DesiredSpeed; $_.ActualSpeed }); " +
      "foreach ($namespace in @('root/LibreHardwareMonitor','root/OpenHardwareMonitor')) { " +
      "$values += @(Get-CimInstance -Namespace $namespace -ClassName Sensor " +
      "-ErrorAction SilentlyContinue | Where-Object { $_.SensorType -eq 'Fan' } | " +
      "Select-Object -ExpandProperty Value) }; " +
      "$value = $values | ForEach-Object { [double]$_ } | Where-Object { $_ -gt 0 } | " +
      "Select-Object -First 1; if ($null -ne $value) { $value }"
    )
  ])

  const temperatureCelsius = temperatureProbe.parsedValue === null
    ? null
    : temperatureProbe.parsedValue / 10 - 273.15
  return {
    temperatureCelsius: temperatureCelsius !== null && temperatureCelsius > 0 && temperatureCelsius < 150
      ? temperatureCelsius
      : null,
    networkLatencyMs: networkProbe.parsedValue,
    fanRPM: fanProbe.parsedValue,
    probes: {
      temperature: temperatureProbe,
      network: networkProbe,
      fan: fanProbe
    }
  }
}

// Collect real-time system metrics for the AI model
export async function collectSystemMetrics(): Promise<SystemMetrics> {
  logger.info('Collecting system metrics for AI diagnosis...')

  const [cpuLoad, mem, fsSize, cpuTemp, processes, disksIO, networkStats, time, windowsSensors] =
    await Promise.all([
      si.currentLoad().catch(() => ({ currentLoad: 0 })),
      si.mem(),
      si.fsSize(),
      si.cpuTemperature().catch(() => ({ main: 0 })),
      si.processes().catch(() => ({ all: 0, list: [] })),
      si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0, rWaitTime: 0, wWaitTime: 0 })),
      si.networkStats().catch(() => []),
      Promise.resolve(si.time()).catch(() => ({ uptime: 0 })),
      collectWindowsSensorReadings()
    ])

  // CPU usage percentage
  const cpuUsagePercent = Math.round(cpuLoad.currentLoad * 10) / 10

  // RAM usage percentage
  const ramUsagePercent = Math.round((mem.used / mem.total) * 1000) / 10

  // Disk usage percentage (primary/system disk)
  const primaryDisk = fsSize.find(
    (fs) => fs.mount === 'C:\\' || fs.mount === '/'
  ) || fsSize[0]
  const diskUsagePercent = primaryDisk ? Math.round(primaryDisk.use * 10) / 10 : 0

  // Temperature. Keep the numeric model input usable, but record when no sensor
  // reading was available rather than presenting the fallback as measured.
  const systemInformationTemperature = typeof cpuTemp.main === 'number' && cpuTemp.main > 0
    ? cpuTemp.main
    : null
  const temperatureCelsius = systemInformationTemperature
    ?? windowsSensors.temperatureCelsius
    ?? 0
  const temperatureProvenance: MetricProvenanceState =
    temperatureCelsius > 0 && temperatureCelsius < 150 ? 'measured' : 'not_measured'

  // Process count
  const processCount = processes.all || 0

  // Disk IO latency (average of read + write wait times)
  // disksIO may return null/undefined properties on some Windows versions
  const ioData = (disksIO ?? {}) as Record<string, number | null | undefined>
  const rWait = Number(ioData.rWaitTime) || 0
  const wWait = Number(ioData.wWaitTime) || 0
  const diskIOLatencyMs = Math.round((rWait + wWait) / 2)

  // Network interface state is useful context, but it is not a latency
  // measurement. Use the real ICMP result when the Windows probe succeeded.
  const netStats = Array.isArray(networkStats) ? networkStats : []
  const activeNet = netStats.find((n) => n.operstate === 'up')
  const networkLatencyMs = windowsSensors.networkLatencyMs ?? 0
  const networkLatencyProvenance: MetricProvenanceState =
    windowsSensors.networkLatencyMs === null ? 'not_measured' : 'measured'
  if (!activeNet && windowsSensors.networkLatencyMs !== null) {
    logger.warn('Network latency probe returned a value without an active interface')
  }

  // Error count from event log (Windows) or syslog
  let errorCount = 0
  let errorCountMeasured = false
  if (process.platform === 'win32') {
    try {
      const { execSync } = await import('child_process')
      const output = execSync(
        `powershell -NoProfile -Command "$start=(Get-Date).AddHours(-24); [int]@(Get-WinEvent -FilterHashtable @{LogName='System'; Level=2; StartTime=$start} -ErrorAction SilentlyContinue).Count"`,
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      errorCount = parseInt(output, 10) || 0
      errorCountMeasured = /^\d+$/.test(output)
    } catch {
      errorCount = 0
    }
  }

  // Uptime in hours
  const rawUptimeSeconds = Number(time.uptime) > 0 ? Number(time.uptime) : systemUptime()
  const uptimeHours = Math.round(rawUptimeSeconds / 3600 * 10) / 10

  // Fan speed is not exposed by many systems. Keep the model input numeric,
  // but never turn temperature into a fabricated RPM value.
  const fanRPM = windowsSensors.fanRPM ?? 0

  const metrics: SystemMetrics = {
    cpuUsagePercent,
    ramUsagePercent,
    diskUsagePercent,
    temperatureCelsius,
    processCount,
    diskIOLatencyMs,
    networkLatencyMs,
    errorCount,
    uptimeHours,
    fanRPM,
    provenance: {
      cpuUsagePercent: 'measured',
      ramUsagePercent: 'measured',
      diskUsagePercent: 'measured',
      temperatureCelsius: temperatureProvenance,
      processCount: 'measured',
      diskIOLatencyMs: 'measured',
      networkLatencyMs: networkLatencyProvenance,
      errorCount: errorCountMeasured ? 'measured' : 'not_measured',
      uptimeHours: 'measured',
      fanRPM: windowsSensors.fanRPM === null ? 'not_measured' : 'measured'
    }
  }

  logger.info('System metrics collected', { metrics })
  return metrics
}

// Run ONNX inference on collected metrics
async function runOnnxInference(
  metrics: SystemMetrics
): Promise<{
  probabilities: number[]
  inferenceTimeMs: number
  provider: 'onnx' | 'rules'
  modelPath?: string
  attemptedPaths: string[]
  error?: string
}> {
  const modelPath = findModelPath()

  if (!modelPath) {
    logger.warn('ONNX model unavailable, using rule-based fallback')
    return {
      probabilities: runRuleBasedDiagnosis(metrics),
      inferenceTimeMs: 0,
      provider: 'rules',
      attemptedPaths: lastModelPaths,
      error: 'ONNX model not found'
    }
  }

  try {
    // Dynamic import to handle environments where onnxruntime-node isn't available
    // Cache both the module and session for reuse across calls
    if (!cachedOrtModule) {
      cachedOrtModule = await import('onnxruntime-node')
    }
    const ort = cachedOrtModule

    const startTime = Date.now()

    // Reuse cached session if model path hasn't changed
    if (!cachedOrtSession || cachedModelPath !== modelPath) {
      cachedOrtSession = await ort.InferenceSession.create(modelPath)
      cachedModelPath = modelPath
    }
    const session = cachedOrtSession as import('onnxruntime-node').InferenceSession

    // Create input tensor: [1, 10] float32
    const inputArray = new Float32Array([
      metrics.cpuUsagePercent,
      metrics.ramUsagePercent,
      metrics.diskUsagePercent,
      metrics.temperatureCelsius,
      metrics.processCount,
      metrics.diskIOLatencyMs,
      metrics.networkLatencyMs,
      metrics.errorCount,
      metrics.uptimeHours,
      metrics.fanRPM
    ])

    const tensor = new ort.Tensor('float32', inputArray, [1, 10])
    const feeds = { features: tensor }
    // The sklearn exporter includes a ZipMap output_probability sequence/map.
    // onnxruntime-node cannot materialize that non-tensor output, so request
    // the tensor label output explicitly instead.
    const results = await session.run(feeds, ['output_label'])

    const inferenceTimeMs = Date.now() - startTime

    // Extract the predicted label from the tensor output. The model's
    // probability output is a ZipMap sequence unsupported by onnxruntime-node.
    let probabilities: number[] = new Array(DIAGNOSTIC_LABELS.length).fill(0)
    const labelOutput = results['output_label']
    if (!labelOutput) {
      throw new Error('ONNX model did not return output_label')
    }
    const labelData = labelOutput.data as unknown[]
    const label = Number(labelData[0])
    if (!Number.isInteger(label) || label < 0 || label >= probabilities.length) {
      throw new Error(`ONNX model returned invalid output_label: ${String(labelData[0])}`)
    }
    probabilities[label] = 1.0

    logger.info('ONNX inference completed', {
      inferenceTimeMs,
      modelPath,
      output: 'output_label',
      probabilities
    })
    return { probabilities, inferenceTimeMs, provider: 'onnx', modelPath, attemptedPaths: lastModelPaths }
  } catch (err) {
    logger.error('ONNX runtime/model inference failed, falling back to rules', {
      error: err,
      modelPath,
      packaged: Boolean(app?.isPackaged),
      resourcesPath: process.resourcesPath
    })
    return {
      probabilities: runRuleBasedDiagnosis(metrics),
      inferenceTimeMs: 0,
      provider: 'rules',
      modelPath,
      attemptedPaths: lastModelPaths,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export { runOnnxInference }

// Rule-based fallback when ONNX model is unavailable
function runRuleBasedDiagnosis(metrics: SystemMetrics): number[] {
  const scores = new Array(DIAGNOSTIC_LABELS.length).fill(0.01)

  // Overheating check
  if (metrics.temperatureCelsius > 75) scores[1] += 0.8
  else if (metrics.temperatureCelsius > 65) scores[1] += 0.3

  // Memory issue check
  if (metrics.ramUsagePercent > 90) scores[2] += 0.8
  else if (metrics.ramUsagePercent > 80) scores[2] += 0.4

  // Disk failing check
  if (metrics.diskUsagePercent > 95) scores[3] += 0.5
  if (metrics.diskIOLatencyMs > 50) scores[3] += 0.5
  else if (metrics.diskIOLatencyMs > 20) scores[3] += 0.2

  // Malware check
  if (metrics.processCount > 200 && metrics.cpuUsagePercent > 60) scores[4] += 0.6
  if (metrics.networkLatencyMs > 200 && metrics.cpuUsagePercent > 50) scores[4] += 0.3

  // Driver issue check
  // Use a recent, uncapped error signal without allowing a noisy event log to
  // dominate the diagnosis by itself.
  if (metrics.errorCount > 20) scores[5] += 0.2
  if (metrics.errorCount > 100) scores[5] += 0.2
  if (metrics.uptimeHours < 2 && metrics.errorCount > 10) scores[5] += 0.15

  // Performance degraded check
  if (metrics.cpuUsagePercent > 70 && metrics.ramUsagePercent > 70) scores[6] += 0.5
  if (metrics.uptimeHours > 168) scores[6] += 0.3 // > 1 week uptime
  if (metrics.diskUsagePercent > 85) scores[6] += 0.2

  // Network problem check
  if (metrics.networkLatencyMs > 100) scores[7] += 0.7
  else if (metrics.networkLatencyMs > 50) scores[7] += 0.3

  // If nothing stands out, system is healthy
  const maxNonHealthy = Math.max(...scores.slice(1))
  if (maxNonHealthy < 0.3) scores[0] = 0.9

  // Normalize to sum to 1
  const total = scores.reduce((a: number, b: number) => a + b, 0)
  return scores.map((s: number) => s / total)
}

export async function runLocalDiagnosis(metrics: SystemMetrics): Promise<DiagnosticResult> {
  const { probabilities, inferenceTimeMs, provider } = await runOnnxInference(metrics)

  // Step 3: Determine primary diagnosis
  const maxIdx = probabilities.indexOf(Math.max(...probabilities))
  const diagnosis = DIAGNOSTIC_LABELS[maxIdx]
  const confidence = Math.round(probabilities[maxIdx] * 1000) / 10

  // Step 4: Build all probabilities sorted by likelihood
  const allProbabilities = DIAGNOSTIC_LABELS.map((label, idx) => ({
    label,
    probability: Math.round(probabilities[idx] * 1000) / 10
  })).sort((a, b) => b.probability - a.probability)

  const result: DiagnosticResult = {
    diagnosis,
    confidence,
    description: DIAGNOSIS_DESCRIPTIONS[diagnosis],
    severity: DIAGNOSIS_SEVERITY[diagnosis],
    actions: DIAGNOSIS_ACTIONS[diagnosis],
    allProbabilities,
    metrics,
    timestamp: new Date().toISOString(),
    modelVersion: '1.0.0-rf50',
    inferenceTimeMs,
    provider,
    providerLabel: provider === 'onnx' ? 'Offline ONNX' : 'Rules',
    inputProvenance: metrics.provenance
  }
  return result
}

function providerConfig(): AIProviderConfig {
  return getAIProviderConfig()
}

function orderedProviderIds(config: AIProviderConfig): AIProviderId[] {
  return [...new Set<AIProviderId>([...config.priority, 'onnx', 'rules'])]
}

function emptyMetrics(): SystemMetrics {
  return {
    cpuUsagePercent: 0,
    ramUsagePercent: 0,
    diskUsagePercent: 0,
    temperatureCelsius: 0,
    processCount: 0,
    diskIOLatencyMs: 0,
    networkLatencyMs: 0,
    errorCount: 0,
    uptimeHours: 0,
    fanRPM: 0,
    provenance: {
      cpuUsagePercent: 'not_measured',
      ramUsagePercent: 'not_measured',
      diskUsagePercent: 'not_measured',
      temperatureCelsius: 'not_measured',
      processCount: 'not_measured',
      diskIOLatencyMs: 'not_measured',
      networkLatencyMs: 'not_measured',
      errorCount: 'not_measured',
      uptimeHours: 'not_measured',
      fanRPM: 'not_measured'
    }
  }
}

const PROVIDER_LABELS: Record<DiagnosticResult['provider'], string> = {
  cloudflare: 'Cloudflare Workers AI',
  custom: 'Custom AI provider',
  onnx: 'Offline ONNX',
  rules: 'Rules fallback'
}

function providerAvailabilityReason(id: AIProviderId, config: AIProviderConfig): string {
  if (id === 'cloudflare') {
    if (!config.cloudConsent) return 'Cloudflare skipped: cloud consent is disabled.'
    if (!config.cloudUrl.trim()) return 'Cloudflare skipped: Worker URL is empty.'
    if (!config.cloudToken.trim()) return 'Cloudflare skipped: bearer token is missing.'
  }
  if (id === 'custom') {
    if (!config.cloudConsent) return 'Custom provider skipped: cloud consent is disabled.'
    if (!config.customBaseUrl.trim()) return 'Custom provider skipped: endpoint is empty.'
    if (!config.customApiKey.trim()) return 'Custom provider skipped: API key is missing.'
    if (!config.customModel.trim()) return 'Custom provider skipped: model is missing.'
  }
  return `${PROVIDER_LABELS[id === 'onnx' || id === 'rules' ? id : 'rules']} was unavailable.`
}

function emptySystemInfo(): SystemInfo {
  return {
    os: { platform: process.platform, distro: '', release: '', arch: '', hostname: '', build: '' },
    cpu: { manufacturer: '', brand: '', speed: 0, cores: 0, physicalCores: 0 },
    memory: { total: 0, free: 0, used: 0, usedPercent: 0, swapTotal: 0, swapUsed: 0 },
    disk: [],
    battery: {
      hasBattery: false,
      isCharging: false,
      percent: 0,
      cycleCount: 0,
      designCapacity: 0,
      currentCapacity: 0,
      healthPercent: 0,
      voltage: 0,
      timeRemaining: 0,
      manufacturer: '',
      model: '',
      powerSource: 'AC'
    },
    graphics: { controllers: [], displays: [] },
    network: [],
    uptime: 0
  }
}

// Main diagnosis function
export async function runAIDiagnosis(): Promise<DiagnosticResult> {
  logger.info('Starting AI-powered system diagnosis...')
  let metrics: SystemMetrics
  try {
    metrics = await collectSystemMetrics()
  } catch (err) {
    logger.warn('Metrics collection failed; using unknown local metrics', { error: err })
    metrics = emptyMetrics()
  }
  let systemInfo: SystemInfo
  try {
    systemInfo = await getFullSystemInfo()
  } catch (err) {
    logger.warn('System information collection failed; using unknown evidence', { error: err })
    systemInfo = emptySystemInfo()
  }
  const telemetry = await collectChipTelemetry()
  const config = providerConfig()
  const evidence = buildEvidence(systemInfo, metrics, config.cloudConsent, telemetry)
  const providers = createProviders()
  const localDiagnosis = async (): Promise<DiagnosticResult> => runLocalDiagnosis(metrics)
  const context = {
    metrics,
    systemInfo,
    evidence,
    config,
    localDiagnosis
  }
  const providerFailures: string[] = []

  for (const id of orderedProviderIds(config)) {
    const provider = providers[id]
    if (!provider) {
      providerFailures.push(`${id} provider is unavailable.`)
      continue
    }
    if (!provider.isAvailable(config)) {
      providerFailures.push(providerAvailabilityReason(id, config))
      continue
    }
    try {
      const result = await provider.diagnose(context)
      const providerLabel = PROVIDER_LABELS[result.provider]
      logger.info('AI diagnosis complete', {
        provider: result.provider,
        diagnosis: result.diagnosis,
        confidence: result.confidence,
        severity: result.severity
      })
      return {
        ...result,
        providerLabel,
        ...(providerFailures.length > 0 ? { fallbackReason: providerFailures.join(' ') } : {}),
        inputProvenance: metrics.provenance
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      providerFailures.push(`${PROVIDER_LABELS[id]} failed: ${reason}`)
      logger.warn(`AI provider ${id} failed; falling through`, { error: err })
    }
  }

  const fallback = await localDiagnosis()
  logger.info('AI diagnosis complete', { provider: fallback.provider, fallbackReason: providerFailures.join(' ') })
  return {
    ...fallback,
    providerLabel: PROVIDER_LABELS[fallback.provider],
    ...(providerFailures.length > 0 ? { fallbackReason: providerFailures.join(' ') } : {}),
    inputProvenance: metrics.provenance
  }
}

// Quick health score (0-100, higher = healthier)
export async function getHealthScore(): Promise<{
  score: number
  grade: string
  summary: string
}> {
  const result = await runAIDiagnosis()

  // Calculate health score based on diagnosis confidence
  let score: number
  if (result.diagnosis === 'Healthy') {
    score = Math.round(80 + result.confidence * 0.2)
  } else {
    const severityPenalty = {
      low: 10,
      medium: 25,
      high: 40,
      critical: 60
    }
    score = Math.max(0, Math.round(100 - severityPenalty[result.severity] - result.confidence * 0.3))
  }

  score = Math.min(100, Math.max(0, score))

  const grade =
    score >= 90 ? 'A+' :
    score >= 80 ? 'A' :
    score >= 70 ? 'B' :
    score >= 60 ? 'C' :
    score >= 50 ? 'D' : 'F'

  const summary =
    score >= 80
      ? 'System is in good health. Minor maintenance recommended.'
      : score >= 60
        ? `System needs attention. Primary issue: ${result.diagnosis}`
        : `System has significant problems. ${result.description}`

  return { score, grade, summary }
}
