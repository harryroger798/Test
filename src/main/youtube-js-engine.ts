/**
 * YouTube.js (InnerTube API) Engine for GrabTube v1.0.12.
 *
 * METADATA-ONLY engine for YouTube -- used for fast video info retrieval
 * (title, thumbnail, duration, author). Does NOT handle downloads.
 *
 * Why metadata-only (v1.0.11):
 *   - YouTube.js v16.0.1 cannot extract signature decipher functions,
 *     so it returns 0 playable format URLs for most clients.
 *   - TV clients now return DRM-protected streams (YouTube rolled out
 *     DRM on ALL videos for TV/TVHTML5 clients in March 2025).
 *   - YouTube.js CAN still fetch basic video metadata (title, thumbnail,
 *     duration) via TV_SIMPLY and other clients without auth.
 *
 * Downloads are handled by yt-dlp with --impersonate chrome + Deno runtime,
 * which is the proven working approach (see ytdlp-manager.ts).
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
 * InnerTube client types -- ordered by reliability for metadata retrieval.
 * TV_SIMPLY and TV do NOT require PO tokens, so they are tried first.
 * MWEB/ANDROID/IOS require PO tokens and trigger more bot detection,
 * so they are excluded from the metadata-only rotation.
 */
type InnerTubeClientType = 'TV_SIMPLY' | 'TV' | 'WEB_EMBEDDED' | 'MWEB' | 'ANDROID' | 'IOS' | 'WEB';

const CLIENT_ROTATION_ORDER: InnerTubeClientType[] = [
  'TV_SIMPLY',    // Best for metadata -- no auth, no PO token required
  'TV',           // No PO token required, sometimes needs auth
  'WEB_EMBEDDED', // No PO token required, embeddable videos only
  'WEB',          // Last resort -- has GVS enforcement but can return metadata
];

/**
 * Dynamically import youtubei.js (ESM module).
 */
async function loadInnertube(): Promise<typeof import('youtubei.js')> {
  return import('youtubei.js');
}

/**
 * Wrap a promise with a timeout. Cleans up the timer on completion.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Generate random visitor data similar to NewPipe's approach.
 * YouTube uses visitor_data to track sessions. Random but valid-looking
 * visitor data helps bypass bot detection without needing real cookies.
 */
function generateRandomVisitorData(): string {
  // Generate 11 random ASCII characters for the visitor ID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const visitorIdBytes: number[] = [];
  for (let i = 0; i < 11; i++) {
    visitorIdBytes.push(chars.charCodeAt(Math.floor(Math.random() * chars.length)));
  }
  const timestamp = Math.floor(Date.now() / 1000);
  // Build protobuf-style binary data using raw byte arrays (not string concatenation)
  // to avoid UTF-8 encoding corruption
  const varintBytes = encodeVarintBytes(timestamp);
  const data = Buffer.from([
    0x0a, 0x0b,  // field 1, length 11
    ...visitorIdBytes,
    0x28,        // field 5, varint
    ...varintBytes,
  ]);
  return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Encode an integer as a protobuf varint, returning raw byte values.
 * Using number[] instead of String.fromCharCode avoids UTF-8 encoding issues
 * when the bytes are later concatenated into a Buffer.
 */
function encodeVarintBytes(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

export class YouTubeJSEngine {
  /**
   * Single Innertube instance for metadata retrieval.
   * Downloads are handled by yt-dlp (not this engine).
   */
  private ytInstance: unknown = null;
  private initPromise: Promise<void> | null = null;
  private lastInitTime = 0;
  private lastSuccessfulClient: InnerTubeClientType | null = null;
  private static readonly REINIT_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private static readonly CLIENT_TIMEOUT_MS = 8000;  // 8 sec per client
  private static readonly TOTAL_METADATA_TIMEOUT_MS = 20000;  // 20 sec total for all clients

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
        console.log('[GrabTube][YTJS] Innertube session initialized (metadata-only mode)');
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
   * Get video info (metadata only) with automatic client rotation.
   * Tries multiple InnerTube clients until one succeeds.
   *
   * Note: Format URLs from YouTube.js are NOT reliable for downloading
   * (signature decipher is broken in v16.0.1). The formats array may be
   * empty -- that's expected. yt-dlp handles format discovery for downloads.
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
    const overallStart = Date.now();

    for (const clientType of clientOrder) {
      // Check overall timeout before trying another client
      if (Date.now() - overallStart > YouTubeJSEngine.TOTAL_METADATA_TIMEOUT_MS) {
        console.log('[GrabTube][YTJS] Overall metadata timeout reached, giving up on YouTube.js');
        break;
      }

      try {
        console.log(`[GrabTube][YTJS] Trying ${clientType} client for video info...`);

        // Race yt.getInfo against a per-client timeout (capped by remaining overall budget)
        const elapsed = Date.now() - overallStart;
        const remaining = YouTubeJSEngine.TOTAL_METADATA_TIMEOUT_MS - elapsed;
        const budget = Math.min(YouTubeJSEngine.CLIENT_TIMEOUT_MS, remaining);
        const info = await withTimeout(
          yt.getInfo(videoId, { client: clientType }),
          budget,
          `yt.getInfo(${clientType})`
        );
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
              // Skip formats that can't be deciphered -- expected in v16.0.1
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
   * Refresh the Innertube instance (force re-initialization on next use).
   */
  refreshAllClients(): void {
    this.lastInitTime = 0;
    this.ytInstance = null;
    this.initPromise = null;
    this.lastSuccessfulClient = null;
    console.log('[GrabTube][YTJS] Session cleared for refresh');
  }
}
