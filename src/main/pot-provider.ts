import { spawn, ChildProcess } from 'child_process';
import { BinaryManager } from './binary-manager';

/**
 * Manages the POT (Proof-of-Origin Token) provider server lifecycle.
 * The POT provider generates authentic YouTube BotGuard tokens so that
 * yt-dlp can bypass "Sign in to confirm you're not a bot" restrictions.
 *
 * Architecture:
 *   GrabTube starts -> POT server auto-starts on localhost:4416
 *   yt-dlp download -> POT plugin asks server for token -> server returns token
 *   yt-dlp sends token to YouTube -> YouTube allows download
 *
 * The Rust binary (bgutil-pot) is a single executable with no dependencies.
 * It runs as an HTTP server in the background.
 */
export class PotProviderManager {
  private process: ChildProcess | null = null;
  private binaryManager: BinaryManager;
  private port: number = 4416;
  private ready: boolean = false;
  private startPromise: Promise<boolean> | null = null;

  constructor(binaryManager: BinaryManager) {
    this.binaryManager = binaryManager;
  }

  /**
   * Start the POT provider HTTP server in the background.
   * Returns true if started successfully, false if not available.
   */
  async start(): Promise<boolean> {
    // If already running, return true
    if (this.process && this.ready) {
      return true;
    }

    // If already starting, wait for that
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.doStart();
    const result = await this.startPromise;
    this.startPromise = null;
    return result;
  }

  private async doStart(): Promise<boolean> {
    const potPath = this.binaryManager.getPotProviderPath();
    if (!potPath) {
      console.log('[POT] POT provider binary not found. YouTube may require proxy from datacenter IPs.');
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        console.log(`[POT] Starting POT provider server on port ${this.port}...`);
        this.process = spawn(potPath, ['server', '--port', String(this.port)], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        });

        let started = false;

        // Listen for server ready message
        this.process.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          console.log(`[POT] ${output.trim()}`);
          if (!started && (output.includes('Listening') || output.includes('listening') || output.includes('Started') || output.includes('ready'))) {
            started = true;
            this.ready = true;
            console.log('[POT] POT provider server is ready.');
            resolve(true);
          }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
          const output = data.toString();
          console.error(`[POT] Error: ${output.trim()}`);
        });

        this.process.on('error', (err) => {
          console.error(`[POT] Failed to start POT provider: ${err.message}`);
          this.process = null;
          this.ready = false;
          if (!started) {
            resolve(false);
          }
        });

        this.process.on('close', (code) => {
          console.log(`[POT] POT provider process exited with code ${code}`);
          this.process = null;
          this.ready = false;
          if (!started) {
            resolve(false);
          }
        });

        // Timeout: if server doesn't signal ready in 10 seconds, assume it started
        setTimeout(() => {
          if (!started && this.process) {
            started = true;
            this.ready = true;
            console.log('[POT] POT provider server assumed ready (timeout).');
            resolve(true);
          } else if (!started) {
            resolve(false);
          }
        }, 10000);

      } catch (err) {
        console.error(`[POT] Exception starting POT provider: ${err}`);
        resolve(false);
      }
    });
  }

  /**
   * Stop the POT provider server.
   */
  stop(): void {
    if (this.process) {
      console.log('[POT] Stopping POT provider server...');
      try {
        this.process.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      this.process = null;
      this.ready = false;
    }
  }

  /**
   * Check if the POT provider is running and ready.
   */
  isRunning(): boolean {
    return this.ready && this.process !== null;
  }

  /**
   * Get the base URL for the POT provider HTTP server.
   * Used by yt-dlp via --extractor-args "youtube:getpot_bgutil_baseurl=URL"
   */
  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /**
   * Get the yt-dlp extractor args needed to use the POT provider.
   * Returns empty array if POT provider is not running.
   */
  getYtdlpArgs(): string[] {
    if (!this.isRunning()) {
      return [];
    }
    return [
      '--extractor-args',
      `youtube:getpot_bgutil_baseurl=${this.getBaseUrl()}`,
    ];
  }
}
