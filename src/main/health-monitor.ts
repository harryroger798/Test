import { BrowserWindow } from 'electron';
import { YtdlpManager } from './ytdlp-manager';
import { BinaryManager } from './binary-manager';
import { BinaryUpdater } from './binary-updater';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Failure record for tracking repeated errors.
 */
interface FailureRecord {
  binary: string;
  platform: string;
  error: string;
  timestamp: number;
  healed: boolean;
}

/**
 * Health status for a component.
 */
interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  message: string;
}

/**
 * Self-healing health monitor for GrabTube.
 * Watches for repeated failures and auto-fixes common issues:
 * - Corrupted binary -> re-download
 * - yt-dlp fails on platform -> auto-update yt-dlp
 * - POT token generation fails -> restart POT server
 * - Download stalls -> timeout and retry
 * - Disk space low -> warn user
 */
export class HealthMonitor {
  private mainWindow: BrowserWindow | null = null;
  private ytdlp: YtdlpManager;
  private binaryManager: BinaryManager;
  private binaryUpdater: BinaryUpdater;
  private failures: FailureRecord[] = [];
  private healthStatuses: Map<string, HealthStatus> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private readonly MAX_FAILURES_BEFORE_HEAL = 3;
  private readonly FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private healing = false;

  constructor(
    ytdlp: YtdlpManager,
    binaryManager: BinaryManager,
    binaryUpdater: BinaryUpdater
  ) {
    this.ytdlp = ytdlp;
    this.binaryManager = binaryManager;
    this.binaryUpdater = binaryUpdater;
  }

  /**
   * Initialize health monitor with window reference.
   */
  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Run health check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.runHealthCheck();
    }, 5 * 60 * 1000);

    // Initial health check after 60 seconds
    setTimeout(() => {
      this.runHealthCheck();
    }, 60000);
  }

  /**
   * Record a download/operation failure.
   * Triggers self-healing if threshold is exceeded.
   */
  recordFailure(binary: string, platform: string, error: string): void {
    const record: FailureRecord = {
      binary,
      platform,
      error,
      timestamp: Date.now(),
      healed: false,
    };
    this.failures.push(record);

    // Clean old failures outside the window
    const cutoff = Date.now() - this.FAILURE_WINDOW_MS;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);

    // Count recent failures for this binary
    const recentFailures = this.failures.filter(
      (f) => f.binary === binary && !f.healed
    );

    if (recentFailures.length >= this.MAX_FAILURES_BEFORE_HEAL) {
      this.triggerSelfHeal(binary, platform, error);
    }
  }

  /**
   * Run comprehensive health check on all components.
   */
  async runHealthCheck(): Promise<Map<string, HealthStatus>> {
    await Promise.all([
      this.checkBinaryHealth('yt-dlp'),
      this.checkBinaryHealth('ffmpeg'),
      this.checkBinaryHealth('bgutil-pot'),
      this.checkDiskSpace(),
      this.checkPotProvider(),
    ]);

    this.sendHealthReport();
    return this.healthStatuses;
  }

  /**
   * Check if a specific binary is healthy (exists and executable).
   */
  private async checkBinaryHealth(name: string): Promise<void> {
    let binaryPath = '';
    switch (name) {
      case 'yt-dlp':
        binaryPath = this.binaryManager.getYtdlpPath();
        break;
      case 'ffmpeg':
        binaryPath = this.binaryManager.getFfmpegPath();
        break;
      case 'bgutil-pot':
        binaryPath = this.binaryManager.getPotProviderPath();
        break;
    }

    if (!binaryPath || binaryPath === name) {
      this.setHealth(name, 'degraded', `Using system ${name} (not bundled)`);
      return;
    }

    if (!fs.existsSync(binaryPath)) {
      this.setHealth(name, 'unhealthy', `Binary missing: ${binaryPath}`);
      return;
    }

    // Check file size (corrupted binaries are often 0 bytes)
    try {
      const stats = fs.statSync(binaryPath);
      if (stats.size < 1000) {
        this.setHealth(name, 'unhealthy', `Binary appears corrupted (${stats.size} bytes)`);
        return;
      }
    } catch {
      this.setHealth(name, 'unhealthy', `Cannot read binary: ${binaryPath}`);
      return;
    }

    // For yt-dlp, also check version command works
    if (name === 'yt-dlp') {
      try {
        const available = await this.ytdlp.isAvailable();
        if (available) {
          const version = await this.ytdlp.getVersion();
          this.setHealth(name, 'healthy', `v${version}`);
        } else {
          this.setHealth(name, 'unhealthy', 'yt-dlp binary exists but failed to execute');
        }
      } catch {
        this.setHealth(name, 'unhealthy', 'yt-dlp execution failed');
      }
      return;
    }

    this.setHealth(name, 'healthy', 'Binary present and valid');
  }

  /**
   * Check disk space availability.
   */
  private async checkDiskSpace(): Promise<void> {
    try {
      const tmpDir = os.tmpdir();
      const stats = fs.statfsSync(tmpDir);
      const freeBytes = stats.bfree * stats.bsize;
      const freeMB = Math.round(freeBytes / (1024 * 1024));

      if (freeMB < 100) {
        this.setHealth('disk', 'unhealthy', `Only ${freeMB}MB free — downloads may fail`);
      } else if (freeMB < 500) {
        this.setHealth('disk', 'degraded', `${freeMB}MB free — consider freeing space`);
      } else {
        this.setHealth('disk', 'healthy', `${freeMB}MB free`);
      }
    } catch {
      this.setHealth('disk', 'healthy', 'Unable to check disk space');
    }
  }

  /**
   * Check POT provider status.
   */
  private async checkPotProvider(): Promise<void> {
    const potProvider = this.ytdlp.getPotProvider();
    if (potProvider.isRunning()) {
      this.setHealth('pot-provider', 'healthy', 'POT server running');
    } else {
      this.setHealth('pot-provider', 'degraded', 'POT server not running — YouTube may need proxy');
    }
  }

  /**
   * Trigger self-healing for a failing component.
   */
  private async triggerSelfHeal(binary: string, platform: string, error: string): Promise<void> {
    if (this.healing) return;
    this.healing = true;

    console.log(`[GrabTube] Self-healing triggered for ${binary} (platform: ${platform})`);
    this.sendToRenderer('health-heal-start', { binary, platform, error });

    try {
      let healed = false;

      // Strategy 1: Restart POT provider if it's a YouTube issue
      if (platform === 'youtube' && this.isTokenError(error)) {
        console.log('[GrabTube] Self-heal: Restarting POT provider...');
        this.ytdlp.stopPotProvider();
        await this.sleep(2000);
        const started = await this.ytdlp.startPotProvider();
        if (started) {
          healed = true;
          console.log('[GrabTube] Self-heal: POT provider restarted successfully');
        }
      }

      // Strategy 2: Auto-update yt-dlp if it's a platform extraction error
      if (!healed && binary === 'yt-dlp' && this.isExtractionError(error)) {
        console.log('[GrabTube] Self-heal: Updating yt-dlp...');
        await this.binaryUpdater.checkAll();
        healed = true;
        console.log('[GrabTube] Self-heal: yt-dlp update check completed');
      }

      // Strategy 3: Re-download corrupted binary
      if (!healed && this.isBinaryCorruptedError(error)) {
        console.log(`[GrabTube] Self-heal: Re-downloading ${binary}...`);
        await this.binaryUpdater.checkAll();
        healed = true;
      }

      // Mark recent failures as healed
      if (healed) {
        for (const f of this.failures) {
          if (f.binary === binary && !f.healed) {
            f.healed = true;
          }
        }
      }

      this.sendToRenderer('health-heal-complete', { binary, healed });

      // If we couldn't self-heal, notify user
      if (!healed) {
        this.sendToRenderer('health-heal-failed', {
          binary,
          platform,
          error,
          suggestion: this.getSuggestion(binary, platform, error),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[GrabTube] Self-heal failed for ${binary}:`, message);
      this.sendToRenderer('health-heal-failed', { binary, error: message });
    } finally {
      this.healing = false;
    }
  }

  /**
   * Check if error is related to POT token generation.
   */
  private isTokenError(error: string): boolean {
    const tokenKeywords = ['pot', 'token', 'botguard', 'po_token', 'proof of origin'];
    return tokenKeywords.some((k) => error.toLowerCase().includes(k));
  }

  /**
   * Check if error is related to platform extraction (needs yt-dlp update).
   */
  private isExtractionError(error: string): boolean {
    const extractionKeywords = [
      'unsupported url', 'extractor', 'unable to extract', 'no video formats',
      'regex', 'json', 'parse', 'unexpected', 'api',
    ];
    return extractionKeywords.some((k) => error.toLowerCase().includes(k));
  }

  /**
   * Check if error suggests binary is corrupted.
   */
  private isBinaryCorruptedError(error: string): boolean {
    const corruptKeywords = ['enoent', 'eacces', 'spawn', 'not found', 'permission denied', 'bad cpu'];
    return corruptKeywords.some((k) => error.toLowerCase().includes(k));
  }

  /**
   * Get a user-friendly suggestion for unresolvable errors.
   */
  private getSuggestion(binary: string, platform: string, error: string): string {
    if (platform === 'youtube' && error.includes('bot')) {
      return 'YouTube is blocking this IP. Try using a proxy in Settings or import browser cookies.';
    }
    if (error.includes('cookie') || error.includes('login') || error.includes('auth')) {
      return `${platform} requires login. Go to Settings > Cookie Authentication to import cookies.`;
    }
    if (error.includes('geo') || error.includes('country')) {
      return `This content may be geo-restricted. Try enabling a proxy in Settings.`;
    }
    return `${binary} is having issues with ${platform}. Try restarting the app or checking for updates in Settings.`;
  }

  private setHealth(component: string, status: 'healthy' | 'degraded' | 'unhealthy', message: string): void {
    this.healthStatuses.set(component, {
      component,
      status,
      lastCheck: Date.now(),
      message,
    });
  }

  private sendHealthReport(): void {
    const report = Array.from(this.healthStatuses.values());
    this.sendToRenderer('health-report', { components: report });
  }

  private sendToRenderer(channel: string, data: Record<string, unknown>): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current health statuses (for IPC).
   */
  getHealthStatuses(): HealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /**
   * Get recent failure log (for IPC).
   */
  getFailureLog(): FailureRecord[] {
    return [...this.failures].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }

  /**
   * Clean up on app quit.
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
