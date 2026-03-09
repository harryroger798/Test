import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

/**
 * YouTube.js (InnerTube API) Engine for GrabTube v1.0.10.
 *
 * PRIMARY download engine for YouTube -- no cookies, no auth, no proxy needed.
 *
 * Key insight (March 2026): YouTube now separates metadata access (InnerTube
 * player endpoint) from media delivery (Google Video Server / GVS). The GVS
 * requires Proof of Origin (PO) tokens for WEB/MWEB/ANDROID clients, but
 * TV clients (TVHTML5) do NOT require PO tokens for any request type.
 *
 * Strategy:
 *   1. Create ONE Innertube session (generate locally for speed)
 *   2. Use yt.download(videoId, { client: 'TV', ... }) as primary method
 *      -- TV client has NO PO token requirement for GVS
 *   3. Rotate through clients that don't need PO tokens first:
 *      TV -> TV_SIMPLY -> WEB_EMBEDDED -> then others as fallback
 *   4. Fall back to direct URL download from deciphered format URLs
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
 * InnerTube client types for download -- ordered by PO token requirements.
 * Clients that do NOT require PO tokens come first.
 *
 * From yt-dlp PO Token Guide (March 2026):
 *   TV:           No PO token required (but may get DRM if overused)
 *   TV_SIMPLY:    No PO token required, no account cookies
 *   WEB_EMBEDDED: No PO token required (embeddable videos only)
 *   MWEB:         PO token for GVS only
 *   ANDROID:      PO token for GVS or Player
 *   IOS:          PO token rolling out
 *   WEB:          Only SABR formats, PO token for GVS+Subs
 */
type InnerTubeClientType = 'TV' | 'TV_SIMPLY' | 'WEB_EMBEDDED' | 'MWEB' | 'ANDROID' | 'IOS' | 'WEB';

const CLIENT_ROTATION_ORDER: InnerTubeClientType[] = [
  'TV',           // No PO token needed -- primary download client
  'TV_SIMPLY',    // No PO token needed -- fallback TV client
  'WEB_EMBEDDED', // No PO token needed -- embeddable videos only
  'MWEB',         // Needs PO token for GVS but may work without
  'ANDROID',      // Needs PO token but sometimes returns direct MP4 URLs
  'IOS',          // PO token rolling out
  'WEB',          // Last resort -- SABR only, needs PO token
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

export class YouTubeJSEngine {
  /**
   * Single Innertube instance -- we use ONE session and pass `client`
   * at the getInfo()/download() call level for client rotation.
   */
  private ytInstance: unknown = null;
  private initPromise: Promise<void> | null = null;
  private lastInitTime = 0;
  private lastSuccessfulClient: InnerTubeClientType | null = null;
  private static readonly REINIT_INTERVAL = 30 * 60 * 1000; // 30 minutes

  /**
   * Initialize a single Innertube instance.
   * Uses generate_session_locally for speed -- no extra YouTube API call needed.
   */
  async init(): Promise<void> {
    const now = Date.now();
    if (this.ytInstance && (now - this.lastInitTime) < YouTubeJSEngine.REINIT_INTERVAL) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const { Innertube } = await loadInnertube();
        const visitorData = generateRandomVisitorData();

        this.ytInstance = await Innertube.create({
          lang: 'en',
          location: 'US',
          generate_session_locally: true,
          visitor_data: visitorData,
        });

        this.lastInitTime = Date.now();
        console.log('[GrabTube][YTJS] Innertube session initialized (local generation, random visitor data)');
      } catch (err) {
        console.error('[GrabTube][YTJS] Failed to initialize Innertube:', err);
        this.ytInstance = null;
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Check if the engine is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.init();
      return this.ytInstance !== null;
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
   * Get the client rotation order, prioritizing last successful client.
   */
  private getClientOrder(): InnerTubeClientType[] {
    if (this.lastSuccessfulClient) {
      return [this.lastSuccessfulClient, ...CLIENT_ROTATION_ORDER.filter((c) => c !== this.lastSuccessfulClient)];
    }
    return [...CLIENT_ROTATION_ORDER];
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

    await this.init();

    const yt = this.ytInstance as InstanceType<Awaited<ReturnType<typeof loadInnertube>>['Innertube']>;
    if (!yt) {
      throw new Error('Innertube not initialized');
    }

    const clientOrder = this.getClientOrder();
    let lastError: Error | null = null;

    for (const clientType of clientOrder) {
      try {
        console.log(`[GrabTube][YTJS] Trying ${clientType} client for video info...`);
        const info = await yt.getInfo(videoId, { client: clientType });
        const basicInfo = info.basic_info;
        if (!basicInfo || !basicInfo.title) {
          throw new Error(`No video info from ${clientType} client`);
        }

        this.lastSuccessfulClient = clientType;
        console.log(`[GrabTube][YTJS] ${clientType} client succeeded for video info`);

        // Extract formats
        const formats: YTJSVideoFormat[] = [];
        const streamingData = info.streaming_data;
        if (streamingData) {
          const allStreamFormats = [
            ...(streamingData.formats || []),
            ...(streamingData.adaptive_formats || []),
          ];
          for (const f of allStreamFormats) {
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
                  hasAudio: !hasVideo || !!(f.has_audio),
                  contentLength: f.content_length || 0,
                  url: decipheredUrl,
                });
              }
            } catch {
              // Skip formats that can't be deciphered
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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.log(`[GrabTube][YTJS] ${clientType} client failed for info: ${lastError.message.substring(0, 100)}`);
        continue;
      }
    }

    throw lastError || new Error('All InnerTube clients failed for video info');
  }

  /**
   * Download a YouTube video with automatic client rotation.
   *
   * Uses yt.download(videoId, options) which is the Innertube top-level
   * download method. This handles format selection, deciphering, and
   * streaming internally. The `client` option tells YouTube.js which
   * InnerTube client to use for both the player request AND the GVS
   * (Google Video Server) media delivery request.
   *
   * TV client is tried first because it does NOT require PO tokens.
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

    await this.init();

    const yt = this.ytInstance as InstanceType<Awaited<ReturnType<typeof loadInnertube>>['Innertube']>;
    if (!yt) {
      throw new Error('Innertube not initialized');
    }

    const clientOrder = this.getClientOrder();
    let lastError: Error | null = null;

    for (const clientType of clientOrder) {
      try {
        console.log(`[GrabTube][YTJS] Trying ${clientType} client for download...`);

        // Build safe filename
        let safeTitle: string;
        try {
          const info = await yt.getBasicInfo(videoId, { client: clientType });
          safeTitle = (filename || info.basic_info?.title || 'video')
            .replace(/[<>:"/\\|?*]/g, '_')
            .substring(0, 200);
        } catch {
          safeTitle = (filename || 'video')
            .replace(/[<>:"/\\|?*]/g, '_')
            .substring(0, 200);
        }
        const ext = audioOnly ? 'mp3' : 'mp4';
        const outputFile = path.join(outputPath, `${safeTitle}.${ext}`);

        // Method 1: Use Innertube.download() -- top-level method that handles
        // format selection, deciphering, and streaming. Passing `client` ensures
        // the correct client is used for both player AND GVS requests.
        try {
          console.log(`[GrabTube][YTJS] ${clientType}: Trying yt.download() (Innertube-level)...`);
          const stream = await yt.download(videoId, {
            client: clientType,
            type: audioOnly ? 'audio' : 'video+audio',
            quality: 'best',
          });

          await this.writeStreamToFile(stream, outputFile, onProgress);
          this.lastSuccessfulClient = clientType;
          console.log(`[GrabTube][YTJS] ${clientType} download SUCCESS via yt.download(): ${outputFile}`);
          return outputFile;
        } catch (dlErr) {
          const dlMsg = dlErr instanceof Error ? dlErr.message : String(dlErr);
          console.log(`[GrabTube][YTJS] ${clientType}: yt.download() failed: ${dlMsg.substring(0, 100)}`);
        }

        // Method 2: Get info and use info.download() -- MediaInfo-level method.
        try {
          console.log(`[GrabTube][YTJS] ${clientType}: Trying info.download() (MediaInfo-level)...`);
          const info = await yt.getInfo(videoId, { client: clientType });
          const stream = await info.download({
            type: audioOnly ? 'audio' : 'video+audio',
            quality: 'best',
          });

          await this.writeStreamToFile(stream, outputFile, onProgress);
          this.lastSuccessfulClient = clientType;
          console.log(`[GrabTube][YTJS] ${clientType} download SUCCESS via info.download(): ${outputFile}`);
          return outputFile;
        } catch (infoErr) {
          const infoMsg = infoErr instanceof Error ? infoErr.message : String(infoErr);
          console.log(`[GrabTube][YTJS] ${clientType}: info.download() failed: ${infoMsg.substring(0, 100)}`);
        }

        // Method 3: Direct URL download from deciphered format URLs.
        try {
          console.log(`[GrabTube][YTJS] ${clientType}: Trying direct URL download...`);
          const info = await yt.getBasicInfo(videoId, { client: clientType });
          const streamingData = info.streaming_data;
          if (!streamingData) {
            throw new Error('No streaming data');
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

          let directSuccess = false;
          for (const fmt of formatsToTry.slice(0, 3)) {
            try {
              const directUrl = await fmt.decipher(yt.session.player);
              if (!directUrl) continue;
              console.log(`[GrabTube][YTJS] ${clientType}: Trying direct URL for itag ${fmt.itag}...`);
              await this.downloadFromDirectUrl(directUrl, outputFile, onProgress);
              directSuccess = true;
              break;
            } catch {
              continue;
            }
          }

          if (directSuccess) {
            this.lastSuccessfulClient = clientType;
            console.log(`[GrabTube][YTJS] ${clientType} download SUCCESS via direct URL: ${outputFile}`);
            return outputFile;
          }
        } catch (directErr) {
          const directMsg = directErr instanceof Error ? directErr.message : String(directErr);
          console.log(`[GrabTube][YTJS] ${clientType}: Direct URL failed: ${directMsg.substring(0, 100)}`);
        }

        // All 3 methods failed for this client -- try next client
        lastError = new Error(`${clientType}: All download methods failed`);
        if (onProgress) {
          onProgress({ percent: 0, downloaded: 0, total: 0, speed: 'Trying next method...' });
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.log(`[GrabTube][YTJS] ${clientType} download failed completely: ${lastError.message.substring(0, 100)}`);
        continue;
      }
    }

    throw lastError || new Error('All InnerTube clients failed to download');
  }

  /**
   * Write a ReadableStream to a file with progress tracking.
   */
  private async writeStreamToFile(
    stream: ReadableStream<Uint8Array>,
    outputFile: string,
    onProgress?: (progress: YTJSDownloadProgress) => void
  ): Promise<void> {
    const fileStream = fs.createWriteStream(outputFile);
    let downloaded = 0;
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
              // We don't know total size from stream, report progress based on downloaded bytes
              onProgress({ percent: 0, downloaded, total: 0, speed });
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
   * Refresh the Innertube instance (force re-initialization on next use).
   */
  refreshAllClients(): void {
    this.lastInitTime = 0;
    this.ytInstance = null;
    this.initPromise = null;
    this.lastSuccessfulClient = null;
    console.log('[GrabTube][YTJS] Session cleared for refresh');
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
