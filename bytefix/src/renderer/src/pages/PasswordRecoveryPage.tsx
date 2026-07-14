import { useState } from 'react'
import { KeyRound, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function PasswordRecoveryPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try {
      const res = await window.bytefix.passwordDiagnose()
      setDiagnostics(res)
    } catch (err) { console.error(err) }
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
          <KeyRound className="w-6 h-6 text-amber-400" /> Password Recovery
        </h1>
        <p className="text-gray-400 text-sm mt-1">Windows account recovery, BitLocker guidance, macOS recovery, BIOS password help</p>
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
        <h3 className="font-medium text-white mb-3">Scan Password Recovery Options</h3>
        <p className="text-sm text-gray-400 mb-4">Detects account types, BitLocker status, saved credentials, and available recovery methods.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Scan Recovery Options
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="space-y-3">
          {diagnostics.map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${severityColor(d.severity)}`}>{d.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{d.description}</p>
                  {d.details.map((det, i) => <p key={i} className="text-xs text-gray-500 mt-0.5">• {det}</p>)}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${severityColor(d.severity)} bg-gray-800`}>{d.severity}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Enable Admin Account</h3>
          <p className="text-sm text-gray-400 mb-3">Enables the built-in Windows Administrator account for password bypass.</p>
          <button onClick={() => { if (window.confirm('Enable the built-in Administrator account? This changes account security.')) runFix('admin', () => window.bytefix.enableAdmin(true)) }} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'admin' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Enable Administrator
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Disable Admin Account</h3>
          <p className="text-sm text-gray-400 mb-3">Disables the built-in Administrator account after recovery is complete.</p>
          <button onClick={() => { if (window.confirm('Disable the built-in Administrator account?')) runFix('disableAdmin', () => window.bytefix.disableAdmin(true)) }} disabled={!!loading} className="btn-primary flex items-center gap-2 opacity-80">
            {loading === 'disableAdmin' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Disable Administrator
          </button>
        </div>
      </div>
    </div>
  )
}
