import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

/**
 * YouTube.js (InnerTube API) Engine for GrabTube.
 *
 * This is the PRIMARY download engine for YouTube videos.
 * It talks directly to YouTube's private InnerTube API using the
 * youtubei.js library, generating its own streaming URLs without
 * needing browser cookies, yt-dlp, or external proxies.
 *
 * Fallback chain:
 *   1. YouTube.js (this engine) — no auth needed, fastest
 *   2. yt-dlp with browser cookies — fallback
 *   3. Cobalt API — last resort
 *
 * The user never sees which engine is used.
 */

export interface YTJSVideoFormat {
  itag: number;
  mimeType: string;
  qualityLabel: string;
  bitrate: number;
  width: number;
  height: number;
  fps: number;
  hasVideo: boolean;
  hasAudio: boolean;
  contentLength: number;
  url: string;
}

export interface YTJSVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  durationString: string;
  author: string;
  viewCount: number;
  formats: YTJSVideoFormat[];
}

export interface YTJSDownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
  speed: string;
}

/**
 * Dynamically import youtubei.js (ESM module).
 * We use dynamic import() because youtubei.js is ESM-only
 * and our project uses CommonJS.
 */
async function loadInnertube(): Promise<typeof import('youtubei.js')> {
  return import('youtubei.js');
}

export class YouTubeJSEngine {
  private innertubeInstance: unknown = null;
  private initPromise: Promise<void> | null = null;
  private lastInitTime = 0;
  private static readonly REINIT_INTERVAL = 30 * 60 * 1000; // 30 minutes

  /**
   * Initialize the InnerTube client.
   * Caches the instance and re-initializes every 30 minutes
   * to keep the session fresh.
   */
  async init(): Promise<void> {
    const now = Date.now();
    if (this.innertubeInstance && (now - this.lastInitTime) < YouTubeJSEngine.REINIT_INTERVAL) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const { Innertube } = await loadInnertube();
        this.innertubeInstance = await Innertube.create({
          lang: 'en',
          location: 'US',
        });
        this.lastInitTime = Date.now();
        console.log('[GrabTube][YTJS] InnerTube client initialized');
      } catch (err) {
        console.error('[GrabTube][YTJS] Failed to initialize InnerTube:', err);
        this.innertubeInstance = null;
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Check if the engine is available (youtubei.js can be loaded).
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.init();
      return this.innertubeInstance !== null;
    } catch {
      return false;
    }
  }

  /**
   * Extract video ID from a YouTube URL.
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  /**
   * Get video info using YouTube.js InnerTube API.
   * No cookies or authentication needed.
   */
  async getVideoInfo(url: string): Promise<YTJSVideoInfo> {
    await this.init();

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const yt = this.innertubeInstance as InstanceType<Awaited<ReturnType<typeof loadInnertube>>['Innertube']>;

    // Try getInfo which provides full streaming data
    const info = await yt.getInfo(videoId);

    const basicInfo = info.basic_info;
    if (!basicInfo || !basicInfo.title) {
      throw new Error('Failed to get video info from YouTube.js');
    }

    // Build format list from streaming data
    const formats: YTJSVideoFormat[] = [];
    const streamingData = info.streaming_data;

    if (streamingData) {
      // Combined formats (video + audio)
      if (streamingData.formats) {
        for (const f of streamingData.formats) {
          try {
            const decipheredUrl = await f.decipher(yt.session.player);
            if (decipheredUrl) {
              formats.push({
                itag: f.itag,
                mimeType: f.mime_type || '',
                qualityLabel: f.quality_label || 'unknown',
                bitrate: f.bitrate || 0,
                width: f.width || 0,
                height: f.height || 0,
                fps: f.fps || 0,
                hasVideo: true,
                hasAudio: true,
                contentLength: f.content_length || 0,
                url: decipheredUrl,
              });
            }
          } catch {
            // Skip formats that can't be deciphered
          }
        }
      }

      // Adaptive formats (video-only or audio-only)
      if (streamingData.adaptive_formats) {
        for (const f of streamingData.adaptive_formats) {
          try {
            const decipheredUrl = await f.decipher(yt.session.player);
            if (decipheredUrl) {
              const hasVideo = !!(f.width && f.height);
              formats.push({
                itag: f.itag,
                mimeType: f.mime_type || '',
                qualityLabel: f.quality_label || (hasVideo ? 'unknown' : 'audio'),
                bitrate: f.bitrate || 0,
                width: f.width || 0,
                height: f.height || 0,
                fps: f.fps || 0,
                hasVideo,
                hasAudio: !hasVideo,
                contentLength: f.content_length || 0,
                url: decipheredUrl,
              });
            }
          } catch {
            // Skip
          }
        }
      }
    }

    const duration = basicInfo.duration || 0;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    const durationString = hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;

    const thumbnails = basicInfo.thumbnail || [];
    const thumbnail = Array.isArray(thumbnails) && thumbnails.length > 0
      ? (thumbnails[thumbnails.length - 1] as { url: string }).url || ''
      : '';

    return {
      id: videoId,
      title: basicInfo.title || 'Unknown',
      description: basicInfo.short_description || '',
      thumbnail,
      duration,
      durationString,
      author: basicInfo.author || 'Unknown',
      viewCount: basicInfo.view_count || 0,
      formats,
    };
  }

  /**
   * Download a YouTube video using YouTube.js streaming.
   * Uses the info.download() method which handles deciphering internally.
   */
  async download(
    url: string,
    outputPath: string,
    filename: string,
    audioOnly: boolean,
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<string> {
    await this.init();

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const yt = this.innertubeInstance as InstanceType<Awaited<ReturnType<typeof loadInnertube>>['Innertube']>;

    // Get full video info with streaming data
    const info = await yt.getInfo(videoId);

    if (!info.basic_info?.title) {
      throw new Error('YouTube.js: Could not get video info');
    }

    // Determine output filename
    const safeTitle = (filename || info.basic_info.title || 'video')
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 200);
    const ext = audioOnly ? 'mp3' : 'mp4';
    const outputFile = path.join(outputPath, `${safeTitle}.${ext}`);

    // Use YouTube.js download method
    const downloadOptions: Record<string, unknown> = audioOnly
      ? { type: 'audio', quality: 'best' }
      : { type: 'video+audio', quality: 'best' };

    const stream = await info.download(downloadOptions);

    // Write stream to file with progress tracking
    const fileStream = fs.createWriteStream(outputFile);
    let downloaded = 0;
    let totalSize = 0;

    // Try to estimate total size from streaming data
    if (info.streaming_data) {
      const allFormats = [
        ...(info.streaming_data.formats || []),
        ...(info.streaming_data.adaptive_formats || []),
      ];
      if (allFormats.length > 0) {
        // Rough estimate from best format
        const bestFormat = allFormats.reduce((best, f) =>
          (f.content_length || 0) > (best.content_length || 0) ? f : best
        );
        totalSize = bestFormat.content_length || 0;
      }
    }

    let lastTime = Date.now();
    let lastBytes = 0;

    return new Promise<string>((resolve, reject) => {
      const writeChunks = async () => {
        try {
          for await (const chunk of stream) {
            const buffer = Buffer.from(chunk);
            fileStream.write(buffer);
            downloaded += buffer.length;

            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.5 && onProgress) {
              const bytesPerSec = (downloaded - lastBytes) / elapsed;
              const speed = this.formatSpeed(bytesPerSec);
              const percent = totalSize > 0
                ? Math.min(99, Math.round((downloaded / totalSize) * 100))
                : 0;
              onProgress({ percent, downloaded, total: totalSize, speed });
              lastTime = now;
              lastBytes = downloaded;
            }
          }

          fileStream.end();
          fileStream.on('finish', () => {
            if (onProgress) {
              onProgress({ percent: 100, downloaded, total: downloaded, speed: '' });
            }
            console.log(`[GrabTube][YTJS] Download complete: ${outputFile} (${this.formatSize(downloaded)})`);
            resolve(outputFile);
          });
        } catch (err) {
          fileStream.close();
          // Clean up partial file
          try {
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
          } catch { /* ignore */ }
          reject(err);
        }
      };

      fileStream.on('error', (err) => {
        reject(err);
      });

      writeChunks();
    });
  }

  /**
   * Download a video using direct URL streaming (for when we have a deciphered URL).
   * This is used as a secondary method if info.download() fails.
   */
  async downloadFromUrl(
    streamUrl: string,
    outputPath: string,
    filename: string,
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<string> {
    const outputFile = path.join(outputPath, filename);

    return new Promise<string>((resolve, reject) => {
      const makeRequest = (requestUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const protocol = requestUrl.startsWith('https') ? https : http;
        protocol.get(requestUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com/',
          },
        }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) {
            const redirect = res.headers.location;
            if (redirect) {
              makeRequest(redirect, redirectCount + 1);
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
          let lastTime = Date.now();
          let lastBytes = 0;
          const file = fs.createWriteStream(outputFile);

          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;

            if (elapsed >= 0.5 && onProgress) {
              const bytesPerSec = (downloaded - lastBytes) / elapsed;
              const speed = this.formatSpeed(bytesPerSec);
              const percent = totalSize > 0
                ? Math.min(99, Math.round((downloaded / totalSize) * 100))
                : 0;
              onProgress({ percent, downloaded, total: totalSize, speed });
              lastTime = now;
              lastBytes = downloaded;
            }
          });

          res.pipe(file);
          file.on('finish', () => {
            file.close();
            if (onProgress) {
              onProgress({ percent: 100, downloaded, total: downloaded, speed: '' });
            }
            resolve(outputFile);
          });
          file.on('error', (err) => {
            try {
              if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch { /* ignore */ }
            reject(err);
          });
        }).on('error', reject);
      };

      makeRequest(streamUrl);
    });
  }

  private formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec >= 1048576) {
      return `${(bytesPerSec / 1048576).toFixed(1)} MiB/s`;
    }
    if (bytesPerSec >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(1)} KiB/s`;
    }
    return `${Math.round(bytesPerSec)} B/s`;
  }

  private formatSize(bytes: number): string {
    if (bytes >= 1073741824) {
      return `${(bytes / 1073741824).toFixed(2)} GiB`;
    }
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(2)} MiB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KiB`;
    }
    return `${bytes} B`;
  }
}
