import { getSetting, saveSetting } from '../database'
import { DEFAULT_CLOUD_URL } from './ai-provider'
import type { AIProviderConfig, AIProviderId } from '../../shared/types'

const SETTING_KEY = 'bytefix_ai_provider_config'
const VALID_IDS: AIProviderId[] = ['cloudflare', 'custom', 'onnx', 'rules']

export const DEFAULT_AI_PROVIDER_CONFIG: AIProviderConfig = {
  priority: ['cloudflare', 'custom', 'onnx', 'rules'],
  cloudUrl: DEFAULT_CLOUD_URL,
  cloudToken: '',
  customBaseUrl: '',
  customApiKey: '',
  customModel: '',
  cloudConsent: false
}

function normalize(value: unknown): AIProviderConfig {
  const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const priority = Array.isArray(input.priority)
    ? input.priority.filter((id): id is AIProviderId => typeof id === 'string' && VALID_IDS.includes(id as AIProviderId))
    : []
  return {
    priority: [...new Set([...priority, ...DEFAULT_AI_PROVIDER_CONFIG.priority])],
    cloudUrl: typeof input.cloudUrl === 'string' && input.cloudUrl.trim()
      ? input.cloudUrl.trim()
      : DEFAULT_CLOUD_URL,
    cloudToken: typeof input.cloudToken === 'string' ? input.cloudToken : '',
    customBaseUrl: typeof input.customBaseUrl === 'string' ? input.customBaseUrl.trim() : '',
    customApiKey: typeof input.customApiKey === 'string' ? input.customApiKey : '',
    customModel: typeof input.customModel === 'string' ? input.customModel.trim() : '',
    cloudConsent: input.cloudConsent === true
  }
}

export function getAIProviderConfig(): AIProviderConfig {
  const raw = getSetting(SETTING_KEY)
  if (!raw) return { ...DEFAULT_AI_PROVIDER_CONFIG, priority: [...DEFAULT_AI_PROVIDER_CONFIG.priority] }
  try {
    return normalize(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_AI_PROVIDER_CONFIG, priority: [...DEFAULT_AI_PROVIDER_CONFIG.priority] }
  }
}

export function setAIProviderConfig(config: AIProviderConfig): AIProviderConfig {
  const normalized = normalize(config)
  saveSetting(SETTING_KEY, JSON.stringify(normalized))
  return normalized
}
