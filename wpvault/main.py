import os
import re
import logging
import threading
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import database
import auth
import payments
import storage
import watcher

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
    plugins = database.get_all_plugins(page=page, per_page=20, search=search, category=category)
    total = database.get_plugin_count(search=search, category=category)
    categories = database.get_all_categories()

    safe_plugins = []
    for p in plugins:
        safe_plugins.append({
            "slug": p.get("slug"),
            "name": p.get("name"),
            "description": p.get("description", ""),
            "version": p.get("version"),
            "category": p.get("category"),
            "thumbnail_url": p.get("thumbnail_url", ""),
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
    safe = {
        "slug": plugin.get("slug"),
        "name": plugin.get("name"),
        "description": plugin.get("description", ""),
        "version": plugin.get("version"),
        "category": plugin.get("category"),
        "thumbnail_url": plugin.get("thumbnail_url", ""),
        "is_plugin": plugin.get("is_plugin", 1),
        "file_size_bytes": plugin.get("file_size_bytes", 0),
        "source_url": plugin.get("source_url", ""),
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
    if not file_key:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "File not available"}
        )

    presigned_url = storage.generate_presigned_url(file_key, expires_in=3600)
    if not presigned_url:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Could not generate download link"}
        )

    database.log_download(user["id"], plugin["id"])

    return JSONResponse(content={
        "success": True,
        "data": {
            "download_url": presigned_url,
            "expires_in": 3600
        }
    })


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
        storage.delete_file(file_key)

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

    if _sync_running:
        _sync_lock.release()
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


@app.get("/", response_class=HTMLResponse)
def page_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


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
def page_plugins(request: Request):
    return templates.TemplateResponse("plugins.html", {"request": request})


@app.get("/plugins/{slug}", response_class=HTMLResponse)
def page_plugin_detail(request: Request, slug: str):
    return templates.TemplateResponse("plugin_detail.html", {"request": request, "slug": slug})


@app.get("/checkout", response_class=HTMLResponse)
def page_checkout(request: Request):
    return templates.TemplateResponse("checkout.html", {"request": request})


@app.get("/admin", response_class=HTMLResponse)
def page_admin(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})
