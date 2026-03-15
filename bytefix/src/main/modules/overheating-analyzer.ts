import { execFileSync } from 'child_process'
import { platform } from 'os'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import si from 'systeminformation'
import { createLogger } from '../logger'
import type { DiagnosticResult, FixResult, FixChange } from '../../shared/types'

const logger = createLogger('overheating-analyzer')
const isWindows = platform() === 'win32'
const isMac = platform() === 'darwin'
const isLinux = platform() === 'linux'

// ============================================================
// Temperature Thresholds (Celsius)
// ============================================================
const TEMP_THRESHOLDS = {
  cpu: { warning: 75, critical: 90, shutdown: 100 },
  gpu: { warning: 80, critical: 95, shutdown: 105 },
  disk: { warning: 50, critical: 60, shutdown: 70 }
}

// ============================================================
// Temperature Reading
// ============================================================
interface ThermalReading {
  component: string
  sensor: string
  temperature: number
  maxTemperature: number
}

async function readTemperatures(): Promise<ThermalReading[]> {
  const readings: ThermalReading[] = []

  try {
    const cpuTemp = await si.cpuTemperature()

    if (cpuTemp.main > 0) {
      readings.push({
        component: 'CPU',
        sensor: 'Package',
        temperature: cpuTemp.main,
        maxTemperature: cpuTemp.max || cpuTemp.main
      })
    }

    if (cpuTemp.cores && cpuTemp.cores.length > 0) {
      cpuTemp.cores.forEach((temp, idx) => {
        if (temp > 0) {
          readings.push({
            component: 'CPU',
            sensor: `Core ${idx}`,
            temperature: temp,
            maxTemperature: temp
          })
        }
      })
    }
  } catch (err) {
    logger.warn('Failed to read CPU temperature via systeminformation', err)
  }

  // Linux: Read additional sensors from sysfs
  if (isLinux) {
    try {
      const hwmonPath = '/sys/class/hwmon'
      if (existsSync(hwmonPath)) {
        const hwmons = readdirSync(hwmonPath)
        for (const hwmon of hwmons) {
          const basePath = join(hwmonPath, hwmon)
          const namePath = join(basePath, 'name')
          const sensorName = existsSync(namePath)
            ? readFileSync(namePath, 'utf8').trim()
            : hwmon

          // Read all temp inputs
          for (let i = 1; i <= 16; i++) {
            const tempFile = join(basePath, `temp${i}_input`)
            if (existsSync(tempFile)) {
              try {
                const raw = readFileSync(tempFile, 'utf8').trim()
                const tempC = parseInt(raw) / 1000
                if (tempC > 0 && tempC < 150) {
                  const labelFile = join(basePath, `temp${i}_label`)
                  const label = existsSync(labelFile)
                    ? readFileSync(labelFile, 'utf8').trim()
                    : `Sensor ${i}`

                  // Avoid duplicates with systeminformation data
                  const isDuplicate = readings.some(
                    r => Math.abs(r.temperature - tempC) < 1 && r.component === 'CPU'
                  )
                  if (!isDuplicate) {
                    readings.push({
                      component: sensorName,
                      sensor: label,
                      temperature: tempC,
                      maxTemperature: tempC
                    })
                  }
                }
              } catch { /* skip unreadable sensor */ }
            }
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to read sysfs thermal data', err)
    }
  }

  // GPU temperature
  try {
    const graphics = await si.graphics()
    for (const ctrl of graphics.controllers) {
      if (ctrl.temperatureGpu && ctrl.temperatureGpu > 0) {
        readings.push({
          component: 'GPU',
          sensor: ctrl.model || 'GPU',
          temperature: ctrl.temperatureGpu,
          maxTemperature: ctrl.temperatureGpu
        })
      }
    }
  } catch (err) {
    logger.warn('Failed to read GPU temperature', err)
  }

  // Disk temperatures from SMART
  try {
    const disks = await si.diskLayout()
    for (const disk of disks) {
      if (disk.temperature && disk.temperature > 0) {
        readings.push({
          component: 'Disk',
          sensor: disk.name || disk.device || 'Disk',
          temperature: disk.temperature,
          maxTemperature: disk.temperature
        })
      }
    }
  } catch (err) {
    logger.warn('Failed to read disk temperatures', err)
  }

  return readings
}

// ============================================================
// Thermal Throttle Detection
// ============================================================
interface ThrottleStatus {
  isThrottling: boolean
  reason: string[]
  currentFreqMhz: number
  maxFreqMhz: number
  throttlePercent: number
}

async function detectThermalThrottle(): Promise<ThrottleStatus> {
  const status: ThrottleStatus = {
    isThrottling: false,
    reason: [],
    currentFreqMhz: 0,
    maxFreqMhz: 0,
    throttlePercent: 0
  }

  try {
    const cpu = await si.cpu()
    const cpuSpeed = await si.cpuCurrentSpeed()

    status.maxFreqMhz = cpu.speedMax * 1000 || cpu.speed * 1000
    status.currentFreqMhz = cpuSpeed.avg * 1000

    if (status.maxFreqMhz > 0 && status.currentFreqMhz > 0) {
      const ratio = status.currentFreqMhz / status.maxFreqMhz
      if (ratio < 0.7) {
        status.isThrottling = true
        status.throttlePercent = Math.round((1 - ratio) * 100)
        status.reason.push(`CPU running at ${Math.round(ratio * 100)}% of max frequency`)
      }
    }
  } catch (err) {
    logger.warn('Failed to check CPU throttle status', err)
  }

  // Linux: Check thermal_zone throttle state
  if (isLinux) {
    try {
      const thermalPath = '/sys/class/thermal'
      if (existsSync(thermalPath)) {
        const zones = readdirSync(thermalPath).filter(z => z.startsWith('thermal_zone'))
        for (const zone of zones) {
          const modePath = join(thermalPath, zone, 'mode')
          const typePath = join(thermalPath, zone, 'type')
          if (existsSync(typePath)) {
            const zoneType = readFileSync(typePath, 'utf8').trim()
            // Check trip points
            for (let i = 0; i <= 10; i++) {
              const tripTempPath = join(thermalPath, zone, `trip_point_${i}_temp`)
              const tripTypePath = join(thermalPath, zone, `trip_point_${i}_type`)
              if (existsSync(tripTempPath) && existsSync(tripTypePath)) {
                try {
                  const tripType = readFileSync(tripTypePath, 'utf8').trim()
                  const tripTemp = parseInt(readFileSync(tripTempPath, 'utf8').trim()) / 1000
                  const currentTemp = parseInt(
                    readFileSync(join(thermalPath, zone, 'temp'), 'utf8').trim()
                  ) / 1000

                  if (tripType === 'critical' && currentTemp >= tripTemp - 5) {
                    status.isThrottling = true
                    status.reason.push(
                      `${zoneType}: Near critical trip point (${currentTemp}C / ${tripTemp}C)`
                    )
                  }
                } catch { /* skip unreadable trip point */ }
              }
            }
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to check thermal zones', err)
    }
  }

  // Windows: Check for thermal throttling via WMI
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object InstanceName,CurrentTemperature | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const zones = JSON.parse(output)
        const zoneArr = Array.isArray(zones) ? zones : [zones]
        for (const zone of zoneArr) {
          if (zone.CurrentTemperature) {
            const tempC = (zone.CurrentTemperature - 2732) / 10
            if (tempC > TEMP_THRESHOLDS.cpu.critical) {
              status.isThrottling = true
              status.reason.push(`WMI thermal zone at ${tempC.toFixed(1)}C`)
            }
          }
        }
      }
    } catch { /* WMI not available */ }
  }

  return status
}

// ============================================================
// Fan Speed Reading
// ============================================================
interface FanInfo {
  name: string
  speed: number // RPM
  maxSpeed: number
  percent: number
}

async function readFanSpeeds(): Promise<FanInfo[]> {
  const fans: FanInfo[] = []

  // Linux: Read from sysfs hwmon
  if (isLinux) {
    try {
      const hwmonPath = '/sys/class/hwmon'
      if (existsSync(hwmonPath)) {
        const hwmons = readdirSync(hwmonPath)
        for (const hwmon of hwmons) {
          const basePath = join(hwmonPath, hwmon)
          for (let i = 1; i <= 8; i++) {
            const fanFile = join(basePath, `fan${i}_input`)
            if (existsSync(fanFile)) {
              try {
                const rpm = parseInt(readFileSync(fanFile, 'utf8').trim())
                const maxFile = join(basePath, `fan${i}_max`)
                const maxRpm = existsSync(maxFile)
                  ? parseInt(readFileSync(maxFile, 'utf8').trim())
                  : 5000 // reasonable default

                const labelFile = join(basePath, `fan${i}_label`)
                const label = existsSync(labelFile)
                  ? readFileSync(labelFile, 'utf8').trim()
                  : `Fan ${i}`

                fans.push({
                  name: label,
                  speed: rpm,
                  maxSpeed: maxRpm,
                  percent: maxRpm > 0 ? Math.round((rpm / maxRpm) * 100) : 0
                })
              } catch { /* skip unreadable fan */ }
            }
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to read fan speeds from sysfs', err)
    }
  }

  // macOS: SMC fan data
  if (isMac) {
    try {
      const output = execFileSync('powermetrics', [
        '--samplers', 'smc', '-n', '1', '-i', '1000'
      ], { timeout: 5000, encoding: 'utf8' })

      const fanMatches = output.matchAll(/Fan:\s*(\d+)\s*rpm/gi)
      let idx = 0
      for (const match of fanMatches) {
        fans.push({
          name: `Fan ${idx + 1}`,
          speed: parseInt(match[1]),
          maxSpeed: 6500, // typical Mac fan max
          percent: Math.round((parseInt(match[1]) / 6500) * 100)
        })
        idx++
      }
    } catch {
      // powermetrics requires root - try ioreg instead
      try {
        const output = execFileSync('ioreg', [
          '-l', '-w0'
        ], { timeout: 5000, encoding: 'utf8' })

        const fanMatch = output.match(/"Fan\d?Speed"\s*=\s*(\d+)/)
        if (fanMatch) {
          fans.push({
            name: 'System Fan',
            speed: parseInt(fanMatch[1]),
            maxSpeed: 6500,
            percent: Math.round((parseInt(fanMatch[1]) / 6500) * 100)
          })
        }
      } catch { /* ignore */ }
    }
  }

  // Windows: WMI fan speed
  if (isWindows) {
    try {
      const output = execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Get-CimInstance -ClassName Win32_Fan -ErrorAction SilentlyContinue | Select-Object Name,DesiredSpeed,ActiveCooling | ConvertTo-Json'
      ], { timeout: 10000, encoding: 'utf8' })

      if (output.trim()) {
        const wfans = JSON.parse(output)
        const fanArr = Array.isArray(wfans) ? wfans : [wfans]
        for (const f of fanArr) {
          fans.push({
            name: f.Name || 'System Fan',
            speed: f.DesiredSpeed || 0,
            maxSpeed: 5000,
            percent: f.DesiredSpeed ? Math.round((f.DesiredSpeed / 5000) * 100) : 0
          })
        }
      }
    } catch { /* WMI not available */ }
  }

  return fans
}

// ============================================================
// Cleanup Guide Generation
// ============================================================
interface CleanupRecommendation {
  priority: 'high' | 'medium' | 'low'
  action: string
  description: string
  difficulty: 'easy' | 'moderate' | 'advanced'
}

function generateCleanupGuide(
  temps: ThermalReading[],
  throttle: ThrottleStatus,
  fans: FanInfo[]
): CleanupRecommendation[] {
  const recommendations: CleanupRecommendation[] = []

  const maxCpuTemp = Math.max(0, ...temps.filter(t => t.component === 'CPU').map(t => t.temperature))
  const maxGpuTemp = Math.max(0, ...temps.filter(t => t.component === 'GPU').map(t => t.temperature))
  const fansRunning = fans.filter(f => f.speed > 0)
  const fansStopped = fans.filter(f => f.speed === 0)

  // High-priority: Critical temperature
  if (maxCpuTemp > TEMP_THRESHOLDS.cpu.critical || maxGpuTemp > TEMP_THRESHOLDS.gpu.critical) {
    recommendations.push({
      priority: 'high',
      action: 'Immediate cooling needed',
      description: 'CPU or GPU temperature is critically high. Stop intensive tasks immediately. Shut down and let the system cool. Check for blocked vents.',
      difficulty: 'easy'
    })
  }

  // Fan issues
  if (fansStopped.length > 0 && maxCpuTemp > TEMP_THRESHOLDS.cpu.warning) {
    recommendations.push({
      priority: 'high',
      action: 'Check fans',
      description: `${fansStopped.length} fan(s) appear to be stopped while system is warm. Fan may be failing, disconnected, or blocked by dust.`,
      difficulty: 'moderate'
    })
  }

  // Thermal paste
  if (maxCpuTemp > TEMP_THRESHOLDS.cpu.warning && fansRunning.some(f => f.percent > 80)) {
    recommendations.push({
      priority: 'high',
      action: 'Replace thermal paste',
      description: 'High temps with fans running at high speed suggests degraded thermal paste. Replacing thermal paste on CPU/GPU can reduce temps by 10-20C.',
      difficulty: 'advanced'
    })
  }

  // Dust cleaning
  if (maxCpuTemp > 65) {
    recommendations.push({
      priority: 'medium',
      action: 'Clean dust from vents and fans',
      description: 'Use compressed air to blow out dust from intake and exhaust vents. Accumulated dust is the #1 cause of overheating in Indian conditions.',
      difficulty: 'easy'
    })
  }

  // Cooling pad
  if (maxCpuTemp > TEMP_THRESHOLDS.cpu.warning) {
    recommendations.push({
      priority: 'medium',
      action: 'Use a laptop cooling pad',
      description: 'An external cooling pad (available for Rs 500-1500) can reduce temps by 5-10C. Essential for Indian summer conditions.',
      difficulty: 'easy'
    })
  }

  // Throttling
  if (throttle.isThrottling) {
    recommendations.push({
      priority: 'medium',
      action: 'Address thermal throttling',
      description: `CPU is throttled by ${throttle.throttlePercent}%. This directly reduces performance. Fix the underlying thermal issue.`,
      difficulty: 'moderate'
    })
  }

  // Elevated surface
  recommendations.push({
    priority: 'low',
    action: 'Elevate laptop',
    description: 'Place laptop on a hard, flat surface. Using on bed/pillow blocks bottom vents. Even a book under the back edge helps airflow.',
    difficulty: 'easy'
  })

  // Software: Reduce background load
  if (maxCpuTemp > 70) {
    recommendations.push({
      priority: 'low',
      action: 'Reduce background processes',
      description: 'Close unnecessary programs and browser tabs. Use ByteFix Performance Optimizer to disable startup items.',
      difficulty: 'easy'
    })
  }

  return recommendations
}

// ============================================================
// Power Plan Optimization for Cooling
// ============================================================
export async function optimizeCooling(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  if (isWindows) {
    // Set power plan to balanced (reduces CPU heat)
    try {
      execFileSync('powercfg', ['/setactive', '381b4222-f694-41f0-9685-ff5bb260df2e'], {
        timeout: 5000, encoding: 'utf8'
      })
      details.push('Set power plan to Balanced for better thermal management')
      changes.push({ type: 'system', action: 'modified', target: 'Power Plan', after: 'Balanced' })
    } catch { /* ignore */ }

    // Reduce max CPU state on battery
    try {
      execFileSync('powercfg', [
        '/SETDCVALUEINDEX', 'SCHEME_CURRENT', 'SUB_PROCESSOR', 'PROCTHROTTLEMAX', '80'
      ], { timeout: 5000, encoding: 'utf8' })
      execFileSync('powercfg', ['/SETACTIVE', 'SCHEME_CURRENT'], {
        timeout: 5000, encoding: 'utf8'
      })
      details.push('Limited max CPU to 80% on battery to reduce heat')
      changes.push({ type: 'system', action: 'modified', target: 'CPU Max State (Battery)', after: '80%' })
    } catch { /* ignore */ }

    // Disable turbo boost via registry (reduces peak temps significantly)
    try {
      execFileSync('powershell', [
        '-NoProfile', '-Command',
        'Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\be337238-0d82-4146-a960-4f3749d470c7" -Name "Attributes" -Value 2 -ErrorAction SilentlyContinue'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Made CPU turbo boost control visible in power settings')
      changes.push({ type: 'registry', action: 'modified', target: 'Turbo Boost Visibility' })
    } catch { /* ignore */ }
  }

  if (isMac) {
    // Lower energy settings
    try {
      execFileSync('osascript', [
        '-e', 'do shell script "pmset -a reducedisplaysleep 1 2>/dev/null" with administrator privileges'
      ], { timeout: 10000, encoding: 'utf8' })
      details.push('Enabled reduced display sleep on macOS')
    } catch { /* ignore */ }
  }

  if (isLinux) {
    // Set CPU governor to powersave
    try {
      const governors = readdirSync('/sys/devices/system/cpu/')
        .filter(f => f.startsWith('cpu') && /^cpu\d+$/.test(f))

      for (const cpu of governors) {
        const govPath = `/sys/devices/system/cpu/${cpu}/cpufreq/scaling_governor`
        if (existsSync(govPath)) {
          try {
            execFileSync('pkexec', ['tee', govPath], {
              timeout: 5000,
              input: 'powersave',
              encoding: 'utf8'
            })
          } catch { /* ignore individual CPU */ }
        }
      }
      details.push('Set CPU governor to powersave')
      changes.push({ type: 'system', action: 'modified', target: 'CPU Governor', after: 'powersave' })
    } catch { /* ignore */ }
  }

  if (details.length === 0) {
    details.push('No cooling optimizations available on this system')
  }

  return {
    success: true,
    module: 'overheating',
    action: 'optimize_cooling',
    description: 'Applied cooling optimizations',
    details,
    changes,
    rollbackAvailable: true
  }
}

// ============================================================
// Kill High-CPU Processes
// ============================================================
export async function killHighCpuProcesses(): Promise<FixResult> {
  const changes: FixChange[] = []
  const details: string[] = []

  try {
    const processes = await si.processes()
    const highCpu = processes.list
      .filter(p => p.cpu > 25 && !isSystemProcess(p.name))
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 5)

    for (const proc of highCpu) {
      try {
        if (isWindows) {
          execFileSync('taskkill', ['/PID', String(proc.pid), '/F'], {
            timeout: 5000, encoding: 'utf8'
          })
        } else {
          execFileSync('kill', ['-15', String(proc.pid)], {
            timeout: 5000, encoding: 'utf8'
          })
        }
        details.push(`Killed ${proc.name} (PID ${proc.pid}, CPU: ${proc.cpu.toFixed(1)}%)`)
        changes.push({
          type: 'process', action: 'killed',
          target: `${proc.name} (PID ${proc.pid})`
        })
      } catch {
        details.push(`Failed to kill ${proc.name} (PID ${proc.pid})`)
      }
    }

    if (highCpu.length === 0) {
      details.push('No high-CPU processes found (all under 25% threshold)')
    }
  } catch (err) {
    logger.error('Failed to enumerate processes', err)
    details.push('Could not enumerate running processes')
  }

  return {
    success: true,
    module: 'overheating',
    action: 'kill_high_cpu',
    description: 'Terminated high-CPU processes to reduce heat',
    details,
    changes,
    rollbackAvailable: false
  }
}

function isSystemProcess(name: string): boolean {
  const systemProcs = [
    'system', 'svchost', 'csrss', 'wininit', 'services', 'lsass',
    'smss', 'dwm', 'explorer', 'winlogon', 'spoolsv', 'msiexec',
    'sihost', 'fontdrvhost', 'conhost', 'runtimebroker', 'searchhost',
    'init', 'systemd', 'kthreadd', 'kworker', 'dbus-daemon',
    'loginwindow', 'kernel_task', 'launchd', 'windowserver'
  ]
  return systemProcs.includes(name.toLowerCase().replace('.exe', ''))
}

// ============================================================
// Main Diagnostics
// ============================================================
export async function runOverheatingDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // 1. Read temperatures
  const temps = await readTemperatures()
  const throttle = await detectThermalThrottle()
  const fans = await readFanSpeeds()

  if (temps.length === 0) {
    results.push({
      id: `heat-nosensor-${Date.now()}`,
      module: 'overheating',
      category: 'Temperature',
      title: 'No temperature sensors detected',
      severity: 'warning',
      description: 'Could not read temperature data from this system. Sensor access may require administrator privileges.',
      details: ['Try running ByteFix as administrator for full sensor access'],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
    return results
  }

  // 2. Analyze each temperature reading
  for (const reading of temps) {
    const thresholds = reading.component === 'GPU'
      ? TEMP_THRESHOLDS.gpu
      : reading.component === 'Disk'
        ? TEMP_THRESHOLDS.disk
        : TEMP_THRESHOLDS.cpu

    if (reading.temperature >= thresholds.critical) {
      results.push({
        id: `heat-crit-${reading.component}-${Date.now()}`,
        module: 'overheating',
        category: 'Temperature',
        title: `${reading.component} temperature CRITICAL: ${reading.temperature.toFixed(1)}C`,
        severity: 'critical',
        description: `${reading.sensor} is at ${reading.temperature.toFixed(1)}C. Critical threshold is ${thresholds.critical}C. System may shut down or sustain damage.`,
        details: [
          `Current: ${reading.temperature.toFixed(1)}C`,
          `Warning threshold: ${thresholds.warning}C`,
          `Critical threshold: ${thresholds.critical}C`,
          `Shutdown threshold: ${thresholds.shutdown}C`
        ],
        fixAvailable: true,
        fixDescription: 'Apply cooling optimizations and kill high-CPU processes',
        fixRisk: 'low',
        autoFixable: true,
        timestamp: Date.now()
      })
    } else if (reading.temperature >= thresholds.warning) {
      results.push({
        id: `heat-warn-${reading.component}-${Date.now()}`,
        module: 'overheating',
        category: 'Temperature',
        title: `${reading.component} temperature elevated: ${reading.temperature.toFixed(1)}C`,
        severity: 'warning',
        description: `${reading.sensor} is at ${reading.temperature.toFixed(1)}C. Consider improving ventilation.`,
        details: [
          `Current: ${reading.temperature.toFixed(1)}C`,
          `Warning threshold: ${thresholds.warning}C`
        ],
        fixAvailable: true,
        fixDescription: 'Optimize power settings for cooler operation',
        fixRisk: 'none',
        autoFixable: true,
        timestamp: Date.now()
      })
    } else {
      results.push({
        id: `heat-ok-${reading.component}-${Date.now()}`,
        module: 'overheating',
        category: 'Temperature',
        title: `${reading.component} temperature normal: ${reading.temperature.toFixed(1)}C`,
        severity: 'healthy',
        description: `${reading.sensor} is operating within normal range`,
        details: [`Current: ${reading.temperature.toFixed(1)}C (threshold: ${thresholds.warning}C)`],
        fixAvailable: false,
        fixRisk: 'none',
        autoFixable: false,
        timestamp: Date.now()
      })
    }
  }

  // 3. Throttle detection
  if (throttle.isThrottling) {
    results.push({
      id: `heat-throttle-${Date.now()}`,
      module: 'overheating',
      category: 'Thermal Throttling',
      title: `CPU throttled by ${throttle.throttlePercent}%`,
      severity: 'warning',
      description: 'CPU is being throttled due to high temperature. Performance is reduced.',
      details: [
        `Current frequency: ${throttle.currentFreqMhz.toFixed(0)} MHz`,
        `Max frequency: ${throttle.maxFreqMhz.toFixed(0)} MHz`,
        `Throttle amount: ${throttle.throttlePercent}%`,
        ...throttle.reason
      ],
      fixAvailable: true,
      fixDescription: 'Apply cooling optimizations',
      fixRisk: 'low',
      autoFixable: true,
      timestamp: Date.now()
    })
  }

  // 4. Fan status
  if (fans.length > 0) {
    for (const fan of fans) {
      if (fan.speed === 0) {
        results.push({
          id: `heat-fan-stopped-${Date.now()}`,
          module: 'overheating',
          category: 'Fans',
          title: `${fan.name}: Not spinning`,
          severity: 'warning',
          description: 'Fan is not spinning. May be idle (normal if system is cool) or failed.',
          details: [
            `Speed: 0 RPM`,
            'If system is warm, this fan may need replacement'
          ],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp: Date.now()
        })
      } else {
        const severity = fan.percent > 90 ? 'warning' : 'healthy'
        results.push({
          id: `heat-fan-${fan.name}-${Date.now()}`,
          module: 'overheating',
          category: 'Fans',
          title: `${fan.name}: ${fan.speed} RPM (${fan.percent}%)`,
          severity,
          description: fan.percent > 90
            ? 'Fan running at very high speed. System is working hard to cool.'
            : 'Fan operating normally.',
          details: [
            `Speed: ${fan.speed} RPM`,
            `Max speed: ${fan.maxSpeed} RPM`,
            `Load: ${fan.percent}%`
          ],
          fixAvailable: false,
          fixRisk: 'none',
          autoFixable: false,
          timestamp: Date.now()
        })
      }
    }
  } else {
    results.push({
      id: `heat-nofan-${Date.now()}`,
      module: 'overheating',
      category: 'Fans',
      title: 'No fan speed data available',
      severity: 'info',
      description: 'Could not read fan speed. This is normal on some systems.',
      details: ['Fan monitoring may require specific drivers or admin access'],
      fixAvailable: false,
      fixRisk: 'none',
      autoFixable: false,
      timestamp: Date.now()
    })
  }

  // 5. Cleanup guide
  const guide = generateCleanupGuide(temps, throttle, fans)
  if (guide.length > 0) {
    const highPriority = guide.filter(g => g.priority === 'high')
    if (highPriority.length > 0) {
      results.push({
        id: `heat-guide-${Date.now()}`,
        module: 'overheating',
        category: 'Recommendations',
        title: `${guide.length} cooling recommendations (${highPriority.length} high priority)`,
        severity: highPriority.length > 0 ? 'warning' : 'info',
        description: 'Based on current thermal readings, here are recommended actions:',
        details: guide.map(g => `[${g.priority.toUpperCase()}] ${g.action}: ${g.description}`),
        fixAvailable: true,
        fixDescription: 'Apply software cooling optimizations',
        fixRisk: 'low',
        autoFixable: true,
        timestamp: Date.now()
      })
    }
  }

  return results
}
