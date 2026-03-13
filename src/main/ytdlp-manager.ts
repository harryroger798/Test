import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BinaryManager } from './binary-manager';
import { PotProviderManager } from './pot-provider';

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  vcodec: string;
  acodec: string;
  fps: number | null;
  tbr: number | null;
  quality: string;
  hasVideo: boolean;
  hasAudio: boolean;
  note: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  durationString: string;
  uploader: string;
  uploaderUrl: string;
  viewCount: number;
  likeCount: number;
  uploadDate: string;
  webpage_url: string;
  extractor: string;
  platform: string;
  formats: VideoFormat[];
  subtitles: Record<string, Array<{ ext: string; url: string }>>;
  requestedSubtitles: Record<string, unknown> | null;
}

export interface DownloadProgress {
  downloadId: string;
  status: 'downloading' | 'processing' | 'finished' | 'error';
  percent: number;
  speed: string;
  eta: string;
  filesize: string;
  filename: string;
  error?: string;
}

/**
 * Platform-specific bypass configuration.
 * Each platform may need different flags to avoid bans/blocks.
 */
interface PlatformBypassConfig {
  impersonate?: string;
  formatOverride?: string;
  extraArgs?: string[];
  requiresCookies?: boolean;
  cookiesHint?: string;
}

const PLATFORM_BYPASS_CONFIG: Record<string, PlatformBypassConfig> = {
  // ─── Tier 1: Major platforms with specific anti-detection needs ───
  youtube: {
    impersonate: 'chrome',
    extraArgs: ['-4'],
    requiresCookies: false,
    cookiesHint: 'YouTube works best with browser cookies or --impersonate chrome for reliable downloads.',
  },
  tiktok: {
    impersonate: 'chrome-131',
    formatOverride: 'b',
    extraArgs: [],
    requiresCookies: false,
    cookiesHint: 'TikTok works from home IPs with browser impersonation. May be blocked on datacenter IPs.',
  },
  instagram: {
    impersonate: 'chrome-131',
    requiresCookies: true,
    cookiesHint: 'Instagram requires login cookies. Import cookies.txt via Settings.',
  },
  facebook: {
    impersonate: 'chrome-131',
    requiresCookies: false,
    cookiesHint: 'Public Facebook videos work with impersonation. Private videos need cookies.',
  },
  twitter: {
    impersonate: 'chrome',
    requiresCookies: false,
    cookiesHint: 'Public video tweets work without auth. NSFW/sensitive content needs cookies.',
  },
  // ─── Tier 2: Popular platforms with light anti-detection ───
  reddit: {
    impersonate: 'chrome',
    requiresCookies: false,
    cookiesHint: 'Reddit works from home IPs. May need cookies on datacenter/cloud IPs.',
  },
  linkedin: {
    impersonate: 'chrome',
    requiresCookies: true,
    cookiesHint: 'LinkedIn always requires login cookies.',
  },
  vimeo: {
    impersonate: 'chrome',
    requiresCookies: false,
    cookiesHint: 'Public Vimeo videos work without auth. Private/password-protected videos need cookies.',
  },
  twitch: {
    impersonate: 'chrome',
    requiresCookies: false,
    cookiesHint: 'Twitch VODs and clips work without auth. Subscriber-only content needs cookies.',
  },
  dailymotion: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  bilibili: {
    impersonate: 'chrome',
    extraArgs: ['--geo-bypass-country', 'CN'],
    requiresCookies: false,
    cookiesHint: 'Bilibili may need a Chinese proxy for geo-restricted content.',
  },
  soundcloud: {
    requiresCookies: false,
  },
  pinterest: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  // ─── Tier 3: Niche but popular platforms ───
  rumble: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  bandcamp: {
    requiresCookies: false,
  },
  bitchute: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  archive: {
    requiresCookies: false,
  },
  odnoklassniki: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  rutube: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  nicovideo: {
    impersonate: 'chrome',
    requiresCookies: true,
    cookiesHint: 'Niconico requires login cookies for most content.',
  },
  pornhub: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  xvideos: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  naver: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  vlive: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  weibo: {
    impersonate: 'chrome',
    requiresCookies: true,
    cookiesHint: 'Weibo requires login cookies.',
  },
  iqiyi: {
    impersonate: 'chrome',
    extraArgs: ['--geo-bypass-country', 'CN'],
    requiresCookies: false,
  },
  youku: {
    impersonate: 'chrome',
    extraArgs: ['--geo-bypass-country', 'CN'],
    requiresCookies: false,
  },
  kakao: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  lbry: {
    requiresCookies: false,
  },
  peertube: {
    requiresCookies: false,
  },
  dropbox: {
    requiresCookies: false,
  },
  mixcloud: {
    requiresCookies: false,
  },
  streamable: {
    requiresCookies: false,
  },
  mediafire: {
    requiresCookies: false,
  },
  ted: {
    requiresCookies: false,
  },
  imdb: {
    impersonate: 'chrome',
    requiresCookies: false,
  },
  crunchyroll: {
    impersonate: 'chrome',
    requiresCookies: true,
    cookiesHint: 'Crunchyroll requires login cookies for premium content.',
  },
  funimation: {
    impersonate: 'chrome',
    requiresCookies: true,
    cookiesHint: 'Funimation requires login cookies.',
  },
};

export class YtdlpManager {
  private ytdlpPath: string;
  private ffmpegPath: string;
  private pluginDir: string;
  private binaryManager: BinaryManager;
  private potProvider: PotProviderManager;

  /**
   * Cached browser name that successfully extracted cookies for YouTube.
   * Once detected, all subsequent YouTube requests use this browser automatically.
   */
  private autoBrowser: string | null = null;

  /**
   * Whether we've already run proactive browser detection.
   */
  private browserDetectionDone = false;

  /**
   * OAuth2 refresh token path for YouTube authentication.
   * Stored in the app config directory for persistence across sessions.
   */
  private oauth2TokenPath: string | null = null;

  /**
   * Browsers to try for automatic cookie extraction, ordered by popularity.
   * yt-dlp supports these via --cookies-from-browser.
   */
  private static readonly AUTO_BROWSERS = [
    'firefox', 'edge', 'brave', 'opera', 'vivaldi', 'chromium', 'chrome',
  ];

  constructor(binaryManager?: BinaryManager) {
    this.binaryManager = binaryManager || new BinaryManager();
    this.potProvider = new PotProviderManager(this.binaryManager);
    this.ytdlpPath = this.binaryManager.getYtdlpPath();
    this.ffmpegPath = this.binaryManager.getFfmpegPath();
    this.pluginDir = this.binaryManager.getPluginDir();

    // OAuth2 token cache path
    const configDir = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'GrabTube')
      : path.join(os.homedir(), '.config', 'GrabTube');
    this.oauth2TokenPath = path.join(configDir, 'oauth2-token.json');

    // Install POT plugin to yt-dlp user config directory.
    // The standalone yt-dlp binary ignores --plugin-dirs, so we must
    // copy plugins into ~/.config/yt-dlp/plugins/ for them to load.
    this.installPluginsToConfigDir();
  }

  /**
   * Copy bundled POT provider plugins to the yt-dlp user config plugin directory.
   * Standalone yt-dlp binaries only load plugins from the default config path,
   * not from --plugin-dirs, so we replicate the plugin files there.
   */
  private installPluginsToConfigDir(): void {
    try {
      const srcPluginDir = this.pluginDir;
      const srcExtractorDir = path.join(srcPluginDir, 'yt_dlp_plugins', 'extractor');
      if (!fs.existsSync(srcExtractorDir)) return;

      const configBase = process.platform === 'win32'
        ? path.join(os.homedir(), 'AppData', 'Roaming', 'yt-dlp', 'plugins')
        : path.join(os.homedir(), '.config', 'yt-dlp', 'plugins');

      const destDir = path.join(configBase, 'grabtube-pot', 'yt_dlp_plugins', 'extractor');
      fs.mkdirSync(destDir, { recursive: true });

      // Copy all .py files from the bundled plugin directory
      const files = fs.readdirSync(srcExtractorDir).filter((f) => f.endsWith('.py'));
      for (const file of files) {
        const src = path.join(srcExtractorDir, file);
        const dest = path.join(destDir, file);
        fs.copyFileSync(src, dest);
      }

      // Ensure __init__.py files exist for namespace packages
      const nsDir = path.join(configBase, 'grabtube-pot', 'yt_dlp_plugins');
      for (const dir of [nsDir, destDir]) {
        const initFile = path.join(dir, '__init__.py');
        if (!fs.existsSync(initFile)) {
          fs.writeFileSync(initFile, '');
        }
      }

      console.log('[GrabTube] POT plugins installed to yt-dlp config dir:', destDir);
    } catch (err) {
      console.warn('[GrabTube] Failed to install plugins to config dir:', err);
    }
  }

  /**
   * Build environment variables for yt-dlp child processes.
   * Adds the bundled binary directory to PATH so that bgutil-pot CLI is found.
   */
  private getSpawnEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    const potPath = this.binaryManager.getPotProviderPath();
    if (potPath) {
      const binDir = path.dirname(potPath);
      env.PATH = binDir + (process.platform === 'win32' ? ';' : ':') + (env.PATH || '');
    }
    return env;
  }

  /**
   * Start the POT provider server for YouTube bypass.
   * Should be called once on app startup.
   */
  async startPotProvider(): Promise<boolean> {
    return this.potProvider.start();
  }

  /**
   * Stop the POT provider server.
   * Should be called on app shutdown.
   */
  stopPotProvider(): void {
    this.potProvider.stop();
  }

  /**
   * Get the POT provider manager instance.
   */
  getPotProvider(): PotProviderManager {
    return this.potProvider;
  }

  /**
   * Get the binary manager instance.
   */
  getBinaryManager(): BinaryManager {
    return this.binaryManager;
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.ytdlpPath, ['--version']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  async getVersion(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ytdlpPath, ['--version']);
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve(output.trim());
        else reject(new Error('Failed to get yt-dlp version'));
      });
      proc.on('error', (err) => reject(err));
    });
  }

  /**
   * Detect platform from URL string.
   */
  detectPlatformFromUrl(url: string): string {
    const lowered = url.toLowerCase();
    // Tier 1: Major platforms
    if (lowered.includes('youtube.com') || lowered.includes('youtu.be')) return 'youtube';
    if (lowered.includes('tiktok.com')) return 'tiktok';
    if (lowered.includes('instagram.com')) return 'instagram';
    if (lowered.includes('twitter.com') || lowered.includes('x.com')) return 'twitter';
    if (lowered.includes('facebook.com') || lowered.includes('fb.watch')) return 'facebook';
    // Tier 2: Popular platforms
    if (lowered.includes('reddit.com')) return 'reddit';
    if (lowered.includes('vimeo.com')) return 'vimeo';
    if (lowered.includes('twitch.tv')) return 'twitch';
    if (lowered.includes('dailymotion.com')) return 'dailymotion';
    if (lowered.includes('soundcloud.com')) return 'soundcloud';
    if (lowered.includes('bilibili.com')) return 'bilibili';
    if (lowered.includes('pinterest.com') || lowered.includes('pin.it')) return 'pinterest';
    if (lowered.includes('linkedin.com')) return 'linkedin';
    // Tier 3: Niche but popular
    if (lowered.includes('rumble.com')) return 'rumble';
    if (lowered.includes('bandcamp.com')) return 'bandcamp';
    if (lowered.includes('bitchute.com')) return 'bitchute';
    if (lowered.includes('archive.org')) return 'archive';
    if (lowered.includes('ok.ru') || lowered.includes('odnoklassniki.ru')) return 'odnoklassniki';
    if (lowered.includes('rutube.ru')) return 'rutube';
    if (lowered.includes('nicovideo.jp') || lowered.includes('nico.ms')) return 'nicovideo';
    if (lowered.includes('pornhub.com')) return 'pornhub';
    if (lowered.includes('xvideos.com')) return 'xvideos';
    if (lowered.includes('naver.com') || lowered.includes('tv.naver.com')) return 'naver';
    if (lowered.includes('vlive.tv')) return 'vlive';
    if (lowered.includes('weibo.com')) return 'weibo';
    if (lowered.includes('iqiyi.com')) return 'iqiyi';
    if (lowered.includes('youku.com')) return 'youku';
    if (lowered.includes('kakao.com') || lowered.includes('kakaotv.daum.net')) return 'kakao';
    if (lowered.includes('lbry.tv') || lowered.includes('odysee.com')) return 'lbry';
    if (lowered.includes('peertube')) return 'peertube';
    if (lowered.includes('dropbox.com')) return 'dropbox';
    if (lowered.includes('mixcloud.com')) return 'mixcloud';
    if (lowered.includes('streamable.com')) return 'streamable';
    if (lowered.includes('mediafire.com')) return 'mediafire';
    if (lowered.includes('ted.com')) return 'ted';
    if (lowered.includes('imdb.com')) return 'imdb';
    if (lowered.includes('crunchyroll.com')) return 'crunchyroll';
    if (lowered.includes('funimation.com')) return 'funimation';
    if (lowered.includes('tumblr.com')) return 'tumblr';
    if (lowered.includes('flickr.com')) return 'flickr';
    if (lowered.includes('9gag.com')) return '9gag';
    if (lowered.includes('spotify.com')) return 'spotify';
    if (lowered.includes('aparat.com')) return 'aparat';
    if (lowered.includes('vidio.com')) return 'vidio';
    if (lowered.includes('hotstar.com') || lowered.includes('disney')) return 'hotstar';
    if (lowered.includes('vk.com') || lowered.includes('vk.video')) return 'vk';
    return 'unknown';
  }

  /**
   * Get bypass config for a given platform.
   */
  getBypassConfig(platform: string): PlatformBypassConfig | undefined {
    return PLATFORM_BYPASS_CONFIG[platform];
  }

  /**
   * Check if an error message indicates YouTube bot/IP block.
   */
  private isBotError(msg: string): boolean {
    const lower = msg.toLowerCase();
    return lower.includes('sign in to confirm') ||
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
           lower.includes('cookies could not be decrypted') ||
           lower.includes('403') ||
           lower.includes('forbidden');
  }

  /**
   * Check if an error is a cookie/browser-related error that means
   * the current browser can't be used (DPAPI, not installed, locked, etc).
   */
  isCookieOrBrowserError(msg: string): boolean {
    const lower = msg.toLowerCase();
    return lower.includes('failed to decrypt') ||
           lower.includes('dpapi') ||
           lower.includes('could not copy') ||
           lower.includes('could not find') ||
           lower.includes('cookie database') ||
           lower.includes('cookies database') ||
           lower.includes('permission denied') ||
           lower.includes('cookies could not be decrypted') ||
           lower.includes('failed to extract cookies') ||
           lower.includes('no cookies were found');
  }

  /**
   * Get the auto-detected browser for cookie extraction.
   * Returns null if no browser has been auto-detected yet.
   */
  getAutoBrowser(): string | null {
    return this.autoBrowser;
  }

  /**
   * Set the auto-detected browser for cookie extraction.
   * Called by DownloadManager when a browser succeeds during download retry.
   */
  setAutoBrowser(browser: string): void {
    this.autoBrowser = browser;
    console.log(`[GrabTube] Auto-detected working browser: ${browser}`);
  }

  /**
   * Check if OAuth2 token exists for YouTube.
   */
  hasOAuth2Token(): boolean {
    return !!this.oauth2TokenPath && fs.existsSync(this.oauth2TokenPath);
  }

  /**
   * Get OAuth2 token cache path.
   */
  getOAuth2TokenPath(): string | null {
    return this.oauth2TokenPath;
  }

  /**
   * Initiate OAuth2 login flow for YouTube.
   * Uses yt-dlp's built-in OAuth2 support which opens a browser window.
   * Returns a promise that resolves when auth completes.
   */
  async initiateOAuth2Login(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const safeResolve = (value: { success: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const args = [
        '--username', 'oauth2',
        '--password', '',
        '--cache-dir', path.dirname(this.oauth2TokenPath || ''),
        '--dump-json',
        '--no-download',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Test video for auth
      ];

      // Add Deno runtime for YouTube
      const denoPath = this.binaryManager.getDenoPath();
      if (denoPath) {
        args.unshift('--js-runtimes', 'deno:' + denoPath);
      }

      console.log('[GrabTube] Starting OAuth2 login flow...');
      const proc = spawn(this.ytdlpPath, args, { env: this.getSpawnEnv() });
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          // Mark token as available — use recursive mkdirSync unconditionally (no TOCTOU)
          if (this.oauth2TokenPath) {
            fs.mkdirSync(path.dirname(this.oauth2TokenPath), { recursive: true });
            fs.writeFileSync(this.oauth2TokenPath, JSON.stringify({ authenticated: true, timestamp: Date.now() }));
          }
          console.log('[GrabTube] OAuth2 login successful');
          safeResolve({ success: true });
        } else {
          console.warn('[GrabTube] OAuth2 login failed:', stderr);
          safeResolve({ success: false, error: stderr || 'OAuth2 login failed' });
        }
      });

      proc.on('error', (err) => {
        safeResolve({ success: false, error: err.message });
      });

      // Timeout after 5 minutes (user needs to complete browser auth)
      setTimeout(() => {
        proc.kill();
        safeResolve({ success: false, error: 'OAuth2 login timed out. Please try again.' });
      }, 300000);
    });
  }

  /**
   * Remove OAuth2 token (logout).
   */
  removeOAuth2Token(): void {
    if (this.oauth2TokenPath && fs.existsSync(this.oauth2TokenPath)) {
      fs.unlinkSync(this.oauth2TokenPath);
    }
    // Also clear yt-dlp's OAuth2 cache
    const cacheDir = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'GrabTube')
      : path.join(os.homedir(), '.config', 'GrabTube');
    const ytdlpCache = path.join(cacheDir, 'youtube-oauth2');
    if (fs.existsSync(ytdlpCache)) {
      // Check it's actually a directory and not a symlink before recursive delete
      const stat = fs.lstatSync(ytdlpCache);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        fs.rmSync(ytdlpCache, { recursive: true, force: true });
      }
    }
    console.log('[GrabTube] OAuth2 token removed');
  }

  /**
   * Build platform-specific yt-dlp args for bypass.
   * Includes POT provider args for YouTube if the server is running.
   * Automatically uses cached browser cookies for YouTube if no explicit cookies are set.
   */
  private buildPlatformArgs(url: string, cookiesPath?: string, browserCookies?: string): string[] {
    const args: string[] = [];
    const platform = this.detectPlatformFromUrl(url);
    const config = PLATFORM_BYPASS_CONFIG[platform];

    // YouTube-specific: bundled Deno JS runtime + POT provider args
    if (platform === 'youtube') {
      // Deno is required by yt-dlp 2026+ for YouTube JS extraction
      const denoPath = this.binaryManager.getDenoPath();
      if (denoPath) {
        args.push('--js-runtimes', 'deno:' + denoPath);
      }

      // POT provider args (auto-generated tokens, no proxy needed)
      const potArgs = this.potProvider.getYtdlpArgs();
      if (potArgs.length > 0) {
        args.push(...potArgs);
      }
    }

    if (config?.impersonate) {
      args.push('--impersonate', config.impersonate);
    } else if (!config) {
      // Default anti-detection for unknown platforms (covers 1800+ yt-dlp extractors)
      // Browser impersonation helps avoid bot detection on sites not in our explicit config
      args.push('--impersonate', 'chrome');
    }

    if (config?.extraArgs) {
      args.push(...config.extraArgs);
    }

    // Cookie file (explicit)
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }

    // OAuth2 token for YouTube (takes priority over browser cookies)
    if (platform === 'youtube' && this.hasOAuth2Token() && !cookiesPath) {
      args.push('--username', 'oauth2');
      args.push('--password', '');
      if (this.oauth2TokenPath) {
        args.push('--cache-dir', path.dirname(this.oauth2TokenPath));
      }
    }

    // Browser cookies: explicit setting > auto-detected > none
    // Validate browser name against allowlist to prevent injection via --cookies-from-browser
    const ALLOWED_BROWSERS = new Set(['chrome', 'firefox', 'edge', 'brave', 'opera', 'vivaldi', 'chromium', 'safari']);
    const effectiveBrowser = browserCookies ||
      (platform === 'youtube' && !cookiesPath && !this.hasOAuth2Token() && this.autoBrowser ? this.autoBrowser : undefined);
    if (effectiveBrowser) {
      const browserName = effectiveBrowser.split(':')[0].toLowerCase();
      if (ALLOWED_BROWSERS.has(browserName)) {
        args.push('--cookies-from-browser', effectiveBrowser);
      } else {
        console.warn(`[GrabTube] Rejected invalid browser name: ${browserName}`);
      }
    }

    // Use bundled FFmpeg if available
    if (this.ffmpegPath !== 'ffmpeg') {
      args.push('--ffmpeg-location', this.ffmpegPath);
    }

    // Note: --plugin-dirs does NOT work with standalone yt-dlp binaries.
    // Plugins are installed to ~/.config/yt-dlp/plugins/ at startup instead.

    return args;
  }

  async getVideoInfo(url: string, proxy?: string, cookiesPath?: string, browserCookies?: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const safeResolve = (value: VideoInfo) => { if (!settled) { settled = true; resolve(value); } };
      const safeReject = (err: Error) => { if (!settled) { settled = true; reject(err); } };

      const args = [
        '--dump-json',
        '--no-download',
        '--no-warnings',
        '--no-playlist',
      ];

      // Platform-specific bypass args (includes auto-browser cookies for YouTube)
      args.push(...this.buildPlatformArgs(url, cookiesPath, browserCookies));

      if (proxy) {
        args.push('--proxy', proxy);
      }

      args.push('--geo-bypass');
      args.push(url);

      const proc = spawn(this.ytdlpPath, args, { env: this.getSpawnEnv() });
      let stdout = '';
      let stderr = '';
      const MAX_STDOUT = 50 * 1024 * 1024; // 50MB limit to prevent unbounded memory growth

      proc.stdout.on('data', (data) => {
        if (stdout.length < MAX_STDOUT) {
          stdout += data.toString();
        } else if (stdout.length < MAX_STDOUT + 100) {
          // Only warn once when we cross the threshold
          stdout += '\n[TRUNCATED]';
          console.warn('[GrabTube] stdout exceeded 50MB limit, truncating');
        }
      });
      const MAX_STDERR = 1 * 1024 * 1024; // 1MB limit for stderr
      proc.stderr.on('data', (data) => {
        if (stderr.length < MAX_STDERR) {
          stderr += data.toString();
        }
      });

      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const raw = JSON.parse(stdout);
            const info = this.parseVideoInfo(raw);
            safeResolve(info);
          } catch {
            safeReject(new Error('Failed to parse video info'));
          }
        } else {
          safeReject(new Error(stderr || 'Failed to fetch video information'));
        }
      });

      proc.on('error', (err) => safeReject(err));

      // Timeout after 60 seconds (increased for platforms needing impersonation)
      setTimeout(() => {
        proc.kill();
        safeReject(new Error('Timed out fetching video info'));
      }, 60000);
    });
  }

  /**
   * Proactively detect the best installed browser for YouTube cookie extraction.
   * Checks common cookie database paths for each browser on the current OS.
   * Sets autoBrowser so the FIRST YouTube attempt already uses cookies.
   * This runs once and caches the result.
   */
  private detectBestBrowser(): void {
    if (this.browserDetectionDone) return;
    this.browserDetectionDone = true;

    const home = os.homedir();
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    // Map of browser name → possible cookie DB paths
    // Ordered: Firefox first (unencrypted, no DPAPI), then others
    const browserPaths: Array<{ name: string; paths: string[] }> = [
      {
        name: 'firefox',
        paths: isWin
          ? [path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles')]
            : [path.join(home, '.mozilla', 'firefox')],
      },
      {
        name: 'edge',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Microsoft Edge')]
            : [path.join(home, '.config', 'microsoft-edge')],
      },
      {
        name: 'brave',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser')]
            : [path.join(home, '.config', 'BraveSoftware', 'Brave-Browser')],
      },
      {
        name: 'opera',
        paths: isWin
          ? [path.join(home, 'AppData', 'Roaming', 'Opera Software', 'Opera Stable')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'com.operasoftware.Opera')]
            : [path.join(home, '.config', 'opera')],
      },
      {
        name: 'vivaldi',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'Vivaldi', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Vivaldi')]
            : [path.join(home, '.config', 'vivaldi')],
      },
      {
        name: 'chromium',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'Chromium', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Chromium')]
            : [path.join(home, '.config', 'chromium')],
      },
      {
        name: 'chrome',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Google', 'Chrome')]
            : [path.join(home, '.config', 'google-chrome')],
      },
    ];

    for (const browser of browserPaths) {
      for (const p of browser.paths) {
        try {
          if (fs.existsSync(p)) {
            this.autoBrowser = browser.name;
            console.log(`[GrabTube] Proactively detected browser: ${browser.name} (${p})`);
            return;
          }
        } catch {
          // Permission error — skip this browser
        }
      }
    }

    console.log('[GrabTube] No installed browsers detected for cookie extraction.');
  }

  /**
   * Get list of installed browsers that could provide cookies.
   * Returns array of { name, installed } for each known browser.
   */
  getInstalledBrowsers(): Array<{ name: string; installed: boolean }> {
    const home = os.homedir();
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    const browserChecks: Array<{ name: string; paths: string[] }> = [
      {
        name: 'firefox',
        paths: isWin
          ? [path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles')]
            : [path.join(home, '.mozilla', 'firefox')],
      },
      {
        name: 'chrome',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Google', 'Chrome')]
            : [path.join(home, '.config', 'google-chrome')],
      },
      {
        name: 'edge',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Microsoft Edge')]
            : [path.join(home, '.config', 'microsoft-edge')],
      },
      {
        name: 'brave',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser')]
            : [path.join(home, '.config', 'BraveSoftware', 'Brave-Browser')],
      },
      {
        name: 'opera',
        paths: isWin
          ? [path.join(home, 'AppData', 'Roaming', 'Opera Software', 'Opera Stable')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'com.operasoftware.Opera')]
            : [path.join(home, '.config', 'opera')],
      },
      {
        name: 'vivaldi',
        paths: isWin
          ? [path.join(home, 'AppData', 'Local', 'Vivaldi', 'User Data')]
          : isMac
            ? [path.join(home, 'Library', 'Application Support', 'Vivaldi')]
            : [path.join(home, '.config', 'vivaldi')],
      },
    ];

    return browserChecks.map((browser) => ({
      name: browser.name,
      installed: browser.paths.some((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      }),
    }));
  }

  /**
   * Verify that browser cookies work for YouTube by doing a quick test fetch.
   * Returns { success, browser } if cookies work, or { success: false, error } if not.
   */
  async verifyBrowserCookies(browser?: string): Promise<{ success: boolean; browser?: string; error?: string }> {
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const browsers = browser ? [browser] : YtdlpManager.AUTO_BROWSERS;

    for (const b of browsers) {
      try {
        console.log(`[GrabTube] Verifying cookies for browser: ${b}...`);
        await this.getVideoInfo(testUrl, undefined, undefined, b);
        this.autoBrowser = b;
        console.log(`[GrabTube] Browser cookies verified: ${b}`);
        return { success: true, browser: b };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // If it's a video-level error (not auth), cookies are actually working
        if (msg.toLowerCase().includes('video unavailable') || msg.toLowerCase().includes('private')) {
          this.autoBrowser = b;
          return { success: true, browser: b };
        }
        console.log(`[GrabTube] Browser ${b} cookies failed: ${msg.substring(0, 80)}`);
        continue;
      }
    }

    return { success: false, error: 'No browser with valid YouTube cookies found. Please open YouTube in your browser and log in.' };
  }

  /**
   * Fetch video info with automatic retry and fallback strategies.
   * For YouTube: proactively uses browser cookies on the FIRST attempt.
   * If the first attempt fails, cycles through ALL browsers.
   * Caches the working browser for all future requests.
   */
  async getVideoInfoWithRetry(
    url: string,
    proxy?: string,
    cookiesPath?: string,
    browserCookies?: string
  ): Promise<VideoInfo> {
    const platform = this.detectPlatformFromUrl(url);
    const config = PLATFORM_BYPASS_CONFIG[platform];

    // Proactively detect best browser for YouTube so the FIRST attempt uses cookies
    if (platform === 'youtube' && !this.autoBrowser && !browserCookies && !cookiesPath) {
      this.detectBestBrowser();
    }

    // First attempt: with platform-specific bypass (includes auto-browser cookies for YouTube)
    try {
      return await this.getVideoInfo(url, proxy, cookiesPath, browserCookies);
    } catch (firstError: unknown) {
      const firstMsg = firstError instanceof Error ? firstError.message : String(firstError);

      // YouTube: cycle through ALL browsers on ANY failure
      // Only if no explicit cookies are configured (user hasn't set anything up)
      if (platform === 'youtube' && !browserCookies && !cookiesPath) {
        console.log(`[GrabTube] YouTube info fetch failed (${firstMsg.substring(0, 80)}). Cycling through all browsers...`);

        for (const browser of YtdlpManager.AUTO_BROWSERS) {
          // Skip the browser we already tried (autoBrowser was used in the first attempt)
          if (browser === this.autoBrowser) continue;

          try {
            console.log(`[GrabTube] Trying ${browser} cookies...`);
            const result = await this.getVideoInfo(url, proxy, undefined, browser);
            // Success! Cache this browser for all future YouTube requests
            this.autoBrowser = browser;
            console.log(`[GrabTube] Auto-detected working browser: ${browser}. Cached for future use.`);
            return result;
          } catch (browserError: unknown) {
            const browserMsg = browserError instanceof Error ? browserError.message : String(browserError);
            // Only throw immediately for truly unrelated errors (video removed, invalid URL)
            const isVideoError = browserMsg.toLowerCase().includes('video unavailable') ||
                                 browserMsg.toLowerCase().includes('private video') ||
                                 browserMsg.toLowerCase().includes('removed') ||
                                 browserMsg.toLowerCase().includes('not exist') ||
                                 browserMsg.toLowerCase().includes('invalid url');
            if (isVideoError) {
              throw browserError;
            }
            console.log(`[GrabTube] ${browser} cookies failed (${browserMsg.substring(0, 80)}), trying next browser...`);
            continue;
          }
        }

        // All browsers failed — try without proxy as last resort
        if (proxy) {
          try {
            console.log('[GrabTube] All browsers failed. Trying without proxy...');
            return await this.getVideoInfo(url, undefined, cookiesPath, browserCookies);
          } catch {
            // Fall through to final error
          }
        }

        // Nothing worked — throw a clean user-friendly error
        throw new Error(
          'YouTube is blocking this request. Please open YouTube in your browser (Chrome/Edge/Firefox), ' +
          'make sure you are logged in, then try again. GrabTube will automatically use your browser cookies.'
        );
      }

      // Non-YouTube: if platform needs cookies and none provided, throw helpful error
      if (config?.requiresCookies && !cookiesPath && !browserCookies) {
        throw new Error(
          `${platform.charAt(0).toUpperCase() + platform.slice(1)} requires authentication. ` +
          (config.cookiesHint || 'Please provide cookies in Settings.')
        );
      }

      // Retry without proxy if we had one
      if (proxy) {
        try {
          return await this.getVideoInfo(url, undefined, cookiesPath, browserCookies);
        } catch {
          // Fall through to error
        }
      }

      const hint = config?.cookiesHint ? ` Tip: ${config.cookiesHint}` : '';
      throw new Error(firstMsg + hint);
    }
  }

  private parseVideoInfo(raw: Record<string, unknown>): VideoInfo {
    const formats = (raw.formats as Array<Record<string, unknown>> || [])
      .filter((f) => f.url)
      .map((f) => ({
        formatId: String(f.format_id || ''),
        ext: String(f.ext || ''),
        resolution: f.height ? `${f.width || '?'}x${f.height}` : (String(f.resolution || 'audio only')),
        filesize: (f.filesize as number | null) || (f.filesize_approx as number | null) || null,
        vcodec: String(f.vcodec || 'none'),
        acodec: String(f.acodec || 'none'),
        fps: (f.fps as number | null) || null,
        tbr: (f.tbr as number | null) || null,
        quality: f.height ? `${f.height}p` : 'audio',
        hasVideo: f.vcodec !== 'none' && f.vcodec !== undefined,
        hasAudio: f.acodec !== 'none' && f.acodec !== undefined,
        note: String(f.format_note || ''),
      }));

    const duration = (raw.duration as number) || 0;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    const durationString = hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;

    // Determine platform
    const extractor = String(raw.extractor || raw.extractor_key || 'unknown');
    const platform = this.detectPlatform(extractor, String(raw.webpage_url || ''));

    return {
      id: String(raw.id || ''),
      title: String(raw.title || 'Unknown'),
      description: String(raw.description || ''),
      thumbnail: this.extractBestThumbnail(raw),
      duration,
      durationString,
      uploader: String(raw.uploader || raw.channel || 'Unknown'),
      uploaderUrl: String(raw.uploader_url || raw.channel_url || ''),
      viewCount: (raw.view_count as number) || 0,
      likeCount: (raw.like_count as number) || 0,
      uploadDate: String(raw.upload_date || ''),
      webpage_url: String(raw.webpage_url || ''),
      extractor,
      platform,
      formats,
      subtitles: (raw.subtitles as Record<string, Array<{ ext: string; url: string }>>) || {},
      requestedSubtitles: (raw.requested_subtitles as Record<string, unknown>) || null,
    };
  }

  /**
   * Extract the best thumbnail URL from yt-dlp JSON output.
   * yt-dlp usually sets `thumbnail` to the best URL, but some extractors
   * (Instagram, TikTok, etc.) may only populate the `thumbnails` array.
   * This method checks both fields and picks the highest-quality option.
   */
  private extractBestThumbnail(raw: Record<string, unknown>): string {
    // 1. Try the top-level `thumbnail` field first (yt-dlp sets this for most extractors)
    const directThumbnail = raw.thumbnail ? String(raw.thumbnail) : '';
    if (directThumbnail && directThumbnail.startsWith('http')) {
      return directThumbnail;
    }

    // 2. Try extracting from `thumbnails` array (common for Instagram, TikTok, etc.)
    const thumbnails = raw.thumbnails as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(thumbnails) && thumbnails.length > 0) {
      // Sort by preference: highest resolution first, then by preference field
      const sorted = [...thumbnails]
        .filter(t => t.url && String(t.url).startsWith('http'))
        .sort((a, b) => {
          // Prefer higher resolution
          const aRes = ((a.width as number) || 0) * ((a.height as number) || 0);
          const bRes = ((b.width as number) || 0) * ((b.height as number) || 0);
          if (bRes !== aRes) return bRes - aRes;
          // Prefer higher preference value
          return ((b.preference as number) || 0) - ((a.preference as number) || 0);
        });
      if (sorted.length > 0) {
        return String(sorted[0].url);
      }
    }

    // 3. Fallback to direct thumbnail even if it doesn't start with http
    return directThumbnail;
  }

  /**
   * Download a thumbnail image and convert it to a base64 data URL.
   * This is needed because non-YouTube thumbnail CDN URLs (Instagram, TikTok, etc.)
   * often require authentication cookies that the Electron renderer doesn't have.
   * By proxying through Node.js, we can download the image and embed it as a data URL.
   */
  async proxyThumbnail(thumbnailUrl: string): Promise<string> {
    if (!thumbnailUrl || !thumbnailUrl.startsWith('http')) {
      return thumbnailUrl;
    }

    // YouTube thumbnails are publicly accessible — no need to proxy
    if (thumbnailUrl.includes('ytimg.com') || thumbnailUrl.includes('youtube.com') || thumbnailUrl.includes('ggpht.com')) {
      return thumbnailUrl;
    }

    try {
      const { net } = await import('electron');
      const response = await net.fetch(thumbnailUrl, {
        method: 'GET',
        // 5 second timeout for thumbnail fetch — don't block the UI
      });

      if (!response.ok) {
        console.log(`[GrabTube] Thumbnail proxy failed (${response.status}), using original URL`);
        return thumbnailUrl;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      // Only convert if the response looks like an image and is under 5MB
      if (buffer.length > 0 && buffer.length < 5 * 1024 * 1024) {
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      }

      return thumbnailUrl;
    } catch (err) {
      console.log(`[GrabTube] Thumbnail proxy error: ${err instanceof Error ? err.message : String(err)}`);
      return thumbnailUrl;
    }
  }

  private detectPlatform(extractor: string, url: string): string {
    const ext = extractor.toLowerCase();
    if (ext.includes('youtube')) return 'youtube';
    if (ext.includes('tiktok')) return 'tiktok';
    if (ext.includes('instagram')) return 'instagram';
    if (ext.includes('twitter') || ext.includes('x')) return 'twitter';
    if (ext.includes('facebook') || ext.includes('fb')) return 'facebook';
    if (ext.includes('reddit')) return 'reddit';
    if (ext.includes('vimeo')) return 'vimeo';
    if (ext.includes('twitch')) return 'twitch';
    if (ext.includes('dailymotion')) return 'dailymotion';
    if (ext.includes('soundcloud')) return 'soundcloud';
    if (ext.includes('bilibili')) return 'bilibili';
    if (ext.includes('pinterest')) return 'pinterest';
    if (ext.includes('linkedin')) return 'linkedin';
    if (ext.includes('rumble')) return 'rumble';

    // URL-based fallback
    return this.detectPlatformFromUrl(url);
  }

  startDownload(
    url: string,
    outputPath: string,
    filename: string,
    formatId: string,
    audioOnly: boolean,
    audioFormat: string | undefined,
    embedSubs: boolean,
    embedThumbnail: boolean,
    proxy: string | undefined,
    onProgress: (progress: DownloadProgress) => void,
    downloadId: string,
    cookiesPath?: string,
    browserCookies?: string
  ): ChildProcess {
    const args: string[] = [];

    // Output template
    const outputTemplate = path.join(outputPath, filename || '%(title)s.%(ext)s');
    args.push('-o', outputTemplate);

    // Platform-specific bypass args (includes auto-browser cookies for YouTube)
    args.push(...this.buildPlatformArgs(url, cookiesPath, browserCookies));

    // Platform-specific format handling
    const platform = this.detectPlatformFromUrl(url);
    const config = PLATFORM_BYPASS_CONFIG[platform];

    // Format selection
    if (audioOnly) {
      args.push('-x');
      if (audioFormat) {
        args.push('--audio-format', audioFormat);
      }
      args.push('--audio-quality', '0');
    } else if (config?.formatOverride && (!formatId || formatId === 'best')) {
      // Use platform-specific format override (e.g. 'b' for TikTok watermark-free)
      args.push('-f', config.formatOverride);
    } else if (formatId && formatId !== 'best') {
      args.push('-f', formatId);
    } else {
      args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
    }

    // Embed options
    if (embedSubs) {
      args.push('--write-subs', '--embed-subs');
    }
    if (embedThumbnail) {
      args.push('--embed-thumbnail');
    }

    // Proxy
    if (proxy) {
      args.push('--proxy', proxy);
    }

    // General options
    args.push('--geo-bypass');
    args.push('--no-playlist');
    args.push('--newline');
    args.push('--progress');
    args.push('--no-warnings');

    // Only set merge output format for platforms that need it (not TikTok single-stream)
    if (platform !== 'tiktok') {
      args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    // Log download start without sensitive args (cookies, proxy credentials)
    console.log(`[GrabTube] Starting download: ${url}`);
    const safeArgs = args.filter((_arg, i, arr) => {
      // Redact values after sensitive flags
      const prev = i > 0 ? arr[i - 1] : '';
      if (prev === '--cookies' || prev === '--cookies-from-browser' || prev === '--proxy') return false;
      return true;
    });
    console.log(`[GrabTube] Download args: ${safeArgs.join(' ')}`);

    const proc = spawn(this.ytdlpPath, args, { env: this.getSpawnEnv() });
    let stderrBuffer = '';
    const MAX_STDERR_BUF = 512 * 1024; // 512KB cap for stderr buffer
    let stdoutRemainder = '';
    let stderrRemainder = '';

    proc.stdout.on('data', (data) => {
      // Split data on newlines — a single data event can contain multiple lines
      const text = stdoutRemainder + data.toString();
      const lines = text.split(/\r?\n/);
      // Last element may be incomplete (no trailing newline yet) — save for next event
      stdoutRemainder = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const progress = this.parseProgress(trimmed, downloadId);
        if (progress) {
          onProgress(progress);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      // Split stderr on newlines — ffmpeg output, yt-dlp errors, and sometimes
      // info messages come through stderr.
      const text = stderrRemainder + data.toString();
      const lines = text.split(/\r?\n/);
      stderrRemainder = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (stderrBuffer.length < MAX_STDERR_BUF) {
          stderrBuffer += trimmed + '\n';
        }
        console.log(`[GrabTube] stderr: ${trimmed}`);

        // First, try to parse as progress/filename info (handles [Merger], [ExtractAudio], [download] Destination)
        const progress = this.parseProgress(trimmed, downloadId);
        if (progress) {
          onProgress(progress);
          continue;
        }

        // Skip informational lines that are NOT actual errors:
        // - WARNING messages (suppressed by --no-warnings but just in case)
        // - yt-dlp info messages: [youtube], [info], [download], [generic], etc.
        // - ffmpeg output: ffmpeg version, Input #0, Stream #0, Duration, etc.
        // - Deleting original file messages
        // Only treat lines starting with ERROR: as actual errors
        if (trimmed.startsWith('ERROR:') || trimmed.startsWith('error:')) {
          onProgress({
            downloadId,
            status: 'error',
            percent: 0,
            speed: '',
            eta: '',
            filesize: '',
            filename: '',
            error: trimmed,
          });
        }
        // All other stderr lines are informational — just log them
      }
    });

    // CRITICAL: Flush remainder buffers when streams end.
    // If yt-dlp's last output line doesn't end with \n, it stays in the remainder
    // and is never processed. This commonly happens with [Merger] lines — the final
    // filename is lost, causing history to save a wrong (temp file) path.
    proc.stdout.on('end', () => {
      if (stdoutRemainder.trim()) {
        const progress = this.parseProgress(stdoutRemainder.trim(), downloadId);
        if (progress) onProgress(progress);
        stdoutRemainder = '';
      }
    });

    proc.stderr.on('end', () => {
      if (stderrRemainder.trim()) {
        const trimmed = stderrRemainder.trim();
        const progress = this.parseProgress(trimmed, downloadId);
        if (progress) onProgress(progress);
        stderrRemainder = '';
      }
    });

    return proc;
  }

  private parseProgress(line: string, downloadId: string): DownloadProgress | null {
    // Match yt-dlp progress format: [download]  45.2% of  150.00MiB at  2.50MiB/s ETA 00:35
    const downloadMatch = line.match(
      /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\s*\w+)\s+at\s+([\d.]+\s*\w+\/s)\s+ETA\s+(\S+)/
    );

    if (downloadMatch) {
      return {
        downloadId,
        status: 'downloading',
        percent: parseFloat(downloadMatch[1]),
        filesize: downloadMatch[2],
        speed: downloadMatch[3],
        eta: downloadMatch[4],
        filename: '',
      };
    }

    // Match completion: [download] 100% of 150.00MiB
    const completeMatch = line.match(/\[download\]\s+100%\s+of\s+([\d.]+\s*\w+)/);
    if (completeMatch) {
      return {
        downloadId,
        status: 'downloading',
        percent: 100,
        filesize: completeMatch[1],
        speed: '',
        eta: '0:00',
        filename: '',
      };
    }

    // Match merge output: [Merger] Merging formats into "/path/to/final.mp4"
    const mergerMatch = line.match(/\[Merger\]\s+Merging formats into\s+"(.+)"/);
    if (mergerMatch) {
      return {
        downloadId,
        status: 'processing',
        percent: 100,
        speed: '',
        eta: '',
        filesize: '',
        filename: mergerMatch[1],
      };
    }

    // Match ExtractAudio destination: [ExtractAudio] Destination: /path/to/file.mp3
    const extractAudioMatch = line.match(/\[ExtractAudio\]\s+Destination:\s+(.+)/);
    if (extractAudioMatch) {
      return {
        downloadId,
        status: 'processing',
        percent: 100,
        speed: '',
        eta: '',
        filesize: '',
        filename: extractAudioMatch[1],
      };
    }

    // Match other processing steps (ffmpeg post-processing, etc.)
    if (line.includes('[Merger]') || line.includes('[ExtractAudio]') || line.includes('[ffmpeg]')) {
      return {
        downloadId,
        status: 'processing',
        percent: 100,
        speed: '',
        eta: '',
        filesize: '',
        filename: '',
      };
    }

    // Match destination filename
    const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/);
    if (destMatch) {
      return {
        downloadId,
        status: 'downloading',
        percent: 0,
        speed: '',
        eta: '',
        filesize: '',
        filename: destMatch[1],
      };
    }

    return null;
  }
}
