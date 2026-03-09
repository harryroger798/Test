import { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { BinaryManager } from './binary-manager';
import { YtdlpManager } from './ytdlp-manager';
import { DownloadManager } from './download-manager';
import { SettingsManager } from './settings-store';
import { AppAutoUpdater } from './auto-updater';
import { BinaryUpdater } from './binary-updater';
import { HealthMonitor } from './health-monitor';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const binaryManager = new BinaryManager();
const ytdlp = new YtdlpManager(binaryManager);
const downloadManager = new DownloadManager(ytdlp);
const settings = new SettingsManager();
const appUpdater = new AppAutoUpdater();
const binaryUpdater = new BinaryUpdater(binaryManager);
const healthMonitor = new HealthMonitor(ytdlp, binaryManager, binaryUpdater);

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'GrabTube',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
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
  // Fetch video info — YouTube.js first for YouTube URLs, yt-dlp for everything else
  ipcMain.handle('fetch-info', async (_event, url: string) => {
    try {
      const platform = ytdlp.detectPlatformFromUrl(url);

      // YouTube: try YouTube.js engine first (no cookies needed)
      // Wrap with a hard 25-second timeout so the UI never hangs indefinitely
      if (platform === 'youtube') {
        try {
          const ytjsEngine = downloadManager.getYTJSEngine();
          const ytjsInfo = await Promise.race([
            ytjsEngine.getVideoInfo(url),
            new Promise<never>((_resolve, reject) =>
              setTimeout(() => reject(new Error('YouTube.js metadata fetch timed out (25s)')), 25000)
            ),
          ]);
          // Convert to the same format yt-dlp returns
          return {
            success: true,
            data: {
              id: ytjsInfo.id,
              title: ytjsInfo.title,
              description: ytjsInfo.description,
              thumbnail: ytjsInfo.thumbnail,
              duration: ytjsInfo.duration,
              durationString: ytjsInfo.durationString,
              uploader: ytjsInfo.author,
              uploaderUrl: '',
              viewCount: ytjsInfo.viewCount,
              likeCount: 0,
              uploadDate: '',
              webpage_url: `https://www.youtube.com/watch?v=${ytjsInfo.id}`,
              extractor: 'youtube',
              platform: 'youtube',
              formats: ytjsInfo.formats.map((f) => ({
                formatId: String(f.itag),
                ext: f.mimeType.includes('mp4') ? 'mp4' : f.mimeType.includes('webm') ? 'webm' : 'mp4',
                resolution: f.hasVideo ? `${f.width}x${f.height}` : 'audio only',
                filesize: f.contentLength || null,
                vcodec: f.hasVideo ? (f.mimeType.split(';')[0] || 'video') : 'none',
                acodec: f.hasAudio ? (f.mimeType.split(';')[0] || 'audio') : 'none',
                fps: f.fps || null,
                tbr: f.bitrate ? Math.round(f.bitrate / 1000) : null,
                quality: f.qualityLabel || 'audio',
                hasVideo: f.hasVideo,
                hasAudio: f.hasAudio,
                note: f.qualityLabel || '',
              })),
              subtitles: {},
              requestedSubtitles: null,
            },
          };
        } catch (ytjsError) {
          const ytjsMsg = ytjsError instanceof Error ? ytjsError.message : String(ytjsError);
          console.log(`[GrabTube] YouTube.js info fetch failed (${ytjsMsg.substring(0, 100)}), falling back to yt-dlp...`);
          // Fall through to yt-dlp
        }
      }

      // Fallback: yt-dlp with retry (works for all platforms)
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
      // Use auto-detected browser cookies for YouTube if no explicit cookies configured
      const effectiveBrowserCookies = browserCookies || ytdlp.getAutoBrowser() || undefined;
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
        effectiveBrowserCookies
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

  // OAuth2 login for YouTube
  ipcMain.handle('initiate-oauth2-login', async () => {
    return ytdlp.initiateOAuth2Login();
  });

  // Check OAuth2 status
  ipcMain.handle('get-oauth2-status', async () => {
    return { authenticated: ytdlp.hasOAuth2Token() };
  });

  // Remove OAuth2 token
  ipcMain.handle('remove-oauth2-token', async () => {
    ytdlp.removeOAuth2Token();
    return { success: true };
  });

  // Cobalt fallback settings
  ipcMain.handle('get-cobalt-status', async () => {
    return { enabled: downloadManager.getCobaltFallback().isEnabled() };
  });

  ipcMain.handle('set-cobalt-enabled', async (_event, enabled: boolean) => {
    downloadManager.getCobaltFallback().setEnabled(enabled);
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

  // Get binary status (bundled binaries, POT provider, etc.)
  ipcMain.handle('get-binary-status', async () => {
    const status = binaryManager.getStatus();
    const potRunning = ytdlp.getPotProvider().isRunning();
    return {
      ...status,
      potProvider: {
        ...status.potProvider,
        running: potRunning,
      },
    };
  });

  // Auto-update: check for app updates
  ipcMain.handle('check-for-updates', async () => {
    return appUpdater.checkForUpdates();
  });

  // Auto-update: install downloaded update
  ipcMain.handle('install-update', async () => {
    // This will quit and install
    return { success: true };
  });

  // Binary updater: force check all binaries
  ipcMain.handle('check-binary-updates', async () => {
    await binaryUpdater.checkAll();
    return { success: true };
  });

  // Health monitor: get current health statuses
  ipcMain.handle('get-health-status', async () => {
    return healthMonitor.getHealthStatuses();
  });

  // Health monitor: run health check now
  ipcMain.handle('run-health-check', async () => {
    const statuses = await healthMonitor.runHealthCheck();
    return Array.from(statuses.values());
  });

  // Health monitor: get failure log
  ipcMain.handle('get-failure-log', async () => {
    return healthMonitor.getFailureLog();
  });

  // App version (dynamic from package.json)
  ipcMain.handle('get-app-version', async () => {
    return { version: app.getVersion() };
  });

  // Detect installed browsers for setup wizard
  ipcMain.handle('detect-browsers', async () => {
    return ytdlp.getInstalledBrowsers();
  });

  // Verify browser cookies work for YouTube (setup wizard + cookie check)
  ipcMain.handle('verify-browser-cookies', async (_event, browser?: string) => {
    return ytdlp.verifyBrowserCookies(browser);
  });

  // Check if setup has been completed
  ipcMain.handle('get-setup-complete', async () => {
    return { complete: settings.get('setupComplete') === true };
  });

  // Mark setup as complete
  ipcMain.handle('set-setup-complete', async () => {
    settings.set('setupComplete', true);
    return { success: true };
  });

  // Feature tour completion
  ipcMain.handle('get-feature-tour-complete', async () => {
    return { complete: settings.get('featureTourComplete') === true };
  });

  ipcMain.handle('set-feature-tour-complete', async () => {
    settings.set('featureTourComplete', true);
    return { success: true };
  });
}

// App lifecycle
app.whenReady().then(async () => {
  createWindow();
  createTray();
  setupIPC();

  // Initialize automation systems (after window is ready)
  if (mainWindow) {
    appUpdater.init(mainWindow);
    binaryUpdater.init(mainWindow);
    healthMonitor.init(mainWindow);
  }

  // Pre-initialize YouTube.js engine (runs in background, doesn't block startup)
  downloadManager.getYTJSEngine().init().then(() => {
    console.log('[GrabTube] YouTube.js engine ready — primary YouTube download engine initialized.');
  }).catch((err) => {
    console.log('[GrabTube] YouTube.js engine init deferred:', err instanceof Error ? err.message : 'unknown error');
  });

  // Auto-start POT provider for YouTube bypass (runs in background)
  const potStarted = await ytdlp.startPotProvider();
  if (potStarted) {
    console.log('[GrabTube] POT provider started — YouTube downloads work from any IP.');
  } else {
    console.log('[GrabTube] POT provider not available — YouTube may need proxy from datacenter IPs.');
  }

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
  ytdlp.stopPotProvider();
  appUpdater.destroy();
  binaryUpdater.destroy();
  healthMonitor.destroy();
});
