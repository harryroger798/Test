import hashlib
import json
import logging
import time
import threading
from typing import Optional, Dict, Any, List

from huggingface_hub import InferenceClient as _HFClient
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
    "detector": "openai-community/roberta-base-openai-detector",
    "humanizer": "google/flan-t5-base",
    "coedit-large": "grammarly/coedit-large",
}

HF_CLASSIFICATION_MODELS = {"tone-detector", "detector"}
HF_TRANSLATION_MODELS = {
    "translator-en-es", "translator-en-hi", "translator-es-en",
    "translator-en-fr", "translator-fr-en", "translator-en-de", "translator-de-en",
}
HF_UNSUPPORTED_MODELS = {"flan-t5-base", "humanizer", "coedit-large"}


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


_client_instance: Optional[_HFClient] = None
_client_lock = threading.Lock()


def _get_client() -> Optional[_HFClient]:
    global _client_instance
    if _client_instance is not None:
        return _client_instance
    with _client_lock:
        if _client_instance is not None:
            return _client_instance
        token = _get_token()
        if not token:
            logger.warning("No HuggingFace API key configured")
            return None
        _client_instance = _HFClient(api_key=token, timeout=30)
        return _client_instance


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
        if model_key in HF_UNSUPPORTED_MODELS:
            return None
        model_id = HF_MODELS.get(model_key)
        if not model_id:
            return None

        cache_payload = json.dumps({"model": model_key, "input": input_text, "params": parameters or {}}, sort_keys=True)
        ck = _cache_key(model_key, cache_payload)
        cached = _get_cached(ck)
        if cached is not None:
            logger.info(f"HF cache hit for {model_key}")
            return cached

        return None

    def invoke_classification(
        self,
        model_key: str,
        input_text: str,
        top_k: Optional[int] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        if model_key not in HF_CLASSIFICATION_MODELS:
            return None
        model_id = HF_MODELS.get(model_key)
        if not model_id:
            return None

        cache_payload = json.dumps({"model": model_key, "input": input_text, "top_k": top_k}, sort_keys=True)
        ck = _cache_key(model_key, cache_payload)
        cached = _get_cached(ck)
        if cached is not None:
            logger.info(f"HF cache hit for {model_key}")
            return cached

        client = _get_client()
        if not client:
            return None

        t0 = time.time()
        try:
            result = client.text_classification(
                text=input_text,
                model=model_id,
                top_k=top_k,
            )
            elapsed = time.time() - t0
            if result:
                labels = [{"label": item.label, "score": item.score} for item in result]
                logger.info(f"HF {model_key} responded in {elapsed:.1f}s")
                _set_cached(ck, labels)
                return labels
            return None
        except Exception as e:
            logger.warning(f"HF API classification {model_key} failed: {e}")
            return None

    def invoke_translation(
        self,
        model_key: str,
        input_text: str,
    ) -> Optional[str]:
        if model_key not in HF_TRANSLATION_MODELS:
            return None
        model_id = HF_MODELS.get(model_key)
        if not model_id:
            return None

        cache_payload = json.dumps({"model": model_key, "input": input_text}, sort_keys=True)
        ck = _cache_key(model_key, cache_payload)
        cached = _get_cached(ck)
        if cached is not None:
            logger.info(f"HF cache hit for {model_key}")
            return cached

        client = _get_client()
        if not client:
            return None

        t0 = time.time()
        try:
            result = client.translation(
                text=input_text,
                model=model_id,
            )
            elapsed = time.time() - t0
            translated = result.translation_text if hasattr(result, "translation_text") else str(result)
            if translated:
                logger.info(f"HF {model_key} responded in {elapsed:.1f}s")
                _set_cached(ck, translated)
                return translated
            return None
        except Exception as e:
            logger.warning(f"HF API translation {model_key} failed: {e}")
            return None

    def invoke_coedit(
        self,
        input_text: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        cache_payload = json.dumps({"model": "coedit-large", "input": input_text, "params": parameters or {}}, sort_keys=True)
        ck = _cache_key("coedit-large", cache_payload)
        cached = _get_cached(ck)
        if cached is not None:
            logger.info("HF cache hit for coedit-large")
            return cached
        return None

    def get_cache_stats(self) -> Dict[str, Any]:
        with _cache_lock:
            return {
                "size": len(_cache),
                "max_size": MAX_CACHE_SIZE,
                "ttl_seconds": CACHE_TTL,
            }


hf_client = HFInferenceClient()
