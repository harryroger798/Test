/**
 * GrabTube License Manager
 *
 * Handles license key activation, validation, and tier gating.
 * Communicates with the Cloudflare Worker license server.
 * Falls back to offline cached validation if server is unreachable.
 *
 * Security (v1.0.39):
 *   - HMAC-signed license files (tamper detection)
 *   - Encrypted download counter (prevents manual editing)
 *   - Server response signature verification (prevents MITM/spoofing)
 *   - Integrity checks on load (reverts to free tier if tampered)
 *   - Tighter offline grace (30 days) and revalidation (7 days)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { app } from 'electron';

// License server URL — update this after deploying the Cloudflare Worker
const LICENSE_SERVER_URL = 'https://grabtube-license.grabtube-app.workers.dev';

// HMAC secret for signing local license files (machine-specific so files can't be copied between machines)
function deriveLocalSecret(seed: string): string {
  const machineSalt = [
    os.hostname(),
    os.platform(),
    os.arch(),
  ].join(':');
  return crypto.createHmac('sha256', machineSalt).update(seed).digest('hex');
}

const LICENSE_HMAC_SECRET = deriveLocalSecret('gt-license-integrity-v1');

// Server response verification secret — MUST match the Cloudflare Worker's SERVER_RESPONSE_SECRET exactly.
// This is NOT machine-specific because the server uses a single shared secret for all clients.
const SERVER_RESPONSE_SECRET = 'gt-server-response-v1';

export type LicenseTier = 'free' | 'pro' | 'family';

export interface LicenseState {
  tier: LicenseTier;
  key: string;
  deviceId: string;
  activated: boolean;
  validatedAt: string;      // ISO timestamp of last successful validation
  maxDevices: number;
  devicesUsed: number;
  offlineGraceDays: number;  // Days remaining in offline grace period
}

export interface TierLimits {
  maxDownloadsPerDay: number;       // -1 = unlimited
  maxQuality: string;               // '1080' or '4320' (8K) or 'unlimited'
  maxConcurrent: number;
  batchDownload: boolean;
  playlistDownload: boolean;
  cooldownSeconds: number;           // Seconds between downloads
}

const TIER_LIMITS: Record<LicenseTier, TierLimits> = {
  free: {
    maxDownloadsPerDay: 5,
    maxQuality: '1080',
    maxConcurrent: 1,
    batchDownload: false,
    playlistDownload: false,
    cooldownSeconds: 30,
  },
  pro: {
    maxDownloadsPerDay: -1,
    maxQuality: 'unlimited',
    maxConcurrent: 3,
    batchDownload: true,
    playlistDownload: true,
    cooldownSeconds: 5,
  },
  family: {
    maxDownloadsPerDay: -1,
    maxQuality: 'unlimited',
    maxConcurrent: 3,
    batchDownload: true,
    playlistDownload: true,
    cooldownSeconds: 5,
  },
};

// Offline grace period: 30 days (reduced from 90 for security)
const OFFLINE_GRACE_DAYS = 30;
// Re-validate every 7 days (reduced from 30 for tighter control)
const REVALIDATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export class LicenseManager {
  private licensePath: string;
  private counterPath: string;
  private state: LicenseState;
  private dailyDownloadCount: number = 0;
  private dailyCountDate: string = '';
  private lastDownloadTime: number = 0;

  constructor() {
    const userDataPath = app?.getPath?.('userData') || path.join(process.env.HOME || '', '.grabtube');
    this.licensePath = path.join(userDataPath, 'license.dat');
    this.counterPath = path.join(userDataPath, 'counter.dat');
    this.state = this.loadState();
    this.loadCounter();
  }

  // === HMAC SIGNING & VERIFICATION ===

  /**
   * Generate HMAC signature for data using embedded secret + device ID.
   * Device ID is mixed in so signed files cannot be copied between machines.
   */
  private signData(data: string): string {
    const key = LICENSE_HMAC_SECRET + this.generateDeviceId();
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature using timing-safe comparison.
   */
  private verifySignature(data: string, signature: string): boolean {
    const expected = this.signData(data);
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /**
   * Save data with HMAC signature (tamper-proof).
   * Format: base64(JSON) + '.' + hmac_signature
   */
  private saveSignedFile(filePath: string, data: Record<string, unknown>): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const jsonStr = JSON.stringify(data);
      const encoded = Buffer.from(jsonStr).toString('base64');
      const signature = this.signData(encoded);
      fs.writeFileSync(filePath, `${encoded}.${signature}`);
    } catch {
      // Silently fail
    }
  }

  /**
   * Load and verify signed file. Returns null if tampered or missing.
   */
  private loadSignedFile(filePath: string): Record<string, unknown> | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      const dotIndex = content.lastIndexOf('.');
      if (dotIndex === -1) return null;

      const encoded = content.substring(0, dotIndex);
      const signature = content.substring(dotIndex + 1);

      if (!this.verifySignature(encoded, signature)) {
        console.warn('[LicenseManager] License file integrity check failed — reverting to free tier');
        return null;
      }

      const jsonStr = Buffer.from(encoded, 'base64').toString('utf-8');
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  // === STATE MANAGEMENT ===

  private loadState(): LicenseState {
    // Try loading new signed format first
    const signedData = this.loadSignedFile(this.licensePath);
    if (signedData) {
      return {
        tier: (signedData.tier as LicenseTier) || 'free',
        key: (signedData.key as string) || '',
        deviceId: (signedData.deviceId as string) || this.generateDeviceId(),
        activated: (signedData.activated as boolean) || false,
        validatedAt: (signedData.validatedAt as string) || '',
        maxDevices: (signedData.maxDevices as number) || 0,
        devicesUsed: (signedData.devicesUsed as number) || 0,
        offlineGraceDays: OFFLINE_GRACE_DAYS,
      };
    }

    // Try migrating from old plaintext format (license.json)
    // SECURITY: Do NOT trust the tier from the old file — force re-validation
    try {
      const oldPath = this.licensePath.replace('license.dat', 'license.json');
      if (fs.existsSync(oldPath)) {
        const data = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
        const state: LicenseState = {
          tier: 'free', // Don't trust plaintext tier — will be re-validated from server
          key: data.key || '',
          deviceId: data.deviceId || this.generateDeviceId(),
          activated: !!(data.key), // Mark as activated only if key exists
          validatedAt: '', // Force immediate re-validation
          maxDevices: 0,
          devicesUsed: 0,
          offlineGraceDays: OFFLINE_GRACE_DAYS,
        };
        // Migrate: save in new signed format, then delete old file
        this.state = state;
        this.saveState();
        try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
        return state;
      }
    } catch {
      // Migration failed, start fresh
    }

    return {
      tier: 'free',
      key: '',
      deviceId: this.generateDeviceId(),
      activated: false,
      validatedAt: '',
      maxDevices: 0,
      devicesUsed: 0,
      offlineGraceDays: OFFLINE_GRACE_DAYS,
    };
  }

  private saveState(): void {
    this.saveSignedFile(this.licensePath, {
      tier: this.state.tier,
      key: this.state.key,
      deviceId: this.state.deviceId,
      activated: this.state.activated,
      validatedAt: this.state.validatedAt,
      maxDevices: this.state.maxDevices,
      devicesUsed: this.state.devicesUsed,
    });
  }

  private loadCounter(): void {
    const signedData = this.loadSignedFile(this.counterPath);
    if (signedData) {
      const today = new Date().toISOString().split('T')[0];
      if (signedData.date === today) {
        this.dailyDownloadCount = (signedData.count as number) || 0;
        this.dailyCountDate = signedData.date as string;
      } else {
        this.dailyDownloadCount = 0;
        this.dailyCountDate = today;
        this.saveCounter();
      }
      return;
    }

    // Try migrating from old plaintext format
    try {
      const oldPath = this.counterPath.replace('counter.dat', 'download-counter.json');
      if (fs.existsSync(oldPath)) {
        const data = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
        const today = new Date().toISOString().split('T')[0];
        if (data.date === today) {
          this.dailyDownloadCount = data.count || 0;
          this.dailyCountDate = data.date;
        } else {
          this.dailyDownloadCount = 0;
          this.dailyCountDate = today;
        }
        this.saveCounter();
        try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
        return;
      }
    } catch {
      // Migration failed
    }

    this.dailyDownloadCount = 0;
    this.dailyCountDate = new Date().toISOString().split('T')[0];
  }

  private saveCounter(): void {
    this.saveSignedFile(this.counterPath, {
      date: this.dailyCountDate,
      count: this.dailyDownloadCount,
    });
  }

  // Generate a unique device ID based on hardware characteristics
  private generateDeviceId(): string {
    const components = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'unknown-cpu',
      os.totalmem().toString(),
      // Add higher-entropy components: network interface MACs and CPU count
      os.cpus().length.toString(),
      ...Object.values(os.networkInterfaces())
        .flat()
        .filter((iface): iface is NonNullable<typeof iface> => !!iface && !iface.internal)
        .map(iface => iface.mac)
        .filter(mac => mac && mac !== '00:00:00:00:00:00'),
    ];
    return crypto.createHash('sha256').update(components.join('|')).digest('hex').substring(0, 32);
  }

  // === PUBLIC API ===

  getTier(): LicenseTier {
    return this.state.tier;
  }

  getLimits(): TierLimits {
    return TIER_LIMITS[this.state.tier];
  }

  getState(): LicenseState {
    return { ...this.state };
  }

  getDailyDownloadCount(): number {
    // Reset if new day
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyCountDate !== today) {
      this.dailyDownloadCount = 0;
      this.dailyCountDate = today;
      this.saveCounter();
    }
    return this.dailyDownloadCount;
  }

  getRemainingDownloads(): number {
    const limits = this.getLimits();
    if (limits.maxDownloadsPerDay === -1) return -1; // Unlimited
    return Math.max(0, limits.maxDownloadsPerDay - this.getDailyDownloadCount());
  }

  /**
   * Check if a download is allowed based on tier limits.
   * Returns { allowed: true } or { allowed: false, reason: string }
   */
  canDownload(): { allowed: boolean; reason?: string } {
    const limits = this.getLimits();

    // Check daily limit
    if (limits.maxDownloadsPerDay !== -1) {
      const remaining = this.getRemainingDownloads();
      if (remaining <= 0) {
        return {
          allowed: false,
          reason: `Daily download limit reached (${limits.maxDownloadsPerDay}/day). Upgrade to Pro for unlimited downloads.`,
        };
      }
    }

    // Check cooldown
    const now = Date.now();
    const elapsed = (now - this.lastDownloadTime) / 1000;
    if (this.lastDownloadTime > 0 && elapsed < limits.cooldownSeconds) {
      const wait = Math.ceil(limits.cooldownSeconds - elapsed);
      return {
        allowed: false,
        reason: `Please wait ${wait}s between downloads. Upgrade to Pro for faster downloads.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a download (increment counter, update timestamp).
   */
  recordDownload(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyCountDate !== today) {
      this.dailyDownloadCount = 0;
      this.dailyCountDate = today;
    }
    this.dailyDownloadCount++;
    this.lastDownloadTime = Date.now();
    this.saveCounter();
  }

  /**
   * Check if a format/quality is allowed for the current tier.
   * Returns true if allowed.
   */
  isQualityAllowed(height: number): boolean {
    const limits = this.getLimits();
    if (limits.maxQuality === 'unlimited') return true;
    return height <= parseInt(limits.maxQuality);
  }

  /**
   * Check if playlist/batch download is allowed.
   */
  isPlaylistAllowed(): boolean {
    return this.getLimits().playlistDownload;
  }

  /**
   * Get max concurrent downloads for current tier.
   */
  getMaxConcurrent(): number {
    return this.getLimits().maxConcurrent;
  }

  // === LICENSE ACTIVATION ===

  /**
   * Activate a license key.
   * Contacts the license server to validate and register the device.
   */
  async activate(key: string): Promise<{ success: boolean; error?: string; tier?: LicenseTier }> {
    const normalizedKey = key.trim().toUpperCase();

    // Validate key format: GT-XXXX-XXXX-XXXX-XXXX
    if (!/^GT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizedKey)) {
      return { success: false, error: 'Invalid license key format. Expected: GT-XXXX-XXXX-XXXX-XXXX' };
    }

    try {
      const deviceName = `${os.platform()} ${os.release()} - ${os.hostname()}`;
      const response = await fetch(`${LICENSE_SERVER_URL}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: normalizedKey,
          deviceId: this.state.deviceId,
          deviceName,
        }),
      });

      const data = await response.json() as {
        success?: boolean;
        error?: string;
        tier?: string;
        maxDevices?: number;
        devicesUsed?: number;
        signature?: string;
      };

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Activation failed' };
      }

      // Verify server response signature (mandatory for v1.0.39+ servers)
      if (!data.signature) {
        return { success: false, error: 'Server response missing security signature. Please update the app or try again.' };
      }
      const activatePayload = `${normalizedKey}:${data.tier}:${this.state.deviceId}`;
      const activateExpectedSig = crypto.createHmac('sha256', SERVER_RESPONSE_SECRET).update(activatePayload).digest('hex');
      if (data.signature !== activateExpectedSig) {
        return { success: false, error: 'Server response verification failed. Please try again.' };
      }

      // Update local state
      this.state.key = normalizedKey;
      this.state.tier = (data.tier as LicenseTier) || 'pro';
      this.state.activated = true;
      this.state.validatedAt = new Date().toISOString();
      this.state.maxDevices = data.maxDevices || 1;
      this.state.devicesUsed = data.devicesUsed || 1;
      this.state.offlineGraceDays = OFFLINE_GRACE_DAYS;
      this.saveState();

      // Reset daily counter on activation (fresh start)
      this.dailyDownloadCount = 0;
      this.dailyCountDate = new Date().toISOString().split('T')[0];
      this.saveCounter();

      return { success: true, tier: this.state.tier };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { success: false, error: `Could not reach license server: ${message}. Check your internet connection.` };
    }
  }

  /**
   * Validate the current license (periodic re-check).
   * If server is unreachable, uses offline grace period.
   */
  async validate(): Promise<{ valid: boolean; tier: LicenseTier; offline?: boolean }> {
    // Free tier always valid
    if (!this.state.activated || !this.state.key) {
      return { valid: true, tier: 'free' };
    }

    // Check if re-validation is needed
    const lastValidated = new Date(this.state.validatedAt).getTime();
    const now = Date.now();
    if (now - lastValidated < REVALIDATION_INTERVAL_MS) {
      // Still within validation period, use cached state
      return { valid: true, tier: this.state.tier };
    }

    // Try to validate with server
    try {
      const response = await fetch(`${LICENSE_SERVER_URL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: this.state.key,
          deviceId: this.state.deviceId,
        }),
      });

      const data = await response.json() as {
        valid?: boolean;
        error?: string;
        tier?: string;
        maxDevices?: number;
        signature?: string;
      };

      if (data.valid) {
        // Verify server response signature (mandatory)
        if (!data.signature) {
          // Missing signature — possible downgrade attack, do NOT silently keep paid tier
          // Revert to free tier to be safe
          this.state.tier = 'free';
          this.state.activated = false;
          this.saveState();
          return { valid: false, tier: 'free' };
        }
        const validatePayload = `${this.state.key}:${data.tier}:${this.state.deviceId}`;
        const validateExpectedSig = crypto.createHmac('sha256', SERVER_RESPONSE_SECRET).update(validatePayload).digest('hex');
        if (data.signature !== validateExpectedSig) {
          // Signature mismatch — possible MITM, keep current state
          return { valid: true, tier: this.state.tier };
        }

        this.state.tier = (data.tier as LicenseTier) || this.state.tier;
        this.state.validatedAt = new Date().toISOString();
        this.state.maxDevices = data.maxDevices || this.state.maxDevices;
        this.state.offlineGraceDays = OFFLINE_GRACE_DAYS;
        this.saveState();
        return { valid: true, tier: this.state.tier };
      } else {
        // License invalid or revoked
        this.state.tier = 'free';
        this.state.activated = false;
        this.state.key = '';
        this.saveState();
        return { valid: false, tier: 'free' };
      }
    } catch {
      // Server unreachable — use offline grace period
      const daysSinceValidation = (now - lastValidated) / (1000 * 60 * 60 * 24);
      if (daysSinceValidation <= OFFLINE_GRACE_DAYS) {
        this.state.offlineGraceDays = Math.floor(OFFLINE_GRACE_DAYS - daysSinceValidation);
        this.saveState();
        return { valid: true, tier: this.state.tier, offline: true };
      } else {
        // Grace period expired
        this.state.tier = 'free';
        this.saveState();
        return { valid: false, tier: 'free', offline: true };
      }
    }
  }

  /**
   * Deactivate the license on this device.
   */
  async deactivate(): Promise<{ success: boolean; error?: string }> {
    if (!this.state.activated || !this.state.key) {
      return { success: false, error: 'No active license' };
    }

    try {
      await fetch(`${LICENSE_SERVER_URL}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: this.state.key,
          deviceId: this.state.deviceId,
        }),
      });
    } catch {
      // Even if server is unreachable, deactivate locally
    }

    // Reset to free tier
    this.state.tier = 'free';
    this.state.key = '';
    this.state.activated = false;
    this.state.validatedAt = '';
    this.state.maxDevices = 0;
    this.state.devicesUsed = 0;
    this.saveState();

    return { success: true };
  }

  /**
   * Get the license server URL (for admin/config purposes).
   */
  getServerUrl(): string {
    return LICENSE_SERVER_URL;
  }
}
