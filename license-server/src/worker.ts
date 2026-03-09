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
 *   GET  /health         — Health check
 */

export interface Env {
  DB: D1Database;
  ADMIN_EMAIL: string;    // Set via wrangler secret
  ADMIN_PASSWORD: string; // Set via wrangler secret
}

// CORS headers for Electron app requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

// Generate a license key: GT-XXXX-XXXX-XXXX-XXXX
function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return `GT-${segments.join('-')}`;
}

// Generate a random session token
function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
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
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok', service: 'grabtube-license', timestamp: new Date().toISOString() });
      }

      // === PUBLIC ENDPOINTS (for GrabTube app) ===

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
  const body = await request.json() as { key?: string; deviceId?: string; deviceName?: string };
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

  // Check if this device is already activated
  const existing = await env.DB.prepare(
    'SELECT * FROM activations WHERE license_key = ? AND device_id = ? AND active = 1'
  ).bind(key, deviceId).first();

  if (existing) {
    // Already activated on this device — just update last_validated
    await env.DB.prepare(
      'UPDATE activations SET last_validated = datetime("now") WHERE license_key = ? AND device_id = ?'
    ).bind(key, deviceId).run();

    return jsonResponse({
      success: true,
      tier: license.tier,
      maxDevices: license.max_devices,
      message: 'Already activated on this device',
    });
  }

  // Check device count
  const activeCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM activations WHERE license_key = ? AND active = 1'
  ).bind(key).first() as { count: number };

  if (activeCount.count >= license.max_devices) {
    return errorResponse(
      `Device limit reached (${activeCount.count}/${license.max_devices}). Deactivate another device first.`
    );
  }

  // Activate
  await env.DB.prepare(
    'INSERT INTO activations (license_key, device_id, device_name) VALUES (?, ?, ?)'
  ).bind(key, deviceId, deviceName || '').run();

  return jsonResponse({
    success: true,
    tier: license.tier,
    maxDevices: license.max_devices,
    devicesUsed: activeCount.count + 1,
    message: 'License activated successfully',
  });
}

async function handleValidate(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { key?: string; deviceId?: string };
  const { key, deviceId } = body;

  if (!key || !deviceId) {
    return errorResponse('Missing required fields: key, deviceId');
  }

  // Look up the license
  const license = await env.DB.prepare(
    'SELECT * FROM license_keys WHERE key = ?'
  ).bind(key).first() as { tier: string; max_devices: number; revoked: number } | null;

  if (!license) {
    return jsonResponse({ valid: false, error: 'Invalid license key' });
  }

  if (license.revoked) {
    return jsonResponse({ valid: false, error: 'License key has been revoked' });
  }

  // Check activation
  const activation = await env.DB.prepare(
    'SELECT * FROM activations WHERE license_key = ? AND device_id = ? AND active = 1'
  ).bind(key, deviceId).first();

  if (!activation) {
    return jsonResponse({ valid: false, error: 'Device not activated' });
  }

  // Update last_validated timestamp
  await env.DB.prepare(
    'UPDATE activations SET last_validated = datetime("now") WHERE license_key = ? AND device_id = ?'
  ).bind(key, deviceId).run();

  return jsonResponse({
    valid: true,
    tier: license.tier,
    maxDevices: license.max_devices,
  });
}

async function handleDeactivate(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { key?: string; deviceId?: string };
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
  const body = await request.json() as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return errorResponse('Missing email or password');
  }

  if (email !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) {
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
    },
  });
}
