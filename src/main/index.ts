import { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { BinaryManager } from './binary-manager';
import { YtdlpManager } from './ytdlp-manager';
import { DownloadManager } from './download-manager';
import { SettingsManager } from './settings-store';
import { AppAutoUpdater } from './auto-updater';
import { BinaryUpdater } from './binary-updater';
import { HealthMonitor } from './health-monitor';
import { LicenseManager } from './license-manager';
import { RateLimiter } from './rate-limiter';
import { BanPrevention } from './ban-prevention';
import { ConverterManager } from './converter-manager';
import { ConversionCounter } from './conversion-counter';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const binaryManager = new BinaryManager();
const ytdlp = new YtdlpManager(binaryManager);
const downloadManager = new DownloadManager(ytdlp);
const settings = new SettingsManager();
const appUpdater = new AppAutoUpdater();
const binaryUpdater = new BinaryUpdater(binaryManager);
const healthMonitor = new HealthMonitor(ytdlp, binaryManager, binaryUpdater);
const licenseManager = new LicenseManager();
const rateLimiter = new RateLimiter();
const banPrevention = new BanPrevention();
const converterManager = new ConverterManager();
const conversionCounter = new ConversionCounter(licenseManager);

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

  // Start download (with tier gating + rate limiting + ban prevention)
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
      // Check tier gating: daily limit + cooldown
      const canDl = licenseManager.canDownload();
      if (!canDl.allowed) {
        return { success: false, error: canDl.reason };
      }

      // Check rate limiter backoff (IP protection)
      const backoff = rateLimiter.checkBackoff();
      if (!backoff.canProceed) {
        return { success: false, error: backoff.reason };
      }

      // Ban Prevention: check platform-specific rate limits
      const platform = ytdlp.detectPlatformFromUrl(options.url);
      const banCheck = banPrevention.checkDownloadAllowed(platform);
      if (!banCheck.allowed) {
        return { success: false, error: banCheck.reason };
      }

      // Ban Prevention: apply random delay if needed (human-like behavior)
      if (banCheck.waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, banCheck.waitMs));
      }

      // Ban Prevention: send warning to renderer if risk level elevated
      if (banCheck.riskLevel !== 'safe') {
        mainWindow?.webContents.send('ban-prevention-warning', {
          platform,
          level: banCheck.riskLevel,
          cookielessRecommended: banCheck.cookielessRecommended,
        });
      }

      const proxySettings = settings.get('proxy') as { enabled: boolean; url: string } | undefined;
      const proxy = proxySettings?.enabled ? proxySettings.url : undefined;
      const cookiesPath = settings.get('cookiesPath') as string | undefined;
      const browserCookies = settings.get('browserCookies') as string | undefined;

      // Ban Prevention: if cookieless mode is active, skip cookies entirely
      const useCookieless = banPrevention.shouldUseCookieless(platform);
      const effectiveCookiesPath = useCookieless ? undefined : (cookiesPath || undefined);
      // Use auto-detected browser cookies for YouTube if no explicit cookies configured
      const effectiveBrowserCookies = useCookieless ? undefined : (browserCookies || ytdlp.getAutoBrowser() || undefined);

      // Ban Prevention: record download attempt
      banPrevention.recordDownload(platform);

      const downloadId = downloadManager.startDownload(
        options,
        proxy,
        (progress) => {
          mainWindow?.webContents.send('download-progress', progress);
          // Detect rate limit errors in progress
          if (progress.error && rateLimiter.isBanError(progress.error)) {
            rateLimiter.reportBan(progress.error);
            mainWindow?.webContents.send('rate-limit-warning', rateLimiter.getStatus());
          }
        },
        (result) => {
          // Record download for daily counter on success
          if (result.status === 'completed') {
            licenseManager.recordDownload();
            rateLimiter.reportSuccess();
            banPrevention.recordSuccess(platform);
          } else if (result.status === 'error' && result.error && rateLimiter.isBanError(result.error)) {
            rateLimiter.reportBan(result.error);
            mainWindow?.webContents.send('rate-limit-warning', rateLimiter.getStatus());
          }
          mainWindow?.webContents.send('download-complete', result);
        },
        effectiveCookiesPath,
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

  // === LICENSE MANAGEMENT ===

  // Get license state
  ipcMain.handle('get-license-state', async () => {
    return licenseManager.getState();
  });

  // Get tier limits
  ipcMain.handle('get-tier-limits', async () => {
    return licenseManager.getLimits();
  });

  // Activate license key
  ipcMain.handle('activate-license', async (_event, key: string) => {
    const result = await licenseManager.activate(key);
    if (result.success) {
      // Update download manager concurrent limit based on tier
      downloadManager.setMaxConcurrent(licenseManager.getMaxConcurrent());
      // Notify renderer of tier change so badge updates immediately
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('license-tier-changed', {
          tier: licenseManager.getTier(),
          activated: true,
        });
      }
    }
    return result;
  });

  // Deactivate license
  ipcMain.handle('deactivate-license', async () => {
    const result = await licenseManager.deactivate();
    downloadManager.setMaxConcurrent(licenseManager.getMaxConcurrent());
    // Notify renderer of tier change so badge updates immediately
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('license-tier-changed', {
        tier: licenseManager.getTier(),
        activated: false,
      });
    }
    return result;
  });

  // Validate license (periodic check)
  ipcMain.handle('validate-license', async () => {
    return licenseManager.validate();
  });

  // Check if download is allowed (tier gating)
  ipcMain.handle('check-download-allowed', async () => {
    const canDl = licenseManager.canDownload();
    const backoff = rateLimiter.checkBackoff();
    if (!backoff.canProceed) {
      return { allowed: false, reason: backoff.reason };
    }
    return canDl;
  });

  // Get download stats (daily count, remaining, tier)
  ipcMain.handle('get-download-stats', async () => {
    return {
      tier: licenseManager.getTier(),
      dailyCount: licenseManager.getDailyDownloadCount(),
      remaining: licenseManager.getRemainingDownloads(),
      limits: licenseManager.getLimits(),
      rateLimitStatus: rateLimiter.getStatus(),
    };
  });

  // Check quality allowed
  ipcMain.handle('check-quality-allowed', async (_event, height: number) => {
    return { allowed: licenseManager.isQualityAllowed(height) };
  });

  // Check playlist allowed
  ipcMain.handle('check-playlist-allowed', async () => {
    return { allowed: licenseManager.isPlaylistAllowed() };
  });

  // Reset rate limiter (e.g. after changing proxy)
  ipcMain.handle('reset-rate-limiter', async () => {
    rateLimiter.reset();
    return { success: true };
  });

  // === PLAYER IPC HANDLERS ===

  // Select media file to play
  ipcMain.handle('select-media-file', async () => {
    const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'mpg', 'mpeg', 'm4v', 'ts'];
    const audioExts = ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'wma', 'opus'];
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      title: 'Select Media File',
      filters: [
        { name: 'Media Files', extensions: [...videoExts, ...audioExts] },
        { name: 'Video Files', extensions: videoExts },
        { name: 'Audio Files', extensions: audioExts },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const isAudio = audioExts.includes(ext);
      const name = filePath.split(/[/\\]/).pop() || 'Unknown';
      return { success: true, path: filePath, name, type: isAudio ? 'audio' : 'video' };
    }
    return { success: false };
  });

  // Detect subtitle files alongside a media file
  ipcMain.handle('detect-subtitles', async (_event, filePath: string) => {
    const fs = await import('fs');
    const p = await import('path');
    const dir = p.dirname(filePath);
    const baseName = p.basename(filePath, p.extname(filePath));
    const subExts = ['.srt', '.vtt', '.ass', '.ssa', '.sbv', '.sub'];
    const results: Array<{ path: string; label: string; lang: string }> = [];
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = p.extname(file).toLowerCase();
        if (subExts.includes(ext) && file.startsWith(baseName)) {
          const langMatch = file.match(/\.([a-z]{2,3})\.[a-z]+$/i);
          results.push({
            path: p.join(dir, file),
            label: langMatch ? langMatch[1].toUpperCase() : ext.slice(1).toUpperCase(),
            lang: langMatch ? langMatch[1] : 'und',
          });
        }
      }
    } catch { /* ignore */ }
    return results;
  });

  // Extract embedded subtitles from media file (placeholder — requires ffmpeg)
  ipcMain.handle('extract-embedded-subtitles', async () => {
    // For now return empty — embedded subtitle extraction requires ffmpeg probing
    return [];
  });

  // Get saved playback position (stored in a separate JSON file)
  ipcMain.handle('get-playback-position', async (_event, filePath: string) => {
    try {
      const fs = await import('fs');
      const p = await import('path');
      const posFile = p.join(app.getPath('userData'), 'playback-positions.json');
      if (!fs.existsSync(posFile)) return 0;
      const data = JSON.parse(fs.readFileSync(posFile, 'utf-8')) as Record<string, number>;
      const key = Buffer.from(filePath).toString('base64').substring(0, 40);
      return data[key] || 0;
    } catch { return 0; }
  });

  // Save playback position
  ipcMain.handle('save-playback-position', async (_event, filePath: string, position: number) => {
    try {
      const fs = await import('fs');
      const p = await import('path');
      const posFile = p.join(app.getPath('userData'), 'playback-positions.json');
      let data: Record<string, number> = {};
      if (fs.existsSync(posFile)) {
        data = JSON.parse(fs.readFileSync(posFile, 'utf-8')) as Record<string, number>;
      }
      const key = Buffer.from(filePath).toString('base64').substring(0, 40);
      data[key] = position;
      fs.writeFileSync(posFile, JSON.stringify(data));
      return { success: true };
    } catch { return { success: false }; }
  });

  // Get player playlist from download history
  ipcMain.handle('get-player-playlist', async () => {
    const history = settings.get('downloadHistory') as Array<{ outputPath?: string; filename?: string; audioOnly?: boolean }> | undefined;
    if (!history) return [];
    const fs = await import('fs');
    return history
      .filter((item) => item.outputPath && fs.existsSync(item.outputPath))
      .map((item) => ({
        path: item.outputPath!,
        name: item.filename || item.outputPath!.split(/[/\\]/).pop() || 'Unknown',
        type: item.audioOnly ? 'audio' as const : 'video' as const,
      }))
      .slice(0, 50);
  });

  // === CONVERTER IPC HANDLERS ===

  // Check if conversion is allowed (tier gating)
  ipcMain.handle('check-conversion-allowed', async () => {
    return conversionCounter.canConvert();
  });

  // Start a conversion
  ipcMain.handle('start-conversion', async (_event, options: {
    inputPath: string;
    outputFormat: string;
    outputDir?: string;
    options?: Record<string, string>;
  }) => {
    const check = conversionCounter.canConvert();
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const conversionId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Run conversion in background
    converterManager.convert(conversionId, options, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('conversion-progress', { conversionId, progress });
      }
    }).then((result) => {
      if (result.success) {
        conversionCounter.recordConversion();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('conversion-complete', {
          conversionId,
          success: result.success,
          outputPath: result.outputPath,
          error: result.error,
        });
      }
    });

    return { success: true, conversionId };
  });

  // Cancel a conversion
  ipcMain.handle('cancel-conversion', async (_event, conversionId: string) => {
    converterManager.cancel(conversionId);
    return { success: true };
  });

  // Get conversion stats
  ipcMain.handle('get-conversion-stats', async () => {
    return conversionCounter.getStats();
  });

  // Select file for conversion
  ipcMain.handle('select-convert-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      title: 'Select File to Convert',
      filters: [
        { name: 'All Supported', extensions: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tiff', 'srt', 'vtt', 'ass', 'ssa', 'sbv', 'sub'] },
        { name: 'Video', extensions: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv'] },
        { name: 'Audio', extensions: ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a'] },
        { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tiff'] },
        { name: 'Subtitle', extensions: ['srt', 'vtt', 'ass', 'ssa', 'sbv', 'sub'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fs = await import('fs');
      const stats = fs.statSync(filePath);
      return {
        success: true,
        path: filePath,
        name: filePath.split(/[/\\]/).pop() || 'file',
        size: stats.size,
      };
    }
    return { success: false };
  });

  // Select output directory for conversion
  ipcMain.handle('select-output-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Output Folder',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
  });

  // Open file in its containing folder
  ipcMain.handle('open-file-in-folder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  // === BAN PREVENTION ===
  ipcMain.handle('get-ban-prevention-status', async () => {
    return banPrevention.getStatus();
  });

  ipcMain.handle('get-ban-prevention-platform-stats', async (_event, platform: string) => {
    return banPrevention.getPlatformStats(platform);
  });

  ipcMain.handle('check-ban-prevention', async (_event, platform: string) => {
    return banPrevention.checkDownloadAllowed(platform);
  });

  ipcMain.handle('reset-ban-prevention-platform', async (_event, platform: string) => {
    banPrevention.resetPlatform(platform);
    return { success: true };
  });

  ipcMain.handle('reset-ban-prevention-all', async () => {
    banPrevention.resetAll();
    return { success: true };
  });

  ipcMain.handle('set-ban-prevention-enabled', async (_event, enabled: boolean) => {
    banPrevention.setEnabled(enabled);
    return { success: true };
  });

  ipcMain.handle('set-random-delay-enabled', async (_event, enabled: boolean) => {
    banPrevention.setRandomDelayEnabled(enabled);
    return { success: true };
  });

  ipcMain.handle('get-ban-prevention-settings', async () => {
    return {
      enabled: banPrevention.isEnabled(),
      randomDelayEnabled: banPrevention.isRandomDelayEnabled(),
    };
  });

  ipcMain.handle('reset-cookieless-mode', async (_event, platform: string) => {
    banPrevention.resetCookielessMode(platform);
    return { success: true };
  });
}

// ==================== PERFORMANCE: Deferred Initialization ====================
// Prioritize window display first, then initialize background systems after a delay
// to improve perceived startup time (Time-to-Interactive).

// App lifecycle
app.whenReady().then(async () => {
  // Phase 1: Show window ASAP (show: false + ready-to-show pattern already in createWindow)
  createWindow();
  setupIPC();

  // Set main window reference for ban prevention warnings
  banPrevention.setMainWindow(mainWindow);

  // Phase 2: Non-critical UI (tray icon) — defer slightly
  setTimeout(() => createTray(), 500);

  // Phase 3: Background systems — defer to avoid blocking renderer
  setTimeout(() => {
    if (mainWindow) {
      appUpdater.init(mainWindow);
      binaryUpdater.init(mainWindow);
      healthMonitor.init(mainWindow);
    }
  }, 2000);

  // Phase 4: Heavy initialization — defer even further
  setTimeout(() => {
    // Pre-initialize YouTube.js engine (runs in background)
    downloadManager.getYTJSEngine().init().then(() => {
      console.log('[GrabTube] YouTube.js engine ready.');
    }).catch((err) => {
      console.log('[GrabTube] YouTube.js engine init deferred:', err instanceof Error ? err.message : 'unknown error');
    });

    // Auto-start POT provider for YouTube bypass
    ytdlp.startPotProvider().then((potStarted) => {
      if (potStarted) {
        console.log('[GrabTube] POT provider started.');
      }
    });
  }, 3000);

  // ==================== PERFORMANCE: Periodic Memory Cleanup ====================
  // Run garbage collection hints periodically to keep memory usage low
  setInterval(() => {
    if (global.gc) {
      global.gc();
    }
  }, 5 * 60 * 1000); // Every 5 minutes

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
