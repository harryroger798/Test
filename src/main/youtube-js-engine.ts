import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

/**
 * YouTube.js (InnerTube API) Ultimate Engine for GrabTube v1.0.9.
 *
 * PRIMARY download engine for YouTube with 4 enhancement layers:
 *
 * 1. Multi-client rotation (WEB -> ANDROID -> IOS -> MWEB -> TV)
 *    Each client has different bot detection rules. ANDROID sometimes
 *    returns direct MP4 URLs without cipher.
 *
 * 2. Random visitor data generation (NewPipe's approach)
 *    Generate random but valid-looking visitor data cookies.
 *
 * 3. POT token generation (BotGuard bypass)
 *    Generate Proof of Origin tokens without a real browser.
 *
 * 4. Automatic fallback chain with all clients
 *    YouTube.js (5 clients) -> yt-dlp + browser cookies -> Cobalt API
 *
 * The user never sees which engine or client is used.
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
 * InnerTube client types to rotate through.
 */
type InnerTubeClientType = 'WEB' | 'MWEB' | 'ANDROID' | 'IOS' | 'TV';

const CLIENT_ROTATION_ORDER: InnerTubeClientType[] = [
  'WEB',      // Standard web client — most compatible
  'ANDROID',  // Android client — sometimes returns direct MP4 URLs without cipher
  'IOS',      // iOS client — alternative mobile client
  'MWEB',     // Mobile web — lightweight, fewer restrictions
  'TV',       // TV client — different bot detection rules
];

/**
 * Dynamically import youtubei.js (ESM module).
 */
async function loadInnertube(): Promise<typeof import('youtubei.js')> {
  return import('youtubei.js');
}

/**
 * Generate random visitor data similar to NewPipe's approach.
 * YouTube uses visitor_data to track sessions. Random but valid-looking
 * visitor data helps bypass bot detection without needing real cookies.
 */
function generateRandomVisitorData(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let visitorId = '';
  for (let i = 0; i < 11; i++) {
    visitorId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const data = Buffer.from(`\x0a\x0b${visitorId}\x28${encodeVarint(timestamp)}`);
  return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Encode an integer as a protobuf varint.
 */
function encodeVarint(value: number): string {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return String.fromCharCode(...bytes);
}

/**
 * POT (Proof of Origin) Token Manager.
 * Generates BotGuard tokens without a real browser using youtube-po-token-generator.
 */
class POTTokenManager {
  private cachedToken: { visitorData: string; poToken: string } | null = null;
  private cacheTime = 0;
  private static readonly TOKEN_TTL = 15 * 60 * 1000; // 15 minutes
  private generating = false;

  async getToken(): Promise<{ visitorData: string; poToken: string } | null> {
    if (this.cachedToken && (Date.now() - this.cacheTime) < POTTokenManager.TOKEN_TTL) {
      return this.cachedToken;
    }
    if (this.generating) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return this.cachedToken;
    }
    this.generating = true;
    try {
      const token = await this.generateToken();
      if (token) {
        this.cachedToken = token;
        this.cacheTime = Date.now();
        console.log('[GrabTube][POT] Generated fresh POT token');
      }
      return token;
    } catch (err) {
      console.log('[GrabTube][POT] Token generation failed:', err instanceof Error ? err.message : 'unknown');
      return this.cachedToken;
    } finally {
      this.generating = false;
    }
  }

  private async generateToken(): Promise<{ visitorData: string; poToken: string } | null> {
    try {
      const potGenerator = await import('youtube-po-token-generator');
      const generate = potGenerator.generate || potGenerator.default?.generate;
      if (!generate) {
        console.log('[GrabTube][POT] Generator function not found in module');
        return null;
      }
      const result = await generate();
      if (result && result.visitorData && result.poToken) {
        return { visitorData: result.visitorData, poToken: result.poToken };
      }
      return null;
    } catch (err) {
      console.log('[GrabTube][POT] Generator not available:', err instanceof Error ? err.message : 'unknown');
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await import('youtube-po-token-generator');
      return true;
    } catch {
      return false;
    }
  }
}

export class YouTubeJSEngine {
  private clientInstances: Map<string, unknown> = new Map();
  private initPromises: Map<string, Promise<void>> = new Map();
  private lastInitTimes: Map<string, number> = new Map();
  private potManager: POTTokenManager = new POTTokenManager();
  private static readonly REINIT_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private lastSuccessfulClient: InnerTubeClientType | null = null;

  /**
   * Initialize a specific InnerTube client type with random visitor data + POT token.
   */
  async initClient(clientType: InnerTubeClientType = 'WEB'): Promise<void> {
    const now = Date.now();
    const lastInit = this.lastInitTimes.get(clientType) || 0;
    const existing = this.clientInstances.get(clientType);

    if (existing && (now - lastInit) < YouTubeJSEngine.REINIT_INTERVAL) {
      return;
    }

    const existingPromise = this.initPromises.get(clientType);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      try {
        const { Innertube } = await loadInnertube();
        const visitorData = generateRandomVisitorData();
        const potToken = await this.potManager.getToken();

        const createOptions: Record<string, unknown> = {
          lang: 'en',
          location: 'US',
          visitor_data: potToken?.visitorData || visitorData,
        };

        if (potToken?.poToken) {
          createOptions.po_token = potToken.poToken;
        }

        if (clientType !== 'WEB') {
          createOptions.client_type = clientType;
        }

        const instance = await Innertube.create(createOptions);
        this.clientInstances.set(clientType, instance);
        this.lastInitTimes.set(clientType, Date.now());
        console.log(`[GrabTube][YTJS] ${clientType} client initialized${potToken ? ' (with POT token)' : ' (with random visitor data)'}`);
      } catch (err) {
        console.error(`[GrabTube][YTJS] Failed to initialize ${clientType} client:`, err);
        this.clientInstances.delete(clientType);
        throw err;
      } finally {
        this.initPromises.delete(clientType);
      }
    })();

    this.initPromises.set(clientType, promise);
    return promise;
  }

  /**
   * Initialize the default (WEB) client. Backward compatible.
   */
  async init(): Promise<void> {
    return this.initClient('WEB');
  }

  /**
   * Check if the engine is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.initClient('WEB');
      return this.clientInstances.has('WEB');
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
   * Get video info with automatic client rotation.
   * Tries multiple InnerTube clients until one succeeds.
   */
  async getVideoInfo(url: string): Promise<YTJSVideoInfo> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const clientOrder = this.getClientOrder();
    let lastError: Error | null = null;

    for (const clientType of clientOrder) {
      try {
        console.log(`[GrabTube][YTJS] Trying ${clientType} client for video info...`);
        const info = await this.getVideoInfoWithClient(videoId, clientType);
        this.lastSuccessfulClient = clientType;
        console.log(`[GrabTube][YTJS] ${clientType} client succeeded for video info`);
        return info;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.log(`[GrabTube][YTJS] ${clientType} client failed: ${lastError.message.substring(0, 80)}`);
        this.lastInitTimes.delete(clientType);
        continue;
      }
    }

    throw lastError || new Error('All InnerTube clients failed');
  }

  private getClientOrder(): InnerTubeClientType[] {
    if (this.lastSuccessfulClient) {
      return [this.lastSuccessfulClient, ...CLIENT_ROTATION_ORDER.filter((c) => c !== this.lastSuccessfulClient)];
    }
    return [...CLIENT_ROTATION_ORDER];
  }

  private async getVideoInfoWithClient(videoId: string, clientType: InnerTubeClientType): Promise<YTJSVideoInfo> {
    await this.initClient(clientType);

    const yt = this.clientInstances.get(clientType) as InstanceType<Awaited<ReturnType<typeof loadInnertube>>['Innertube']>;
    if (!yt) {
      throw new Error(`${clientType} client not initialized`);
    }

    const info = await yt.getInfo(videoId);
    const basicInfo = info.basic_info;
    if (!basicInfo || !basicInfo.title) {
      throw new Error(`Failed to get video info from ${clientType} client`);
    }

    const formats: YTJSVideoFormat[] = [];
    const streamingData = info.streaming_data;

    if (streamingData) {
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
   * Download a YouTube video with automatic client rotation.
   */
  async download(
    url: string,
    outputPath: string,
    filename: string,
    audioOnly: boolean,
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<string> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const clientOrder = this.getClientOrder();
    let lastError: Error | null = null;

    for (const clientType of clientOrder) {
      try {
        console.log(`[GrabTube][YTJS] Trying ${clientType} client for download...`);
        const result = await this.downloadWithClient(videoId, clientType, outputPath, filename, audioOnly, onProgress);
        this.lastSuccessfulClient = clientType;
        console.log(`[GrabTube][YTJS] ${clientType} client download SUCCESS`);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.log(`[GrabTube][YTJS] ${clientType} download failed: ${lastError.message.substring(0, 80)}`);
        this.lastInitTimes.delete(clientType);
        if (onProgress) {
          onProgress({ percent: 0, downloaded: 0, total: 0, speed: 'Trying next method...' });
        }
        continue;
      }
    }

    throw lastError || new Error('All InnerTube clients failed to download');
  }

  /**
   * Download using a specific InnerTube client.
   * Tries built-in download first, then falls back to direct URL download.
   */
  private async downloadWithClient(
    videoId: string,
    clientType: InnerTubeClientType,
    outputPath: string,
    filename: string,
    audioOnly: boolean,
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<string> {
    await this.initClient(clientType);

    const yt = this.clientInstances.get(clientType) as InstanceType<Awaited<ReturnType<typeof loadInnertube>>['Innertube']>;
    if (!yt) {
      throw new Error(`${clientType} client not initialized`);
    }

    const info = await yt.getInfo(videoId);
    if (!info.basic_info?.title) {
      throw new Error(`${clientType}: Could not get video info`);
    }

    const safeTitle = (filename || info.basic_info.title || 'video')
      .replace(/[<>:"/\\|?*]/g, '_')
      .substring(0, 200);
    const ext = audioOnly ? 'mp3' : 'mp4';
    const outputFile = path.join(outputPath, `${safeTitle}.${ext}`);

    // Method 1: YouTube.js built-in download (handles muxing)
    try {
      const downloadOptions: Record<string, unknown> = audioOnly
        ? { type: 'audio', quality: 'best' }
        : { type: 'video+audio', quality: 'best' };

      const stream = await info.download(downloadOptions);
      await this.writeStreamToFile(stream, outputFile, info, onProgress);
      return outputFile;
    } catch (downloadErr) {
      console.log(`[GrabTube][YTJS] ${clientType} download() failed, trying direct URL...`);
    }

    // Method 2: Direct URL download from deciphered format URLs
    const streamingData = info.streaming_data;
    if (!streamingData) {
      throw new Error(`${clientType}: No streaming data available`);
    }

    const allFormats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptive_formats || []),
    ];

    const targetFormats = audioOnly
      ? allFormats.filter((f) => !f.width || !f.height)
      : allFormats.filter((f) => f.width && f.height);

    const formatsToTry = targetFormats.length > 0 ? targetFormats : allFormats;
    formatsToTry.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    for (const fmt of formatsToTry.slice(0, 3)) {
      try {
        const directUrl = await fmt.decipher(yt.session.player);
        if (!directUrl) continue;
        await this.downloadFromDirectUrl(directUrl, outputFile, onProgress);
        return outputFile;
      } catch {
        continue;
      }
    }

    throw new Error(`${clientType}: All format URLs failed`);
  }

  /**
   * Write a ReadableStream to a file with progress tracking.
   */
  private async writeStreamToFile(
    stream: ReadableStream<Uint8Array>,
    outputFile: string,
    info: { streaming_data?: { formats?: Array<{ content_length?: number }>; adaptive_formats?: Array<{ content_length?: number }> } },
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<void> {
    const fileStream = fs.createWriteStream(outputFile);
    let downloaded = 0;
    let totalSize = 0;

    if (info.streaming_data) {
      const allFormats = [
        ...(info.streaming_data.formats || []),
        ...(info.streaming_data.adaptive_formats || []),
      ];
      if (allFormats.length > 0) {
        const bestFormat = allFormats.reduce((best, f) =>
          (f.content_length || 0) > (best.content_length || 0) ? f : best
        );
        totalSize = bestFormat.content_length || 0;
      }
    }

    let lastTime = Date.now();
    let lastBytes = 0;

    return new Promise<void>((resolve, reject) => {
      const writeChunks = async () => {
        try {
          const reader = stream.getReader();
          let readResult = await reader.read();
          while (!readResult.done) {
            const buffer = Buffer.from(readResult.value);
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

            readResult = await reader.read();
          }

          fileStream.end();
          fileStream.on('finish', () => {
            if (onProgress) {
              onProgress({ percent: 100, downloaded, total: downloaded, speed: '' });
            }
            console.log(`[GrabTube][YTJS] Download complete: ${outputFile} (${this.formatSize(downloaded)})`);
            resolve();
          });
        } catch (err) {
          fileStream.close();
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
   * Download from a direct URL with progress tracking (internal).
   */
  private downloadFromDirectUrl(
    streamUrl: string,
    outputFile: string,
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
            resolve();
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

  /**
   * Download a video using direct URL streaming (public API for download-manager).
   */
  async downloadFromUrl(
    streamUrl: string,
    outputPath: string,
    filename: string,
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<string> {
    const outputFile = path.join(outputPath, filename);
    await this.downloadFromDirectUrl(streamUrl, outputFile, onProgress);
    return outputFile;
  }

  /**
   * Refresh all clients (force re-initialization on next use).
   */
  refreshAllClients(): void {
    this.lastInitTimes.clear();
    this.clientInstances.clear();
    this.initPromises.clear();
    console.log('[GrabTube][YTJS] All clients cleared for refresh');
  }

  /**
   * Get the POT token manager.
   */
  getPOTManager(): POTTokenManager {
    return this.potManager;
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
