import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { createRequire } from 'module'

// Use createRequire to load better-sqlite3 at runtime.
// This bypasses Rollup's bundling which can't handle the native
// module's dynamic require() for the .node addon file.
const nativeRequire = createRequire(__filename)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any
try {
  Database = nativeRequire('better-sqlite3')
} catch {
  // Fallback: try loading from app.asar.unpacked
  try {
    const unpackedPath = join(
      __dirname,
      '../../node_modules/better-sqlite3'
    ).replace('app.asar', 'app.asar.unpacked')
    Database = nativeRequire(unpackedPath)
  } catch (err2) {
    console.error('Failed to load better-sqlite3:', err2)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null

function getDbPath(): string {
  const userDataPath = app?.isPackaged
    ? app.getPath('userData')
    : join(__dirname, '../../data')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  return join(userDataPath, 'bytefix.db')
}

export async function initDatabase(): Promise<void> {
  if (!Database) {
    throw new Error('better-sqlite3 native module failed to load')
  }
  const dbPath = getDbPath()
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration INTEGER,
      modules_run TEXT NOT NULL DEFAULT '[]',
      overall_health REAL DEFAULT 0,
      summary TEXT,
      system_snapshot TEXT,
      diagnostics TEXT DEFAULT '[]',
      fixes TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS diagnostic_results (
      id TEXT PRIMARY KEY,
      scan_id TEXT REFERENCES scans(id),
      module TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      details TEXT DEFAULT '[]',
      fix_available INTEGER DEFAULT 0,
      fix_description TEXT,
      auto_fixable INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS fix_results (
      id TEXT PRIMARY KEY,
      scan_id TEXT REFERENCES scans(id),
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      details TEXT DEFAULT '[]',
      changes TEXT DEFAULT '[]',
      error TEXT,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      module TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL DEFAULT 0,
      message TEXT,
      start_time INTEGER,
      end_time INTEGER,
      result TEXT,
      error TEXT
    );

    -- Phase 4: CRM / Business Layer tables
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      address TEXT,
      gstin TEXT,
      state_code TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS repair_jobs (
      id TEXT PRIMARY KEY,
      ticket_number TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      device_brand TEXT,
      device_model TEXT,
      device_serial TEXT,
      complaint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      diagnosis TEXT,
      estimated_cost REAL,
      final_cost REAL,
      technician TEXT,
      promised_date INTEGER,
      notes TEXT,
      scan_id TEXT REFERENCES scans(id),
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      job_id TEXT REFERENCES repair_jobs(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      shop_name TEXT NOT NULL,
      shop_gstin TEXT,
      shop_address TEXT,
      shop_state_code TEXT,
      customer_gstin TEXT,
      customer_state_code TEXT,
      is_intra_state INTEGER NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0,
      cgst_rate REAL NOT NULL DEFAULT 9,
      cgst_amount REAL NOT NULL DEFAULT 0,
      sgst_rate REAL NOT NULL DEFAULT 9,
      sgst_amount REAL NOT NULL DEFAULT 0,
      igst_rate REAL NOT NULL DEFAULT 0,
      igst_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      line_items TEXT NOT NULL DEFAULT '[]',
      payment_method TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_repair_jobs_customer ON repair_jobs(customer_id);
    CREATE INDEX IF NOT EXISTS idx_repair_jobs_status ON repair_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
  `)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function saveScan(scan: {
  id: string
  startTime: number
  endTime: number
  duration: number
  modulesRun: string[]
  overallHealth: number
  summary: string
  systemSnapshot: string
  diagnostics: string
  fixes: string
}): void {
  const stmt = getDb().prepare(`
    INSERT INTO scans (id, start_time, end_time, duration, modules_run, overall_health, summary, system_snapshot, diagnostics, fixes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    scan.id, scan.startTime, scan.endTime, scan.duration,
    JSON.stringify(scan.modulesRun), scan.overallHealth, scan.summary,
    scan.systemSnapshot, scan.diagnostics, scan.fixes
  )
}

export function getRecentScans(limit = 10): unknown[] {
  return getDb().prepare('SELECT * FROM scans ORDER BY created_at DESC LIMIT ?').all(limit)
}

export function getScanById(id: string): unknown {
  return getDb().prepare('SELECT * FROM scans WHERE id = ?').get(id)
}

export function saveSetting(key: string, value: string): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, strftime(\'%s\', \'now\'))'
  ).run(key, value)
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}
