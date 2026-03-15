import { useState } from 'react'
import { MonitorSpeaker, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function DisplayFixerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.displayDiagnose()) }
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
          <MonitorSpeaker className="w-6 h-6 text-pink-400" /> Display / Graphics Fixer
        </h1>
        <p className="text-gray-400 text-sm mt-1">GPU info, TDR timeout fix, hardware acceleration, external monitor detection</p>
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
        <h3 className="font-medium text-white mb-3">Display Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Checks GPU info, TDR crash events, display devices, and connected monitors.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Display Diagnostics
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="space-y-3">
          {diagnostics.map((d) => (
            <div key={d.id} className="card">
              <p className={`text-sm font-medium ${severityColor(d.severity)}`}>{d.title}</p>
              <p className="text-xs text-gray-400 mt-1">{d.description}</p>
              {d.details.map((det, i) => <p key={i} className="text-xs text-gray-500 mt-0.5">• {det}</p>)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Reinstall Display Drivers</h3>
          <p className="text-sm text-gray-400 mb-3">Removes and rescans display adapter drivers from OS driver store.</p>
          <button onClick={() => runFix('drivers', () => window.bytefix.reinstallDisplayDrivers())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'drivers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorSpeaker className="w-4 h-4" />}
            Reinstall Drivers
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Fix TDR Timeout</h3>
          <p className="text-sm text-gray-400 mb-3">Increases display driver timeout to prevent crashes during heavy GPU usage.</p>
          <button onClick={() => runFix('tdr', () => window.bytefix.fixTdr())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'tdr' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorSpeaker className="w-4 h-4" />}
            Fix TDR Timeout
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Disable Hardware Acceleration</h3>
          <p className="text-sm text-gray-400 mb-3">Disables WPF hardware acceleration and window animations to fix display glitches.</p>
          <button onClick={() => runFix('hwaccel', () => window.bytefix.disableHwAccel())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'hwaccel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorSpeaker className="w-4 h-4" />}
            Disable HW Accel
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Detect External Monitors</h3>
          <p className="text-sm text-gray-400 mb-3">Forces detection of external monitors and display adapters.</p>
          <button onClick={() => runFix('monitors', () => window.bytefix.detectMonitors())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'monitors' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorSpeaker className="w-4 h-4" />}
            Detect Monitors
          </button>
        </div>
      </div>
    </div>
  )
}
