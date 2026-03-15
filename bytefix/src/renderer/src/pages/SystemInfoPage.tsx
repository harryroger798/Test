import { useState, useEffect } from 'react'
import { Monitor, Cpu, MemoryStick, HardDrive, Wifi, Loader2, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { formatBytes, formatUptime } from '../lib/utils'

export function SystemInfoPage(): JSX.Element {
  const { systemInfo, isLoadingSystem, setSystemInfo, setIsLoadingSystem } = useAppStore()
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (!systemInfo) refresh()
  }, [])

  async function refresh(): Promise<void> {
    setIsLoadingSystem(true)
    try {
      const info = await window.bytefix.getSystemInfo()
      setSystemInfo(info)
    } catch (err) {
      console.error('Failed to load system info:', err)
    } finally {
      setIsLoadingSystem(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'cpu', label: 'CPU' },
    { id: 'memory', label: 'Memory' },
    { id: 'disks', label: 'Disks' },
    { id: 'network', label: 'Network' },
    { id: 'graphics', label: 'Graphics' }
  ]

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Monitor className="w-6 h-6 text-bytefix-400" /> System Information
          </h1>
          <p className="text-gray-400 text-sm mt-1">Complete hardware and software inventory</p>
        </div>
        <button onClick={refresh} disabled={isLoadingSystem} className="btn-secondary flex items-center gap-2 text-sm">
          {isLoadingSystem ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-light rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-bytefix-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoadingSystem && !systemInfo ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-bytefix-400" />
          <span className="ml-3 text-gray-400">Scanning system...</span>
        </div>
      ) : systemInfo ? (
        <div className="space-y-4">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard title="Operating System" items={[
                { label: 'Platform', value: systemInfo.os.platform },
                { label: 'Distribution', value: systemInfo.os.distro },
                { label: 'Version', value: systemInfo.os.release },
                { label: 'Architecture', value: systemInfo.os.arch },
                { label: 'Hostname', value: systemInfo.os.hostname },
                { label: 'Build', value: systemInfo.os.build || 'N/A' },
                { label: 'Uptime', value: formatUptime(systemInfo.uptime) }
              ]} />
              <InfoCard title="Processor" items={[
                { label: 'Model', value: systemInfo.cpu.brand },
                { label: 'Manufacturer', value: systemInfo.cpu.manufacturer },
                { label: 'Speed', value: `${systemInfo.cpu.speed} GHz` },
                { label: 'Cores', value: `${systemInfo.cpu.physicalCores} physical / ${systemInfo.cpu.cores} logical` },
                { label: 'Temperature', value: systemInfo.cpu.temperature ? `${systemInfo.cpu.temperature}°C` : 'N/A' }
              ]} />
              <InfoCard title="Memory" items={[
                { label: 'Total', value: formatBytes(systemInfo.memory.total) },
                { label: 'Used', value: `${formatBytes(systemInfo.memory.used)} (${systemInfo.memory.usedPercent}%)` },
                { label: 'Free', value: formatBytes(systemInfo.memory.free) },
                { label: 'Swap Total', value: formatBytes(systemInfo.memory.swapTotal) },
                { label: 'Swap Used', value: formatBytes(systemInfo.memory.swapUsed) }
              ]} />
              <InfoCard title="Battery" items={
                systemInfo.battery.hasBattery ? [
                  { label: 'Status', value: systemInfo.battery.isCharging ? 'Charging' : 'On Battery' },
                  { label: 'Level', value: `${systemInfo.battery.percent}%` },
                  { label: 'Health', value: `${systemInfo.battery.healthPercent}%` },
                  { label: 'Cycles', value: String(systemInfo.battery.cycleCount) },
                  { label: 'Manufacturer', value: systemInfo.battery.manufacturer }
                ] : [{ label: 'Status', value: 'No battery detected' }]
              } />
            </div>
          )}

          {activeTab === 'cpu' && (
            <InfoCard title="CPU Details" items={[
              { label: 'Brand', value: systemInfo.cpu.brand },
              { label: 'Manufacturer', value: systemInfo.cpu.manufacturer },
              { label: 'Base Speed', value: `${systemInfo.cpu.speed} GHz` },
              { label: 'Physical Cores', value: String(systemInfo.cpu.physicalCores) },
              { label: 'Logical Cores', value: String(systemInfo.cpu.cores) },
              { label: 'Temperature', value: systemInfo.cpu.temperature ? `${systemInfo.cpu.temperature}°C` : 'Not available' }
            ]} />
          )}

          {activeTab === 'memory' && (
            <div className="space-y-4">
              <InfoCard title="RAM" items={[
                { label: 'Total', value: formatBytes(systemInfo.memory.total) },
                { label: 'Used', value: formatBytes(systemInfo.memory.used) },
                { label: 'Free', value: formatBytes(systemInfo.memory.free) },
                { label: 'Usage', value: `${systemInfo.memory.usedPercent}%` }
              ]} />
              <div className="card">
                <h3 className="font-medium text-white mb-3">Memory Usage</h3>
                <div className="w-full bg-surface-lighter rounded-full h-4">
                  <div
                    className={`h-full rounded-full transition-all ${
                      systemInfo.memory.usedPercent > 85 ? 'bg-red-500' :
                      systemInfo.memory.usedPercent > 70 ? 'bg-yellow-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${systemInfo.memory.usedPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {formatBytes(systemInfo.memory.used)} of {formatBytes(systemInfo.memory.total)} used
                </p>
              </div>
            </div>
          )}

          {activeTab === 'disks' && (
            <div className="space-y-4">
              {systemInfo.disk.map((disk, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-3 mb-3">
                    <HardDrive className="w-5 h-5 text-bytefix-400" />
                    <div>
                      <h3 className="font-medium text-white">{disk.name || disk.device}</h3>
                      <p className="text-xs text-gray-400">{disk.type} | {disk.fs} | {disk.mount}</p>
                    </div>
                  </div>
                  <div className="w-full bg-surface-lighter rounded-full h-3 mb-2">
                    <div
                      className={`h-full rounded-full ${
                        disk.usedPercent > 90 ? 'bg-red-500' :
                        disk.usedPercent > 75 ? 'bg-yellow-500' : 'bg-bytefix-500'
                      }`}
                      style={{ width: `${disk.usedPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {formatBytes(disk.used)} / {formatBytes(disk.size)} ({disk.usedPercent.toFixed(1)}% used) | {formatBytes(disk.available)} free
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-4">
              {systemInfo.network.map((iface, i) => (
                <div key={i} className="card">
                  <div className="flex items-center gap-3 mb-3">
                    <Wifi className={`w-5 h-5 ${iface.operstate === 'up' ? 'text-emerald-400' : 'text-gray-500'}`} />
                    <div>
                      <h3 className="font-medium text-white">{iface.iface}</h3>
                      <p className="text-xs text-gray-400">{iface.type} | {iface.operstate}</p>
                    </div>
                    <span className={`ml-auto badge ${iface.operstate === 'up' ? 'badge-healthy' : 'badge-critical'}`}>
                      {iface.operstate}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-400">IPv4:</span> <span className="text-white">{iface.ip4 || 'N/A'}</span></div>
                    <div><span className="text-gray-400">MAC:</span> <span className="text-white">{iface.mac}</span></div>
                    <div><span className="text-gray-400">Speed:</span> <span className="text-white">{iface.speed ? `${iface.speed} Mbps` : 'N/A'}</span></div>
                    {iface.ssid && <div><span className="text-gray-400">SSID:</span> <span className="text-white">{iface.ssid}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-4">
              {systemInfo.graphics.controllers.map((gpu, i) => (
                <InfoCard key={i} title={`GPU ${i + 1}: ${gpu.model}`} items={[
                  { label: 'Vendor', value: gpu.vendor },
                  { label: 'VRAM', value: gpu.vram ? `${gpu.vram} MB` : 'Shared' },
                  { label: 'Driver', value: gpu.driverVersion },
                  { label: 'Temperature', value: gpu.temperature ? `${gpu.temperature}°C` : 'N/A' }
                ]} />
              ))}
              {systemInfo.graphics.displays.map((display, i) => (
                <InfoCard key={`d-${i}`} title={`Display ${i + 1}: ${display.model}`} items={[
                  { label: 'Resolution', value: display.resolution },
                  { label: 'Refresh Rate', value: `${display.refreshRate} Hz` },
                  { label: 'Connection', value: display.connection },
                  { label: 'Primary', value: display.primary ? 'Yes' : 'No' }
                ]} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function InfoCard({ title, items }: { title: string; items: { label: string; value: string }[] }): JSX.Element {
  return (
    <div className="card">
      <h3 className="font-medium text-white mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-400">{item.label}</span>
            <span className="text-white font-medium text-right max-w-[60%] truncate">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
