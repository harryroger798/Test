import { useState } from 'react'
import { Globe, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function IndiaAppsPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.indiaDiagnose()) }
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
          <Globe className="w-6 h-6 text-indigo-400" /> India Apps
        </h1>
        <p className="text-gray-400 text-sm mt-1">Office repair, Outlook PST, Tally ERP, Java banking, Chrome, GST Portal, Aadhaar</p>
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
        <h3 className="font-medium text-white mb-3">India Apps Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Checks Office, Outlook PST, Tally, Java, Chrome, GST Portal readiness, and Aadhaar enrollment.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run India Apps Scan
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
                <span className={`text-xs px-2 py-0.5 rounded ${severityColor(d.severity)} bg-gray-800`}>{d.category}</span>
              </div>
              {d.fixAvailable && d.fixDescription && (
                <p className="text-xs text-bytefix-400 mt-2">Fix: {d.fixDescription}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Repair Office</h3>
          <p className="text-sm text-gray-400 mb-3">Runs Microsoft Office Quick Repair for Click-to-Run installations.</p>
          <button onClick={() => runFix('office', () => window.bytefix.repairOffice())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'office' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Repair Office
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Repair Outlook PST</h3>
          <p className="text-sm text-gray-400 mb-3">Locates and generates repair commands for Outlook data files.</p>
          <button onClick={() => runFix('pst', () => window.bytefix.repairPst())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'pst' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Repair PST
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Fix Java Banking</h3>
          <p className="text-sm text-gray-400 mb-3">Configures Java security for SBI, HDFC, PNB, GST portal compatibility.</p>
          <button onClick={() => runFix('java', () => window.bytefix.fixJavaBanking())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'java' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Fix Java Banking
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Clean Chrome</h3>
          <p className="text-sm text-gray-400 mb-3">Clears Chrome cache, code cache, GPU cache, and service workers.</p>
          <button onClick={() => runFix('chrome', () => window.bytefix.cleanChrome())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'chrome' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Clean Chrome
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Enable .NET 3.5</h3>
          <p className="text-sm text-gray-400 mb-3">Enables .NET Framework 3.5 required by many Indian government apps.</p>
          <button onClick={() => runFix('dotnet', () => window.bytefix.enableDotNet35())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'dotnet' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Enable .NET 3.5
          </button>
        </div>
      </div>
    </div>
  )
}
