import { useState } from 'react'
import { Database, Loader2, FolderOpen, Globe, HardDrive, BookOpen } from 'lucide-react'

interface BackupTarget {
  name: string
  path: string
  exists: boolean
  sizeMB: number
}

interface BrowserProfile {
  browser: string
  profilePath: string
  exists: boolean
}

export function BackupWizardPage(): JSX.Element {
  const [loading, setLoading] = useState('')
  const [targets, setTargets] = useState<BackupTarget[]>([])
  const [browsers, setBrowsers] = useState<BrowserProfile[]>([])
  const [guide, setGuide] = useState<Record<string, unknown> | null>(null)
  const [backupResult, setBackupResult] = useState<Record<string, unknown> | null>(null)

  async function discoverTargets(): Promise<void> {
    setLoading('targets')
    try { setTargets(await window.bytefix.discoverBackupTargets() as BackupTarget[]) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function discoverBrowsers(): Promise<void> {
    setLoading('browsers')
    try { setBrowsers(await window.bytefix.discoverBrowserProfiles() as BrowserProfile[]) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function loadGuide(type: string): Promise<void> {
    setLoading(`guide-${type}`)
    try { setGuide(await window.bytefix.getMigrationGuide(type) as Record<string, unknown>) }
    catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Database className="w-6 h-6 text-cyan-400" /> Backup Wizard
        </h1>
        <p className="text-gray-400 text-sm mt-1">System backup, browser data migration, and PC-to-PC guidance</p>
      </div>

      {backupResult && (
        <div className={`card ${(backupResult as Record<string, boolean>).success ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          <p className="text-sm text-white">{(backupResult as Record<string, string>).description || 'Backup operation completed'}</p>
          <button onClick={() => setBackupResult(null)} className="text-xs text-gray-400 mt-2">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discover User Data */}
        <div className="card">
          <h3 className="font-medium text-white mb-2 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-cyan-400" /> User Data</h3>
          <p className="text-sm text-gray-400 mb-3">Discover Desktop, Documents, Pictures, Downloads, and other user folders for backup.</p>
          <button onClick={discoverTargets} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'targets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
            Discover Files
          </button>
          {targets.length > 0 && (
            <div className="mt-3 space-y-1">
              {targets.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-surface rounded">
                  <span className={t.exists ? 'text-white' : 'text-gray-500'}>{t.name}</span>
                  <span className="text-gray-400">{t.exists ? `${t.sizeMB} MB` : 'Not found'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Browser Data */}
        <div className="card">
          <h3 className="font-medium text-white mb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-400" /> Browser Data</h3>
          <p className="text-sm text-gray-400 mb-3">Detect and backup bookmarks, history, and saved passwords from installed browsers.</p>
          <button onClick={discoverBrowsers} disabled={!!loading} className="btn-primary flex items-center gap-2">
            {loading === 'browsers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            Detect Browsers
          </button>
          {browsers.length > 0 && (
            <div className="mt-3 space-y-1">
              {browsers.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-surface rounded">
                  <span className={b.exists ? 'text-white' : 'text-gray-500'}>{b.browser}</span>
                  <span className={b.exists ? 'text-emerald-400' : 'text-gray-500'}>{b.exists ? 'Found' : 'Not installed'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Migration Guides */}
      <div className="card">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4 text-cyan-400" /> Migration Guides</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => loadGuide('pc-to-pc')} disabled={!!loading} className="p-4 bg-surface rounded-lg border border-gray-700/50 hover:border-cyan-500/30 text-left">
            <HardDrive className="w-5 h-5 text-cyan-400 mb-2" />
            <p className="text-sm font-medium text-white">PC to PC Transfer</p>
            <p className="text-xs text-gray-400 mt-1">Step-by-step guide for transferring data between computers</p>
            {loading === 'guide-pc-to-pc' && <Loader2 className="w-3 h-3 animate-spin text-cyan-400 mt-2" />}
          </button>
          <button onClick={() => loadGuide('windows-reinstall')} disabled={!!loading} className="p-4 bg-surface rounded-lg border border-gray-700/50 hover:border-cyan-500/30 text-left">
            <HardDrive className="w-5 h-5 text-cyan-400 mb-2" />
            <p className="text-sm font-medium text-white">Windows Reinstall</p>
            <p className="text-xs text-gray-400 mt-1">Pre-reinstall backup checklist</p>
            {loading === 'guide-windows-reinstall' && <Loader2 className="w-3 h-3 animate-spin text-cyan-400 mt-2" />}
          </button>
          <button onClick={() => loadGuide('hdd-to-ssd')} disabled={!!loading} className="p-4 bg-surface rounded-lg border border-gray-700/50 hover:border-cyan-500/30 text-left">
            <HardDrive className="w-5 h-5 text-cyan-400 mb-2" />
            <p className="text-sm font-medium text-white">HDD to SSD Clone</p>
            <p className="text-xs text-gray-400 mt-1">Disk cloning instructions</p>
            {loading === 'guide-hdd-to-ssd' && <Loader2 className="w-3 h-3 animate-spin text-cyan-400 mt-2" />}
          </button>
        </div>
      </div>

      {/* Guide Display */}
      {guide && (
        <div className="card border-cyan-500/30">
          <h3 className="font-medium text-white mb-3">{(guide as Record<string, string>).title || 'Migration Guide'}</h3>
          {((guide as Record<string, { step: number; title: string; description: string }[]>).steps || []).map((step, i) => (
            <div key={i} className="flex gap-3 mb-3">
              <span className="text-xs bg-cyan-500/20 text-cyan-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{step.step}</span>
              <div>
                <p className="text-sm font-medium text-white">{step.title}</p>
                <p className="text-xs text-gray-400">{step.description}</p>
              </div>
            </div>
          ))}
          <button onClick={() => setGuide(null)} className="text-xs text-gray-400 mt-2">Close</button>
        </div>
      )}
    </div>
  )
}
