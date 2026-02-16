from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "TextShift"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database (SQLite for local dev, PostgreSQL for production)
    DATABASE_URL: str = "sqlite:///./textshift.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    SECRET_KEY: str = "textshift-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # PayPal
    PAYPAL_CLIENT_ID: str = "ATNvYPU61RI3s-JnjGotzLW4NZrXP6ApCXzJM2KsvuOFQK1QTKFGCAyesEWBhGnHPqKdX9gexjxYlN3l"
    PAYPAL_SECRET_KEY: str = "EAYgOzANLnaqQPqYU0_rnIoBCdkMP0l4a3GtAW5KvpyUQSH_zK7MZxoclvwbPXgLi9fo8KDIwLKx_REI"
    PAYPAL_MODE: str = "live"  # "sandbox" or "live"
    
    # iDrive e2 (S3-compatible)
    S3_ENDPOINT: str = "https://s3.us-west-1.idrivee2.com"
    S3_BUCKET: str = "crop-spray-uploads"
    S3_ACCESS_KEY: str = "EQQ53Vm4Cr9Rov1FsOPt"
    S3_SECRET_KEY: str = "far8XneFX3NH9UT6HFUjAAt9YZ3CB8RmJiCvKpe6"
    
    # ML Models paths
    MODELS_DIR: str = "/opt/textshift/models"
    DETECTOR_MODEL_PATH: str = "/opt/textshift/models/detector"
    HUMANIZER_MODEL_PATH: str = "/opt/textshift/models/humanizer"
    HUMANIZER_ONNX_MODEL_PATH: str = "/opt/textshift/models/humanizer_onnx"
    PLAGIARISM_MODEL_PATH: str = "/opt/textshift/models/plagiarism"
    TONE_DETECTOR_MODEL_PATH: str = "/opt/textshift/models/tone-detector"
    TRANSLATOR_MODELS_DIR: str = "/opt/textshift/models/translators"
    
    # External APIs (fallback)
    SERPER_API_KEY: str = "14e76cf7d90184e9053825ba67d99621705dc122"
    ORIGINALITY_API_KEY: str = "4mrg7suxpdhfi2ty6kq85ne9cz3ljowv"
    
    # HuggingFace API for LoRA training (set via environment variable)
    HUGGINGFACE_API_KEY: str = ""  # Set via HF_API_KEY environment variable
    HUGGINGFACE_MODEL_REPO: str = "harryroger798/textshift-lora-adapters"
    
    # Credit costs (per 1000 words) - 1 word = 1 credit for simplicity
    # AI Detection: 1 credit per word (minimum 100)
    # Humanize: 2 credits per word (minimum 100)
    # Plagiarism: 1.5 credits per word (minimum 100)
    CREDIT_COST_DETECT: int = 1  # per word
    CREDIT_COST_HUMANIZE: int = 2  # per word
    CREDIT_COST_PLAGIARISM: int = 1  # per word (rounded to 1.5 in calculation)
    
    # Pricing tiers (words per month)
    # FREE: 5,000 words/month (AI Detection only)
    # STARTER $9/mo: 25,000 words/month (All 3 tools)
    # PRO $19/mo: Unlimited (fair use: 500 scans/day)
    # ENTERPRISE $49/mo: True unlimited + Priority + White-label API
    FREE_TIER_CREDITS: int = 5000  # words
    STARTER_TIER_CREDITS: int = 25000  # words
    PRO_TIER_CREDITS: int = -1  # Unlimited (use -1 to indicate unlimited)
    ENTERPRISE_TIER_CREDITS: int = -1  # True unlimited
    
    # Daily scan limits for fair use
    FREE_DAILY_SCANS: int = 10
    STARTER_DAILY_SCANS: int = 100
    PRO_DAILY_SCANS: int = 500
    ENTERPRISE_DAILY_SCANS: int = -1  # Unlimited
    
    # Pricing (in USD)
    STARTER_PRICE: float = 9.0
    PRO_PRICE: float = 19.0
    ENTERPRISE_PRICE: float = 49.0
    
    # Mailgun Email Service
    MAILGUN_API_KEY: str = ""  # Set via environment variable
    MAILGUN_DOMAIN: str = "mail.textshift.org"
    MAILGUN_FROM_EMAIL: str = "noreply@mail.textshift.org"
    MAILGUN_FROM_NAME: str = "TextShift"
    
    # MTCaptcha
    MTCAPTCHA_PRIVATE_KEY: str = ""

    # Auth0
    AUTH0_DOMAIN: str = "textshift.us.auth0.com"
    AUTH0_CLIENT_ID: str = "7P4gnXh1bRHbGeIY0wWD8sC8IJ7zj8oO"
    AUTH0_AUDIENCE: str = "https://textshift.us.auth0.com/api/v2/"

    # Intercom
    INTERCOM_APP_ID: str = ""
    INTERCOM_ACCESS_TOKEN: str = ""
    INTERCOM_IDENTITY_SECRET: str = ""

    # AWS (for S3/SES services)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_DEFAULT_REGION: str = "us-east-1"

    # iDrive e2 (alternate env var names)
    IDRIVE_ACCESS_KEY: str = ""
    IDRIVE_SECRET_KEY: str = ""

    # Frontend URL for email links
    FRONTEND_URL: str = "https://textshift.org"
    
    # Password reset token expiry (in minutes)
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Intercom integration (optional)
    INTERCOM_APP_ID: str = ""
    INTERCOM_ACCESS_TOKEN: str = ""
    INTERCOM_IDENTITY_SECRET: str = ""
    
    # iDrive credentials (alternative naming)
    IDRIVE_ACCESS_KEY: str = ""
    IDRIVE_SECRET_KEY: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra environment variables


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
