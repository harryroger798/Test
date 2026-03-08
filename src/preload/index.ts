import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Video info
  fetchInfo: (url: string) => ipcRenderer.invoke('fetch-info', url),

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
  }) => ipcRenderer.invoke('start-download', options),
  cancelDownload: (downloadId: string) => ipcRenderer.invoke('cancel-download', downloadId),
  getActiveDownloads: () => ipcRenderer.invoke('get-active-downloads'),

  // Progress events
  onDownloadProgress: (callback: (progress: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onDownloadComplete: (callback: (result: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: unknown) => callback(result);
    ipcRenderer.on('download-complete', handler);
    return () => ipcRenderer.removeListener('download-complete', handler);
  },

  // File system
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
  openFileLocation: (filePath: string) => ipcRenderer.invoke('open-file-location', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('save-settings', settings),

  // System
  checkYtdlp: () => ipcRenderer.invoke('check-ytdlp'),

  // Cookie management (P2/P3)
  selectCookiesFile: () => ipcRenderer.invoke('select-cookies-file'),
  clearCookiesPath: () => ipcRenderer.invoke('clear-cookies-path'),
  setBrowserCookies: (browser: string) => ipcRenderer.invoke('set-browser-cookies', browser),

  // OAuth2 authentication
  initiateOAuth2Login: () => ipcRenderer.invoke('initiate-oauth2-login'),
  getOAuth2Status: () => ipcRenderer.invoke('get-oauth2-status'),
  removeOAuth2Token: () => ipcRenderer.invoke('remove-oauth2-token'),

  // Cobalt fallback
  getCobaltStatus: () => ipcRenderer.invoke('get-cobalt-status'),
  setCobaltEnabled: (enabled: boolean) => ipcRenderer.invoke('set-cobalt-enabled', enabled),

  // Platform info
  getPlatformInfo: (url: string) => ipcRenderer.invoke('get-platform-info', url),

  // Binary status (bundled binaries, POT provider)
  getBinaryStatus: () => ipcRenderer.invoke('get-binary-status'),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  // Binary updates
  checkBinaryUpdates: () => ipcRenderer.invoke('check-binary-updates'),
  onBinaryUpdateStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on('binary-update-status', handler);
    return () => ipcRenderer.removeListener('binary-update-status', handler);
  },

  // App version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Health monitor
  getHealthStatus: () => ipcRenderer.invoke('get-health-status'),
  runHealthCheck: () => ipcRenderer.invoke('run-health-check'),
  getFailureLog: () => ipcRenderer.invoke('get-failure-log'),
  onHealthReport: (callback: (report: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, report: unknown) => callback(report);
    ipcRenderer.on('health-report', handler);
    return () => ipcRenderer.removeListener('health-report', handler);
  },
  onHealthHeal: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('health-heal-complete', handler);
    return () => ipcRenderer.removeListener('health-heal-complete', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
