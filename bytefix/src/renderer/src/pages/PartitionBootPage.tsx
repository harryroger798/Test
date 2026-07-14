import { useState } from 'react'
import { HardDrive, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function PartitionBootPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.partitionDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) {
      console.error(err)
      setResult({ success: false, module: 'partition-boot', action, description: 'Operation failed', details: [String(err)], changes: [], rollbackAvailable: false })
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
          <HardDrive className="w-6 h-6 text-indigo-400" /> Partition / Boot Manager
        </h1>
        <p className="text-gray-400 text-sm mt-1">Partition listing, boot configuration, UEFI/BIOS detection, BCD/GRUB repair</p>
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
        <h3 className="font-medium text-white mb-3">Partition &amp; Boot Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Lists partitions, detects boot method (UEFI/Legacy), checks EFI partition, identifies installed OSes.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Partition Diagnostics
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Repair BCD (Windows)</h3>
          <p className="text-sm text-gray-400 mb-3">Rebuilds Windows Boot Configuration Data, fixes MBR, and repairs boot sector.</p>
          <button onClick={() => { if (window.confirm('Repair Windows BCD bootloader? This modifies boot configuration. Continue?')) runFix('bcd', () => window.bytefix.repairBcd(true)) }} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'bcd' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Repair BCD
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Repair GRUB (Linux)</h3>
          <p className="text-sm text-gray-400 mb-3">Updates GRUB configuration and reinstalls the GRUB bootloader.</p>
          <button onClick={() => { if (window.confirm('Repair GRUB bootloader? This modifies boot configuration. Continue?')) runFix('grub', () => window.bytefix.repairGrub(true)) }} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'grub' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Repair GRUB
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Verify Boot Drive</h3>
          <p className="text-sm text-gray-400 mb-3">Checks boot drive filesystem integrity for errors and corruption.</p>
          <button onClick={() => runFix('verify', () => window.bytefix.verifyBootDrive())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Verify Boot Drive
          </button>
        </div>
      </div>
    </div>
  )
}
