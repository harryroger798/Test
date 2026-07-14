import { useState } from 'react'
import { HardDrive, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function DataRecoveryPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)
  const [sourceDrive, setSourceDrive] = useState('')
  const [outputDir, setOutputDir] = useState('')

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try {
      const res = await window.bytefix.recoveryDiagnose()
      setDiagnostics(res)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try {
      const res = await fn()
      setResult(res)
    } catch (err) { console.error(err) }
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
          <HardDrive className="w-6 h-6 text-emerald-400" /> Data Recovery
        </h1>
        <p className="text-gray-400 text-sm mt-1">Shadow copy restore, recycle bin recovery, PhotoRec file carving, filesystem repair</p>
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
        <h3 className="font-medium text-white mb-3">Run Recovery Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Scans for recoverable data: shadow copies, recycle bin items, filesystem health, and recovery tool availability.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Scan for Recoverable Data
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="space-y-3">
          {diagnostics.map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${severityColor(d.severity)}`}>{d.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{d.description}</p>
                  {d.details.map((det, i) => <p key={i} className="text-xs text-gray-500 mt-0.5">• {det}</p>)}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${severityColor(d.severity)} bg-gray-800`}>{d.severity}</span>
              </div>
              {d.fixAvailable && d.fixDescription && (
                <p className="text-xs text-bytefix-400 mt-2">Fix: {d.fixDescription}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 className="font-medium text-white mb-2">Deep File Recovery (PhotoRec)</h3>
        <p className="text-sm text-gray-400 mb-3">Recover permanently deleted files (Shift+Delete, emptied Recycle Bin, formatted drives) using PhotoRec file carving. Scans raw disk sectors to find recoverable data.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <input value={sourceDrive} onChange={(e) => setSourceDrive(e.target.value)} placeholder="Source drive (e.g., C:)" className="bg-gray-800 text-white rounded px-3 py-2 text-sm border border-gray-700" />
          <input value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder="Recovery output folder (e.g., D:\\Recovered)" className="bg-gray-800 text-white rounded px-3 py-2 text-sm border border-gray-700" />
        </div>
        <button onClick={() => runFix('photorec', () => window.bytefix.runPhotorec(sourceDrive, outputDir))} disabled={!!loading || !sourceDrive || !outputDir} className="btn-primary flex items-center gap-2">
          {loading === 'photorec' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Deep Recovery (PhotoRec)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Restore from Recycle Bin</h3>
          <p className="text-sm text-gray-400 mb-3">Recover recently deleted files from the system recycle bin.</p>
          <button onClick={() => runFix('recycle', () => window.bytefix.restoreRecycleBin())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'recycle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Restore Recycle Bin
          </button>
        </div>

        <div className="card">
          <h3 className="font-medium text-white mb-2">Repair Filesystem</h3>
          <p className="text-sm text-gray-400 mb-3">Run chkdsk to repair filesystem errors and recover readable data.</p>
          <button onClick={() => { if (window.confirm('Filesystem repair can modify filesystem metadata. Continue?')) runFix('fs', () => window.bytefix.repairFilesystem('C', true)) }} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'fs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Repair Filesystem (C:)
          </button>
        </div>
      </div>
    </div>
  )
}
