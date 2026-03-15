import { useState } from 'react'
import { Camera, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function WebcamFixerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.webcamDiagnose()) }
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
          <Camera className="w-6 h-6 text-teal-400" /> Webcam / Camera Fixer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Driver reinstall, privacy toggle, app permission repair, power cycle</p>
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
        <h3 className="font-medium text-white mb-3">Webcam Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Detects camera devices, checks privacy settings, and identifies conflicting apps.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Webcam Diagnostics
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
          <h3 className="font-medium text-white mb-2">Enable Camera Privacy</h3>
          <p className="text-sm text-gray-400 mb-3">Enables camera access in Windows privacy settings for apps.</p>
          <button onClick={() => runFix('privacy', () => window.bytefix.enableCameraPrivacy())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'privacy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Enable Camera Access
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Reinstall Camera Drivers</h3>
          <p className="text-sm text-gray-400 mb-3">Removes and rescans camera/imaging device drivers.</p>
          <button onClick={() => runFix('drivers', () => window.bytefix.reinstallCameraDrivers())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'drivers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Reinstall Drivers
          </button>
        </div>
        <div className="card col-span-full">
          <h3 className="font-medium text-white mb-2">Power Cycle Camera</h3>
          <p className="text-sm text-gray-400 mb-3">Disables and re-enables the camera device to fix black screen or frozen camera issues.</p>
          <button onClick={() => runFix('cycle', () => window.bytefix.powerCycleCamera())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'cycle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Power Cycle Camera
          </button>
        </div>
      </div>
    </div>
  )
}
