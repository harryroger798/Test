from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import SubscriptionTier


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    captcha_token: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    subscription_tier: SubscriptionTier
    credits_balance: int
    credits_used_total: int
    is_active: bool
    is_admin: bool
    is_verified: bool
    email_notifications: bool = True
    marketing_emails: bool = False
    billing_period: str = "monthly"
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class UserSettingsUpdate(BaseModel):
    full_name: Optional[str] = None
    email_notifications: Optional[bool] = None
    marketing_emails: Optional[bool] = None


class CreditTopUpRequest(BaseModel):
    package: str  # "10k", "25k", "50k", "100k"


class CreditTopUpResponse(BaseModel):
    success: bool
    credits_added: int
    new_balance: int
    package: str
    price: float
