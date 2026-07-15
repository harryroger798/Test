import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, Loader2, Activity, Shield, AlertTriangle, CheckCircle, Thermometer, HardDrive, Cpu, Wifi, Bug, Wrench, Gauge } from 'lucide-react'
import type { FixResult } from '../../../../shared/types'

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
  provenance: Record<string, 'measured' | 'estimated' | 'not_measured'>
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
  provider: 'cloudflare' | 'custom' | 'onnx' | 'rules'
  providerLabel: string
  fallbackReason?: string
  inputProvenance: Record<string, 'measured' | 'estimated' | 'not_measured'>
}

interface HealthScore {
  score: number
  grade: string
  summary: string
}

interface FixRecommendation {
  title: string
  guidance: string
  route: string
  run?: () => Promise<FixResult>
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

function MetricBar({
  label,
  value,
  max,
  unit,
  color,
  provenance
}: {
  label: string
  value: number
  max: number
  unit: string
  color: string
  provenance?: 'measured' | 'estimated' | 'not_measured'
}): JSX.Element {
  const pct = Math.min(100, (value / max) * 100)
  const provenanceLabel = provenance === 'measured'
    ? 'measured'
    : provenance === 'estimated'
      ? 'estimated'
      : 'not measured'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-right">
          <span className="text-white font-mono">{value}{unit}</span>
          {provenance && <span className="ml-2 text-gray-500">({provenanceLabel})</span>}
        </span>
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

function getFixRecommendation(diagnosis: AIDiagnosticResult): FixRecommendation {
  const text = `${diagnosis.diagnosis} ${diagnosis.actions.join(' ')}`.toLowerCase()
  if (/\b(dns|winsock|tcp\/?ip|network|connectivity)\b/.test(text)) {
    return {
      title: 'Flush DNS cache',
      guidance: 'Clears the local DNS resolver cache without changing files or accounts.',
      route: '/network',
      run: () => window.bytefix.flushDns()
    }
  }
  if (/\b(overheat|thermal|cooling|temperature|fan)\b/.test(text)) {
    return {
      title: 'Optimize cooling',
      guidance: 'Applies the existing ByteFix thermal power-plan optimization.',
      route: '/overheating',
      run: () => window.bytefix.optimizeCooling()
    }
  }
  if (/\b(performance|slow|memory pressure|ram|process)\b/.test(text)) {
    return {
      title: 'Optimize memory',
      guidance: 'Runs the existing low-risk memory optimization flow.',
      route: '/performance',
      run: () => window.bytefix.optimizeRam()
    }
  }
  if (/\b(system file|windows file|component store|sfc|dism)\b/.test(text)) {
    return {
      title: 'Run System File Checker',
      guidance: 'Runs the existing Windows system-file repair flow.',
      route: '/os-repair',
      run: () => window.bytefix.runSfc()
    }
  }
  const routes: Record<string, string> = {
    Healthy: '/hardware',
    MemoryIssue: '/memory-diag',
    DiskFailing: '/hardware',
    MalwareInfection: '/malware',
    DriverIssue: '/hardware',
    PerformanceDegraded: '/performance',
    NetworkProblem: '/network',
    Overheating: '/overheating'
  }
  return {
    title: 'Open guided diagnostics',
    guidance: 'No conservative automated fix was selected; review the related module before taking action.',
    route: routes[diagnosis.diagnosis] || '/hardware'
  }
}

function FixEvidence({ result }: { result: FixResult }): JSX.Element {
  return (
    <div className={`mt-4 rounded-lg border p-3 ${result.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className="flex items-center gap-2">
        {result.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
        <p className="text-sm font-medium text-white">{result.description}</p>
      </div>
      {result.execution?.exitCode !== undefined && (
        <p className="text-xs text-gray-400 mt-2">Exit status: {result.execution.exitCode}</p>
      )}
      {result.execution?.commands?.length ? (
        <div className="mt-2">
          <p className="text-xs text-gray-500">Executed steps</p>
          {result.execution.commands.map((command) => <code key={command} className="block text-xs text-gray-400">{command}</code>)}
        </div>
      ) : null}
      {result.execution?.outputTail && (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-xs text-gray-500">
          {result.execution.outputTail}
        </pre>
      )}
      {result.details.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-gray-400">
          {result.details.slice(-5).map((detail) => <li key={detail}>• {detail}</li>)}
        </ul>
      )}
      {result.error && <p className="text-xs text-red-400 mt-2">{result.error}</p>}
    </div>
  )
}

export function AIDiagnosticsPage(): JSX.Element {
  const navigate = useNavigate()
  const [loading, setLoading] = useState('')
  const [diagnosis, setDiagnosis] = useState<AIDiagnosticResult | null>(null)
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [fixResult, setFixResult] = useState<FixResult | null>(null)

  async function runFullDiagnosis(): Promise<void> {
    setLoading('diagnosis')
    setHealthScore(null)
    setFixResult(null)
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
  const recommendation = diagnosis ? getFixRecommendation(diagnosis) : null

  async function runRecommendedFix(): Promise<void> {
    if (!recommendation) return
    if (!recommendation.run) {
      navigate(recommendation.route)
      return
    }
    setLoading('fix')
    try {
      setFixResult(await recommendation.run())
    } catch (err) {
      setFixResult({
        success: false,
        module: 'ai-diagnostics',
        action: 'recommended-fix',
        description: 'Recommended fix failed to start.',
        details: [String(err)],
        changes: [],
        rollbackAvailable: false,
        error: String(err)
      })
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-400" /> AI Smart Diagnostics
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Provider-aware AI diagnosis with an offline ONNX fallback. Remote providers run only with explicit consent.
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
                <span className="text-xs px-2 py-0.5 rounded-full border border-purple-500/30 text-purple-300">
                  Analyzed by: {diagnosis.providerLabel}
                </span>
                <span className="text-xs text-gray-500 ml-auto">
                  {diagnosis.confidence}% confidence | {diagnosis.inferenceTimeMs}ms inference
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-2">{diagnosis.description}</p>
              {diagnosis.fallbackReason && (
                <p className="text-xs text-yellow-300/80 mt-2">
                  Provider routing note: {diagnosis.fallbackReason}
                </p>
              )}

              {recommendation && (
                <div className="mt-4 rounded-lg border border-bytefix-500/30 bg-bytefix-500/5 p-3">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-5 h-5 text-bytefix-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{recommendation.title}</p>
                      <p className="text-xs text-gray-400 mt-1">{recommendation.guidance}</p>
                    </div>
                    <button onClick={() => void runRecommendedFix()} disabled={!!loading} className="btn-primary text-sm">
                      {loading === 'fix' ? 'Running...' : recommendation.run ? 'Fix this' : 'Open guidance'}
                    </button>
                  </div>
                  {fixResult && <FixEvidence result={fixResult} />}
                </div>
              )}

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
                <h4 className="text-sm font-medium text-white mb-2">
                  {diagnosis.provider === 'cloudflare' || diagnosis.provider === 'custom'
                    ? 'Candidate Causes:'
                    : 'Diagnosis Probabilities:'}
                </h4>
                <div className="space-y-2">
                  {diagnosis.allProbabilities.length > 0
                    ? diagnosis.allProbabilities.map((p) => (
                      <ProbabilityBar key={p.label} label={p.label} probability={p.probability} />
                    ))
                    : <p className="text-sm text-gray-500">No candidate causes were returned.</p>}
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
            <MetricBar label="CPU Usage" value={metrics.cpuUsagePercent} max={100} unit="%" color="bg-blue-500" provenance={metrics.provenance.cpuUsagePercent} />
            <MetricBar label="RAM Usage" value={metrics.ramUsagePercent} max={100} unit="%" color="bg-purple-500" provenance={metrics.provenance.ramUsagePercent} />
            <MetricBar label="Disk Usage" value={metrics.diskUsagePercent} max={100} unit="%" color="bg-orange-500" provenance={metrics.provenance.diskUsagePercent} />
            <MetricBar label="Temperature" value={metrics.temperatureCelsius} max={100} unit="C" color={metrics.temperatureCelsius > 70 ? 'bg-red-500' : 'bg-green-500'} provenance={metrics.provenance.temperatureCelsius} />
            <MetricBar label="Processes" value={metrics.processCount} max={500} unit="" color="bg-cyan-500" provenance={metrics.provenance.processCount} />
            <MetricBar label="Disk I/O Latency" value={metrics.diskIOLatencyMs} max={100} unit="ms" color="bg-yellow-500" provenance={metrics.provenance.diskIOLatencyMs} />
            <MetricBar label="Network Latency" value={metrics.networkLatencyMs} max={500} unit="ms" color={metrics.networkLatencyMs > 100 ? 'bg-red-500' : 'bg-green-500'} provenance={metrics.provenance.networkLatencyMs} />
            <MetricBar label="System Errors" value={metrics.errorCount} max={50} unit="" color={metrics.errorCount > 10 ? 'bg-red-500' : 'bg-gray-500'} provenance={metrics.provenance.errorCount} />
            <MetricBar label="Uptime" value={Math.round(metrics.uptimeHours)} max={720} unit="h" color="bg-indigo-500" provenance={metrics.provenance.uptimeHours} />
            <MetricBar label="Fan Speed" value={metrics.fanRPM} max={4000} unit=" RPM" color="bg-teal-500" provenance={metrics.provenance.fanRPM} />
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
            <p>1. <span className="text-white">Collects system evidence and metrics</span> — including chip, firmware, SMART, and WHEA telemetry where Windows exposes it</p>
            <p>2. <span className="text-white">Uses the configured provider priority</span> — Cloudflare or custom AI with consent, then offline ONNX and rules fallback</p>
            <p>3. <span className="text-white">Labels input provenance</span> — measured readings are separated from estimates and unavailable sensors</p>
            <p>4. <span className="text-white">Provides actionable recommendations</span> — without inventing unavailable measurements</p>
          </div>
          <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <p className="text-xs text-purple-300">
              Remote analysis is opt-in. If it is unavailable, ByteFix falls back to local ONNX/rules diagnosis and explains why.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
