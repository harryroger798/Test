// ElectronAPI type definition (mirrors preload/index.ts)
export interface ElectronAPI {
  // Video info
  fetchInfo: (url: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  // Downloads
  startDownload: (options: {
    url: string;
    formatId: string;
    outputPath: string;
    filename: string;
    audioOnly: boolean;
    audioFormat?: string;
    embedSubs?: boolean;
    embedThumbnail?: boolean;
  }) => Promise<{ success: boolean; downloadId?: string; error?: string }>;
  cancelDownload: (downloadId: string) => Promise<{ success: boolean }>;
  getActiveDownloads: () => Promise<unknown[]>;
  // Progress events
  onDownloadProgress: (callback: (progress: unknown) => void) => () => void;
  onDownloadComplete: (callback: (result: unknown) => void) => () => void;
  // File system
  selectFolder: () => Promise<{ success: boolean; path?: string }>;
  getDefaultPath: () => Promise<string>;
  openFileLocation: (filePath: string) => Promise<{ success: boolean }>;
  openExternal: (url: string) => Promise<{ success: boolean }>;
  // Settings
  getSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (settings: Record<string, unknown>) => Promise<{ success: boolean }>;
  // System
  checkYtdlp: () => Promise<{ available: boolean; version: string | null }>;
  // Cookie management (P2/P3)
  selectCookiesFile: () => Promise<{ success: boolean; path?: string }>;
  clearCookiesPath: () => Promise<{ success: boolean }>;
  setBrowserCookies: (browser: string) => Promise<{ success: boolean }>;
  // Platform info
  getPlatformInfo: (url: string) => Promise<{
    platform: string;
    requiresCookies: boolean;
    cookiesHint: string;
    hasImpersonation: boolean;
  }>;
  // Binary status
  getBinaryStatus: () => Promise<{
    ytdlp: { path: string; bundled: boolean; available: boolean };
    ffmpeg: { path: string; bundled: boolean; available: boolean };
    potProvider: { path: string; bundled: boolean; available: boolean; running: boolean };
    pluginDir: { path: string; exists: boolean };
  }>;
  // Auto-update
  checkForUpdates: () => Promise<{ available: boolean; version?: string } | null>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (callback: (status: unknown) => void) => () => void;
  // Binary updates
  checkBinaryUpdates: () => Promise<{ success: boolean }>;
  onBinaryUpdateStatus: (callback: (status: unknown) => void) => () => void;
  // Health monitor
  getHealthStatus: () => Promise<Array<{ component: string; status: string; lastCheck: number; message: string }>>;
  runHealthCheck: () => Promise<Array<{ component: string; status: string; lastCheck: number; message: string }>>;
  getFailureLog: () => Promise<Array<{ binary: string; platform: string; error: string; timestamp: number; healed: boolean }>>;
  onHealthReport: (callback: (report: unknown) => void) => () => void;
  onHealthHeal: (callback: (data: unknown) => void) => () => void;
}

// Type-safe access to electron API
// In development (browser), provide mock implementations
const isElectron = typeof window !== 'undefined' && window.electronAPI;

const mockAPI: ElectronAPI = {
  fetchInfo: async () => ({ success: false, error: 'Not running in Electron' }),
  startDownload: async () => ({ success: false, error: 'Not running in Electron' }),
  cancelDownload: async () => ({ success: false }),
  getActiveDownloads: async () => [],
  onDownloadProgress: () => () => {},
  onDownloadComplete: () => () => {},
  selectFolder: async () => ({ success: false }),
  getDefaultPath: async () => '/tmp',
  openFileLocation: async () => ({ success: true }),
  openExternal: async () => ({ success: true }),
  getSettings: async () => ({
    downloadPath: '',
    theme: 'dark' as const,
    proxy: { enabled: false, url: '', type: 'http' as const },
    maxConcurrentDownloads: 2,
    embedThumbnail: false,
    embedSubtitles: false,
    defaultVideoFormat: 'best',
    defaultAudioFormat: 'mp3',
    clipboardMonitoring: false,
    notifications: true,
    downloadHistory: [],
    cookiesPath: '',
    browserCookies: '',
  }),
  saveSettings: async () => ({ success: true }),
  checkYtdlp: async () => ({ available: false, version: null }),
  selectCookiesFile: async () => ({ success: false }),
  clearCookiesPath: async () => ({ success: true }),
  setBrowserCookies: async () => ({ success: true }),
  getPlatformInfo: async () => ({ platform: 'unknown', requiresCookies: false, cookiesHint: '', hasImpersonation: false }),
  getBinaryStatus: async () => ({
    ytdlp: { path: '', bundled: false, available: false },
    ffmpeg: { path: '', bundled: false, available: false },
    potProvider: { path: '', bundled: false, available: false, running: false },
    pluginDir: { path: '', exists: false },
  }),
  // Auto-update mocks
  checkForUpdates: async () => ({ available: false }),
  installUpdate: async () => {},
  onUpdateStatus: () => () => {},
  // Binary updates mocks
  checkBinaryUpdates: async () => ({ success: true }),
  onBinaryUpdateStatus: () => () => {},
  // Health monitor mocks
  getHealthStatus: async () => [],
  runHealthCheck: async () => [],
  getFailureLog: async () => [],
  onHealthReport: () => () => {},
  onHealthHeal: () => () => {},
};

export const api: ElectronAPI = isElectron ? window.electronAPI : mockAPI;

// Type augment window
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
