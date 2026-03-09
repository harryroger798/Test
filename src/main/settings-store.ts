import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface AppSettings {
  downloadPath: string;
  theme: 'dark' | 'light' | 'system';
  proxy: {
    enabled: boolean;
    url: string;
    type: 'http' | 'https' | 'socks5';
  };
  maxConcurrentDownloads: number;
  embedThumbnail: boolean;
  embedSubtitles: boolean;
  defaultVideoFormat: string;
  defaultAudioFormat: string;
  clipboardMonitoring: boolean;
  notifications: boolean;
  downloadHistory: HistoryItem[];
  cookiesPath: string;
  browserCookies: string;
  setupComplete: boolean;
  featureTourComplete: boolean;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  platform: string;
  thumbnail: string;
  downloadedAt: string;
  filePath: string;
  fileSize: string;
  format: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  downloadPath: '',
  theme: 'dark',
  proxy: {
    enabled: false,
    url: '',
    type: 'http',
  },
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
  setupComplete: false,
  featureTourComplete: false,
};

export class SettingsManager {
  private settingsPath: string;
  private settings: AppSettings;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || path.join(process.env.HOME || '', '.grabtube');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch {
      // Return defaults on error
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
    } catch {
      // Silently fail
    }
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  getAll(): AppSettings {
    return { ...this.settings };
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  setAll(newSettings: Record<string, unknown>): void {
    this.settings = { ...this.settings, ...newSettings } as AppSettings;
    this.save();
  }

  addHistoryItem(item: HistoryItem): void {
    this.settings.downloadHistory.unshift(item);
    // Keep only last 100 items
    if (this.settings.downloadHistory.length > 100) {
      this.settings.downloadHistory = this.settings.downloadHistory.slice(0, 100);
    }
    this.save();
  }

  clearHistory(): void {
    this.settings.downloadHistory = [];
    this.save();
  }
}
