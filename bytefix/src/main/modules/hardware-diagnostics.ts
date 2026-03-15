import { execFileSync } from 'child_process'
import { platform, totalmem, freemem, cpus } from 'os'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('hardware-diagnostics')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'
const isLinux = platform() === 'linux'

// ============================================================
// SMART Disk Analysis (Deep)
// ============================================================
interface SmartDeepResult {
  device: string
  model: string
  serial: string
  firmware: string
  healthy: boolean
  temperature: number
  powerOnHours: number
  reallocatedSectors: number
  pendingSectors: number
  uncorrectableSectors: number
  wearLeveling: number
  mediaErrors: number
  powerCycleCount: number
  totalBytesWritten: number
  predictedFailure: boolean
  failureReason: string[]
  attributes: SmartDeepAttribute[]
}

interface SmartDeepAttribute {
  id: number
  name: string
  value: number
  worst: number
  threshold: number
  raw: string
  status: 'ok' | 'warning' | 'critical'
  interpretation: string
}

async function runDeepSmartAnalysis(): Promise<SmartDeepResult[]> {
  const results: SmartDeepResult[] = []

  try {
    const disks = await si.diskLayout()

    for (const disk of disks) {
      const device = disk.device || ''
      if (!device) continue

      const result: SmartDeepResult = {
        device,
        model: disk.name || 'Unknown',
        serial: disk.serialNum || '',
        firmware: disk.firmwareRevision || '',
        healthy: true,
        temperature: disk.temperature || 0,
        powerOnHours: 0,
        reallocatedSectors: 0,
        pendingSectors: 0,
        uncorrectableSectors: 0,
        wearLeveling: 100,
        mediaErrors: 0,
        powerCycleCount: 0,
        totalBytesWritten: 0,
        predictedFailure: false,
        failureReason: [],
        attributes: []
      }

      // Try smartctl for detailed data
      try {
        const output = execFileSync('smartctl', ['-a', device, '--json'], {
          timeout: 30000, encoding: 'utf8'
        })
        const data = JSON.parse(output)

        result.healthy = data?.smart_status?.passed ?? true
        result.temperature = data?.temperature?.current ?? disk.temperature ?? 0
        result.powerOnHours = data?.power_on_time?.hours ?? 0
        result.powerCycleCount = data?.power_cycle_count ?? 0

        // Parse ATA SMART attributes
        const attrs = data?.ata_smart_attributes?.table || []
        for (const attr of attrs) {
          const rawVal = typeof attr.raw?.value === 'number' ? attr.raw.value : 0
          const safeThresh = typeof attr.thresh === 'number' ? attr.thresh : 0
          const safeValue = typeof attr.value === 'number' ? attr.value : 0

          const smartAttr: SmartDeepAttribute = {
            id: attr.id ?? 0,
            name: attr.name ?? `Attribute ${attr.id}`,
            value: safeValue,
            worst: typeof attr.worst === 'number' ? attr.worst : 0,
            threshold: safeThresh,
            raw: String(attr.raw?.value ?? ''),
            status: safeValue <= safeThresh && safeThresh > 0 ? 'critical' : 'ok',
            interpretation: ''
          }

          // Interpret key attributes
          switch (attr.id) {
            case 5: // Reallocated Sectors Count
              result.reallocatedSectors = rawVal
              if (rawVal > 0) {
                smartAttr.status = rawVal > 100 ? 'critical' : 'warning'
                smartAttr.interpretation = `${rawVal} bad sectors remapped. ${rawVal > 100 ? 'Drive is failing!' : 'Monitor closely.'}`
                if (rawVal > 100) {
                  result.predictedFailure = true
                  result.failureReason.push(`High reallocated sectors: ${rawVal}`)
                }
              }
              break
            case 9: // Power On Hours
              result.powerOnHours = rawVal
              smartAttr.interpretation = `Drive has been powered for ${rawVal} hours (${(rawVal / 24 / 365).toFixed(1)} years)`
              if (rawVal > 40000) {
                smartAttr.status = 'warning'
                smartAttr.interpretation += '. Consider replacement.'
              }
              break
            case 12: // Power Cycle Count
              result.powerCycleCount = rawVal
              break
            case 177: // Wear Leveling Count (SSD)
            case 231: // SSD Life Left
              result.wearLeveling = safeValue
              if (safeValue < 10) {
                smartAttr.status = 'critical'
                smartAttr.interpretation = `SSD life remaining: ${safeValue}%. Replace soon!`
                result.predictedFailure = true
                result.failureReason.push(`SSD wear critical: ${safeValue}% life remaining`)
              } else if (safeValue < 30) {
                smartAttr.status = 'warning'
                smartAttr.interpretation = `SSD life remaining: ${safeValue}%. Plan replacement.`
              }
              break
            case 187: // Reported Uncorrectable Errors
              result.uncorrectableSectors = rawVal
              if (rawVal > 0) {
                smartAttr.status = rawVal > 50 ? 'critical' : 'warning'
                smartAttr.interpretation = `${rawVal} uncorrectable errors detected`
              }
              break
            case 188: // Command Timeout
              if (rawVal > 0) {
                smartAttr.status = 'warning'
                smartAttr.interpretation = `${rawVal} command timeouts - possible cable or controller issue`
              }
              break
            case 196: // Reallocated Event Count
              if (rawVal > 0) {
                smartAttr.status = rawVal > 50 ? 'critical' : 'warning'
                smartAttr.interpretation = `${rawVal} reallocation events`
              }
              break
            case 197: // Current Pending Sectors
              result.pendingSectors = rawVal
              if (rawVal > 0) {
                smartAttr.status = rawVal > 10 ? 'critical' : 'warning'
                smartAttr.interpretation = `${rawVal} sectors waiting for reallocation`
                if (rawVal > 10) {
                  result.predictedFailure = true
                  result.failureReason.push(`High pending sectors: ${rawVal}`)
                }
              }
              break
            case 198: // Offline Uncorrectable
              if (rawVal > 0) {
                smartAttr.status = 'critical'
                smartAttr.interpretation = `${rawVal} uncorrectable sectors during offline scan`
                result.predictedFailure = true
                result.failureReason.push(`Uncorrectable sectors: ${rawVal}`)
              }
              break
            case 199: // UDMA CRC Error Count
              if (rawVal > 0) {
                smartAttr.status = rawVal > 100 ? 'warning' : 'ok'
                smartAttr.interpretation = `${rawVal} CRC errors - check SATA cable`
              }
              break
            case 241: // Total LBAs Written
              result.totalBytesWritten = rawVal * 512
              break
            default:
              if (safeValue <= safeThresh && safeThresh > 0) {
                smartAttr.interpretation = 'Below threshold - attention needed'
              }
          }

          result.attributes.push(smartAttr)
        }

        // NVMe specific
        const nvmeHealth = data?.nvme_smart_health_information_log
        if (nvmeHealth) {
          result.wearLeveling = 100 - (nvmeHealth.percentage_used ?? 0)
          result.temperature = nvmeHealth.temperature ?? result.temperature
          result.mediaErrors = nvmeHealth.media_errors ?? 0
          result.powerOnHours = nvmeHealth.power_on_hours ?? result.powerOnHours
          result.powerCycleCount = nvmeHealth.power_cycles ?? result.powerCycleCount

          if (nvmeHealth.percentage_used > 90) {
            result.predictedFailure = true
            result.failureReason.push(`NVMe ${nvmeHealth.percentage_used}% used`)
          }
          if (nvmeHealth.media_errors > 0) {
            result.predictedFailure = true
            result.failureReason.push(`NVMe media errors: ${nvmeHealth.media_errors}`)
          }
        }
      } catch {
        // smartctl not available or failed
        logger.warn(`smartctl failed for ${device}`)
      }

      results.push(result)
    }
  } catch (err) {
    logger.error('Failed to enumerate disks', err)
  }

  return results
}

// ============================================================
// Memory (RAM) Diagnostics
// ============================================================
interface MemoryDiagResult {
  totalGB: number
  freeGB: number
  usedPercent: number
  slots: MemorySlot[]
  hasErrors: boolean
  errorDetails: string[]
  recommendations: string[]
}

interface MemorySlot {
  bank: string
  type: string
  sizeMB: number
  speed: number
  manufacturer: string
  serial: string
  voltage: number
}

async function runMemoryDiagnostics(): Promise<MemoryDiagResult> {
  const totalGB = Math.round(totalmem() / (1024 ** 3) * 10) / 10
  const freeGB = Math.round(freemem() / (1024 ** 3) * 10) / 10
  const usedPercent = Math.round(((totalGB - freeGB) / totalGB) * 100)
  const slots: MemorySlot[] = []
  const errorDetails: string[] = []
  const recommendations: string[] = []
  let hasErrors = false

  // Get detailed memory layout
  try {
    const memLayout = await si.memLayout()
    for (const mod of memLayout) {
      slots.push({
        bank: mod.bank || 'Unknown',
        type: mod.type || 'Unknown',
        sizeMB: Math.round((mod.size || 0) / (1024 ** 2)),
        speed: mod.clockSpeed || 0,
        manufacturer: mod.manufacturer || 'Unknown',
        serial: mod.serialNum || '',
        voltage: mod.voltageConfigured || 0
      })
    }
  } catch (err) {
    logger.warn('Failed to get memory layout', err)
  }

  // Check Windows memory diagnostics log
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-WinEvent -LogName "Microsoft-Windows-MemoryDiagnostics-Results/Debug" -MaxEvents 5 -ErrorAction SilentlyContinue | Select-Object TimeCreated,Message | ConvertTo-Json'
      ], { timeout: 15000, encoding: 'utf8' })

      if (output.trim()) {
        const events = JSON.parse(output)
        const eventArr = Array.isArray(events) ? events : [events]
        for (const ev of eventArr) {
          if (ev.Message && /error|fault|fail/i.test(ev.Message)) {
            hasErrors = true
            errorDetails.push(`Memory diagnostic event: ${ev.Message}`)
          }
        }
      }
    } catch { /* no diagnostic results */ }
  }

  // Linux: Check for memory errors in dmesg
  if (isLinux) {
    try {
      const dmesg = execFileSync('dmesg', [], {
        timeout: 5000, encoding: 'utf8'
      })
      const memErrors = dmesg.split('\n').filter(line =>
        /memory|edac|mce|ecc/i.test(line) && /error|fail|fault|corrected/i.test(line)
      )
      if (memErrors.length > 0) {
        hasErrors = true
        errorDetails.push(...memErrors.slice(0, 5))
      }
    } catch { /* dmesg may need root */ }

    // Check EDAC (Error Detection and Correction)
    try {
      const edacPath = '/sys/devices/system/edac/mc'
      if (existsSync(edacPath)) {
        const controllers = readdirSync(edacPath).filter(f => f.startsWith('mc'))
        for (const mc of controllers) {
          const cePath = join(edacPath, mc, 'ce_count')
          const uePath = join(edacPath, mc, 'ue_count')
          if (existsSync(cePath)) {
            const ce = parseInt(readFileSync(cePath, 'utf8').trim())
            if (ce > 0) {
              errorDetails.push(`${mc}: ${ce} corrected ECC errors`)
            }
          }
          if (existsSync(uePath)) {
            const ue = parseInt(readFileSync(uePath, 'utf8').trim())
            if (ue > 0) {
              hasErrors = true
              errorDetails.push(`${mc}: ${ue} UNCORRECTABLE ECC errors - RAM may be faulty`)
            }
          }
        }
      }
    } catch { /* EDAC not available */ }
  }

  // macOS: Check system.log for memory errors
  if (isMac) {
    try {
      const output = execFileSync('log', [
        'show', '--predicate', 'eventMessage CONTAINS "memory" AND eventMessage CONTAINS "error"',
        '--last', '1d', '--style', 'compact'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const lines = output.split('\n').filter(l => l.trim()).slice(0, 5)
        if (lines.length > 0) {
          hasErrors = true
          errorDetails.push(...lines)
        }
      }
    } catch { /* log command may fail */ }
  }

  // Recommendations
  if (totalGB < 4) {
    recommendations.push('System has less than 4GB RAM. Upgrade to at least 8GB for smooth operation.')
  } else if (totalGB < 8) {
    recommendations.push('Consider upgrading to 8GB or 16GB RAM for better multitasking.')
  }

  if (usedPercent > 90) {
    recommendations.push('Memory usage is very high. Close unnecessary applications or consider upgrading RAM.')
  } else if (usedPercent > 75) {
    recommendations.push('Memory usage is elevated. Monitor for potential issues.')
  }

  if (slots.length > 0) {
    const speeds = slots.map(s => s.speed).filter(s => s > 0)
    if (speeds.length > 1 && new Set(speeds).size > 1) {
      recommendations.push('Mixed RAM speeds detected. All modules should match for optimal performance.')
    }
  }

  if (hasErrors) {
    recommendations.push('Memory errors detected. Run Windows Memory Diagnostic or MemTest86 for thorough testing.')
  }

  return { totalGB, freeGB, usedPercent, slots, hasErrors, errorDetails, recommendations }
}

// ============================================================
// CPU Stress Test (Safe - thermal gated)
// ============================================================
interface StressTestResult {
  ran: boolean
  durationSeconds: number
  startTemp: number
  peakTemp: number
  endTemp: number
  thermalGated: boolean
  passed: boolean
  details: string[]
}

export async function runCpuStressTest(durationSeconds: number = 30): Promise<StressTestResult> {
  const result: StressTestResult = {
    ran: false,
    durationSeconds: 0,
    startTemp: 0,
    peakTemp: 0,
    endTemp: 0,
    thermalGated: false,
    passed: true,
    details: []
  }

  // Clamp duration to safe range
  const safeDuration = Math.min(Math.max(durationSeconds, 10), 120)

  // Thermal gate: Don't run if already too hot
  try {
    const cpuTemp = await si.cpuTemperature()
    result.startTemp = cpuTemp.main || 0

    if (result.startTemp > 80) {
      result.thermalGated = true
      result.details.push(`Stress test BLOCKED: CPU already at ${result.startTemp}C (limit: 80C)`)
      result.details.push('Cool the system down before running stress tests')
      return result
    }
  } catch {
    result.details.push('Could not read CPU temperature - proceeding with caution')
  }

  result.ran = true
  result.durationSeconds = safeDuration
  result.details.push(`Running ${safeDuration}s CPU stress test with ${cpus().length} threads`)

  // Run stress using built-in methods (no external tool needed)
  const startTime = Date.now()
  const workers: NodeJS.Timeout[] = []

  // Create CPU-intensive work on all cores
  const numCores = cpus().length
  const sharedAbort = { value: false }

  const workerPromises = Array.from({ length: numCores }, () =>
    new Promise<void>((resolve) => {
      const doWork = (): void => {
        if (sharedAbort.value || Date.now() - startTime > safeDuration * 1000) {
          resolve()
          return
        }
        // CPU-intensive math
        let x = 0
        for (let i = 0; i < 1000000; i++) {
          x += Math.sqrt(i) * Math.sin(i)
        }
        // Yield to event loop then continue
        const timer = setTimeout(doWork, 0)
        workers.push(timer)
      }
      doWork()
    })
  )

  // Monitor temperature during test
  const tempMonitor = setInterval(async () => {
    try {
      const temp = await si.cpuTemperature()
      if (temp.main > result.peakTemp) result.peakTemp = temp.main
      // Emergency stop if too hot
      if (temp.main > 95) {
        sharedAbort.value = true
        result.details.push(`Emergency stop: CPU reached ${temp.main}C`)
        result.passed = false
      }
    } catch { /* ignore */ }
  }, 2000)

  // Wait for stress to complete
  await Promise.all(workerPromises)
  clearInterval(tempMonitor)
  workers.forEach(w => clearTimeout(w))

  // Read final temperature
  try {
    const finalTemp = await si.cpuTemperature()
    result.endTemp = finalTemp.main || 0
  } catch { /* ignore */ }

  if (result.peakTemp === 0) result.peakTemp = result.startTemp

  result.details.push(`Start temp: ${result.startTemp}C`)
  result.details.push(`Peak temp: ${result.peakTemp}C`)
  result.details.push(`End temp: ${result.endTemp}C`)
  result.details.push(`Temperature rise: ${(result.peakTemp - result.startTemp).toFixed(1)}C`)

  if (result.peakTemp > 95) {
    result.passed = false
    result.details.push('FAILED: CPU exceeded 95C during test - cooling is insufficient')
  } else if (result.peakTemp > 85) {
    result.details.push('WARNING: CPU reached high temperatures - consider improving cooling')
  } else {
    result.details.push('PASSED: Temperatures stayed within acceptable range')
  }

  return result
}

// ============================================================
// POST Code Guide
// ============================================================
interface PostCodeInfo {
  code: string
  meaning: string
  category: 'cpu' | 'memory' | 'gpu' | 'storage' | 'boot' | 'other'
  severity: 'info' | 'warning' | 'critical'
  fix: string
}

function getPostCodeGuide(): PostCodeInfo[] {
  return [
    // Common BIOS beep codes (AMI/Award/Phoenix)
    { code: '1 short beep', meaning: 'System OK - POST passed', category: 'boot', severity: 'info', fix: 'No action needed' },
    { code: '2 short beeps', meaning: 'POST error - check display', category: 'gpu', severity: 'warning', fix: 'Check monitor cable and video card seating' },
    { code: '3 short beeps', meaning: 'Base memory failure (first 64KB)', category: 'memory', severity: 'critical', fix: 'Reseat RAM. Try one stick at a time. Replace if faulty.' },
    { code: '4 short beeps', meaning: 'System timer failure', category: 'other', severity: 'critical', fix: 'Replace motherboard or CMOS battery' },
    { code: '5 short beeps', meaning: 'CPU failure', category: 'cpu', severity: 'critical', fix: 'Reseat CPU. Check for bent pins. May need replacement.' },
    { code: '6 short beeps', meaning: 'Keyboard controller failure', category: 'other', severity: 'warning', fix: 'Try different keyboard. Check PS/2 port.' },
    { code: '7 short beeps', meaning: 'Virtual mode exception error', category: 'cpu', severity: 'critical', fix: 'CPU or motherboard issue. Try BIOS reset.' },
    { code: '8 short beeps', meaning: 'Display memory read/write failure', category: 'gpu', severity: 'critical', fix: 'Reseat GPU. Replace if error persists.' },
    { code: '9 short beeps', meaning: 'ROM BIOS checksum error', category: 'boot', severity: 'critical', fix: 'BIOS chip failure. Try BIOS recovery/reflash.' },
    { code: '10 short beeps', meaning: 'CMOS shutdown register error', category: 'other', severity: 'warning', fix: 'Replace CMOS battery. Reset BIOS.' },
    { code: '1 long + 1 short', meaning: 'Motherboard failure', category: 'other', severity: 'critical', fix: 'Check power connections. May need motherboard replacement.' },
    { code: '1 long + 2 short', meaning: 'Video card failure', category: 'gpu', severity: 'critical', fix: 'Reseat GPU. Try different slot. Replace GPU.' },
    { code: '1 long + 3 short', meaning: 'Video card failure (EGA)', category: 'gpu', severity: 'critical', fix: 'Reseat GPU. Replace if needed.' },
    { code: 'Continuous beeping', meaning: 'Memory or video issue', category: 'memory', severity: 'critical', fix: 'Reseat RAM and GPU. Check for power issues.' },
    { code: 'No beep', meaning: 'Power supply, motherboard, or CPU dead', category: 'other', severity: 'critical', fix: 'Check PSU. Check 24-pin and CPU power connectors. Test with known good PSU.' },

    // Dell specific
    { code: 'Dell: 1-3-2', meaning: 'Memory failure', category: 'memory', severity: 'critical', fix: 'Reseat RAM modules. Try slots one at a time.' },
    { code: 'Dell: 2-1-1', meaning: 'CPU register failure', category: 'cpu', severity: 'critical', fix: 'CPU may be faulty. Check seating and thermal paste.' },

    // HP specific
    { code: 'HP: 2 beeps', meaning: 'BIOS corruption detected', category: 'boot', severity: 'critical', fix: 'Try BIOS recovery (Win+B on startup for HP)' },
    { code: 'HP: 3 beeps', meaning: 'Memory module error', category: 'memory', severity: 'critical', fix: 'Reseat RAM. Ensure compatible memory modules.' },
    { code: 'HP: 4 beeps', meaning: 'Graphics/video error', category: 'gpu', severity: 'critical', fix: 'Reseat GPU. Check display cable.' },
    { code: 'HP: 5 beeps', meaning: 'Pre-video memory error', category: 'memory', severity: 'critical', fix: 'Memory failure before video init. Replace RAM.' },

    // Lenovo specific
    { code: 'Lenovo: 1 beep + blank screen', meaning: 'LCD failure or GPU', category: 'gpu', severity: 'critical', fix: 'Connect external monitor. If works, LCD cable or panel issue.' },
    { code: 'Lenovo: 3 beeps + pause + 3', meaning: 'Memory not detected', category: 'memory', severity: 'critical', fix: 'Reseat RAM. Check if compatible.' }
  ]
}

// ============================================================
// System Uptime & Boot Analysis
// ============================================================
interface BootAnalysis {
  uptimeDays: number
  uptimeHours: number
  lastBootTime: string
  bootTimeSeconds: number
  needsRestart: boolean
  restartReason: string[]
}

async function analyzeBootStatus(): Promise<BootAnalysis> {
  const uptimeSeconds = (await si.time()).uptime || 0
  const uptimeDays = Math.floor(uptimeSeconds / 86400)
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600)
  const restartReason: string[] = []
  let bootTimeSeconds = 0
  let lastBootTime = ''

  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        '(Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime | Get-Date -Format "yyyy-MM-dd HH:mm:ss"'
      ], { timeout: 10000, encoding: 'utf8' })
      lastBootTime = output.trim()
    } catch { /* ignore */ }

    // Get boot time from Event Log
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-WinEvent -FilterHashtable @{LogName="System";Id=12} -MaxEvents 1 -ErrorAction SilentlyContinue | Select-Object TimeCreated | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })
      if (output.trim()) {
        const ev = JSON.parse(output)
        if (ev.TimeCreated) lastBootTime = ev.TimeCreated
      }
    } catch { /* ignore */ }
  } else {
    try {
      const output = execFileSync('uptime', ['-s'], { timeout: 5000, encoding: 'utf8' })
      lastBootTime = output.trim()
    } catch { /* ignore */ }
  }

  const needsRestart = uptimeDays > 7
  if (uptimeDays > 30) {
    restartReason.push(`System has been running for ${uptimeDays} days. A restart is strongly recommended.`)
  } else if (uptimeDays > 7) {
    restartReason.push(`System has been running for ${uptimeDays} days. Consider restarting for better performance.`)
  }

  return {
    uptimeDays,
    uptimeHours,
    lastBootTime,
    bootTimeSeconds,
    needsRestart,
    restartReason
  }
}

// ============================================================
// Main Diagnostics Entry Point
// ============================================================
export async function runHardwareDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. Deep SMART Analysis
  const smartResults = await runDeepSmartAnalysis()

  for (const disk of smartResults) {
    if (disk.predictedFailure) {
      results.push({
        id: `hw-disk-fail-${Date.now()}`,
        module: 'hardware-diagnostics',
        category: 'Disk Health',
        title: `DISK FAILURE PREDICTED: ${disk.model}`,
        severity: 'critical',
        description: `Drive ${disk.device} (${disk.model}) shows signs of imminent failure. Back up data immediately!`,
        details: [
          `Model: ${disk.model}`,
          `Serial: ${disk.serial}`,
          `Power-on: ${disk.powerOnHours} hours (${(disk.powerOnHours / 24 / 365).toFixed(1)} years)`,
          `Reallocated sectors: ${disk.reallocatedSectors}`,
          `Pending sectors: ${disk.pendingSectors}`,
          `Temperature: ${disk.temperature}C`,
          ...disk.failureReason
        ],
        fixAvailable: false,
        fixDescription: 'Replace drive immediately. Back up all data.',
        fixRisk: 'none',
        autoFixable: false,
        timestamp: Date.now()
      })
    } else if (!disk.healthy) {
      results.push({
        id: `hw-disk-unhealthy-${Date.now()}`,
        module: 'hardware-diagnostics',
        category: 'Disk Health',
        title: `Disk health warning: ${disk.model}`,
        severity: 'warning',
        description: `Drive ${disk.device} SMART status indicates potential issues`,
        details: [
          `Model: ${disk.model}`,
          `Power-on: ${disk.powerOnHours} hours`,
          `Reallocated: ${disk.reallocatedSectors}`,
          `Pending: ${disk.pendingSectors}`,
          `Temperature: ${disk.temperature}C`
        ],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp: Date.now()
      })
    } else {
      results.push({
        id: `hw-disk-ok-${Date.now()}`,
        module: 'hardware-diagnostics',
        category: 'Disk Health',
        title: `Disk healthy: ${disk.model}`,
        severity: 'healthy',
        description: `Drive ${disk.device} SMART status is good`,
        details: [
          `Model: ${disk.model} | Serial: ${disk.serial}`,
          `Power-on: ${disk.powerOnHours} hours | Temp: ${disk.temperature}C`,
          `SSD Life: ${disk.wearLeveling}%`,
          `Power cycles: ${disk.powerCycleCount}`
        ],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp: Date.now()
      })
    }

    // Disk temperature
    if (disk.temperature > 60) {
      results.push({
        id: `hw-disk-temp-${Date.now()}`,
        module: 'hardware-diagnostics',
        category: 'Disk Temperature',
        title: `Disk temperature high: ${disk.temperature}C`,
        severity: 'warning',
        description: `${disk.model} is running at ${disk.temperature}C. Normal range is 25-50C.`,
        details: ['Ensure adequate airflow around the drive', 'Check if dust is blocking ventilation'],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp: Date.now()
      })
    }
  }

  if (smartResults.length === 0) {
    results.push({
      id: `hw-disk-none-${Date.now()}`,
      module: 'hardware-diagnostics',
      category: 'Disk Health',
      title: 'No disk SMART data available',
      severity: 'info',
      description: 'Could not read disk health data. smartctl may not be installed or admin access is required.',
      details: ['Install smartmontools for disk health monitoring'],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // 2. Memory Diagnostics
  const memResult = await runMemoryDiagnostics()

  if (memResult.hasErrors) {
    results.push({
      id: `hw-mem-error-${Date.now()}`,
      module: 'hardware-diagnostics',
      category: 'Memory',
      title: 'Memory errors detected',
      severity: 'critical',
      description: 'System memory (RAM) errors have been detected. This can cause crashes, data corruption, and blue screens.',
      details: [
        `Total RAM: ${memResult.totalGB}GB`,
        `Slots: ${memResult.slots.length}`,
        ...memResult.errorDetails,
        ...memResult.recommendations
      ],
      fixAvailable: false,
      fixDescription: 'Run MemTest86 for thorough testing. Replace faulty RAM modules.',
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  } else {
    results.push({
      id: `hw-mem-ok-${Date.now()}`,
      module: 'hardware-diagnostics',
      category: 'Memory',
      title: `RAM: ${memResult.totalGB}GB (${memResult.usedPercent}% used)`,
      severity: memResult.usedPercent > 90 ? 'warning' : 'healthy',
      description: `System has ${memResult.totalGB}GB RAM with ${memResult.freeGB}GB free`,
      details: [
        `Total: ${memResult.totalGB}GB | Free: ${memResult.freeGB}GB | Used: ${memResult.usedPercent}%`,
        `Slots populated: ${memResult.slots.length}`,
        ...memResult.slots.map(s => `${s.bank}: ${s.sizeMB}MB ${s.type} @ ${s.speed}MHz (${s.manufacturer})`),
        ...memResult.recommendations
      ],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // 3. Boot Analysis
  const boot = await analyzeBootStatus()

  if (boot.needsRestart) {
    results.push({
      id: `hw-uptime-${Date.now()}`,
      module: 'hardware-diagnostics',
      category: 'System Uptime',
      title: `System uptime: ${boot.uptimeDays} days`,
      severity: boot.uptimeDays > 30 ? 'warning' : 'info',
      description: `System has been running for ${boot.uptimeDays} days and ${boot.uptimeHours} hours`,
      details: [
        `Last boot: ${boot.lastBootTime || 'Unknown'}`,
        ...boot.restartReason
      ],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // 4. POST Code Reference
  results.push({
    id: `hw-post-guide-${Date.now()}`,
    module: 'hardware-diagnostics',
    category: 'POST Codes',
    title: 'BIOS POST Code Reference Guide',
    severity: 'info',
    description: 'Reference guide for interpreting BIOS beep codes during startup. Useful when system fails to boot.',
    details: getPostCodeGuide().map(p => `${p.code}: ${p.meaning} [Fix: ${p.fix}]`),
    fixAvailable: false,
    fixRisk: 'none',
    autoFixable: false,
    timestamp: Date.now()
  })

  return results
}

// ============================================================
// Run MemTest (Guide user to external tool)
// ============================================================
export async function guideMemTest(): Promise<FixResult> {
  const details: string[] = []
  const changes: FixChange[] = []

  if (isWindows) {
    details.push('Option 1: Windows Memory Diagnostic (Built-in)')
    details.push('  Run: mdsched.exe → "Restart now and check for problems"')
    details.push('  The system will reboot and run memory tests automatically')
    details.push('')
    details.push('Option 2: MemTest86 (More thorough)')
    details.push('  1. Download from https://www.memtest86.com/download.htm')
    details.push('  2. Create bootable USB with the downloaded tool')
    details.push('  3. Boot from USB and let it run 4+ passes')
    details.push('  4. If errors found, note the failing address to identify the bad DIMM')

    // Try to launch Windows Memory Diagnostic
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Start-Process mdsched.exe -ErrorAction SilentlyContinue'
      ], { timeout: 5000 })
      details.push('')
      details.push('Windows Memory Diagnostic has been launched. Choose to restart now or schedule for next restart.')
      changes.push({ type: 'system', action: 'created', target: 'Memory Diagnostic scheduled' })
    } catch {
      details.push('')
      details.push('Could not launch Windows Memory Diagnostic. Run mdsched.exe manually as administrator.')
    }
  } else if (isMac) {
    details.push('macOS Memory Test:')
    details.push('  1. Apple Diagnostics: Shut down → Hold D while powering on')
    details.push('  2. For Intel Macs: Hold Option+D for internet-based diagnostics')
    details.push('  3. Apple Silicon Macs: Hold power button → click "Options" → Apple Diagnostics')
    details.push('  Reference codes: ADP000 = no issues, ADP001 = memory issue detected')
  } else {
    details.push('Linux Memory Testing Options:')
    details.push('  1. memtester (userspace, partial test):')
    details.push('     sudo memtester 1G 2  (test 1GB, 2 passes)')
    details.push('  2. MemTest86+ (thorough, bootable):')
    details.push('     Install: sudo apt install memtest86+')
    details.push('     Then reboot and select MemTest86+ from GRUB menu')
    details.push('  3. For servers: Check EDAC: cat /sys/devices/system/edac/mc/mc*/ce_count')
  }

  return {
    success: true,
    module: 'hardware-diagnostics',
    action: 'guide_memtest',
    description: 'Memory testing guide provided',
    details,
    changes,
    rollbackAvailable: false
  }
}
