import { ChildProcess } from 'child_process';
import { YtdlpManager, DownloadProgress } from './ytdlp-manager';
import { CobaltFallback } from './cobalt-fallback';
import { YouTubeJSEngine } from './youtube-js-engine';
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
  private cobalt: CobaltFallback;
  private ytjs: YouTubeJSEngine;
  private activeDownloads: Map<string, { process: ChildProcess; item: DownloadItem }> = new Map();
  private queue: Array<{ id: string; options: DownloadOptions; proxy?: string; cookiesPath?: string; browserCookies?: string; onProgress: (p: DownloadProgress) => void; onComplete: (r: DownloadItem) => void }> = [];
  private maxConcurrent = 2;

  constructor(ytdlp: YtdlpManager) {
    this.ytdlp = ytdlp;
    this.cobalt = new CobaltFallback();
    this.ytjs = new YouTubeJSEngine();
  }

  /**
   * Get the YouTube.js engine instance.
   */
  getYTJSEngine(): YouTubeJSEngine {
    return this.ytjs;
  }

  /**
   * Get the cobalt fallback instance for configuration.
   */
  getCobaltFallback(): CobaltFallback {
    return this.cobalt;
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

    const platform = this.ytdlp.detectPlatformFromUrl(options.url);

    // YouTube: use yt-dlp with --impersonate chrome directly.
    // YouTube.js v16.0.1 is broken for downloads (can't decipher signatures,
    // TV client returns DRM streams). yt-dlp with --impersonate chrome + Deno
    // runtime is the proven working approach from residential IPs.

    // For YouTube fallback: use auto-detected browser cookies
    const effectiveBrowserCookies = browserCookies ||
      (platform === 'youtube' && !cookiesPath && this.ytdlp.getAutoBrowser() ? this.ytdlp.getAutoBrowser() ?? undefined : undefined);

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
      effectiveBrowserCookies
    );

    this.activeDownloads.set(downloadId, { process: proc, item });

    proc.on('close', (code) => {
        if (code === 0) {
          item.status = 'completed';
          item.progress = 100;
          this.activeDownloads.delete(downloadId);

          // Cache successful browser for YouTube auto-detection
          if (effectiveBrowserCookies && platform === 'youtube' && !this.ytdlp.getAutoBrowser()) {
            this.ytdlp.setAutoBrowser(effectiveBrowserCookies);
          }

          onComplete(item);
          this.processQueue();
      } else if (item.status === 'cancelled') {
        this.activeDownloads.delete(downloadId);
        onComplete(item);
        this.processQueue();
      } else {
        // YouTube: always cycle through browsers on ANY download failure.
        // During browser cycling (effectiveBrowserCookies is set), ANY error means skip to next browser.
        // This handles DPAPI, browser-not-found, cookie DB locked, permission denied, etc.
        if (platform === 'youtube' && effectiveBrowserCookies) {
          const browsers = ['firefox', 'edge', 'brave', 'opera', 'vivaldi', 'chromium', 'chrome'];
          const currentIndex = browsers.indexOf(effectiveBrowserCookies);
          const nextIndex = currentIndex + 1;

          if (nextIndex < browsers.length) {
            const nextBrowser = browsers[nextIndex];
            console.log(`[GrabTube] YouTube download failed with ${effectiveBrowserCookies} (${item.error?.substring(0, 80)}), trying browser: ${nextBrowser}`);
            item.error = undefined;
            item.progress = 0;
            this.activeDownloads.delete(downloadId);
            this.executeDownload(downloadId, options, proxy, onProgress, onComplete, item, cookiesPath, nextBrowser, 0);
            return;
          }

          // All browsers exhausted — try Cobalt API fallback
          if (this.cobalt.isEnabled()) {
            console.log('[GrabTube] All browsers failed. Trying Cobalt API fallback...');
            this.activeDownloads.delete(downloadId);
            this.tryCobaltFallback(downloadId, options, onProgress, onComplete, item);
            return;
          }
        }

        // YouTube: if no browser was tried yet, start browser cycling on ANY failure
        if (platform === 'youtube' && !effectiveBrowserCookies && !cookiesPath) {
          console.log(`[GrabTube] YouTube download failed (${item.error?.substring(0, 80)}). Starting browser cookie cycle...`);
          item.error = undefined;
          item.progress = 0;
          this.activeDownloads.delete(downloadId);
          this.executeDownload(downloadId, options, proxy, onProgress, onComplete, item, cookiesPath, 'firefox', 0);
          return;
        }

        // Auto-retry logic (P4): Try with cookies if first attempt failed
        const needsRetry = retryCount === 0 && this.shouldRetryWithCookies(platform, item.error);

        if (needsRetry && (cookiesPath || effectiveBrowserCookies)) {
          // Retry with cookies
          item.error = undefined;
          item.progress = 0;
          this.activeDownloads.delete(downloadId);
          this.executeDownload(downloadId, options, proxy, onProgress, onComplete, item, cookiesPath, effectiveBrowserCookies, retryCount + 1);
        } else if (platform === 'youtube' && this.cobalt.isEnabled()) {
          // Cobalt API fallback: last resort for YouTube
          console.log('[GrabTube] All local methods failed. Trying Cobalt API fallback...');
          this.activeDownloads.delete(downloadId);
          this.tryCobaltFallback(downloadId, options, onProgress, onComplete, item);
        } else {
          item.status = 'error';
          item.error = item.error || 'Download failed with exit code ' + code;
          const config = this.ytdlp.getBypassConfig(platform);
          if (config?.cookiesHint && !cookiesPath && !effectiveBrowserCookies) {
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
   * Detect if a YouTube download error is a known retryable issue.
   * Note: For browser cycling, we now retry on ANY error (not just these patterns).
   * This method is kept for non-YouTube platforms and Cobalt fallback decisions.
   */
  private isYouTubeDownloadError(error?: string): boolean {
    if (!error) return false;
    const lower = error.toLowerCase();
    return lower.includes('403') ||
           lower.includes('forbidden') ||
           lower.includes('sign in to confirm') ||
           lower.includes('not a bot') ||
           lower.includes('confirm your age') ||
           lower.includes('use --cookies') ||
           lower.includes('could not copy') ||
           lower.includes('could not find') ||
           lower.includes('cookie database') ||
           lower.includes('cookies database') ||
           lower.includes('failed to decrypt') ||
           lower.includes('dpapi') ||
           lower.includes('permission denied') ||
           lower.includes('failed to extract cookies') ||
           lower.includes('cookies could not be decrypted');
  }

  /**
   * Try downloading via Cobalt API as a last-resort fallback.
   */
  private async tryCobaltFallback(
    downloadId: string,
    options: DownloadOptions,
    onProgress: (progress: DownloadProgress) => void,
    onComplete: (result: DownloadItem) => void,
    item: DownloadItem
  ): Promise<void> {
    try {
      item.status = 'downloading';
      item.error = undefined;
      item.progress = 0;
      onProgress({
        downloadId,
        status: 'downloading',
        percent: 0,
        speed: '',
        eta: '',
        filesize: '',
        filename: '',
      });

      const result = await this.cobalt.getDownloadUrl(options.url, options.audioOnly);
      if (!result) {
        item.status = 'error';
        item.error = 'Cobalt API fallback also failed. Please try again later or check your cookies settings.';
        onComplete(item);
        this.processQueue();
        return;
      }

      const filename = options.filename || result.filename;
      await this.cobalt.downloadFile(
        result.url,
        options.outputPath,
        filename,
        (percent, speed) => {
          item.progress = percent;
          item.speed = speed;
          onProgress({
            downloadId,
            status: 'downloading',
            percent,
            speed,
            eta: '',
            filesize: '',
            filename,
          });
        }
      );

      item.status = 'completed';
      item.progress = 100;
      item.filename = filename;
      console.log(`[GrabTube] Download completed via Cobalt fallback: ${filename}`);
      onComplete(item);
      this.processQueue();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cobalt fallback failed';
      item.status = 'error';
      item.error = `All download methods failed. Last error: ${message}`;
      onComplete(item);
      this.processQueue();
    }
  }

  private processQueue(): void {
    const totalActive = this.activeDownloads.size;
    while (this.queue.length > 0 && totalActive < this.maxConcurrent) {
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
    for (const [, download] of this.activeDownloads) {
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
