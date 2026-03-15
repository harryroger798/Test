import { useState, useEffect } from 'react'
import { Battery, Loader2, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import type { BatteryInfo, FixResult } from '../../../../shared/types'

export function BatteryPage(): JSX.Element {
  const [battery, setBattery] = useState<BatteryInfo | null>(null)
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState<FixResult | null>(null)

  useEffect(() => { loadBattery() }, [])

  async function loadBattery(): Promise<void> {
    setLoading('load')
    try {
      const info = await window.bytefix.getBatteryReport()
      setBattery(info)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  async function optimize(): Promise<void> {
    setLoading('optimize')
    try {
      const res = await window.bytefix.optimizePower()
      setResult(res)
    } catch (err) { console.error(err) }
    finally { setLoading('') }
  }

  function healthColor(pct: number): string {
    if (pct >= 80) return 'text-emerald-400'
    if (pct >= 60) return 'text-yellow-400'
    if (pct >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  function healthBg(pct: number): string {
    if (pct >= 80) return 'bg-emerald-500'
    if (pct >= 60) return 'bg-yellow-500'
    if (pct >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Battery className="w-6 h-6 text-cyan-400" /> Battery Diagnostics
        </h1>
        <p className="text-gray-400 text-sm mt-1">Battery health analysis, power optimization, and charging diagnostics</p>
      </div>

      {/* Fix Result */}
      {result && (
        <div className={`card ${result.success ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          <div className="flex items-center gap-3">
            {result.success ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
            <div>
              <p className="text-sm font-medium text-white">{result.description}</p>
              {result.details.map((d, i) => <p key={i} className="text-xs text-gray-400">• {d}</p>)}
            </div>
            <button onClick={() => setResult(null)} className="ml-auto text-gray-400 text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {loading === 'load' && !battery ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-bytefix-400" />
          <span className="ml-3 text-gray-400">Reading battery information...</span>
        </div>
      ) : battery ? (
        battery.hasBattery ? (
          <div className="space-y-4">
            {/* Battery Overview */}
            <div className="card">
              <div className="flex items-center gap-6">
                {/* Battery Visual */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-36 border-2 border-gray-500 rounded-lg relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-3 bg-gray-500 rounded-t-md" />
                    <div
                      className={`absolute bottom-0 left-0 right-0 transition-all ${healthBg(battery.percent)}`}
                      style={{ height: `${battery.percent}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white drop-shadow">
                      {battery.percent}%
                    </span>
                  </div>
                  {battery.isCharging && (
                    <Zap className="absolute -right-2 -bottom-2 w-6 h-6 text-yellow-400" />
                  )}
                </div>

                {/* Battery Details */}
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Health</p>
                    <p className={`text-xl font-bold ${healthColor(battery.healthPercent)}`}>{battery.healthPercent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Cycle Count</p>
                    <p className="text-xl font-bold text-white">{battery.cycleCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Design Capacity</p>
                    <p className="text-sm text-white">{battery.designCapacity} mWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Current Capacity</p>
                    <p className="text-sm text-white">{battery.currentCapacity} mWh</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <p className="text-sm text-white">{battery.isCharging ? 'Charging' : 'On Battery'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Manufacturer</p>
                    <p className="text-sm text-white">{battery.manufacturer}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Assessment */}
            <div className={`card ${
              battery.healthPercent >= 80 ? 'border-emerald-500/30' :
              battery.healthPercent >= 60 ? 'border-yellow-500/30' :
              battery.healthPercent >= 40 ? 'border-orange-500/30' : 'border-red-500/30'
            }`}>
              <h3 className="font-medium text-white mb-2">Health Assessment</h3>
              {battery.healthPercent >= 80 && (
                <p className="text-sm text-emerald-400">Battery is in good condition. No action needed.</p>
              )}
              {battery.healthPercent >= 60 && battery.healthPercent < 80 && (
                <p className="text-sm text-yellow-400">
                  Battery is showing some wear. Consider replacement within 6-12 months.
                  Optimizing power settings can help extend remaining life.
                </p>
              )}
              {battery.healthPercent >= 40 && battery.healthPercent < 60 && (
                <p className="text-sm text-orange-400">
                  Battery is significantly degraded. Replace within 3-6 months.
                  You may notice shorter battery life and unexpected shutdowns.
                </p>
              )}
              {battery.healthPercent < 40 && (
                <p className="text-sm text-red-400">
                  Battery is critically degraded ({battery.healthPercent}% of original capacity).
                  Immediate replacement recommended. Risk of swelling or unexpected shutdowns.
                </p>
              )}
              {battery.cycleCount > 500 && (
                <p className="text-xs text-gray-400 mt-2">
                  {battery.cycleCount} charge cycles (most batteries rated for 300-500 cycles)
                </p>
              )}
            </div>

            {/* Power Optimization */}
            <div className="card">
              <h3 className="font-medium text-white mb-2">Power Optimization</h3>
              <p className="text-sm text-gray-400 mb-4">
                Optimizes power plan settings: balanced mode, screen/sleep timeouts,
                disables wake timers, and sets background apps to conservative mode.
              </p>
              <button onClick={optimize} disabled={!!loading} className="btn-primary flex items-center gap-2">
                {loading === 'optimize' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Optimize Power Settings
              </button>
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center py-12">
            <Battery className="w-16 h-16 text-gray-600 mb-4" />
            <h2 className="text-lg font-medium text-white">No Battery Detected</h2>
            <p className="text-gray-400 text-sm mt-2">This appears to be a desktop system or the battery is not recognized.</p>
          </div>
        )
      ) : null}
    </div>
  )
}
