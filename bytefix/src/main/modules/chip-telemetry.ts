import { platform } from 'os'
import { runCommand } from './async-command'

export type TelemetryState =
  | 'measured'
  | 'unsupported'
  | 'unknown'
  | 'permission_denied'

export interface TelemetryField<T = unknown> {
  value: T | null
  state: TelemetryState
  source: string
  reason?: string
}

export interface StorageTelemetry {
  deviceId: string
  model: string | null
  sizeBytes: number | null
  mediaType: string | null
  smart: {
    criticalWarning: TelemetryField<boolean>
    percentageUsed: TelemetryField<number>
    mediaErrors: TelemetryField<number>
    powerOnHours: TelemetryField<number>
    temperatureC: TelemetryField<number>
  }
}

export interface ChipTelemetry {
  firmware: {
    biosVendor: TelemetryField<string>
    biosVersion: TelemetryField<string>
    biosDate: TelemetryField<string>
    secureBoot: TelemetryField<boolean>
    uefi: TelemetryField<boolean>
  }
  memory: {
    edacCorrected: TelemetryField<number>
    edacUncorrected: TelemetryField<number>
  }
  cpu: {
    mceMemoryErrors: TelemetryField<number>
  }
  storage: StorageTelemetry[]
  normalizedErrors: Array<Record<string, unknown>>
}

interface QueryResult {
  value: unknown
  state: TelemetryState
  reason?: string
}

interface QueryOutputs {
  bios: string
  secure_boot: string
  boot_mode: string
  physical_disk: string
  disk: string
  reliability: string
  predict_failure: string
  pnp: string
  whea: string
}

const SOURCE_PREFIX = 'PowerShell/CIM'

const COMMANDS: Record<keyof QueryOutputs, string> = {
  bios: [
    'Get-CimInstance Win32_BIOS -ErrorAction Stop',
    '| Select Manufacturer,SMBIOSBIOSVersion,ReleaseDate,SerialNumber',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  secure_boot: [
    '(& { try { [pscustomobject]@{ SecureBoot = [bool](Confirm-SecureBootUEFI -ErrorAction Stop) } }',
    'catch { [pscustomobject]@{ __error = $_.Exception.Message } } })',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  boot_mode: [
    'try { $mode = $env:firmware_type;',
    'if (-not $mode) { $mode = if ((bcdedit /enum "{current}" 2>$null) -match "\\\\EFI\\\\") { "UEFI" } else { "Legacy" } };',
    '[pscustomobject]@{ BootMode = $mode } }',
    'catch { [pscustomobject]@{ __error = $_.Exception.Message } }',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  physical_disk: [
    'Get-PhysicalDisk -ErrorAction Stop',
    '| Select DeviceId,FriendlyName,MediaType,Size,SerialNumber,HealthStatus',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  disk: [
    'Get-Disk -ErrorAction Stop',
    '| Select Number,FriendlyName,BusType,Size,SerialNumber,HealthStatus',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  reliability: [
    'Get-PhysicalDisk -ErrorAction Stop | Get-StorageReliabilityCounter -ErrorAction Stop',
    '| Select DeviceId,Wear,Temperature,PowerOnHours,ReadErrorsTotal,WriteErrorsTotal',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  predict_failure: [
    'Get-CimInstance -Namespace root/wmi -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction Stop',
    '| Select InstanceName,PredictFailure,Reason',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  pnp: [
    'Get-PnpDevice -ErrorAction Stop',
    '| Where-Object { $code = [int]$_.ConfigManagerErrorCode; $code -notin @(0,22,45) }',
    '| Select Class,FriendlyName,InstanceId,Status,ConfigManagerErrorCode',
    '| ConvertTo-Json -Depth 4'
  ].join(' '),
  whea: [
    'Get-WinEvent -FilterHashtable @{ ProviderName = "Microsoft-Windows-WHEA-Logger"; LogName = "System" }',
    '-ErrorAction Stop | Select Id,LevelDisplayName,ProviderName,TimeCreated,Message',
    '| ConvertTo-Json -Depth 6'
  ].join(' ')
}

function field<T>(
  value: T | null,
  state: TelemetryState,
  source: string,
  reason?: string
): TelemetryField<T> {
  return reason ? { value, state, source, reason } : { value, state, source }
}

function unavailable<T>(reason: string, state: TelemetryState = 'unsupported', source = 'bytefix.chip-telemetry'): TelemetryField<T> {
  return field<T>(null, state, source, reason)
}

function records(result: QueryResult): Array<Record<string, unknown>> {
  if (result.state !== 'measured' || result.value === null) return []
  if (Array.isArray(result.value)) {
    return result.value.filter((value): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
    )
  }
  return typeof result.value === 'object' && result.value !== null
    ? [result.value as Record<string, unknown>]
    : []
}

function first(result: QueryResult): Record<string, unknown> {
  return records(result)[0] || {}
}

function textValue(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(row: Record<string, unknown>, key: string): number | null {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/)
    return match ? Number(match[0]) : null
  }
  return null
}

function integerValue(row: Record<string, unknown>, key: string): number | null {
  const value = numberValue(row, key)
  return value === null ? null : Math.trunc(value)
}

function booleanValue(row: Record<string, unknown>, key: string): boolean | null {
  const value = row[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    if (/^(true|yes|1)$/i.test(value.trim())) return true
    if (/^(false|no|0)$/i.test(value.trim())) return false
  }
  return null
}

function classifyError(text: string): { state: TelemetryState; reason: string } {
  const reason = text.trim() || 'PowerShell query failed.'
  if (/access is denied|access denied|permission|unauthorized/i.test(reason)) {
    return { state: 'permission_denied', reason }
  }
  if (/not recognized|not found|cannot find|does not exist|not supported|unsupported/i.test(reason)) {
    return { state: 'unsupported', reason }
  }
  return { state: 'unknown', reason }
}

function parseQuery(text: string, name: string): QueryResult {
  const source = `${SOURCE_PREFIX} ${name}`
  if (!text.trim()) return { value: null, state: 'unknown', reason: 'no_output' }
  try {
    const value: unknown = JSON.parse(text)
    const row = typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
    if (row && typeof row.__state === 'string') {
      return { value: null, state: row.__state as TelemetryState, reason: String(row.__reason || '') }
    }
    if (row && typeof row.__error === 'string') {
      return { value: null, ...classifyError(row.__error) }
    }
    return { value, state: 'measured' }
  } catch {
    return { value: null, state: 'unknown', reason: 'invalid_powershell_json' }
  }
}

function parseBiosDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const epoch = text.match(/^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/)
  if (epoch) {
    const date = new Date(Number(epoch[1]))
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
  }
  const dmtf = text.match(/^(\d{14})/)
  if (dmtf) {
    const date = new Date(Date.UTC(
      Number(dmtf[1].slice(0, 4)),
      Number(dmtf[1].slice(4, 6)) - 1,
      Number(dmtf[1].slice(6, 8))
    ))
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 8) !== `${dmtf[1].slice(0, 4)}-${dmtf[1].slice(4, 6)}-`
      ? null
      : date.toISOString().slice(0, 10)
  }
  const iso = text.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/)
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${iso[1]}-${iso[2]}-${iso[3]}`
      ? null
      : date.toISOString().slice(0, 10)
  }
  const us = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (us) {
    const date = new Date(Date.UTC(Number(us[3]), Number(us[1]) - 1, Number(us[2])))
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${us[3]}-${us[1]}-${us[2]}`
      ? null
      : date.toISOString().slice(0, 10)
  }
  return null
}

function countWhea(rows: Array<Record<string, unknown>>): {
  memoryCorrected: number
  memoryUncorrected: number
  cpuMce: number
  cpuCache: number
  pcie: number
  errors: Array<Record<string, unknown>>
} {
  const counts = { memoryCorrected: 0, memoryUncorrected: 0, cpuMce: 0, cpuCache: 0, pcie: 0 }
  for (const row of rows) {
    const message = textValue(row, 'Message') || ''
    const lowered = message.toLowerCase()
    if (lowered.includes('memory') && (lowered.includes('uncorrected') || lowered.includes('uncorrectable'))) {
      counts.memoryUncorrected += 1
    } else if (lowered.includes('memory') && (lowered.includes('corrected') || lowered.includes('ecc'))) {
      counts.memoryCorrected += 1
    } else if (lowered.includes('pcie') || lowered.includes('aer') || lowered.includes('pci express')) {
      counts.pcie += 1
    } else if (lowered.includes('cache')) {
      counts.cpuCache += 1
    } else if (lowered.includes('mce') || lowered.includes('mca') || lowered.includes('machine check')) {
      counts.cpuMce += 1
    }
  }
  const categories: Array<[keyof typeof counts, string, string, string]> = [
    ['memoryUncorrected', 'whea.memory_controller.uncorrected_ecc', 'critical', 'memory controller'],
    ['memoryCorrected', 'whea.memory_controller.corrected_ecc', 'warn', 'memory controller'],
    ['cpuMce', 'whea.cpu.machine_check', 'critical', 'CPU machine-check'],
    ['cpuCache', 'whea.cpu.cache', 'critical', 'CPU cache'],
    ['pcie', 'whea.pcie.aer', 'warn', 'PCIe device/link']
  ]
  const errors = categories
    .filter(([category]) => counts[category] > 0)
    .map(([category, type, severity, subsystem]) => ({
      type,
      count: counts[category],
      severity,
      source: `${SOURCE_PREFIX} whea`,
      evidence_ref: `whea.${category}`,
      subsystem
    }))
  return { ...counts, errors }
}

function parseTelemetry(outputs: QueryOutputs): ChipTelemetry {
  const results = Object.fromEntries(
    (Object.keys(outputs) as Array<keyof QueryOutputs>).map((name) => [name, parseQuery(outputs[name], name)])
  ) as Record<keyof QueryOutputs, QueryResult>
  const source = (name: string) => `${SOURCE_PREFIX} ${name}`
  const bios = first(results.bios)
  const secureBoot = booleanValue(first(results.secure_boot), 'SecureBoot')
  const bootMode = textValue(first(results.boot_mode), 'BootMode')
  const wheaRows = records(results.whea)
  const whea = countWhea(wheaRows)

  const measuredOrState = <T>(
    value: T | null,
    result: QueryResult,
    name: string,
    reason: string
  ): TelemetryField<T> => value !== null
    ? field(value, 'measured', source(name))
    : unavailable(result.reason || reason, result.state === 'measured' ? 'unknown' : result.state, source(name))

  const physicalRows = records(results.physical_disk)
  const diskRows = records(results.disk)
  const reliabilityRows = records(results.reliability)
  const predictRows = records(results.predict_failure)
  const physical = physicalRows.length > 0
    ? physicalRows
    : diskRows.map((row) => ({ ...row, DeviceId: row.Number }))
  const storage: StorageTelemetry[] = physical.map((row, index) => {
    const deviceId = String(row.DeviceId ?? index)
    const disk = diskRows.find((candidate) =>
      String(candidate.Number) === deviceId || String(candidate.DeviceId) === deviceId
    ) || {}
    const reliability = reliabilityRows.find((candidate) => String(candidate.DeviceId) === deviceId) || {}
    const prediction = predictRows.find((candidate) =>
      String(candidate.DeviceId) === deviceId || String(candidate.InstanceName || '').includes(deviceId)
    ) || {}
    const readErrors = integerValue(reliability, 'ReadErrorsTotal')
    const writeErrors = integerValue(reliability, 'WriteErrorsTotal')
    const mediaErrors = readErrors !== null || writeErrors !== null
      ? (readErrors || 0) + (writeErrors || 0)
      : null
    return {
      deviceId,
      model: textValue(row, 'FriendlyName') || textValue(disk, 'FriendlyName'),
      sizeBytes: integerValue(row, 'Size') || integerValue(disk, 'Size'),
      mediaType: textValue(row, 'MediaType'),
      smart: {
        criticalWarning: measuredOrState(
          booleanValue(prediction, 'PredictFailure'),
          results.predict_failure,
          'predict_failure',
          'prediction_not_returned'
        ),
        percentageUsed: measuredOrState(
          numberValue(reliability, 'Wear'),
          results.reliability,
          'reliability',
          'wear_not_returned'
        ),
        mediaErrors: measuredOrState(
          mediaErrors,
          results.reliability,
          'reliability',
          'error_counters_not_returned'
        ),
        powerOnHours: measuredOrState(
          integerValue(reliability, 'PowerOnHours'),
          results.reliability,
          'reliability',
          'power_on_hours_not_returned'
        ),
        temperatureC: measuredOrState(
          numberValue(reliability, 'Temperature'),
          results.reliability,
          'reliability',
          'temperature_not_returned'
        )
      }
    }
  })
  const pnpErrors = records(results.pnp)
    .filter((row) => {
      const code = integerValue(row, 'ConfigManagerErrorCode')
      return code !== null && ![0, 22, 45].includes(code)
    })
    .map((row) => ({
      type: 'pnp.problem_device',
      count: 1,
      severity: 'warn',
      source: source('pnp'),
      evidence_ref: 'pnp.problem_device',
      code: integerValue(row, 'ConfigManagerErrorCode'),
      device: textValue(row, 'FriendlyName') || textValue(row, 'InstanceId')
    }))
  const storageErrors = storage.flatMap((disk, index) => {
    const errors: Array<Record<string, unknown>> = []
    if (disk.smart.criticalWarning.value === true) {
      errors.push({
        type: 'storage.predict_failure',
        count: 1,
        severity: 'critical',
        source: source('predict_failure'),
        evidence_ref: `storage[${index}].smart.critical_warning`
      })
    }
    if ((disk.smart.mediaErrors.value || 0) > 0) {
      errors.push({
        type: 'storage.media_errors',
        count: disk.smart.mediaErrors.value,
        severity: 'critical',
        source: source('reliability'),
        evidence_ref: `storage[${index}].smart.media_errors`
      })
    }
    return errors
  })
  const wheaFields = {
    edacCorrected: measuredOrState(
      wheaRows.length ? whea.memoryCorrected : null,
      results.whea,
      'whea',
      'no WHEA memory events returned'
    ),
    edacUncorrected: measuredOrState(
      wheaRows.length ? whea.memoryUncorrected : null,
      results.whea,
      'whea',
      'no WHEA memory events returned'
    ),
    mce: measuredOrState(
      wheaRows.length ? whea.cpuMce : null,
      results.whea,
      'whea',
      'no WHEA CPU events returned'
    )
  }
  return {
    firmware: {
      biosVendor: measuredOrState(textValue(bios, 'Manufacturer'), results.bios, 'bios', 'bios_vendor_not_returned'),
      biosVersion: measuredOrState(textValue(bios, 'SMBIOSBIOSVersion'), results.bios, 'bios', 'bios_version_not_returned'),
      biosDate: measuredOrState(parseBiosDate(bios.ReleaseDate), results.bios, 'bios', 'bios_date_not_returned'),
      secureBoot: measuredOrState(secureBoot, results.secure_boot, 'secure_boot', 'secure_boot_not_returned'),
      uefi: measuredOrState(bootMode ? bootMode.toUpperCase() === 'UEFI' : null, results.boot_mode, 'boot_mode', 'boot_mode_not_returned')
    },
    memory: {
      edacCorrected: wheaFields.edacCorrected,
      edacUncorrected: wheaFields.edacUncorrected
    },
    cpu: { mceMemoryErrors: wheaFields.mce },
    storage,
    normalizedErrors: [...whea.errors, ...pnpErrors, ...storageErrors]
  }
}

export function parseChipTelemetryOutputs(outputs: QueryOutputs): ChipTelemetry {
  return parseTelemetry(outputs)
}

function unsupportedTelemetry(): ChipTelemetry {
  const reason = 'Windows PowerShell/CIM telemetry is only available on Windows.'
  return {
    firmware: {
      biosVendor: unavailable(reason),
      biosVersion: unavailable(reason),
      biosDate: unavailable(reason),
      secureBoot: unavailable(reason),
      uefi: unavailable(reason)
    },
    memory: {
      edacCorrected: unavailable(reason),
      edacUncorrected: unavailable(reason)
    },
    cpu: { mceMemoryErrors: unavailable(reason) },
    storage: [],
    normalizedErrors: []
  }
}

export async function collectChipTelemetry(): Promise<ChipTelemetry> {
  if (platform() !== 'win32') return unsupportedTelemetry()
  const outputs = {} as QueryOutputs
  const names = Object.keys(COMMANDS) as Array<keyof QueryOutputs>
  await Promise.all(names.map(async (name) => {
    try {
      outputs[name] = await runCommand('powershell', ['-NoProfile', '-Command', COMMANDS[name]], 30000)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      outputs[name] = JSON.stringify({ __error: message })
    }
  }))
  return parseTelemetry(outputs)
}

export type { QueryOutputs }
