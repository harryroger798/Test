import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { SystemInfoPage } from './pages/SystemInfoPage'
import { PerformancePage } from './pages/PerformancePage'
import { MalwarePage } from './pages/MalwarePage'
import { NetworkPage } from './pages/NetworkPage'
import { OSRepairPage } from './pages/OSRepairPage'
import { BatteryPage } from './pages/BatteryPage'
import { DataRecoveryPage } from './pages/DataRecoveryPage'
import { PasswordRecoveryPage } from './pages/PasswordRecoveryPage'
import { AudioFixerPage } from './pages/AudioFixerPage'
import { BluetoothFixerPage } from './pages/BluetoothFixerPage'
import { PrinterFixerPage } from './pages/PrinterFixerPage'
import { DisplayFixerPage } from './pages/DisplayFixerPage'
import { WebcamFixerPage } from './pages/WebcamFixerPage'
import { UsbFixerPage } from './pages/UsbFixerPage'
import { IndiaAppsPage } from './pages/IndiaAppsPage'
import { useAppStore } from './store/app-store'

export default function App(): JSX.Element {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="p-6 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/system" element={<SystemInfoPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/malware" element={<MalwarePage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/os-repair" element={<OSRepairPage />} />
            <Route path="/battery" element={<BatteryPage />} />
            <Route path="/data-recovery" element={<DataRecoveryPage />} />
            <Route path="/password" element={<PasswordRecoveryPage />} />
            <Route path="/audio" element={<AudioFixerPage />} />
            <Route path="/bluetooth" element={<BluetoothFixerPage />} />
            <Route path="/printer" element={<PrinterFixerPage />} />
            <Route path="/display" element={<DisplayFixerPage />} />
            <Route path="/webcam" element={<WebcamFixerPage />} />
            <Route path="/usb" element={<UsbFixerPage />} />
            <Route path="/india-apps" element={<IndiaAppsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
