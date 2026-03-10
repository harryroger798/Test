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

      if (path === '/admin/devices' && request.method === 'GET') {
        if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
        return await handleAdminDevices(request, env);
      }

      // === HIDDEN ADMIN PANEL WEB UI ===
      if ((path === '/admin' || path === '/admin/') && request.method === 'GET') {
        return new Response(getAdminPanelHTML(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
          <thead><tr><th>Device ID</th><th>Device Name</th><th>License Key</th><th>Tier</th><th>Status</th><th>Activated</th><th>Last Seen</th></tr></thead>
          <tbody id="devices-body"></tbody>
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
        ? '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:2rem">No devices activated for this key</td></tr>'
        : devices.map(dev => renderDeviceRow(dev, false)).join('');
    } else {
      infoEl.classList.add('hidden');
      titleEl.textContent = 'All Recent Activations';
      const devices = d.devices || [];
      document.getElementById('devices-body').innerHTML = devices.length === 0
        ? '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:2rem">No device activations found</td></tr>'
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
  return '<tr><td title="' + (dev.device_id || '') + '" style="font-family:monospace;font-size:0.8rem;cursor:help">' + devId + '</td><td>' + devName + '</td><td>' + key + '</td><td>' + tier + '</td><td>' + active + '</td><td>' + activated + '</td><td>' + lastSeen + '</td></tr>';
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
