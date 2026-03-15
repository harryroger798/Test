import { useState } from 'react'
import { Wrench, Loader2, CheckCircle, AlertTriangle, FileCheck, Database, RefreshCw, ClipboardList } from 'lucide-react'
import type { FixResult } from '../../../../shared/types'

interface RepairAction {
  id: string
  title: string
  description: string
  icon: typeof Wrench
  risk: 'low' | 'medium' | 'high'
  duration: string
  handler: () => Promise<FixResult>
}

export function OSRepairPage(): JSX.Element {
  const [loading, setLoading] = useState('')
  const [results, setResults] = useState<Array<{ action: string; result: FixResult }>>([])

  async function runAction(action: RepairAction): Promise<void> {
    setLoading(action.id)
    try {
      const result = await action.handler()
      setResults(prev => [{ action: action.title, result }, ...prev])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading('')
    }
  }

  const actions: RepairAction[] = [
    {
      id: 'sfc', title: 'System File Checker (SFC)', icon: FileCheck,
      description: 'Scans and repairs corrupted Windows system files. Uses the built-in sfc /scannow command. On macOS, runs disk verification. On Linux, checks kernel logs for filesystem errors.',
      risk: 'low', duration: '5-15 minutes',
      handler: () => window.bytefix.runSfc()
    },
    {
      id: 'dism', title: 'DISM Repair', icon: Database,
      description: 'Repairs the Windows component store using DISM (Deployment Image Servicing). Fixes corrupted Windows Update, service pack, and feature installations. Windows only.',
      risk: 'low', duration: '10-30 minutes',
      handler: () => window.bytefix.runDism()
    },
    {
      id: 'windows-update', title: 'Windows Update Repair', icon: RefreshCw,
      description: 'Full Windows Update repair: stops update services, renames SoftwareDistribution and catroot2 folders, re-registers 35+ DLLs, resets Winsock, and restarts services. On macOS/Linux, checks package manager.',
      risk: 'medium', duration: '3-10 minutes',
      handler: () => window.bytefix.repairWindowsUpdate()
    },
    {
      id: 'registry', title: 'Registry Cleanup', icon: ClipboardList,
      description: 'Cleans invalid file associations, MUI cache, thumbnail cache, and rebuilds icon cache. Windows only. Safe operation - only removes orphaned entries.',
      risk: 'low', duration: '1-3 minutes',
      handler: () => window.bytefix.cleanRegistry()
    }
  ]

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wrench className="w-6 h-6 text-purple-400" /> OS Repair
        </h1>
        <p className="text-gray-400 text-sm mt-1">Fix Windows system files, component store, updates, and registry issues</p>
      </div>

      {/* Warning */}
      <div className="card border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Administrator privileges required</p>
            <p className="text-xs text-gray-400 mt-1">
              Most repair operations require running ByteFix as Administrator (Windows) or with sudo (macOS/Linux).
              Some operations may require a system restart to complete.
            </p>
          </div>
        </div>
      </div>

      {/* Repair Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon
          const isRunning = loading === action.id
          return (
            <div key={action.id} className="card-hover">
              <div className="flex items-center gap-3 mb-3">
                <Icon className="w-5 h-5 text-purple-400" />
                <h3 className="font-medium text-white">{action.title}</h3>
                <span className={`ml-auto badge ${
                  action.risk === 'low' ? 'badge-healthy' :
                  action.risk === 'medium' ? 'badge-warning' : 'badge-critical'
                }`}>
                  {action.risk} risk
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-2">{action.description}</p>
              <p className="text-xs text-gray-500 mb-4">Estimated duration: {action.duration}</p>
              <button
                onClick={() => runAction(action)}
                disabled={!!loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                {isRunning ? 'Running...' : 'Run Repair'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Results History */}
      {results.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Repair Results</h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`card ${r.result.success ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                <div className="flex items-center gap-3">
                  {r.result.success
                    ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    : <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{r.action}</p>
                    <p className="text-xs text-gray-400">{r.result.description}</p>
                    {r.result.details.length > 0 && (
                      <ul className="text-xs text-gray-500 mt-1">
                        {r.result.details.slice(0, 5).map((d, j) => <li key={j}>• {d}</li>)}
                      </ul>
                    )}
                    {r.result.error && <p className="text-xs text-red-400 mt-1">{r.result.error}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
