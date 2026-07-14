import { useState } from 'react'
import { CircuitBoard, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function FirmwareBiosPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.firmwareDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'firmware', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <CircuitBoard className="w-6 h-6 text-orange-400" /> Firmware & BIOS
        </h1>
        <p className="text-gray-400 text-sm mt-1">BIOS version, firmware updates, driver management, Secure Boot & TPM status</p>
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
        <h3 className="font-medium text-white mb-3">Firmware Overview</h3>
        <p className="text-sm text-gray-400 mb-4">Check BIOS vendor, version, UEFI mode, Secure Boot, TPM status, and driver info.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Firmware Diagnostics
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="space-y-3">
          {diagnostics.map((d) => (
            <div key={d.id} className="card">
              <p className={`text-sm font-medium ${severityColor(d.severity)}`}>{d.title}</p>
              <p className="text-xs text-gray-400 mt-1">{d.description}</p>
              {d.details.map((det, i) => <p key={i} className="text-xs text-gray-500 mt-0.5">{det}</p>)}
              {d.fixAvailable && d.fixDescription && (
                <p className="text-xs text-bytefix-400 mt-2">Fix: {d.fixDescription}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Check Firmware Updates</h3>
          <p className="text-sm text-gray-400 mb-3">Scan for available BIOS/firmware updates via Windows Update or fwupd.</p>
          <button
            onClick={() => runFix('updates', () => window.bytefix.checkFirmwareUpdates())}
            disabled={!!loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'updates' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircuitBoard className="w-4 h-4" />}
            Check for Updates
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Update Drivers</h3>
          <p className="text-sm text-gray-400 mb-3">Attempt driver updates via pnputil (Windows) or fwupd (Linux).</p>
          <button
            onClick={() => { if (window.confirm('Driver updates can change installed system drivers and may require rollback. Continue?')) runFix('drivers', () => window.bytefix.updateDrivers(true)) }}
            disabled={!!loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'drivers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircuitBoard className="w-4 h-4" />}
            Update Drivers
          </button>
        </div>
      </div>
    </div>
  )
}
