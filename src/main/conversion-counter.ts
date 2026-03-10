/**
 * GrabTube Conversion Counter
 *
 * Tracks daily conversion count per tier.
 * Same pattern as the download counter in license-manager.ts.
 * Free tier: 3 conversions/day, 500 MB max file size.
 * Pro/Family: unlimited conversions, no file size limit.
 */
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { LicenseManager, LicenseTier } from './license-manager';

interface ConversionCounterData {
  date: string;
  count: number;
}

interface ConversionTierLimits {
  maxPerDay: number;       // -1 = unlimited
  maxFileSizeMB: number;   // -1 = unlimited
}

const CONVERSION_LIMITS: Record<LicenseTier, ConversionTierLimits> = {
  free: {
    maxPerDay: 3,
    maxFileSizeMB: 500,
  },
  pro: {
    maxPerDay: -1,
    maxFileSizeMB: -1,
  },
  family: {
    maxPerDay: -1,
    maxFileSizeMB: -1,
  },
};

export class ConversionCounter {
  private counterPath: string;
  private data: ConversionCounterData;
  private licenseManager: LicenseManager;

  constructor(licenseManager: LicenseManager) {
    this.licenseManager = licenseManager;
    const userDataPath = app?.getPath?.('userData') || path.join(process.env.HOME || '', '.grabtube');
    this.counterPath = path.join(userDataPath, 'conversion-counter.json');
    this.data = this.load();
  }

  private load(): ConversionCounterData {
    try {
      if (fs.existsSync(this.counterPath)) {
        const raw = JSON.parse(fs.readFileSync(this.counterPath, 'utf-8'));
        const today = new Date().toISOString().split('T')[0];
        if (raw.date === today) {
          return { date: raw.date, count: raw.count || 0 };
        }
      }
    } catch {
      // Fall through to default
    }
    return { date: new Date().toISOString().split('T')[0], count: 0 };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.counterPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.counterPath, JSON.stringify(this.data, null, 2));
    } catch {
      // Silently fail
    }
  }

  private ensureToday(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.data.date !== today) {
      this.data = { date: today, count: 0 };
      this.save();
    }
  }

  /**
   * Check if a conversion is allowed.
   */
  canConvert(): { allowed: boolean; reason?: string; remaining: number; tier: string; maxSizeMB: number } {
    this.ensureToday();
    const tier = this.licenseManager.getTier();
    const limits = CONVERSION_LIMITS[tier];

    if (limits.maxPerDay !== -1 && this.data.count >= limits.maxPerDay) {
      return {
        allowed: false,
        reason: `Daily conversion limit reached (${limits.maxPerDay}/day). Upgrade to Pro for unlimited conversions.`,
        remaining: 0,
        tier,
        maxSizeMB: limits.maxFileSizeMB,
      };
    }

    const remaining = limits.maxPerDay === -1 ? -1 : limits.maxPerDay - this.data.count;

    return {
      allowed: true,
      remaining,
      tier,
      maxSizeMB: limits.maxFileSizeMB,
    };
  }

  /**
   * Record a successful conversion.
   */
  recordConversion(): void {
    this.ensureToday();
    this.data.count++;
    this.save();
  }

  /**
   * Get today's stats.
   */
  getStats(): { date: string; count: number; tier: string; remaining: number; maxSizeMB: number } {
    this.ensureToday();
    const tier = this.licenseManager.getTier();
    const limits = CONVERSION_LIMITS[tier];
    const remaining = limits.maxPerDay === -1 ? -1 : Math.max(0, limits.maxPerDay - this.data.count);

    return {
      date: this.data.date,
      count: this.data.count,
      tier,
      remaining,
      maxSizeMB: limits.maxFileSizeMB,
    };
  }
}
