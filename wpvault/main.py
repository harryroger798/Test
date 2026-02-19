import os
import re
import logging
import threading
import hashlib
import base64
from datetime import datetime
from urllib.parse import urlparse
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import httpx
from cryptography.fernet import Fernet, InvalidToken

load_dotenv()

_IMG_TOKEN_SECRET = os.getenv("IMG_TOKEN_SECRET") or os.getenv("JWT_SECRET", "")
if not _IMG_TOKEN_SECRET:
    raise RuntimeError("IMG_TOKEN_SECRET or JWT_SECRET must be set")
_img_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(_IMG_TOKEN_SECRET.encode()).digest()))


def _img_token(url: str) -> str:
    return _img_fernet.encrypt(url.encode("utf-8")).decode("utf-8")


def _img_token_to_url(token: str) -> str | None:
    try:
        return _img_fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


import random
import html as html_mod
import database
import auth
import payments
import storage
import watcher
import downloader
import file_processor

app = FastAPI(title="WPVault", version="1.0.0")

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()]
if not ALLOWED_ORIGINS:
    logging.getLogger(__name__).warning(
        "CORS_ALLOW_ORIGINS not set - CORS will reject cross-origin requests. "
        "Set CORS_ALLOW_ORIGINS to allow specific origins."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=bool(ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATE_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATE_DIR)


@app.on_event("startup")
def startup():
    database.init_db()


def get_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return ""


def get_current_user_from_request(request: Request) -> dict:
    token = get_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = auth.get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def get_admin_user(request: Request) -> dict:
    user = get_current_user_from_request(request)
    if not auth.require_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


PLAN_PRICING = {
    "yearly": {"amount": 9.99, "days": 365},
    "premium_yearly": {"amount": 9.99, "days": 365},
}


class CheckoutRequest(BaseModel):
    plan: str = "yearly"


@app.post("/api/register")
def api_register(body: RegisterRequest):
    email = body.email.strip().lower()
    password = body.password

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Invalid email format"}
        )

    if len(password) < 6:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Password must be at least 6 characters"}
        )

    existing = database.get_user_by_email(email)
    if existing:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Email already registered"}
        )

    hashed = auth.hash_password(password)
    user = database.create_user(email, hashed)
    if not user:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Failed to create user"}
        )

    token = auth.create_access_token({"user_id": user["id"], "email": user["email"]})
    return JSONResponse(content={
        "success": True,
        "data": {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "plan": user["plan"],
                "plan_expires_at": user.get("plan_expires_at"),
                "is_admin": user.get("is_admin", 0)
            }
        }
    })


@app.post("/api/login")
def api_login(body: LoginRequest):
    email = body.email.strip().lower()
    password = body.password

    user = database.get_user_by_email(email)
    if not user:
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Invalid email or password"}
        )

    if not auth.verify_password(password, user["password_hash"]):
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Invalid email or password"}
        )

    token = auth.create_access_token({"user_id": user["id"], "email": user["email"]})
    return JSONResponse(content={
        "success": True,
        "data": {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "plan": user["plan"],
                "plan_expires_at": user.get("plan_expires_at"),
                "is_admin": user.get("is_admin", 0)
            }
        }
    })


@app.get("/api/me")
def api_me(request: Request):
    user = get_current_user_from_request(request)
    return JSONResponse(content={
        "success": True,
        "data": {
            "id": user["id"],
            "email": user["email"],
            "plan": user["plan"],
            "plan_expires_at": user.get("plan_expires_at"),
            "is_admin": user.get("is_admin", 0),
            "created_at": user.get("created_at")
        }
    })


@app.get("/api/plugins")
def api_plugins(page: int = 1, search: str | None = None, category: str | None = None):
    if page < 1:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "page must be >= 1"}
        )
    plugins = database.get_all_plugins(page=page, per_page=20, search=search, category=category)
    total = database.get_plugin_count(search=search, category=category)
    categories = database.get_all_categories()

    safe_plugins = []
    for p in plugins:
        thumb = p.get("thumbnail_url", "") or ""
        safe_plugins.append({
            "slug": p.get("slug"),
            "name": p.get("name"),
            "description": p.get("description", ""),
            "version": p.get("version"),
            "category": p.get("category"),
            "thumbnail": f"/api/img?t={_img_token(thumb)}" if thumb else "",
            "is_plugin": p.get("is_plugin", 1),
            "file_size_bytes": p.get("file_size_bytes", 0),
            "updated_at": p.get("updated_at"),
        })

    return JSONResponse(content={
        "success": True,
        "data": {
            "plugins": safe_plugins,
            "total": total,
            "page": page,
            "per_page": 20,
            "categories": categories
        }
    })


@app.get("/api/plugins/{slug}")
def api_plugin_detail(slug: str):
    plugin = database.get_plugin_by_slug(slug)
    if not plugin:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Plugin not found"}
        )
    thumb = plugin.get("thumbnail_url", "") or ""
    safe = {
        "slug": plugin.get("slug"),
        "name": plugin.get("name"),
        "description": plugin.get("description", ""),
        "version": plugin.get("version"),
        "category": plugin.get("category"),
        "thumbnail": f"/api/img?t={_img_token(thumb)}" if thumb else "",
        "is_plugin": plugin.get("is_plugin", 1),
        "file_size_bytes": plugin.get("file_size_bytes", 0),
        "created_at": plugin.get("created_at"),
        "updated_at": plugin.get("updated_at"),
    }
    return JSONResponse(content={"success": True, "data": safe})


@app.get("/api/plugins/{slug}/download")
def api_plugin_download(slug: str, request: Request):
    user = get_current_user_from_request(request)

    if not auth.require_premium(user):
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": "Premium plan required"}
        )

    plugin = database.get_plugin_by_slug(slug)
    if not plugin:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Plugin not found"}
        )

    file_key = plugin.get("file_key", "")

    if file_key:
        database.log_download(user["id"], plugin["id"])
        if slug in _download_tasks:
            del _download_tasks[slug]
        return JSONResponse(content={
            "success": True,
            "data": {"download_url": f"/api/plugins/{slug}/file", "expires_in": 3600}
        })

    if slug in _download_tasks:
        task = _download_tasks[slug]
        if task["status"] == "ready":
            plugin = database.get_plugin_by_slug(slug)
            fk = plugin.get("file_key", "") if plugin else ""
            if fk:
                database.log_download(user["id"], plugin["id"])
                del _download_tasks[slug]
                return JSONResponse(content={
                    "success": True,
                    "data": {"download_url": f"/api/plugins/{slug}/file", "expires_in": 3600}
                })
            del _download_tasks[slug]
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": "Download completed but file not found. Please try again."}
            )
        elif task["status"] == "failed":
            msg = task.get("message", "Download failed")
            del _download_tasks[slug]
            return JSONResponse(
                status_code=503,
                content={"success": False, "error": msg}
            )
        else:
            return JSONResponse(content={
                "success": True,
                "data": {"status": "preparing", "message": "Download is being prepared. Please wait..."}
            })

    source_url = plugin.get("source_url", "")
    if not source_url:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "No download source available for this plugin"}
        )

    _download_tasks[slug] = {"status": "preparing"}

    def _bg_download(dl_slug: str, dl_source_url: str):
        filepath = None
        try:
            filepath = downloader.download_plugin(dl_source_url, dl_slug)
            if not filepath:
                _download_tasks[dl_slug] = {"status": "failed", "message": "Could not download from source. Please try again later."}
                return

            result = file_processor.process_file(filepath, dl_slug)
            version = result.get("version", "unknown") if result else "unknown"
            file_hash = result.get("file_hash", "") if result else ""
            file_size = result.get("file_size_bytes", 0) if result else 0

            object_key = f"plugins/{dl_slug}/{dl_slug}-{version}.zip"
            if storage.upload_file(filepath, object_key):
                database.update_plugin(dl_slug, {
                    "file_key": object_key,
                    "file_hash": file_hash,
                    "file_size_bytes": file_size,
                    "version": version,
                })
                _download_tasks[dl_slug] = {"status": "ready"}
            else:
                _download_tasks[dl_slug] = {"status": "failed", "message": "Failed to store file. Please try again."}
        except Exception as exc:
            logging.getLogger(__name__).exception("Background download failed for %s", dl_slug)
            _download_tasks[dl_slug] = {"status": "failed", "message": f"Download error: {exc}"}
        finally:
            if filepath:
                try:
                    os.remove(filepath)
                except OSError:
                    pass

    thread = threading.Thread(target=_bg_download, args=(slug, source_url), daemon=True)
    thread.start()

    return JSONResponse(content={
        "success": True,
        "data": {"status": "preparing", "message": "Download is being prepared. This may take up to 2 minutes..."}
    })


@app.get("/api/plugins/{slug}/file")
def api_plugin_file(slug: str, request: Request):
    user = get_current_user_from_request(request)

    if not auth.require_premium(user):
        return JSONResponse(
            status_code=403,
            content={"success": False, "error": "Premium plan required"}
        )

    plugin = database.get_plugin_by_slug(slug)
    if not plugin:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Plugin not found"}
        )

    file_key = plugin.get("file_key", "")
    if not file_key:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "File not available"}
        )

    body, content_length = storage.get_file_stream(file_key)
    if body is None:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Failed to retrieve file from storage"}
        )

    filename = file_key.rsplit("/", 1)[-1] if "/" in file_key else file_key

    def _stream():
        try:
            for chunk in body.iter_chunks(chunk_size=65536):
                yield chunk
        finally:
            body.close()

    return StreamingResponse(
        _stream(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(content_length),
        },
    )


@app.post("/api/checkout")
def api_checkout(body: CheckoutRequest, request: Request):
    user = get_current_user_from_request(request)

    pricing = PLAN_PRICING.get(body.plan)
    if not pricing:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": f"Unknown plan: {body.plan}. Available: {', '.join(PLAN_PRICING)}"}
        )
    amount = pricing["amount"]
    days = pricing["days"]

    result = payments.create_invoice(user["id"], amount, days)
    if "error" in result:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": result["error"]}
        )

    return JSONResponse(content={
        "success": True,
        "data": {
            "checkout_url": result.get("checkout_url", ""),
            "invoice_id": result.get("invoice_id", "")
        }
    })


@app.post("/webhook/btcpay")
async def webhook_btcpay(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("BTCPAY-SIG", "")

    try:
        import json
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Invalid payload"}
        )

    ok = payments.handle_webhook(payload, raw_body, signature)
    if not ok:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Webhook verification failed"}
        )
    return JSONResponse(content={"success": True, "data": {"status": "ok"}})


_sync_lock = threading.Lock()
_sync_running = False

_download_tasks: dict[str, dict] = {}


@app.get("/api/admin/stats")
def api_admin_stats(request: Request):
    _ = get_admin_user(request)
    total_plugins= database.get_plugin_count()
    total_users = database.get_total_users()
    total_orders = database.get_total_orders()
    total_downloads = database.get_total_downloads()
    recent_logs = database.get_recent_sync_logs(limit=20)

    return JSONResponse(content={
        "success": True,
        "data": {
            "total_plugins": total_plugins,
            "total_users": total_users,
            "total_orders": total_orders,
            "total_downloads": total_downloads,
            "recent_sync_logs": recent_logs
        }
    })


@app.get("/api/admin/plugins")
def api_admin_plugins(request: Request, page: int = 1):
    _ = get_admin_user(request)
    plugins = database.get_all_plugins(page=page, per_page=100)
    total = database.get_plugin_count()
    return JSONResponse(content={
        "success": True,
        "data": {"plugins": plugins, "total": total}
    })


@app.delete("/api/admin/plugins/{slug}")
def api_admin_delete_plugin(slug: str, request: Request):
    _ = get_admin_user(request)
    plugin = database.get_plugin_by_slug(slug)
    if not plugin:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Plugin not found"}
        )

    deleted = database.delete_plugin_by_slug(slug)
    if not deleted:
        return JSONResponse(
            status_code=409,
            content={"success": False, "error": "Plugin could not be deleted"}
        )

    file_key = plugin.get("file_key", "")
    if file_key:
        try:
            storage.delete_file(file_key)
        except Exception:
            logging.getLogger(__name__).warning(
                "Plugin %s deleted from DB but failed to delete storage object %s",
                slug,
                file_key,
            )

    return JSONResponse(content={"success": True, "data": {"message": f"Plugin {slug} deleted"}})


@app.post("/api/admin/sync")
def api_admin_sync(request: Request):
    global _sync_running
    _ = get_admin_user(request)

    if not _sync_lock.acquire(blocking=False):
        return JSONResponse(
            status_code=409,
            content={"success": False, "error": "Sync already in progress"}
        )

    def _run_sync_with_lock():
        global _sync_running
        try:
            _sync_running = True
            watcher.run_sync()
        finally:
            _sync_running = False
            _sync_lock.release()

    thread = threading.Thread(target=_run_sync_with_lock, daemon=True)
    thread.start()
    return JSONResponse(content={"success": True, "data": {"status": "sync started"}})


@app.get("/api/admin/files")
def api_admin_files(request: Request):
    _ = get_admin_user(request)
    files = storage.list_all_files()
    return JSONResponse(content={"success": True, "data": {"files": files}})


@app.get("/api/user/downloads")
def api_user_downloads(request: Request):
    user = get_current_user_from_request(request)
    downloads = database.get_user_downloads(user["id"])
    return JSONResponse(content={"success": True, "data": {"downloads": downloads}})


@app.get("/api/my-downloads")
def api_my_downloads(request: Request):
    user = get_current_user_from_request(request)
    downloads = database.get_user_downloads(user["id"])
    return JSONResponse(content={"success": True, "data": downloads})


@app.post("/api/create-order")
def api_create_order(body: CheckoutRequest, request: Request):
    user = get_current_user_from_request(request)
    pricing = PLAN_PRICING.get(body.plan)
    if not pricing:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": f"Unknown plan: {body.plan}"}
        )
    result = payments.create_invoice(user["id"], pricing["amount"], pricing["days"])
    if "error" in result:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": result["error"]}
        )
    return JSONResponse(content={
        "success": True,
        "data": {
            "payment_url": result.get("checkout_url", ""),
            "invoice_id": result.get("invoice_id", "")
        }
    })


@app.get("/api/admin/sync-logs")
def api_admin_sync_logs(request: Request):
    _ = get_admin_user(request)
    logs = database.get_recent_sync_logs(limit=20)
    return JSONResponse(content={"success": True, "data": logs})


@app.post("/api/admin/trigger-sync")
def api_admin_trigger_sync(request: Request):
    global _sync_running
    _ = get_admin_user(request)
    if not _sync_lock.acquire(blocking=False):
        return JSONResponse(
            status_code=409,
            content={"success": False, "error": "Sync already in progress"}
        )

    def _run():
        global _sync_running
        try:
            _sync_running = True
            watcher.run_sync()
        finally:
            _sync_running = False
            _sync_lock.release()

    threading.Thread(target=_run, daemon=True).start()
    return JSONResponse(content={"success": True, "data": {"status": "sync started"}})


@app.get("/api/download/{slug}")
def api_download_shortcut(slug: str, request: Request):
    return api_plugin_download(slug, request)


_image_cache_dir = os.path.join(os.path.dirname(__file__), "static", "_imgcache")
os.makedirs(_image_cache_dir, exist_ok=True)


@app.get("/api/img")
async def proxy_image(t: str | None = None, url: str | None = None):
    if t:
        url = _img_token_to_url(t)
        if not url:
            return JSONResponse(status_code=400, content={"success": False, "error": "Invalid token"})

    if not url:
        return JSONResponse(status_code=400, content={"success": False, "error": "Missing image token"})

    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return JSONResponse(status_code=400, content={"success": False, "error": "Invalid URL"})

    host = parsed.hostname or ""
    if not host.endswith("pluginsforwp.com"):
        return JSONResponse(status_code=403, content={"success": False, "error": "Forbidden"})

    url_hash = hashlib.sha256(url.encode()).hexdigest()[:16]
    ext = os.path.splitext(parsed.path)[1] or ".jpg"
    cache_path = os.path.join(_image_cache_dir, f"{url_hash}{ext}")

    if os.path.exists(cache_path):
        ct = "image/jpeg"
        if ext == ".png":
            ct = "image/png"
        elif ext == ".webp":
            ct = "image/webp"
        elif ext == ".gif":
            ct = "image/gif"
        elif ext == ".svg":
            ct = "image/svg+xml"
        with open(cache_path, "rb") as f:
            data = f.read()
        return StreamingResponse(
            iter([data]),
            media_type=ct,
            headers={"Cache-Control": "public, max-age=604800"},
        )

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return JSONResponse(status_code=502, content={"success": False, "error": "Upstream error"})
            content_type = resp.headers.get("content-type", "image/jpeg")
            img_data = resp.content
            try:
                with open(cache_path, "wb") as f:
                    f.write(img_data)
            except OSError:
                pass
            return StreamingResponse(
                iter([img_data]),
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=604800"},
            )
    except httpx.HTTPError:
        return JSONResponse(status_code=502, content={"success": False, "error": "Failed to fetch image"})


@app.get("/", response_class=HTMLResponse)
def page_index(request: Request):
    total = database.get_plugin_count()
    categories_count = len(database.get_all_categories())
    return templates.TemplateResponse("index.html", {
        "request": request,
        "total_plugins": total,
        "categories_count": categories_count,
    })


@app.get("/login", response_class=HTMLResponse)
def page_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
def page_register(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
def page_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/plugins", response_class=HTMLResponse)
def page_plugins(request: Request, page: int = 1, search: str = "", category: str = ""):
    per_page = 20
    if page < 1:
        page = 1
    plugins_raw = database.get_all_plugins(page=page, per_page=per_page, search=search or None, category=category or None)
    total = database.get_plugin_count(search=search or None, category=category or None)
    categories = database.get_all_categories()
    total_pages = max(1, (total + per_page - 1) // per_page)

    plugins = []
    for p in plugins_raw:
        thumb = p.get("thumbnail_url", "") or ""
        plugins.append({
            "slug": p.get("slug"),
            "name": p.get("name"),
            "description": p.get("description", ""),
            "version": p.get("version"),
            "category": p.get("category"),
            "thumbnail": f"/api/img?t={_img_token(thumb)}" if thumb else "",
            "updated_at": p.get("updated_at"),
        })

    return templates.TemplateResponse("plugins.html", {
        "request": request,
        "plugins": plugins,
        "total": total,
        "page": page,
        "total_pages": total_pages,
        "search": search,
        "category": category,
        "categories": categories,
    })


def _format_description_html(text: str) -> str:
    if not text:
        return "<p>Premium WordPress plugin available for instant download.</p>"
    escaped = html_mod.escape(text)
    sentences = re.split(r'(?<=[.!?])\s+', escaped)
    paragraphs = []
    current: list[str] = []
    for s in sentences:
        current.append(s)
        if len(current) >= 3:
            paragraphs.append(" ".join(current))
            current = []
    if current:
        paragraphs.append(" ".join(current))
    return "".join(f"<p>{p}</p>" for p in paragraphs)


@app.get("/plugin/{slug}", response_class=HTMLResponse)
def page_plugin_detail(request: Request, slug: str):
    plugin = database.get_plugin_by_slug(slug)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    thumb = plugin.get("thumbnail_url", "") or ""
    raw_desc = plugin.get("description", "") or ""
    file_hash = plugin.get("file_hash", "") or ""
    file_size = plugin.get("file_size_bytes", 0) or 0
    plugin_data = {
        "slug": plugin.get("slug"),
        "name": plugin.get("name"),
        "description": _format_description_html(raw_desc),
        "version": plugin.get("version"),
        "category": plugin.get("category"),
        "thumbnail": f"/api/img?t={_img_token(thumb)}" if thumb else "",
        "updated_at": plugin.get("updated_at"),
        "created_at": plugin.get("created_at"),
        "file_hash": file_hash,
        "file_size_bytes": file_size,
    }
    return templates.TemplateResponse("plugin_detail.html", {
        "request": request,
        "plugin": plugin_data,
    })


@app.get("/checkout", response_class=HTMLResponse)
def page_checkout(request: Request):
    return templates.TemplateResponse("checkout.html", {"request": request})


@app.get("/admin", response_class=HTMLResponse)
def page_admin(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})
