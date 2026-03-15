import { useState } from 'react'
import { Radio, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function RemoteAccessPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.remoteDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'remote-access', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <Radio className="w-6 h-6 text-teal-400" /> Remote Access
        </h1>
        <p className="text-gray-400 text-sm mt-1">RDP configuration, SSH, remote assistance, Wake-on-LAN</p>
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
        <h3 className="font-medium text-white mb-3">Remote Access Status</h3>
        <p className="text-sm text-gray-400 mb-4">Check RDP, SSH, remote assistance, and remote tools availability.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Check Remote Access
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
          <h3 className="font-medium text-white mb-2">Enable Remote Desktop</h3>
          <p className="text-sm text-gray-400 mb-3">Enable RDP with NLA, configure firewall rules.</p>
          <button
            onClick={() => runFix('enableRdp', () => window.bytefix.enableRemoteDesktop())}
            disabled={!!loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'enableRdp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            Enable RDP
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Disable Remote Desktop</h3>
          <p className="text-sm text-gray-400 mb-3">Disable RDP for security when not needed.</p>
          <button
            onClick={() => runFix('disableRdp', () => window.bytefix.disableRemoteDesktop())}
            disabled={!!loading}
            className="btn-secondary flex items-center gap-2"
          >
            {loading === 'disableRdp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            Disable RDP
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Remote Assistance</h3>
          <p className="text-sm text-gray-400 mb-3">Enable Remote Assistance and get Quick Assist guidance.</p>
          <button
            onClick={() => runFix('invite', () => window.bytefix.generateRemoteInvite())}
            disabled={!!loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            Setup Remote Assistance
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Wake-on-LAN</h3>
          <p className="text-sm text-gray-400 mb-3">Configure network adapter for Wake-on-LAN support.</p>
          <button
            onClick={() => runFix('wol', () => window.bytefix.configureWakeOnLan())}
            disabled={!!loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'wol' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            Configure WoL
          </button>
        </div>
      </div>
    </div>
  )
}
