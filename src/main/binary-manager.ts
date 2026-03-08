import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Manages bundled binary paths for yt-dlp, FFmpeg, and POT provider.
 * Handles both development (resources/bin/) and production (app.asar.unpacked/) paths.
 */
export class BinaryManager {
  private resourcesPath: string;
  private platformDir: string;

  constructor() {
    // In production, Electron sets process.resourcesPath to the app's resources dir.
    // In dev, we fall back to the project's resources/ folder.
    this.resourcesPath = process.resourcesPath || path.join(__dirname, '../../resources');
    this.platformDir = this.getPlatformDir();
  }

  private getPlatformDir(): string {
    switch (process.platform) {
      case 'win32': return 'win';
      case 'darwin': return 'mac';
      default: return 'linux';
    }
  }

  /**
   * Get the path to the yt-dlp binary.
   * Checks bundled path first, then falls back to system PATH.
   */
  getYtdlpPath(): string {
    const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

    // Check bundled binary (production: extraResources copies to resources/bin/)
    const bundledPath = path.join(this.resourcesPath, 'bin', binName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }

    // Check platform-specific bundled path (dev: resources/bin/{platform}/)
    const devBundledPath = path.join(this.resourcesPath, 'bin', this.platformDir, binName);
    if (fs.existsSync(devBundledPath)) {
      return devBundledPath;
    }

    // Fallback to system PATH
    return 'yt-dlp';
  }

  /**
   * Get the path to the FFmpeg binary.
   * Checks bundled path first, then falls back to system PATH.
   */
  getFfmpegPath(): string {
    const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

    const bundledPath = path.join(this.resourcesPath, 'bin', binName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }

    const devBundledPath = path.join(this.resourcesPath, 'bin', this.platformDir, binName);
    if (fs.existsSync(devBundledPath)) {
      return devBundledPath;
    }

    return 'ffmpeg';
  }

  /**
   * Get the path to the POT provider binary (bgutil-pot).
   * The Rust binary is a single executable with no dependencies.
   */
  getPotProviderPath(): string {
    const binName = process.platform === 'win32' ? 'bgutil-pot.exe' : 'bgutil-pot';

    const bundledPath = path.join(this.resourcesPath, 'bin', binName);
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }

    const devBundledPath = path.join(this.resourcesPath, 'bin', this.platformDir, binName);
    if (fs.existsSync(devBundledPath)) {
      return devBundledPath;
    }

    return '';
  }

  /**
   * Get the directory where yt-dlp plugins should be stored.
   * The POT provider plugin (Python files) goes here.
   */
  getPluginDir(): string {
    // In production, plugins are bundled alongside the binary
    const bundledPluginDir = path.join(this.resourcesPath, 'bin', 'plugins');
    if (fs.existsSync(bundledPluginDir)) {
      return bundledPluginDir;
    }

    const devPluginDir = path.join(this.resourcesPath, 'bin', this.platformDir, 'plugins');
    if (fs.existsSync(devPluginDir)) {
      return devPluginDir;
    }

    // Fallback: use user's yt-dlp plugin directory
    const homeDir = os.homedir();
    const userPluginDir = path.join(homeDir, '.config', 'yt-dlp', 'plugins');
    return userPluginDir;
  }

  /**
   * Check which binaries are available and return a status report.
   */
  getStatus(): {
    ytdlp: { path: string; bundled: boolean; available: boolean };
    ffmpeg: { path: string; bundled: boolean; available: boolean };
    potProvider: { path: string; bundled: boolean; available: boolean };
    pluginDir: { path: string; exists: boolean };
  } {
    const ytdlpPath = this.getYtdlpPath();
    const ffmpegPath = this.getFfmpegPath();
    const potPath = this.getPotProviderPath();
    const pluginDir = this.getPluginDir();

    return {
      ytdlp: {
        path: ytdlpPath,
        bundled: ytdlpPath !== 'yt-dlp',
        available: ytdlpPath === 'yt-dlp' || fs.existsSync(ytdlpPath),
      },
      ffmpeg: {
        path: ffmpegPath,
        bundled: ffmpegPath !== 'ffmpeg',
        available: ffmpegPath === 'ffmpeg' || fs.existsSync(ffmpegPath),
      },
      potProvider: {
        path: potPath,
        bundled: potPath !== '',
        available: potPath !== '' && fs.existsSync(potPath),
      },
      pluginDir: {
        path: pluginDir,
        exists: fs.existsSync(pluginDir),
      },
    };
  }
}
