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
  // OAuth2 authentication
  initiateOAuth2Login: () => Promise<{ success: boolean; error?: string }>;
  getOAuth2Status: () => Promise<{ authenticated: boolean }>;
  removeOAuth2Token: () => Promise<{ success: boolean }>;
  // Cobalt fallback
  getCobaltStatus: () => Promise<{ enabled: boolean }>;
  setCobaltEnabled: (enabled: boolean) => Promise<{ success: boolean }>;
  // Platform info
  getPlatformInfo: (url: string) => Promise<{
    platform: string;
    requiresCookies: boolean;
    cookiesHint: string;
    hasImpersonation: boolean;
  }>;
  // App version
  getAppVersion: () => Promise<{ version: string }>;
  // Setup wizard
  detectBrowsers: () => Promise<Array<{ name: string; installed: boolean }>>;
  verifyBrowserCookies: (browser?: string) => Promise<{ success: boolean; browser?: string; error?: string }>;
  getSetupComplete: () => Promise<{ complete: boolean }>;
  setSetupComplete: () => Promise<{ success: boolean }>;
  // Feature tour
  getFeatureTourComplete: () => Promise<{ complete: boolean }>;
  setFeatureTourComplete: () => Promise<{ success: boolean }>;
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
  // License management
  onLicenseTierChanged: (callback: (data: unknown) => void) => () => void;
  getLicenseState: () => Promise<{
    tier: 'free' | 'pro' | 'family';
    key: string;
    deviceId: string;
    activated: boolean;
    validatedAt: string;
    maxDevices: number;
    devicesUsed: number;
    offlineGraceDays: number;
  }>;
  getTierLimits: () => Promise<{
    maxDownloadsPerDay: number;
    maxQuality: string;
    maxConcurrent: number;
    batchDownload: boolean;
    playlistDownload: boolean;
    cooldownSeconds: number;
  }>;
  activateLicense: (key: string) => Promise<{ success: boolean; error?: string; tier?: string }>;
  deactivateLicense: () => Promise<{ success: boolean; error?: string }>;
  validateLicense: () => Promise<{ valid: boolean; tier: string; offline?: boolean }>;
  checkDownloadAllowed: () => Promise<{ allowed: boolean; reason?: string }>;
  getDownloadStats: () => Promise<{
    tier: string;
    dailyCount: number;
    remaining: number;
    limits: { maxDownloadsPerDay: number; maxQuality: string; maxConcurrent: number; batchDownload: boolean; playlistDownload: boolean; cooldownSeconds: number };
    rateLimitStatus: { inBackoff: boolean; backoffUntil: number; consecutiveBans: number; backoffMinutes: number };
  }>;
  checkQualityAllowed: (height: number) => Promise<{ allowed: boolean }>;
  checkPlaylistAllowed: () => Promise<{ allowed: boolean }>;
  resetRateLimiter: () => Promise<{ success: boolean }>;
  onRateLimitWarning: (callback: (status: unknown) => void) => () => void;
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
  // OAuth2 mocks
  initiateOAuth2Login: async () => ({ success: false, error: 'Not running in Electron' }),
  getOAuth2Status: async () => ({ authenticated: false }),
  removeOAuth2Token: async () => ({ success: true }),
  // Cobalt mocks
  getCobaltStatus: async () => ({ enabled: true }),
  setCobaltEnabled: async () => ({ success: true }),
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
  // App version mock
  getAppVersion: async () => ({ version: '1.0.13' }),
  // Setup wizard mocks
  detectBrowsers: async () => [{ name: 'chrome', installed: true }, { name: 'firefox', installed: false }, { name: 'edge', installed: true }],
  verifyBrowserCookies: async () => ({ success: true, browser: 'chrome' }),
  getSetupComplete: async () => ({ complete: true }),
  setSetupComplete: async () => ({ success: true }),
  // Feature tour mocks
  getFeatureTourComplete: async () => ({ complete: false }),
  setFeatureTourComplete: async () => ({ success: true }),
  // Health monitor mocks
  getHealthStatus: async () => [],
  runHealthCheck: async () => [],
  getFailureLog: async () => [],
  onHealthReport: () => () => {},
  onHealthHeal: () => () => {},
  // License mocks
  onLicenseTierChanged: () => () => {},
  getLicenseState: async () => ({
    tier: 'free' as const,
    key: '',
    deviceId: 'mock-device-id',
    activated: false,
    validatedAt: '',
    maxDevices: 0,
    devicesUsed: 0,
    offlineGraceDays: 90,
  }),
  getTierLimits: async () => ({
    maxDownloadsPerDay: 5,
    maxQuality: '1080',
    maxConcurrent: 1,
    batchDownload: false,
    playlistDownload: false,
    cooldownSeconds: 30,
  }),
  activateLicense: async () => ({ success: false, error: 'Not running in Electron' }),
  deactivateLicense: async () => ({ success: false, error: 'Not running in Electron' }),
  validateLicense: async () => ({ valid: true, tier: 'free' }),
  checkDownloadAllowed: async () => ({ allowed: true }),
  getDownloadStats: async () => ({
    tier: 'free',
    dailyCount: 0,
    remaining: 5,
    limits: { maxDownloadsPerDay: 5, maxQuality: '1080', maxConcurrent: 1, batchDownload: false, playlistDownload: false, cooldownSeconds: 30 },
    rateLimitStatus: { inBackoff: false, backoffUntil: 0, consecutiveBans: 0, backoffMinutes: 0 },
  }),
  checkQualityAllowed: async () => ({ allowed: true }),
  checkPlaylistAllowed: async () => ({ allowed: false }),
  resetRateLimiter: async () => ({ success: true }),
  onRateLimitWarning: () => () => {},
};

export const api: ElectronAPI = isElectron ? window.electronAPI : mockAPI;

// Type augment window
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
