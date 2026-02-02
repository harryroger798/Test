from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import time
import traceback
import os
from datetime import datetime

from app.core.database import engine, Base, SessionLocal
from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.routers import auth, scan, credits, payment, api_keys, batch, contact, feedback, admin, admin_extended, promo, user_settings, email_campaigns, writing_tools
from app.models import User, Scan, CreditTransaction, Subscription, APIKey  # Import models to register with Base
# Phase 3: Self-Learning ML System models
from app.models import UserFeedback, ModelVersion, TrainingRun, ABTestAssignment, ModelMetrics, TrainingSampleQueue
# Promo system models
from app.models import Promo, PromoRedemption
# Email campaign models
from app.models import EmailCampaign, EmailSend

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
access_logger = logging.getLogger("textshift.access")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting TextShift API...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    yield
    # Graceful Shutdown
    logger.info("Shutting down TextShift API gracefully...")
    # Allow in-flight requests to complete
    import asyncio
    await asyncio.sleep(2)
    # Close database connections
    engine.dispose()
    logger.info("Database connections closed")
    logger.info("TextShift API shutdown complete")


app = FastAPI(
    title="TextShift API",
    description="AI Content Detection, Humanization, and Plagiarism Checking Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_tags=[
        {"name": "Authentication", "description": "User authentication and account management"},
        {"name": "Scan", "description": "AI detection, humanization, and plagiarism checking"},
        {"name": "Credits", "description": "Credit balance and transaction management"},
        {"name": "Payment", "description": "Subscription and payment processing"},
        {"name": "Tools", "description": "Writing tools and utilities"},
        {"name": "Admin", "description": "Administrative functions"},
    ]
)

# CORS Configuration - Restricted to specific origins for security
ALLOWED_ORIGINS = [
    "https://textshift.org",
    "https://www.textshift.org",
]

# Add localhost for development
if os.getenv("ENVIRONMENT", "production") == "development":
    ALLOWED_ORIGINS.extend([
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Get client IP (handle proxy headers)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    # Log request details
    access_logger.info(
        f"{request.method} {request.url.path} "
        f"status={response.status_code} "
        f"duration={duration:.3f}s "
        f"ip={client_ip}"
    )
    
    return response


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full error for debugging
    logger.error(f"Unhandled exception: {traceback.format_exc()}")
    
    # Return generic message to client (don't leak implementation details)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred. Please try again later.",
            "error_code": "INTERNAL_ERROR"
        }
    )


# Rate Limiting - Register with app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

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


@app.get("/healthz")
async def healthz():
    """Enhanced health check with dependency verification."""
    health_status = {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION,
        "checks": {}
    }
    
    # Check database connectivity
    try:
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health_status["checks"]["database"] = {"status": "healthy"}
    except Exception as e:
        health_status["checks"]["database"] = {"status": "unhealthy", "error": str(e)}
        health_status["status"] = "degraded"
    
    # Check Redis connectivity (if configured)
    try:
        import redis
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(redis_url)
        r.ping()
        health_status["checks"]["redis"] = {"status": "healthy"}
    except Exception as e:
        health_status["checks"]["redis"] = {"status": "unhealthy", "error": str(e)}
        # Redis is optional, don't mark as degraded
    
    # Check ML models loaded (basic check)
    try:
        from app.services.ml_service import ml_service
        if ml_service and hasattr(ml_service, 'ai_detector_model'):
            health_status["checks"]["ml_models"] = {"status": "healthy"}
        else:
            health_status["checks"]["ml_models"] = {"status": "not_loaded"}
    except Exception as e:
        health_status["checks"]["ml_models"] = {"status": "unavailable", "error": str(e)}
    
    return health_status


@app.get("/api/info")
async def api_info():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "AI Content Detection, Humanization, and Plagiarism Checking Platform"
    }
