import type { DiagnosticResult, SystemMetrics } from './ai-diagnostics'
import { toEvidenceBundle, type EvidenceBundle } from './evidence-adapter'
import type { AIProviderConfig, AIProviderId, SystemInfo } from '../../shared/types'

export interface AIProviderContext {
  metrics: SystemMetrics
  systemInfo: SystemInfo
  evidence: EvidenceBundle
  config: AIProviderConfig
  localDiagnosis: () => Promise<DiagnosticResult>
}

export interface AIProvider {
  id: AIProviderId
  isAvailable(config: AIProviderConfig): boolean
  diagnose(context: AIProviderContext): Promise<DiagnosticResult>
}

export const DEFAULT_CLOUD_URL = 'https://ai-repair-cloud.getlaunchpod.workers.dev'

const STATUS_SEVERITY: Record<string, DiagnosticResult['severity']> = {
  healthy: 'low',
  investigate: 'medium',
  critical: 'critical',
  unknown: 'medium'
}

function clampConfidence(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.round(Math.max(0, Math.min(100, number <= 1 ? number * 100 : number)) * 10) / 10
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function mapRemoteDiagnosis(
  raw: unknown,
  metrics: SystemMetrics,
  provider: 'cloudflare' | 'custom'
): DiagnosticResult {
  const outer = asRecord(raw)
  const diagnosis = asRecord(outer.diagnosis ?? raw)
  const candidates = Array.isArray(diagnosis.candidate_diagnoses)
    ? diagnosis.candidate_diagnoses.map(asRecord)
    : Array.isArray(diagnosis.candidates)
      ? diagnosis.candidates.map(asRecord)
      : []
  const first = candidates[0] || {}
  const status = stringValue(diagnosis.overall_status ?? diagnosis.status, 'unknown').toLowerCase()
  const label = stringValue(first.cause ?? diagnosis.diagnosis ?? diagnosis.label, 'Remote analysis')
  const notes = arrayOfStrings(diagnosis.notes)
  const description = stringValue(
    diagnosis.assessment ?? diagnosis.summary ?? diagnosis.description ?? notes[0] ?? first.next_test,
    'The remote provider returned a diagnosis without a detailed summary.'
  )
  const actions = [
    ...arrayOfStrings(diagnosis.actions),
    ...candidates.flatMap((candidate) => [
      stringValue(candidate.next_test, ''),
      stringValue(candidate.repair_action, '')
    ])
  ].filter(Boolean)
  const confidence = clampConfidence(first.confidence ?? diagnosis.confidence)

  return {
    diagnosis: label as DiagnosticResult['diagnosis'],
    confidence,
    description,
    severity: STATUS_SEVERITY[status] || 'medium',
    actions: [...new Set(actions)],
    allProbabilities: candidates.map((candidate) => ({
      label: stringValue(candidate.cause, 'Candidate cause') as DiagnosticResult['diagnosis'],
      probability: clampConfidence(candidate.confidence)
    })),
    metrics,
    timestamp: new Date().toISOString(),
    modelVersion: `${provider}-remote`,
    inferenceTimeMs: 0,
    provider,
    providerLabel: provider === 'cloudflare' ? 'Cloudflare Workers AI' : 'Custom AI provider',
    inputProvenance: metrics.provenance
  }
}

async function requestJson(url: string, init: RequestInit, timeoutMs = 15000): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json', ...(init.headers || {}) }
  })
  const body = await response.text()
  let parsed: unknown = {}
  try {
    parsed = body ? JSON.parse(body) : {}
  } catch {
    throw new Error(`AI provider returned non-JSON response (${response.status})`)
  }
  if (!response.ok) {
    const detail = parsed && typeof parsed === 'object'
      ? JSON.stringify(parsed).slice(0, 240)
      : ''
    throw new Error(`AI provider request failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return parsed
}

function hasRemoteDiagnosis(value: unknown): boolean {
  const outer = asRecord(value)
  const diagnosis = asRecord(outer.diagnosis ?? value)
  const candidates = diagnosis.candidate_diagnoses
  if (Array.isArray(candidates) && candidates.length > 0) return true
  if (diagnosis.abstained === true) return true
  const status = String(diagnosis.overall_status ?? diagnosis.status ?? '').toLowerCase()
  return status === 'healthy' || status === 'investigate' || status === 'critical'
}

function remoteAnalysisError(value: unknown): string | null {
  const record = asRecord(value)
  if (String(record.status || '').toLowerCase() === 'failed') {
    return stringValue(record.analysis_error ?? record.error, 'Cloudflare analysis failed')
  }
  return null
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export class CloudflareProvider implements AIProvider {
  readonly id = 'cloudflare' as const

  isAvailable(config: AIProviderConfig): boolean {
    return config.cloudConsent && Boolean(config.cloudUrl.trim()) && Boolean(config.cloudToken.trim())
  }

  async diagnose(context: AIProviderContext): Promise<DiagnosticResult> {
    const config = context.config
    const headers = {
      Authorization: `Bearer ${config.cloudToken}`,
      'Content-Type': 'application/json'
    }
    const created = asRecord(await requestJson(`${config.cloudUrl.replace(/\/+$/, '')}/v1/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify(context.evidence)
    }))
    const caseId = stringValue(created.case_id, '')
    if (!caseId) throw new Error('Cloudflare provider did not return case_id')
    await requestJson(`${config.cloudUrl.replace(/\/+$/, '')}/v1/cases/${encodeURIComponent(caseId)}/analyze`, {
      method: 'POST',
      headers
    }, 15000)
    let result: unknown = {}
    for (let attempt = 0; attempt < 75; attempt += 1) {
      result = await requestJson(`${config.cloudUrl.replace(/\/+$/, '')}/v1/cases/${encodeURIComponent(caseId)}`, {
        method: 'GET',
        headers
      }, 15000)
      const error = remoteAnalysisError(result)
      if (error) throw new Error(error)
      if (hasRemoteDiagnosis(result)) break
      if (attempt < 74) await delay(2000)
    }
    if (!hasRemoteDiagnosis(result)) throw new Error('Cloudflare analysis did not finish within 150 seconds')
    return mapRemoteDiagnosis(result, context.metrics, this.id)
  }
}

export class CustomProvider implements AIProvider {
  readonly id = 'custom' as const

  isAvailable(config: AIProviderConfig): boolean {
    return config.cloudConsent &&
      Boolean(config.customBaseUrl.trim()) &&
      Boolean(config.customApiKey.trim()) &&
      Boolean(config.customModel.trim())
  }

  async diagnose(context: AIProviderContext): Promise<DiagnosticResult> {
    const config = context.config
    const prompt = [
      'Diagnose this computer evidence conservatively.',
      'Return JSON with overall_status, candidate_diagnoses, confidence, summary, and actions.',
      'Do not invent measurements or recommend destructive operations.'
    ].join(' ')
    const result = await requestJson(config.customBaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.customApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: config.customModel, prompt, evidence: context.evidence })
    })
    return mapRemoteDiagnosis(result, context.metrics, this.id)
  }
}

export class OnnxProvider implements AIProvider {
  readonly id = 'onnx' as const

  isAvailable(): boolean {
    return true
  }

  async diagnose(context: AIProviderContext): Promise<DiagnosticResult> {
    return context.localDiagnosis()
  }
}

export class RulesProvider implements AIProvider {
  readonly id = 'rules' as const

  isAvailable(): boolean {
    return true
  }

  async diagnose(context: AIProviderContext): Promise<DiagnosticResult> {
    const result = await context.localDiagnosis()
    return { ...result, provider: 'rules' }
  }
}

export function createProviders(): Record<AIProviderId, AIProvider> {
  return {
    cloudflare: new CloudflareProvider(),
    custom: new CustomProvider(),
    onnx: new OnnxProvider(),
    rules: new RulesProvider()
  }
}

export function buildEvidence(
  info: SystemInfo,
  metrics: SystemMetrics,
  uploadConsent: boolean,
  telemetry?: import('./chip-telemetry').ChipTelemetry
): EvidenceBundle {
  return toEvidenceBundle(info, metrics, { uploadConsent, telemetry })
}
