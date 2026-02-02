from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.security import (
    verify_password, 
    get_password_hash, 
    create_access_token,
    get_current_user,
    get_current_active_user
)
from app.core.config import settings
from app.core.rate_limit import limiter
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

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")
async def register(
    request: Request,
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Register a new user."""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
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
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with email and password (form data)."""
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
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
    
    # Update last login
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


from pydantic import BaseModel

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/token", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login_json(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login with email and password (JSON body) - for API access."""
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
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
    
    # Update last login
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    # Create access token
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
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    forgot_request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Request a password reset email."""
    user = db.query(User).filter(User.email == forgot_request.email).first()
    
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
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    reset_request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using the token from email."""
    user = db.query(User).filter(
        User.password_reset_token == reset_request.token,
        User.password_reset_token_expires_at > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user.hashed_password = get_password_hash(reset_request.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires_at = None
    db.commit()
    
    return {"message": "Password has been reset successfully"}


@router.post("/verify-email")
@limiter.limit("5/minute")
async def verify_email(
    request: Request,
    verify_request: VerifyEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Verify email using the token from email."""
    user = db.query(User).filter(
        User.verification_token == verify_request.token,
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
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    resend_request: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Resend email verification link."""
    user = db.query(User).filter(User.email == resend_request.email).first()
    
    if not user:
        # Don't reveal if email exists or not for security
        return {"message": "If an unverified account with that email exists, a verification link has been sent.", "sent": False}
    
    if user.is_verified:
        # Account is already verified - let frontend know
        return {"message": "This email is already verified. You can log in to your account.", "already_verified": True, "sent": False}
    
    # User exists and is not verified - send verification email
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
