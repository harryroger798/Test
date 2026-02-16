from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from contextlib import asynccontextmanager
import logging
import time
from collections import defaultdict

from app.core.database import engine, Base
from app.core.config import settings
from app.routers import auth, scan, credits, payment, api_keys, batch, contact, feedback, admin, admin_extended, promo, user_settings, email_campaigns, writing_tools, site_settings
from app.models import User, Scan, CreditTransaction, Subscription, APIKey  # Import models to register with Base
# Phase 3: Self-Learning ML System models
from app.models import UserFeedback, ModelVersion, TrainingRun, ABTestAssignment, ModelMetrics, TrainingSampleQueue
# Promo system models
from app.models import Promo, PromoRedemption
# Email campaign models
from app.models import EmailCampaign, EmailSend
# Humanized text hash tracking (for ensuring TextShift humanized outputs pass our detector)
from app.models import HumanizedTextHash

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._limits = {
            "/api/auth/login": (5, 60),
            "/api/auth/token": (5, 60),
            "/api/auth/register": (3, 3600),
            "/api/auth/forgot-password": (3, 3600),
            "/api/auth/resend-verification": (3, 3600),
            "/api/scan/detect": (15, 60),
            "/api/scan/humanize": (15, 60),
            "/api/scan/plagiarism": (15, 60),
        }
        self._default_limit = (60, 60)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        client_ip = self._get_client_ip(request)
        key = f"{client_ip}:{path}"

        max_requests, window = self._limits.get(path, self._default_limit)
        now = time.time()

        self._requests[key] = [t for t in self._requests[key] if now - t < window]

        if len(self._requests[key]) >= max_requests:
            return Response(
                content='{"detail":"Too many requests. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(window)},
            )

        self._requests[key].append(now)

        if len(self._requests) > 10000:
            cutoff = now - 3600
            keys_to_remove = [k for k, v in self._requests.items() if all(t < cutoff for t in v)]
            for k in keys_to_remove:
                del self._requests[k]

        return await call_next(request)


def _validate_secret_key():
    key = settings.SECRET_KEY
    if len(key) < 32:
        logger.warning("SECRET_KEY is shorter than 32 characters - this is insecure for production!")
    if key == "textshift-super-secret-key-change-in-production-2024":
        logger.warning("SECRET_KEY is using the default value - change it in production!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting TextShift API...")
    _validate_secret_key()
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    try:
        from app.services.ml_service import ml_service
        logger.info("Pre-loading AI Detector model (primary model)...")
        ml_service._load_detector()
        logger.info("AI Detector model pre-loaded successfully")
    except Exception as e:
        logger.warning(f"Failed to pre-load AI Detector (will load on first request): {e}")

    yield
    # Shutdown
    logger.info("Shutting down TextShift API...")


app = FastAPI(
    title="TextShift API",
    description="AI Content Detection, Humanization, and Plagiarism Checking Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://textshift.org",
        "https://www.textshift.org",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(credits.router)
app.include_router(payment.router)
app.include_router(api_keys.router)
app.include_router(batch.router)
app.include_router(contact.router)

# Phase 3: Self-Learning ML System routers
app.include_router(feedback.router)
app.include_router(admin.router)
app.include_router(admin_extended.router)

# Promo system router
app.include_router(promo.router)

# User settings router
app.include_router(user_settings.router)

# Email campaigns router
app.include_router(email_campaigns.router)
# Email tracking router (public, no auth required)
app.include_router(email_campaigns.tracking_router)

# Phase 4: Writing Tools router (14 new features)
app.include_router(writing_tools.router)

# Site settings router (public + admin)
app.include_router(site_settings.router)


@app.get("/healthz")
async def healthz():
    health = {"status": "ok", "checks": {}}

    try:
        from sqlalchemy import text as sa_text
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(sa_text("SELECT 1"))
            health["checks"]["database"] = "ok"
        except Exception as e:
            health["checks"]["database"] = f"error: {e}"
            health["status"] = "degraded"
        finally:
            db.close()
    except Exception as e:
        health["checks"]["database"] = f"error: {e}"
        health["status"] = "degraded"

    try:
        from app.services.ml_service import ml_service
        health["checks"]["detector_loaded"] = ml_service._detector_model is not None
        health["checks"]["humanizer_loaded"] = ml_service._humanizer_model is not None
        health["checks"]["plagiarism_loaded"] = ml_service._plagiarism_encoder is not None
    except Exception:
        health["checks"]["models"] = "unavailable"

    return health


@app.get("/api/info")
async def api_info():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "AI Content Detection, Humanization, and Plagiarism Checking Platform"
    }
