"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    // Video info
    fetchInfo: (url) => electron_1.ipcRenderer.invoke('fetch-info', url),
    // Downloads
    startDownload: (options) => electron_1.ipcRenderer.invoke('start-download', options),
    cancelDownload: (downloadId) => electron_1.ipcRenderer.invoke('cancel-download', downloadId),
    getActiveDownloads: () => electron_1.ipcRenderer.invoke('get-active-downloads'),
    // Progress events
    onDownloadProgress: (callback) => {
        const handler = (_event, progress) => callback(progress);
        electron_1.ipcRenderer.on('download-progress', handler);
        return () => electron_1.ipcRenderer.removeListener('download-progress', handler);
    },
    onDownloadComplete: (callback) => {
        const handler = (_event, result) => callback(result);
        electron_1.ipcRenderer.on('download-complete', handler);
        return () => electron_1.ipcRenderer.removeListener('download-complete', handler);
    },
    // File system
    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),
    getDefaultPath: () => electron_1.ipcRenderer.invoke('get-default-path'),
    openFileLocation: (filePath) => electron_1.ipcRenderer.invoke('open-file-location', filePath),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    // System
    checkYtdlp: () => electron_1.ipcRenderer.invoke('check-ytdlp'),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
//# sourceMappingURL=index.js.map