import { randomUUID } from 'crypto'
import type { SystemInfo } from '../../shared/types'
import type { SystemMetrics } from './ai-diagnostics'

type EvidenceState =
  | 'measured'
  | 'vendor_estimated'
  | 'unsupported'
  | 'unknown'
  | 'permission_denied'
  | 'redacted'

export interface EvidenceField<T = unknown> {
  value: T
  state: EvidenceState
  source: string
  reason?: string
}

export interface EvidenceBundle {
  schema_version: string
  case_id: string
  captured_at: string
  agent: { name: string; version: string; platform: string }
  consent: { upload: boolean; redaction_profile: string }
  host: Record<string, EvidenceField>
  firmware: Record<string, EvidenceField>
  cpu: Record<string, EvidenceField>
  memory: {
    total_bytes: EvidenceField
    modules: Array<{
      slot: string
      size_bytes: number | null
      speed_mts: number | null
      manufacturer: string | null
      state: EvidenceState
      source: string
    }>
    ecc: EvidenceField
    edac_corrected: EvidenceField
    edac_uncorrected: EvidenceField
  }
  storage: Array<Record<string, unknown>>
  graphics: Array<Record<string, unknown>>
  network: Array<Record<string, unknown>>
  usb: unknown[]
  pci: unknown[]
  sensors: { cpu_temp_c: EvidenceField; fan_rpm: unknown[] }
  battery: Record<string, EvidenceField>
  os: Record<string, EvidenceField>
  logs: { scanned_sources: string[]; window: string }
  normalized_errors: unknown[]
  test_results: unknown[]
}

const SOURCE = 'bytefix.systeminformation'

function measured<T>(value: T, source = SOURCE): EvidenceField<T> {
  return { value, state: 'measured', source }
}

function unknown<T = null>(reason: string, source = SOURCE): EvidenceField<T | null> {
  return { value: null, state: 'unknown', source, reason }
}

function unsupported<T = null>(reason: string, source = SOURCE): EvidenceField<T | null> {
  return { value: null, state: 'unsupported', source, reason }
}

function text(value: string | undefined, reason: string): EvidenceField<string | null> {
  return value && value.trim().length > 0 ? measured(value) : unknown(reason)
}

function positiveNumber(value: number | undefined, reason: string): EvidenceField<number | null> {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? measured(value)
    : unknown(reason)
}

function dateNow(): string {
  return new Date().toISOString()
}

function storageEvidence(info: SystemInfo): Array<Record<string, unknown>> {
  return info.disk.map((disk) => {
    const smart = disk.smart
    const smartSource = `${SOURCE}.smart`
    const smartField = <T>(value: T | null | undefined, reason: string): EvidenceField<T | null> =>
      value !== undefined && value !== null && Number.isFinite(value as number)
        ? measured(value, smartSource)
        : unknown(reason, smartSource)

    return {
      dev: disk.device || 'unknown',
      type: disk.type,
      model: disk.name || 'Unknown',
      size_bytes: disk.size > 0 ? disk.size : null,
      state: disk.size > 0 ? 'measured' : 'unknown',
      source: SOURCE,
      serial: unknown('Storage serial is not exposed by the system scanner.'),
      smart: {
        critical_warning: smart
          ? measured(smart.healthy ? 0 : 1, smartSource)
          : unknown('SMART data unavailable.', smartSource),
        percentage_used: smart
          ? smartField(smart.wearLeveling, 'SMART wear percentage unavailable.')
          : unknown('SMART data unavailable.', smartSource),
        available_spare: unknown('SMART spare data unavailable.', smartSource),
        media_errors: smart
          ? smartField(smart.uncorrectableSectors, 'SMART media-error data unavailable.')
          : unknown('SMART data unavailable.', smartSource),
        power_on_hours: smart
          ? smartField(smart.powerOnHours, 'SMART power-on hours unavailable.')
          : unknown('SMART data unavailable.', smartSource),
        unsafe_shutdowns: unknown('SMART unsafe-shutdown data unavailable.', smartSource),
        temp_c: smart
          ? smartField(smart.temperature, 'SMART temperature unavailable.')
          : unknown('SMART data unavailable.', smartSource),
        pending_sectors: smart
          ? smartField(smart.pendingSectors, 'SMART pending-sector data unavailable.')
          : unknown('SMART data unavailable.', smartSource),
        udma_crc: smart
          ? smartField(smart.attributes.find((item) => /crc/i.test(item.name))?.raw, 'SMART CRC data unavailable.')
          : unknown('SMART data unavailable.', smartSource)
      },
      selftest: unknown('SMART self-test result is not exposed by the system scanner.')
    }
  })
}

export function toEvidenceBundle(
  info: SystemInfo,
  metrics: SystemMetrics,
  options: { uploadConsent?: boolean; caseId?: string } = {}
): EvidenceBundle {
  const cpuTemperature = positiveNumber(info.cpu.temperature, 'CPU temperature sensor unavailable.')
  const batteryPresent = measured(info.battery.hasBattery)
  const noBatteryReason = 'No battery is present.'
  const designWh = positiveNumber(info.battery.designCapacity, noBatteryReason)
  const fullWh = positiveNumber(info.battery.currentCapacity, noBatteryReason)
  const wear = info.battery.designCapacity > 0 && info.battery.currentCapacity >= 0
    ? measured(Math.max(0, Math.round((1 - info.battery.currentCapacity / info.battery.designCapacity) * 100)))
    : unknown('Battery capacity data unavailable.')
  const memoryTotal = positiveNumber(info.memory.total, 'Memory total unavailable.')
  const cpuModel = text(info.cpu.brand || info.cpu.manufacturer, 'CPU model unavailable.')
  const hostName = text(info.os.hostname, 'Hostname unavailable.')
  const installedOs = text(
    [info.os.distro, info.os.release].filter(Boolean).join(' ').trim(),
    'Operating-system identification unavailable.'
  )

  return {
    schema_version: '1.0.0',
    case_id: options.caseId || randomUUID(),
    captured_at: dateNow(),
    agent: {
      name: 'bytefix',
      version: '1.0.0',
      platform: info.os.platform || process.platform
    },
    consent: {
      upload: options.uploadConsent === true,
      redaction_profile: 'default'
    },
    host: {
      vendor: text(info.cpu.manufacturer, 'System vendor unavailable.'),
      product: unknown('System product is not exposed by the scanner.'),
      serial: unknown('System serial is not collected.'),
      board: unknown('Board identity is not exposed by the scanner.'),
      chassis_type: unknown('Chassis type is not exposed by the scanner.'),
      hostname: hostName
    },
    firmware: {
      bios_vendor: unknown('BIOS vendor is not exposed by the scanner.'),
      bios_version: unknown('BIOS version is not exposed by the scanner.'),
      bios_date: unknown('BIOS date is not exposed by the scanner.'),
      secure_boot: unknown('Secure Boot state is not exposed by the scanner.'),
      uefi: unknown('UEFI state is not exposed by the scanner.'),
      fwupd_updates_available: unsupported('Firmware update checks are not part of this evidence adapter.')
    },
    cpu: {
      model: cpuModel,
      cores: positiveNumber(info.cpu.physicalCores || info.cpu.cores, 'CPU core count unavailable.'),
      threads: positiveNumber(info.cpu.cores, 'CPU thread count unavailable.'),
      max_mhz: positiveNumber(info.cpu.speed * 1000, 'CPU frequency unavailable.'),
      microcode: unsupported('CPU microcode is not exposed by the scanner.'),
      vulnerabilities: unsupported('CPU vulnerability status is not exposed by the scanner.'),
      mce_memory_errors: unsupported('Machine-check telemetry is not exposed by the scanner.')
    },
    memory: {
      total_bytes: memoryTotal,
      modules: [],
      ecc: unsupported('Memory-module and ECC details are not exposed by the scanner.'),
      edac_corrected: unsupported('EDAC corrected-error telemetry is not exposed by the scanner.'),
      edac_uncorrected: unsupported('EDAC uncorrected-error telemetry is not exposed by the scanner.')
    },
    storage: storageEvidence(info),
    graphics: info.graphics.controllers.map((controller) => ({
      vendor: controller.vendor || 'Unknown',
      model: controller.model || 'Unknown',
      driver: controller.driverVersion || 'Unknown',
      state: controller.model ? 'measured' : 'unknown',
      source: SOURCE
    })),
    network: info.network.map((network) => ({
      type: network.type || 'Unknown',
      vendor: 'Unknown',
      model: network.iface || 'Unknown',
      mac: text(network.mac, 'MAC address unavailable.'),
      state: network.iface ? 'measured' : 'unknown',
      source: SOURCE
    })),
    usb: [],
    pci: [],
    sensors: {
      cpu_temp_c: cpuTemperature,
      fan_rpm: metrics.fanRPM > 0
        ? [{ name: 'estimated', value: metrics.fanRPM, state: 'vendor_estimated', source: 'bytefix.ai-metrics' }]
        : []
    },
    battery: {
      present: batteryPresent,
      design_wh: info.battery.hasBattery ? designWh : unsupported(noBatteryReason),
      full_wh: info.battery.hasBattery ? fullWh : unsupported(noBatteryReason),
      wear_pct: info.battery.hasBattery ? wear : unsupported(noBatteryReason),
      cycle_count: info.battery.hasBattery
        ? positiveNumber(info.battery.cycleCount, 'Battery cycle count unavailable.')
        : unsupported(noBatteryReason)
    },
    os: {
      installed_os: installedOs,
      boot_mode: unknown('Boot mode is not exposed by the scanner.')
    },
    logs: {
      scanned_sources: [],
      window: `captured_at:${dateNow()}`
    },
    normalized_errors: [],
    test_results: []
  }
}
