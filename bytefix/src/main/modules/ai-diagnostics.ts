import { join, resolve } from 'path'
import { existsSync } from 'fs'
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
}

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
}

// Find the ONNX model file
function findModelPath(): string | null {
  const possiblePaths = [
    // Development: models/ directory in project root
    join(__dirname, '..', '..', '..', 'models', 'diagnostic-classifier.onnx'),
    // Production: extraResources
    join(process.resourcesPath || '', 'models', 'diagnostic-classifier.onnx'),
    // Electron app.getAppPath()
    join(app.getAppPath(), 'models', 'diagnostic-classifier.onnx'),
    // Fallback: resolve from current working directory
    resolve('models', 'diagnostic-classifier.onnx')
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p
    }
  }
  return null
}

// Collect real-time system metrics for the AI model
export async function collectSystemMetrics(): Promise<SystemMetrics> {
  logger.info('Collecting system metrics for AI diagnosis...')

  const [cpuLoad, mem, fsSize, cpuTemp, processes, disksIO, networkStats, time] =
    await Promise.all([
      si.currentLoad().catch(() => ({ currentLoad: 0 })),
      si.mem(),
      si.fsSize(),
      si.cpuTemperature().catch(() => ({ main: 0 })),
      si.processes().catch(() => ({ all: 0, list: [] })),
      si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0, rWaitTime: 0, wWaitTime: 0 })),
      si.networkStats().catch(() => []),
      si.time()
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

  // Temperature
  const temperatureCelsius = cpuTemp.main || 45 // Default to 45 if sensor unavailable

  // Process count
  const processCount = processes.all || 0

  // Disk IO latency (average of read + write wait times)
  // disksIO may return null/undefined properties on some Windows versions
  const ioData = (disksIO ?? {}) as Record<string, number | null | undefined>
  const rWait = Number(ioData.rWaitTime) || 0
  const wWait = Number(ioData.wWaitTime) || 0
  const diskIOLatencyMs = Math.round((rWait + wWait) / 2)

  // Network latency estimation
  const netStats = Array.isArray(networkStats) ? networkStats : []
  let networkLatencyMs = 5 // Default healthy
  if (netStats.length > 0) {
    const activeNet = netStats.find((n) => n.operstate === 'up') || netStats[0]
    // Zero transfer rate just means network is idle, not broken
    // Only flag as issue if interface is down or no active interfaces found
    if (!activeNet || activeNet.operstate !== 'up') {
      networkLatencyMs = 200 // Interface down = likely problem
    }
    // Otherwise keep default healthy latency — idle network is normal
  }

  // Error count from event log (Windows) or syslog
  let errorCount = 0
  if (process.platform === 'win32') {
    try {
      const { execSync } = await import('child_process')
      const output = execSync(
        'powershell -NoProfile -Command "(Get-EventLog -LogName System -EntryType Error -Newest 100 -ErrorAction SilentlyContinue).Count"',
        { encoding: 'utf8', timeout: 10000, stdio: 'pipe' }
      ).trim()
      errorCount = parseInt(output, 10) || 0
    } catch {
      errorCount = 0
    }
  }

  // Uptime in hours
  const uptimeHours = Math.round((time.uptime || 0) / 3600 * 10) / 10

  // Fan RPM (not available on most systems, estimate from temperature)
  const fanRPM = temperatureCelsius > 70 ? 2500 : temperatureCelsius > 55 ? 1500 : 1000

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
    fanRPM
  }

  logger.info('System metrics collected', { metrics })
  return metrics
}

// Run ONNX inference on collected metrics
async function runOnnxInference(
  metrics: SystemMetrics
): Promise<{ probabilities: number[]; inferenceTimeMs: number; provider: 'onnx' | 'rules' }> {
  const modelPath = findModelPath()

  if (!modelPath) {
    logger.warn('ONNX model not found, using rule-based fallback')
    return { probabilities: runRuleBasedDiagnosis(metrics), inferenceTimeMs: 0, provider: 'rules' }
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
    const results = await session.run(feeds)

    const inferenceTimeMs = Date.now() - startTime

    // Extract probabilities from the output
    // sklearn RandomForest ONNX outputs: 'output_label' and 'output_probability'
    const probOutput = results['output_probability']
    let probabilities: number[] = new Array(DIAGNOSTIC_LABELS.length).fill(0)

    if (probOutput) {
      // output_probability is a sequence of maps for RandomForest
      const probData = probOutput.data as unknown
      if (Array.isArray(probData) && probData.length > 0) {
        const probMap = probData[0] as Map<number, number> | Record<string, number>
        if (probMap instanceof Map) {
          probMap.forEach((value: number, key: number) => {
            if (key >= 0 && key < probabilities.length) {
              probabilities[key] = value
            }
          })
        } else if (typeof probMap === 'object') {
          for (const [key, value] of Object.entries(probMap)) {
            const idx = parseInt(key, 10)
            if (idx >= 0 && idx < probabilities.length) {
              probabilities[idx] = value as number
            }
          }
        }
      }
    } else {
      // Fallback: try to get label and assign 100% to it
      const labelOutput = results['output_label']
      if (labelOutput) {
        const labelData = labelOutput.data as unknown[]
        const label = Number(labelData[0]) || 0
        probabilities = new Array(DIAGNOSTIC_LABELS.length).fill(0)
        probabilities[label] = 1.0
      }
    }

    logger.info('ONNX inference completed', { inferenceTimeMs, probabilities })
    return { probabilities, inferenceTimeMs, provider: 'onnx' }
  } catch (err) {
    logger.error('ONNX inference failed, falling back to rules', { error: err })
    return { probabilities: runRuleBasedDiagnosis(metrics), inferenceTimeMs: 0, provider: 'rules' }
  }
}

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
  if (metrics.errorCount > 20) scores[5] += 0.6
  if (metrics.uptimeHours < 2 && metrics.errorCount > 5) scores[5] += 0.3

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
    provider
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
    fanRPM: 0
  }
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

  for (const id of orderedProviderIds(config)) {
    const provider = providers[id]
    if (!provider || !provider.isAvailable(config)) continue
    try {
      const result = await provider.diagnose(context)
      logger.info('AI diagnosis complete', {
        provider: result.provider,
        diagnosis: result.diagnosis,
        confidence: result.confidence,
        severity: result.severity
      })
      return result
    } catch (err) {
      logger.warn(`AI provider ${id} failed; falling through`, { error: err })
    }
  }

  const fallback = await localDiagnosis()
  logger.info('AI diagnosis complete', { provider: fallback.provider })
  return fallback
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
