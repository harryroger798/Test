import type { ElectronAPI } from '../../preload/index';

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
  }),
  saveSettings: async () => ({ success: true }),
  checkYtdlp: async () => ({ available: false, version: null }),
};

export const api: ElectronAPI = isElectron ? window.electronAPI : mockAPI;

// Type augment window
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
