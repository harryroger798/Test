import json
import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["site-settings"])

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "site_settings.json")

DEFAULT_SETTINGS: Dict[str, Any] = {
    "cookie_consent_enabled": True,
}


def _load_settings() -> Dict[str, Any]:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                stored = json.load(f)
            merged = {**DEFAULT_SETTINGS, **stored}
            return merged
        except Exception as e:
            logger.warning(f"Failed to load site settings: {e}")
    return dict(DEFAULT_SETTINGS)


def _save_settings(settings: Dict[str, Any]) -> None:
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save site settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to save settings")


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


class SiteSettingsResponse(BaseModel):
    cookie_consent_enabled: bool


class SiteSettingsUpdate(BaseModel):
    cookie_consent_enabled: bool


@router.get("/api/public/site-settings", response_model=SiteSettingsResponse)
async def get_public_site_settings():
    settings = _load_settings()
    return SiteSettingsResponse(
        cookie_consent_enabled=settings.get("cookie_consent_enabled", True),
    )


@router.get("/api/admin/site-settings", response_model=SiteSettingsResponse)
async def get_admin_site_settings(admin: User = Depends(require_admin)):
    settings = _load_settings()
    return SiteSettingsResponse(
        cookie_consent_enabled=settings.get("cookie_consent_enabled", True),
    )


@router.put("/api/admin/site-settings", response_model=SiteSettingsResponse)
async def update_site_settings(
    update: SiteSettingsUpdate,
    admin: User = Depends(require_admin),
):
    settings = _load_settings()
    settings["cookie_consent_enabled"] = update.cookie_consent_enabled
    _save_settings(settings)
    logger.info(f"Site settings updated by admin {admin.email}: cookie_consent_enabled={update.cookie_consent_enabled}")
    return SiteSettingsResponse(
        cookie_consent_enabled=settings["cookie_consent_enabled"],
    )
