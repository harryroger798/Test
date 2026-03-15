import { useState } from 'react'
import { Volume2, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function AudioFixerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.audioDiagnose()) }
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
          <Volume2 className="w-6 h-6 text-violet-400" /> Audio / Sound Fixer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Service restart, driver reinstall, microphone privacy, audio enhancement control</p>
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
        <h3 className="font-medium text-white mb-3">Audio Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Checks audio services, devices, drivers, microphone privacy, and enhancement settings.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Audio Diagnostics
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
          <h3 className="font-medium text-white mb-2">Restart Audio Services</h3>
          <p className="text-sm text-gray-400 mb-3">Restarts Windows Audio, AudioEndpointBuilder, and related services.</p>
          <button onClick={() => runFix('restart', () => window.bytefix.restartAudioServices())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'restart' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            Restart Audio Services
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Reinstall Audio Drivers</h3>
          <p className="text-sm text-gray-400 mb-3">Removes and rescans audio device drivers from the OS driver store.</p>
          <button onClick={() => runFix('drivers', () => window.bytefix.reinstallAudioDrivers())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'drivers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            Reinstall Drivers
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Enable Microphone Privacy</h3>
          <p className="text-sm text-gray-400 mb-3">Enables microphone access in Windows privacy settings for all apps.</p>
          <button onClick={() => runFix('mic', () => window.bytefix.enableMicPrivacy())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'mic' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            Enable Mic Access
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Disable Audio Enhancements</h3>
          <p className="text-sm text-gray-400 mb-3">Disables audio enhancements that can cause crackling, popping, or static.</p>
          <button onClick={() => runFix('enhance', () => window.bytefix.disableAudioEnhancements())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'enhance' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            Disable Enhancements
          </button>
        </div>
      </div>
    </div>
  )
}
