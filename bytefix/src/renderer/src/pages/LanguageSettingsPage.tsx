import { useState, useEffect } from 'react'
import { Languages, Loader2, CheckCircle } from 'lucide-react'
import { useAppStore } from '../store/app-store'

interface LanguageInfo {
  code: string
  name: string
  nativeName: string
  direction: string
}

export function LanguageSettingsPage(): JSX.Element {
  const [loading, setLoading] = useState('')
  const [languages, setLanguages] = useState<LanguageInfo[]>([])
  const currentLang = useAppStore((s) => s.language)
  const storeChangeLanguage = useAppStore((s) => s.changeLanguage)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadLanguages()
  }, [])

  async function loadLanguages(): Promise<void> {
    try { setLanguages(await window.bytefix.getSupportedLanguages() as LanguageInfo[]) }
    catch (err) { console.error(err) }
  }

  async function changeLanguage(lang: string): Promise<void> {
    setLoading(lang)
    setSaved(false)
    try {
      await storeChangeLanguage(lang)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Languages className="w-6 h-6 text-amber-400" /> Language Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">Multi-language support for 7 Indian languages</p>
      </div>

      {saved && (
        <div className="card border-emerald-500/50">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-emerald-400">Language updated successfully!</p>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-medium text-white mb-4">Select Language</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              disabled={!!loading}
              className={`p-4 rounded-lg border text-left transition-all ${
                currentLang === lang.code
                  ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/20'
                  : 'bg-surface border-gray-700/50 hover:border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{lang.nativeName}</p>
                  <p className="text-xs text-gray-400">{lang.name}</p>
                </div>
                {loading === lang.code ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : currentLang === lang.code ? (
                  <CheckCircle className="w-4 h-4 text-amber-400" />
                ) : null}
              </div>
              <span className="text-[10px] text-gray-500 mt-1 block">{lang.code.toUpperCase()} | {lang.direction.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-white mb-3">About i18n</h3>
        <div className="space-y-2 text-sm text-gray-400">
          <p>ByteFix supports 7 languages to serve technicians across India:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>English - Default language</li>
            <li>Hindi ({'\u0939\u093F\u0928\u094D\u0926\u0940'}) - Most widely spoken</li>
            <li>Tamil ({'\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD'}) - Tamil Nadu, Puducherry</li>
            <li>Telugu ({'\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41'}) - Andhra Pradesh, Telangana</li>
            <li>Bengali ({'\u09AC\u09BE\u0982\u09B2\u09BE'}) - West Bengal</li>
            <li>Marathi ({'\u092E\u0930\u093E\u0920\u0940'}) - Maharashtra</li>
            <li>Kannada ({'\u0C95\u0CA8\u0CCD\u0CA8\u0CA1'}) - Karnataka</li>
          </ul>
          <p className="text-xs text-gray-500 mt-2">Language preference is saved locally and persists across sessions.</p>
        </div>
      </div>
    </div>
  )
}
