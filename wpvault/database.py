import sqlite3
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

DB_PATH = os.getenv("DB_PATH", "/home/app/database.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS plugins (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            version TEXT,
            category TEXT,
            source_url TEXT,
            file_key TEXT,
            file_hash TEXT,
            file_size_bytes INTEGER,
            thumbnail_url TEXT,
            is_plugin INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            plan TEXT DEFAULT 'free',
            plan_expires_at TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            user_id TEXT REFERENCES users(id),
            btcpay_invoice_id TEXT UNIQUE,
            amount_usd REAL,
            status TEXT DEFAULT 'pending',
            plan_duration_days INTEGER DEFAULT 365,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            user_id TEXT REFERENCES users(id),
            plugin_id TEXT REFERENCES plugins(id),
            downloaded_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sync_log (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            slug TEXT,
            status TEXT,
            message TEXT,
            synced_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()

    admin_email = "admin@wpvault.com"
    existing = get_user_by_email(admin_email)
    if not existing:
        from auth import hash_password
        hashed = hash_password("admin123")
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, plan, plan_expires_at, is_admin) "
            "VALUES (lower(hex(randomblob(16))), ?, ?, 'premium', ?, 1)",
            (admin_email, hashed, (datetime.utcnow() + timedelta(days=3650)).isoformat())
        )
        conn.commit()

    conn.close()


def insert_plugin(data: dict) -> bool:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO plugins (id, slug, name, description, version, category, source_url, "
            "file_key, file_hash, file_size_bytes, thumbnail_url, is_plugin) "
            "VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                data.get("slug"),
                data.get("name", ""),
                data.get("description", ""),
                data.get("version", "unknown"),
                data.get("category", ""),
                data.get("source_url", ""),
                data.get("file_key", ""),
                data.get("file_hash", ""),
                data.get("file_size_bytes", 0),
                data.get("thumbnail_url", ""),
                1 if data.get("is_plugin", True) else 0,
            )
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def update_plugin(slug: str, data: dict) -> bool:
    conn = get_connection()
    try:
        fields = []
        values = []
        for key in ["name", "description", "version", "category", "source_url",
                     "file_key", "file_hash", "file_size_bytes", "thumbnail_url", "is_plugin"]:
            if key in data:
                fields.append(f"{key} = ?")
                values.append(data[key])
        fields.append("updated_at = datetime('now')")
        values.append(slug)
        query = f"UPDATE plugins SET {', '.join(fields)} WHERE slug = ?"
        conn.execute(query, values)
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def get_plugin_by_slug(slug: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM plugins WHERE slug = ?", (slug,)).fetchone()
        if row:
            return dict(row)
        return None
    except Exception:
        return None
    finally:
        conn.close()


def get_all_plugins(page: int = 1, per_page: int = 20, search: str = None, category: str = None) -> list:
    conn = get_connection()
    try:
        query = "SELECT * FROM plugins WHERE 1=1"
        params = []
        if search:
            query += " AND (name LIKE ? OR slug LIKE ? OR description LIKE ?)"
            like = f"%{search}%"
            params.extend([like, like, like])
        if category:
            query += " AND category = ?"
            params.append(category)
        query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        return []
    finally:
        conn.close()


def get_plugin_count(search: str = None, category: str = None) -> int:
    conn = get_connection()
    try:
        query = "SELECT COUNT(*) as cnt FROM plugins WHERE 1=1"
        params = []
        if search:
            query += " AND (name LIKE ? OR slug LIKE ? OR description LIKE ?)"
            like = f"%{search}%"
            params.extend([like, like, like])
        if category:
            query += " AND category = ?"
            params.append(category)
        row = conn.execute(query, params).fetchone()
        return row["cnt"] if row else 0
    except Exception:
        return 0
    finally:
        conn.close()


def get_all_categories() -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT DISTINCT category FROM plugins WHERE category IS NOT NULL AND category != '' ORDER BY category"
        ).fetchall()
        return [r["category"] for r in rows]
    except Exception:
        return []
    finally:
        conn.close()


def create_user(email: str, password_hash: str) -> dict:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (lower(hex(randomblob(16))), ?, ?)",
            (email, password_hash)
        )
        conn.commit()
        return get_user_by_email(email)
    except Exception:
        return None
    finally:
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            return dict(row)
        return None
    except Exception:
        return None
    finally:
        conn.close()


def get_user_by_id(user_id: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row:
            return dict(row)
        return None
    except Exception:
        return None
    finally:
        conn.close()


def upgrade_user_plan(user_id: str, days: int) -> bool:
    conn = get_connection()
    try:
        expires = (datetime.utcnow() + timedelta(days=days)).isoformat()
        conn.execute(
            "UPDATE users SET plan = 'premium', plan_expires_at = ? WHERE id = ?",
            (expires, user_id)
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def create_order(user_id: str, invoice_id: str, amount: float, days: int) -> dict:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO orders (id, user_id, btcpay_invoice_id, amount_usd, plan_duration_days) "
            "VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)",
            (user_id, invoice_id, amount, days)
        )
        conn.commit()
        return get_order_by_invoice(invoice_id)
    except Exception:
        return None
    finally:
        conn.close()


def get_order_by_invoice(invoice_id: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM orders WHERE btcpay_invoice_id = ?", (invoice_id,)
        ).fetchone()
        if row:
            return dict(row)
        return None
    except Exception:
        return None
    finally:
        conn.close()


def update_order_status(invoice_id: str, status: str) -> bool:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE orders SET status = ? WHERE btcpay_invoice_id = ?",
            (status, invoice_id)
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def log_download(user_id: str, plugin_id: str) -> bool:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO downloads (id, user_id, plugin_id) VALUES (lower(hex(randomblob(16))), ?, ?)",
            (user_id, plugin_id)
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def get_user_downloads(user_id: str) -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT d.*, p.name as plugin_name, p.slug as plugin_slug, p.version as plugin_version "
            "FROM downloads d LEFT JOIN plugins p ON d.plugin_id = p.id "
            "WHERE d.user_id = ? ORDER BY d.downloaded_at DESC",
            (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        return []
    finally:
        conn.close()


def log_sync(slug: str, status: str, message: str) -> bool:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO sync_log (id, slug, status, message) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
            (slug, status, message)
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def get_recent_sync_logs(limit: int = 50) -> list:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    except Exception:
        return []
    finally:
        conn.close()


def get_total_users() -> int:
    conn = get_connection()
    try:
        row = conn.execute("SELECT COUNT(*) as cnt FROM users").fetchone()
        return row["cnt"] if row else 0
    except Exception:
        return 0
    finally:
        conn.close()


def get_total_orders() -> int:
    conn = get_connection()
    try:
        row = conn.execute("SELECT COUNT(*) as cnt FROM orders").fetchone()
        return row["cnt"] if row else 0
    except Exception:
        return 0
    finally:
        conn.close()


def get_total_downloads() -> int:
    conn = get_connection()
    try:
        row = conn.execute("SELECT COUNT(*) as cnt FROM downloads").fetchone()
        return row["cnt"] if row else 0
    except Exception:
        return 0
    finally:
        conn.close()


def delete_plugin_by_slug(slug: str) -> bool:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM plugins WHERE slug = ?", (slug,))
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()
