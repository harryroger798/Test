/**
 * GrabTube License Server — Cloudflare Worker + D1
 *
 * Endpoints:
 *   POST /activate       — Activate a license key on a device
 *   POST /validate       — Validate a license key + device combo
 *   POST /deactivate     — Deactivate a device from a license key
 *   POST /admin/login    — Admin login (returns session token)
 *   POST /admin/generate — Generate new license keys (requires admin token)
 *   GET  /admin/keys     — List all license keys (requires admin token)
 *   POST /admin/revoke   — Revoke a license key (requires admin token)
 *   GET  /admin/stats    — Dashboard stats (requires admin token)
 *   GET  /admin           — Hidden admin panel web UI (login required)
 *   GET  /health         — Health check
 *
 * Security (v1.0.39):
 *   - crypto.getRandomValues() for key & token generation (replaces Math.random())
 *   - Rate limiting on all public endpoints (IP-based, stored in D1)
 *   - Brute-force protection on admin login (5 attempts/15min)
 *   - HMAC-signed server responses (prevents client-side spoofing)
 *   - Locked CORS to specific origins
 *   - Timing-safe admin credential comparison
 */

export interface Env {
  DB: D1Database;
  ADMIN_EMAIL: string;    // Set via wrangler secret
  ADMIN_PASSWORD: string; // Set via wrangler secret
  MAILGUN_API_KEY: string; // Set via wrangler secret
  GIVEAWAY_KEY: string;    // Set via wrangler secret (e.g. GT-GIFT-FREE-2026-GRAB)
}

// Shared secret for signing server responses (must match client)
const SERVER_RESPONSE_SECRET = 'gt-server-response-v1';

// Rate limit: max requests per IP per window
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SEC = 60;

// Admin brute-force protection
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_SEC = 900; // 15 minutes

// Giveaway constants
const GIVEAWAY_MAX_REDEMPTIONS = 20000;
const GIVEAWAY_NOTIFICATION_EMAIL = 'harryroger798@gmail.com';
const GIVEAWAY_EXPIRY_MONTHS = 6; // Giveaway activations expire after 6 months (SharewareOnSale partnership)
const GIVEAWAY_MAX_IP_REDEMPTIONS = 5; // Max redemptions per IP address (abuse prevention)

// Fix #1: Safe addMonths that clamps to end of month (avoids Jan 31 + 3 = May 1 bug)
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== dayOfMonth) {
    result.setDate(0); // Clamp to last day of target month
  }
  return result;
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://www.grabtube.org',
  'https://grabtube.org',
  'app://.',  // Electron app
];

// Build CORS headers based on request origin
function getCorsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers?.get('Origin') || '';
  // Allow Electron app requests (no origin or app:// protocol)
  const isElectron = !origin || origin.startsWith('app://');
  const isAllowed = isElectron || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

// Request-aware response helpers (set per-request for proper CORS)
let currentRequest: Request | undefined;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(currentRequest) },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

// HMAC sign a response payload
async function signResponse(key: string, tier: string, deviceId: string): Promise<string> {
  const encoder = new TextEncoder();
  const payload = `${key}:${tier}:${deviceId}`;
  const keyData = encoder.encode(SERVER_RESPONSE_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Timing-safe string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// Get client IP for rate limiting
function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
}

// Hash IP for privacy-friendly storage
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '-gt-salt-v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Check rate limit (returns true if allowed)
async function checkRateLimit(env: Env, ipHash: string, maxRequests: number, windowSec: number): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - windowSec * 1000).toISOString();
    const result = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM rate_limits WHERE ip_hash = ? AND endpoint = "public" AND created_at > ?'
    ).bind(ipHash, windowStart).first() as { count: number } | null;
    const count = result?.count || 0;
    if (count >= maxRequests) return false;
    // Record this request
    await env.DB.prepare(
      'INSERT INTO rate_limits (ip_hash, endpoint, created_at) VALUES (?, "public", datetime("now"))'
    ).bind(ipHash).run();
    // Cleanup old entries periodically (1 in 50 chance)
    if (Math.random() < 0.02) {
      await env.DB.prepare('DELETE FROM rate_limits WHERE created_at < datetime("now", "-1 hour")').run();
    }
    return true;
  } catch {
    // If rate limiting fails, allow the request (don't break functionality)
    return true;
  }
}

// Check admin login brute-force protection
async function checkAdminRateLimit(env: Env, ipHash: string): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - ADMIN_LOGIN_WINDOW_SEC * 1000).toISOString();
    const result = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM rate_limits WHERE ip_hash = ? AND endpoint = "admin_login" AND created_at > ?'
    ).bind(ipHash, windowStart).first() as { count: number } | null;
    return (result?.count || 0) < ADMIN_LOGIN_MAX_ATTEMPTS;
  } catch {
    return true;
  }
}

async function recordAdminLoginAttempt(env: Env, ipHash: string): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO rate_limits (ip_hash, endpoint, created_at) VALUES (?, "admin_login", datetime("now"))'
    ).bind(ipHash).run();
  } catch { /* ignore */ }
}

// Rejection sampling: pick a random char with uniform distribution (no modulo bias)
function secureRandomChar(chars: string): string {
  const maxValid = 256 - (256 % chars.length); // Largest multiple of chars.length that fits in a byte
  const buf = new Uint8Array(1);
  // Reject values that would cause modulo bias
  // eslint-disable-next-line no-constant-condition
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < maxValid) {
      return chars[buf[0] % chars.length];
    }
  }
}

// Generate a license key using crypto.getRandomValues() with rejection sampling: GT-XXXX-XXXX-XXXX-XXXX
function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += secureRandomChar(chars);
    }
    segments.push(seg);
  }
  return `GT-${segments.join('-')}`;
}

// Generate a cryptographically secure session token with rejection sampling
function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += secureRandomChar(chars);
  }
  return token;
}

// Verify admin token from Authorization header
async function verifyAdmin(request: Request, env: Env): Promise<boolean> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);

  const session = await env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime("now")'
  ).bind(token).first();

  return !!session;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Set current request for CORS headers
    currentRequest = request;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok', service: 'grabtube-license', timestamp: new Date().toISOString() });
      }

      // === PUBLIC ENDPOINTS (for GrabTube app) ===
      // Rate limit all public endpoints
      if (['/activate', '/validate', '/deactivate'].includes(path) && request.method === 'POST') {
        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);
        const allowed = await checkRateLimit(env, ipHash, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC);
        if (!allowed) {
          return errorResponse('Too many requests. Please try again later.', 429);
        }
      }

      if (path === '/activate' && request.method === 'POST') {
        return await handleActivate(request, env);
      }

      if (path === '/validate' && request.method === 'POST') {
        return await handleValidate(request, env);
      }

      if (path === '/deactivate' && request.method === 'POST') {
        return await handleDeactivate(request, env);
      }

      // === ADMIN ENDPOINTS ===

      if (path === '/admin/login' && request.method === 'POST') {
        return await handleAdminLogin(request, env);
      }

      if (path === '/admin/generate' && request.method === 'POST') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminGenerate(request, env);
      }

      if (path === '/admin/keys' && request.method === 'GET') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminListKeys(request, env);
      }

      if (path === '/admin/revoke' && request.method === 'POST') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminRevoke(request, env);
      }

      if (path === '/admin/stats' && request.method === 'GET') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminStats(env);
      }

      if (path === '/admin/devices' && request.method === 'GET') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminDevices(request, env);
      }

      if (path === '/admin/devices/kick' && request.method === 'POST') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminKickDevice(request, env);
      }

      // Bulk generate giveaway keys (for SharewareOnSale CSV export)
      if (path === '/admin/generate-bulk' && request.method === 'POST') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminGenerateBulk(request, env);
      }

      // === GIVEAWAY ENDPOINTS ===

      // Hidden giveaway page
      if ((path === '/gift' || path === '/gift/') && request.method === 'GET') {
        return new Response(getGiveawayPageHTML(), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': 'noindex, nofollow',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            ...getCorsHeaders(request),
          },
        });
      }

      // Giveaway redemption API
      if (path === '/giveaway/redeem' && request.method === 'POST') {
        const clientIP = getClientIP(request);
        const ipHash = await hashIP(clientIP);
        const allowed = await checkRateLimit(env, ipHash, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC);
        if (!allowed) {
          return errorResponse('Too many requests. Please try again later.', 429);
        }
        return await handleGiveawayRedeem(request, env);
      }

      // Admin: view giveaway redemptions
      if (path === '/admin/giveaway' && request.method === 'GET') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminGiveawayList(env);
      }

      // === HIDDEN ADMIN PANEL WEB UI ===
      // Admin panel requires authentication via query token or session cookie
      if ((path === '/admin' || path === '/admin/') && request.method === 'GET') {
        // Allow access only if a valid token is provided as query param
        // The admin panel JS will handle login and API auth separately
        return new Response(getAdminPanelHTML(), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': 'noindex, nofollow',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            ...getCorsHeaders(request),
          },
        });
      }

      return errorResponse('Not found', 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('Worker error:', message);
      return errorResponse(message, 500);
    }
  },
};

// === HANDLER IMPLEMENTATIONS ===

async function handleActivate(request: Request, env: Env): Promise<Response> {
  let body: { key?: string; deviceId?: string; deviceName?: string };
  try {
    body = await request.json() as { key?: string; deviceId?: string; deviceName?: string };
  } catch {
    return errorResponse('Invalid request body', 400);
  }
  const { key, deviceId, deviceName } = body;

  if (!key || !deviceId) {
    return errorResponse('Missing required fields: key, deviceId');
  }

  // Look up the license key
  const license = await env.DB.prepare(
    'SELECT * FROM license_keys WHERE key = ?'
  ).bind(key).first() as { tier: string; max_devices: number; revoked: number } | null;

  if (!license) {
    return errorResponse('Invalid license key');
  }

  if (license.revoked) {
    return errorResponse('This license key has been revoked');
  }

  // Check if this device is already activated (active = 1)
  const existing = await env.DB.prepare(
    'SELECT * FROM activations WHERE license_key = ? AND device_id = ? AND active = 1'
  ).bind(key, deviceId).first();

  // Check if this device was previously deactivated (active = 0) — for re-activation
  const deactivated = await env.DB.prepare(
    'SELECT * FROM activations WHERE license_key = ? AND device_id = ? AND active = 0'
  ).bind(key, deviceId).first();

  // Fix #4: Check license-level expiration (set at redemption time for giveaway keys)
  const licenseRow = license as { tier: string; max_devices: number; revoked: number; expires_at?: string };
  if (licenseRow.expires_at) {
    const expiresAt = new Date(licenseRow.expires_at);
    if (new Date() > expiresAt) {
      return errorResponse(
        'Your 3-month free Pro trial has expired. Please purchase a license to continue using Pro features.',
        403
      );
    }
  }

  if (existing) {
    // Already activated on this device — just update last_validated
    await env.DB.prepare(
      'UPDATE activations SET last_validated = datetime("now") WHERE license_key = ? AND device_id = ? AND active = 1'
    ).bind(key, deviceId).run();

    const signature = await signResponse(key, license.tier, deviceId);
    return jsonResponse({
      success: true,
      tier: license.tier,
      maxDevices: license.max_devices,
      message: 'Already activated on this device',
      expiresAt: licenseRow.expires_at || null,
      signature,
    });
  }

  // Check device count
  const activeCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM activations WHERE license_key = ? AND active = 1'
  ).bind(key).first() as { count: number };

  if (activeCount.count >= license.max_devices) {
    // Auto-swap: If the new device name shares the same hostname as an existing active device,
    // it's likely the same machine with a changed device fingerprint (e.g. after OS update,
    // network interface change on macOS, etc.). Auto-deactivate the old device and continue.
    if (deviceName) {
      // Extract hostname from device name format: "platform release - hostname"
      const newHostname = deviceName.split(' - ').pop()?.trim();
      if (newHostname) {
        const existingDevices = await env.DB.prepare(
          'SELECT device_id, device_name FROM activations WHERE license_key = ? AND active = 1'
        ).bind(key).all();

        for (const row of existingDevices.results || []) {
          const existingDevice = row as { device_id: string; device_name: string };
          const existingHostname = (existingDevice.device_name || '').split(' - ').pop()?.trim();
          if (existingHostname && existingHostname === newHostname && existingDevice.device_id !== deviceId) {
            // Same hostname, different device ID — auto-swap (kick old device, activate new one)
            await env.DB.prepare(
              'UPDATE activations SET active = 0 WHERE license_key = ? AND device_id = ?'
            ).bind(key, existingDevice.device_id).run();
            // Proceed to activation below (don't return error)
            break;
          }
        }

        // Re-check count after potential auto-swap
        const newCount = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM activations WHERE license_key = ? AND active = 1'
        ).bind(key).first() as { count: number };

        if (newCount.count >= license.max_devices) {
          return errorResponse(
            `Device limit reached (${newCount.count}/${license.max_devices}). Deactivate another device first.`
          );
        }
      } else {
        return errorResponse(
          `Device limit reached (${activeCount.count}/${license.max_devices}). Deactivate another device first.`
        );
      }
    } else {
      return errorResponse(
        `Device limit reached (${activeCount.count}/${license.max_devices}). Deactivate another device first.`
      );
    }
  }

  if (deactivated) {
    // Re-activate previously deactivated device (UPDATE instead of INSERT to avoid UNIQUE constraint)
    await env.DB.prepare(
      'UPDATE activations SET active = 1, device_name = ?, last_validated = datetime("now") WHERE license_key = ? AND device_id = ? AND active = 0'
    ).bind(deviceName || '', key, deviceId).run();
  } else {
    // New activation
    await env.DB.prepare(
      'INSERT INTO activations (license_key, device_id, device_name) VALUES (?, ?, ?)'
    ).bind(key, deviceId, deviceName || '').run();
  }

  const signature = await signResponse(key, license.tier, deviceId);
  return jsonResponse({
    success: true,
    tier: license.tier,
    maxDevices: license.max_devices,
    devicesUsed: activeCount.count + 1,
    message: licenseRow.expires_at
      ? `License activated successfully! Your free Pro trial expires on ${new Date(licenseRow.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`
      : 'License activated successfully',
    expiresAt: licenseRow.expires_at || null,
    signature,
  });
}

async function handleValidate(request: Request, env: Env): Promise<Response> {
  let body: { key?: string; deviceId?: string };
  try {
    body = await request.json() as { key?: string; deviceId?: string };
  } catch {
    return errorResponse('Invalid request body', 400);
  }
  const { key, deviceId } = body;

  if (!key || !deviceId) {
    return errorResponse('Missing required fields: key, deviceId');
  }

  // Look up the license
  const license = await env.DB.prepare(
    'SELECT * FROM license_keys WHERE key = ?'
  ).bind(key).first() as { tier: string; max_devices: number; revoked: number; expires_at?: string } | null;

  if (!license) {
    return jsonResponse({ valid: false, error: 'Invalid license key' });
  }

  if (license.revoked) {
    return jsonResponse({ valid: false, error: 'License key has been revoked' });
  }

  // Fix #4/#5: Check license-level expiration (ISO 8601 UTC, set at redemption for giveaway keys)
  if (license.expires_at) {
    const expiresAt = new Date(license.expires_at);
    if (new Date() > expiresAt) {
      // Auto-deactivate all activations for this expired license
      await env.DB.prepare(
        'UPDATE activations SET active = 0 WHERE license_key = ? AND active = 1'
      ).bind(key).run();
      return jsonResponse({
        valid: false,
        error: 'Your 3-month free Pro trial has expired. Please purchase a license to continue using Pro features.',
        expired: true,
      });
    }
  }

  // Check activation
  const activation = await env.DB.prepare(
    'SELECT * FROM activations WHERE license_key = ? AND device_id = ? AND active = 1'
  ).bind(key, deviceId).first();

  if (!activation) {
    return jsonResponse({ valid: false, error: 'Device not activated' });
  }

  // Fix #6: Add active = 1 filter to UPDATE
  await env.DB.prepare(
    'UPDATE activations SET last_validated = datetime("now") WHERE license_key = ? AND device_id = ? AND active = 1'
  ).bind(key, deviceId).run();

  const signature = await signResponse(key, license.tier, deviceId);
  return jsonResponse({
    valid: true,
    tier: license.tier,
    maxDevices: license.max_devices,
    expiresAt: license.expires_at || null,
    signature,
  });
}

async function handleDeactivate(request: Request, env: Env): Promise<Response> {
  let body: { key?: string; deviceId?: string };
  try {
    body = await request.json() as { key?: string; deviceId?: string };
  } catch {
    return errorResponse('Invalid request body', 400);
  }
  const { key, deviceId } = body;

  if (!key || !deviceId) {
    return errorResponse('Missing required fields: key, deviceId');
  }

  const result = await env.DB.prepare(
    'UPDATE activations SET active = 0 WHERE license_key = ? AND device_id = ? AND active = 1'
  ).bind(key, deviceId).run();

  if (result.meta.changes === 0) {
    return errorResponse('No active activation found for this key and device');
  }

  return jsonResponse({ success: true, message: 'Device deactivated successfully' });
}

async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  // Brute-force protection
  const clientIP = getClientIP(request);
  const ipHash = await hashIP(clientIP);
  const canAttempt = await checkAdminRateLimit(env, ipHash);
  if (!canAttempt) {
    return errorResponse('Too many login attempts. Please try again in 15 minutes.', 429);
  }

  const body = await request.json() as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return errorResponse('Missing email or password');
  }

  // Record attempt before checking (prevents timing leaks)
  await recordAdminLoginAttempt(env, ipHash);

  // Timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(email, env.ADMIN_EMAIL) || !timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    return errorResponse('Invalid credentials', 401);
  }

  // Generate session token (valid for 24 hours)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    'INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)'
  ).bind(token, expiresAt).run();

  // Clean up expired sessions
  await env.DB.prepare(
    'DELETE FROM admin_sessions WHERE expires_at < datetime("now")'
  ).run();

  return jsonResponse({ success: true, token, expiresAt });
}

async function handleAdminGenerate(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    tier?: string;
    count?: number;
    buyerName?: string;
    buyerContact?: string;
    notes?: string;
  };

  const tier = body.tier || 'pro';
  const count = Math.min(body.count || 1, 100); // Max 100 at a time
  const maxDevices = tier === 'family' ? 3 : 1;

  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const key = generateLicenseKey();
    await env.DB.prepare(
      'INSERT INTO license_keys (key, tier, max_devices, buyer_name, buyer_contact, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(key, tier, maxDevices, body.buyerName || '', body.buyerContact || '', body.notes || '').run();
    keys.push(key);
  }

  return jsonResponse({
    success: true,
    keys,
    tier,
    maxDevices,
    count: keys.length,
  });
}

async function handleAdminListKeys(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const filter = url.searchParams.get('filter') || 'all'; // all, active, revoked

  let whereClause = '';
  if (filter === 'active') whereClause = 'WHERE lk.revoked = 0';
  else if (filter === 'revoked') whereClause = 'WHERE lk.revoked = 1';

  const keys = await env.DB.prepare(`
    SELECT lk.*,
           (SELECT COUNT(*) FROM activations a WHERE a.license_key = lk.key AND a.active = 1) as active_devices
    FROM license_keys lk
    ${whereClause}
    ORDER BY lk.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM license_keys lk ${whereClause}`
  ).first() as { count: number };

  return jsonResponse({
    success: true,
    keys: keys.results,
    total: total.count,
    page,
    limit,
    totalPages: Math.ceil(total.count / limit),
  });
}

async function handleAdminRevoke(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { key?: string };
  const { key } = body;

  if (!key) {
    return errorResponse('Missing license key');
  }

  const result = await env.DB.prepare(
    'UPDATE license_keys SET revoked = 1 WHERE key = ?'
  ).bind(key).run();

  if (result.meta.changes === 0) {
    return errorResponse('License key not found');
  }

  // Deactivate all devices for this key
  await env.DB.prepare(
    'UPDATE activations SET active = 0 WHERE license_key = ?'
  ).bind(key).run();

  return jsonResponse({ success: true, message: 'License key revoked and all devices deactivated' });
}

// === ADMIN PANEL WEB UI ===
function getAdminPanelHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GrabTube Admin</title>
  <style>
    :root {
      --bg: #0a0f1a; --bg2: #111827; --bg3: #1f2937; --border: #374151;
      --text: #f9fafb; --muted: #9ca3af; --green: #22c55e; --green2: #16a34a;
      --red: #ef4444; --yellow: #eab308; --blue: #3b82f6; --purple: #a855f7;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
    .login-wrapper { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .login-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem; width: 100%; max-width: 400px; }
    .login-box h1 { color: var(--green); font-size: 1.5rem; margin-bottom: 0.25rem; }
    .login-box p { color: var(--muted); font-size: 0.875rem; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-group input, .form-group select { width: 100%; padding: 0.65rem 0.85rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
    .form-group input:focus, .form-group select:focus { border-color: var(--green); }
    .btn { padding: 0.65rem 1.25rem; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: var(--green); color: #000; }
    .btn-primary:hover { background: var(--green2); }
    .btn-danger { background: var(--red); color: #fff; }
    .btn-danger:hover { opacity: 0.85; }
    .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }
    .btn-full { width: 100%; }
    .error-msg { color: var(--red); font-size: 0.85rem; margin-top: 0.5rem; }
    .hidden { display: none !important; }

    /* Dashboard layout */
    .dashboard { display: flex; min-height: 100vh; }
    .sidebar { width: 220px; background: var(--bg2); border-right: 1px solid var(--border); padding: 1.25rem 0; flex-shrink: 0; }
    .sidebar-brand { padding: 0 1.25rem 1.25rem; border-bottom: 1px solid var(--border); margin-bottom: 0.75rem; }
    .sidebar-brand h2 { color: var(--green); font-size: 1.1rem; }
    .sidebar-brand span { color: var(--muted); font-size: 0.75rem; }
    .nav-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1.25rem; color: var(--muted); cursor: pointer; transition: all 0.15s; font-size: 0.9rem; border-left: 3px solid transparent; }
    .nav-item:hover { color: var(--text); background: var(--bg3); }
    .nav-item.active { color: var(--green); border-left-color: var(--green); background: rgba(34,197,94,0.05); }
    .nav-item svg { width: 18px; height: 18px; }
    .main-content { flex: 1; padding: 1.5rem 2rem; overflow-y: auto; }
    .page-title { font-size: 1.35rem; margin-bottom: 1.25rem; }

    /* Stats grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 1.15rem; }
    .stat-card .label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem; }
    .stat-card .value { font-size: 1.75rem; font-weight: 700; }
    .stat-card .value.green { color: var(--green); }
    .stat-card .value.blue { color: var(--blue); }
    .stat-card .value.purple { color: var(--purple); }
    .stat-card .value.red { color: var(--red); }
    .stat-card .value.yellow { color: var(--yellow); }

    /* Table */
    .table-container { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .table-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
    .table-header h3 { font-size: 1rem; }
    .filter-tabs { display: flex; gap: 0.35rem; }
    .filter-tab { padding: 0.3rem 0.7rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; transition: all 0.15s; }
    .filter-tab.active { background: var(--green); color: #000; border-color: var(--green); }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 0.7rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border-bottom: 1px solid var(--border); background: var(--bg3); }
    td { padding: 0.65rem 1rem; font-size: 0.875rem; border-bottom: 1px solid var(--border); }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .badge-pro { background: rgba(59,130,246,0.15); color: var(--blue); }
    .badge-family { background: rgba(168,85,247,0.15); color: var(--purple); }
    .badge-active { background: rgba(34,197,94,0.15); color: var(--green); }
    .badge-revoked { background: rgba(239,68,68,0.15); color: var(--red); }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 1rem; }
    .pagination button { padding: 0.35rem 0.75rem; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; font-size: 0.8rem; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 0.85rem; color: var(--muted); }

    /* Generate form */
    .generate-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; max-width: 500px; }
    .generate-card h3 { margin-bottom: 1rem; font-size: 1rem; }
    .generated-keys { margin-top: 1rem; background: var(--bg3); border-radius: 8px; padding: 1rem; }
    .generated-keys h4 { color: var(--green); font-size: 0.85rem; margin-bottom: 0.5rem; }
    .key-item { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.9rem; padding: 0.35rem 0; color: var(--text); display: flex; justify-content: space-between; align-items: center; }
    .key-item button { background: none; border: 1px solid var(--border); color: var(--muted); border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.7rem; cursor: pointer; }
    .key-item button:hover { color: var(--green); border-color: var(--green); }

    /* Toast */
    .toast { position: fixed; bottom: 1.5rem; right: 1.5rem; background: var(--bg2); border: 1px solid var(--green); border-radius: 10px; padding: 0.85rem 1.25rem; color: var(--green); font-size: 0.9rem; z-index: 999; animation: slideIn 0.3s ease; }
    .toast.error { border-color: var(--red); color: var(--red); }
    @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal-box { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; max-width: 420px; width: 90%; }
    .modal-box h3 { margin-bottom: 0.5rem; }
    .modal-box p { color: var(--muted); font-size: 0.875rem; margin-bottom: 1rem; }
    .modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

    /* Logout */
    .logout-btn { margin-top: auto; padding: 0.65rem 1.25rem; color: var(--red); cursor: pointer; font-size: 0.85rem; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 0.5rem; }
    .logout-btn:hover { background: rgba(239,68,68,0.08); }
    .sidebar { display: flex; flex-direction: column; }

    @media (max-width: 768px) {
      .sidebar { width: 60px; }
      .sidebar-brand span, .nav-item span, .logout-btn span { display: none; }
      .sidebar-brand h2 { font-size: 0.9rem; }
      .main-content { padding: 1rem; }
    }
  </style>
</head>
<body>

<!-- LOGIN SCREEN -->
<div id="login-screen" class="login-wrapper">
  <div class="login-box">
    <h1>GrabTube Admin</h1>
    <p>License management dashboard</p>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="login-email" placeholder="admin@grabtube.org" autocomplete="email">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="login-password" placeholder="Enter password" autocomplete="current-password">
    </div>
    <div id="login-error" class="error-msg hidden"></div>
    <button class="btn btn-primary btn-full" style="margin-top:0.75rem" onclick="doLogin()">Sign In</button>
  </div>
</div>

<!-- DASHBOARD -->
<div id="dashboard" class="dashboard hidden">
  <div class="sidebar">
    <div class="sidebar-brand">
      <h2>GrabTube</h2>
      <span>Admin Panel</span>
    </div>
    <div class="nav-item active" data-page="overview" onclick="switchPage('overview')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <span>Overview</span>
    </div>
    <div class="nav-item" data-page="keys" onclick="switchPage('keys')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
      <span>License Keys</span>
    </div>
    <div class="nav-item" data-page="generate" onclick="switchPage('generate')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Generate Keys</span>
    </div>
    <div class="nav-item" data-page="devices" onclick="switchPage('devices')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <span>Devices</span>
    </div>
    <div class="nav-item" data-page="giveaway" onclick="switchPage('giveaway')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
      <span>Giveaway Leads</span>
    </div>
    <div class="nav-item" data-page="mac-instructions" onclick="switchPage('mac-instructions')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z"/></svg>
      <span>Mac Guide</span>
    </div>
    <div class="logout-btn" onclick="doLogout()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      <span>Logout</span>
    </div>
  </div>

  <div class="main-content">
    <!-- OVERVIEW PAGE -->
    <div id="page-overview">
      <h2 class="page-title">Dashboard Overview</h2>
      <div class="stats-grid" id="stats-grid"></div>
      <div class="table-container" style="margin-top:1rem">
        <div class="table-header"><h3>Recent Keys</h3></div>
        <table>
          <thead><tr><th>Key</th><th>Tier</th><th>Status</th><th>Devices</th><th>Created</th></tr></thead>
          <tbody id="recent-keys-body"></tbody>
        </table>
      </div>
    </div>

    <!-- KEYS PAGE -->
    <div id="page-keys" class="hidden">
      <h2 class="page-title">License Keys</h2>
      <div class="table-container">
        <div class="table-header">
          <h3>All Keys</h3>
          <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all" onclick="setFilter('all')">All</button>
            <button class="filter-tab" data-filter="active" onclick="setFilter('active')">Active</button>
            <button class="filter-tab" data-filter="revoked" onclick="setFilter('revoked')">Revoked</button>
          </div>
        </div>
        <table>
          <thead><tr><th>Key</th><th>Tier</th><th>Status</th><th>Devices</th><th>Buyer</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody id="keys-body"></tbody>
        </table>
        <div class="pagination" id="pagination"></div>
      </div>
    </div>

    <!-- DEVICES PAGE -->
    <div id="page-devices" class="hidden">
      <h2 class="page-title">Device Tracking</h2>
      <div id="device-key-search" style="margin-bottom:1rem;display:flex;gap:0.5rem;align-items:center">
        <input type="text" id="device-key-input" placeholder="Enter license key to view devices (or leave empty for all)" style="flex:1;padding:0.65rem 0.85rem;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:monospace;outline:none">
        <button class="btn btn-primary" onclick="loadDevices()">Search</button>
      </div>
      <div id="device-key-info" class="hidden" style="margin-bottom:1rem"></div>
      <div class="table-container">
        <div class="table-header"><h3 id="devices-title">All Recent Activations</h3></div>
        <table>
          <thead><tr><th>Device ID</th><th>Device Name</th><th>License Key</th><th>Tier</th><th>Status</th><th>Activated</th><th>Last Seen</th><th>Actions</th></tr></thead>
          <tbody id="devices-body"></tbody>
        </table>
      </div>
    </div>

    <!-- MAC INSTRUCTIONS PAGE -->
    <div id="page-mac-instructions" class="hidden">
      <h2 class="page-title">macOS Installation Guide</h2>
      <p style="color:var(--muted);margin-bottom:1rem">Copy and share these instructions with buyers who need help installing on macOS (unsigned app).</p>
      <div class="generate-card" style="max-width:700px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <h3 style="margin:0">Installation Instructions</h3>
          <button class="btn btn-primary btn-sm" onclick="copyMacInstructions()">Copy to Clipboard</button>
        </div>
        <div id="mac-instructions-text" style="background:var(--bg3);border-radius:8px;padding:1.25rem;font-size:0.9rem;line-height:1.7;color:var(--text);white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
How to Install GrabTube on macOS (No Certificate)

Method 1: Right-Click > Open (Easiest)
1. Download GrabTube .dmg from grabtube.org
2. Right-click (or Control+click) the .dmg file > select "Open"
3. Click "Open" in the warning dialog
4. Drag GrabTube to Applications folder
5. Go to Applications, Right-click GrabTube.app > "Open" > click "Open" again
6. Done! App will open normally from now on.

Method 2: System Settings (if Method 1 fails)
1. Double-click the .dmg (it will be blocked)
2. Go to Apple Menu > System Settings > Privacy &amp; Security
3. Scroll to Security section > find "GrabTube was blocked..."
4. Click "Open Anyway" > enter admin password
5. Done!

Method 3: Terminal (Power Users)
Open Terminal app and run these commands:

xattr -cr ~/Downloads/GrabTube-*.dmg
open ~/Downloads/GrabTube-*.dmg

After copying to Applications:
xattr -cr /Applications/GrabTube.app

That's it! The app will work normally after the first launch.</div>
      </div>
    </div>

    <!-- GIVEAWAY LEADS PAGE -->
    <div id="page-giveaway" class="hidden">
      <h2 class="page-title">Giveaway Leads</h2>
      <div class="stats-grid" id="giveaway-stats-grid" style="margin-bottom:1rem"></div>
      <div class="table-container">
        <div class="table-header">
          <h3 id="giveaway-title">All Giveaway Redemptions</h3>
          <button class="btn btn-primary btn-sm" onclick="exportGiveawayCSV()">Export CSV</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>License Key</th><th>Redeemed At</th><th>IP Hash</th></tr></thead>
          <tbody id="giveaway-body"></tbody>
        </table>
      </div>
    </div>

    <!-- GENERATE PAGE -->
    <div id="page-generate" class="hidden">
      <h2 class="page-title">Generate License Keys</h2>
      <div class="generate-card">
        <h3>New License Keys</h3>
        <div class="form-group">
          <label>Tier</label>
          <select id="gen-tier">
            <option value="pro">Pro ($14.99)</option>
            <option value="family">Family ($29.99)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Count</label>
          <input type="number" id="gen-count" value="1" min="1" max="100" placeholder="1-100">
        </div>
        <div class="form-group">
          <label>Buyer Name (optional)</label>
          <input type="text" id="gen-buyer" placeholder="Customer name">
        </div>
        <div class="form-group">
          <label>Contact (optional)</label>
          <input type="text" id="gen-contact" placeholder="Phone / email">
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <input type="text" id="gen-notes" placeholder="Any notes">
        </div>
        <button class="btn btn-primary" onclick="doGenerate()">Generate</button>
        <div id="generated-result" class="hidden"></div>
      </div>
    </div>
  </div>
</div>

<!-- REVOKE MODAL -->
<div id="revoke-modal" class="modal-overlay hidden">
  <div class="modal-box">
    <h3>Revoke License Key</h3>
    <p>Are you sure you want to revoke <strong id="revoke-key-display"></strong>? This will deactivate all devices and cannot be undone.</p>
    <div class="modal-actions">
      <button class="btn btn-sm" style="background:var(--bg3);color:var(--text)" onclick="closeRevokeModal()">Cancel</button>
      <button class="btn btn-sm btn-danger" onclick="confirmRevoke()">Revoke</button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div id="toast" class="toast hidden"></div>

<script>
const API = window.location.origin;
let token = localStorage.getItem('gt_admin_token') || '';
let currentPage = 'overview';
let currentFilter = 'all';
let currentKeyPage = 1;
let revokeTarget = '';

// Auto-login if token exists
if (token) { checkToken(); } else { showLogin(); }

async function checkToken() {
  try {
    const r = await apiFetch('/admin/stats');
    if (r.success) { showDashboard(); loadOverview(); }
    else { token = ''; localStorage.removeItem('gt_admin_token'); showLogin(); }
  } catch { token = ''; localStorage.removeItem('gt_admin_token'); showLogin(); }
}

function showLogin() { document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('dashboard').classList.add('hidden'); }
function showDashboard() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('dashboard').classList.remove('hidden'); }

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!email || !password) { errEl.textContent = 'Enter email and password'; errEl.classList.remove('hidden'); return; }
  try {
    const r = await fetch(API + '/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (d.success && d.token) { token = d.token; localStorage.setItem('gt_admin_token', token); showDashboard(); loadOverview(); }
    else { errEl.textContent = d.error || 'Login failed'; errEl.classList.remove('hidden'); }
  } catch (e) { errEl.textContent = 'Network error'; errEl.classList.remove('hidden'); }
}

function doLogout() { token = ''; localStorage.removeItem('gt_admin_token'); showLogin(); }

async function apiFetch(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return r.json();
}

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');
  if (page === 'overview') loadOverview();
  else if (page === 'keys') loadKeys();
  else if (page === 'devices') loadDevices();
  else if (page === 'giveaway') loadGiveaway();
}

function copyMacInstructions() {
  const el = document.getElementById('mac-instructions-text');
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
  }).catch(() => {
    // Fallback: select text
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    showToast('Text selected - press Ctrl+C / Cmd+C to copy');
  });
}

// OVERVIEW
async function loadOverview() {
  try {
    const d = await apiFetch('/admin/stats');
    if (!d.success) return;
    const s = d.stats;
    document.getElementById('stats-grid').innerHTML = \`
      <div class="stat-card"><div class="label">Total Keys</div><div class="value green">\${s.totalKeys}</div></div>
      <div class="stat-card"><div class="label">Active Keys</div><div class="value blue">\${s.activeKeys}</div></div>
      <div class="stat-card"><div class="label">Revoked</div><div class="value red">\${s.revokedKeys}</div></div>
      <div class="stat-card"><div class="label">Active Devices</div><div class="value purple">\${s.totalActivations}</div></div>
      <div class="stat-card"><div class="label">Pro Keys</div><div class="value blue">\${s.proKeys}</div></div>
      <div class="stat-card"><div class="label">Family Keys</div><div class="value purple">\${s.familyKeys}</div></div>
      <div class="stat-card"><div class="label">Recent (7d)</div><div class="value yellow">\${s.recentActivations}</div></div>
      <div class="stat-card"><div class="label">Giveaway Claims</div><div class="value yellow">\${s.giveawayRedemptions}</div></div>
    \`;
    // Load recent keys
    const k = await apiFetch('/admin/keys?page=1&limit=5&filter=all');
    if (k.success) {
      document.getElementById('recent-keys-body').innerHTML = k.keys.map(renderKeyRowShort).join('');
    }
  } catch (e) { showToast('Failed to load stats', true); }
}

function renderKeyRowShort(k) {
  const tier = k.tier === 'pro' ? '<span class="badge badge-pro">PRO</span>' : '<span class="badge badge-family">FAMILY</span>';
  const status = k.revoked ? '<span class="badge badge-revoked">Revoked</span>' : '<span class="badge badge-active">Active</span>';
  const date = k.created_at ? new Date(k.created_at + 'Z').toLocaleDateString() : '-';
  return \`<tr><td style="font-family:monospace;font-size:0.8rem">\${k.key}</td><td>\${tier}</td><td>\${status}</td><td>\${k.active_devices || 0}/\${k.max_devices}</td><td>\${date}</td></tr>\`;
}

// KEYS
async function loadKeys() {
  try {
    const d = await apiFetch(\`/admin/keys?page=\${currentKeyPage}&limit=20&filter=\${currentFilter}\`);
    if (!d.success) return;
    document.getElementById('keys-body').innerHTML = d.keys.map(renderKeyRowFull).join('');
    const pag = document.getElementById('pagination');
    pag.innerHTML = \`
      <button \${d.page <= 1 ? 'disabled' : ''} onclick="goPage(\${d.page - 1})">Prev</button>
      <span>Page \${d.page} of \${d.totalPages || 1}</span>
      <button \${d.page >= (d.totalPages || 1) ? 'disabled' : ''} onclick="goPage(\${d.page + 1})">Next</button>
    \`;
  } catch (e) { showToast('Failed to load keys', true); }
}

function renderKeyRowFull(k) {
  const tier = k.tier === 'pro' ? '<span class="badge badge-pro">PRO</span>' : '<span class="badge badge-family">FAMILY</span>';
  const status = k.revoked ? '<span class="badge badge-revoked">Revoked</span>' : '<span class="badge badge-active">Active</span>';
  const date = k.created_at ? new Date(k.created_at + 'Z').toLocaleDateString() : '-';
  const buyer = k.buyer_name || '-';
  const devicesBtn = \`<button class="btn btn-sm" style="background:var(--bg3);color:var(--blue);border:1px solid var(--blue);margin-right:0.35rem" onclick="viewKeyDevices('\${k.key}')">Devices</button>\`;
  const revokeBtn = k.revoked ? '' : \`<button class="btn btn-sm btn-danger" onclick="openRevokeModal('\${k.key}')">Revoke</button>\`;
  const actions = devicesBtn + revokeBtn;
  return \`<tr><td style="font-family:monospace;font-size:0.8rem">\${k.key}</td><td>\${tier}</td><td>\${status}</td><td>\${k.active_devices || 0}/\${k.max_devices}</td><td>\${buyer}</td><td>\${date}</td><td>\${actions}</td></tr>\`;
}

function viewKeyDevices(key) {
  document.getElementById('device-key-input').value = key;
  switchPage('devices');
  loadDevices();
}

function setFilter(f) {
  currentFilter = f; currentKeyPage = 1;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === f));
  loadKeys();
}

function goPage(p) { currentKeyPage = p; loadKeys(); }

// GENERATE
async function doGenerate() {
  const tier = document.getElementById('gen-tier').value;
  const count = parseInt(document.getElementById('gen-count').value) || 1;
  const buyerName = document.getElementById('gen-buyer').value.trim();
  const buyerContact = document.getElementById('gen-contact').value.trim();
  const notes = document.getElementById('gen-notes').value.trim();
  try {
    const d = await apiFetch('/admin/generate', { method: 'POST', body: JSON.stringify({ tier, count, buyerName, buyerContact, notes }) });
    if (d.success) {
      const el = document.getElementById('generated-result');
      el.classList.remove('hidden');
      el.innerHTML = \`<div class="generated-keys"><h4>Generated \${d.keys.length} \${d.tier.toUpperCase()} key(s)</h4>\${d.keys.map(k => \`<div class="key-item"><span>\${k}</span><button onclick="copyKey('\${k}')">Copy</button></div>\`).join('')}</div>\`;
      showToast('Keys generated successfully');
    } else { showToast(d.error || 'Generation failed', true); }
  } catch (e) { showToast('Network error', true); }
}

function copyKey(k) { navigator.clipboard.writeText(k).then(() => showToast('Copied: ' + k)); }

// REVOKE
function openRevokeModal(key) { revokeTarget = key; document.getElementById('revoke-key-display').textContent = key; document.getElementById('revoke-modal').classList.remove('hidden'); }
function closeRevokeModal() { document.getElementById('revoke-modal').classList.add('hidden'); revokeTarget = ''; }
async function confirmRevoke() {
  if (!revokeTarget) return;
  try {
    const d = await apiFetch('/admin/revoke', { method: 'POST', body: JSON.stringify({ key: revokeTarget }) });
    if (d.success) { showToast('Key revoked: ' + revokeTarget); closeRevokeModal(); loadKeys(); }
    else { showToast(d.error || 'Revoke failed', true); }
  } catch (e) { showToast('Network error', true); }
}

// TOAST
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// DEVICES
async function loadDevices() {
  const keyInput = document.getElementById('device-key-input').value.trim();
  const infoEl = document.getElementById('device-key-info');
  const titleEl = document.getElementById('devices-title');
  try {
    const url = keyInput ? '/admin/devices?key=' + encodeURIComponent(keyInput) : '/admin/devices';
    const d = await apiFetch(url);
    if (!d.success) { showToast(d.error || 'Failed to load devices', true); return; }
    if (keyInput && d.license) {
      const l = d.license;
      const tierBadge = l.tier === 'pro' ? '<span class="badge badge-pro">PRO</span>' : '<span class="badge badge-family">FAMILY</span>';
      const statusBadge = l.revoked ? '<span class="badge badge-revoked">Revoked</span>' : '<span class="badge badge-active">Active</span>';
      infoEl.classList.remove('hidden');
      infoEl.innerHTML = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:1rem;display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center">' +
        '<div><span style="color:var(--muted);font-size:0.75rem;text-transform:uppercase">Key</span><div style="font-family:monospace;font-size:0.9rem">' + keyInput + '</div></div>' +
        '<div><span style="color:var(--muted);font-size:0.75rem;text-transform:uppercase">Tier</span><div>' + tierBadge + '</div></div>' +
        '<div><span style="color:var(--muted);font-size:0.75rem;text-transform:uppercase">Status</span><div>' + statusBadge + '</div></div>' +
        '<div><span style="color:var(--muted);font-size:0.75rem;text-transform:uppercase">Devices</span><div style="font-size:1.1rem;font-weight:700;color:var(--blue)">' + d.activeDevices + '/' + l.maxDevices + '</div></div>' +
        (l.buyerName ? '<div><span style="color:var(--muted);font-size:0.75rem;text-transform:uppercase">Buyer</span><div>' + l.buyerName + '</div></div>' : '') +
        (l.buyerContact ? '<div><span style="color:var(--muted);font-size:0.75rem;text-transform:uppercase">Contact</span><div>' + l.buyerContact + '</div></div>' : '') +
        '<div><span style="color:var(--muted);font-size:0.75rem;text-transform:uppercase">Created</span><div>' + (l.createdAt ? new Date(l.createdAt + 'Z').toLocaleDateString() : '-') + '</div></div>' +
        '</div>';
      titleEl.textContent = 'Devices for ' + keyInput;
      const devices = d.devices || [];
      document.getElementById('devices-body').innerHTML = devices.length === 0
        ? '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem">No devices activated for this key</td></tr>'
        : devices.map(dev => renderDeviceRow(dev, false)).join('');
    } else {
      infoEl.classList.add('hidden');
      titleEl.textContent = 'All Recent Activations';
      const devices = d.devices || [];
      document.getElementById('devices-body').innerHTML = devices.length === 0
        ? '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem">No device activations found</td></tr>'
        : devices.map(dev => renderDeviceRow(dev, true)).join('');
    }
  } catch (e) { showToast('Failed to load devices', true); }
}

function renderDeviceRow(dev, showKey) {
  const devId = (dev.device_id || '').substring(0, 12) + '...';
  const devName = dev.device_name || '-';
  const key = showKey ? '<span style="font-family:monospace;font-size:0.8rem">' + (dev.license_key || '-') + '</span>' : '-';
  const tier = dev.tier === 'pro' ? '<span class="badge badge-pro">PRO</span>' : dev.tier === 'family' ? '<span class="badge badge-family">FAMILY</span>' : '-';
  const active = dev.active === 1 ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-revoked">Inactive</span>';
  const activated = dev.activated_at ? new Date(dev.activated_at + 'Z').toLocaleDateString() : '-';
  const lastSeen = dev.last_validated ? new Date(dev.last_validated + 'Z').toLocaleDateString() : '-';
  const safeDeviceId = encodeURIComponent(dev.device_id || '');
  const safeLicenseKey = encodeURIComponent(dev.license_key || '');
  const kickBtn = dev.active === 1 ? '<button class="btn btn-sm btn-danger" style="margin-left:0.35rem" data-did="' + safeDeviceId + '" data-lk="' + safeLicenseKey + '" onclick="kickDevice(decodeURIComponent(this.dataset.did), decodeURIComponent(this.dataset.lk))" title="Deactivate this device">Kick</button>' : '';
  return '<tr><td title="' + (dev.device_id || '') + '" style="font-family:monospace;font-size:0.8rem;cursor:help">' + devId + '</td><td>' + devName + '</td><td>' + key + '</td><td>' + tier + '</td><td>' + active + '</td><td>' + activated + '</td><td>' + lastSeen + '</td><td>' + kickBtn + '</td></tr>';
}

async function kickDevice(deviceId, licenseKey) {
  if (!confirm('Deactivate this device? The user will need to re-activate.')) return;
  try {
    const d = await apiFetch('/admin/devices/kick', { method: 'POST', body: JSON.stringify({ deviceId, licenseKey }) });
    if (d.success) { showToast('Device deactivated'); loadDevices(); }
    else { showToast(d.error || 'Kick failed', true); }
  } catch (e) { showToast('Network error', true); }
}

// GIVEAWAY LEADS
let giveawayData = [];
async function loadGiveaway() {
  try {
    const d = await apiFetch('/admin/giveaway');
    if (!d.success) { showToast(d.error || 'Failed to load giveaway data', true); return; }
    giveawayData = d.redemptions || [];
    document.getElementById('giveaway-stats-grid').innerHTML =
      '<div class="stat-card"><div class="label">Total Claims</div><div class="value yellow">' + d.total + '</div></div>' +
      '<div class="stat-card"><div class="label">Remaining</div><div class="value green">' + d.remaining + '</div></div>' +
      '<div class="stat-card"><div class="label">Max Capacity</div><div class="value blue">' + d.maxRedemptions + '</div></div>';
    document.getElementById('giveaway-body').innerHTML = giveawayData.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No giveaway redemptions yet</td></tr>'
      : giveawayData.map(renderGiveawayRow).join('');
  } catch (e) { showToast('Failed to load giveaway data', true); }
}

function renderGiveawayRow(r) {
  const name = r.name || '-';
  const email = r.email || '-';
  const key = r.license_key || '-';
  const date = r.redeemed_at ? new Date(r.redeemed_at + 'Z').toLocaleString() : '-';
  const ip = r.ip_hash ? (r.ip_hash.substring(0, 10) + '...') : '-';
  return '<tr><td>' + name + '</td><td><a href="mailto:' + email + '" style="color:var(--blue);text-decoration:none">' + email + '</a></td><td style="font-family:monospace;font-size:0.8rem">' + key + '</td><td>' + date + '</td><td style="font-family:monospace;font-size:0.75rem;color:var(--muted)" title="' + (r.ip_hash || '') + '">' + ip + '</td></tr>';
}

function exportGiveawayCSV() {
  if (!giveawayData.length) { showToast('No data to export', true); return; }
  const headers = ['Name', 'Email', 'License Key', 'Redeemed At', 'IP Hash'];
  const rows = giveawayData.map(r => [r.name || '', r.email || '', r.license_key || '', r.redeemed_at || '', r.ip_hash || ''].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
  const csv = [headers.join(','), ...rows].join(String.fromCharCode(10));
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'giveaway-leads-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV exported');
}

// Enter key on login
document.getElementById('login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
document.getElementById('login-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('login-password').focus(); });
</script>
</body>
</html>`;
}

async function handleAdminDevices(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';

  if (key) {
    // Get devices for a specific key
    const devices = await env.DB.prepare(
      'SELECT * FROM activations WHERE license_key = ? ORDER BY activated_at DESC'
    ).bind(key).all();

    const license = await env.DB.prepare(
      'SELECT * FROM license_keys WHERE key = ?'
    ).bind(key).first() as { tier: string; max_devices: number; buyer_name: string; buyer_contact: string; notes: string; created_at: string; revoked: number } | null;

    return jsonResponse({
      success: true,
      key,
      license: license ? {
        tier: license.tier,
        maxDevices: license.max_devices,
        buyerName: license.buyer_name,
        buyerContact: license.buyer_contact,
        notes: license.notes,
        createdAt: license.created_at,
        revoked: !!license.revoked,
      } : null,
      devices: devices.results,
      totalDevices: devices.results.length,
      activeDevices: devices.results.filter((d: Record<string, unknown>) => d.active === 1).length,
    });
  }

  // Get all devices grouped summary
  const allDevices = await env.DB.prepare(
    `SELECT a.*, lk.tier, lk.max_devices, lk.buyer_name, lk.revoked as key_revoked
     FROM activations a
     JOIN license_keys lk ON a.license_key = lk.key
     ORDER BY a.activated_at DESC
     LIMIT 100`
  ).all();

  return jsonResponse({
    success: true,
    devices: allDevices.results,
    total: allDevices.results.length,
  });
}

async function handleAdminKickDevice(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { deviceId?: string; licenseKey?: string };
  const { deviceId, licenseKey } = body;

  if (!deviceId || !licenseKey) {
    return errorResponse('Missing deviceId or licenseKey');
  }

  const result = await env.DB.prepare(
    'UPDATE activations SET active = 0 WHERE device_id = ? AND license_key = ?'
  ).bind(deviceId, licenseKey).run();

  if (result.meta.changes === 0) {
    return errorResponse('Device activation not found');
  }

  return jsonResponse({ success: true, message: 'Device deactivated successfully' });
}

// Bulk generate giveaway license keys with expiry (for SharewareOnSale partnership)
async function handleAdminGenerateBulk(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    count?: number;
    tier?: string;
    expiryMonths?: number;
    notes?: string;
    batchSize?: number;
  };

  const count = Math.min(body.count || 100, 1000); // Max 1000 per request
  const tier = body.tier || 'pro';
  const expiryMonths = body.expiryMonths || 6;
  const maxDevices = tier === 'family' ? 3 : 1;
  const notes = body.notes || 'sharewareonsale-bulk';
  const expiresAt = addMonths(new Date(), expiryMonths).toISOString();

  const keys: string[] = [];
  const BATCH = body.batchSize || 50;

  for (let i = 0; i < count; i += BATCH) {
    const batchCount = Math.min(BATCH, count - i);
    const stmts = [];
    const batchKeys: string[] = [];
    for (let j = 0; j < batchCount; j++) {
      const key = generateLicenseKey();
      batchKeys.push(key);
      stmts.push(
        env.DB.prepare(
          'INSERT INTO license_keys (key, tier, max_devices, expires_at, buyer_name, buyer_contact, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(key, tier, maxDevices, expiresAt, 'SharewareOnSale', 'kent@sharewareonsale.com', notes)
      );
    }
    await env.DB.batch(stmts);
    keys.push(...batchKeys);
  }

  return jsonResponse({
    success: true,
    keys,
    tier,
    maxDevices,
    expiresAt,
    count: keys.length,
  });
}

async function handleAdminStats(env: Env): Promise<Response> {
  const totalKeys = await env.DB.prepare('SELECT COUNT(*) as count FROM license_keys').first() as { count: number };
  const activeKeys = await env.DB.prepare('SELECT COUNT(*) as count FROM license_keys WHERE revoked = 0').first() as { count: number };
  const revokedKeys = await env.DB.prepare('SELECT COUNT(*) as count FROM license_keys WHERE revoked = 1').first() as { count: number };
  const totalActivations = await env.DB.prepare('SELECT COUNT(*) as count FROM activations WHERE active = 1').first() as { count: number };
  const proKeys = await env.DB.prepare('SELECT COUNT(*) as count FROM license_keys WHERE tier = "pro" AND revoked = 0').first() as { count: number };
  const familyKeys = await env.DB.prepare('SELECT COUNT(*) as count FROM license_keys WHERE tier = "family" AND revoked = 0').first() as { count: number };

  // Recent activations (last 7 days)
  const recentActivations = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM activations WHERE activated_at > datetime("now", "-7 days")'
  ).first() as { count: number };

  // Giveaway redemptions count
  const giveawayRedemptions = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM giveaway_redemptions'
  ).first() as { count: number };

  return jsonResponse({
    success: true,
    stats: {
      totalKeys: totalKeys.count,
      activeKeys: activeKeys.count,
      revokedKeys: revokedKeys.count,
      totalActivations: totalActivations.count,
      proKeys: proKeys.count,
      familyKeys: familyKeys.count,
      recentActivations: recentActivations.count,
      giveawayRedemptions: giveawayRedemptions.count,
    },
  });
}

// === GIVEAWAY HANDLER ===

// HTML-escape helper to prevent XSS in email notifications
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function handleGiveawayRedeem(request: Request, env: Env): Promise<Response> {
  // Fix #3: Wrap JSON parse in try-catch
  let body: { name?: string; email?: string };
  try {
    body = await request.json() as { name?: string; email?: string };
  } catch {
    return errorResponse('Invalid request body', 400);
  }
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();

  if (!name || name.length < 2 || name.length > 100) {
    return errorResponse('Please enter a valid name (2-100 characters)');
  }

  // Basic email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return errorResponse('Please enter a valid email address');
  }

  const giveawayId = env.GIVEAWAY_KEY;
  if (!giveawayId) {
    return errorResponse('Giveaway is not currently active', 503);
  }

  // Fix #7: Check IP-based rate limit for giveaway abuse prevention
  const clientIP = getClientIP(request);
  const ipHash = await hashIP(clientIP);
  const ipRedemptions = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM giveaway_redemptions WHERE ip_hash = ? AND giveaway_key = ?'
  ).bind(ipHash, giveawayId).first() as { count: number };

  if (ipRedemptions.count >= GIVEAWAY_MAX_IP_REDEMPTIONS) {
    return errorResponse('Too many redemptions from this network. Please try from a different connection.', 429);
  }

  // Check if this email already redeemed
  const existing = await env.DB.prepare(
    'SELECT * FROM giveaway_redemptions WHERE giveaway_key = ? AND email = ?'
  ).bind(giveawayId, email).first() as { issued_key?: string; expires_at?: string } | null;

  if (existing) {
    // Already redeemed — return their unique key again (idempotent)
    const currentCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM giveaway_redemptions WHERE giveaway_key = ?'
    ).bind(giveawayId).first() as { count: number };
    return jsonResponse({
      success: true,
      key: existing.issued_key,
      message: 'You have already claimed this giveaway! Here is your license key again.',
      alreadyClaimed: true,
      remaining: GIVEAWAY_MAX_REDEMPTIONS - currentCount.count,
      expiresAt: existing.expires_at || null,
    });
  }

  // Fix #1: Calculate expiry using safe addMonths (avoids month-end overflow)
  const expiresAt = addMonths(new Date(), GIVEAWAY_EXPIRY_MONTHS).toISOString();

  // Fix #2: Generate a unique per-user license key (not shared)
  const userKey = generateLicenseKey();

  // Insert the per-user license key into license_keys with expiration
  await env.DB.prepare(
    'INSERT INTO license_keys (key, tier, max_devices, expires_at, buyer_name, buyer_contact, notes) VALUES (?, ?, 1, ?, ?, ?, ?)'
  ).bind(userKey, 'pro', expiresAt, name, email, 'giveaway-redemption').run();

  // Record redemption with atomic capacity check
  try {
    const result = await env.DB.prepare(
      `INSERT INTO giveaway_redemptions (giveaway_key, issued_key, name, email, ip_hash, expires_at)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM giveaway_redemptions WHERE giveaway_key = ?) < ?`
    ).bind(giveawayId, userKey, name, email, ipHash, expiresAt, giveawayId, GIVEAWAY_MAX_REDEMPTIONS).run();

    if (!result.meta.changes || result.meta.changes === 0) {
      // Capacity full or race condition — clean up the generated key
      await env.DB.prepare('DELETE FROM license_keys WHERE key = ?').bind(userKey).run();
      const totalRedemptions = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM giveaway_redemptions WHERE giveaway_key = ?'
      ).bind(giveawayId).first() as { count: number };

      if (totalRedemptions.count >= GIVEAWAY_MAX_REDEMPTIONS) {
        return errorResponse('Sorry, all giveaway slots have been claimed! The giveaway is full.', 410);
      }
      // Must be duplicate email (race condition on UNIQUE)
      const existingAfterRace = await env.DB.prepare(
        'SELECT issued_key, expires_at FROM giveaway_redemptions WHERE giveaway_key = ? AND email = ?'
      ).bind(giveawayId, email).first() as { issued_key: string; expires_at: string } | null;
      return jsonResponse({
        success: true,
        key: existingAfterRace?.issued_key || userKey,
        message: 'You have already claimed this giveaway! Here is your license key again.',
        alreadyClaimed: true,
        remaining: GIVEAWAY_MAX_REDEMPTIONS - totalRedemptions.count,
        expiresAt: existingAfterRace?.expires_at || expiresAt,
      });
    }
  } catch (e: unknown) {
    // Fix #8: Only treat UNIQUE constraint errors as duplicates; re-throw others
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.includes('UNIQUE constraint')) {
      // Concurrent duplicate email — clean up generated key
      await env.DB.prepare('DELETE FROM license_keys WHERE key = ?').bind(userKey).run();
      const existingAfterRace = await env.DB.prepare(
        'SELECT issued_key, expires_at FROM giveaway_redemptions WHERE giveaway_key = ? AND email = ?'
      ).bind(giveawayId, email).first() as { issued_key: string; expires_at: string } | null;
      const currentCount = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM giveaway_redemptions WHERE giveaway_key = ?'
      ).bind(giveawayId).first() as { count: number };
      return jsonResponse({
        success: true,
        key: existingAfterRace?.issued_key || userKey,
        message: 'You have already claimed this giveaway! Here is your license key again.',
        alreadyClaimed: true,
        remaining: GIVEAWAY_MAX_REDEMPTIONS - currentCount.count,
        expiresAt: existingAfterRace?.expires_at || expiresAt,
      });
    }
    // Non-UNIQUE error — clean up and return 500
    await env.DB.prepare('DELETE FROM license_keys WHERE key = ?').bind(userKey).run();
    return errorResponse('An unexpected error occurred. Please try again later.', 500);
  }

  // Get fresh count after successful insert
  const newTotal = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM giveaway_redemptions WHERE giveaway_key = ?'
  ).bind(giveawayId).first() as { count: number };

  // Send email notification to admin (fire and forget — don't block response)
  sendGiveawayNotification(env, name, email, newTotal.count).catch(() => { /* ignore email failures */ });

  return jsonResponse({
    success: true,
    key: userKey,
    message: `Congratulations! Here is your free 3-month GrabTube Pro license key. Activate it within the app to start your trial.`,
    alreadyClaimed: false,
    remaining: GIVEAWAY_MAX_REDEMPTIONS - newTotal.count,
    redemptionNumber: newTotal.count,
    expiresAt,
  });
}

// Send email notification via Mailgun (optional — leads are always stored in D1 regardless)
async function sendGiveawayNotification(env: Env, name: string, email: string, count: number): Promise<void> {
  // Email is entirely optional — if no API key is configured, skip silently.
  // All giveaway leads are persisted in the giveaway_redemptions D1 table
  // and viewable via /admin/giveaway regardless of email delivery.
  if (!env.MAILGUN_API_KEY) return;

  try {
    const formData = new URLSearchParams();
    formData.append('from', 'GrabTube Giveaway <noreply@grabtube.org>');
    formData.append('to', GIVEAWAY_NOTIFICATION_EMAIL);
    formData.append('subject', `[GrabTube Giveaway] New Lead #${count} — ${name}`);
    // HTML-escape user inputs to prevent XSS in email
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    formData.append('html', `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#22c55e">New Giveaway Redemption #${count}/${GIVEAWAY_MAX_REDEMPTIONS}</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Name</td><td style="padding:8px;border-bottom:1px solid #eee">${safeName}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Email</td><td style="padding:8px;border-bottom:1px solid #eee">${safeEmail}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Redemption #</td><td style="padding:8px;border-bottom:1px solid #eee">${count} of ${GIVEAWAY_MAX_REDEMPTIONS}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">Remaining</td><td style="padding:8px;border-bottom:1px solid #eee">${GIVEAWAY_MAX_REDEMPTIONS - count}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Time</td><td style="padding:8px">${new Date().toISOString()}</td></tr>
        </table>
        <p style="margin-top:20px;color:#666;font-size:12px">This is an automated notification from GrabTube License Server.</p>
      </div>
    `);

    const resp = await fetch('https://api.mailgun.net/v3/grabtube.org/messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('api:' + env.MAILGUN_API_KEY),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!resp.ok) {
      // Log but don't throw — email failure should never block giveaway redemption
      console.error(`Mailgun notification failed: ${resp.status} ${resp.statusText}`);
    }
  } catch (err: unknown) {
    // Silently swallow email errors — the lead is already saved in D1
    console.error('Email notification error:', err instanceof Error ? err.message : String(err));
  }
}

// Admin: list giveaway redemptions
async function handleAdminGiveawayList(env: Env): Promise<Response> {
  const redemptions = await env.DB.prepare(
    'SELECT * FROM giveaway_redemptions ORDER BY redeemed_at DESC LIMIT 200'
  ).all();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM giveaway_redemptions'
  ).first() as { count: number };

  return jsonResponse({
    success: true,
    redemptions: redemptions.results,
    total: total.count,
    maxRedemptions: GIVEAWAY_MAX_REDEMPTIONS,
    remaining: GIVEAWAY_MAX_REDEMPTIONS - total.count,
  });
}

// === GIVEAWAY PAGE HTML ===
function getGiveawayPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>GrabTube — Free 6-Month Pro Trial Giveaway</title>
  <style>
    :root {
      --bg: #030712; --bg2: #111827; --bg3: #1f2937; --border: #374151;
      --text: #f9fafb; --muted: #9ca3af; --green: #22c55e; --green2: #16a34a;
      --red: #ef4444; --blue: #3b82f6;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { width: 100%; max-width: 520px; }
    .card { background: var(--bg2); border: 1px solid var(--border); border-radius: 20px; padding: 2.5rem; position: relative; overflow: hidden; }
    .card::before { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 300px; height: 300px; background: radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%); pointer-events: none; }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; position: relative; }
    .logo svg { width: 32px; height: 32px; }
    .logo span { font-size: 1.3rem; font-weight: 800; color: var(--green); }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25); color: #86efac; font-size: 12px; font-weight: 600; margin-bottom: 16px; letter-spacing: 0.03em; }
    h1 { font-size: 1.75rem; font-weight: 800; line-height: 1.2; margin-bottom: 8px; position: relative; }
    h1 .accent { color: var(--green); }
    .subtitle { color: var(--muted); font-size: 0.95rem; line-height: 1.5; margin-bottom: 28px; position: relative; }
    .features { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 28px; position: relative; }
    .feature { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--muted); }
    .feature svg { width: 16px; height: 16px; color: var(--green); flex-shrink: 0; }
    .form-group { margin-bottom: 14px; position: relative; }
    .form-group label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
    .form-group input { width: 100%; padding: 14px 16px; background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; color: var(--text); font-size: 1rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
    .form-group input:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(34,197,94,0.12); }
    .form-group input::placeholder { color: #6b7280; }
    .btn { width: 100%; padding: 16px; border: none; border-radius: 12px; background: var(--green); color: #000; font-size: 1.05rem; font-weight: 800; cursor: pointer; transition: all 0.2s; letter-spacing: 0.01em; position: relative; }
    .btn:hover { background: var(--green2); transform: translateY(-1px); box-shadow: 0 8px 25px rgba(34,197,94,0.2); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
    .error-msg { color: var(--red); font-size: 0.85rem; margin-top: 8px; display: none; }
    .slots { text-align: center; margin-top: 16px; font-size: 0.8rem; color: var(--muted); position: relative; }
    .slots strong { color: var(--green); }

    /* Success state */
    .success-card { display: none; }
    .success-card.visible { display: block; }
    .form-card.hidden { display: none; }
    .key-display { background: var(--bg3); border: 2px solid var(--green); border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0; }
    .key-display .key { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 1.25rem; font-weight: 700; color: var(--green); letter-spacing: 0.05em; word-break: break-all; }
    .copy-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; color: var(--muted); font-size: 0.85rem; cursor: pointer; margin-top: 10px; transition: all 0.15s; }
    .copy-btn:hover { color: var(--green); border-color: var(--green); }
    .instructions { background: var(--bg3); border-radius: 12px; padding: 16px; margin-top: 16px; }
    .instructions h3 { font-size: 0.9rem; color: var(--green); margin-bottom: 10px; }
    .instructions ol { padding-left: 20px; }
    .instructions li { font-size: 0.85rem; color: var(--muted); margin-bottom: 6px; line-height: 1.4; }
    .download-link { display: block; text-align: center; margin-top: 16px; color: var(--green); font-weight: 700; font-size: 0.95rem; text-decoration: none; padding: 12px; border: 1px solid var(--green); border-radius: 10px; transition: all 0.15s; }
    .download-link:hover { background: rgba(34,197,94,0.08); }
    .confetti { position: fixed; pointer-events: none; z-index: 999; }

    @media (max-width: 480px) {
      .card { padding: 1.5rem; }
      h1 { font-size: 1.4rem; }
      .features { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<div class="container">
  <!-- CLAIM FORM -->
  <div id="form-card" class="card form-card">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.15"/><path d="M8 12l3 3 5-6" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>GrabTube</span>
    </div>
    <div class="badge">LIMITED GIVEAWAY — 6 MONTH PRO TRIAL</div>
    <h1>Get <span class="accent">GrabTube Pro</span> Free for 6 Months</h1>
    <p class="subtitle">Claim your free 6-month Pro trial — unlimited downloads, 8K quality, 1800+ sites. No credit card needed. Full Pro features for 180 days!</p>
    <div class="features">
      <div class="feature"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>Unlimited downloads</div>
      <div class="feature"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>Up to 8K quality</div>
      <div class="feature"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>1800+ websites</div>
      <div class="feature"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>Built-in player</div>
      <div class="feature"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>Format converter</div>
      <div class="feature"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>6 months Pro access</div>
    </div>
    <form id="claim-form" onsubmit="handleClaim(event)">
      <div class="form-group">
        <label>Your Name</label>
        <input type="text" id="input-name" placeholder="Enter your name" required minlength="2" maxlength="100" autocomplete="name">
      </div>
      <div class="form-group">
        <label>Email Address</label>
        <input type="email" id="input-email" placeholder="you@example.com" required maxlength="200" autocomplete="email">
      </div>
      <div id="error-msg" class="error-msg"></div>
      <button type="submit" class="btn" id="claim-btn">Claim Free 6-Month Pro Trial</button>
    </form>
    <div class="slots" id="slots-info"></div>
  </div>

  <!-- SUCCESS -->
  <div id="success-card" class="card success-card">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.15"/><path d="M8 12l3 3 5-6" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>GrabTube</span>
    </div>
    <div class="badge" style="background:rgba(34,197,94,0.2)">CLAIMED SUCCESSFULLY</div>
    <h1>Your <span class="accent">6-Month Pro</span> Key</h1>
    <p class="subtitle" id="success-msg">Congratulations! Here is your free 6-month GrabTube Pro license key.</p>
    <p class="subtitle" style="color:#eab308;font-size:0.85rem;margin-bottom:12px" id="expiry-info"></p>
    <div class="key-display">
      <div class="key" id="license-key-display"></div>
      <button class="copy-btn" onclick="copyKey()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span id="copy-text">Copy Key</span>
      </button>
    </div>
    <div class="instructions">
      <h3>How to Activate</h3>
      <ol>
        <li>Download GrabTube from <a href="https://www.grabtube.org/#download" style="color:var(--green)" target="_blank">grabtube.org</a></li>
        <li>Open the app and go to <strong>Settings</strong></li>
        <li>Click <strong>License Activation</strong></li>
        <li>Paste your key and click <strong>Activate</strong></li>
      </ol>
    </div>
    <a href="https://www.grabtube.org/#download" class="download-link" target="_blank">Download GrabTube Desktop — Free</a>
  </div>
</div>

<script>
const API = window.location.origin;

async function handleClaim(e) {
  e.preventDefault();
  const btn = document.getElementById('claim-btn');
  const errEl = document.getElementById('error-msg');
  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Claiming...';

  try {
    const r = await fetch(API + '/giveaway/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    const d = await r.json();

    if (d.success && d.key) {
      document.getElementById('license-key-display').textContent = d.key;
      document.getElementById('success-msg').textContent = d.message || 'Here is your free 6-month Pro license key!';
      if (d.expiresAt) {
        const exp = new Date(d.expiresAt);
        document.getElementById('expiry-info').textContent = 'Your Pro trial expires on: ' + exp.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      document.getElementById('form-card').classList.add('hidden');
      document.getElementById('success-card').classList.add('visible');
      // Mini confetti
      for (let i = 0; i < 30; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.cssText = 'position:fixed;width:8px;height:8px;border-radius:50%;top:-10px;left:' + (Math.random()*100) + 'vw;background:' + ['#22c55e','#3b82f6','#eab308','#a855f7','#ef4444'][Math.floor(Math.random()*5)] + ';animation:fall ' + (1.5+Math.random()*2) + 's ease-out forwards;z-index:999;';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4000);
      }
      const style = document.createElement('style');
      style.textContent = '@keyframes fall { to { transform: translateY(110vh) rotate(' + (Math.random()*720-360) + 'deg); opacity: 0; } }';
      document.head.appendChild(style);
    } else {
      errEl.textContent = d.error || 'Something went wrong. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Claim Free 6-Month Pro Trial';
    }
  } catch (err) {
    errEl.textContent = 'Network error. Please check your connection and try again.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Claim Free 6-Month Pro Trial';
  }
}

function copyKey() {
  const key = document.getElementById('license-key-display').textContent;
  navigator.clipboard.writeText(key).then(() => {
    document.getElementById('copy-text').textContent = 'Copied!';
    setTimeout(() => { document.getElementById('copy-text').textContent = 'Copy Key'; }, 2000);
  });
}

// Enter key support
document.getElementById('input-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('claim-form').requestSubmit(); });
</script>
</body>
</html>`;
}
