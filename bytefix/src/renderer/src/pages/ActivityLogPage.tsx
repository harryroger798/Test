import { useEffect, useState } from 'react'
import { Activity, CheckCircle, AlertTriangle, Ban, Clock, RefreshCw } from 'lucide-react'
import type { SafetyActionLogEntry } from '../../../../shared/types'

function phaseLabel(entry: SafetyActionLogEntry): string {
  return entry.phase.charAt(0).toUpperCase() + entry.phase.slice(1)
}

export function ActivityLogPage(): JSX.Element {
  const [entries, setEntries] = useState<SafetyActionLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setEntries(await window.bytefix.getRecentActivity(200))
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-bytefix-400" /> Activity Log
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Recent consent-gated remediation attempts and execution evidence.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="card text-sm text-gray-400">No gated remediation activity has been recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const blocked = entry.phase === 'blocked'
            const failed = entry.phase === 'failed' || entry.success === false
            return (
              <div key={`${entry.timestamp}-${entry.channel}-${index}`} className={`card border ${
                blocked || failed ? 'border-red-500/30' : 'border-gray-700/50'
              }`}>
                <div className="flex items-start gap-3">
                  {blocked
                    ? <Ban className="w-5 h-5 text-red-400 mt-0.5" />
                    : failed
                      ? <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      : <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{entry.channel}</span>
                      <span className="badge badge-info">{entry.risk} risk</span>
                      {entry.destructive && <span className="badge badge-critical">destructive</span>}
                      <span className="text-xs text-gray-400">{phaseLabel(entry)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" /> {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    {entry.exitCode !== undefined && (
                      <p className="text-xs text-gray-400 mt-2">Exit status: {entry.exitCode}</p>
                    )}
                    {entry.exitInfo && <p className="text-xs text-gray-400 mt-1">{entry.exitInfo}</p>}
                    {entry.commands && entry.commands.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Commands / steps</p>
                        {entry.commands.map((command) => <code key={command} className="block text-xs text-gray-400">{command}</code>)}
                      </div>
                    )}
                    {entry.outputTail && (
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-xs text-gray-500">
                        {entry.outputTail}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
