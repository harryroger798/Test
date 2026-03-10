/**
 * GrabTube Converter Manager
 *
 * Handles file conversion using FFmpeg (video/audio), Sharp (images),
 * and pure JS (subtitles). Reports progress via callbacks.
 */
import * as path from 'path';
import * as fs from 'fs';

// Sharp is dynamically imported at runtime (optional dependency for image conversion)
// It's not listed in package.json to keep the bundle small — falls back to FFmpeg if unavailable
import { spawn, ChildProcess } from 'child_process';
import { BinaryManager } from './binary-manager';

export interface ConversionOptions {
  inputPath: string;
  outputFormat: string;
  outputDir?: string;
  options?: Record<string, string>;
}

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

type ProgressCallback = (progress: number) => void;

export class ConverterManager {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private ffmpegPath: string = 'ffmpeg';

  constructor(binaryManager?: BinaryManager) {
    if (binaryManager) {
      // Use the same path resolution as yt-dlp (checks bundled + platform-specific + system PATH)
      this.ffmpegPath = binaryManager.getFfmpegPath();
    } else {
      // Fallback: try to find bundled ffmpeg
      const possiblePaths = [
        path.join(process.resourcesPath || '', 'bin', 'ffmpeg'),
        path.join(process.resourcesPath || '', 'bin', 'ffmpeg.exe'),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          this.ffmpegPath = p;
          break;
        }
      }
    }

    // If still fallback to 'ffmpeg', try common installation paths on Windows
    if (this.ffmpegPath === 'ffmpeg' && process.platform === 'win32') {
      const winPaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-*', 'bin', 'ffmpeg.exe'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'ffmpeg', 'bin', 'ffmpeg.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'ffmpeg', 'bin', 'ffmpeg.exe'),
        path.join(process.env.USERPROFILE || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
      ];
      for (const p of winPaths) {
        // Skip glob patterns
        if (p.includes('*')) continue;
        if (fs.existsSync(p)) {
          this.ffmpegPath = p;
          break;
        }
      }
    }

    console.log(`[GrabTube] Converter FFmpeg path: ${this.ffmpegPath}`);
  }

  /**
   * Convert a file to the target format.
   * Returns a conversionId for tracking.
   */
  async convert(
    conversionId: string,
    options: ConversionOptions,
    onProgress: ProgressCallback
  ): Promise<ConversionResult> {
    const { inputPath, outputFormat, outputDir, options: customOpts } = options;

    if (!fs.existsSync(inputPath)) {
      return { success: false, error: 'Input file not found' };
    }

    const inputExt = path.extname(inputPath).slice(1).toLowerCase();
    const category = this.getCategory(inputExt);
    const targetCategory = this.getCategory(outputFormat);

    // Determine output path
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outDir = outputDir || path.dirname(inputPath);
    let outputPath = path.join(outDir, `${baseName}_converted.${outputFormat}`);

    // Avoid overwriting
    let counter = 1;
    while (fs.existsSync(outputPath)) {
      outputPath = path.join(outDir, `${baseName}_converted_${counter}.${outputFormat}`);
      counter++;
    }

    try {
      if (category === 'subtitle' && targetCategory === 'subtitle') {
        return await this.convertSubtitle(inputPath, outputPath, inputExt, outputFormat, onProgress);
      } else if (category === 'image' || targetCategory === 'image') {
        return await this.convertImage(inputPath, outputPath, customOpts || {}, onProgress);
      } else {
        return await this.convertWithFFmpeg(conversionId, inputPath, outputPath, outputFormat, customOpts || {}, onProgress);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Conversion failed';
      return { success: false, error: message };
    }
  }

  /**
   * Cancel an active conversion.
   */
  cancel(conversionId: string): void {
    const proc = this.activeProcesses.get(conversionId);
    if (proc) {
      proc.kill('SIGTERM');
      this.activeProcesses.delete(conversionId);
    }
  }

  /**
   * Cancel all active conversions.
   */
  cancelAll(): void {
    for (const [id, proc] of this.activeProcesses) {
      proc.kill('SIGTERM');
      this.activeProcesses.delete(id);
    }
  }

  // === FFmpeg Conversion (video/audio) ===

  private convertWithFFmpeg(
    conversionId: string,
    inputPath: string,
    outputPath: string,
    outputFormat: string,
    options: Record<string, string>,
    onProgress: ProgressCallback
  ): Promise<ConversionResult> {
    return new Promise((resolve) => {
      // First, get duration for progress calculation
      const probeArgs = ['-i', inputPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'];
      const probePath = this.ffmpegPath.replace('ffmpeg', 'ffprobe').replace('ffmpeg.exe', 'ffprobe.exe');

      let totalDuration = 0;

      // Try to get duration via ffprobe
      try {
        const probe = spawn(probePath, probeArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
        let probeOutput = '';
        probe.stdout?.on('data', (data: Buffer) => { probeOutput += data.toString(); });
        probe.on('close', () => {
          totalDuration = parseFloat(probeOutput.trim()) || 0;
          this.runFFmpeg(conversionId, inputPath, outputPath, outputFormat, options, totalDuration, onProgress, resolve);
        });
        probe.on('error', () => {
          // ffprobe not available, run ffmpeg without duration
          this.runFFmpeg(conversionId, inputPath, outputPath, outputFormat, options, 0, onProgress, resolve);
        });
      } catch {
        this.runFFmpeg(conversionId, inputPath, outputPath, outputFormat, options, 0, onProgress, resolve);
      }
    });
  }

  private runFFmpeg(
    conversionId: string,
    inputPath: string,
    outputPath: string,
    outputFormat: string,
    options: Record<string, string>,
    totalDuration: number,
    onProgress: ProgressCallback,
    resolve: (result: ConversionResult) => void
  ): void {
    const args: string[] = ['-i', inputPath, '-y', '-progress', 'pipe:1'];

    // Apply options
    if (options.videoBitrate) {
      args.push('-b:v', options.videoBitrate);
    }
    if (options.audioBitrate) {
      args.push('-b:a', options.audioBitrate);
    }
    if (options.maxHeight) {
      const h = parseInt(options.maxHeight);
      if (h > 0) {
        args.push('-vf', `scale=-2:${h}`);
      }
    }
    if (options.fps) {
      args.push('-r', options.fps);
    }
    if (options.maxDuration) {
      args.push('-t', options.maxDuration);
    }

    // Format-specific settings
    if (outputFormat === 'gif') {
      const fps = options.fps || '15';
      const height = options.maxHeight || '480';
      args.length = 0; // Reset args
      args.push('-i', inputPath, '-y');
      args.push('-vf', `fps=${fps},scale=-1:${height}:flags=lanczos`);
      args.push('-progress', 'pipe:1');
    } else if (outputFormat === 'mp4') {
      args.push('-c:v', 'libx264', '-c:a', 'aac');
    } else if (outputFormat === 'webm') {
      args.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus');
    } else if (outputFormat === 'mkv') {
      args.push('-c:v', 'libx264', '-c:a', 'aac');
    } else if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'opus'].includes(outputFormat)) {
      args.push('-vn'); // No video for audio-only
      if (outputFormat === 'mp3') args.push('-c:a', 'libmp3lame');
      else if (outputFormat === 'flac') args.push('-c:a', 'flac');
      else if (outputFormat === 'ogg') args.push('-c:a', 'libvorbis');
      else if (outputFormat === 'opus') args.push('-c:a', 'libopus');
      else if (outputFormat === 'aac' || outputFormat === 'm4a') args.push('-c:a', 'aac');
    }

    args.push(outputPath);

    const ffmpeg = spawn(this.ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.activeProcesses.set(conversionId, ffmpeg);

    let stderrData = '';

    ffmpeg.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      // Parse progress from ffmpeg pipe output
      const timeMatch = output.match(/out_time_us=(\d+)/);
      if (timeMatch && totalDuration > 0) {
        const currentUs = parseInt(timeMatch[1]);
        const currentSec = currentUs / 1000000;
        const progress = Math.min(99, (currentSec / totalDuration) * 100);
        onProgress(Math.round(progress));
      }
    });

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      stderrData += data.toString();
      // Also try to parse duration from stderr if we don't have it
      if (totalDuration === 0) {
        const durMatch = stderrData.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
        if (durMatch) {
          totalDuration = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3]);
        }
      }
    });

    ffmpeg.on('close', (code) => {
      this.activeProcesses.delete(conversionId);
      if (code === 0 && fs.existsSync(outputPath)) {
        onProgress(100);
        resolve({ success: true, outputPath });
      } else {
        // Extract error message from stderr
        const errorLines = stderrData.split('\n').filter((l) => l.includes('Error') || l.includes('error'));
        const errorMsg = errorLines.length > 0 ? errorLines[0].trim() : `FFmpeg exited with code ${code}`;
        resolve({ success: false, error: errorMsg });
      }
    });

    ffmpeg.on('error', (err) => {
      this.activeProcesses.delete(conversionId);
      resolve({ success: false, error: `FFmpeg not found: ${err.message}. Please install FFmpeg.` });
    });
  }

  // === Image Conversion (Sharp) ===

  private async convertImage(
    inputPath: string,
    outputPath: string,
    _options: Record<string, string>,
    onProgress: ProgressCallback
  ): Promise<ConversionResult> {
    onProgress(10);

    try {
      // Dynamic import of sharp (may not be available)
      // @ts-ignore — sharp is an optional runtime dependency
      const sharp = await import('sharp').catch(() => null);
      if (!sharp) {
        // Fallback: use FFmpeg for image conversion
        return this.convertImageWithFFmpeg(inputPath, outputPath, onProgress);
      }

      onProgress(30);

      const outputExt = path.extname(outputPath).slice(1).toLowerCase();
      let pipeline = sharp.default(inputPath);

      switch (outputExt) {
        case 'png':
          pipeline = pipeline.png();
          break;
        case 'jpg':
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: 90 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: 85 });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality: 80 });
          break;
        case 'gif':
          pipeline = pipeline.gif();
          break;
        case 'tiff':
        case 'tif':
          pipeline = pipeline.tiff();
          break;
        default:
          pipeline = pipeline.toFormat(outputExt as string);
      }

      onProgress(60);
      await pipeline.toFile(outputPath);
      onProgress(100);

      return { success: true, outputPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image conversion failed';
      return { success: false, error: message };
    }
  }

  private convertImageWithFFmpeg(
    inputPath: string,
    outputPath: string,
    onProgress: ProgressCallback
  ): Promise<ConversionResult> {
    return new Promise((resolve) => {
      onProgress(20);
      const ffmpeg = spawn(this.ffmpegPath, ['-i', inputPath, '-y', outputPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          onProgress(100);
          resolve({ success: true, outputPath });
        } else {
          resolve({ success: false, error: 'Image conversion failed via FFmpeg' });
        }
      });

      ffmpeg.on('error', () => {
        resolve({ success: false, error: 'FFmpeg not available for image conversion' });
      });
    });
  }

  // === Subtitle Conversion (Pure JS) ===

  private async convertSubtitle(
    inputPath: string,
    outputPath: string,
    fromFormat: string,
    toFormat: string,
    onProgress: ProgressCallback
  ): Promise<ConversionResult> {
    onProgress(10);

    try {
      const content = fs.readFileSync(inputPath, 'utf-8');
      onProgress(30);

      // Parse input to intermediate format
      const cues = this.parseSubtitle(content, fromFormat);
      onProgress(60);

      // Convert to output format
      const output = this.serializeSubtitle(cues, toFormat);
      onProgress(80);

      fs.writeFileSync(outputPath, output, 'utf-8');
      onProgress(100);

      return { success: true, outputPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Subtitle conversion failed';
      return { success: false, error: message };
    }
  }

  private parseSubtitle(content: string, format: string): Array<{ start: number; end: number; text: string }> {
    switch (format) {
      case 'srt': return this.parseSRT(content);
      case 'vtt': return this.parseVTT(content);
      case 'ass':
      case 'ssa': return this.parseASS(content);
      case 'sbv': return this.parseSBV(content);
      case 'sub': return this.parseSUB(content);
      default: return this.parseSRT(content);
    }
  }

  private serializeSubtitle(cues: Array<{ start: number; end: number; text: string }>, format: string): string {
    switch (format) {
      case 'srt': return this.serializeSRT(cues);
      case 'vtt': return this.serializeVTT(cues);
      case 'ass':
      case 'ssa': return this.serializeASS(cues);
      case 'sbv': return this.serializeSBV(cues);
      case 'sub': return this.serializeSUB(cues);
      default: return this.serializeSRT(cues);
    }
  }

  // SRT Parser
  private parseSRT(content: string): Array<{ start: number; end: number; text: string }> {
    const cues: Array<{ start: number; end: number; text: string }> = [];
    const blocks = content.trim().split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      const timeMatch = lines[1]?.match(/(\d{2}:\d{2}:\d{2}[,.]?\d{0,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]?\d{0,3})/);
      if (!timeMatch) continue;
      cues.push({
        start: this.parseTimestamp(timeMatch[1]),
        end: this.parseTimestamp(timeMatch[2]),
        text: lines.slice(2).join('\n'),
      });
    }
    return cues;
  }

  // VTT Parser
  private parseVTT(content: string): Array<{ start: number; end: number; text: string }> {
    const stripped = content.replace(/^WEBVTT.*\n\n?/, '');
    return this.parseSRT(stripped);
  }

  // ASS/SSA Parser
  private parseASS(content: string): Array<{ start: number; end: number; text: string }> {
    const cues: Array<{ start: number; end: number; text: string }> = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^Dialogue:\s*\d+,(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2}),([^,]*),([^,]*),\d+,\d+,\d+,([^,]*),(.*)/);
      if (match) {
        cues.push({
          start: this.parseASSTimestamp(match[1]),
          end: this.parseASSTimestamp(match[2]),
          text: match[6].replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n'),
        });
      }
    }
    return cues;
  }

  // SBV Parser
  private parseSBV(content: string): Array<{ start: number; end: number; text: string }> {
    const cues: Array<{ start: number; end: number; text: string }> = [];
    const blocks = content.trim().split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      const timeMatch = lines[0]?.match(/(\d+:\d{2}:\d{2}\.\d{3}),(\d+:\d{2}:\d{2}\.\d{3})/);
      if (!timeMatch) continue;
      cues.push({
        start: this.parseTimestamp(timeMatch[1]),
        end: this.parseTimestamp(timeMatch[2]),
        text: lines.slice(1).join('\n'),
      });
    }
    return cues;
  }

  // SUB (MicroDVD) Parser
  private parseSUB(content: string): Array<{ start: number; end: number; text: string }> {
    const cues: Array<{ start: number; end: number; text: string }> = [];
    const fps = 25; // Default FPS
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\{(\d+)\}\{(\d+)\}(.*)/);
      if (match) {
        cues.push({
          start: parseInt(match[1]) / fps,
          end: parseInt(match[2]) / fps,
          text: match[3].replace(/\|/g, '\n'),
        });
      }
    }
    return cues;
  }

  // Serializers
  private serializeSRT(cues: Array<{ start: number; end: number; text: string }>): string {
    return cues.map((cue, i) =>
      `${i + 1}\n${this.formatTimestampSRT(cue.start)} --> ${this.formatTimestampSRT(cue.end)}\n${cue.text}`
    ).join('\n\n');
  }

  private serializeVTT(cues: Array<{ start: number; end: number; text: string }>): string {
    const header = 'WEBVTT\n\n';
    return header + cues.map((cue, i) =>
      `${i + 1}\n${this.formatTimestampVTT(cue.start)} --> ${this.formatTimestampVTT(cue.end)}\n${cue.text}`
    ).join('\n\n');
  }

  private serializeASS(cues: Array<{ start: number; end: number; text: string }>): string {
    const header = `[Script Info]
Title: Converted Subtitle
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H0300FFFF,&H00000000,&H02000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    return header + cues.map((cue) =>
      `Dialogue: 0,${this.formatTimestampASS(cue.start)},${this.formatTimestampASS(cue.end)},Default,,0,0,0,,${cue.text.replace(/\n/g, '\\N')}`
    ).join('\n');
  }

  private serializeSBV(cues: Array<{ start: number; end: number; text: string }>): string {
    return cues.map((cue) =>
      `${this.formatTimestampSBV(cue.start)},${this.formatTimestampSBV(cue.end)}\n${cue.text}`
    ).join('\n\n');
  }

  private serializeSUB(cues: Array<{ start: number; end: number; text: string }>): string {
    const fps = 25;
    return cues.map((cue) =>
      `{${Math.round(cue.start * fps)}}{${Math.round(cue.end * fps)}}${cue.text.replace(/\n/g, '|')}`
    ).join('\n');
  }

  // Timestamp helpers
  private parseTimestamp(ts: string): number {
    const parts = ts.replace(',', '.').split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
  }

  private parseASSTimestamp(ts: string): number {
    const parts = ts.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return 0;
  }

  private formatTimestampSRT(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private formatTimestampVTT(seconds: number): string {
    return this.formatTimestampSRT(seconds).replace(',', '.');
  }

  private formatTimestampASS(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  }

  private formatTimestampSBV(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  private getCategory(ext: string): string {
    const lower = ext.toLowerCase();
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'mpg', 'mpeg', 'm4v', 'ts'].includes(lower)) return 'video';
    if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'wma', 'opus', 'alac'].includes(lower)) return 'audio';
    if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tiff', 'tif', 'ico', 'svg'].includes(lower)) return 'image';
    if (['srt', 'vtt', 'ass', 'ssa', 'sbv', 'sub', 'idx'].includes(lower)) return 'subtitle';
    return 'video';
  }
}
