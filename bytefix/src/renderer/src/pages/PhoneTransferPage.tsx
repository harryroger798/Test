import { useState } from 'react'
import { Smartphone, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function PhoneTransferPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)
  const [srcPath, setSrcPath] = useState('')
  const [destPath, setDestPath] = useState('')

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.phoneDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'phone-transfer', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <Smartphone className="w-6 h-6 text-teal-400" /> Phone Data Transfer
        </h1>
        <p className="text-gray-400 text-sm mt-1">ADB detection, USB phone detection, Android/iOS transfer guides, file transfer</p>
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
        <h3 className="font-medium text-white mb-3">Phone Transfer Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Detects ADB installation, USB-connected phones, MTP/PTP devices, and provides transfer guides.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Phone Diagnostics
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
          <h3 className="font-medium text-white mb-2">USB Debugging Guide</h3>
          <p className="text-sm text-gray-400 mb-3">Step-by-step guide for enabling USB debugging on Android devices (Samsung, Xiaomi, OnePlus, etc.).</p>
          <button onClick={() => runFix('debug', () => window.bytefix.guideUsbDebugging())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'debug' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            USB Debugging Guide
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Pull Files via ADB</h3>
          <p className="text-sm text-gray-400 mb-3">Transfer files from a connected Android device to this computer using ADB.</p>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={srcPath}
              onChange={(e) => setSrcPath(e.target.value)}
              placeholder="Phone path (e.g. /sdcard/DCIM)"
              className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
            />
            <input
              type="text"
              value={destPath}
              onChange={(e) => setDestPath(e.target.value)}
              placeholder="Destination (e.g. C:\\PhoneBackup)"
              className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
            />
          </div>
          <button onClick={() => runFix('pull', () => window.bytefix.pullPhoneFiles(srcPath, destPath))} disabled={!!loading || !srcPath || !destPath} className="btn-primary flex items-center gap-2">
            {loading === 'pull' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
            Pull Files
          </button>
        </div>
      </div>
    </div>
  )
}
