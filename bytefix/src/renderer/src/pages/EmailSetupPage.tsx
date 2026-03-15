import { useState } from 'react'
import { Mail, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react'
import type { DiagnosticResult, FixResult } from '../../../../shared/types'

export function EmailSetupPage(): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)
  const [email, setEmail] = useState('')
  const [credTarget, setCredTarget] = useState('')

  async function runDiagnostics(): Promise<void> {
    setLoading('diagnose')
    try { setDiagnostics(await window.bytefix.emailDiagnose()) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function runFix(action: string, fn: () => Promise<FixResult>): Promise<void> {
    setLoading(action)
    try { setResult(await fn()) }
    catch (err) { console.error(err) }
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
          <Mail className="w-6 h-6 text-rose-400" /> Email / Account Setup
        </h1>
        <p className="text-gray-400 text-sm mt-1">IMAP/SMTP auto-config, Outlook repair, credential management, provider detection</p>
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
        <h3 className="font-medium text-white mb-3">Email Diagnostics</h3>
        <p className="text-sm text-gray-400 mb-4">Checks default email client, Outlook installation, stored credentials, and common email ports.</p>
        <button onClick={runDiagnostics} disabled={!!loading} className="btn-primary flex items-center gap-2">
          {loading === 'diagnose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Email Diagnostics
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-white mb-2">Auto-Configure Email</h3>
          <p className="text-sm text-gray-400 mb-3">Detects provider (Gmail, Outlook, Yahoo, Zoho, Rediffmail, BSNL, iCloud, etc.) and returns IMAP/SMTP settings.</p>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 bg-surface-lighter border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
            />
          </div>
          <button onClick={() => runFix('autoconfig', () => window.bytefix.autoConfigureEmail(email))} disabled={!!loading || !email.includes('@')} className="btn-primary flex items-center gap-2">
            {loading === 'autoconfig' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Auto-Configure
          </button>
        </div>
        <div className="card">
          <h3 className="font-medium text-white mb-2">Repair Outlook Profile</h3>
          <p className="text-sm text-gray-400 mb-3">Resets Outlook navigation pane, clears cache, and provides ScanPST guidance.</p>
          <button onClick={() => runFix('outlook', () => window.bytefix.repairOutlookProfile())} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'outlook' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Repair Outlook
          </button>
        </div>
        <div className="card md:col-span-2">
          <h3 className="font-medium text-white mb-2">Clear Email Credentials</h3>
          <p className="text-sm text-gray-400 mb-3">Lists and removes stored email credentials from Windows Credential Manager. Enter a filter keyword (e.g. &quot;outlook&quot;, &quot;gmail&quot;) or leave empty to list all.</p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={credTarget}
              onChange={(e) => setCredTarget(e.target.value)}
              placeholder="Filter (e.g. outlook, gmail)"
              className="flex-1 bg-surface-lighter border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500"
            />
          </div>
          <button onClick={() => runFix('creds', () => window.bytefix.clearEmailCredentials(credTarget))} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'creds' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Clear Credentials
          </button>
        </div>
      </div>
    </div>
  )
}
