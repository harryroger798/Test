import { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { YtdlpManager } from './ytdlp-manager';
import { DownloadManager } from './download-manager';
import { SettingsManager } from './settings-store';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const ytdlp = new YtdlpManager();
const downloadManager = new DownloadManager(ytdlp);
const settings = new SettingsManager();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'GrabTube',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#0f172a',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (downloadManager.hasActiveDownloads()) {
      event.preventDefault();
      const choice = dialog.showMessageBoxSync(mainWindow!, {
        type: 'question',
        buttons: ['Cancel', 'Quit Anyway'],
        defaultId: 0,
        title: 'Downloads in Progress',
        message: 'There are active downloads. Are you sure you want to quit?',
      });
      if (choice === 1) {
        downloadManager.cancelAll();
        mainWindow?.destroy();
      }
    }
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../../resources/icon.png');
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show GrabTube', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => { downloadManager.cancelAll(); app.quit(); } },
    ]);
    tray.setToolTip('GrabTube');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow?.show());
  } catch {
    // Tray icon not available, skip
  }
}

// IPC Handlers
function setupIPC(): void {
  // Fetch video info (uses retry with platform-specific bypass)
  ipcMain.handle('fetch-info', async (_event, url: string) => {
    try {
      const proxySettings = settings.get('proxy') as { enabled: boolean; url: string } | undefined;
      const proxy = proxySettings?.enabled ? proxySettings.url : undefined;
      const cookiesPath = settings.get('cookiesPath') as string | undefined;
      const browserCookies = settings.get('browserCookies') as string | undefined;
      const info = await ytdlp.getVideoInfoWithRetry(url, proxy, cookiesPath || undefined, browserCookies || undefined);
      return { success: true, data: info };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch video info';
      return { success: false, error: message };
    }
  });

  // Start download
  ipcMain.handle('start-download', async (_event, options: {
    url: string;
    formatId: string;
    outputPath: string;
    filename: string;
    audioOnly: boolean;
    audioFormat?: string;
    embedSubs?: boolean;
    embedThumbnail?: boolean;
  }) => {
    try {
      const proxySettings = settings.get('proxy') as { enabled: boolean; url: string } | undefined;
      const proxy = proxySettings?.enabled ? proxySettings.url : undefined;
      const cookiesPath = settings.get('cookiesPath') as string | undefined;
      const browserCookies = settings.get('browserCookies') as string | undefined;
      const downloadId = downloadManager.startDownload(
        options,
        proxy,
        (progress) => {
          mainWindow?.webContents.send('download-progress', progress);
        },
        (result) => {
          mainWindow?.webContents.send('download-complete', result);
        },
        cookiesPath || undefined,
        browserCookies || undefined
      );
      return { success: true, downloadId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start download';
      return { success: false, error: message };
    }
  });

  // Cancel download
  ipcMain.handle('cancel-download', async (_event, downloadId: string) => {
    downloadManager.cancelDownload(downloadId);
    return { success: true };
  });

  // Select download folder
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Download Folder',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
  });

  // Settings
  ipcMain.handle('get-settings', async () => {
    return settings.getAll();
  });

  ipcMain.handle('save-settings', async (_event, newSettings: Record<string, unknown>) => {
    settings.setAll(newSettings);
    return { success: true };
  });

  // Get default download path
  ipcMain.handle('get-default-path', async () => {
    return app.getPath('downloads');
  });

  // Open file in explorer
  ipcMain.handle('open-file-location', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  // Open external link
  ipcMain.handle('open-external', async (_event, url: string) => {
    shell.openExternal(url);
    return { success: true };
  });

  // Check yt-dlp availability
  ipcMain.handle('check-ytdlp', async () => {
    const available = await ytdlp.isAvailable();
    return { available, version: available ? await ytdlp.getVersion() : null };
  });

  // Get active downloads
  ipcMain.handle('get-active-downloads', async () => {
    return downloadManager.getActiveDownloads();
  });

  // Select cookies file (P2: Cookie Import)
  ipcMain.handle('select-cookies-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      title: 'Select Cookies File (cookies.txt)',
      filters: [
        { name: 'Cookies', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const cookiesPath = result.filePaths[0];
      settings.set('cookiesPath', cookiesPath);
      return { success: true, path: cookiesPath };
    }
    return { success: false };
  });

  // Clear cookies path
  ipcMain.handle('clear-cookies-path', async () => {
    settings.set('cookiesPath', '');
    return { success: true };
  });

  // Set browser cookies source (P3: Cookies from Browser)
  ipcMain.handle('set-browser-cookies', async (_event, browser: string) => {
    settings.set('browserCookies', browser);
    return { success: true };
  });

  // Get platform bypass info
  ipcMain.handle('get-platform-info', async (_event, url: string) => {
    const platform = ytdlp.detectPlatformFromUrl(url);
    const config = ytdlp.getBypassConfig(platform);
    return {
      platform,
      requiresCookies: config?.requiresCookies || false,
      cookiesHint: config?.cookiesHint || '',
      hasImpersonation: !!config?.impersonate,
    };
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  downloadManager.cancelAll();
});
