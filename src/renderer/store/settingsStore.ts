import { create } from 'zustand';
import { api } from '../lib/ipc';

interface ProxySettings {
  enabled: boolean;
  url: string;
  type: 'http' | 'https' | 'socks5';
}

interface Settings {
  downloadPath: string;
  theme: 'dark' | 'light' | 'system';
  proxy: ProxySettings;
  maxConcurrentDownloads: number;
  embedThumbnail: boolean;
  embedSubtitles: boolean;
  defaultVideoFormat: string;
  defaultAudioFormat: string;
  clipboardMonitoring: boolean;
  notifications: boolean;
  cookiesPath: string;
  browserCookies: string;
}

interface SettingsStore extends Settings {
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  setDownloadPath: (path: string) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setProxy: (proxy: ProxySettings) => void;
  setCookiesPath: (path: string) => void;
  setBrowserCookies: (browser: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  downloadPath: '',
  theme: 'dark',
  proxy: { enabled: false, url: '', type: 'http' },
  maxConcurrentDownloads: 2,
  embedThumbnail: false,
  embedSubtitles: false,
  defaultVideoFormat: 'best',
  defaultAudioFormat: 'mp3',
  clipboardMonitoring: false,
  notifications: true,
  cookiesPath: '',
  browserCookies: '',
  isLoaded: false,

  loadSettings: async () => {
    try {
      const settings = await api.getSettings();
      const downloadPath = (settings.downloadPath as string) || (await api.getDefaultPath());
      set({
        downloadPath,
        theme: (settings.theme as Settings['theme']) || 'dark',
        proxy: (settings.proxy as ProxySettings) || { enabled: false, url: '', type: 'http' },
        maxConcurrentDownloads: (settings.maxConcurrentDownloads as number) || 2,
        embedThumbnail: (settings.embedThumbnail as boolean) || false,
        embedSubtitles: (settings.embedSubtitles as boolean) || false,
        defaultVideoFormat: (settings.defaultVideoFormat as string) || 'best',
        defaultAudioFormat: (settings.defaultAudioFormat as string) || 'mp3',
        clipboardMonitoring: (settings.clipboardMonitoring as boolean) || false,
        notifications: (settings.notifications as boolean) ?? true,
        cookiesPath: (settings.cookiesPath as string) || '',
        browserCookies: (settings.browserCookies as string) || '',
        isLoaded: true,
      });
    } catch {
      const downloadPath = await api.getDefaultPath();
      set({ downloadPath, isLoaded: true });
    }
  },

  updateSettings: async (updates) => {
    set(updates);
    const state = get();
    await api.saveSettings({
      downloadPath: state.downloadPath,
      theme: state.theme,
      proxy: state.proxy,
      maxConcurrentDownloads: state.maxConcurrentDownloads,
      embedThumbnail: state.embedThumbnail,
      embedSubtitles: state.embedSubtitles,
      defaultVideoFormat: state.defaultVideoFormat,
      defaultAudioFormat: state.defaultAudioFormat,
      clipboardMonitoring: state.clipboardMonitoring,
      notifications: state.notifications,
      cookiesPath: state.cookiesPath,
      browserCookies: state.browserCookies,
    });
  },

  setDownloadPath: (path) => {
    set({ downloadPath: path });
    get().updateSettings({ downloadPath: path });
  },

  setTheme: (theme) => {
    set({ theme });
    get().updateSettings({ theme });
    // Apply theme to DOM
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  },

  setProxy: (proxy) => {
    set({ proxy });
    get().updateSettings({ proxy });
  },

  setCookiesPath: (path) => {
    set({ cookiesPath: path });
    get().updateSettings({ cookiesPath: path });
  },

  setBrowserCookies: (browser) => {
    set({ browserCookies: browser });
    get().updateSettings({ browserCookies: browser });
  },
}));
