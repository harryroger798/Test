import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

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

export class YtdlpManager {
  private ytdlpPath: string;

  constructor() {
    this.ytdlpPath = this.findYtdlp();
  }

  private findYtdlp(): string {
    // Check bundled binary first
    const resourcesPath = process.resourcesPath || path.join(__dirname, '../../resources');
    const platform = process.platform;
    const binName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

    const bundledPath = path.join(resourcesPath, 'bin', binName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }

    // Fallback to system yt-dlp
    return 'yt-dlp';
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

  async getVideoInfo(url: string, proxy?: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-download',
        '--no-warnings',
        '--no-playlist',
      ];

      if (proxy) {
        args.push('--proxy', proxy);
      }

      // Add geo-bypass
      args.push('--geo-bypass');

      args.push(url);

      const proc = spawn(this.ytdlpPath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const raw = JSON.parse(stdout);
            const info = this.parseVideoInfo(raw);
            resolve(info);
          } catch (e) {
            reject(new Error('Failed to parse video info'));
          }
        } else {
          reject(new Error(stderr || 'Failed to fetch video information'));
        }
      });

      proc.on('error', (err) => reject(err));

      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill();
        reject(new Error('Timed out fetching video info'));
      }, 30000);
    });
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
      thumbnail: String(raw.thumbnail || ''),
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
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    if (url.includes('reddit.com')) return 'reddit';
    if (url.includes('vimeo.com')) return 'vimeo';

    return extractor || 'unknown';
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
    downloadId: string
  ): ChildProcess {
    const args: string[] = [];

    // Output template
    const outputTemplate = path.join(outputPath, filename || '%(title)s.%(ext)s');
    args.push('-o', outputTemplate);

    // Format selection
    if (audioOnly) {
      args.push('-x');
      if (audioFormat) {
        args.push('--audio-format', audioFormat);
      }
      args.push('--audio-quality', '0');
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
    args.push('--merge-output-format', 'mp4');

    args.push(url);

    const proc = spawn(this.ytdlpPath, args);

    proc.stdout.on('data', (data) => {
      const line = data.toString().trim();
      const progress = this.parseProgress(line, downloadId);
      if (progress) {
        onProgress(progress);
      }
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line && !line.startsWith('WARNING')) {
        onProgress({
          downloadId,
          status: 'error',
          percent: 0,
          speed: '',
          eta: '',
          filesize: '',
          filename: '',
          error: line,
        });
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

    // Match merge/processing
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
