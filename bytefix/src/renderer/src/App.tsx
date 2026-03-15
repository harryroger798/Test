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
import { OverheatingPage } from './pages/OverheatingPage'
import { HardwareDiagnosticsPage } from './pages/HardwareDiagnosticsPage'
import { KeyboardTouchpadPage } from './pages/KeyboardTouchpadPage'
import { GamingOptimizerPage } from './pages/GamingOptimizerPage'
import { PartitionBootPage } from './pages/PartitionBootPage'
import { WindowsActivationPage } from './pages/WindowsActivationPage'
import { EmailSetupPage } from './pages/EmailSetupPage'
import { PhoneTransferPage } from './pages/PhoneTransferPage'
import { GSTBillingPage } from './pages/GSTBillingPage'
import { UPIPaymentPage } from './pages/UPIPaymentPage'
import { WhatsAppPage } from './pages/WhatsAppPage'
import { CustomersPage } from './pages/CustomersPage'
import { RepairJobsPage } from './pages/RepairJobsPage'
import { BackupWizardPage } from './pages/BackupWizardPage'
import { LanguageSettingsPage } from './pages/LanguageSettingsPage'
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
            <Route path="/overheating" element={<OverheatingPage />} />
            <Route path="/hardware" element={<HardwareDiagnosticsPage />} />
            <Route path="/keyboard" element={<KeyboardTouchpadPage />} />
            <Route path="/gaming" element={<GamingOptimizerPage />} />
            <Route path="/partition" element={<PartitionBootPage />} />
            <Route path="/activation" element={<WindowsActivationPage />} />
            <Route path="/email" element={<EmailSetupPage />} />
            <Route path="/phone" element={<PhoneTransferPage />} />
            <Route path="/billing" element={<GSTBillingPage />} />
            <Route path="/upi" element={<UPIPaymentPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/jobs" element={<RepairJobsPage />} />
            <Route path="/backup" element={<BackupWizardPage />} />
            <Route path="/language" element={<LanguageSettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
