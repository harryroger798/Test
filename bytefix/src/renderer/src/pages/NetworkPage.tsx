import { useState } from 'react'
import { Wifi, Loader2, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import type { NetworkDiagnostic, FixResult } from '../../../../shared/types'

export function NetworkPage(): JSX.Element {
  const [diag, setDiag] = useState<NetworkDiagnostic | null>(null)
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function diagnose(): Promise<void> {
    setLoading('diagnose')
    try {
      const d = await window.bytefix.diagnoseNetwork()
      setDiag(d)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function fix(action: string): Promise<void> {
    setLoading(action)
    try {
      let res: FixResult
      switch (action) {
        case 'flush-dns': res = await window.bytefix.flushDns(); break
        case 'reset-winsock': res = await window.bytefix.resetWinsock(); break
        case 'reset-tcpip': res = await window.bytefix.resetTcpIp(); break
        default: return
      }
      setResult(res)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wifi className="w-6 h-6 text-green-400" /> Network Diagnostics
          </h1>
          <p className="text-gray-400 text-sm mt-1">Diagnose and fix internet connectivity, DNS, and network issues</p>
        </div>
        <button onClick={diagnose} disabled={!!loading} className="btn-primary flex items-center gap-2 text-sm">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Diagnostics
        </button>
      </div>

      {/* Fix Result */}
      {result && (
        <div className={`card ${result.success ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          <div className="flex items-center gap-3">
            {result.success ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <div>
              <p className="text-sm font-medium text-white">{result.description}</p>
              {result.details.map((d, i) => <p key={i} className="text-xs text-gray-400">• {d}</p>)}
            </div>
            <button onClick={() => setResult(null)} className="ml-auto text-gray-400 text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {/* Diagnostics Results */}
      {diag && (
        <div className="space-y-4">
          {/* Connection Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard
              title="Internet"
              status={diag.internetConnected}
              details={diag.publicIp ? `Public IP: ${diag.publicIp}` : 'No public IP'}
            />
            <StatusCard
              title="DNS Resolution"
              status={diag.dnsWorking}
              details={`Server: ${diag.dnsServer || 'Unknown'}`}
            />
            <StatusCard
              title="Gateway"
              status={diag.gatewayReachable}
              details={`${diag.gateway || 'Not configured'} (${diag.latency}ms)`}
            />
          </div>

          {/* Issues */}
          {diag.issues.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Issues Detected</h3>
              <div className="space-y-2">
                {diag.issues.map((issue, i) => (
                  <div key={i} className="card flex items-center gap-4">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                      issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm text-white">{issue.description}</p>
                      {issue.fixDescription && <p className="text-xs text-gray-400 mt-1">Fix: {issue.fixDescription}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Fixes */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Network Fixes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card">
                <h4 className="font-medium text-white mb-2">Flush DNS Cache</h4>
                <p className="text-xs text-gray-400 mb-3">Clears DNS resolver cache and sets Google DNS as fallback</p>
                <button onClick={() => fix('flush-dns')} disabled={!!loading} className="btn-primary text-sm w-full">
                  {loading === 'flush-dns' ? 'Flushing...' : 'Flush DNS'}
                </button>
              </div>
              <div className="card">
                <h4 className="font-medium text-white mb-2">Reset Winsock</h4>
                <p className="text-xs text-gray-400 mb-3">Resets the Windows socket catalog (requires restart)</p>
                <button onClick={() => fix('reset-winsock')} disabled={!!loading} className="btn-primary text-sm w-full">
                  {loading === 'reset-winsock' ? 'Resetting...' : 'Reset Winsock'}
                </button>
              </div>
              <div className="card">
                <h4 className="font-medium text-white mb-2">Reset TCP/IP Stack</h4>
                <p className="text-xs text-gray-400 mb-3">Resets TCP/IP protocol stack to defaults (requires restart)</p>
                <button onClick={() => fix('reset-tcpip')} disabled={!!loading} className="btn-primary text-sm w-full">
                  {loading === 'reset-tcpip' ? 'Resetting...' : 'Reset TCP/IP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!diag && !loading && (
        <div className="card flex flex-col items-center justify-center py-12">
          <Wifi className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-400">Click "Run Diagnostics" to check your network</p>
        </div>
      )}
    </div>
  )
}

function StatusCard({ title, status, details }: { title: string; status: boolean; details: string }): JSX.Element {
  return (
    <div className={`card ${status ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
      <div className="flex items-center gap-2 mb-2">
        {status ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      <p className={`text-sm ${status ? 'text-emerald-400' : 'text-red-400'}`}>
        {status ? 'Connected' : 'Not Available'}
      </p>
      <p className="text-xs text-gray-400 mt-1">{details}</p>
    </div>
  )
}
