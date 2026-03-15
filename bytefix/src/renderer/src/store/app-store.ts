import { create } from 'zustand'
import type { SystemInfo, ScanResult, DiagnosticResult, Job } from '../../../../shared/types'

interface AppState {
  // System
  systemInfo: SystemInfo | null
  isLoadingSystem: boolean

  // Scan
  lastScan: ScanResult | null
  isScanning: boolean
  scanProgress: number
  scanMessage: string

  // Diagnostics
  diagnostics: DiagnosticResult[]

  // Jobs
  jobs: Job[]

  // UI
  currentPage: string
  sidebarCollapsed: boolean

  // Actions
  setSystemInfo: (info: SystemInfo) => void
  setIsLoadingSystem: (loading: boolean) => void
  setLastScan: (scan: ScanResult | null) => void
  setIsScanning: (scanning: boolean) => void
  setScanProgress: (progress: number, message: string) => void
  setDiagnostics: (diagnostics: DiagnosticResult[]) => void
  addDiagnostics: (diagnostics: DiagnosticResult[]) => void
  setJobs: (jobs: Job[]) => void
  setCurrentPage: (page: string) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  systemInfo: null,
  isLoadingSystem: false,
  lastScan: null,
  isScanning: false,
  scanProgress: 0,
  scanMessage: '',
  diagnostics: [],
  jobs: [],
  currentPage: 'dashboard',
  sidebarCollapsed: false,

  setSystemInfo: (info) => set({ systemInfo: info }),
  setIsLoadingSystem: (loading) => set({ isLoadingSystem: loading }),
  setLastScan: (scan) => set({ lastScan: scan }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),
  setScanProgress: (progress, message) => set({ scanProgress: progress, scanMessage: message }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  addDiagnostics: (newDiagnostics) => set((state) => ({
    diagnostics: [...state.diagnostics, ...newDiagnostics]
  })),
  setJobs: (jobs) => set({ jobs }),
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
}))
