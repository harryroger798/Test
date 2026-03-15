import { useState } from 'react'
import { Thermometer, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function OverheatingPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.thermalDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'thermal', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
    }
    finally { setLoading('') }
  }

  function severityColor(s: string): string {
    if (s === 'healthy') return 'text-emerald-400'
    if (s === 'info') return 'text-blue-400'
    if (s === 'warning') return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Thermometer className="w-6 h-6 text-orange-400" /> Overheating Analyzer
        </h1>
        <p className="text-gray-400 text-sm mt-1">CPU/GPU temperature monitoring, thermal throttle detection, fan speed, cooling optimization</p>
      </div>

      {result && (
        <div className={`card ${result.success ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          <div className="flex items-center gap-3">
            {result.success ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
            <div>
              <p className="text-sm font-medium text-white">{result.description}</p>
              {result.details.map((d, i) => <p key={i} className="text-xs text-gray-400">• {d}</p>)}
            </div>
            <button onClick={() => setResult(null)} className="ml-auto text-gray-400 text-xs">Dismiss</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-medium text-white mb-3">Thermal Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Reads CPU/GPU/disk temperatures, detects thermal throttling, checks fan speeds, and identifies overheating causes.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Thermal Diagnostics
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="space-y-3">
          {diagnostics.map((d) => (
            <div key={d.id} className="card">
              <p className={`text-sm font-medium ${severityColor(d.severity)}`}>{d.title}</p>
              <p className="text-xs text-gray-400 mt-1">{d.description}</p>
              {d.details.map((det, i) => <p key={i} className="text-xs text-gray-500 mt-0.5">• {det}</p>)}
              {d.fixAvailable && d.fixDescription && (
                <p className="text-xs text-bytefix-400 mt-2">Fix: {d.fixDescription}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Optimize Cooling</h3>
          <p className="text-sm text-gray-400 mb-3">Applies power plan optimizations for lower temperatures and better thermal management.</p>
          <button onClick={() => runFix('cool', () => window.bytefix.optimizeCooling())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'cool' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />}
            Optimize Cooling
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Kill High CPU Processes</h3>
          <p className="text-sm text-gray-400 mb-3">Terminates processes using excessive CPU that contribute to overheating.</p>
          <button onClick={() => runFix('kill', () => window.bytefix.killHighCpu())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'kill' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />}
            Kill High CPU Processes
          </button>
        </div>
      </div>
    </div>
  )
}
