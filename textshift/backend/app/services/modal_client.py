import json
import logging
import time
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)

MODAL_ENDPOINT_URL = "https://textshift--textshift-humanizer-humanize-api.modal.run"

IST = timezone(timedelta(hours=5, minutes=30))

PEAK_START_HOUR = 21
PEAK_START_MINUTE = 0
PEAK_END_HOUR = 22
PEAK_END_MINUTE = 15


def is_peak_hours() -> bool:
    now_ist = datetime.now(IST)
    start = now_ist.replace(hour=PEAK_START_HOUR, minute=PEAK_START_MINUTE, second=0, microsecond=0)
    end = now_ist.replace(hour=PEAK_END_HOUR, minute=PEAK_END_MINUTE, second=0, microsecond=0)
    return start <= now_ist <= end


def get_inference_backend() -> str:
    has_sagemaker = bool(
        getattr(settings, "AWS_ACCESS_KEY_ID", "") and
        getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    )
    modal_url = getattr(settings, "MODAL_ENDPOINT_URL", MODAL_ENDPOINT_URL)
    has_modal = bool(modal_url)

    if is_peak_hours() and has_sagemaker:
        return "sagemaker"
    if has_modal:
        return "modal"
    if has_sagemaker:
        return "sagemaker"
    return "hf_api"


class ModalHumanizerClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _get_endpoint_url(self) -> str:
        return getattr(settings, "MODAL_ENDPOINT_URL", MODAL_ENDPOINT_URL)

    def humanize_batch(
        self,
        texts: List[str],
        parameters: Optional[Dict[str, Any]] = None,
        timeout: float = 180.0,
    ) -> List[Optional[str]]:
        url = self._get_endpoint_url()
        if not url:
            logger.warning("Modal endpoint URL not configured")
            return [None] * len(texts)

        payload: Dict[str, Any] = {"texts": texts}
        if parameters:
            payload["parameters"] = parameters

        try:
            t0 = time.time()
            response = httpx.post(url, json=payload, timeout=timeout)
            elapsed = time.time() - t0

            if response.status_code != 200:
                logger.warning(f"Modal endpoint returned status {response.status_code}: {response.text[:200]}")
                return [None] * len(texts)

            data = response.json()
            results = data.get("results", [])
            modal_elapsed = data.get("elapsed_seconds", 0)
            logger.info(
                f"Modal humanizer: {len(texts)} texts in {elapsed:.1f}s "
                f"(server: {modal_elapsed}s)"
            )

            while len(results) < len(texts):
                results.append(None)
            return results

        except httpx.TimeoutException:
            logger.warning(f"Modal endpoint timed out after {timeout}s for {len(texts)} texts")
            return [None] * len(texts)
        except Exception as e:
            logger.warning(f"Modal humanizer failed: {e}")
            return [None] * len(texts)

    def humanize_single(
        self,
        text: str,
        parameters: Optional[Dict[str, Any]] = None,
        timeout: float = 120.0,
    ) -> Optional[str]:
        url = self._get_endpoint_url()
        if not url:
            return None

        payload: Dict[str, Any] = {"text": text}
        if parameters:
            payload["parameters"] = parameters

        try:
            t0 = time.time()
            response = httpx.post(url, json=payload, timeout=timeout)
            elapsed = time.time() - t0

            if response.status_code != 200:
                logger.warning(f"Modal single humanize returned {response.status_code}")
                return None

            data = response.json()
            results = data.get("results", [])
            if results and results[0]:
                logger.info(f"Modal single humanize in {elapsed:.1f}s")
                return results[0]
            return None

        except Exception as e:
            logger.warning(f"Modal single humanize failed: {e}")
            return None

    def health_check(self) -> bool:
        url = self._get_endpoint_url()
        if not url:
            return False
        try:
            response = httpx.post(
                url,
                json={"text": "humanize: test", "parameters": {"max_new_tokens": 10}},
                timeout=30.0,
            )
            return response.status_code == 200
        except Exception:
            return False


modal_client = ModalHumanizerClient()
