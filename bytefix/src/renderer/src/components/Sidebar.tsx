import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Zap, Shield, Wifi,
  Wrench, Battery, ChevronLeft, ChevronRight,
  HardDrive, KeyRound, Volume2, Bluetooth, Printer,
  MonitorSpeaker, Camera, Usb, Globe,
  Thermometer, Cpu, Keyboard, Gamepad2, Mail, Smartphone,
  Receipt, QrCode, MessageCircle, Users, ClipboardList, Database, Languages,
  DiscAlbum, MemoryStick, CircuitBoard, Radio, Brain
} from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { cn } from '../lib/utils'
import type { LucideIcon } from 'lucide-react'

// i18n key mapping for sidebar labels — the key is used for translation lookup,
// the fallback is the English default shown when translations aren't loaded yet
const NAV_ITEMS: { path: string; i18nKey: string; fallback: string; icon: LucideIcon; group: string }[] = [
  { path: '/', i18nKey: 'nav.dashboard', fallback: 'Dashboard', icon: LayoutDashboard, group: 'core' },
  { path: '/system', i18nKey: 'nav.diagnostics', fallback: 'System Info', icon: Monitor, group: 'core' },
  { path: '/performance', i18nKey: 'nav.performance', fallback: 'Performance', icon: Zap, group: 'core' },
  { path: '/malware', i18nKey: 'nav.malware', fallback: 'Malware Scan', icon: Shield, group: 'core' },
  { path: '/network', i18nKey: 'nav.network', fallback: 'Network', icon: Wifi, group: 'core' },
  { path: '/os-repair', i18nKey: 'nav.osRepair', fallback: 'OS Repair', icon: Wrench, group: 'core' },
  { path: '/battery', i18nKey: 'nav.battery', fallback: 'Battery', icon: Battery, group: 'core' },
  { path: '/data-recovery', i18nKey: 'nav.dataRecovery', fallback: 'Data Recovery', icon: HardDrive, group: 'phase2' },
  { path: '/password', i18nKey: 'nav.passwordRecovery', fallback: 'Password Recovery', icon: KeyRound, group: 'phase2' },
  { path: '/audio', i18nKey: 'nav.audio', fallback: 'Audio Fixer', icon: Volume2, group: 'phase2' },
  { path: '/bluetooth', i18nKey: 'nav.bluetooth', fallback: 'Bluetooth', icon: Bluetooth, group: 'phase2' },
  { path: '/printer', i18nKey: 'nav.printer', fallback: 'Printer', icon: Printer, group: 'phase2' },
  { path: '/display', i18nKey: 'nav.display', fallback: 'Display / GPU', icon: MonitorSpeaker, group: 'phase2' },
  { path: '/webcam', i18nKey: 'nav.webcam', fallback: 'Webcam', icon: Camera, group: 'phase2' },
  { path: '/usb', i18nKey: 'nav.usb', fallback: 'USB / Peripherals', icon: Usb, group: 'phase2' },
  { path: '/india-apps', i18nKey: 'nav.indiaApps', fallback: 'India Apps', icon: Globe, group: 'phase2' },
  { path: '/overheating', i18nKey: 'nav.overheating', fallback: 'Overheating', icon: Thermometer, group: 'phase3' },
  { path: '/hardware', i18nKey: 'nav.hardware', fallback: 'Hardware Diag', icon: Cpu, group: 'phase3' },
  { path: '/keyboard', i18nKey: 'nav.keyboard', fallback: 'Keyboard / Touchpad', icon: Keyboard, group: 'phase3' },
  { path: '/gaming', i18nKey: 'nav.gaming', fallback: 'Gaming Optimizer', icon: Gamepad2, group: 'phase3' },
  { path: '/partition', i18nKey: 'nav.partition', fallback: 'Partition / Boot', icon: HardDrive, group: 'phase3' },
  { path: '/activation', i18nKey: 'nav.activation', fallback: 'Win Activation', icon: KeyRound, group: 'phase3' },
  { path: '/email', i18nKey: 'nav.email', fallback: 'Email Setup', icon: Mail, group: 'phase3' },
  { path: '/phone', i18nKey: 'nav.phone', fallback: 'Phone Transfer', icon: Smartphone, group: 'phase3' },
  { path: '/billing', i18nKey: 'nav.billing', fallback: 'GST Billing', icon: Receipt, group: 'phase4' },
  { path: '/upi', i18nKey: 'nav.upi', fallback: 'UPI Payment', icon: QrCode, group: 'phase4' },
  { path: '/whatsapp', i18nKey: 'nav.whatsapp', fallback: 'WhatsApp', icon: MessageCircle, group: 'phase4' },
  { path: '/customers', i18nKey: 'nav.customers', fallback: 'Customers', icon: Users, group: 'phase4' },
  { path: '/jobs', i18nKey: 'nav.repairJobs', fallback: 'Repair Jobs', icon: ClipboardList, group: 'phase4' },
  { path: '/backup', i18nKey: 'nav.backup', fallback: 'Backup Wizard', icon: Database, group: 'phase4' },
  { path: '/language', i18nKey: 'settings.language', fallback: 'Language', icon: Languages, group: 'phase4' },
  { path: '/disk-imaging', i18nKey: 'nav.diskImaging', fallback: 'Disk Imaging', icon: DiscAlbum, group: 'phase6' },
  { path: '/partition-mgr', i18nKey: 'nav.partitionMgr', fallback: 'Partition Manager', icon: HardDrive, group: 'phase6' },
  { path: '/memory-diag', i18nKey: 'nav.memoryDiag', fallback: 'Memory Diagnostics', icon: MemoryStick, group: 'phase6' },
  { path: '/firmware', i18nKey: 'nav.firmware', fallback: 'Firmware / BIOS', icon: CircuitBoard, group: 'phase6' },
  { path: '/remote-access', i18nKey: 'nav.remoteAccess', fallback: 'Remote Access', icon: Radio, group: 'phase6' },
  { path: '/ai-diagnostics', i18nKey: 'nav.aiDiagnostics', fallback: 'AI Diagnostics', icon: Brain, group: 'ai' }
]

export function Sidebar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggle = useAppStore((s) => s.toggleSidebar)
  const translations = useAppStore((s) => s.translations)

  // Translate a key using loaded translations, falling back to the provided default
  const t = (key: string, fallback: string): string => translations[key] || fallback

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
              {!collapsed && <span>{t(item.i18nKey, item.fallback)}</span>}
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
