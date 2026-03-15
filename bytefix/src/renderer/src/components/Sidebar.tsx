import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Zap, Shield, Wifi,
  Wrench, Battery, ChevronLeft, ChevronRight,
  HardDrive, KeyRound, Volume2, Bluetooth, Printer,
  MonitorSpeaker, Camera, Usb, Globe,
  Thermometer, Cpu, Keyboard, Gamepad2, Mail, Smartphone,
  Receipt, QrCode, MessageCircle, Users, ClipboardList, Database, Languages
} from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { cn } from '../lib/utils'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'core' },
  { path: '/system', label: 'System Info', icon: Monitor, group: 'core' },
  { path: '/performance', label: 'Performance', icon: Zap, group: 'core' },
  { path: '/malware', label: 'Malware Scan', icon: Shield, group: 'core' },
  { path: '/network', label: 'Network', icon: Wifi, group: 'core' },
  { path: '/os-repair', label: 'OS Repair', icon: Wrench, group: 'core' },
  { path: '/battery', label: 'Battery', icon: Battery, group: 'core' },
  { path: '/data-recovery', label: 'Data Recovery', icon: HardDrive, group: 'phase2' },
  { path: '/password', label: 'Password Recovery', icon: KeyRound, group: 'phase2' },
  { path: '/audio', label: 'Audio Fixer', icon: Volume2, group: 'phase2' },
  { path: '/bluetooth', label: 'Bluetooth', icon: Bluetooth, group: 'phase2' },
  { path: '/printer', label: 'Printer', icon: Printer, group: 'phase2' },
  { path: '/display', label: 'Display / GPU', icon: MonitorSpeaker, group: 'phase2' },
  { path: '/webcam', label: 'Webcam', icon: Camera, group: 'phase2' },
  { path: '/usb', label: 'USB / Peripherals', icon: Usb, group: 'phase2' },
  { path: '/india-apps', label: 'India Apps', icon: Globe, group: 'phase2' },
  { path: '/overheating', label: 'Overheating', icon: Thermometer, group: 'phase3' },
  { path: '/hardware', label: 'Hardware Diag', icon: Cpu, group: 'phase3' },
  { path: '/keyboard', label: 'Keyboard / Touchpad', icon: Keyboard, group: 'phase3' },
  { path: '/gaming', label: 'Gaming Optimizer', icon: Gamepad2, group: 'phase3' },
  { path: '/partition', label: 'Partition / Boot', icon: HardDrive, group: 'phase3' },
  { path: '/activation', label: 'Win Activation', icon: KeyRound, group: 'phase3' },
  { path: '/email', label: 'Email Setup', icon: Mail, group: 'phase3' },
  { path: '/phone', label: 'Phone Transfer', icon: Smartphone, group: 'phase3' },
  { path: '/billing', label: 'GST Billing', icon: Receipt, group: 'phase4' },
  { path: '/upi', label: 'UPI Payment', icon: QrCode, group: 'phase4' },
  { path: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, group: 'phase4' },
  { path: '/customers', label: 'Customers', icon: Users, group: 'phase4' },
  { path: '/jobs', label: 'Repair Jobs', icon: ClipboardList, group: 'phase4' },
  { path: '/backup', label: 'Backup Wizard', icon: Database, group: 'phase4' },
  { path: '/language', label: 'Language', icon: Languages, group: 'phase4' }
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
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
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
