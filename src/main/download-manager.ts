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
}

export class DownloadManager {
  private ytdlp: YtdlpManager;
  private activeDownloads: Map<string, { process: ChildProcess; item: DownloadItem }> = new Map();
  private queue: Array<{ id: string; options: DownloadOptions; proxy?: string; onProgress: (p: DownloadProgress) => void; onComplete: (r: DownloadItem) => void }> = [];
  private maxConcurrent = 2;

  constructor(ytdlp: YtdlpManager) {
    this.ytdlp = ytdlp;
  }

  startDownload(
    options: DownloadOptions,
    proxy: string | undefined,
    onProgress: (progress: DownloadProgress) => void,
    onComplete: (result: DownloadItem) => void
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
      this.executeDownload(downloadId, options, proxy, onProgress, onComplete, item);
    } else {
      this.queue.push({ id: downloadId, options, proxy, onProgress, onComplete });
    }

    return downloadId;
  }

  private executeDownload(
    downloadId: string,
    options: DownloadOptions,
    proxy: string | undefined,
    onProgress: (progress: DownloadProgress) => void,
    onComplete: (result: DownloadItem) => void,
    item: DownloadItem
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
      downloadId
    );

    this.activeDownloads.set(downloadId, { process: proc, item });

    proc.on('close', (code) => {
      if (code === 0) {
        item.status = 'completed';
        item.progress = 100;
      } else if (item.status !== 'cancelled') {
        item.status = 'error';
        item.error = item.error || 'Download failed with exit code ' + code;
      }

      this.activeDownloads.delete(downloadId);
      onComplete(item);
      this.processQueue();
    });

    proc.on('error', (err) => {
      item.status = 'error';
      item.error = err.message;
      this.activeDownloads.delete(downloadId);
      onComplete(item);
      this.processQueue();
    });
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
        this.executeDownload(next.id, next.options, next.proxy, next.onProgress, next.onComplete, item);
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
