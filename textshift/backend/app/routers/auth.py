from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from collections import defaultdict
import time
import logging
from app.core.database import get_db
from app.core.security import (
    verify_password, 
    get_password_hash, 
    create_access_token,
    get_current_user,
    get_current_active_user
)
from app.core.config import settings
from app.models.user import User
from app.schemas.user import (
    UserCreate, 
    UserResponse, 
    TokenResponse,
    PasswordChange,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
    ResendVerificationRequest
)
from app.services.email_service import email_service, generate_token
from app.core.captcha import verify_captcha_token
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

MAX_FAILED_ATTEMPTS = 10
LOCKOUT_DURATION_MINUTES = 30
_failed_attempts: dict[str, list[float]] = defaultdict(list)


def _check_account_lockout(email: str):
    now = time.time()
    cutoff = now - (LOCKOUT_DURATION_MINUTES * 60)
    _failed_attempts[email] = [t for t in _failed_attempts[email] if t > cutoff]
    if len(_failed_attempts[email]) >= MAX_FAILED_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked due to too many failed login attempts. Try again in {LOCKOUT_DURATION_MINUTES} minutes."
        )


def _record_failed_attempt(email: str):
    _failed_attempts[email].append(time.time())


def _clear_failed_attempts(email: str):
    _failed_attempts.pop(email, None)


@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new user."""
    if not await verify_captcha_token(user_data.captcha_token or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed. Please try again."
        )

    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please try a different email address."
        )
    
    # Generate verification token
    verification_token = generate_token()
    
    # Create new user
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        credits_balance=settings.FREE_TIER_CREDITS,
        verification_token=verification_token,
        verification_token_expires_at=datetime.utcnow() + timedelta(
            minutes=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES
        )
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send verification email in background (welcome email sent after verification)
    background_tasks.add_task(
        email_service.send_verification_email,
        user.email,
        verification_token
    )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with email and password (form data)."""
    _check_account_lockout(form_data.username)
    
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        _record_failed_attempt(form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is disabled"
        )
    
    _clear_failed_attempts(form_data.username)
    
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    email: str
    password: str
    captcha_token: Optional[str] = None

@router.post("/token", response_model=TokenResponse)
async def login_json(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login with email and password (JSON body) - for API access."""
    if not await verify_captcha_token(login_data.captcha_token or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed. Please try again."
        )

    _check_account_lockout(login_data.email)
    
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        _record_failed_attempt(login_data.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is disabled"
        )
    
    _clear_failed_attempts(login_data.email)
    
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Request a password reset email."""
    user = db.query(User).filter(User.email == request.email).first()
    
    if user:
        token = generate_token()
        user.password_reset_token = token
        user.password_reset_token_expires_at = datetime.utcnow() + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )
        db.commit()
        
        background_tasks.add_task(
            email_service.send_password_reset_email,
            user.email,
            token
        )
    
    return {"message": "If an account with that email exists, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using the token from email."""
    user = db.query(User).filter(
        User.password_reset_token == request.token,
        User.password_reset_token_expires_at > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user.hashed_password = get_password_hash(request.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires_at = None
    db.commit()
    
    return {"message": "Password has been reset successfully"}


@router.post("/verify-email")
async def verify_email(
    request: VerifyEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Verify email using the token from email."""
    user = db.query(User).filter(
        User.verification_token == request.token,
        User.verification_token_expires_at > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()
    
    # Send welcome email now that email is verified
    background_tasks.add_task(
        email_service.send_welcome_email,
        user.email,
        user.full_name
    )
    
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    request: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend email verification link."""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        return {"message": "If an unverified account with that email exists, a verification link has been sent.", "sent": False}
    
    if user.is_verified:
        return {"message": "This email is already verified. You can log in to your account.", "already_verified": True, "sent": False}
    
    token = generate_token()
    user.verification_token = token
    user.verification_token_expires_at = datetime.utcnow() + timedelta(
        minutes=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES
    )
    db.commit()
    
    background_tasks.add_task(
        email_service.send_verification_email,
        user.email,
        token
    )
    
    return {"message": "Verification email sent successfully.", "sent": True}


class Auth0TokenExchange(BaseModel):
    access_token: str


@router.post("/auth0/callback", response_model=TokenResponse)
async def auth0_callback(
    payload: Auth0TokenExchange,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Exchange Auth0 access token for a local JWT. Creates user if needed."""
    try:
        userinfo_resp = httpx.get(
            f"https://{settings.AUTH0_DOMAIN}/userinfo",
            headers={"Authorization": f"Bearer {payload.access_token}"},
            timeout=10,
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Auth0 token",
            )
        userinfo = userinfo_resp.json()
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to verify Auth0 token",
        )

    auth0_sub = userinfo.get("sub", "")
    email = userinfo.get("email", "")
    name = userinfo.get("name") or userinfo.get("nickname") or ""
    email_verified = userinfo.get("email_verified", False)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by identity provider",
        )

    provider = "auth0"
    if auth0_sub.startswith("google-oauth2|"):
        provider = "google"
    elif auth0_sub.startswith("github|"):
        provider = "github"
    elif auth0_sub.startswith("windowslive|"):
        provider = "microsoft"

    user = db.query(User).filter(User.auth0_sub == auth0_sub).first()

    if user is None:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.auth0_sub = auth0_sub
            user.auth_provider = provider
            if email_verified and not user.is_verified:
                user.is_verified = True
            db.commit()
        else:
            from app.core.security import get_password_hash
            import secrets
            user = User(
                email=email,
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                full_name=name,
                auth0_sub=auth0_sub,
                auth_provider=provider,
                is_verified=email_verified,
                credits_balance=settings.FREE_TIER_CREDITS,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            if email_verified:
                background_tasks.add_task(
                    email_service.send_welcome_email,
                    user.email,
                    user.full_name,
                )

    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )
