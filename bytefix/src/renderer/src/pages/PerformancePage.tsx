import { useState } from 'react'
import { Zap, Trash2, MemoryStick, HardDrive, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatBytes } from '../lib/utils'
import type { StartupItem, CleanupItem, FixResult } from '../../../../shared/types'

export function PerformancePage(): JSX.Element {
  const [activeTab, setActiveTab] = useState('startup')
  const [startupItems, setStartupItems] = useState<StartupItem[]>([])
  const [cleanupItems, setCleanupItems] = useState<CleanupItem[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function loadStartup(): Promise<void> {
    setLoading('startup')
    try {
      const items = await window.bytefix.getStartupItems()
      setStartupItems(items)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function loadCleanup(): Promise<void> {
    setLoading('cleanup')
    try {
      const items = await window.bytefix.getCleanupItems()
      setCleanupItems(items)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function disableItem(item: StartupItem): Promise<void> {
    setLoading(`disable-${item.name}`)
    try {
      const res = await window.bytefix.disableStartupItem(item.name, item.path)
      setResult(res)
      if (res.success) {
        setStartupItems(prev => prev.map(i => i.name === item.name ? { ...i, enabled: false } : i))
      }
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runCleanup(): Promise<void> {
    setLoading('running-cleanup')
    try {
      const selected = cleanupItems.filter(i => i.selected)
      const res = await window.bytefix.runCleanup(selected)
      setResult(res)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function optimizeRam(): Promise<void> {
    setLoading('ram')
    try {
      const res = await window.bytefix.optimizeRam()
      setResult(res)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function optimizeDisk(): Promise<void> {
    setLoading('disk')
    try {
      const res = await window.bytefix.optimizeDisk('C:')
      setResult(res)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  const tabs = [
    { id: 'startup', label: 'Startup Items', icon: Zap },
    { id: 'cleanup', label: 'Disk Cleanup', icon: Trash2 },
    { id: 'ram', label: 'RAM Optimizer', icon: MemoryStick },
    { id: 'disk', label: 'Disk Optimizer', icon: HardDrive }
  ]

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" /> Performance Optimizer
        </h1>
        <p className="text-gray-400 text-sm mt-1">Speed up your system by cleaning startup, temp files, and optimizing resources</p>
      </div>

      {/* Result Banner */}
      {result && (
        <div className={`card flex items-center gap-3 ${result.success ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          {result.success ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
          <div>
            <p className="text-sm font-medium text-white">{result.description}</p>
            {result.details.length > 0 && (
              <ul className="text-xs text-gray-400 mt-1">
                {result.details.slice(0, 5).map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setResult(null)} className="ml-auto text-gray-400 hover:text-white text-xs">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-light rounded-lg p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-bytefix-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* Startup Tab */}
      {activeTab === 'startup' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">Manage programs that start with your computer</p>
            <button onClick={loadStartup} disabled={loading === 'startup'} className="btn-primary text-sm flex items-center gap-2">
              {loading === 'startup' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Scan Startup Items
            </button>
          </div>
          {startupItems.length > 0 && (
            <div className="space-y-2">
              {startupItems.map((item) => (
                <div key={item.name} className={`card flex items-center gap-4 ${item.isBloatware ? 'border-yellow-500/30' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      {item.isBloatware && <span className="badge badge-warning">Bloatware</span>}
                      {item.isSystem && <span className="badge badge-info">System</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{item.path}</p>
                  </div>
                  <span className={`badge ${item.impact === 'high' ? 'badge-critical' : item.impact === 'medium' ? 'badge-warning' : 'badge-info'}`}>
                    {item.impact} impact
                  </span>
                  {item.enabled && !item.isSystem && (
                    <button
                      onClick={() => disableItem(item)}
                      disabled={loading === `disable-${item.name}`}
                      className="btn-danger text-xs py-1 px-3"
                    >
                      {loading === `disable-${item.name}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disable'}
                    </button>
                  )}
                  {!item.enabled && <span className="text-xs text-gray-500">Disabled</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cleanup Tab */}
      {activeTab === 'cleanup' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">Remove temporary files, caches, and logs</p>
            <div className="flex gap-2">
              <button onClick={loadCleanup} disabled={!!loading} className="btn-secondary text-sm flex items-center gap-2">
                {loading === 'cleanup' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Scan
              </button>
              {cleanupItems.length > 0 && (
                <button onClick={runCleanup} disabled={!!loading} className="btn-primary text-sm flex items-center gap-2">
                  {loading === 'running-cleanup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Clean Selected
                </button>
              )}
            </div>
          </div>
          {cleanupItems.length > 0 && (
            <div className="space-y-2">
              {cleanupItems.map((item, i) => (
                <div key={i} className="card flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => setCleanupItems(prev => prev.map((c, j) => j === i ? { ...c, selected: !c.selected } : c))}
                    className="w-4 h-4 rounded border-gray-600 bg-surface-lighter text-bytefix-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{item.category}</p>
                    <p className="text-xs text-gray-400">{item.path}</p>
                  </div>
                  <span className="text-sm font-medium text-white">{formatBytes(item.size)}</span>
                </div>
              ))}
              <div className="card bg-bytefix-600/10 border-bytefix-500/30">
                <p className="text-sm text-bytefix-300">
                  Total selected: {formatBytes(cleanupItems.filter(i => i.selected).reduce((s, i) => s + i.size, 0))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RAM Tab */}
      {activeTab === 'ram' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-medium text-white mb-2">RAM Optimization</h3>
            <p className="text-sm text-gray-400 mb-4">
              Frees up RAM by disabling unnecessary services (telemetry, Xbox services, search indexer) and clearing memory caches.
              Safe to run — only targets non-essential services.
            </p>
            <button onClick={optimizeRam} disabled={!!loading} className="btn-primary flex items-center gap-2">
              {loading === 'ram' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MemoryStick className="w-4 h-4" />}
              Optimize RAM
            </button>
          </div>
        </div>
      )}

      {/* Disk Tab */}
      {activeTab === 'disk' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-medium text-white mb-2">Disk Optimization</h3>
            <p className="text-sm text-gray-400 mb-4">
              Automatically detects SSD vs HDD. Runs TRIM on SSDs and defragmentation on HDDs.
              Requires administrator privileges.
            </p>
            <button onClick={optimizeDisk} disabled={!!loading} className="btn-primary flex items-center gap-2">
              {loading === 'disk' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              Optimize Disk
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
