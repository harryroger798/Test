from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.database import engine, Base
from app.core.config import settings
from app.routers import auth, scan, credits, payment, api_keys, batch, contact, feedback, admin, admin_extended, promo, user_settings, email_campaigns, writing_tools, intercom
from app.models import User, Scan, CreditTransaction, Subscription, APIKey  # Import models to register with Base
# Phase 3: Self-Learning ML System models
from app.models import UserFeedback, ModelVersion, TrainingRun, ABTestAssignment, ModelMetrics, TrainingSampleQueue
# Promo system models
from app.models import Promo, PromoRedemption
# Email campaign models
from app.models import EmailCampaign, EmailSend

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting TextShift API...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    yield
    # Shutdown
    logger.info("Shutting down TextShift API...")


app = FastAPI(
    title="TextShift API",
    description="AI Content Detection, Humanization, and Plagiarism Checking Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
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

# Intercom integration router
app.include_router(intercom.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/info")
async def api_info():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "AI Content Detection, Humanization, and Plagiarism Checking Platform"
    }
