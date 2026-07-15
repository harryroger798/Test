import si from 'systeminformation'
import { createLogger } from '../logger'
import type { SystemInfo, DiskInfo, BatteryInfo, ProcessInfo } from '../../shared/types'

const logger = createLogger('system-scanner')

export async function getFullSystemInfo(): Promise<SystemInfo> {
  logger.info('Starting full system scan...')

  const [osInfo, cpuInfo, memInfo, diskLayout, fsSize, batteryInfo, graphicsInfo, networkInterfaces, cpuTemp, timeInfo] =
    await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.diskLayout(),
      si.fsSize(),
      si.battery(),
      si.graphics(),
      si.networkInterfaces(),
      si.cpuTemperature().catch(() => ({ main: 0 })),
      si.time()
    ])

  const disks: DiskInfo[] = fsSize
    .filter((fs) => fs.size > 0 && !fs.mount.startsWith('/snap') && !fs.mount.startsWith('/boot'))
    .map((fs) => {
      const layout = Array.isArray(diskLayout)
        ? diskLayout.find((d) => fs.fs.includes(d.device) || d.device.includes(fs.fs.replace(/[0-9]/g, '')))
        : undefined
      let diskType: DiskInfo['type'] = 'Unknown'
      if (layout) {
        if (layout.interfaceType === 'NVMe' || layout.type === 'NVMe') diskType = 'NVMe'
        else if (layout.type === 'SSD' || layout.interfaceType === 'SATA/600') diskType = 'SSD'
        else if (layout.type === 'HD' || layout.type === 'HDD') diskType = 'HDD'
      }
      return {
        device: fs.fs,
        name: layout?.name || fs.fs,
        type: diskType,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        usedPercent: fs.use,
        mount: fs.mount,
        fs: fs.type
      }
    })

  const battery: BatteryInfo = {
    hasBattery: batteryInfo.hasBattery,
    isCharging: batteryInfo.isCharging,
    percent: batteryInfo.percent,
    cycleCount: batteryInfo.cycleCount || 0,
    designCapacity: batteryInfo.designedCapacity || 0,
    currentCapacity: batteryInfo.currentCapacity || 0,
    healthPercent: batteryInfo.designedCapacity > 0
      ? Math.round((batteryInfo.currentCapacity / batteryInfo.designedCapacity) * 100)
      : 100,
    voltage: batteryInfo.voltage || 0,
    timeRemaining: batteryInfo.timeRemaining || 0,
    manufacturer: batteryInfo.manufacturer || 'Unknown',
    model: batteryInfo.model || 'Unknown',
    powerSource: batteryInfo.isCharging || !batteryInfo.hasBattery ? 'AC' : 'Battery'
  }

  const netIfaces = (Array.isArray(networkInterfaces) ? networkInterfaces : [])
    .filter((n) => !n.internal)
    .map((n) => ({
      iface: n.iface,
      type: n.type,
      ip4: n.ip4,
      ip6: n.ip6,
      mac: n.mac,
      speed: n.speed || 0,
      operstate: n.operstate as 'up' | 'down',
      ssid: (n as unknown as Record<string, unknown>).ssid as string | undefined,
      signalLevel: (n as unknown as Record<string, unknown>).signalLevel as number | undefined
    }))

  const result: SystemInfo = {
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      arch: osInfo.arch,
      hostname: osInfo.hostname,
      build: osInfo.build || ''
    },
    cpu: {
      manufacturer: cpuInfo.manufacturer,
      brand: cpuInfo.brand,
      speed: cpuInfo.speed,
      cores: cpuInfo.cores,
      physicalCores: cpuInfo.physicalCores,
      temperature: cpuTemp.main || undefined
    },
    memory: {
      total: memInfo.total,
      free: memInfo.free,
      used: memInfo.used,
      usedPercent: Math.round((memInfo.used / memInfo.total) * 100),
      swapTotal: memInfo.swaptotal,
      swapUsed: memInfo.swapused
    },
    disk: disks,
    battery,
    graphics: {
      controllers: graphicsInfo.controllers.map((c) => ({
        vendor: c.vendor,
        model: c.model,
        vram: c.vram || 0,
        driverVersion: c.driverVersion || 'Unknown',
        temperature: (c as unknown as Record<string, unknown>).temperatureGpu as number | undefined
      })),
      displays: graphicsInfo.displays.map((d) => ({
        model: d.model || 'Unknown',
        resolution: `${d.resolutionX}x${d.resolutionY}`,
        refreshRate: (d as unknown as Record<string, unknown>).currentRefreshRate as number || 60,
        connection: d.connection || 'Unknown',
        primary: d.main || false
      }))
    },
    network: netIfaces,
    uptime: timeInfo.uptime || 0
  }

  logger.info('System scan complete')
  return result
}

export async function getRunningProcesses(): Promise<ProcessInfo[]> {
  const processes = await si.processes()
  return processes.list
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 100)
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      cpu: Math.round(p.cpu * 100) / 100,
      memory: Math.round(p.mem * 100) / 100,
      memoryMB: Math.round(p.memRss / 1024),
      path: p.path || '',
      user: p.user || '',
      isSafe: isSystemProcess(p.name)
    }))
}

const SYSTEM_PROCESSES = new Set([
  'system', 'svchost.exe', 'csrss.exe', 'wininit.exe', 'winlogon.exe',
  'services.exe', 'lsass.exe', 'smss.exe', 'dwm.exe', 'explorer.exe',
  'taskhostw.exe', 'runtimebroker.exe', 'shellexperiencehost.exe',
  'systemd', 'init', 'kthreadd', 'loginwindow', 'kernel_task',
  'WindowServer', 'launchd', 'Finder'
])

function isSystemProcess(name: string): boolean {
  return SYSTEM_PROCESSES.has(name.toLowerCase()) || SYSTEM_PROCESSES.has(name)
}
