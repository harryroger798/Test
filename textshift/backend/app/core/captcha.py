import httpx
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)

MTCAPTCHA_VERIFY_URL = "https://service.mtcaptcha.com/mtcv1/api/checktoken"


async def verify_captcha_token(token: str) -> bool:
    settings = get_settings()
    private_key = settings.MTCAPTCHA_PRIVATE_KEY
    if not private_key:
        logger.error("MTCAPTCHA_PRIVATE_KEY not set; captcha verification disabled")
        return settings.DEBUG

    if not token:
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                MTCAPTCHA_VERIFY_URL,
                params={"privatekey": private_key, "token": token},
            )
            data = resp.json()
            success = data.get("success", False)
            if not success:
                logger.warning(f"Captcha verification failed: {data}")
            return success
    except Exception as e:
        logger.error(f"Captcha verification error: {e}")
        return False
