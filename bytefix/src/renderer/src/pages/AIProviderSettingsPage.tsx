import { useEffect, useState } from 'react'
import { Brain, Save, ShieldCheck } from 'lucide-react'
import type { AIProviderConfig, AIProviderId } from '../../../../shared/types'

const PROVIDERS: AIProviderId[] = ['cloudflare', 'custom', 'onnx', 'rules']

const DEFAULT_CONFIG: AIProviderConfig = {
  priority: PROVIDERS,
  cloudUrl: 'https://ai-repair-cloud.getlaunchpod.workers.dev',
  cloudToken: '',
  customBaseUrl: '',
  customApiKey: '',
  customModel: '',
  cloudConsent: false
}

export function AIProviderSettingsPage(): JSX.Element {
  const [config, setConfig] = useState<AIProviderConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    void window.bytefix.aiGetProviderConfig()
      .then((value) => setConfig({ ...DEFAULT_CONFIG, ...value }))
      .catch(() => setSaved('Unable to load provider settings.'))
      .finally(() => setLoading(false))
  }, [])

  function update<K extends keyof AIProviderConfig>(key: K, value: AIProviderConfig[K]): void {
    setConfig((current) => ({ ...current, [key]: value }))
    setSaved('')
  }

  function moveProvider(provider: AIProviderId, direction: -1 | 1): void {
    const index = config.priority.indexOf(provider)
    const target = index + direction
    if (index < 0 || target < 0 || target >= config.priority.length) return
    const priority = [...config.priority]
    ;[priority[index], priority[target]] = [priority[target], priority[index]]
    update('priority', priority)
  }

  async function save(): Promise<void> {
    setSaving(true)
    setSaved('')
    try {
      const value = await window.bytefix.aiSetProviderConfig(config)
      setConfig({ ...DEFAULT_CONFIG, ...value })
      setSaved('Provider settings saved.')
    } catch {
      setSaved('Unable to save provider settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-400">Loading AI provider settings…</div>

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-bytefix-400" /> AI Provider Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">Choose how ByteFix obtains diagnosis while preserving offline fallback.</p>
      </div>

      <div className="card border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div className="text-sm text-gray-300">
            Cloud and custom providers run only when consent is enabled and their credentials are configured.
            Tokens and API keys are stored as settings and are never displayed in logs or diagnosis results.
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Provider priority</h2>
        <p className="text-xs text-gray-400">Providers are tried from top to bottom. ONNX and rules remain available offline.</p>
        <div className="space-y-2">
          {config.priority.map((provider, index) => (
            <div key={provider} className="flex items-center gap-3 rounded-lg bg-surface-lighter/50 px-3 py-2">
              <span className="w-6 text-gray-500">{index + 1}</span>
              <span className="flex-1 text-white capitalize">{provider === 'onnx' ? 'Offline ONNX' : provider}</span>
              <button className="btn-secondary text-xs" onClick={() => moveProvider(provider, -1)} disabled={index === 0}>Up</button>
              <button className="btn-secondary text-xs" onClick={() => moveProvider(provider, 1)} disabled={index === config.priority.length - 1}>Down</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Cloudflare Workers AI</h2>
        <label className="block text-sm text-gray-300">
          Worker URL
          <input className="input mt-1 w-full" value={config.cloudUrl} onChange={(event) => update('cloudUrl', event.target.value)} />
        </label>
        <label className="block text-sm text-gray-300">
          Bearer token
          <input className="input mt-1 w-full" type="password" autoComplete="off" value={config.cloudToken} onChange={(event) => update('cloudToken', event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={config.cloudConsent} onChange={(event) => update('cloudConsent', event.target.checked)} />
          I consent to sending the evidence bundle to the configured remote provider.
        </label>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-white">Custom provider</h2>
        <label className="block text-sm text-gray-300">
          Base URL
          <input className="input mt-1 w-full" value={config.customBaseUrl} onChange={(event) => update('customBaseUrl', event.target.value)} />
        </label>
        <label className="block text-sm text-gray-300">
          API key
          <input className="input mt-1 w-full" type="password" autoComplete="off" value={config.customApiKey} onChange={(event) => update('customApiKey', event.target.value)} />
        </label>
        <label className="block text-sm text-gray-300">
          Model
          <input className="input mt-1 w-full" value={config.customModel} onChange={(event) => update('customModel', event.target.value)} placeholder="provider-model-name" />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button className="btn-primary flex items-center gap-2" onClick={() => void save()} disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-gray-400">{saved}</span>}
      </div>
    </div>
  )
}
