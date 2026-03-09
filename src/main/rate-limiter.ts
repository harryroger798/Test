/**
 * GrabTube IP Protection & Rate Limiter
 *
 * Protects user IPs from getting banned by YouTube and other platforms.
 * Implements: cooldowns, progressive backoff, 429 detection, daily limits.
 */

export interface RateLimitStatus {
  canProceed: boolean;
  waitSeconds: number;
  reason?: string;
  banDetected: boolean;
  consecutiveBans: number;
}

export class RateLimiter {
  // Track 429/ban detections per session
  private consecutiveBans: number = 0;
  private lastBanTime: number = 0;
  private backoffUntil: number = 0;

  // Progressive backoff escalation (minutes)
  private readonly BACKOFF_LEVELS = [2, 5, 15, 60]; // 2min, 5min, 15min, 1hr

  // Fragment retry limit (lower than yt-dlp default of 10)
  readonly FRAGMENT_RETRIES = 3;

  /**
   * Check if we're currently in a backoff period.
   */
  checkBackoff(): RateLimitStatus {
    const now = Date.now();

    if (now < this.backoffUntil) {
      const waitSeconds = Math.ceil((this.backoffUntil - now) / 1000);
      return {
        canProceed: false,
        waitSeconds,
        reason: `Rate limit cooldown active. Waiting ${waitSeconds}s to protect your IP from being banned.`,
        banDetected: true,
        consecutiveBans: this.consecutiveBans,
      };
    }

    return {
      canProceed: true,
      waitSeconds: 0,
      banDetected: false,
      consecutiveBans: this.consecutiveBans,
    };
  }

  /**
   * Report a 429/ban detection. Triggers progressive backoff.
   */
  reportBan(errorMessage?: string): void {
    const now = Date.now();
    this.consecutiveBans++;
    this.lastBanTime = now;

    // Progressive backoff based on consecutive bans
    const level = Math.min(this.consecutiveBans - 1, this.BACKOFF_LEVELS.length - 1);
    const backoffMinutes = this.BACKOFF_LEVELS[level];
    this.backoffUntil = now + (backoffMinutes * 60 * 1000);

    console.log(`[GrabTube RateLimiter] Ban #${this.consecutiveBans} detected${errorMessage ? ': ' + errorMessage.substring(0, 100) : ''}. Backing off for ${backoffMinutes} minutes.`);
  }

  /**
   * Report a successful download. Resets consecutive ban counter.
   */
  reportSuccess(): void {
    this.consecutiveBans = 0;
  }

  /**
   * Detect if an error indicates a rate limit / IP ban.
   */
  isBanError(error: string): boolean {
    const lower = error.toLowerCase();
    return (
      lower.includes('429') ||
      lower.includes('too many requests') ||
      lower.includes('rate limit') ||
      lower.includes('rate-limit') ||
      lower.includes('sign in to confirm') ||
      lower.includes('not a bot') ||
      lower.includes('bot detection') ||
      lower.includes('automated') ||
      lower.includes('captcha') ||
      lower.includes('ip has been blocked') ||
      lower.includes('ip banned') ||
      lower.includes('temporarily blocked')
    );
  }

  /**
   * Get current backoff status for UI display.
   */
  getStatus(): {
    inBackoff: boolean;
    backoffUntil: number;
    consecutiveBans: number;
    backoffMinutes: number;
  } {
    const now = Date.now();
    return {
      inBackoff: now < this.backoffUntil,
      backoffUntil: this.backoffUntil,
      consecutiveBans: this.consecutiveBans,
      backoffMinutes: now < this.backoffUntil ? Math.ceil((this.backoffUntil - now) / 60000) : 0,
    };
  }

  /**
   * Reset backoff (e.g., when user changes proxy settings).
   */
  reset(): void {
    this.consecutiveBans = 0;
    this.lastBanTime = 0;
    this.backoffUntil = 0;
  }
}
