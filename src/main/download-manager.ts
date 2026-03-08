import { ChildProcess } from 'child_process';
import { YtdlpManager, DownloadProgress } from './ytdlp-manager';
import { v4Style } from './utils';

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';
  progress: number;
  speed: string;
  eta: string;
  filesize: string;
  filename: string;
  outputPath: string;
  error?: string;
}

export interface DownloadOptions {
  url: string;
  formatId: string;
  outputPath: string;
  filename: string;
  audioOnly: boolean;
  audioFormat?: string;
  embedSubs?: boolean;
  embedThumbnail?: boolean;
  cookiesPath?: string;
  browserCookies?: string;
}

export class DownloadManager {
  private ytdlp: YtdlpManager;
  private activeDownloads: Map<string, { process: ChildProcess; item: DownloadItem }> = new Map();
  private queue: Array<{ id: string; options: DownloadOptions; proxy?: string; cookiesPath?: string; browserCookies?: string; onProgress: (p: DownloadProgress) => void; onComplete: (r: DownloadItem) => void }> = [];
  private maxConcurrent = 2;

  constructor(ytdlp: YtdlpManager) {
    this.ytdlp = ytdlp;
  }

  startDownload(
    options: DownloadOptions,
    proxy: string | undefined,
    onProgress: (progress: DownloadProgress) => void,
    onComplete: (result: DownloadItem) => void,
    cookiesPath?: string,
    browserCookies?: string
  ): string {
    const downloadId = v4Style();

    const item: DownloadItem = {
      id: downloadId,
      url: options.url,
      title: options.filename || 'Unknown',
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      filesize: '',
      filename: '',
      outputPath: options.outputPath,
    };

    if (this.activeDownloads.size < this.maxConcurrent) {
      this.executeDownload(downloadId, options, proxy, onProgress, onComplete, item, cookiesPath, browserCookies);
    } else {
      this.queue.push({ id: downloadId, options, proxy, cookiesPath, browserCookies, onProgress, onComplete });
    }

    return downloadId;
  }

  private executeDownload(
    downloadId: string,
    options: DownloadOptions,
    proxy: string | undefined,
    onProgress: (progress: DownloadProgress) => void,
    onComplete: (result: DownloadItem) => void,
    item: DownloadItem,
    cookiesPath?: string,
    browserCookies?: string,
    retryCount = 0
  ): void {
    item.status = 'downloading';

    const proc = this.ytdlp.startDownload(
      options.url,
      options.outputPath,
      options.filename,
      options.formatId,
      options.audioOnly,
      options.audioFormat,
      options.embedSubs || false,
      options.embedThumbnail || false,
      proxy,
      (progress) => {
        item.status = progress.status === 'error' ? 'error' : progress.status === 'processing' ? 'processing' : 'downloading';
        item.progress = progress.percent;
        item.speed = progress.speed;
        item.eta = progress.eta;
        item.filesize = progress.filesize;
        if (progress.filename) item.filename = progress.filename;
        if (progress.error) item.error = progress.error;
        onProgress(progress);
      },
      downloadId,
      cookiesPath,
      browserCookies
    );

    this.activeDownloads.set(downloadId, { process: proc, item });

    proc.on('close', (code) => {
        if (code === 0) {
          item.status = 'completed';
          item.progress = 100;
          this.activeDownloads.delete(downloadId);

          // Cache successful browser for YouTube auto-detection
          if (browserCookies && this.ytdlp.detectPlatformFromUrl(options.url) === 'youtube' && !this.ytdlp.getAutoBrowser()) {
            this.ytdlp.setAutoBrowser(browserCookies);
          }

          onComplete(item);
          this.processQueue();
      } else if (item.status === 'cancelled') {
        this.activeDownloads.delete(downloadId);
        onComplete(item);
        this.processQueue();
      } else {
        const platform = this.ytdlp.detectPlatformFromUrl(options.url);

        // YouTube auto-browser cookie retry: cycle through browsers on 403/bot errors
        if (platform === 'youtube' && this.isYouTubeDownloadError(item.error)) {
          const browsers = ['chrome', 'edge', 'firefox', 'brave', 'opera', 'vivaldi', 'chromium'];
          const currentIndex = browserCookies ? browsers.indexOf(browserCookies) : -1;
          const nextIndex = currentIndex + 1;

          if (nextIndex < browsers.length) {
            const nextBrowser = browsers[nextIndex];
            console.log(`[GrabTube] YouTube download failed (${item.error?.substring(0, 60)}), trying browser: ${nextBrowser}`);
            item.error = undefined;
            item.progress = 0;
            this.activeDownloads.delete(downloadId);
            this.executeDownload(downloadId, options, proxy, onProgress, onComplete, item, cookiesPath, nextBrowser, 0);
            return;
          }
        }

        // Auto-retry logic (P4): Try with cookies if first attempt failed
        const needsRetry = retryCount === 0 && this.shouldRetryWithCookies(platform, item.error);

        if (needsRetry && (cookiesPath || browserCookies)) {
          // Retry with cookies
          item.error = undefined;
          item.progress = 0;
          this.activeDownloads.delete(downloadId);
          this.executeDownload(downloadId, options, proxy, onProgress, onComplete, item, cookiesPath, browserCookies, retryCount + 1);
        } else {
          item.status = 'error';
          item.error = item.error || 'Download failed with exit code ' + code;
          const config = this.ytdlp.getBypassConfig(platform);
          if (config?.cookiesHint && !cookiesPath && !browserCookies) {
            item.error += '. Tip: YouTube works best with POT provider plugin or browser cookies for age-restricted content.';
          }
          this.activeDownloads.delete(downloadId);
          onComplete(item);
          this.processQueue();
        }
      }
    });

    proc.on('error', (err) => {
      item.status = 'error';
      item.error = err.message;
      this.activeDownloads.delete(downloadId);
      onComplete(item);
      this.processQueue();
    });
  }

  /**
   * Determine if a failed download should be retried with cookies.
   */
  private shouldRetryWithCookies(platform: string, error?: string): boolean {
    const cookiePlatforms = ['instagram', 'reddit', 'facebook', 'twitter', 'linkedin'];
    if (!cookiePlatforms.includes(platform)) return false;
    if (!error) return true; // Unknown error, try cookies
    const authErrors = ['authentication', 'login', 'sign in', 'cookies', 'forbidden', '403', '401', 'private'];
    return authErrors.some((keyword) => error.toLowerCase().includes(keyword));
  }

  /**
   * Detect if a YouTube download error is a 403/bot/cookie issue that can be fixed with browser cookies.
   */
  private isYouTubeDownloadError(error?: string): boolean {
    if (!error) return false;
    const lower = error.toLowerCase();
    return lower.includes('403') ||
           lower.includes('forbidden') ||
           lower.includes('sign in to confirm') ||
           lower.includes('not a bot') ||
           lower.includes('confirm your age') ||
           lower.includes('use --cookies');
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.activeDownloads.size < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        const item: DownloadItem = {
          id: next.id,
          url: next.options.url,
          title: next.options.filename || 'Unknown',
          status: 'queued',
          progress: 0,
          speed: '',
          eta: '',
          filesize: '',
          filename: '',
          outputPath: next.options.outputPath,
        };
        this.executeDownload(next.id, next.options, next.proxy, next.onProgress, next.onComplete, item, next.cookiesPath, next.browserCookies);
      }
    }
  }

  cancelDownload(downloadId: string): void {
    const download = this.activeDownloads.get(downloadId);
    if (download) {
      download.item.status = 'cancelled';
      download.process.kill('SIGTERM');
      this.activeDownloads.delete(downloadId);
      this.processQueue();
    }
    // Also remove from queue
    this.queue = this.queue.filter((q) => q.id !== downloadId);
  }

  cancelAll(): void {
    for (const [id, download] of this.activeDownloads) {
      download.item.status = 'cancelled';
      download.process.kill('SIGTERM');
    }
    this.activeDownloads.clear();
    this.queue = [];
  }

  hasActiveDownloads(): boolean {
    return this.activeDownloads.size > 0;
  }

  getActiveDownloads(): DownloadItem[] {
    return Array.from(this.activeDownloads.values()).map((d) => d.item);
  }
}
