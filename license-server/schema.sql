-- GrabTube License Server - D1 Schema
-- Run this after creating the D1 database:
--   wrangler d1 execute grabtube-licenses --file=./schema.sql

CREATE TABLE IF NOT EXISTS license_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'pro',          -- 'pro' or 'family'
  max_devices INTEGER NOT NULL DEFAULT 1,     -- pro=1, family=3
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked INTEGER NOT NULL DEFAULT 0,         -- 0=active, 1=revoked
  buyer_name TEXT DEFAULT '',                 -- optional: WhatsApp name / reference
  buyer_contact TEXT DEFAULT '',              -- optional: phone / email for your records
  notes TEXT DEFAULT ''                       -- optional: any notes
);

CREATE TABLE IF NOT EXISTS activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT DEFAULT '',                -- e.g. "Windows 11 PC", "MacBook Pro"
  activated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_validated TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1,          -- 0=deactivated, 1=active
  FOREIGN KEY (license_key) REFERENCES license_keys(key),
  UNIQUE(license_key, device_id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_activations_key ON activations(license_key);
CREATE INDEX IF NOT EXISTS idx_activations_device ON activations(device_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
