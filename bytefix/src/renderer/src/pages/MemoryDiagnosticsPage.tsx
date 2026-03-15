import { useState } from 'react'
import { MemoryStick, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function MemoryDiagnosticsPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)
  const [testSizeMB, setTestSizeMB] = useState(128)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.memDiagDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'memory', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <MemoryStick className="w-6 h-6 text-green-400" /> Memory Diagnostics
        </h1>
        <p className="text-gray-400 text-sm mt-1">RAM health testing, pattern tests, memory error detection</p>
      </div>

      {result && (
        <div className={`card ${result.success ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          <div className="flex items-center gap-3">
            {result.success ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
            <div>
              <p className="text-sm font-medium text-white">{result.description}</p>
              {result.details.map((d, i) => <p key={i} className="text-xs text-gray-400">{d}</p>)}
            </div>
            <button onClick={() => setResult(null)} className="ml-auto text-gray-400 text-xs">Dismiss</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-medium text-white mb-3">Memory Overview</h3>
        <p className="text-sm text-gray-400 mb-4">Check installed RAM, memory layout, swap usage, and previous test results.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Memory Diagnostics
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="space-y-3">
          {diagnostics.map((d) => (
            <div key={d.id} className="card">
              <p className={`text-sm font-medium ${severityColor(d.severity)}`}>{d.title}</p>
              <p className="text-xs text-gray-400 mt-1">{d.description}</p>
              {d.details.map((det, i) => <p key={i} className="text-xs text-gray-500 mt-0.5">{det}</p>)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Built-in Pattern Test</h3>
          <p className="text-sm text-gray-400 mb-3">Run 6 memory pattern tests (Walking Ones/Zeros, 0xFF, 0x00, Checkerboard, Random).</p>
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm text-gray-400">Test size:</label>
            <select
              value={testSizeMB}
              onChange={(e) => setTestSizeMB(Number(e.target.value))}
              className="bg-surface-lighter border border-gray-600 rounded px-2 py-1 text-sm text-white"
            >
              <option value={32}>32 MB (Quick)</option>
              <option value={64}>64 MB</option>
              <option value={128}>128 MB (Default)</option>
              <option value={256}>256 MB</option>
              <option value={512}>512 MB (Thorough)</option>
            </select>
          </div>
          <button
            onClick={() => runFix('pattern', () => window.bytefix.runMemPatternTest(testSizeMB))}
            disabled={!!loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'pattern' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MemoryStick className="w-4 h-4" />}
            Run Pattern Test
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Windows Memory Diagnostic</h3>
          <p className="text-sm text-gray-400 mb-3">Schedule Windows Memory Diagnostic tool (requires reboot to run full hardware test).</p>
          <button
            onClick={() => runFix('winmem', () => window.bytefix.scheduleWinMemTest())}
            disabled={!!loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'winmem' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MemoryStick className="w-4 h-4" />}
            Schedule Windows Mem Test
          </button>
        </div>
      </div>
    </div>
  )
}
