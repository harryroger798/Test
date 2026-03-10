import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';

/**
 * Manages automatic app updates via electron-updater.
 * Checks GitHub Releases for new versions and auto-downloads updates.
 * 
 * Flow: App launch -> check for update -> download in background -> notify user -> restart to install
 */
export class AppAutoUpdater {
  private mainWindow: BrowserWindow | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;
  private initialized = false;

  /**
   * Initialize the auto-updater with the main window reference.
   * Sets up event listeners and starts periodic checks.
   */
  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Guard against double initialization (prevents duplicate IPC handler crash)
    if (this.initialized) {
      console.log('[GrabTube] Auto-updater already initialized, skipping.');
      return;
    }
    this.initialized = true;

    // Configure auto-updater
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    // Event listeners
    autoUpdater.on('checking-for-update', () => {
      this.sendToRenderer('update-status', { status: 'checking' });
      console.log('[GrabTube] Checking for app updates...');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.sendToRenderer('update-status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
      });
      console.log(`[GrabTube] Update available: v${info.version}`);
    });

    autoUpdater.on('update-not-available', () => {
      this.sendToRenderer('update-status', { status: 'up-to-date' });
      console.log('[GrabTube] App is up to date.');
    });

    autoUpdater.on('download-progress', (progress) => {
      this.sendToRenderer('update-status', {
        status: 'downloading',
        percent: Math.round(progress.percent),
        speed: this.formatBytes(progress.bytesPerSecond) + '/s',
        transferred: this.formatBytes(progress.transferred),
        total: this.formatBytes(progress.total),
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.sendToRenderer('update-status', {
        status: 'ready',
        version: info.version,
      });
      console.log(`[GrabTube] Update downloaded: v${info.version}. Will install on restart.`);
    });

    autoUpdater.on('error', (err: Error) => {
      this.sendToRenderer('update-status', {
        status: 'error',
        error: err.message,
      });
      console.warn('[GrabTube] Auto-update error:', err.message);
    });

    // NOTE: IPC handlers 'check-for-updates' and 'install-update' are registered
    // in setupIPC() in index.ts — do NOT register them here to avoid duplicate handler crash.

    // Check on startup (after 10 second delay to not slow down launch)
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000);

    // Check every 6 hours
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Check for updates. Returns update info or null.
   */
  async checkForUpdates(): Promise<{ available: boolean; version?: string } | null> {
    if (this.isChecking) return null;
    this.isChecking = true;

    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo) {
        return {
          available: true,
          version: result.updateInfo.version,
        };
      }
      return { available: false };
    } catch (err) {
      console.warn('[GrabTube] Update check failed:', err);
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Clean up intervals on app quit.
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private sendToRenderer(channel: string, data: Record<string, unknown>): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
