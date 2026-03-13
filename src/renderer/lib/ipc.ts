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
    thumbnail?: string;
    videoTitle?: string;
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
  // Ban Prevention
  getBanPreventionStatus: () => Promise<{
    platforms: Record<string, {
      platform: string;
      downloadsThisHour: number;
      downloadsToday: number;
      lastDownloadTime: number;
      riskLevel: 'safe' | 'warning' | 'danger';
      cookielessMode: boolean;
      cooldownUntil: number;
      totalDownloads: number;
    }>;
    globalRiskLevel: 'safe' | 'warning' | 'danger';
    activeCooldowns: number;
    cookielessPlatforms: string[];
  }>;
  getBanPreventionPlatformStats: (platform: string) => Promise<{
    platform: string;
    downloadsThisHour: number;
    downloadsToday: number;
    lastDownloadTime: number;
    riskLevel: 'safe' | 'warning' | 'danger';
    cookielessMode: boolean;
    cooldownUntil: number;
    totalDownloads: number;
  }>;
  checkBanPrevention: (platform: string) => Promise<{
    allowed: boolean;
    reason?: string;
    waitMs: number;
    riskLevel: 'safe' | 'warning' | 'danger';
    cookielessRecommended: boolean;
    cooldownRemaining: number;
  }>;
  resetBanPreventionPlatform: (platform: string) => Promise<{ success: boolean }>;
  resetBanPreventionAll: () => Promise<{ success: boolean }>;
  setBanPreventionEnabled: (enabled: boolean) => Promise<{ success: boolean }>;
  setRandomDelayEnabled: (enabled: boolean) => Promise<{ success: boolean }>;
  getBanPreventionSettings: () => Promise<{ enabled: boolean; randomDelayEnabled: boolean }>;
  resetCookielessMode: (platform: string) => Promise<{ success: boolean }>;
  onBanPreventionWarning: (callback: (data: unknown) => void) => () => void;
  // Player
  selectMediaFile: () => Promise<{ success: boolean; path?: string; name?: string; type?: 'video' | 'audio' }>;
  detectSubtitles: (filePath: string) => Promise<Array<{ path: string; label: string; lang: string }>>;
  extractEmbeddedSubtitles: (filePath: string) => Promise<Array<{ path: string; label: string; lang: string }>>;
  getPlaybackPosition: (filePath: string) => Promise<number>;
  savePlaybackPosition: (filePath: string, position: number) => Promise<{ success: boolean }>;
  getPlayerPlaylist: () => Promise<Array<{ path: string; name: string; type: 'video' | 'audio' }>>;
  // Converter
  checkConversionAllowed: () => Promise<{ allowed: boolean; reason?: string; remaining?: number; tier?: string; maxSizeMB?: number }>;
  startConversion: (options: { inputPath: string; outputFormat: string; outputDir?: string; options?: Record<string, string> }) => Promise<{ success: boolean; conversionId?: string; error?: string }>;
  cancelConversion: (conversionId: string) => Promise<{ success: boolean }>;
  getConversionStats: () => Promise<{ date: string; count: number; tier: string; remaining: number; maxSizeMB: number }>;
  selectConvertFile: () => Promise<{ success: boolean; path?: string; name?: string; size?: number }>;
  selectOutputDirectory: () => Promise<{ success: boolean; path?: string }>;
  openFileInFolder: (filePath: string) => Promise<{ success: boolean }>;
  onConversionProgress: (callback: (data: { conversionId: string; progress: number }) => void) => () => void;
  onConversionComplete: (callback: (data: { conversionId: string; success: boolean; outputPath?: string; error?: string }) => void) => () => void;
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
  // Ban Prevention mocks
  getBanPreventionStatus: async () => ({
    platforms: {},
    globalRiskLevel: 'safe' as const,
    activeCooldowns: 0,
    cookielessPlatforms: [],
  }),
  getBanPreventionPlatformStats: async () => ({
    platform: 'unknown',
    downloadsThisHour: 0,
    downloadsToday: 0,
    lastDownloadTime: 0,
    riskLevel: 'safe' as const,
    cookielessMode: false,
    cooldownUntil: 0,
    totalDownloads: 0,
  }),
  checkBanPrevention: async () => ({
    allowed: true,
    waitMs: 0,
    riskLevel: 'safe' as const,
    cookielessRecommended: false,
    cooldownRemaining: 0,
  }),
  resetBanPreventionPlatform: async () => ({ success: true }),
  resetBanPreventionAll: async () => ({ success: true }),
  setBanPreventionEnabled: async () => ({ success: true }),
  setRandomDelayEnabled: async () => ({ success: true }),
  getBanPreventionSettings: async () => ({ enabled: true, randomDelayEnabled: true }),
  resetCookielessMode: async () => ({ success: true }),
  onBanPreventionWarning: () => () => {},
  // Player mocks
  selectMediaFile: async () => ({ success: false }),
  detectSubtitles: async () => [],
  extractEmbeddedSubtitles: async () => [],
  getPlaybackPosition: async () => 0,
  savePlaybackPosition: async () => ({ success: true }),
  getPlayerPlaylist: async () => [],
  // Converter mocks
  checkConversionAllowed: async () => ({ allowed: true, remaining: 3, tier: 'free', maxSizeMB: 500 }),
  startConversion: async () => ({ success: false, error: 'Not running in Electron' }),
  cancelConversion: async () => ({ success: true }),
  getConversionStats: async () => ({ date: '', count: 0, tier: 'free', remaining: 3, maxSizeMB: 500 }),
  selectConvertFile: async () => ({ success: false }),
  selectOutputDirectory: async () => ({ success: false }),
  openFileInFolder: async () => ({ success: true }),
  onConversionProgress: () => () => {},
  onConversionComplete: () => () => {},
};

export const api: ElectronAPI = isElectron ? window.electronAPI : mockAPI;

// Type augment window
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
