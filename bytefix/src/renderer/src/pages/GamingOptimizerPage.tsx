import { useState } from 'react'
import { Gamepad2, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function GamingOptimizerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.gamingDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'gaming', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <Gamepad2 className="w-6 h-6 text-green-400" /> Gaming Optimizer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Game Mode, GPU priority, RAM cleanup, FPS optimization, DirectX repair</p>
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
        <h3 className="font-medium text-white mb-3">Gaming Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Checks Game Mode, GPU info, RAM availability, power plan, and DirectX version.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Gaming Diagnostics
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Enable Game Mode</h3>
          <p className="text-sm text-gray-400 mb-3">Enables Windows Game Mode for better gaming performance.</p>
          <button onClick={() => runFix('gamemode', () => window.bytefix.enableGameMode())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'gamemode' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />}
            Enable Game Mode
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">High Performance Plan</h3>
          <p className="text-sm text-gray-400 mb-3">Sets Ultimate Performance or High Performance power plan.</p>
          <button onClick={() => runFix('power', () => window.bytefix.setHighPerformance())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'power' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />}
            Set High Performance
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Cleanup RAM</h3>
          <p className="text-sm text-gray-400 mb-3">Kills background apps (Teams, Discord, Spotify, Steam, etc.) to free RAM for gaming.</p>
          <button onClick={() => runFix('ram', () => window.bytefix.cleanupRamForGaming())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'ram' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />}
            Cleanup RAM
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Repair DirectX</h3>
          <p className="text-sm text-gray-400 mb-3">Re-registers DirectX DLLs and runs system file checker.</p>
          <button onClick={() => runFix('directx', () => window.bytefix.repairDirectX())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'directx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />}
            Repair DirectX
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Optimize GPU</h3>
          <p className="text-sm text-gray-400 mb-3">Enables hardware GPU scheduling, disables fullscreen optimizations and Game DVR.</p>
          <button onClick={() => runFix('gpu', () => window.bytefix.optimizeGpu())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'gpu' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />}
            Optimize GPU
          </button>
        </div>
      </div>
    </div>
  )
}
