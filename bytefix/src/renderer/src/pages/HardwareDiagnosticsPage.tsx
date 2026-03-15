import { useState } from 'react'
import { Cpu, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function HardwareDiagnosticsPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)
  const [stressDuration, setStressDuration] = useState(30)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.hardwareDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) { console.error(err) }
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
          <Cpu className="w-6 h-6 text-cyan-400" /> Hardware Deep Diagnostics
        </h1>
        <p className="text-gray-400 text-sm mt-1">SMART analysis, memory diagnostics, CPU stress test, POST code guide, boot status</p>
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
        <h3 className="font-medium text-white mb-3">Hardware Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Deep SMART disk analysis, memory error detection, boot status, and POST code reference.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Hardware Diagnostics
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
          <h3 className="font-medium text-white mb-2">CPU Stress Test</h3>
          <p className="text-sm text-gray-400 mb-3">Safe stress test with thermal gating (auto-stops if CPU exceeds 95°C).</p>
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm text-gray-400">Duration:</label>
            <select
              value={stressDuration}
              onChange={(e) => setStressDuration(Number(e.target.value))}
              className="bg-surface-lighter border border-gray-600 rounded px-2 py-1 text-sm text-white"
            >
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
          <button onClick={() => runFix('stress', () => window.bytefix.cpuStressTest(stressDuration))} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'stress' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            Run Stress Test
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Memory Test Guide</h3>
          <p className="text-sm text-gray-400 mb-3">Instructions for running MemTest86, Windows Memory Diagnostic, or Linux memtester.</p>
          <button onClick={() => runFix('memtest', () => window.bytefix.guideMemTest())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'memtest' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            Memory Test Guide
          </button>
        </div>
      </div>
    </div>
  )
}
