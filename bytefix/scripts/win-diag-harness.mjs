import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import {
  buildEvidence,
  CloudflareProvider,
  collectSystemMetrics,
  collectWindowsSensorReadings,
  runOnnxInference,
  getStartupItems,
  getLastStartupProbe,
  listAudioDevices,
  isAudioProblemDevice,
  getLastAudioProbe
} from '../out/harness/win-diag-entry.js'

const info = {
  os: { platform: process.platform, distro: 'Windows', release: '', arch: process.arch, hostname: '', build: '' },
  cpu: { manufacturer: '', brand: 'Windows harness CPU', speed: 1, cores: 2, physicalCores: 2 },
  memory: { total: 1, free: 1, used: 0, usedPercent: 0, swapTotal: 0, swapUsed: 0 },
  disk: [],
  battery: {
    hasBattery: false, isCharging: false, percent: 0, cycleCount: 0, designCapacity: 0,
    currentCapacity: 0, healthPercent: 0, voltage: 0, timeRemaining: 0,
    manufacturer: '', model: '', powerSource: 'AC'
  },
  graphics: { controllers: [], displays: [] },
  network: [],
  uptime: 0
}

function print(label, value) {
  console.log(`=== ${label} ===`)
  console.log(JSON.stringify(value, null, 2))
}

const sensorReadings = await collectWindowsSensorReadings()
print('SENSOR PROBES', sensorReadings.probes)

const metrics = await collectSystemMetrics()
print('METRICS', metrics)

const onnx = await runOnnxInference(metrics)
print('ONNX', onnx)

let startupItems = []
let startupError = null
try {
  startupItems = await getStartupItems()
} catch (error) {
  startupError = error instanceof Error ? error.message : String(error)
}
print('STARTUP PROBE', getLastStartupProbe())
print('STARTUP ITEMS', { items: startupItems, error: startupError })

const audioDevices = listAudioDevices()
print('AUDIO DEVICE PROBES', getLastAudioProbe())
print('AUDIO DEVICES', {
  devices: audioDevices,
  problemDevices: audioDevices.filter(isAudioProblemDevice)
})

const token = process.env.BYTEFIX_WORKER_TOKEN
if (!token) {
  print('CLOUD', { skipped: true, reason: 'BYTEFIX_WORKER_TOKEN is not configured' })
} else {
  const cloudUrl = 'https://ai-repair-cloud.getlaunchpod.workers.dev'
  const evidence = buildEvidence(info, metrics, true)
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const request = async (label, url, init) => {
    const started = performance.now()
    const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(120000) })
    const body = await response.text()
    let parsed
    try { parsed = body ? JSON.parse(body) : {} } catch { parsed = { raw: body.slice(0, 500) } }
    const result = { status: response.status, elapsedMs: Math.round(performance.now() - started), body: parsed }
    print(`CLOUD ${label}`, result)
    if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`)
    return parsed
  }
  try {
    const created = await request('POST /v1/cases', `${cloudUrl}/v1/cases`, {
      method: 'POST', body: JSON.stringify({ ...evidence, case_id: randomUUID() })
    })
    const caseId = created.case_id
    await request('POST /v1/cases/:id/analyze', `${cloudUrl}/v1/cases/${caseId}/analyze`, {
      method: 'POST'
    })
    await request('GET /v1/cases/:id', `${cloudUrl}/v1/cases/${caseId}`, { method: 'GET' })
  } catch (error) {
    print('CLOUD ERROR', { error: error instanceof Error ? error.message : String(error) })
  }
}
