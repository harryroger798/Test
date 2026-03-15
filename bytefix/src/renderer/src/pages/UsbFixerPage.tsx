import { useState } from 'react'
import { Usb, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function UsbFixerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.usbDiagnose()) }
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
          <Usb className="w-6 h-6 text-green-400" /> USB / Peripheral Fixer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Selective suspend disable, port reset, driver reinstall, RAW drive repair</p>
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
        <h3 className="font-medium text-white mb-3">USB Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Scans USB devices, checks selective suspend, detects RAW drives, and reads controller errors.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run USB Diagnostics
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
          <h3 className="font-medium text-white mb-2">Disable Selective Suspend</h3>
          <p className="text-sm text-gray-400 mb-3">Prevents USB devices from being powered down, fixing random disconnections.</p>
          <button onClick={() => runFix('suspend', () => window.bytefix.disableSelectiveSuspend())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'suspend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}
            Disable Suspend
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Reinstall USB Drivers</h3>
          <p className="text-sm text-gray-400 mb-3">Removes error USB device drivers and rescans for hardware.</p>
          <button onClick={() => runFix('drivers', () => window.bytefix.reinstallUsbDrivers())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'drivers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}
            Reinstall Drivers
          </button>
        </div>
        <div className="card col-span-full">
          <h3 className="font-medium text-white mb-2">Disable USB Power Management</h3>
          <p className="text-sm text-gray-400 mb-3">Prevents Windows from turning off USB hubs to save power.</p>
          <button onClick={() => runFix('power', () => window.bytefix.disableUsbPowerMgmt())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'power' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}
            Disable Power Mgmt
          </button>
        </div>
      </div>
    </div>
  )
}
