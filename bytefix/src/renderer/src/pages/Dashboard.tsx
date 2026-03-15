import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Zap, Monitor, Wifi, Wrench, Battery,
  AlertTriangle, CheckCircle, XCircle, Loader2, PlayCircle
} from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { formatUptime, healthColor, healthGradient, severityColor, severityBg } from '../lib/utils'
import type { ScanResult } from '../../../../shared/types'

const QUICK_ACTIONS = [
  { id: 'system', label: 'System Info', icon: Monitor, path: '/system', color: 'from-blue-500 to-blue-600' },
  { id: 'performance', label: 'Performance', icon: Zap, path: '/performance', color: 'from-yellow-500 to-orange-500' },
  { id: 'malware', label: 'Malware Scan', icon: Shield, path: '/malware', color: 'from-red-500 to-red-600' },
  { id: 'network', label: 'Network', icon: Wifi, path: '/network', color: 'from-green-500 to-emerald-600' },
  { id: 'os-repair', label: 'OS Repair', icon: Wrench, path: '/os-repair', color: 'from-purple-500 to-purple-600' },
  { id: 'battery', label: 'Battery', icon: Battery, path: '/battery', color: 'from-cyan-500 to-cyan-600' }
]

export function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const { systemInfo, isLoadingSystem, setSystemInfo, setIsLoadingSystem, lastScan, setLastScan, isScanning, setIsScanning } = useAppStore()
  const [scanResult, setScanResult] = useState<ScanResult | null>(lastScan)

  useEffect(() => {
    if (!systemInfo) {
      loadSystemInfo()
    }
  }, [])

  async function loadSystemInfo(): Promise<void> {
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

  async function runQuickScan(): Promise<void> {
    setIsScanning(true)
    try {
      const result = await window.bytefix.quickScan()
      setScanResult(result)
      setLastScan(result)
    } catch (err) {
      console.error('Quick scan failed:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const health = scanResult?.overallHealth ?? null

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {systemInfo
              ? `${systemInfo.os.distro} ${systemInfo.os.release} | ${systemInfo.cpu.brand} | Uptime: ${formatUptime(systemInfo.uptime)}`
              : 'Loading system information...'}
          </p>
        </div>
        <button
          onClick={runQuickScan}
          disabled={isScanning}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {isScanning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
          ) : (
            <><PlayCircle className="w-4 h-4" /> Quick Scan</>
          )}
        </button>
      </div>

      {/* Health Score */}
      {health !== null && (
        <div className="card">
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  strokeWidth="8" strokeLinecap="round"
                  className={`bg-gradient-to-r ${healthGradient(health)}`}
                  stroke={health >= 80 ? '#34d399' : health >= 60 ? '#fbbf24' : health >= 40 ? '#f97316' : '#ef4444'}
                  strokeDasharray={`${health * 2.51} 251`}
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${healthColor(health)}`}>
                {health}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">System Health Score</h2>
              <p className="text-sm text-gray-400 mt-1">{scanResult?.summary}</p>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {scanResult?.diagnostics.filter(d => d.severity === 'healthy').length || 0} Passed
                </span>
                <span className="flex items-center gap-1 text-yellow-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {scanResult?.diagnostics.filter(d => d.severity === 'warning').length || 0} Warnings
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  {scanResult?.diagnostics.filter(d => d.severity === 'critical').length || 0} Critical
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={() => navigate(action.path)}
                className="card-hover text-left group"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-medium text-white">{action.label}</h3>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent Issues */}
      {scanResult && scanResult.diagnostics.filter(d => d.severity !== 'healthy').length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Issues Found</h2>
          <div className="space-y-2">
            {scanResult.diagnostics
              .filter(d => d.severity !== 'healthy')
              .sort((a, b) => {
                const order = { critical: 0, error: 1, warning: 2, info: 3, healthy: 4 }
                return (order[a.severity] ?? 5) - (order[b.severity] ?? 5)
              })
              .map((diag) => (
                <div key={diag.id} className="card flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    diag.severity === 'critical' ? 'bg-red-500' :
                    diag.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{diag.title}</p>
                    <p className="text-xs text-gray-400 truncate">{diag.description}</p>
                  </div>
                  <span className={`${severityBg(diag.severity)} ${severityColor(diag.severity)} badge`}>
                    {diag.severity}
                  </span>
                  {diag.autoFixable && (
                    <button className="btn-primary text-xs py-1 px-3">Auto Fix</button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* System Overview Cards */}
      {systemInfo && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">System Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-xs text-gray-400 uppercase tracking-wide">CPU</p>
              <p className="text-sm font-medium text-white mt-1 truncate">{systemInfo.cpu.brand}</p>
              <p className="text-xs text-gray-400">{systemInfo.cpu.cores} cores @ {systemInfo.cpu.speed}GHz</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Memory</p>
              <p className="text-sm font-medium text-white mt-1">
                {Math.round(systemInfo.memory.used / (1024 * 1024 * 1024))}GB / {Math.round(systemInfo.memory.total / (1024 * 1024 * 1024))}GB
              </p>
              <div className="w-full bg-surface-lighter rounded-full h-1.5 mt-2">
                <div
                  className={`h-full rounded-full ${systemInfo.memory.usedPercent > 85 ? 'bg-red-500' : systemInfo.memory.usedPercent > 70 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                  style={{ width: `${systemInfo.memory.usedPercent}%` }}
                />
              </div>
            </div>
            <div className="card">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Disk</p>
              {systemInfo.disk[0] && (
                <>
                  <p className="text-sm font-medium text-white mt-1">
                    {Math.round(systemInfo.disk[0].used / (1024 * 1024 * 1024))}GB / {Math.round(systemInfo.disk[0].size / (1024 * 1024 * 1024))}GB
                  </p>
                  <div className="w-full bg-surface-lighter rounded-full h-1.5 mt-2">
                    <div
                      className={`h-full rounded-full ${systemInfo.disk[0].usedPercent > 90 ? 'bg-red-500' : systemInfo.disk[0].usedPercent > 75 ? 'bg-yellow-500' : 'bg-bytefix-500'}`}
                      style={{ width: `${systemInfo.disk[0].usedPercent}%` }}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="card">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Battery</p>
              {systemInfo.battery.hasBattery ? (
                <>
                  <p className="text-sm font-medium text-white mt-1">{systemInfo.battery.percent}% {systemInfo.battery.isCharging ? '⚡ Charging' : ''}</p>
                  <p className="text-xs text-gray-400">Health: {systemInfo.battery.healthPercent}%</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-1">No battery (Desktop)</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoadingSystem && !systemInfo && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bytefix-400" />
          <span className="ml-3 text-gray-400">Loading system information...</span>
        </div>
      )}
    </div>
  )
}
