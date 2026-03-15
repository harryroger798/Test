import { useState } from 'react'
import { Brain, Loader2, Activity, Shield, AlertTriangle, CheckCircle, Thermometer, HardDrive, Cpu, Wifi, Bug, Wrench, Gauge } from 'lucide-react'

interface SystemMetrics {
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

interface DiagnosticProbability {
  label: string
  probability: number
}

interface AIDiagnosticResult {
  diagnosis: string
  confidence: number
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: string[]
  allProbabilities: DiagnosticProbability[]
  metrics: SystemMetrics
  timestamp: string
  modelVersion: string
  inferenceTimeMs: number
}

interface HealthScore {
  score: number
  grade: string
  summary: string
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-emerald-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400'
}

const SEVERITY_BG: Record<string, string> = {
  low: 'bg-emerald-500/10 border-emerald-500/30',
  medium: 'bg-yellow-500/10 border-yellow-500/30',
  high: 'bg-orange-500/10 border-orange-500/30',
  critical: 'bg-red-500/10 border-red-500/30'
}

const DIAGNOSIS_ICONS: Record<string, typeof Brain> = {
  Healthy: CheckCircle,
  Overheating: Thermometer,
  MemoryIssue: Cpu,
  DiskFailing: HardDrive,
  MalwareInfection: Bug,
  DriverIssue: Wrench,
  PerformanceDegraded: Gauge,
  NetworkProblem: Wifi
}

function MetricBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }): JSX.Element {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">{value}{unit}</span>
      </div>
      <div className="w-full h-2 bg-surface-lighter rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ProbabilityBar({ label, probability }: { label: string; probability: number }): JSX.Element {
  const color = probability > 50 ? 'bg-red-500' : probability > 20 ? 'bg-yellow-500' : probability > 5 ? 'bg-blue-500' : 'bg-gray-600'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-36 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-lighter rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.max(1, probability)}%` }} />
      </div>
      <span className="text-xs text-white font-mono w-12 text-right">{probability}%</span>
    </div>
  )
}

export function AIDiagnosticsPage(): JSX.Element {
  const [loading, setLoading] = useState('')
  const [diagnosis, setDiagnosis] = useState<AIDiagnosticResult | null>(null)
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  async function runFullDiagnosis(): Promise<void> {
    setLoading('diagnosis')
    setHealthScore(null)
    try {
      const result = await window.bytefix.aiRunDiagnosis()
      setDiagnosis(result)
      setMetrics(result.metrics)
    } catch (err) {
      console.error('AI diagnosis failed:', err)
    } finally {
      setLoading('')
    }
  }

  async function runHealthCheck(): Promise<void> {
    setLoading('health')
    setDiagnosis(null)
    setMetrics(null)
    try {
      setHealthScore(await window.bytefix.aiGetHealthScore())
    } catch (err) {
      console.error('Health check failed:', err)
    } finally {
      setLoading('')
    }
  }

  async function collectMetricsOnly(): Promise<void> {
    setLoading('metrics')
    setDiagnosis(null)
    setHealthScore(null)
    try {
      setMetrics(await window.bytefix.aiCollectMetrics())
    } catch (err) {
      console.error('Metrics collection failed:', err)
    } finally {
      setLoading('')
    }
  }

  const DiagIcon = diagnosis ? (DIAGNOSIS_ICONS[diagnosis.diagnosis] || Brain) : Brain

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-400" /> AI Smart Diagnostics
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          ONNX-powered local AI — analyzes system metrics to diagnose issues. No internet required, runs 100% offline.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={runFullDiagnosis}
          disabled={!!loading}
          className="card hover:border-purple-500/50 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            {loading === 'diagnosis' ? <Loader2 className="w-8 h-8 text-purple-400 animate-spin" /> : <Brain className="w-8 h-8 text-purple-400" />}
            <div>
              <p className="font-medium text-white">Full AI Diagnosis</p>
              <p className="text-xs text-gray-400">Analyze system + predict issues</p>
            </div>
          </div>
        </button>

        <button
          onClick={runHealthCheck}
          disabled={!!loading}
          className="card hover:border-green-500/50 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            {loading === 'health' ? <Loader2 className="w-8 h-8 text-green-400 animate-spin" /> : <Shield className="w-8 h-8 text-green-400" />}
            <div>
              <p className="font-medium text-white">Quick Health Score</p>
              <p className="text-xs text-gray-400">Get A+ to F grade instantly</p>
            </div>
          </div>
        </button>

        <button
          onClick={collectMetricsOnly}
          disabled={!!loading}
          className="card hover:border-blue-500/50 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            {loading === 'metrics' ? <Loader2 className="w-8 h-8 text-blue-400 animate-spin" /> : <Activity className="w-8 h-8 text-blue-400" />}
            <div>
              <p className="font-medium text-white">Collect Metrics</p>
              <p className="text-xs text-gray-400">View live system metrics</p>
            </div>
          </div>
        </button>
      </div>

      {/* Health Score Card */}
      {healthScore && (
        <div className="card border-green-500/30">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${
                healthScore.score >= 80 ? 'border-emerald-400' : healthScore.score >= 60 ? 'border-yellow-400' : 'border-red-400'
              }`}>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${
                    healthScore.score >= 80 ? 'text-emerald-400' : healthScore.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{healthScore.grade}</p>
                  <p className="text-xs text-gray-400">{healthScore.score}/100</p>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white text-lg">System Health Score</h3>
              <p className="text-sm text-gray-400 mt-1">{healthScore.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Diagnosis Result */}
      {diagnosis && (
        <div className={`card border ${SEVERITY_BG[diagnosis.severity]}`}>
          <div className="flex items-start gap-4">
            <DiagIcon className={`w-10 h-10 mt-1 ${SEVERITY_COLORS[diagnosis.severity]}`} />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-white text-lg">{diagnosis.diagnosis}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_BG[diagnosis.severity]} ${SEVERITY_COLORS[diagnosis.severity]}`}>
                  {diagnosis.severity.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500 ml-auto">
                  {diagnosis.confidence}% confidence | {diagnosis.inferenceTimeMs}ms inference
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-2">{diagnosis.description}</p>

              {/* Recommended Actions */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-white mb-2">Recommended Actions:</h4>
                <ul className="space-y-1">
                  {diagnosis.actions.map((action, i) => (
                    <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                      <span className="text-purple-400 mt-0.5">{'>'}</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Probability Breakdown */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-white mb-2">Diagnosis Probabilities:</h4>
                <div className="space-y-2">
                  {diagnosis.allProbabilities.map((p) => (
                    <ProbabilityBar key={p.label} label={p.label} probability={p.probability} />
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>Model: {diagnosis.modelVersion}</span>
                <span>Time: {new Date(diagnosis.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Metrics */}
      {metrics && (
        <div className="card">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" /> System Metrics (AI Input Features)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricBar label="CPU Usage" value={metrics.cpuUsagePercent} max={100} unit="%" color="bg-blue-500" />
            <MetricBar label="RAM Usage" value={metrics.ramUsagePercent} max={100} unit="%" color="bg-purple-500" />
            <MetricBar label="Disk Usage" value={metrics.diskUsagePercent} max={100} unit="%" color="bg-orange-500" />
            <MetricBar label="Temperature" value={metrics.temperatureCelsius} max={100} unit="C" color={metrics.temperatureCelsius > 70 ? 'bg-red-500' : 'bg-green-500'} />
            <MetricBar label="Processes" value={metrics.processCount} max={500} unit="" color="bg-cyan-500" />
            <MetricBar label="Disk I/O Latency" value={metrics.diskIOLatencyMs} max={100} unit="ms" color="bg-yellow-500" />
            <MetricBar label="Network Latency" value={metrics.networkLatencyMs} max={500} unit="ms" color={metrics.networkLatencyMs > 100 ? 'bg-red-500' : 'bg-green-500'} />
            <MetricBar label="System Errors" value={metrics.errorCount} max={50} unit="" color={metrics.errorCount > 10 ? 'bg-red-500' : 'bg-gray-500'} />
            <MetricBar label="Uptime" value={Math.round(metrics.uptimeHours)} max={720} unit="h" color="bg-indigo-500" />
            <MetricBar label="Fan Speed" value={metrics.fanRPM} max={4000} unit=" RPM" color="bg-teal-500" />
          </div>
        </div>
      )}

      {/* How It Works */}
      {!diagnosis && !healthScore && !metrics && (
        <div className="card border-purple-500/20">
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" /> How AI Diagnostics Works
          </h3>
          <div className="space-y-2 text-sm text-gray-400">
            <p>1. <span className="text-white">Collects 10 system metrics</span> — CPU, RAM, disk, temperature, processes, I/O latency, network, errors, uptime, fan speed</p>
            <p>2. <span className="text-white">Feeds metrics into ONNX model</span> — Random Forest classifier trained on 4,000 diagnostic scenarios</p>
            <p>3. <span className="text-white">Predicts the issue category</span> — Healthy, Overheating, Memory Issue, Disk Failing, Malware, Driver Issue, Performance Degraded, Network Problem</p>
            <p>4. <span className="text-white">Provides actionable recommendations</span> — Specific fixes mapped to each diagnosis</p>
          </div>
          <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <p className="text-xs text-purple-300">
              100% offline — No API keys, no internet, no paid services. The ONNX model runs locally on the device in milliseconds.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
