import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Cobalt API fallback for downloading videos when local yt-dlp fails.
 * Uses cobalt.tools instances as a proxy service.
 * This is a last-resort fallback — local yt-dlp is always preferred.
 */

interface CobaltResponse {
  status: 'redirect' | 'stream' | 'picker' | 'error';
  url?: string;
  filename?: string;
  picker?: Array<{ url: string; type: string }>;
  text?: string;
}

/**
 * Public cobalt API instances to try (in order of preference).
 * These are community-hosted cobalt instances.
 */
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
];

export class CobaltFallback {
  private enabled = true;

  /**
   * Enable/disable cobalt fallback.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Try downloading a video via cobalt API.
   * Returns the download URL if successful, null if failed.
   */
  async getDownloadUrl(
    videoUrl: string,
    audioOnly = false
  ): Promise<{ url: string; filename: string } | null> {
    if (!this.enabled) return null;

    for (const instance of COBALT_INSTANCES) {
      try {
        const result = await this.requestCobalt(instance, videoUrl, audioOnly);
        if (result && result.url) {
          return result;
        }
      } catch (err) {
        console.warn(`[GrabTube] Cobalt instance ${instance} failed:`, err);
        continue;
      }
    }

    return null;
  }

  /**
   * Download a file from a URL to a local path with progress callback.
   */
  async downloadFile(
    url: string,
    outputPath: string,
    filename: string,
    onProgress?: (percent: number, speed: string) => void
  ): Promise<string> {
    const filePath = path.join(outputPath, filename);

    return new Promise((resolve, reject) => {
      const makeRequest = (requestUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const protocol = requestUrl.startsWith('https') ? https : http;
        protocol.get(requestUrl, { headers: { 'User-Agent': 'GrabTube/1.0' } }, (res) => {
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
          const file = fs.createWriteStream(filePath);

          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;

            if (elapsed >= 1 && onProgress) {
              const bytesPerSec = (downloaded - lastBytes) / elapsed;
              const speed = this.formatSpeed(bytesPerSec);
              const percent = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0;
              onProgress(percent, speed);
              lastTime = now;
              lastBytes = downloaded;
            }
          });

          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(filePath);
          });
          file.on('error', (err) => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            reject(err);
          });
        }).on('error', reject);
      };

      makeRequest(url);
    });
  }

  private async requestCobalt(
    instance: string,
    videoUrl: string,
    audioOnly: boolean
  ): Promise<{ url: string; filename: string } | null> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        url: videoUrl,
        downloadMode: audioOnly ? 'audio' : 'auto',
        filenameStyle: 'pretty',
      });

      const url = new URL(instance);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'GrabTube/1.0',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data) as CobaltResponse;
            if (response.status === 'redirect' && response.url) {
              resolve({
                url: response.url,
                filename: response.filename || 'video.mp4',
              });
            } else if (response.status === 'stream' && response.url) {
              resolve({
                url: response.url,
                filename: response.filename || 'video.mp4',
              });
            } else if (response.status === 'error') {
              console.warn(`[GrabTube] Cobalt error: ${response.text}`);
              resolve(null);
            } else {
              resolve(null);
            }
          } catch {
            reject(new Error('Failed to parse cobalt response'));
          }
        });
      });

      req.on('error', reject);

      // Timeout
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Cobalt request timed out'));
      });

      req.write(body);
      req.end();
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
}
