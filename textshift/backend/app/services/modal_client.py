import logging
import time
import threading
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)

MODAL_HUMANIZER_URL = "https://textshift--textshift-humanizer-humanizermodel-humanize-api.modal.run"
MODAL_MULTIMODEL_URL = "https://textshift--textshift-multimodel-multimodelendpoint-predict.modal.run"

IST = timezone(timedelta(hours=5, minutes=30))

PEAK_START_HOUR = 21
PEAK_START_MINUTE = 0
PEAK_END_HOUR = 22
PEAK_END_MINUTE = 15


def is_peak_hours() -> bool:
    """Check if current IST time is within peak hours (21:00-22:15 IST)."""
    now_ist = datetime.now(IST)
    start = now_ist.replace(hour=PEAK_START_HOUR, minute=PEAK_START_MINUTE, second=0, microsecond=0)
    end = now_ist.replace(hour=PEAK_END_HOUR, minute=PEAK_END_MINUTE, second=0, microsecond=0)
    return start <= now_ist <= end


def get_inference_backend() -> str:
    """Determine which inference backend to use based on time and availability.
    
    Returns:
        'sagemaker' during peak hours (21:00-22:15 IST) if AWS credentials available,
        'modal' during off-peak if Modal URL configured,
        'hf_api' as final fallback.
    """
    has_sagemaker = bool(
        getattr(settings, "AWS_ACCESS_KEY_ID", "") and
        getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    )
    modal_url = getattr(settings, "MODAL_MULTIMODEL_URL", MODAL_MULTIMODEL_URL)
    has_modal = bool(modal_url)

    if is_peak_hours() and has_sagemaker:
        return "sagemaker"
    if has_modal:
        return "modal"
    if has_sagemaker:
        return "sagemaker"
    return "hf_api"


class ModalHumanizerClient:
    """HTTP client for Modal.com serverless GPU humanizer endpoint.
    
    Singleton pattern ensures single instance across the application.
    Supports both batch and single-text humanization with automatic fallback.
    Uses a persistent httpx.Client for connection pooling/reuse.
    """
    _instance = None
    _http_client: Optional[httpx.Client] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._http_client = httpx.Client(timeout=180.0)
        return cls._instance

    def _get_client(self) -> httpx.Client:
        """Get or create persistent HTTP client for connection reuse."""
        if self._http_client is None:
            self._http_client = httpx.Client(timeout=180.0)
        return self._http_client

    def _get_endpoint_url(self) -> str:
        """Get Modal endpoint URL from settings or use default."""
        return getattr(settings, "MODAL_HUMANIZER_URL", MODAL_HUMANIZER_URL)

    def humanize_batch(
        self,
        texts: List[str],
        parameters: Optional[Dict[str, Any]] = None,
        timeout: float = 180.0,
    ) -> List[Optional[str]]:
        """Humanize multiple texts in a single batch request.
        
        Args:
            texts: List of texts to humanize (with 'humanize: ' prefix).
            parameters: Optional generation parameters (max_new_tokens, temperature, etc.).
            timeout: Request timeout in seconds.
            
        Returns:
            List of humanized texts, with None for any failed items.
        """
        url = self._get_endpoint_url()
        if not url:
            logger.warning("Modal endpoint URL not configured")
            return [None] * len(texts)

        payload: Dict[str, Any] = {"texts": texts}
        if parameters:
            payload["parameters"] = parameters

        try:
            client = self._get_client()
            t0 = time.time()
            response = client.post(url, json=payload, timeout=timeout)
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
        """Humanize a single text via Modal endpoint.
        
        Args:
            text: Text to humanize (with 'humanize: ' prefix).
            parameters: Optional generation parameters.
            timeout: Request timeout in seconds.
            
        Returns:
            Humanized text or None if request failed.
        """
        url = self._get_endpoint_url()
        if not url:
            return None

        payload: Dict[str, Any] = {"text": text}
        if parameters:
            payload["parameters"] = parameters

        try:
            client = self._get_client()
            t0 = time.time()
            response = client.post(url, json=payload, timeout=timeout)
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

    def close(self) -> None:
        """Close the persistent HTTP client to release sockets."""
        with self._lock:
            client = self._http_client
            self._http_client = None
        if client is not None:
            client.close()

    def health_check(self) -> bool:
        """Check if Modal endpoint is responsive."""
        url = self._get_endpoint_url()
        if not url:
            return False
        try:
            client = self._get_client()
            response = client.post(
                url,
                json={"text": "humanize: test", "parameters": {"max_new_tokens": 10}},
                timeout=30.0,
            )
            return response.status_code == 200
        except Exception:
            return False


modal_client = ModalHumanizerClient()


class ModalMultiModelClient:
    _instance = None
    _http_client: Optional[httpx.Client] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._http_client = httpx.Client(timeout=180.0)
        return cls._instance

    def _get_client(self) -> httpx.Client:
        if self._http_client is None:
            self._http_client = httpx.Client(timeout=180.0)
        return self._http_client

    def _get_endpoint_url(self) -> str:
        return getattr(settings, "MODAL_MULTIMODEL_URL", MODAL_MULTIMODEL_URL)

    def _invoke(self, model_name: str, inputs: str, parameters: Optional[Dict[str, Any]] = None, timeout: float = 120.0) -> Optional[Any]:
        url = self._get_endpoint_url()
        if not url:
            return None
        payload: Dict[str, Any] = {"model_name": model_name, "inputs": inputs}
        if parameters:
            payload["parameters"] = parameters
        try:
            client = self._get_client()
            t0 = time.time()
            response = client.post(url, json=payload, timeout=timeout)
            elapsed = time.time() - t0
            if response.status_code != 200:
                logger.warning(f"Modal multimodel [{model_name}] returned {response.status_code}")
                return None
            data = response.json()
            if "error" in data:
                logger.warning(f"Modal multimodel [{model_name}] error: {data['error']}")
                return None
            logger.info(f"Modal multimodel [{model_name}] responded in {elapsed:.1f}s (server: {data.get('elapsed_seconds', 0)}s)")
            return data.get("results")
        except httpx.TimeoutException:
            logger.warning(f"Modal multimodel [{model_name}] timed out after {timeout}s")
            return None
        except Exception as e:
            logger.warning(f"Modal multimodel [{model_name}] failed: {e}")
            return None

    def invoke_text2text(self, model_name: str, input_text: str, parameters: Optional[Dict[str, Any]] = None) -> Optional[str]:
        results = self._invoke(model_name, input_text, parameters)
        if results and isinstance(results, list) and len(results) > 0:
            return results[0].get("generated_text", "")
        return None

    def invoke_classification(self, model_name: str, input_text: str, top_k: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        params = {"top_k": top_k} if top_k is not None else None
        results = self._invoke(model_name, input_text, params)
        if results and isinstance(results, list) and len(results) > 0:
            if isinstance(results[0], list):
                return results[0]
            return results
        return None

    def invoke_translation(self, model_name: str, input_text: str) -> Optional[str]:
        results = self._invoke(model_name, input_text)
        if results and isinstance(results, list) and len(results) > 0:
            return results[0].get("translation_text", "")
        return None

    def close(self) -> None:
        """Close the persistent HTTP client to release sockets."""
        with self._lock:
            client = self._http_client
            self._http_client = None
        if client is not None:
            client.close()

    def invoke_embedding(self, model_name: str = "sbert", input_text: str = "") -> Optional[List[float]]:
        results = self._invoke(model_name, input_text)
        if results and isinstance(results, list) and len(results) > 0:
            return results[0].get("embedding")
        return None

    def invoke_text2text_batch(self, model_name: str, inputs: List[str], parameters: Optional[Dict[str, Any]] = None, max_workers: int = 4) -> List[Optional[str]]:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        results: List[Optional[str]] = [None] * len(inputs)
        if not inputs:
            return results

        def _invoke_single(idx: int, text: str):
            return idx, self.invoke_text2text(model_name, text, parameters)

        t0 = time.time()
        with ThreadPoolExecutor(max_workers=min(len(inputs), max_workers)) as executor:
            futures = {executor.submit(_invoke_single, i, t): i for i, t in enumerate(inputs)}
            for future in as_completed(futures):
                try:
                    idx, result = future.result()
                    results[idx] = result
                except Exception as e:
                    logger.warning(f"Modal batch [{model_name}] chunk {futures[future]} failed: {e}")
        elapsed = time.time() - t0
        succeeded = sum(1 for r in results if r is not None)
        logger.info(f"Modal batch [{model_name}]: {succeeded}/{len(inputs)} in {elapsed:.1f}s")
        return results

    def invoke_translation_batch(self, model_name: str, inputs: List[str], max_workers: int = 4) -> List[Optional[str]]:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        results: List[Optional[str]] = [None] * len(inputs)
        if not inputs:
            return results

        def _invoke_single(idx: int, text: str):
            return idx, self.invoke_translation(model_name, text)

        t0 = time.time()
        with ThreadPoolExecutor(max_workers=min(len(inputs), max_workers)) as executor:
            futures = {executor.submit(_invoke_single, i, t): i for i, t in enumerate(inputs)}
            for future in as_completed(futures):
                try:
                    idx, result = future.result()
                    results[idx] = result
                except Exception as e:
                    logger.warning(f"Modal translation batch [{model_name}] chunk {futures[future]} failed: {e}")
        elapsed = time.time() - t0
        succeeded = sum(1 for r in results if r is not None)
        logger.info(f"Modal translation batch [{model_name}]: {succeeded}/{len(inputs)} in {elapsed:.1f}s")
        return results


modal_multimodel_client = ModalMultiModelClient()
