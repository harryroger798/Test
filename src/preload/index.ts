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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
