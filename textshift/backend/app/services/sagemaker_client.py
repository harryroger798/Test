import json
import logging
import time
import boto3
from botocore.config import Config
from typing import Optional, Dict, Any, List
from app.core.config import settings

logger = logging.getLogger(__name__)

SAGEMAKER_ENDPOINTS = {
    "coedit-large": "textshift-coedit-large",
    "flan-t5-base": "textshift-flan-t5-base",
    "tone-detector": "textshift-tone-detector",
    "translator-en-es": "textshift-translator-en-es",
    "translator-en-hi": "textshift-translator-en-hi",
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

    def invoke_text2text(
        self,
        endpoint_key: str,
        input_text: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        endpoint_name = SAGEMAKER_ENDPOINTS.get(endpoint_key)
        if not endpoint_name:
            logger.error(f"Unknown endpoint key: {endpoint_key}")
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
            logger.info(f"SageMaker {endpoint_key} responded in {elapsed:.1f}s")

            if isinstance(body, list) and len(body) > 0:
                return body[0].get("generated_text", "")
            return None
        except Exception as e:
            logger.error(f"SageMaker {endpoint_key} invocation failed: {e}")
            return None

    def invoke_classification(
        self,
        endpoint_key: str,
        input_text: str,
        top_k: Optional[int] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        endpoint_name = SAGEMAKER_ENDPOINTS.get(endpoint_key)
        if not endpoint_name:
            logger.error(f"Unknown endpoint key: {endpoint_key}")
            return None

        payload: Dict[str, Any] = {"inputs": input_text}
        if top_k is not None:
            payload["parameters"] = {"top_k": top_k}

        try:
            t0 = time.time()
            response = self._get_runtime().invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType="application/json",
                Body=json.dumps(payload),
            )
            body = json.loads(response["Body"].read())
            elapsed = time.time() - t0
            logger.info(f"SageMaker {endpoint_key} responded in {elapsed:.1f}s")

            if isinstance(body, list) and len(body) > 0:
                if isinstance(body[0], list):
                    return body[0]
                return body
            return None
        except Exception as e:
            logger.error(f"SageMaker {endpoint_key} invocation failed: {e}")
            return None

    def invoke_translation(
        self,
        endpoint_key: str,
        input_text: str,
    ) -> Optional[str]:
        endpoint_name = SAGEMAKER_ENDPOINTS.get(endpoint_key)
        if not endpoint_name:
            logger.error(f"Unknown endpoint key: {endpoint_key}")
            return None

        try:
            t0 = time.time()
            response = self._get_runtime().invoke_endpoint(
                EndpointName=endpoint_name,
                ContentType="application/json",
                Body=json.dumps({"inputs": input_text}),
            )
            body = json.loads(response["Body"].read())
            elapsed = time.time() - t0
            logger.info(f"SageMaker {endpoint_key} responded in {elapsed:.1f}s")

            if isinstance(body, list) and len(body) > 0:
                return body[0].get("translation_text", "")
            return None
        except Exception as e:
            logger.error(f"SageMaker {endpoint_key} invocation failed: {e}")
            return None


sagemaker_client = SageMakerClient()
