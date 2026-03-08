declare const electronAPI: {
    fetchInfo: (url: string) => Promise<any>;
    startDownload: (options: {
        url: string;
        formatId: string;
        outputPath: string;
        filename: string;
        audioOnly: boolean;
        audioFormat?: string;
        embedSubs?: boolean;
        embedThumbnail?: boolean;
    }) => Promise<any>;
    cancelDownload: (downloadId: string) => Promise<any>;
    getActiveDownloads: () => Promise<any>;
    onDownloadProgress: (callback: (progress: unknown) => void) => () => Electron.IpcRenderer;
    onDownloadComplete: (callback: (result: unknown) => void) => () => Electron.IpcRenderer;
    selectFolder: () => Promise<any>;
    getDefaultPath: () => Promise<any>;
    openFileLocation: (filePath: string) => Promise<any>;
    openExternal: (url: string) => Promise<any>;
    getSettings: () => Promise<any>;
    saveSettings: (settings: Record<string, unknown>) => Promise<any>;
    checkYtdlp: () => Promise<any>;
};
export type ElectronAPI = typeof electronAPI;
export {};
//# sourceMappingURL=index.d.ts.map