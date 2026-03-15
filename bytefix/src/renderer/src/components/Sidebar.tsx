import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Zap, Shield, Wifi,
  Wrench, Battery, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { cn } from '../lib/utils'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/system', label: 'System Info', icon: Monitor },
  { path: '/performance', label: 'Performance', icon: Zap },
  { path: '/malware', label: 'Malware Scan', icon: Shield },
  { path: '/network', label: 'Network', icon: Wifi },
  { path: '/os-repair', label: 'OS Repair', icon: Wrench },
  { path: '/battery', label: 'Battery', icon: Battery }
]

export function Sidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggle = useAppStore((s) => s.toggleSidebar)

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-surface-light border-r border-gray-700/50 flex flex-col z-50 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-bytefix-500 to-bytefix-700 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">ByteFix</h1>
              <p className="text-[10px] text-gray-400 -mt-1">Diagnose. Fix. Protect.</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-bytefix-600/20 text-bytefix-400 border border-bytefix-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-lighter/50'
              )}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-bytefix-400')} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-gray-700/50">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-lighter/50 text-sm transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
