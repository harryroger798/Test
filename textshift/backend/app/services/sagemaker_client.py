import json
import logging
import time
import boto3
from botocore.config import Config
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, Dict, Any, List, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)

MULTIMODEL_ENDPOINT = "textshift-multimodel-gpu"

SAGEMAKER_ENDPOINTS = {
    "coedit-large": MULTIMODEL_ENDPOINT,
    "flan-t5-base": MULTIMODEL_ENDPOINT,
    "tone-detector": MULTIMODEL_ENDPOINT,
    "translator-en-es": MULTIMODEL_ENDPOINT,
    "translator-en-hi": MULTIMODEL_ENDPOINT,
    "detector": MULTIMODEL_ENDPOINT,
    "humanizer": MULTIMODEL_ENDPOINT,
    "sbert": MULTIMODEL_ENDPOINT,
}

LEGACY_ENDPOINTS = {
    "coedit-large": "textshift-coedit-large",
    "flan-t5-base": "textshift-flan-t5-base",
    "detector": "textshift-detector",
    "humanizer": "textshift-humanizer",
}


class SageMakerClient:
    _instance = None
    _runtime = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _get_runtime(self):
        if self._runtime is None:
            config = Config(
                read_timeout=120,
                connect_timeout=10,
                retries={"max_attempts": 1},
            )
            self._runtime = boto3.client(
                "sagemaker-runtime",
                region_name=settings.AWS_DEFAULT_REGION or "us-east-1",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=config,
            )
        return self._runtime

    def _invoke_multimodel(
        self,
        model_name: str,
        input_text: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Optional[Any]:
        payload: Dict[str, Any] = {
            "model_name": model_name,
            "inputs": input_text,
        }
        if parameters:
            payload["parameters"] = parameters

        try:
            t0 = time.time()
            response = self._get_runtime().invoke_endpoint(
                EndpointName=MULTIMODEL_ENDPOINT,
                ContentType="application/json",
                Body=json.dumps(payload),
            )
            body = json.loads(response["Body"].read())
            elapsed = time.time() - t0
            logger.info(f"MultiModel GPU [{model_name}] responded in {elapsed:.1f}s")
            return body
        except Exception as e:
            logger.warning(f"MultiModel GPU [{model_name}] failed: {e}")
            return None

    def _invoke_legacy(
        self,
        endpoint_key: str,
        input_text: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Optional[Any]:
        endpoint_name = LEGACY_ENDPOINTS.get(endpoint_key)
        if not endpoint_name:
            return None

        payload: Dict[str, Any] = {"inputs": input_text}
        if parameters:
            payload["parameters"] = parameters

        try:
            t0 = time.time()
            response = self._get_runtime().invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType="application/json",
                Body=json.dumps(payload),
            )
            body = json.loads(response["Body"].read())
            elapsed = time.time() - t0
            logger.info(f"Legacy [{endpoint_key}] responded in {elapsed:.1f}s")
            return body
        except Exception as e:
            logger.warning(f"Legacy [{endpoint_key}] fallback failed: {e}")
            return None

    def invoke_text2text(
        self,
        endpoint_key: str,
        input_text: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        body = self._invoke_multimodel(endpoint_key, input_text, parameters)

        if body is None:
            logger.info(f"Falling back to legacy endpoint for {endpoint_key}")
            body = self._invoke_legacy(endpoint_key, input_text, parameters)

        if body is None:
            return None

        if isinstance(body, dict) and "error" in body:
            logger.error(f"SageMaker {endpoint_key} error: {body['error']}")
            return None

        if isinstance(body, list) and len(body) > 0:
            return body[0].get("generated_text", "")
        return None

    def invoke_classification(
        self,
        endpoint_key: str,
        input_text: str,
        top_k: Optional[int] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        params = {"top_k": top_k} if top_k is not None else None
        body = self._invoke_multimodel(endpoint_key, input_text, params)

        if body is None:
            logger.info(f"Falling back to legacy endpoint for {endpoint_key}")
            legacy_params: Optional[Dict[str, Any]] = None
            if top_k is not None:
                legacy_params = {"top_k": top_k}
            body = self._invoke_legacy(endpoint_key, input_text, legacy_params)

        if body is None:
            return None

        if isinstance(body, dict) and "error" in body:
            logger.error(f"SageMaker {endpoint_key} error: {body['error']}")
            return None

        if isinstance(body, list) and len(body) > 0:
            if isinstance(body[0], list):
                return body[0]
            return body
        return None

    def invoke_translation(
        self,
        endpoint_key: str,
        input_text: str,
    ) -> Optional[str]:
        body = self._invoke_multimodel(endpoint_key, input_text)

        if body is None:
            logger.info(f"Falling back to legacy endpoint for {endpoint_key}")
            body = self._invoke_legacy(endpoint_key, input_text)

        if body is None:
            return None

        if isinstance(body, dict) and "error" in body:
            logger.error(f"SageMaker {endpoint_key} error: {body['error']}")
            return None

        if isinstance(body, list) and len(body) > 0:
            return body[0].get("translation_text", "")
        return None

    def invoke_text2text_batch(
        self,
        endpoint_key: str,
        inputs: List[str],
        parameters: Optional[Dict[str, Any]] = None,
        max_workers: int = 8,
    ) -> List[Optional[str]]:
        results: List[Optional[str]] = [None] * len(inputs)
        if not inputs:
            return results

        def _invoke_single(idx: int, text: str) -> Tuple[int, Optional[str]]:
            return idx, self.invoke_text2text(endpoint_key, text, parameters)

        t0 = time.time()
        with ThreadPoolExecutor(max_workers=min(len(inputs), max_workers)) as executor:
            futures = {
                executor.submit(_invoke_single, idx, text): idx
                for idx, text in enumerate(inputs)
            }
            for future in as_completed(futures):
                try:
                    idx, result = future.result()
                    results[idx] = result
                except Exception as e:
                    idx = futures[future]
                    logger.warning(f"Batch invoke [{endpoint_key}] chunk {idx} failed: {e}")

        elapsed = time.time() - t0
        succeeded = sum(1 for r in results if r is not None)
        logger.info(f"Batch invoke [{endpoint_key}]: {succeeded}/{len(inputs)} succeeded in {elapsed:.1f}s (max_workers={min(len(inputs), max_workers)})")
        return results

    def invoke_translation_batch(
        self,
        endpoint_key: str,
        inputs: List[str],
        max_workers: int = 8,
    ) -> List[Optional[str]]:
        results: List[Optional[str]] = [None] * len(inputs)
        if not inputs:
            return results

        def _invoke_single(idx: int, text: str) -> Tuple[int, Optional[str]]:
            return idx, self.invoke_translation(endpoint_key, text)

        t0 = time.time()
        with ThreadPoolExecutor(max_workers=min(len(inputs), max_workers)) as executor:
            futures = {
                executor.submit(_invoke_single, idx, text): idx
                for idx, text in enumerate(inputs)
            }
            for future in as_completed(futures):
                try:
                    idx, result = future.result()
                    results[idx] = result
                except Exception as e:
                    idx = futures[future]
                    logger.warning(f"Batch translation [{endpoint_key}] chunk {idx} failed: {e}")

        elapsed = time.time() - t0
        succeeded = sum(1 for r in results if r is not None)
        logger.info(f"Batch translation [{endpoint_key}]: {succeeded}/{len(inputs)} succeeded in {elapsed:.1f}s")
        return results

    def invoke_text2text_batch_optimized(
        self,
        endpoint_key: str,
        inputs: List[str],
        parameters: Optional[Dict[str, Any]] = None,
        max_concurrent: int = 3,
    ) -> List[Optional[str]]:
        if not inputs:
            return []
        results: List[Optional[str]] = [None] * len(inputs)
        batch_size = max(1, len(inputs) // max_concurrent)
        batches: List[List[Tuple[int, str]]] = []
        for i in range(0, len(inputs), batch_size):
            batch = [(idx, text) for idx, text in enumerate(inputs[i:i + batch_size], start=i)]
            batches.append(batch)

        def _process_batch(batch: List[Tuple[int, str]]) -> List[Tuple[int, Optional[str]]]:
            batch_results: List[Tuple[int, Optional[str]]] = []
            for idx, text in batch:
                result = self.invoke_text2text(endpoint_key, text, parameters)
                batch_results.append((idx, result))
            return batch_results

        t0 = time.time()
        with ThreadPoolExecutor(max_workers=min(len(batches), max_concurrent)) as executor:
            futures = [executor.submit(_process_batch, batch) for batch in batches]
            for future in as_completed(futures):
                try:
                    for idx, result in future.result():
                        results[idx] = result
                except Exception as e:
                    logger.warning(f"Batch optimized [{endpoint_key}] sub-batch failed: {e}")

        elapsed = time.time() - t0
        succeeded = sum(1 for r in results if r is not None)
        logger.info(f"Batch optimized [{endpoint_key}]: {succeeded}/{len(inputs)} in {elapsed:.1f}s ({len(batches)} sub-batches, max_concurrent={max_concurrent})")
        return results

    def invoke_embedding(
        self,
        input_text: str,
    ) -> Optional[List[float]]:
        body = self._invoke_multimodel("sbert", input_text)

        if body is None:
            return None

        if isinstance(body, dict) and "error" in body:
            logger.error(f"SageMaker sbert error: {body['error']}")
            return None

        if isinstance(body, list) and len(body) > 0:
            return body[0].get("embedding")
        return None


sagemaker_client = SageMakerClient()
