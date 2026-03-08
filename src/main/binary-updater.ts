import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrowserWindow } from 'electron';
import { BinaryManager } from './binary-manager';

/**
 * GitHub release info for a binary.
 */
interface ReleaseInfo {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

/**
 * Binary update configuration.
 */
interface BinaryConfig {
  name: string;
  repo: string; // GitHub owner/repo
  getCurrentVersion: () => Promise<string>;
  getAssetName: () => string;
  getBinaryPath: () => string;
  checkInterval: number; // ms between checks
}

/**
 * Manages automatic updates for bundled binaries (yt-dlp, FFmpeg, Deno, POT provider).
 * Checks GitHub releases for new versions and downloads updates in the background.
 */
export class BinaryUpdater {
  private binaryManager: BinaryManager;
  private mainWindow: BrowserWindow | null = null;
  private intervals: ReturnType<typeof setInterval>[] = [];
  private updating: Set<string> = new Set();

  constructor(binaryManager: BinaryManager) {
    this.binaryManager = binaryManager;
  }

  /**
   * Initialize binary updater with window reference and start periodic checks.
   */
  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    const configs = this.getBinaryConfigs();

    // Check each binary on startup (staggered to avoid hammering GitHub API)
    configs.forEach((config, index) => {
      setTimeout(() => {
        this.checkAndUpdate(config);
      }, 30000 + index * 15000); // Start after 30s, stagger by 15s

      // Periodic checks
      const interval = setInterval(() => {
        this.checkAndUpdate(config);
      }, config.checkInterval);
      this.intervals.push(interval);
    });
  }

  /**
   * Get configurations for all updatable binaries.
   */
  private getBinaryConfigs(): BinaryConfig[] {
    const platform = this.getPlatformSuffix();

    return [
      {
        name: 'yt-dlp',
        repo: 'yt-dlp/yt-dlp',
        getCurrentVersion: async () => this.getLocalVersion('yt-dlp'),
        getAssetName: () => {
          if (process.platform === 'win32') return 'yt-dlp.exe';
          if (process.platform === 'darwin') return 'yt-dlp_macos';
          return 'yt-dlp_linux';
        },
        getBinaryPath: () => this.binaryManager.getYtdlpPath(),
        checkInterval: 24 * 60 * 60 * 1000, // Daily
      },
      {
        name: 'ffmpeg',
        repo: 'yt-dlp/FFmpeg-Builds',
        getCurrentVersion: async () => this.getLocalVersion('ffmpeg'),
        getAssetName: () => {
          if (process.platform === 'win32') return `ffmpeg-master-latest-${platform}-gpl.zip`;
          if (process.platform === 'darwin') return `ffmpeg-master-latest-${platform}-gpl.tar.xz`;
          return `ffmpeg-master-latest-${platform}-gpl.tar.xz`;
        },
        getBinaryPath: () => this.binaryManager.getFfmpegPath(),
        checkInterval: 7 * 24 * 60 * 60 * 1000, // Weekly
      },
      {
        name: 'bgutil-pot',
        repo: 'jim60105/bgutil-ytdlp-pot-provider-rs',
        getCurrentVersion: async () => this.getLocalVersion('bgutil-pot'),
        getAssetName: () => {
          if (process.platform === 'win32') return 'bgutil-pot-windows-x86_64.exe';
          if (process.platform === 'darwin') return 'bgutil-pot-macos-x86_64';
          return 'bgutil-pot-linux-x86_64';
        },
        getBinaryPath: () => this.binaryManager.getPotProviderPath(),
        checkInterval: 7 * 24 * 60 * 60 * 1000, // Weekly
      },
    ];
  }

  /**
   * Check for updates and download if available.
   */
  private async checkAndUpdate(config: BinaryConfig): Promise<void> {
    if (this.updating.has(config.name)) return;

    try {
      this.updating.add(config.name);
      this.sendStatus(config.name, 'checking');
      console.log(`[GrabTube] Checking for ${config.name} updates...`);

      const release = await this.getLatestRelease(config.repo);
      if (!release) {
        this.sendStatus(config.name, 'error', 'Failed to check for updates');
        return;
      }

      const latestVersion = release.tag_name.replace(/^v/, '');
      let currentVersion: string;
      try {
        currentVersion = await config.getCurrentVersion();
      } catch {
        currentVersion = 'unknown';
      }

      if (currentVersion !== 'unknown' && this.compareVersions(currentVersion, latestVersion) >= 0) {
        this.sendStatus(config.name, 'up-to-date', undefined, currentVersion);
        console.log(`[GrabTube] ${config.name} is up to date (${currentVersion})`);
        return;
      }

      // Find the correct asset
      const assetName = config.getAssetName();
      const asset = release.assets.find((a) => a.name === assetName);
      if (!asset) {
        console.warn(`[GrabTube] No asset found for ${config.name}: ${assetName}`);
        this.sendStatus(config.name, 'error', `Asset not found: ${assetName}`);
        return;
      }

      console.log(`[GrabTube] Updating ${config.name}: ${currentVersion} -> ${latestVersion}`);
      this.sendStatus(config.name, 'downloading', undefined, latestVersion);

      // Download to temp file
      const tmpPath = path.join(os.tmpdir(), `grabtube-update-${config.name}-${Date.now()}`);
      await this.downloadFile(asset.browser_download_url, tmpPath, (percent) => {
        this.sendStatus(config.name, 'downloading', undefined, latestVersion, percent);
      });

      // Replace the binary
      const binaryPath = config.getBinaryPath();
      if (binaryPath && binaryPath !== 'yt-dlp' && binaryPath !== 'ffmpeg') {
        // Backup old binary
        const backupPath = binaryPath + '.backup';
        if (fs.existsSync(binaryPath)) {
          fs.copyFileSync(binaryPath, backupPath);
        }

        try {
          fs.copyFileSync(tmpPath, binaryPath);
          fs.chmodSync(binaryPath, 0o755);

          // Save version info
          this.saveVersionInfo(config.name, latestVersion);

          console.log(`[GrabTube] ${config.name} updated to ${latestVersion}`);
          this.sendStatus(config.name, 'updated', undefined, latestVersion);

          // Clean up backup
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
        } catch (err) {
          // Restore from backup
          if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, binaryPath);
            fs.unlinkSync(backupPath);
          }
          throw err;
        }
      }

      // Clean up temp file
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[GrabTube] Failed to update ${config.name}:`, message);
      this.sendStatus(config.name, 'error', message);
    } finally {
      this.updating.delete(config.name);
    }
  }

  /**
   * Fetch latest release info from GitHub API.
   */
  private getLatestRelease(repo: string): Promise<ReleaseInfo | null> {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${repo}/releases/latest`,
        headers: { 'User-Agent': 'GrabTube/1.0.0' },
      };

      https.get(options, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            https.get(redirectUrl, { headers: { 'User-Agent': 'GrabTube/1.0.0' } }, (res2) => {
              let data = '';
              res2.on('data', (chunk) => { data += chunk; });
              res2.on('end', () => {
                try { resolve(JSON.parse(data)); } catch { resolve(null); }
              });
            }).on('error', () => resolve(null));
          } else {
            resolve(null);
          }
          return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  }

  /**
   * Download a file with progress callback.
   */
  private downloadFile(
    url: string,
    destPath: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const makeRequest = (requestUrl: string) => {
        const protocol = requestUrl.startsWith('https') ? https : http;
        protocol.get(requestUrl, { headers: { 'User-Agent': 'GrabTube/1.0.0' } }, (res) => {
          if (res.statusCode === 302 || res.statusCode === 301) {
            const redirect = res.headers.location;
            if (redirect) {
              makeRequest(redirect);
            } else {
              reject(new Error('Redirect without location'));
            }
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          const totalSize = parseInt(res.headers['content-length'] || '0', 10);
          let downloaded = 0;
          const file = fs.createWriteStream(destPath);

          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (totalSize > 0 && onProgress) {
              onProgress(Math.round((downloaded / totalSize) * 100));
            }
          });

          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
          file.on('error', (err) => {
            fs.unlinkSync(destPath);
            reject(err);
          });
        }).on('error', reject);
      };

      makeRequest(url);
    });
  }

  /**
   * Get locally stored version for a binary.
   */
  private getLocalVersion(name: string): Promise<string> {
    return new Promise((resolve) => {
      const versionFile = this.getVersionFilePath();
      try {
        if (fs.existsSync(versionFile)) {
          const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
          resolve(data[name] || 'unknown');
        } else {
          resolve('unknown');
        }
      } catch {
        resolve('unknown');
      }
    });
  }

  /**
   * Save version info for a binary.
   */
  private saveVersionInfo(name: string, version: string): void {
    const versionFile = this.getVersionFilePath();
    let data: Record<string, string> = {};
    try {
      if (fs.existsSync(versionFile)) {
        data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      }
    } catch {
      data = {};
    }
    data[name] = version;
    const dir = path.dirname(versionFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(versionFile, JSON.stringify(data, null, 2));
  }

  private getVersionFilePath(): string {
    const configDir = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'GrabTube')
      : path.join(os.homedir(), '.config', 'GrabTube');
    return path.join(configDir, 'binary-versions.json');
  }

  /**
   * Compare two semver-ish version strings.
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  private compareVersions(a: string, b: string): number {
    // Handle date-based versions like "2026.03.03"
    const aParts = a.split(/[.\-]/).map(Number);
    const bParts = b.split(/[.\-]/).map(Number);
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  }

  private getPlatformSuffix(): string {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
    if (process.platform === 'win32') return `win64`;
    if (process.platform === 'darwin') return `macos-${arch}`;
    return `linux-${arch}`;
  }

  private sendStatus(
    binary: string,
    status: string,
    error?: string,
    version?: string,
    percent?: number
  ): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('binary-update-status', {
        binary,
        status,
        error,
        version,
        percent,
      });
    }
  }

  /**
   * Force check all binaries for updates.
   */
  async checkAll(): Promise<void> {
    const configs = this.getBinaryConfigs();
    for (const config of configs) {
      await this.checkAndUpdate(config);
    }
  }

  /**
   * Clean up intervals on app quit.
   */
  destroy(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }
}
