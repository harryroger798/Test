import { useState } from 'react'
import { Printer, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function PrinterFixerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.printerDiagnose()) }
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
          <Printer className="w-6 h-6 text-orange-400" /> Printer Fixer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Spooler restart, queue cleanup, WSD to TCP/IP conversion, printer discovery</p>
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
        <h3 className="font-medium text-white mb-3">Printer Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Checks print spooler service, installed printers, stuck jobs, and WSD ports.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Printer Diagnostics
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
          <h3 className="font-medium text-white mb-2">Restart Print Spooler</h3>
          <p className="text-sm text-gray-400 mb-3">Restarts the Windows Print Spooler service to fix stuck print jobs.</p>
          <button onClick={() => runFix('spooler', () => window.bytefix.restartSpooler())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'spooler' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Restart Spooler
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Clear Print Queue</h3>
          <p className="text-sm text-gray-400 mb-3">Nuclear flush of all stuck print jobs from all printers.</p>
          <button onClick={() => runFix('queue', () => window.bytefix.clearPrintQueue())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'queue' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Clear Queue
          </button>
        </div>
        <div className="card col-span-full">
          <h3 className="font-medium text-white mb-2">Enable Printer Discovery</h3>
          <p className="text-sm text-gray-400 mb-3">Enables Function Discovery and SSDP services for network printer detection.</p>
          <button onClick={() => runFix('discover', () => window.bytefix.enablePrinterDiscovery())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'discover' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Enable Discovery
          </button>
        </div>
      </div>
    </div>
  )
}
