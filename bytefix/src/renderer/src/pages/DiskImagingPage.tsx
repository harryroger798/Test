import { useState } from 'react'
import { DiscAlbum, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function DiskImagingPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)
  const [destPath, setDestPath] = useState('')
  const [srcDrive, setSrcDrive] = useState('')
  const [destDrive, setDestDrive] = useState('')

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.diskImgDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'disk-imaging', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <DiscAlbum className="w-6 h-6 text-purple-400" /> Disk Imaging & Cloning
        </h1>
        <p className="text-gray-400 text-sm mt-1">System image backup, partition cloning, and drive rescue for failing disks</p>
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
        <h3 className="font-medium text-white mb-3">Drive Overview</h3>
        <p className="text-sm text-gray-400 mb-4">Scan all connected drives, check health, and identify imaging opportunities.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Scan Drives
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="space-y-3">
          {diagnostics.map((d) => (
            <div key={d.id} className="card">
              <p className={`text-sm font-medium ${severityColor(d.severity)}`}>{d.title}</p>
              <p className="text-xs text-gray-400 mt-1">{d.description}</p>
              {d.details.map((det, i) => <p key={i} className="text-xs text-gray-500 mt-0.5">{det}</p>)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Create System Image</h3>
          <p className="text-sm text-gray-400 mb-3">Full system backup using wbadmin (Windows) or dd (Linux/Mac).</p>
          <input
            type="text"
            value={destPath}
            onChange={(e) => setDestPath(e.target.value)}
            placeholder="Destination path (e.g., D:\Backups)"
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-3"
          />
          <button
            onClick={() => runFix('sysimage', () => window.bytefix.createSystemImage(destPath))}
            disabled={!!loading || !destPath}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'sysimage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DiscAlbum className="w-4 h-4" />}
            Create System Image
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Clone Partition</h3>
          <p className="text-sm text-gray-400 mb-3">Clone one drive/partition to another using robocopy/dd.</p>
          <input
            type="text"
            value={srcDrive}
            onChange={(e) => setSrcDrive(e.target.value)}
            placeholder="Source (e.g., C:)"
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-2"
          />
          <input
            type="text"
            value={destDrive}
            onChange={(e) => setDestDrive(e.target.value)}
            placeholder="Destination (e.g., E:)"
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-3"
          />
          <button
            onClick={() => runFix('clone', () => window.bytefix.clonePartition(srcDrive, destDrive))}
            disabled={!!loading || !srcDrive || !destDrive}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'clone' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DiscAlbum className="w-4 h-4" />}
            Clone Partition
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-white mb-2">Rescue Failing Drive</h3>
        <p className="text-sm text-gray-400 mb-3">Error-tolerant copy for drives with bad sectors. Recovers as much data as possible.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={srcDrive}
            onChange={(e) => setSrcDrive(e.target.value)}
            placeholder="Source drive (e.g., D:)"
            className="bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white"
          />
          <input
            type="text"
            value={destPath}
            onChange={(e) => setDestPath(e.target.value)}
            placeholder="Rescue destination"
            className="bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          onClick={() => runFix('rescue', () => window.bytefix.rescueDrive(srcDrive, destPath))}
          disabled={!!loading || !srcDrive || !destPath}
          className="btn-primary flex items-center gap-2"
        >
          {loading === 'rescue' ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          Rescue Drive Data
        </button>
      </div>
    </div>
  )
}
