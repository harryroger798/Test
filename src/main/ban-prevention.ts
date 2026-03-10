/**
 * GrabTube Ban Prevention System
 *
 * 5-layer proactive ban protection:
 * 1. Rate Limit Tracking Per Platform - warns users before hitting risky thresholds
 * 2. Smart Cookie Rotation - auto-switches to cookieless mode when threshold is near
 * 3. Cooldown Timer - enforces configurable cooldowns between downloads
 * 4. Request Pattern Randomization - adds random delays to mimic human behavior
 * 5. Health Dashboard - per-platform download counters and risk meters
 */

import { BrowserWindow } from 'electron';

export interface PlatformThresholds {
  warningPerHour: number;   // Yellow warning threshold
  dangerPerHour: number;    // Red danger threshold (auto-switch to cookieless)
  maxPerHour: number;       // Hard limit per hour
  cooldownSeconds: number;  // Cooldown between downloads (seconds)
  minDelayMs: number;       // Min random delay between requests
  maxDelayMs: number;       // Max random delay between requests
}

export interface PlatformDownloadStats {
  platform: string;
  downloadsThisHour: number;
  downloadsToday: number;
  lastDownloadTime: number;
  hourlyTimestamps: number[];  // Timestamps of downloads in the last hour
  dailyTimestamps: number[];   // Timestamps of downloads today
  riskLevel: 'safe' | 'warning' | 'danger';
  cookielessMode: boolean;     // Auto-switched to cookieless
  cooldownUntil: number;       // Timestamp when cooldown expires
  totalDownloads: number;      // All-time total
}

export interface BanPreventionStatus {
  platforms: Record<string, PlatformDownloadStats>;
  globalRiskLevel: 'safe' | 'warning' | 'danger';
  activeCooldowns: number;
  cookielessPlatforms: string[];
}

// Default thresholds per platform (conservative to prevent bans)
const DEFAULT_THRESHOLDS: Record<string, PlatformThresholds> = {
  youtube: {
    warningPerHour: 30,
    dangerPerHour: 50,
    maxPerHour: 80,
    cooldownSeconds: 5,
    minDelayMs: 2000,
    maxDelayMs: 6000,
  },
  instagram: {
    warningPerHour: 20,
    dangerPerHour: 35,
    maxPerHour: 50,
    cooldownSeconds: 8,
    minDelayMs: 3000,
    maxDelayMs: 8000,
  },
  tiktok: {
    warningPerHour: 25,
    dangerPerHour: 40,
    maxPerHour: 60,
    cooldownSeconds: 6,
    minDelayMs: 2000,
    maxDelayMs: 7000,
  },
  twitter: {
    warningPerHour: 25,
    dangerPerHour: 40,
    maxPerHour: 60,
    cooldownSeconds: 5,
    minDelayMs: 2000,
    maxDelayMs: 6000,
  },
  facebook: {
    warningPerHour: 20,
    dangerPerHour: 30,
    maxPerHour: 45,
    cooldownSeconds: 8,
    minDelayMs: 3000,
    maxDelayMs: 8000,
  },
  reddit: {
    warningPerHour: 30,
    dangerPerHour: 50,
    maxPerHour: 80,
    cooldownSeconds: 4,
    minDelayMs: 1500,
    maxDelayMs: 5000,
  },
  // Default for unknown platforms
  default: {
    warningPerHour: 40,
    dangerPerHour: 60,
    maxPerHour: 100,
    cooldownSeconds: 3,
    minDelayMs: 1000,
    maxDelayMs: 4000,
  },
};

export class BanPrevention {
  private platformStats: Map<string, PlatformDownloadStats> = new Map();
  private thresholds: Record<string, PlatformThresholds> = { ...DEFAULT_THRESHOLDS };
  private mainWindow: BrowserWindow | null = null;
  private enabled: boolean = true;
  private randomDelayEnabled: boolean = true;

  constructor() {
    // Clean up old timestamps every 5 minutes
    setInterval(() => this.cleanupOldTimestamps(), 5 * 60 * 1000);
  }

  /**
   * Set the main window reference for sending IPC events.
   */
  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  /**
   * Enable or disable the ban prevention system.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Enable or disable random delay between requests.
   */
  setRandomDelayEnabled(enabled: boolean): void {
    this.randomDelayEnabled = enabled;
  }

  /**
   * Check if a download can proceed for the given platform.
   * Returns: { allowed, reason, waitMs, riskLevel, cookielessRecommended }
   */
  checkDownloadAllowed(platform: string): {
    allowed: boolean;
    reason?: string;
    waitMs: number;
    riskLevel: 'safe' | 'warning' | 'danger';
    cookielessRecommended: boolean;
    cooldownRemaining: number;
  } {
    if (!this.enabled) {
      return { allowed: true, waitMs: 0, riskLevel: 'safe', cookielessRecommended: false, cooldownRemaining: 0 };
    }

    const stats = this.getOrCreateStats(platform);
    const threshold = this.getThreshold(platform);
    const now = Date.now();

    // Check cooldown
    if (stats.cooldownUntil > now) {
      const cooldownRemaining = Math.ceil((stats.cooldownUntil - now) / 1000);
      return {
        allowed: false,
        reason: `Cooldown active for ${platform}. ${cooldownRemaining}s remaining to protect your account.`,
        waitMs: stats.cooldownUntil - now,
        riskLevel: stats.riskLevel,
        cookielessRecommended: stats.cookielessMode,
        cooldownRemaining,
      };
    }

    // Count downloads in the last hour
    const oneHourAgo = now - (60 * 60 * 1000);
    const hourlyCount = stats.hourlyTimestamps.filter(t => t > oneHourAgo).length;

    // Check hard limit
    if (hourlyCount >= threshold.maxPerHour) {
      return {
        allowed: false,
        reason: `Rate limit reached for ${platform} (${hourlyCount}/${threshold.maxPerHour} per hour). Wait for the counter to reset to avoid getting banned.`,
        waitMs: 0,
        riskLevel: 'danger',
        cookielessRecommended: true,
        cooldownRemaining: 0,
      };
    }

    // Calculate risk level
    let riskLevel: 'safe' | 'warning' | 'danger' = 'safe';
    let cookielessRecommended = false;

    if (hourlyCount >= threshold.dangerPerHour) {
      riskLevel = 'danger';
      cookielessRecommended = true;
    } else if (hourlyCount >= threshold.warningPerHour) {
      riskLevel = 'warning';
    }

    // Calculate random delay
    let waitMs = 0;
    if (this.randomDelayEnabled && stats.lastDownloadTime > 0) {
      const timeSinceLastDownload = now - stats.lastDownloadTime;
      const minDelay = threshold.minDelayMs;
      if (timeSinceLastDownload < minDelay) {
        waitMs = minDelay - timeSinceLastDownload + Math.floor(Math.random() * (threshold.maxDelayMs - threshold.minDelayMs));
      }
    }

    return {
      allowed: true,
      waitMs,
      riskLevel,
      cookielessRecommended,
      cooldownRemaining: 0,
    };
  }

  /**
   * Record a download for the given platform.
   * Called after a download starts successfully.
   */
  recordDownload(platform: string): void {
    const stats = this.getOrCreateStats(platform);
    const threshold = this.getThreshold(platform);
    const now = Date.now();

    stats.hourlyTimestamps.push(now);
    stats.dailyTimestamps.push(now);
    stats.lastDownloadTime = now;
    stats.totalDownloads++;

    // Update hourly count
    const oneHourAgo = now - (60 * 60 * 1000);
    stats.downloadsThisHour = stats.hourlyTimestamps.filter(t => t > oneHourAgo).length;

    // Update daily count
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    stats.downloadsToday = stats.dailyTimestamps.filter(t => t > startOfDay.getTime()).length;

    // Set cooldown
    stats.cooldownUntil = now + (threshold.cooldownSeconds * 1000);

    // Update risk level
    if (stats.downloadsThisHour >= threshold.dangerPerHour) {
      stats.riskLevel = 'danger';
      stats.cookielessMode = true;
      this.sendWarning(platform, 'danger', stats.downloadsThisHour, threshold.dangerPerHour);
    } else if (stats.downloadsThisHour >= threshold.warningPerHour) {
      stats.riskLevel = 'warning';
      this.sendWarning(platform, 'warning', stats.downloadsThisHour, threshold.warningPerHour);
    } else {
      stats.riskLevel = 'safe';
    }

    this.platformStats.set(platform, stats);
  }

  /**
   * Record a successful download completion.
   */
  recordSuccess(platform: string): void {
    // Success resets any ban escalation for the platform
    const stats = this.getOrCreateStats(platform);
    if (stats.cookielessMode && stats.riskLevel === 'safe') {
      stats.cookielessMode = false;
    }
    this.platformStats.set(platform, stats);
  }

  /**
   * Check if cookieless mode should be used for this platform.
   */
  shouldUseCookieless(platform: string): boolean {
    if (!this.enabled) return false;
    const stats = this.getOrCreateStats(platform);
    return stats.cookielessMode;
  }

  /**
   * Reset cookieless mode for a platform (user override).
   */
  resetCookielessMode(platform: string): void {
    const stats = this.getOrCreateStats(platform);
    stats.cookielessMode = false;
    stats.riskLevel = 'safe';
    this.platformStats.set(platform, stats);
  }

  /**
   * Reset all stats for a platform.
   */
  resetPlatform(platform: string): void {
    this.platformStats.delete(platform);
  }

  /**
   * Reset all stats.
   */
  resetAll(): void {
    this.platformStats.clear();
  }

  /**
   * Get the full ban prevention status for UI display.
   */
  getStatus(): BanPreventionStatus {
    const platforms: Record<string, PlatformDownloadStats> = {};
    let globalRisk: 'safe' | 'warning' | 'danger' = 'safe';
    let activeCooldowns = 0;
    const cookielessPlatforms: string[] = [];
    const now = Date.now();

    for (const [name, stats] of this.platformStats) {
      // Clean up hourly timestamps
      const oneHourAgo = now - (60 * 60 * 1000);
      stats.downloadsThisHour = stats.hourlyTimestamps.filter(t => t > oneHourAgo).length;

      platforms[name] = { ...stats };

      if (stats.riskLevel === 'danger') globalRisk = 'danger';
      else if (stats.riskLevel === 'warning' && globalRisk !== 'danger') globalRisk = 'warning';

      if (stats.cooldownUntil > now) activeCooldowns++;
      if (stats.cookielessMode) cookielessPlatforms.push(name);
    }

    return {
      platforms,
      globalRiskLevel: globalRisk,
      activeCooldowns,
      cookielessPlatforms,
    };
  }

  /**
   * Get stats for a specific platform.
   */
  getPlatformStats(platform: string): PlatformDownloadStats {
    return this.getOrCreateStats(platform);
  }

  /**
   * Get threshold config for a platform.
   */
  getThreshold(platform: string): PlatformThresholds {
    return this.thresholds[platform.toLowerCase()] || this.thresholds['default'];
  }

  /**
   * Calculate a random delay in milliseconds for human-like behavior.
   */
  getRandomDelay(platform: string): number {
    if (!this.randomDelayEnabled || !this.enabled) return 0;
    const threshold = this.getThreshold(platform);
    return threshold.minDelayMs + Math.floor(Math.random() * (threshold.maxDelayMs - threshold.minDelayMs));
  }

  /**
   * Get whether ban prevention is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get whether random delay is enabled.
   */
  isRandomDelayEnabled(): boolean {
    return this.randomDelayEnabled;
  }

  // ==================== PRIVATE METHODS ====================

  private getOrCreateStats(platform: string): PlatformDownloadStats {
    const key = platform.toLowerCase();
    if (!this.platformStats.has(key)) {
      this.platformStats.set(key, {
        platform: key,
        downloadsThisHour: 0,
        downloadsToday: 0,
        lastDownloadTime: 0,
        hourlyTimestamps: [],
        dailyTimestamps: [],
        riskLevel: 'safe',
        cookielessMode: false,
        cooldownUntil: 0,
        totalDownloads: 0,
      });
    }
    return this.platformStats.get(key)!;
  }

  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    for (const [, stats] of this.platformStats) {
      stats.hourlyTimestamps = stats.hourlyTimestamps.filter(t => t > oneHourAgo);
      stats.dailyTimestamps = stats.dailyTimestamps.filter(t => t > startOfDay.getTime());
      stats.downloadsThisHour = stats.hourlyTimestamps.length;
      stats.downloadsToday = stats.dailyTimestamps.length;

      // Reset risk level if hourly count has dropped
      const threshold = this.getThreshold(stats.platform);
      if (stats.downloadsThisHour < threshold.warningPerHour) {
        stats.riskLevel = 'safe';
      } else if (stats.downloadsThisHour < threshold.dangerPerHour) {
        stats.riskLevel = 'warning';
      }
    }
  }

  private sendWarning(platform: string, level: 'warning' | 'danger', count: number, threshold: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const message = level === 'danger'
      ? `You've downloaded ${count} items from ${platform} this hour (limit: ${threshold}). Auto-switching to cookieless mode to protect your account.`
      : `You've downloaded ${count} items from ${platform} this hour. Approaching the safe limit (${threshold}). Consider slowing down.`;

    this.mainWindow.webContents.send('ban-prevention-warning', {
      platform,
      level,
      count,
      threshold,
      message,
      cookielessActivated: level === 'danger',
    });

    console.log(`[GrabTube BanPrevention] ${level.toUpperCase()}: ${platform} - ${count}/${threshold} downloads this hour`);
  }
}
