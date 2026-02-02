"""
Intercom Integration Router

Provides endpoints for:
- Getting user hash for identity verification
- Syncing user data to Intercom
"""

from fastapi import APIRouter, Depends
from app.core.security import get_current_active_user
from app.models.user import User
from app.services.intercom_service import intercom_service
from app.core.config import settings
from pydantic import BaseModel
from typing import Optional


router = APIRouter(prefix="/api/intercom", tags=["Intercom"])


class IntercomUserData(BaseModel):
    """Response model for Intercom user data."""
    app_id: str
    user_hash: str
    user_id: str
    email: str
    name: str
    created_at: int
    custom_attributes: dict


@router.get("/user-data", response_model=IntercomUserData)
async def get_intercom_user_data(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get Intercom user data including identity verification hash.
    
    This endpoint provides all the data needed to initialize
    Intercom on the frontend with identity verification.
    """
    user_id = str(current_user.id)
    user_hash = intercom_service.generate_user_hash(user_id)
    
    created_at = int(current_user.created_at.timestamp()) if current_user.created_at else 0
    
    custom_attributes = {
        "subscription_tier": current_user.subscription_tier or "free",
        "credits_balance": current_user.credits_balance or 0,
        "is_verified": current_user.is_verified,
        "total_scans": getattr(current_user, 'total_scans', 0),
    }
    
    return IntercomUserData(
        app_id=settings.INTERCOM_APP_ID,
        user_hash=user_hash,
        user_id=user_id,
        email=current_user.email,
        name=current_user.full_name or current_user.email.split('@')[0],
        created_at=created_at,
        custom_attributes=custom_attributes
    )


class IntercomHashResponse(BaseModel):
    """Simple response with just the user hash."""
    user_hash: str


@router.get("/hash", response_model=IntercomHashResponse)
async def get_intercom_hash(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get just the Intercom identity verification hash.
    
    Lightweight endpoint for refreshing the hash if needed.
    """
    user_id = str(current_user.id)
    user_hash = intercom_service.generate_user_hash(user_id)
    
    return IntercomHashResponse(user_hash=user_hash)
