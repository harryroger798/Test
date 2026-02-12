import hashlib
import json
import logging
import time
import threading
import httpx
from typing import Optional, Dict, Any, List

from app.core.config import settings

logger = logging.getLogger(__name__)

_cache: Dict[str, Dict[str, Any]] = {}
_cache_lock = threading.Lock()
CACHE_TTL = 86400
MAX_CACHE_SIZE = 2000

HF_MODELS = {
    "tone-detector": "SamLowe/roberta-base-go_emotions",
    "flan-t5-base": "google/flan-t5-base",
    "translator-en-es": "Helsinki-NLP/opus-mt-en-es",
    "translator-en-hi": "Helsinki-NLP/opus-mt-en-hi",
    "translator-es-en": "Helsinki-NLP/opus-mt-es-en",
    "translator-en-fr": "Helsinki-NLP/opus-mt-en-fr",
    "translator-fr-en": "Helsinki-NLP/opus-mt-fr-en",
    "translator-en-de": "Helsinki-NLP/opus-mt-en-de",
    "translator-de-en": "Helsinki-NLP/opus-mt-de-en",
    "detector": "roberta-base-openai-detector",
    "humanizer": "google/flan-t5-base",
    "coedit-large": "grammarly/coedit-large",
}

HF_API_BASE = "https://api-inference.huggingface.co/models"


def _cache_key(model_key: str, payload: str) -> str:
    return hashlib.md5(f"{model_key}:{payload}".encode()).hexdigest()


def _get_cached(key: str) -> Optional[Any]:
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["ts"]) < CACHE_TTL:
            return entry["data"]
        if entry:
            del _cache[key]
    return None


def _set_cached(key: str, data: Any):
    with _cache_lock:
        if len(_cache) >= MAX_CACHE_SIZE:
            oldest_key = min(_cache, key=lambda k: _cache[k]["ts"])
            del _cache[oldest_key]
        _cache[key] = {"data": data, "ts": time.time()}


def _get_token() -> str:
    return getattr(settings, "HUGGINGFACE_API_KEY", "") or ""


def _call_hf_api(model_id: str, payload: Dict[str, Any], timeout: float = 30.0) -> Optional[Any]:
    token = _get_token()
    if not token:
        logger.warning("No HuggingFace API key configured")
        return None

    headers = {"Authorization": f"Bearer {token}"}
    url = f"{HF_API_BASE}/{model_id}"

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 503:
            logger.info(f"HF model {model_id} loading, retrying in 10s...")
            time.sleep(10)
            resp = httpx.post(url, headers=headers, json=payload, timeout=timeout)
            if resp.status_code == 200:
                return resp.json()
        logger.warning(f"HF API {model_id}: status {resp.status_code}")
        return None
    except Exception as e:
        logger.warning(f"HF API {model_id} failed: {e}")
        return None


class HFInferenceClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def invoke_text2text(
        self,
        model_key: str,
        input_text: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        model_id = HF_MODELS.get(model_key)
        if not model_id:
            logger.error(f"Unknown HF model key: {model_key}")
            return None

        payload: Dict[str, Any] = {"inputs": input_text}
        if parameters:
            payload["parameters"] = parameters

        ck = _cache_key(model_key, json.dumps(payload, sort_keys=True))
        cached = _get_cached(ck)
        if cached is not None:
            logger.info(f"HF cache hit for {model_key}")
            return cached

        t0 = time.time()
        result = _call_hf_api(model_id, payload)
        elapsed = time.time() - t0

        if result is None:
            return None

        text_out = None
        if isinstance(result, list) and len(result) > 0:
            text_out = result[0].get("generated_text", "")
        elif isinstance(result, dict):
            text_out = result.get("generated_text", "")

        if text_out:
            logger.info(f"HF {model_key} responded in {elapsed:.1f}s")
            _set_cached(ck, text_out)
            return text_out
        return None

    def invoke_classification(
        self,
        model_key: str,
        input_text: str,
        top_k: Optional[int] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        model_id = HF_MODELS.get(model_key)
        if not model_id:
            logger.error(f"Unknown HF model key: {model_key}")
            return None

        payload: Dict[str, Any] = {"inputs": input_text}
        if top_k is not None:
            payload["parameters"] = {"top_k": top_k}

        ck = _cache_key(model_key, json.dumps(payload, sort_keys=True))
        cached = _get_cached(ck)
        if cached is not None:
            logger.info(f"HF cache hit for {model_key}")
            return cached

        t0 = time.time()
        result = _call_hf_api(model_id, payload)
        elapsed = time.time() - t0

        if result is None:
            return None

        labels = None
        if isinstance(result, list) and len(result) > 0:
            if isinstance(result[0], list):
                labels = result[0]
            elif isinstance(result[0], dict):
                labels = result

        if labels:
            logger.info(f"HF {model_key} responded in {elapsed:.1f}s")
            _set_cached(ck, labels)
            return labels
        return None

    def invoke_translation(
        self,
        model_key: str,
        input_text: str,
    ) -> Optional[str]:
        model_id = HF_MODELS.get(model_key)
        if not model_id:
            logger.error(f"Unknown HF model key: {model_key}")
            return None

        payload = {"inputs": input_text}

        ck = _cache_key(model_key, json.dumps(payload, sort_keys=True))
        cached = _get_cached(ck)
        if cached is not None:
            logger.info(f"HF cache hit for {model_key}")
            return cached

        t0 = time.time()
        result = _call_hf_api(model_id, payload)
        elapsed = time.time() - t0

        if result is None:
            return None

        translated = None
        if isinstance(result, list) and len(result) > 0:
            translated = result[0].get("translation_text", "")

        if translated:
            logger.info(f"HF {model_key} responded in {elapsed:.1f}s")
            _set_cached(ck, translated)
            return translated
        return None

    def invoke_coedit(
        self,
        input_text: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        model_id = HF_MODELS.get("coedit-large")
        if not model_id:
            return None

        payload: Dict[str, Any] = {"inputs": input_text}
        if parameters:
            payload["parameters"] = parameters
        else:
            payload["parameters"] = {"max_new_tokens": 256}

        ck = _cache_key("coedit-large", json.dumps(payload, sort_keys=True))
        cached = _get_cached(ck)
        if cached is not None:
            logger.info("HF cache hit for coedit-large")
            return cached

        t0 = time.time()
        result = _call_hf_api(model_id, payload, timeout=60.0)
        elapsed = time.time() - t0

        if result is None:
            return None

        text_out = None
        if isinstance(result, list) and len(result) > 0:
            text_out = result[0].get("generated_text", "")
        elif isinstance(result, dict):
            text_out = result.get("generated_text", "")

        if text_out:
            logger.info(f"HF coedit-large responded in {elapsed:.1f}s")
            _set_cached(ck, text_out)
            return text_out
        return None

    def get_cache_stats(self) -> Dict[str, Any]:
        with _cache_lock:
            return {
                "size": len(_cache),
                "max_size": MAX_CACHE_SIZE,
                "ttl_seconds": CACHE_TTL,
            }


hf_client = HFInferenceClient()
