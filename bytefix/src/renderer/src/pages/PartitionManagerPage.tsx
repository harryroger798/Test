import { useState } from 'react'
import { HardDrive, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function PartitionManagerPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)
  const [driveLetter, setDriveLetter] = useState('')
  const [newSizeMB, setNewSizeMB] = useState(0)
  const [fileSystem, setFileSystem] = useState('NTFS')
  const [label, setLabel] = useState('')
  const [diskNumber, setDiskNumber] = useState(0)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.partMgrDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'partition-manager', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <HardDrive className="w-6 h-6 text-blue-400" /> Partition Manager
        </h1>
        <p className="text-gray-400 text-sm mt-1">Create, resize, format, and manage disk partitions</p>
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
        <h3 className="font-medium text-white mb-3">Partition Overview</h3>
        <p className="text-sm text-gray-400 mb-4">List all partitions with size, filesystem, usage, and health info.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Scan Partitions
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
          <h3 className="font-medium text-white mb-2">Resize Partition</h3>
          <p className="text-sm text-gray-400 mb-3">Shrink or extend a partition (Windows only, uses PowerShell).</p>
          <input
            type="text"
            value={driveLetter}
            onChange={(e) => setDriveLetter(e.target.value)}
            placeholder="Drive letter (e.g., D)"
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-2"
          />
          <input
            type="number"
            value={newSizeMB || ''}
            onChange={(e) => setNewSizeMB(Number(e.target.value))}
            placeholder="New size in MB"
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-3"
          />
          <button
            onClick={() => runFix('resize', () => window.bytefix.resizePartition(driveLetter, newSizeMB))}
            disabled={!!loading || !driveLetter || !newSizeMB}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'resize' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Resize
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Format Partition</h3>
          <p className="text-sm text-gray-400 mb-3">Format a non-system partition with chosen filesystem.</p>
          <input
            type="text"
            value={driveLetter}
            onChange={(e) => setDriveLetter(e.target.value)}
            placeholder="Drive letter (e.g., E)"
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-2"
          />
          <select
            value={fileSystem}
            onChange={(e) => setFileSystem(e.target.value)}
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-2"
          >
            <option value="NTFS">NTFS</option>
            <option value="FAT32">FAT32</option>
            <option value="exFAT">exFAT</option>
          </select>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Volume label (optional)"
            className="w-full bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white mb-3"
          />
          <button
            onClick={() => runFix('format', () => window.bytefix.formatPartition(driveLetter, fileSystem, label))}
            disabled={!!loading || !driveLetter}
            className="btn-primary flex items-center gap-2"
          >
            {loading === 'format' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Format
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-white mb-2">Create New Partition</h3>
        <p className="text-sm text-gray-400 mb-3">Create a partition from unallocated disk space.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="number"
            value={diskNumber || ''}
            onChange={(e) => setDiskNumber(Number(e.target.value))}
            placeholder="Disk number (e.g., 0)"
            className="bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white"
          />
          <input
            type="number"
            value={newSizeMB || ''}
            onChange={(e) => setNewSizeMB(Number(e.target.value))}
            placeholder="Size in MB"
            className="bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white"
          />
          <select
            value={fileSystem}
            onChange={(e) => setFileSystem(e.target.value)}
            className="bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white"
          >
            <option value="NTFS">NTFS</option>
            <option value="FAT32">FAT32</option>
            <option value="exFAT">exFAT</option>
          </select>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="bg-surface-lighter border border-gray-600 rounded px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          onClick={() => runFix('create', () => window.bytefix.createPartition(diskNumber, newSizeMB, fileSystem, label))}
          disabled={!!loading || !newSizeMB}
          className="btn-primary flex items-center gap-2"
        >
          {loading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
          Create Partition
        </button>
      </div>
    </div>
  )
}
