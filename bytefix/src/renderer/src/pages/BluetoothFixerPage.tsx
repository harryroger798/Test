import { useState } from 'react'
import { Bluetooth, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function BluetoothFixerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.bluetoothDiagnose()) }
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
          <Bluetooth className="w-6 h-6 text-blue-400" /> Bluetooth Fixer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Service restart, cache clear, driver reinstall, Bluetooth audio quality fix</p>
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
        <h3 className="font-medium text-white mb-3">Bluetooth Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Checks Bluetooth service, adapter, paired devices, flight mode, and audio profiles.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Bluetooth Diagnostics
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
          <h3 className="font-medium text-white mb-2">Restart Bluetooth Service</h3>
          <p className="text-sm text-gray-400 mb-3">Restarts the Bluetooth support service and re-initializes adapters.</p>
          <button onClick={() => runFix('restart', () => window.bytefix.restartBluetoothService())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'restart' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
            Restart Service
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Clear Bluetooth Cache</h3>
          <p className="text-sm text-gray-400 mb-3">Clears paired device cache. All devices will need to be re-paired.</p>
          <button onClick={() => runFix('cache', () => window.bytefix.clearBluetoothCache())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'cache' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
            Clear Cache
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Reinstall Bluetooth Drivers</h3>
          <p className="text-sm text-gray-400 mb-3">Removes and rescans Bluetooth adapter drivers.</p>
          <button onClick={() => runFix('drivers', () => window.bytefix.reinstallBluetoothDrivers())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'drivers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
            Reinstall Drivers
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Fix Bluetooth Audio</h3>
          <p className="text-sm text-gray-400 mb-3">Disables Hands-Free profile and Absolute Volume for better audio quality.</p>
          <button onClick={() => runFix('audio', () => window.bytefix.fixBluetoothAudio())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'audio' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
            Fix BT Audio
          </button>
        </div>
      </div>
    </div>
  )
}
