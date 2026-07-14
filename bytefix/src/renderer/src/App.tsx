import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineIndicator } from './components/OfflineIndicator'
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
import { DiskImagingPage } from './pages/DiskImagingPage'
import { PartitionManagerPage } from './pages/PartitionManagerPage'
import { MemoryDiagnosticsPage } from './pages/MemoryDiagnosticsPage'
import { FirmwareBiosPage } from './pages/FirmwareBiosPage'
import { RemoteAccessPage } from './pages/RemoteAccessPage'
import { AIDiagnosticsPage } from './pages/AIDiagnosticsPage'
import { AIProviderSettingsPage } from './pages/AIProviderSettingsPage'
import { ActivityLogPage } from './pages/ActivityLogPage'
import { useAppStore } from './store/app-store'

export default function App(): JSX.Element {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const loadLanguage = useAppStore((s) => s.loadLanguage)

  // Load saved language preference and translations on startup
  useEffect(() => {
    loadLanguage()
  }, [loadLanguage])

  return (
    <ErrorBoundary module="app-root">
      <div className="flex h-screen overflow-hidden bg-surface">
        <Sidebar />
        <main
          className={`flex-1 overflow-y-auto transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          }`}
        >
          <div className="p-6 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<ErrorBoundary module="dashboard"><Dashboard /></ErrorBoundary>} />
              <Route path="/system" element={<ErrorBoundary module="system-info"><SystemInfoPage /></ErrorBoundary>} />
              <Route path="/performance" element={<ErrorBoundary module="performance"><PerformancePage /></ErrorBoundary>} />
              <Route path="/malware" element={<ErrorBoundary module="malware"><MalwarePage /></ErrorBoundary>} />
              <Route path="/network" element={<ErrorBoundary module="network"><NetworkPage /></ErrorBoundary>} />
              <Route path="/os-repair" element={<ErrorBoundary module="os-repair"><OSRepairPage /></ErrorBoundary>} />
              <Route path="/battery" element={<ErrorBoundary module="battery"><BatteryPage /></ErrorBoundary>} />
              <Route path="/data-recovery" element={<ErrorBoundary module="data-recovery"><DataRecoveryPage /></ErrorBoundary>} />
              <Route path="/password" element={<ErrorBoundary module="password-recovery"><PasswordRecoveryPage /></ErrorBoundary>} />
              <Route path="/audio" element={<ErrorBoundary module="audio"><AudioFixerPage /></ErrorBoundary>} />
              <Route path="/bluetooth" element={<ErrorBoundary module="bluetooth"><BluetoothFixerPage /></ErrorBoundary>} />
              <Route path="/printer" element={<ErrorBoundary module="printer"><PrinterFixerPage /></ErrorBoundary>} />
              <Route path="/display" element={<ErrorBoundary module="display"><DisplayFixerPage /></ErrorBoundary>} />
              <Route path="/webcam" element={<ErrorBoundary module="webcam"><WebcamFixerPage /></ErrorBoundary>} />
              <Route path="/usb" element={<ErrorBoundary module="usb"><UsbFixerPage /></ErrorBoundary>} />
              <Route path="/india-apps" element={<ErrorBoundary module="india-apps"><IndiaAppsPage /></ErrorBoundary>} />
              <Route path="/overheating" element={<ErrorBoundary module="overheating"><OverheatingPage /></ErrorBoundary>} />
              <Route path="/hardware" element={<ErrorBoundary module="hardware"><HardwareDiagnosticsPage /></ErrorBoundary>} />
              <Route path="/keyboard" element={<ErrorBoundary module="keyboard"><KeyboardTouchpadPage /></ErrorBoundary>} />
              <Route path="/gaming" element={<ErrorBoundary module="gaming"><GamingOptimizerPage /></ErrorBoundary>} />
              <Route path="/partition" element={<ErrorBoundary module="partition"><PartitionBootPage /></ErrorBoundary>} />
              <Route path="/activation" element={<ErrorBoundary module="activation"><WindowsActivationPage /></ErrorBoundary>} />
              <Route path="/email" element={<ErrorBoundary module="email"><EmailSetupPage /></ErrorBoundary>} />
              <Route path="/phone" element={<ErrorBoundary module="phone"><PhoneTransferPage /></ErrorBoundary>} />
              <Route path="/billing" element={<ErrorBoundary module="billing"><GSTBillingPage /></ErrorBoundary>} />
              <Route path="/upi" element={<ErrorBoundary module="upi"><UPIPaymentPage /></ErrorBoundary>} />
              <Route path="/whatsapp" element={<ErrorBoundary module="whatsapp"><WhatsAppPage /></ErrorBoundary>} />
              <Route path="/customers" element={<ErrorBoundary module="customers"><CustomersPage /></ErrorBoundary>} />
              <Route path="/jobs" element={<ErrorBoundary module="jobs"><RepairJobsPage /></ErrorBoundary>} />
              <Route path="/backup" element={<ErrorBoundary module="backup"><BackupWizardPage /></ErrorBoundary>} />
              <Route path="/language" element={<ErrorBoundary module="language"><LanguageSettingsPage /></ErrorBoundary>} />
              <Route path="/disk-imaging" element={<ErrorBoundary module="disk-imaging"><DiskImagingPage /></ErrorBoundary>} />
              <Route path="/partition-mgr" element={<ErrorBoundary module="partition-mgr"><PartitionManagerPage /></ErrorBoundary>} />
              <Route path="/memory-diag" element={<ErrorBoundary module="memory-diag"><MemoryDiagnosticsPage /></ErrorBoundary>} />
              <Route path="/firmware" element={<ErrorBoundary module="firmware"><FirmwareBiosPage /></ErrorBoundary>} />
              <Route path="/remote-access" element={<ErrorBoundary module="remote-access"><RemoteAccessPage /></ErrorBoundary>} />
              <Route path="/ai-diagnostics" element={<ErrorBoundary module="ai-diagnostics"><AIDiagnosticsPage /></ErrorBoundary>} />
              <Route path="/ai-settings" element={<ErrorBoundary module="ai-settings"><AIProviderSettingsPage /></ErrorBoundary>} />
              <Route path="/activity" element={<ErrorBoundary module="activity-log"><ActivityLogPage /></ErrorBoundary>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  )
}
