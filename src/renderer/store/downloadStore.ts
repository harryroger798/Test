import { create } from 'zustand';
import { api } from '../lib/ipc';

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  durationString: string;
  uploader: string;
  uploaderUrl: string;
  viewCount: number;
  likeCount: number;
  uploadDate: string;
  webpage_url: string;
  extractor: string;
  platform: string;
  formats: VideoFormat[];
  subtitles: Record<string, Array<{ ext: string; url: string }>>;
  requestedSubtitles: Record<string, unknown> | null;
}

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  vcodec: string;
  acodec: string;
  fps: number | null;
  tbr: number | null;
  quality: string;
  hasVideo: boolean;
  hasAudio: boolean;
  note: string;
}

export interface DownloadProgress {
  downloadId: string;
  status: 'downloading' | 'processing' | 'finished' | 'error';
  percent: number;
  speed: string;
  eta: string;
  filesize: string;
  filename: string;
  error?: string;
}

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  platform: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';
  progress: number;
  speed: string;
  eta: string;
  filesize: string;
  filename: string;
  outputPath: string;
  audioOnly: boolean;
  error?: string;
  completedAt?: string;
}

interface DownloadStore {
  // URL & Info
  url: string;
  setUrl: (url: string) => void;
  videoInfo: VideoInfo | null;
  setVideoInfo: (info: VideoInfo | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Download options
  selectedFormat: string;
  setSelectedFormat: (format: string) => void;
  audioOnly: boolean;
  setAudioOnly: (audioOnly: boolean) => void;
  audioFormat: string;
  setAudioFormat: (format: string) => void;
  embedSubs: boolean;
  setEmbedSubs: (embed: boolean) => void;
  embedThumbnail: boolean;
  setEmbedThumbnail: (embed: boolean) => void;

  // Downloads
  downloads: DownloadItem[];
  addDownload: (item: DownloadItem) => void;
  updateDownload: (id: string, update: Partial<DownloadItem>) => void;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;

  // History
  history: DownloadItem[];
  addToHistory: (item: DownloadItem) => void;
  clearHistory: () => void;

  // Actions
  fetchVideoInfo: (url: string) => Promise<void>;
  startDownload: (outputPath: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  reset: () => void;

  // Navigation
  currentPage: 'home' | 'video' | 'audio' | 'player' | 'convert' | 'settings' | 'help';
  setCurrentPage: (page: 'home' | 'video' | 'audio' | 'player' | 'convert' | 'settings' | 'help') => void;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  // URL & Info
  url: '',
  setUrl: (url) => set({ url }),
  videoInfo: null,
  setVideoInfo: (info) => set({ videoInfo: info }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  // Download options
  selectedFormat: 'best',
  setSelectedFormat: (format) => set({ selectedFormat: format }),
  audioOnly: false,
  setAudioOnly: (audioOnly) => set({ audioOnly }),
  audioFormat: 'mp3',
  setAudioFormat: (format) => set({ audioFormat: format }),
  embedSubs: false,
  setEmbedSubs: (embed) => set({ embedSubs: embed }),
  embedThumbnail: false,
  setEmbedThumbnail: (embed) => set({ embedThumbnail: embed }),

  // Downloads
  downloads: [],
  addDownload: (item) => set((state) => ({ downloads: [...state.downloads, item] })),
  updateDownload: (id, update) =>
    set((state) => ({
      downloads: state.downloads.map((d) => (d.id === id ? { ...d, ...update } : d)),
    })),
  removeDownload: (id) =>
    set((state) => ({
      downloads: state.downloads.filter((d) => d.id !== id),
    })),
  clearCompleted: () =>
    set((state) => ({
      downloads: state.downloads.filter((d) => d.status !== 'completed' && d.status !== 'error' && d.status !== 'cancelled'),
    })),

  // History
  history: (() => {
    try {
      const raw = localStorage.getItem('grabtube-history');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Validate each item has required fields to handle schema changes
      return parsed.filter((item: unknown): item is DownloadItem => {
        const d = item as Record<string, unknown>;
        return typeof d?.id === 'string' && typeof d?.url === 'string' && typeof d?.status === 'string';
      });
    } catch {
      return [];
    }
  })(),
  addToHistory: (item) =>
    set((state) => {
      const newHistory = [item, ...state.history].slice(0, 100);
      try {
        localStorage.setItem('grabtube-history', JSON.stringify(newHistory));
      } catch (e) {
        console.warn('Failed to persist history to localStorage:', e);
      }
      return { history: newHistory };
    }),
  clearHistory: () => {
    localStorage.removeItem('grabtube-history');
    set({ history: [] });
  },

  // Actions
  fetchVideoInfo: async (url) => {
    set({ isLoading: true, error: null, videoInfo: null });
    try {
      const result = await api.fetchInfo(url);
      if (result.success) {
        set({ videoInfo: result.data as VideoInfo, isLoading: false });
      } else {
        set({ error: result.error || 'Failed to fetch video info', isLoading: false });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      set({ error: message, isLoading: false });
    }
  },

  startDownload: async (outputPath) => {
    const state = get();
    if (!state.videoInfo) return;

    const downloadItem: DownloadItem = {
      id: Date.now().toString(),
      url: state.url,
      title: state.videoInfo.title,
      thumbnail: state.videoInfo.thumbnail,
      platform: state.videoInfo.platform,
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      filesize: '',
      filename: '',
      outputPath,
      audioOnly: state.audioOnly,
    };

    set((s) => ({ downloads: [...s.downloads, downloadItem] }));

    try {
      const result = await api.startDownload({
        url: state.url,
        formatId: state.selectedFormat,
        outputPath,
        filename: `${state.videoInfo.title.replace(/[/\\:*?"<>|]/g, '_').replace(/\.\./g, '_').replace(/[\x00-\x1f]/g, '').trim().slice(0, 200)}.%(ext)s`,
        audioOnly: state.audioOnly,
        audioFormat: state.audioOnly ? state.audioFormat : undefined,
        embedSubs: state.embedSubs,
        embedThumbnail: state.embedThumbnail,
        thumbnail: state.videoInfo.thumbnail,
        videoTitle: state.videoInfo.title,
      });

      if (result.success) {
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.id === downloadItem.id ? { ...d, id: result.downloadId || d.id, status: 'downloading' } : d
          ),
        }));
      } else {
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.id === downloadItem.id ? { ...d, status: 'error', error: result.error } : d
          ),
        }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Download failed';
      set((s) => ({
        downloads: s.downloads.map((d) =>
          d.id === downloadItem.id ? { ...d, status: 'error', error: message } : d
        ),
      }));
    }
  },

  cancelDownload: async (id) => {
    await api.cancelDownload(id);
    set((state) => ({
      downloads: state.downloads.map((d) => (d.id === id ? { ...d, status: 'cancelled' } : d)),
    }));
  },

  reset: () => set({ url: '', videoInfo: null, error: null, selectedFormat: 'best', audioOnly: false }),

  // Navigation
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page }),
}));
