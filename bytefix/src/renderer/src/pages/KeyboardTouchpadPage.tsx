import { useState } from 'react'
import { Keyboard, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function KeyboardTouchpadPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.keyboardDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'keyboard', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <Keyboard className="w-6 h-6 text-amber-400" /> Keyboard / Touchpad Fixer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Filter keys fix, Fn key repair, touchpad toggle, driver reinstall</p>
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
        <h3 className="font-medium text-white mb-3">Keyboard / Touchpad Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Detects input devices, checks Filter Keys, Sticky Keys, touchpad status, and driver health.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Input Diagnostics
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
          <h3 className="font-medium text-white mb-2">Fix Filter Keys</h3>
          <p className="text-sm text-gray-400 mb-3">Disables Filter Keys, Sticky Keys, and Toggle Keys that cause slow or missed keystrokes.</p>
          <button onClick={() => runFix('filter', () => window.bytefix.fixFilterKeys())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'filter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Keyboard className="w-4 h-4" />}
            Fix Filter Keys
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Enable Touchpad</h3>
          <p className="text-sm text-gray-400 mb-3">Re-enables the touchpad if it was accidentally disabled.</p>
          <button onClick={() => runFix('touchpad-on', () => window.bytefix.toggleTouchpad(true))} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'touchpad-on' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Keyboard className="w-4 h-4" />}
            Enable Touchpad
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Disable Touchpad</h3>
          <p className="text-sm text-gray-400 mb-3">Disables touchpad (useful when using external mouse to prevent accidental taps).</p>
          <button onClick={() => { if (window.confirm('Disable touchpad? You will need an external mouse to navigate.')) runFix('touchpad-off', () => window.bytefix.toggleTouchpad(false)) }} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'touchpad-off' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Keyboard className="w-4 h-4" />}
            Disable Touchpad
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Reinstall Input Drivers</h3>
          <p className="text-sm text-gray-400 mb-3">Resets HID keyboard and touchpad drivers by disable/re-enable cycle.</p>
          <button onClick={() => runFix('drivers', () => window.bytefix.reinstallInputDrivers())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'drivers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Keyboard className="w-4 h-4" />}
            Reinstall Drivers
          </button>
        </div>
      </div>
    </div>
  )
}
