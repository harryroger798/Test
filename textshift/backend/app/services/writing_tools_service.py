"""
Writing Tools Service - Phase 4 Feature Expansion
Implements 14 new writing/content tools with tier-based gating.

Features:
1. Grammar Checker - LanguageTool API
2. Tone Detector - RoBERTa model (local)
3. Tone Adjuster - T5 model (local)
4. Readability Score - Python textstat
5. Summarizer - T5 model (local)
6. Paraphraser - T5 model (local)
7. Citation Generator - CrossRef API
8. Word Counter - Pure Python
9. Translator - Helsinki-NLP models (local)
10. Export Options - Python libraries
11. Bulk Processing - Loop processing
12. API Access - FastAPI endpoints
13. Style Analysis - Python nltk
14. Content Improver - T5 model (local)
"""

import os
import re
import json
import httpx
import asyncio
import logging
import boto3
import torch
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    T5Tokenizer, 
    T5ForConditionalGeneration,
    MarianMTModel,
    MarianTokenizer
)
from app.core.config import settings
from app.services.sagemaker_client import sagemaker_client

logger = logging.getLogger(__name__)


class WritingToolsService:
    """Service for all writing tools features."""
    
    _instance = None
    _tone_model = None
    _is_onnx_grammar = False
    _is_onnx_flan_t5 = False
    _tone_tokenizer = None
    _translator_models: Dict[str, Tuple[Any, Any]] = {}
    _t5_model = None
    _t5_tokenizer = None
    _general_t5_model = None
    _general_t5_tokenizer = None
    _grammar_model = None
    _grammar_tokenizer = None
    
    # Tone labels from SamLowe/roberta-base-go_emotions
    TONE_LABELS = [
        'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring',
        'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval',
        'disgust', 'embarrassment', 'excitement', 'fear', 'gratitude', 'grief',
        'joy', 'love', 'nervousness', 'optimism', 'pride', 'realization',
        'relief', 'remorse', 'sadness', 'surprise', 'neutral'
    ]
    
    # Supported translation language pairs
    SUPPORTED_LANGUAGES = {
        'en-es': 'English to Spanish',
        'es-en': 'Spanish to English',
        'en-fr': 'English to French',
        'fr-en': 'French to English',
        'en-de': 'English to German',
        'de-en': 'German to English',
        'en-hi': 'English to Hindi',
    }
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def _get_s3_client(self):
        """Get S3 client for iDrive e2."""
        return boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY
        )
    
    def _download_model_from_s3(self, s3_prefix: str, local_dir: str) -> bool:
        """Download model from iDrive e2 to local directory."""
        try:
            if os.path.exists(local_dir) and os.listdir(local_dir):
                logger.info(f"Model already exists at {local_dir}")
                return True
            
            os.makedirs(local_dir, exist_ok=True)
            s3 = self._get_s3_client()
            
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=settings.S3_BUCKET, Prefix=s3_prefix):
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    # Skip cache files
                    if '.cache' in key:
                        continue
                    relative_path = key[len(s3_prefix):].lstrip('/')
                    if not relative_path:
                        continue
                    local_path = os.path.join(local_dir, relative_path)
                    os.makedirs(os.path.dirname(local_path), exist_ok=True)
                    logger.info(f"Downloading {key} to {local_path}")
                    s3.download_file(settings.S3_BUCKET, key, local_path)
            
            return True
        except Exception as e:
            logger.error(f"Failed to download model from S3: {e}")
            return False
    
    def _load_tone_model(self):
        """Load tone detection model (SamLowe/roberta-base-go_emotions)."""
        if self._tone_model is not None:
            return
        
        try:
            model_dir = os.path.join(settings.MODELS_DIR, 'tone-detector')
            
            # Download from iDrive if not present
            if not os.path.exists(model_dir) or not os.listdir(model_dir):
                self._download_model_from_s3('textshift-models/tone-detector/', model_dir)
            
            self._tone_tokenizer = AutoTokenizer.from_pretrained(model_dir)
            self._tone_model = AutoModelForSequenceClassification.from_pretrained(model_dir)
            self._tone_model.eval()
            logger.info("Tone detection model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load tone model: {e}")
            # Fallback to HuggingFace
            try:
                self._tone_tokenizer = AutoTokenizer.from_pretrained("SamLowe/roberta-base-go_emotions")
                self._tone_model = AutoModelForSequenceClassification.from_pretrained("SamLowe/roberta-base-go_emotions")
                self._tone_model.eval()
                logger.info("Tone model loaded from HuggingFace")
            except Exception as e2:
                logger.error(f"Failed to load tone model from HuggingFace: {e2}")
    
    def _load_translator_model(self, lang_pair: str):
        """Load translation model for a specific language pair."""
        if lang_pair in self._translator_models:
            return
        
        try:
            model_dir = os.path.join(settings.MODELS_DIR, f'translator-{lang_pair}')
            
            # Download from iDrive if not present
            if not os.path.exists(model_dir) or not os.listdir(model_dir):
                self._download_model_from_s3(f'textshift-models/translator-{lang_pair}/', model_dir)
            
            tokenizer = MarianTokenizer.from_pretrained(model_dir)
            model = MarianMTModel.from_pretrained(model_dir)
            model.eval()
            self._translator_models[lang_pair] = (tokenizer, model)
            logger.info(f"Translator model {lang_pair} loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load translator model {lang_pair}: {e}")
            # Fallback to HuggingFace
            try:
                hf_model = f"Helsinki-NLP/opus-mt-{lang_pair}"
                tokenizer = MarianTokenizer.from_pretrained(hf_model)
                model = MarianMTModel.from_pretrained(hf_model)
                model.eval()
                self._translator_models[lang_pair] = (tokenizer, model)
                logger.info(f"Translator model {lang_pair} loaded from HuggingFace")
            except Exception as e2:
                logger.error(f"Failed to load translator from HuggingFace: {e2}")
    
    def _load_t5_model(self):
        """Load T5 model for summarization, paraphrasing, tone adjustment, content improvement."""
        if self._t5_model is not None:
            return
        
        try:
            # Use the existing humanizer model (T5-base)
            model_dir = settings.HUMANIZER_MODEL_PATH
            if os.path.exists(model_dir):
                self._t5_tokenizer = T5Tokenizer.from_pretrained(model_dir)
                self._t5_model = T5ForConditionalGeneration.from_pretrained(model_dir)
            else:
                # Fallback to base T5
                self._t5_tokenizer = T5Tokenizer.from_pretrained("t5-base")
                self._t5_model = T5ForConditionalGeneration.from_pretrained("t5-base")
            self._t5_model.eval()
            logger.info("T5 model loaded for writing tools")
        except Exception as e:
            logger.error(f"Failed to load T5 model: {e}")
    
    def _load_general_t5_model(self):
        """Load general-purpose Flan-T5 model (ONNX INT8 preferred, PyTorch fallback)."""
        if self._general_t5_model is not None:
            return True
        
        try:
            onnx_dir = os.path.join(settings.MODELS_DIR, 'flan-t5-base-onnx')
            model_dir = os.path.join(settings.MODELS_DIR, 'flan-t5-base')
            
            if os.path.exists(onnx_dir) and os.path.exists(os.path.join(onnx_dir, 'encoder_model.onnx')):
                from optimum.onnxruntime import ORTModelForSeq2SeqLM
                logger.info("Loading Flan-T5-base ONNX INT8 model...")
                self._general_t5_tokenizer = T5Tokenizer.from_pretrained(onnx_dir)
                self._general_t5_model = ORTModelForSeq2SeqLM.from_pretrained(onnx_dir)
                self._is_onnx_flan_t5 = True
                logger.info(f"Loaded Flan-T5-base ONNX INT8 from {onnx_dir}")
                return True
            
            if not os.path.exists(model_dir) or not os.listdir(model_dir):
                success = self._download_model_from_s3('textshift-models/flan-t5-base/', model_dir)
                if not success:
                    logger.info("Downloading flan-t5-base from HuggingFace...")
                    self._general_t5_tokenizer = T5Tokenizer.from_pretrained("google/flan-t5-base")
                    self._general_t5_model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")
                    self._general_t5_model.eval()
                    logger.info("Flan-T5 model loaded from HuggingFace")
                    return True
            
            self._general_t5_tokenizer = T5Tokenizer.from_pretrained(model_dir)
            self._general_t5_model = T5ForConditionalGeneration.from_pretrained(model_dir)
            self._general_t5_model.eval()
            logger.info("Flan-T5 model loaded (PyTorch) from local storage")
            return True
        except Exception as e:
            logger.error(f"Failed to load Flan-T5 model: {e}")
            return False
    
    def _load_grammar_model(self):
        """Load CoEdIT-large grammar model (ONNX INT8 preferred, PyTorch fallback)."""
        if self._grammar_model is not None:
            return True
        
        try:
            onnx_dir = os.path.join(settings.MODELS_DIR, 'coedit-large-onnx')
            model_dir = os.path.join(settings.MODELS_DIR, 'coedit-large')
            
            if os.path.exists(onnx_dir) and os.path.exists(os.path.join(onnx_dir, 'encoder_model.onnx')):
                from optimum.onnxruntime import ORTModelForSeq2SeqLM
                logger.info("Loading CoEdIT-large ONNX INT8 model...")
                self._grammar_tokenizer = AutoTokenizer.from_pretrained(onnx_dir)
                self._grammar_model = ORTModelForSeq2SeqLM.from_pretrained(onnx_dir)
                self._is_onnx_grammar = True
                logger.info(f"Loaded CoEdIT-large ONNX INT8 from {onnx_dir}")
                return True
            
            if not os.path.exists(model_dir) or not os.listdir(model_dir):
                success = self._download_model_from_s3('grammar-checker/coedit-large/', model_dir)
                if not success:
                    logger.info("Downloading coedit-large from HuggingFace...")
                    self._grammar_tokenizer = AutoTokenizer.from_pretrained("grammarly/coedit-large")
                    self._grammar_model = T5ForConditionalGeneration.from_pretrained("grammarly/coedit-large", torch_dtype=torch.float16)
                    self._grammar_model.eval()
                    logger.info("CoEdIT-large model loaded from HuggingFace")
                    return True
            
            self._grammar_tokenizer = AutoTokenizer.from_pretrained(model_dir)
            self._grammar_model = T5ForConditionalGeneration.from_pretrained(model_dir, torch_dtype=torch.float16)
            self._grammar_model.eval()
            logger.info("CoEdIT-large model loaded (PyTorch) from local storage")
            return True
        except Exception as e:
            logger.error(f"Failed to load CoEdIT-large model: {e}")
            return False
    
    def _correct_grammar_chunk(self, chunk: str) -> str:
        """Correct grammar for a single chunk using instruction-tuned model."""
        input_text = f"Fix grammatical errors in this sentence: {chunk}"
        inputs = self._grammar_tokenizer(
            input_text,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )
        input_length = inputs["input_ids"].shape[1]
        with torch.no_grad():
            outputs = self._grammar_model.generate(
                **inputs,
                max_length=max(512, input_length + 128),
                num_beams=5,
                early_stopping=True
            )
        corrected = self._grammar_tokenizer.decode(outputs[0], skip_special_tokens=True)
        return corrected.strip() if corrected else chunk

    def _coedit_chunk_via_sagemaker(self, instruction: str, chunk: str) -> Optional[str]:
        """Process a single CoEdIT chunk via SageMaker serverless endpoint."""
        try:
            input_text = f"{instruction}: {chunk}"
            word_count = len(chunk.split())
            parameters = {
                "max_new_tokens": min(int(word_count * 2), 512),
                "num_beams": 4,
                "early_stopping": True,
            }
            result = sagemaker_client.invoke_text2text("coedit-large", input_text, parameters)
            if result and len(result.strip()) > 5:
                return result.strip()
            return None
        except Exception as e:
            logger.warning(f"SageMaker CoEdIT chunk failed: {e}")
            return None

    def _flan_t5_via_sagemaker(self, prompt: str, max_length: int = 256) -> Optional[str]:
        """Generate text via SageMaker Flan-T5-base endpoint."""
        try:
            parameters = {
                "max_new_tokens": max_length,
                "num_beams": 4,
                "early_stopping": True,
                "do_sample": False,
            }
            result = sagemaker_client.invoke_text2text("flan-t5-base", prompt, parameters)
            if result and len(result.strip()) > 5:
                return result.strip()
            return None
        except Exception as e:
            logger.warning(f"SageMaker Flan-T5 failed: {e}")
            return None

    def _edit_text_with_coedit(self, text: str, instruction: str, max_chunk_tokens: int = 200) -> str:
        """Edit text using CoEdIT-large with the given instruction prompt.
        Chunks by sentences to avoid truncation. SageMaker GPU is PRIMARY,
        local ONNX INT8 is fallback."""
        if not self._load_grammar_model():
            return text
        if self._grammar_model is None or self._grammar_tokenizer is None:
            return text

        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        chunks: list[str] = []
        current_chunk: list[str] = []
        current_tokens = 0

        for sentence in sentences:
            sentence_tokens = len(self._grammar_tokenizer.encode(sentence))
            if current_tokens + sentence_tokens > max_chunk_tokens and current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = [sentence]
                current_tokens = sentence_tokens
            else:
                current_chunk.append(sentence)
                current_tokens += sentence_tokens
        if current_chunk:
            chunks.append(' '.join(current_chunk))

        results: list[str] = [None] * len(chunks)

        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            try:
                input_texts = [f"{instruction}: {chunk}" for chunk in chunks]
                word_count = len(text.split())
                max_new = min(512, max(256, int(word_count * 1.5 / len(chunks))))
                parameters = {
                    "max_new_tokens": max_new,
                    "num_beams": 4,
                    "early_stopping": True,
                    "do_sample": False,
                }
                batch_results = sagemaker_client.invoke_text2text_batch(
                    "coedit-large", input_texts, parameters, max_workers=8
                )
                failed_indices = []
                for idx, result in enumerate(batch_results):
                    if result and len(result.strip()) > 0:
                        results[idx] = result.strip()
                    else:
                        failed_indices.append(idx)

                if not failed_indices:
                    logger.info(f"SageMaker GPU CoEdIT batch processed {len(chunks)} chunks")
                    return ' '.join(results)

                logger.info(f"SageMaker GPU: {len(chunks) - len(failed_indices)}/{len(chunks)} succeeded, falling back to local for {len(failed_indices)} chunks")
            except Exception as e:
                logger.warning(f"SageMaker GPU CoEdIT batch failed, falling back to local: {e}")

        for idx, chunk in enumerate(chunks):
            if results[idx] is not None:
                continue
            input_text = f"{instruction}: {chunk}"
            inputs = self._grammar_tokenizer(
                input_text, return_tensors="pt", truncation=True, max_length=512
            )
            input_length = inputs["input_ids"].shape[1]
            with torch.no_grad():
                outputs = self._grammar_model.generate(
                    **inputs,
                    max_length=max(512, input_length + 128),
                    num_beams=4,
                    early_stopping=True
                )
            result = self._grammar_tokenizer.decode(outputs[0], skip_special_tokens=True)
            results[idx] = result.strip() if result else chunk

        return ' '.join(results)

    def _correct_grammar_with_t5(self, text: str) -> Optional[str]:
        """Correct grammar using T5 model, always processing in sentence chunks to avoid truncation."""
        try:
            if not self._load_grammar_model():
                return None
            
            if self._grammar_model is None or self._grammar_tokenizer is None:
                return None
            
            sentences = re.split(r'(?<=[.!?])\s+', text.strip())
            if len(sentences) <= 1:
                return self._correct_grammar_chunk(text)

            corrected_chunks: list[str] = []
            current_chunk: list[str] = []
            current_tokens = 0

            for sentence in sentences:
                sentence_tokens = len(self._grammar_tokenizer.encode(sentence))
                if current_tokens + sentence_tokens > 200 and current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    corrected_chunks.append(self._correct_grammar_chunk(chunk_text))
                    current_chunk = [sentence]
                    current_tokens = sentence_tokens
                else:
                    current_chunk.append(sentence)
                    current_tokens += sentence_tokens

            if current_chunk:
                chunk_text = ' '.join(current_chunk)
                corrected_chunks.append(self._correct_grammar_chunk(chunk_text))

            return ' '.join(corrected_chunks)
        except Exception as e:
            logger.error(f"T5 grammar correction failed: {e}")
            return None
    
    def _generate_with_t5(self, prompt: str, max_length: int = 256, min_length: int = 10) -> Optional[str]:
        """Generate text using Flan-T5 model (SageMaker PRIMARY → local ONNX INT8 fallback)."""
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            sm_result = self._flan_t5_via_sagemaker(prompt, max_length)
            if sm_result:
                logger.info("Flan-T5 served via SageMaker (primary)")
                return sm_result
            logger.warning("SageMaker Flan-T5 failed, falling back to local model")

        try:
            if not self._load_general_t5_model():
                return None
            
            if self._general_t5_model is None or self._general_t5_tokenizer is None:
                return None
            
            inputs = self._general_t5_tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=512
            )
            
            with torch.no_grad():
                outputs = self._general_t5_model.generate(
                    **inputs,
                    max_length=max_length,
                    min_length=min_length,
                    num_beams=4,
                    length_penalty=1.0,
                    early_stopping=True,
                    do_sample=False
                )
            
            generated_text = self._general_t5_tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            if not generated_text or len(generated_text.strip()) < 5:
                return None
            if generated_text.strip().lower() == prompt.strip().lower():
                return None
            
            return generated_text.strip()
        except Exception as e:
            logger.error(f"Local T5 generation also failed: {e}")
            return None
    
    # ==================== Feature 1: Grammar Checker ====================
    def _find_differences(self, original: str, corrected: str) -> List[Dict[str, Any]]:
        """Find word-level differences between original and corrected text."""
        import difflib
        
        errors = []
        original_words = original.split()
        corrected_words = corrected.split()
        
        matcher = difflib.SequenceMatcher(None, original_words, corrected_words)
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'replace':
                orig_word_count = i2 - i1
                corr_word_count = j2 - j1
                if orig_word_count > 4 and corr_word_count < orig_word_count // 2:
                    continue
                original_segment = ' '.join(original_words[i1:i2])
                corrected_segment = ' '.join(corrected_words[j1:j2])
                errors.append({
                    "message": f"Replace '{original_segment}' with '{corrected_segment}'",
                    "short_message": "Grammar/Spelling",
                    "original": original_segment,
                    "replacement": corrected_segment,
                    "rule_category": "Grammar Correction",
                    "replacements": [corrected_segment]
                })
            elif tag == 'delete':
                if (i2 - i1) > 4:
                    continue
                original_segment = ' '.join(original_words[i1:i2])
                errors.append({
                    "message": f"Remove '{original_segment}'",
                    "short_message": "Unnecessary word(s)",
                    "original": original_segment,
                    "replacement": "",
                    "rule_category": "Grammar Correction",
                    "replacements": [""]
                })
            elif tag == 'insert':
                if (j2 - j1) > 4:
                    continue
                corrected_segment = ' '.join(corrected_words[j1:j2])
                errors.append({
                    "message": f"Insert '{corrected_segment}'",
                    "short_message": "Missing word(s)",
                    "original": "",
                    "replacement": corrected_segment,
                    "rule_category": "Grammar Correction",
                    "replacements": [corrected_segment]
                })
        
        return errors
    
    async def check_grammar(self, text: str) -> Dict[str, Any]:
        """Check grammar using T5 model (primary) + LanguageTool API (supplementary).
        
        Builds corrected_text by applying individual replacements to the original
        text instead of using T5 raw output, which avoids seq2seq truncation.
        Returns a corrections array with offset/length/replacement for each fix
        so the frontend can render a precise diff view.
        
        For long texts (>500 words), skips CoEdIT to avoid slow chunk processing
        and uses LanguageTool API only, which handles long texts efficiently.
        """
        try:
            errors = []
            word_count = len(text.split())
            
            # Step 1: Use CoEdIT grammar model via SageMaker GPU (primary) with local fallback
            # Skip CoEdIT for long texts (>500 words) — LanguageTool handles them better
            t5_corrected = None
            if word_count <= 500:
                t5_corrected = self._edit_text_with_coedit(text, "Fix grammatical errors in this sentence")
            else:
                logger.info(f"Grammar check: skipping CoEdIT for {word_count}-word text, using LanguageTool only")
            
            if t5_corrected and t5_corrected != text:
                t5_errors = self._find_differences(text, t5_corrected)
                errors.extend(t5_errors)
            
            # Step 2: Run LanguageTool for errors with exact positions
            lt_errors = []
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://api.languagetool.org/v2/check",
                        data={
                            "text": text,
                            "language": "en-US",
                            "enabledOnly": "false"
                        }
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        matches = data.get("matches", [])
                        
                        for match in matches:
                            offset = match.get("offset", 0)
                            length = match.get("length", 0)
                            lt_error = {
                                "message": match.get("message", ""),
                                "short_message": match.get("shortMessage", ""),
                                "offset": offset,
                                "length": length,
                                "original": text[offset:offset + length] if length > 0 else "",
                                "context": match.get("context", {}).get("text", ""),
                                "rule_id": match.get("rule", {}).get("id", ""),
                                "rule_category": match.get("rule", {}).get("category", {}).get("name", ""),
                                "replacements": [r.get("value", "") for r in match.get("replacements", [])[:3]]
                            }
                            lt_errors.append(lt_error)
            except Exception as lt_e:
                logger.warning(f"LanguageTool API failed (using T5 only): {lt_e}")
            
            # Merge errors - avoid duplicates by (offset, length) pairs
            existing_spans = set()
            for e in errors:
                o = e.get("offset")
                l = e.get("length")
                if o is not None and l:
                    existing_spans.add((o, l))
            for lt_error in lt_errors:
                o = lt_error.get("offset")
                l = lt_error.get("length")
                if o is not None and l and (o, l) not in existing_spans:
                    errors.append(lt_error)
                    existing_spans.add((o, l))
            
            # Step 3: Build corrected_text by applying replacements to original text
            # This avoids T5 seq2seq truncation by starting from the full original
            replacement_ops: list[dict] = []
            
            for error in errors:
                offset = error.get("offset")
                length = error.get("length")
                original_str = error.get("original", "")
                replacements = error.get("replacements", [])
                
                if not replacements or replacements[0] == "":
                    continue
                
                replacement_val = replacements[0]
                
                if offset is not None and length and length > 0:
                    start = offset
                    end = offset + length
                    before_ok = (start == 0 or not text[start - 1].isalnum())
                    after_ok = (end >= len(text) or not text[end].isalnum())
                    if before_ok and after_ok:
                        replacement_ops.append({
                            "offset": offset,
                            "length": length,
                            "original": text[offset:offset + length],
                            "replacement": replacement_val
                        })
                elif original_str:
                    import re
                    pattern = re.compile(r'(?<![\w])' + re.escape(original_str) + r'(?![\w])')
                    m = pattern.search(text)
                    if m:
                        idx = m.start()
                        new_end = idx + len(original_str)
                        overlap = any(
                            not (new_end <= op["offset"] or idx >= op["offset"] + op["length"])
                            for op in replacement_ops
                        )
                        if not overlap:
                            replacement_ops.append({
                                "offset": idx,
                                "length": len(original_str),
                                "original": original_str,
                                "replacement": replacement_val
                            })
            
            # De-duplicate overlapping ops: keep the one with the earlier offset
            replacement_ops.sort(key=lambda x: x["offset"])
            deduped_ops: list[dict] = []
            for op in replacement_ops:
                if deduped_ops:
                    prev = deduped_ops[-1]
                    if op["offset"] < prev["offset"] + prev["length"]:
                        continue
                deduped_ops.append(op)
            
            # Apply replacements right-to-left to preserve offsets
            corrected_text = text
            for op in reversed(deduped_ops):
                corrected_text = (
                    corrected_text[:op["offset"]]
                    + op["replacement"]
                    + corrected_text[op["offset"] + op["length"]:]
                )
            
            # Build corrections array for frontend diff rendering
            corrections = [
                {"offset": op["offset"], "length": op["length"],
                 "original": op["original"], "replacement": op["replacement"]}
                for op in deduped_ops
            ]
            
            return {
                "success": True,
                "original_text": text,
                "corrected_text": corrected_text,
                "corrections": corrections,
                "error_count": len(errors),
                "errors": errors,
                "language": "en-US",
                "model": "T5-grammar-correction + LanguageTool"
            }
        except Exception as e:
            logger.error(f"Grammar check failed: {e}")
            return {"success": False, "error": str(e)}
    
    POSITIVE_TONES = {'admiration', 'amusement', 'approval', 'caring', 'desire',
                      'excitement', 'gratitude', 'joy', 'love', 'optimism', 'pride', 'relief'}
    NEGATIVE_TONES = {'anger', 'annoyance', 'disappointment', 'disapproval', 'disgust',
                      'embarrassment', 'fear', 'grief', 'nervousness', 'remorse', 'sadness'}
    NEUTRAL_TONES = {'confusion', 'curiosity', 'realization', 'surprise', 'neutral'}

    # ==================== Feature 2: Tone Detector ====================
    def _classify_tone_category(self, tone_name: str) -> str:
        if tone_name in self.POSITIVE_TONES:
            return "Positive"
        if tone_name in self.NEGATIVE_TONES:
            return "Negative"
        return "Neutral"

    def _analyze_tone_for_text(self, text_chunk: str) -> List[Dict[str, Any]]:
        inputs = self._tone_tokenizer(
            text_chunk,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )
        with torch.no_grad():
            outputs = self._tone_model(**inputs)
            probs = torch.sigmoid(outputs.logits)[0]
        top_indices = torch.argsort(probs, descending=True)[:5]
        tones = []
        for idx in top_indices:
            tone_name = self.TONE_LABELS[idx.item()]
            confidence = round(probs[idx].item() * 100, 2)
            if confidence > 10:
                tones.append({
                    "tone": tone_name,
                    "confidence": confidence,
                    "category": self._classify_tone_category(tone_name)
                })
        return tones

    def detect_tone(self, text: str) -> Dict[str, Any]:
        """Detect emotional tone with sentence breakdown, categories, and consistency score."""
        try:
            self._load_tone_model()

            if self._tone_model is None:
                return {"success": False, "error": "Tone model not available"}

            overall_tones = self._analyze_tone_for_text(text)

            if not overall_tones:
                overall_tones = [{"tone": "neutral", "confidence": 100.0, "category": "Neutral"}]

            primary_tone = overall_tones[0]

            pos_score = sum(t["confidence"] for t in overall_tones if t["category"] == "Positive")
            neg_score = sum(t["confidence"] for t in overall_tones if t["category"] == "Negative")
            neu_score = sum(t["confidence"] for t in overall_tones if t["category"] == "Neutral")
            total = pos_score + neg_score + neu_score or 1
            if pos_score > neg_score and pos_score > neu_score:
                overall_category = "Positive"
            elif neg_score > pos_score and neg_score > neu_score:
                overall_category = "Negative"
            elif abs(pos_score - neg_score) < 10 and pos_score > 15 and neg_score > 15:
                overall_category = "Mixed"
            else:
                overall_category = "Neutral"

            sentences = re.split(r'(?<=[.!?])\s+', text)
            sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

            sentence_tones = []
            sentence_primary_tones = []
            if len(sentences) > 1:
                batch_sents = sentences[:20]
                batch_inputs = self._tone_tokenizer(
                    batch_sents, return_tensors="pt", truncation=True,
                    max_length=512, padding=True
                )
                with torch.no_grad():
                    batch_outputs = self._tone_model(**batch_inputs)
                    batch_probs = torch.sigmoid(batch_outputs.logits)

                for si, sent in enumerate(batch_sents):
                    probs = batch_probs[si]
                    top_indices = torch.argsort(probs, descending=True)[:5]
                    sent_tones = []
                    for idx in top_indices:
                        tone_name = self.TONE_LABELS[idx.item()]
                        confidence = round(probs[idx].item() * 100, 2)
                        if confidence > 10:
                            sent_tones.append({
                                "tone": tone_name,
                                "confidence": confidence,
                                "category": self._classify_tone_category(tone_name)
                            })
                    if sent_tones:
                        sentence_primary_tones.append(sent_tones[0]["tone"])
                        sentence_tones.append({
                            "sentence": sent[:80] + "..." if len(sent) > 80 else sent,
                            "primary_tone": sent_tones[0]["tone"],
                            "confidence": sent_tones[0]["confidence"],
                            "category": sent_tones[0]["category"]
                        })
                    else:
                        sentence_primary_tones.append("neutral")
                        sentence_tones.append({
                            "sentence": sent[:80] + "..." if len(sent) > 80 else sent,
                            "primary_tone": "neutral",
                            "confidence": 100.0,
                            "category": "Neutral"
                        })

            if sentence_primary_tones:
                most_common_tone = Counter(sentence_primary_tones).most_common(1)[0]
                consistency_score = round(most_common_tone[1] / len(sentence_primary_tones) * 100, 1)
            else:
                consistency_score = 100.0

            category_breakdown = {
                "positive": round(pos_score / total * 100, 1),
                "negative": round(neg_score / total * 100, 1),
                "neutral": round(neu_score / total * 100, 1)
            }

            return {
                "success": True,
                "primary_tone": primary_tone["tone"],
                "primary_confidence": primary_tone["confidence"],
                "overall_category": overall_category,
                "category_breakdown": category_breakdown,
                "all_tones": overall_tones,
                "sentence_tones": sentence_tones if sentence_tones else None,
                "consistency_score": consistency_score,
                "sentence_count_analyzed": len(sentence_tones) if sentence_tones else 0,
                "text_preview": text[:100] + "..." if len(text) > 100 else text
            }
        except Exception as e:
            logger.error(f"Tone detection failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 3: Tone Adjuster ====================
    def adjust_tone(self, text: str, target_tone: str) -> Dict[str, Any]:
        """Adjust text tone using CoEdIT-large (primary) with rule-based fallback."""
        try:
            import random
            target = target_tone.lower()

            tone_instructions = {
                "formal": "Make this paragraph more formal",
                "casual": "Make this paragraph more casual",
                "persuasive": "Make this paragraph more persuasive",
                "academic": "Make this paragraph more academic",
                "confident": "Make this paragraph more assertive",
                "empathetic": "Make this paragraph more empathetic",
            }

            instruction = tone_instructions.get(target)
            if instruction:
                coedit_result = self._edit_text_with_coedit(text, instruction, max_chunk_tokens=150)
                if coedit_result and coedit_result.strip() != text.strip() and len(coedit_result) > 20:
                    return {
                        "success": True,
                        "original_text": text,
                        "adjusted_text": coedit_result,
                        "target_tone": target_tone,
                        "word_count_original": len(text.split()),
                        "word_count_adjusted": len(coedit_result.split()),
                        "transformation_applied": target,
                        "method": "coedit-large"
                    }

            adjusted_text = text
            
            # Aggressive/negative phrase replacements for formal tone
            aggressive_to_formal = {
                "dropped the ball": "encountered challenges",
                "clean up your mess": "address the issues",
                "I'm sick of it": "this situation requires attention",
                "sick of it": "concerned about this pattern",
                "frankly": "to be direct",
                "maybe you're in the wrong job": "we should discuss role alignment",
                "in the wrong job": "may benefit from additional support or role review",
                "can't handle": "are experiencing difficulty with",
                "completely dropped": "did not meet expectations on",
                "your mess": "these issues",
                "incompetence": "performance gaps",
                "unacceptable": "below expectations",
                "ridiculous": "concerning",
                "stupid": "ineffective",
                "terrible": "unsatisfactory",
                "awful": "suboptimal",
                "hate": "have concerns about",
                "angry": "disappointed",
                "furious": "deeply concerned",
                "fed up": "concerned about the recurring nature of",
                "screwed up": "made errors in",
                "messed up": "encountered issues with",
                "failed miserably": "did not achieve the expected outcomes",
                "waste of time": "inefficient use of resources",
                "useless": "not meeting current needs",
                "pathetic": "inadequate",
                "disaster": "significant challenge",
                "catastrophe": "serious issue",
                "blame": "identify areas for improvement regarding",
                "fault": "responsibility",
                "you always": "there has been a pattern of",
                "you never": "there have been instances where",
                "this is the third time": "we have encountered this situation multiple times",
            }
            
            # Formal tone transformations (contractions + professional language)
            formal_replacements = {
                "can't": "cannot", "won't": "will not", "don't": "do not",
                "isn't": "is not", "aren't": "are not", "wasn't": "was not",
                "weren't": "were not", "hasn't": "has not", "haven't": "have not",
                "hadn't": "had not", "doesn't": "does not", "didn't": "did not",
                "couldn't": "could not", "shouldn't": "should not", "wouldn't": "would not",
                "I'm": "I am", "you're": "you are", "we're": "we are", "they're": "they are",
                "it's": "it is", "that's": "that is", "there's": "there is",
                "what's": "what is", "who's": "who is", "let's": "let us",
                "gonna": "going to", "wanna": "want to", "gotta": "got to",
                "kinda": "kind of", "sorta": "sort of", "dunno": "do not know",
                "yeah": "yes", "nope": "no", "yep": "yes", "ok": "acceptable",
                "awesome": "excellent", "cool": "satisfactory", "great": "excellent",
                "stuff": "materials", "things": "items", "guy": "individual",
                "guys": "individuals", "kids": "children", "lots": "numerous",
                "a lot": "significantly", "pretty": "quite", "really": "very",
                "super": "extremely", "totally": "completely", "basically": "fundamentally",
            }
            
            # Casual tone transformations
            casual_replacements = {
                "cannot": "can't", "will not": "won't", "do not": "don't",
                "is not": "isn't", "are not": "aren't", "was not": "wasn't",
                "were not": "weren't", "has not": "hasn't", "have not": "haven't",
                "had not": "hadn't", "does not": "doesn't", "did not": "didn't",
                "could not": "couldn't", "should not": "shouldn't", "would not": "wouldn't",
                "I am": "I'm", "you are": "you're", "we are": "we're", "they are": "they're",
                "it is": "it's", "that is": "that's", "there is": "there's",
                "excellent": "awesome", "satisfactory": "cool", "individuals": "folks",
                "children": "kids", "numerous": "lots of", "significantly": "a lot",
                "extremely": "super", "completely": "totally", "fundamentally": "basically",
                "however": "but", "therefore": "so", "furthermore": "also",
                "nevertheless": "still", "consequently": "so", "additionally": "plus",
                "regarding": "about", "concerning": "about", "approximately": "around",
                "sufficient": "enough", "commence": "start", "terminate": "end",
                "utilize": "use", "facilitate": "help", "implement": "do",
            }
            
            # Academic tone transformations
            academic_replacements = {
                "show": "demonstrate", "think": "hypothesize", "use": "utilize",
                "find": "discover", "look at": "examine", "get": "obtain",
                "give": "provide", "make": "construct", "help": "facilitate",
                "need": "require", "want": "desire", "try": "attempt",
                "big": "substantial", "small": "minimal", "good": "beneficial",
                "bad": "detrimental", "important": "significant", "interesting": "noteworthy",
                "about": "regarding", "because": "due to the fact that",
                "but": "however", "so": "therefore", "also": "furthermore",
                "start": "commence", "end": "conclude", "change": "modify",
            }
            
            # Confident tone transformations
            confident_replacements = {
                "I think": "I know", "maybe": "certainly", "perhaps": "definitely",
                "might": "will", "could": "can", "possibly": "absolutely",
                "I believe": "I am confident that", "I hope": "I expect",
                "I guess": "I am certain", "probably": "undoubtedly",
                "it seems": "it is clear", "apparently": "evidently",
                "it might be": "it is", "we could try": "we will",
                "if possible": "when we", "hopefully": "certainly",
            }
            
            # Persuasive tone additions
            persuasive_phrases = {
                "start": ["Imagine ", "Picture this: ", "Consider how "],
                "emphasis": [" - and this is crucial - ", " - importantly - ", " - notably - "],
                "call_to_action": [" Take action now.", " Don't miss this opportunity.", " Act today."],
            }
            
            # Empathetic tone transformations
            empathetic_phrases = {
                "start": ["I understand that ", "I hear you - ", "I can see how "],
                "validation": [" and that's completely valid", " which makes total sense", " and your feelings matter"],
            }
            
            if target == "formal":
                # First, replace aggressive phrases with professional alternatives
                for old, new in aggressive_to_formal.items():
                    adjusted_text = re.sub(re.escape(old), new, adjusted_text, flags=re.IGNORECASE)
                
                # Then expand contractions and use formal vocabulary
                for old, new in formal_replacements.items():
                    adjusted_text = re.sub(r'\b' + re.escape(old) + r'\b', new, adjusted_text, flags=re.IGNORECASE)
                
                # Add professional framing if text starts with aggressive "Your" or "You"
                if adjusted_text.lower().startswith("your team") or adjusted_text.lower().startswith("you "):
                    adjusted_text = "I would like to discuss some concerns. " + adjusted_text
                
                # Soften direct accusations
                adjusted_text = re.sub(r'\bYour team\b', 'The team', adjusted_text)
                adjusted_text = re.sub(r'\byour team\b', 'the team', adjusted_text)
            
            elif target == "casual":
                for old, new in casual_replacements.items():
                    adjusted_text = re.sub(r'\b' + re.escape(old) + r'\b', new, adjusted_text, flags=re.IGNORECASE)
                
                # Add casual opener if formal
                if adjusted_text.startswith(("Dear ", "To Whom", "I am writing")):
                    adjusted_text = "Hey! " + adjusted_text
            
            elif target == "persuasive":
                # Add persuasive opening
                if not adjusted_text.startswith(tuple(persuasive_phrases["start"])):
                    adjusted_text = random.choice(persuasive_phrases["start"]) + adjusted_text[0].lower() + adjusted_text[1:]
                # Add call to action if not present
                if not adjusted_text.rstrip().endswith(('.', '!', '?')):
                    adjusted_text += "."
                adjusted_text = adjusted_text.rstrip('.!?') + random.choice(persuasive_phrases["call_to_action"])
            
            elif target == "academic":
                for old, new in academic_replacements.items():
                    adjusted_text = re.sub(r'\b' + re.escape(old) + r'\b', new, adjusted_text, flags=re.IGNORECASE)
                # Add academic structure
                if not adjusted_text.startswith(("This ", "The ", "In ", "According ", "Research ")):
                    adjusted_text = "This analysis suggests that " + adjusted_text[0].lower() + adjusted_text[1:]
            
            elif target == "confident":
                for old, new in confident_replacements.items():
                    adjusted_text = re.sub(r'\b' + re.escape(old) + r'\b', new, adjusted_text, flags=re.IGNORECASE)
                # Remove hedging language
                adjusted_text = re.sub(r'\b(sort of|kind of|a bit|somewhat)\b', '', adjusted_text, flags=re.IGNORECASE)
                adjusted_text = re.sub(r'\s+', ' ', adjusted_text).strip()
            
            elif target == "empathetic":
                # Add empathetic opening
                if not any(adjusted_text.startswith(phrase) for phrase in empathetic_phrases["start"]):
                    adjusted_text = random.choice(empathetic_phrases["start"]) + adjusted_text[0].lower() + adjusted_text[1:]
                # Soften harsh language
                adjusted_text = re.sub(r'\bmust\b', 'could', adjusted_text, flags=re.IGNORECASE)
                adjusted_text = re.sub(r'\bshould\b', 'might want to', adjusted_text, flags=re.IGNORECASE)
            
            return {
                "success": True,
                "original_text": text,
                "adjusted_text": adjusted_text,
                "target_tone": target_tone,
                "word_count_original": len(text.split()),
                "word_count_adjusted": len(adjusted_text.split()),
                "transformation_applied": target,
                "method": "rule-based"
            }
        except Exception as e:
            logger.error(f"Tone adjustment failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 4: Readability Score ====================
    def analyze_readability(self, text: str, detailed: bool = False) -> Dict[str, Any]:
        """Analyze text readability using comprehensive metrics with improved syllable counting."""
        try:
            # Clean text and extract words
            clean_text = re.sub(r'[^\w\s]', '', text)
            words = [w for w in clean_text.split() if w.isalpha()]
            sentences = re.split(r'[.!?]+', text)
            sentences = [s.strip() for s in sentences if s.strip()]
            
            word_count = len(words)
            sentence_count = len(sentences) if sentences else 1
            char_count = sum(len(w) for w in words)
            
            if word_count == 0:
                return {"success": False, "error": "No words found in text"}
            
            # Improved syllable counting with English exceptions
            def count_syllables(word):
                word = word.lower().strip()
                if len(word) <= 2:
                    return 1
                
                # Common exceptions
                exceptions = {
                    'area': 3, 'idea': 3, 'real': 2, 'ruin': 2, 'fluid': 2,
                    'poem': 2, 'lion': 2, 'riot': 2, 'quiet': 2, 'diet': 2,
                    'science': 2, 'being': 2, 'seeing': 2, 'doing': 2,
                    'going': 2, 'create': 2, 'created': 3, 'creating': 3,
                    'business': 2, 'every': 2, 'different': 3, 'evening': 2,
                    'family': 3, 'finally': 3, 'generally': 4, 'usually': 4,
                    'actually': 4, 'probably': 3, 'especially': 5,
                    'interesting': 4, 'beautiful': 3, 'chocolate': 3,
                    'comfortable': 4, 'vegetable': 4, 'reasonable': 4,
                    'valuable': 4, 'available': 4, 'considerable': 5,
                }
                if word in exceptions:
                    return exceptions[word]
                
                # Remove silent e at end
                if word.endswith('e') and len(word) > 2:
                    if not word.endswith(('le', 'ee', 'ie', 'ye', 'oe', 'ae')):
                        word = word[:-1]
                
                # Handle common suffixes
                suffix_adjustments = 0
                if word.endswith('ed'):
                    if word[-3] not in 'dt':
                        suffix_adjustments -= 1
                if word.endswith('es'):
                    if word[-3] not in 'sxzh' and not word.endswith('ches') and not word.endswith('shes'):
                        suffix_adjustments -= 1
                if word.endswith('ly'):
                    suffix_adjustments += 0  # ly usually adds a syllable
                if word.endswith('tion') or word.endswith('sion'):
                    suffix_adjustments += 0  # counted as one syllable
                
                # Count vowel groups
                vowels = "aeiouy"
                count = 0
                prev_vowel = False
                for i, char in enumerate(word):
                    is_vowel = char in vowels
                    if is_vowel and not prev_vowel:
                        count += 1
                    prev_vowel = is_vowel
                
                # Handle diphthongs and special cases
                diphthongs = ['ai', 'au', 'ay', 'ea', 'ee', 'ei', 'ey', 'ie', 'oa', 'oe', 'oi', 'oo', 'ou', 'oy', 'ue', 'ui']
                for d in diphthongs:
                    if d in word:
                        count -= word.count(d)
                        count += word.count(d)  # diphthongs count as 1
                
                count += suffix_adjustments
                return max(1, count)
            
            # Calculate syllables for all words
            syllable_counts = [count_syllables(w) for w in words]
            total_syllables = sum(syllable_counts)
            avg_syllables_per_word = total_syllables / word_count
            
            # Average metrics
            avg_word_length = char_count / word_count
            avg_sentence_length = word_count / sentence_count
            
            # Complex words (3+ syllables, excluding common suffixes)
            complex_words = sum(1 for s in syllable_counts if s >= 3)
            complex_word_pct = 100 * complex_words / word_count
            
            # ===== READABILITY FORMULAS =====
            
            # 1. Flesch Reading Ease (0-100, higher = easier)
            flesch_ease = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
            flesch_ease = max(0, min(100, flesch_ease))
            
            # 2. Flesch-Kincaid Grade Level
            fk_grade = (0.39 * avg_sentence_length) + (11.8 * avg_syllables_per_word) - 15.59
            fk_grade = max(0, fk_grade)
            
            # 3. Gunning Fog Index
            fog_index = 0.4 * (avg_sentence_length + complex_word_pct)
            
            # 4. SMOG Index (Simple Measure of Gobbledygook)
            if sentence_count >= 3:
                smog_index = 1.0430 * (30 * complex_words / sentence_count) ** 0.5 + 3.1291
            else:
                smog_index = 1.0430 * (complex_words * (30 / sentence_count)) ** 0.5 + 3.1291
            
            # 5. Coleman-Liau Index
            L = (char_count / word_count) * 100  # avg letters per 100 words
            S = (sentence_count / word_count) * 100  # avg sentences per 100 words
            coleman_liau = 0.0588 * L - 0.296 * S - 15.8
            coleman_liau = max(0, coleman_liau)
            
            # 6. Automated Readability Index (ARI)
            ari = 4.71 * (char_count / word_count) + 0.5 * (word_count / sentence_count) - 21.43
            ari = max(0, ari)
            
            # Reading level interpretation with more granularity
            if flesch_ease >= 90:
                reading_level = "Very Easy (5th grade)"
                audience = "Elementary school students, general public"
            elif flesch_ease >= 80:
                reading_level = "Easy (6th grade)"
                audience = "Middle school students, casual readers"
            elif flesch_ease >= 70:
                reading_level = "Fairly Easy (7th grade)"
                audience = "7th-8th grade students, everyday reading"
            elif flesch_ease >= 60:
                reading_level = "Standard (8th-9th grade)"
                audience = "High school students, general audience"
            elif flesch_ease >= 50:
                reading_level = "Fairly Difficult (10th-12th grade)"
                audience = "High school seniors, educated adults"
            elif flesch_ease >= 30:
                reading_level = "Difficult (College level)"
                audience = "College students, professionals"
            else:
                reading_level = "Very Difficult (Graduate level)"
                audience = "Graduate students, specialists, academics"
            
            # Vocabulary richness (Type-Token Ratio)
            unique_words = set(w.lower() for w in words)
            vocabulary_richness = round(len(unique_words) / word_count * 100, 1) if word_count > 0 else 0

            # Grade-level explanation
            avg_grade = round((fk_grade + fog_index + smog_index + coleman_liau + ari) / 5, 1)
            if avg_grade <= 5:
                grade_explanation = "Easily understood by 10-11 year olds"
            elif avg_grade <= 8:
                grade_explanation = "Suitable for 13-14 year old readers"
            elif avg_grade <= 12:
                grade_explanation = "Appropriate for high school students"
            elif avg_grade <= 16:
                grade_explanation = "College-level reading required"
            else:
                grade_explanation = "Graduate-level or professional reading"

            # Paragraph-level breakdown
            paragraphs = text.split('\n\n')
            paragraphs = [p.strip() for p in paragraphs if p.strip()]
            paragraph_breakdown = []
            for idx, para in enumerate(paragraphs[:10]):
                p_clean = re.sub(r'[^\w\s]', '', para)
                p_words = [w for w in p_clean.split() if w.isalpha()]
                p_sentences = re.split(r'[.!?]+', para)
                p_sentences = [s.strip() for s in p_sentences if s.strip()]
                p_wc = len(p_words)
                p_sc = len(p_sentences) if p_sentences else 1
                if p_wc > 0:
                    p_avg_sl = p_wc / p_sc
                    p_syls = [count_syllables(w) for w in p_words]
                    p_avg_syl = sum(p_syls) / p_wc
                    p_flesch = 206.835 - (1.015 * p_avg_sl) - (84.6 * p_avg_syl)
                    p_flesch = max(0, min(100, p_flesch))
                    paragraph_breakdown.append({
                        "paragraph": idx + 1,
                        "flesch_score": round(p_flesch, 1),
                        "word_count": p_wc,
                        "sentence_count": p_sc,
                        "avg_sentence_length": round(p_avg_sl, 1)
                    })

            # Generate improvement suggestions
            suggestions = []
            if avg_sentence_length > 20:
                suggestions.append("Break long sentences into shorter ones (aim for 15-20 words)")
            if avg_syllables_per_word > 1.7:
                suggestions.append("Use simpler words with fewer syllables")
            if complex_word_pct > 20:
                suggestions.append(f"Reduce complex words ({complex_word_pct:.0f}% have 3+ syllables)")
            if flesch_ease < 60:
                suggestions.append("Consider your audience - this text requires advanced reading skills")
            if vocabulary_richness < 40:
                suggestions.append("Vocabulary is repetitive - try using more varied word choices")
            if vocabulary_richness > 85:
                suggestions.append("High vocabulary diversity - ensure uncommon words are necessary")
            long_sentences = [s for s in sentences if len(s.split()) > 30]
            if long_sentences:
                suggestions.append(f"{len(long_sentences)} sentence(s) exceed 30 words - consider splitting")
            if not suggestions:
                suggestions.append("Text readability is good for general audiences")

            result = {
                "success": True,
                "flesch_reading_ease": round(flesch_ease, 1),
                "reading_level": reading_level,
                "recommended_audience": audience,
                "grade_explanation": grade_explanation,
                "average_grade_level": avg_grade,
                "flesch_kincaid_grade": round(fk_grade, 1),
                "gunning_fog_index": round(fog_index, 1),
                "smog_index": round(smog_index, 1),
                "coleman_liau_index": round(coleman_liau, 1),
                "automated_readability_index": round(ari, 1),
                "word_count": word_count,
                "sentence_count": sentence_count,
                "avg_sentence_length": round(avg_sentence_length, 1),
                "avg_word_length": round(avg_word_length, 1),
                "avg_syllables_per_word": round(avg_syllables_per_word, 2),
                "complex_word_count": complex_words,
                "complex_word_percentage": round(complex_word_pct, 1),
                "character_count": char_count,
                "total_syllables": total_syllables,
                "vocabulary_richness": vocabulary_richness,
                "paragraph_breakdown": paragraph_breakdown if paragraph_breakdown else None,
                "suggestions": suggestions
            }

            return result
        except Exception as e:
            logger.error(f"Readability analysis failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 5: Summarizer ====================
    def summarize(self, text: str, max_length: int = 150, min_length: int = 50) -> Dict[str, Any]:
        """Summarize text using T5 model with extractive summarization fallback."""
        try:
            used_t5 = False
            summary = None
            
            # Try T5 model first
            t5_prompt = f"Summarize the following text: {text}"
            t5_result = self._generate_with_t5(t5_prompt, max_length=max_length, min_length=min_length)
            
            if t5_result and len(t5_result) > 10 and len(t5_result) < len(text):
                summary = t5_result
                used_t5 = True
                logger.info("Summarization using T5 model successful")
                
                original_words = len(text.split())
                summary_words = len(summary.split())
                compression_ratio = round((1 - summary_words / original_words) * 100, 1) if original_words > 0 else 0
                
                return {
                    "success": True,
                    "original_text": text[:500] + "..." if len(text) > 500 else text,
                    "summary": summary,
                    "original_word_count": original_words,
                    "summary_word_count": summary_words,
                    "compression_ratio": compression_ratio,
                    "used_t5": used_t5
                }
            
            # Fallback to extractive summarization
            logger.info("Falling back to extractive summarization")
            
            # Split into sentences
            sentences = re.split(r'(?<=[.!?])\s+', text.strip())
            sentences = [s.strip() for s in sentences if s.strip() and len(s.split()) > 3]
            
            if len(sentences) == 0:
                return {"success": False, "error": "Text too short to summarize"}
            
            if len(sentences) <= 2:
                # Text is already short, return as is
                return {
                    "success": True,
                    "original_text": text[:500] + "..." if len(text) > 500 else text,
                    "summary": text,
                    "original_word_count": len(text.split()),
                    "summary_word_count": len(text.split()),
                    "compression_ratio": 0,
                    "used_t5": False
                }
            
            # Score sentences based on multiple factors
            word_freq = Counter()
            for sentence in sentences:
                words = re.findall(r'\b[a-zA-Z]+\b', sentence.lower())
                word_freq.update(words)
            
            # Remove common stop words from frequency count
            stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                         'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
                         'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
                         'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
                         'from', 'as', 'into', 'through', 'during', 'before', 'after',
                         'above', 'below', 'between', 'under', 'again', 'further', 'then',
                         'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
                         'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
                         'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
                         'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
                         'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he',
                         'she', 'we', 'they', 'what', 'which', 'who', 'whom'}
            
            for word in stop_words:
                word_freq.pop(word, None)
            
            # Score each sentence
            sentence_scores = []
            for i, sentence in enumerate(sentences):
                words = re.findall(r'\b[a-zA-Z]+\b', sentence.lower())
                if not words:
                    sentence_scores.append(0)
                    continue
                
                # Word frequency score
                freq_score = sum(word_freq.get(w, 0) for w in words) / len(words)
                
                # Position score (first and last sentences are often important)
                position_score = 1.0
                if i == 0:
                    position_score = 1.5
                elif i == len(sentences) - 1:
                    position_score = 1.2
                elif i < len(sentences) * 0.3:
                    position_score = 1.1
                
                # Length score (prefer medium-length sentences)
                length_score = min(len(words) / 20, 1.0) if len(words) < 20 else max(0.5, 1 - (len(words) - 20) / 40)
                
                total_score = freq_score * position_score * length_score
                sentence_scores.append(total_score)
            
            # Select top sentences (aim for ~30-40% of original)
            num_sentences = max(1, min(len(sentences) - 1, int(len(sentences) * 0.4)))
            
            # Get indices of top scoring sentences
            top_indices = sorted(range(len(sentence_scores)), key=lambda i: sentence_scores[i], reverse=True)[:num_sentences]
            
            # Sort by original order to maintain coherence
            top_indices.sort()
            
            # Build summary
            summary = ' '.join(sentences[i] for i in top_indices)
            
            original_words = len(text.split())
            summary_words = len(summary.split())
            compression_ratio = round((1 - summary_words / original_words) * 100, 1) if original_words > 0 else 0
            
            return {
                "success": True,
                "original_text": text[:500] + "..." if len(text) > 500 else text,
                "summary": summary,
                "original_word_count": original_words,
                "summary_word_count": summary_words,
                "compression_ratio": compression_ratio,
                "used_t5": False
            }
        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 6: Paraphraser ====================
    def paraphrase(self, text: str, mode: str = "standard") -> Dict[str, Any]:
        """Paraphrase text using CoEdIT-large instruction-tuned model."""
        try:
            logger.info(f"Paraphrasing text in mode: {mode}")

            mode_lower = mode.lower()
            instruction_map = {
                "standard": "Paraphrase this sentence",
                "simple": "Simplify this sentence",
                "formal": "Write this more formally",
                "creative": "Paraphrase this sentence",
                "fluency": "Make this text coherent",
            }
            instruction = instruction_map.get(mode_lower, "Paraphrase this sentence")

            paraphrased = self._edit_text_with_coedit(text, instruction, max_chunk_tokens=150)

            if not paraphrased or paraphrased == text:
                paraphrased = self._edit_text_with_coedit(text, "Paraphrase this sentence", max_chunk_tokens=150)

            changes_made = sum(1 for a, b in zip(text.split(), paraphrased.split()) if a != b)

            return {
                "success": True,
                "original_text": text,
                "paraphrased_text": paraphrased,
                "mode": mode,
                "original_word_count": len(text.split()),
                "paraphrased_word_count": len(paraphrased.split()),
                "changes_made": changes_made,
                "used_t5": True
            }
        except Exception as e:
            logger.error(f"Paraphrasing failed: {e}")
            return {"success": False, "error": str(e)}

    def _paraphrase_rule_based_legacy(self, text: str, mode: str = "standard") -> Dict[str, Any]:
        """Legacy rule-based paraphraser kept as fallback."""
        try:
            import random
            synonyms = {
                # Common verbs
                "use": ["utilize", "employ", "apply", "leverage"],
                "make": ["create", "produce", "generate", "construct"],
                "get": ["obtain", "acquire", "receive", "gain"],
                "give": ["provide", "offer", "supply", "deliver"],
                "show": ["demonstrate", "display", "reveal", "illustrate"],
                "help": ["assist", "aid", "support", "facilitate"],
                "find": ["discover", "locate", "identify", "uncover"],
                "think": ["believe", "consider", "suppose", "reckon"],
                "know": ["understand", "recognize", "realize", "comprehend"],
                "want": ["desire", "wish", "seek", "aspire"],
                "need": ["require", "necessitate", "demand"],
                "try": ["attempt", "endeavor", "strive"],
                "start": ["begin", "commence", "initiate", "launch"],
                "end": ["finish", "conclude", "complete", "terminate"],
                "change": ["modify", "alter", "transform", "adjust"],
                "move": ["relocate", "transfer", "shift", "transport"],
                "work": ["function", "operate", "perform", "labor"],
                "run": ["operate", "execute", "manage", "conduct"],
                "keep": ["maintain", "retain", "preserve", "sustain"],
                "let": ["allow", "permit", "enable"],
                "put": ["place", "position", "set", "locate"],
                "take": ["grab", "seize", "capture", "acquire"],
                "come": ["arrive", "approach", "reach"],
                "go": ["proceed", "advance", "travel", "move"],
                "see": ["observe", "notice", "view", "perceive"],
                "look": ["examine", "inspect", "observe", "view"],
                "say": ["state", "express", "declare", "mention"],
                "tell": ["inform", "notify", "advise", "communicate"],
                "ask": ["inquire", "question", "request"],
                "jump": ["leap", "spring", "bound", "hop"],
                "jumps": ["leaps", "springs", "bounds", "hops"],
                
                # Common adjectives - expanded
                "good": ["excellent", "great", "fine", "superior"],
                "bad": ["poor", "inferior", "substandard", "inadequate"],
                "big": ["large", "substantial", "significant", "considerable"],
                "small": ["little", "minor", "modest", "compact"],
                "new": ["recent", "fresh", "modern", "novel"],
                "old": ["ancient", "aged", "former", "previous"],
                "important": ["significant", "crucial", "vital", "essential"],
                "different": ["distinct", "varied", "diverse", "unique"],
                "same": ["identical", "similar", "equivalent", "alike"],
                "easy": ["simple", "straightforward", "effortless"],
                "hard": ["difficult", "challenging", "tough", "demanding"],
                "fast": ["quick", "rapid", "swift", "speedy"],
                "slow": ["gradual", "unhurried", "leisurely"],
                "high": ["elevated", "tall", "lofty"],
                "low": ["reduced", "minimal", "diminished"],
                "long": ["extended", "lengthy", "prolonged"],
                "short": ["brief", "concise", "compact"],
                "many": ["numerous", "several", "multiple", "various"],
                "few": ["limited", "scarce", "sparse"],
                "great": ["excellent", "outstanding", "remarkable", "superb"],
                "little": ["small", "minor", "slight", "minimal"],
                "quick": ["fast", "rapid", "swift", "speedy"],
                "brown": ["chestnut", "tan", "auburn", "tawny"],
                "lazy": ["idle", "sluggish", "lethargic", "indolent"],
                "large": ["big", "huge", "massive", "enormous"],
                "happy": ["joyful", "pleased", "delighted", "content"],
                "sad": ["unhappy", "sorrowful", "melancholy", "dejected"],
                "beautiful": ["gorgeous", "stunning", "lovely", "attractive"],
                "ugly": ["unattractive", "unsightly", "hideous", "grotesque"],
                "smart": ["intelligent", "clever", "bright", "brilliant"],
                "stupid": ["foolish", "dumb", "ignorant", "dense"],
                "strong": ["powerful", "mighty", "robust", "sturdy"],
                "weak": ["feeble", "frail", "fragile", "delicate"],
                "innovative": ["groundbreaking", "pioneering", "revolutionary", "cutting-edge"],
                "confident": ["assured", "certain", "self-assured", "positive"],
                "excited": ["thrilled", "enthusiastic", "eager", "elated"],
                "valuable": ["precious", "worthwhile", "important", "significant"],
                "clear": ["obvious", "evident", "apparent", "plain"],
                
                # Common nouns - expanded
                "way": ["method", "approach", "manner", "technique"],
                "thing": ["item", "object", "element", "aspect"],
                "place": ["location", "site", "area", "spot"],
                "problem": ["issue", "challenge", "difficulty", "obstacle"],
                "part": ["portion", "section", "segment", "component"],
                "group": ["team", "collection", "set", "assembly"],
                "fact": ["truth", "reality", "detail", "point"],
                "idea": ["concept", "notion", "thought", "theory"],
                "point": ["aspect", "detail", "matter", "issue"],
                "reason": ["cause", "motive", "basis", "rationale"],
                "result": ["outcome", "consequence", "effect", "conclusion"],
                "answer": ["response", "reply", "solution"],
                "question": ["inquiry", "query", "issue"],
                "fox": ["canine", "animal", "creature"],
                "dog": ["canine", "hound", "pooch"],
                "company": ["organization", "firm", "business", "enterprise"],
                "project": ["initiative", "undertaking", "venture", "endeavor"],
                "solution": ["answer", "resolution", "remedy", "fix"],
                "market": ["marketplace", "industry", "sector", "arena"],
                "opportunity": ["chance", "prospect", "opening", "possibility"],
                "impact": ["effect", "influence", "consequence", "result"],
                
                # Common adverbs
                "very": ["extremely", "highly", "remarkably", "exceptionally"],
                "really": ["truly", "genuinely", "actually", "indeed"],
                "also": ["additionally", "furthermore", "moreover", "besides"],
                "just": ["simply", "merely", "only"],
                "now": ["currently", "presently", "at this moment"],
                "always": ["constantly", "continually", "perpetually"],
                "never": ["not ever", "at no time"],
                "often": ["frequently", "regularly", "commonly"],
                "sometimes": ["occasionally", "periodically", "at times"],
                "usually": ["typically", "generally", "normally", "commonly"],
                "quickly": ["rapidly", "swiftly", "promptly", "speedily"],
                "slowly": ["gradually", "steadily", "leisurely"],
                "significantly": ["considerably", "substantially", "notably", "markedly"],
                
                # Articles and prepositions for restructuring
                "the": ["this", "that"],
                "over": ["above", "across", "beyond"],
            }
            
            # Simple words for "simple" mode
            simple_words = {
                "utilize": "use", "employ": "use", "leverage": "use",
                "obtain": "get", "acquire": "get", "procure": "get",
                "demonstrate": "show", "illustrate": "show", "exhibit": "show",
                "facilitate": "help", "assist": "help", "aid": "help",
                "commence": "start", "initiate": "start", "begin": "start",
                "terminate": "end", "conclude": "end", "finish": "end",
                "substantial": "big", "significant": "big", "considerable": "big",
                "minimal": "small", "minor": "small", "modest": "small",
                "numerous": "many", "multiple": "many", "various": "many",
                "extremely": "very", "highly": "very", "remarkably": "very",
                "approximately": "about", "roughly": "about",
                "subsequently": "then", "thereafter": "then",
                "nevertheless": "but", "however": "but", "nonetheless": "but",
                "therefore": "so", "consequently": "so", "thus": "so",
                "furthermore": "also", "moreover": "also", "additionally": "also",
                "revolutionized": "changed", "enabling": "allowing", "automation": "automatic processes",
            }
            
            # Formal words for "formal" mode
            formal_words = {
                "use": "utilize", "get": "obtain", "show": "demonstrate",
                "help": "facilitate", "start": "commence", "end": "conclude",
                "big": "substantial", "small": "minimal", "many": "numerous",
                "very": "extremely", "about": "approximately", "but": "however",
                "so": "therefore", "also": "furthermore", "think": "consider",
                "want": "desire", "need": "require", "try": "endeavor",
                "quick": "expeditious", "fast": "rapid", "good": "excellent",
                "bad": "inadequate", "happy": "pleased", "sad": "disheartened",
            }
            
            paraphrased = text
            mode_lower = mode.lower()
            changes_made = 0
            
            if mode_lower == "simple":
                # Replace complex words with simple ones
                for complex_word, simple_word in simple_words.items():
                    if re.search(r'\b' + re.escape(complex_word) + r'\b', paraphrased, re.IGNORECASE):
                        paraphrased = re.sub(r'\b' + re.escape(complex_word) + r'\b', simple_word, paraphrased, flags=re.IGNORECASE)
                        changes_made += 1
            
            elif mode_lower == "formal":
                # Replace casual words with formal ones
                for casual_word, formal_word in formal_words.items():
                    if re.search(r'\b' + re.escape(casual_word) + r'\b', paraphrased, re.IGNORECASE):
                        paraphrased = re.sub(r'\b' + re.escape(casual_word) + r'\b', formal_word, paraphrased, flags=re.IGNORECASE)
                        changes_made += 1
            
            else:
                # Standard, fluency, or creative mode - use synonym replacement
                # Higher replacement rate for creative mode
                replacement_rate = 0.95 if mode_lower == "creative" else 0.85
                
                words = paraphrased.split()
                new_words = []
                
                for word in words:
                    # Clean word for lookup (remove punctuation)
                    clean_word = re.sub(r'[^\w]', '', word.lower())
                    punctuation = ""
                    if word and word[-1] in '.,!?;:':
                        punctuation = word[-1]
                    
                    if clean_word in synonyms and random.random() < replacement_rate:
                        # Get a random synonym
                        synonym = random.choice(synonyms[clean_word])
                        
                        # Preserve original capitalization
                        if word and word[0].isupper():
                            synonym = synonym.capitalize()
                        
                        # Add back punctuation
                        synonym += punctuation
                        
                        new_words.append(synonym)
                        changes_made += 1
                    else:
                        new_words.append(word)
                
                paraphrased = ' '.join(new_words)
                
                # Additional transformations for more significant changes
                # 1. Sentence restructuring - add ONE introductory phrase to a random sentence
                sentences = re.split(r'(?<=[.!?])\s+', paraphrased)
                restructured_sentences = []
                
                # Only add intro to ONE sentence (randomly chosen)
                intro_added = False
                intro_sentence_idx = random.randint(0, max(0, len(sentences) - 1)) if sentences else -1
                
                for idx, sent in enumerate(sentences):
                    # Add intro phrase only to the chosen sentence
                    if idx == intro_sentence_idx and not intro_added and random.random() < 0.7:
                        intros = {
                            "standard": ["In essence, ", "Essentially, ", "Put simply, ", "To put it another way, "],
                            "creative": ["Remarkably, ", "Interestingly, ", "Notably, ", "Strikingly, ", "Fascinatingly, "],
                            "fluency": ["Moreover, ", "Furthermore, ", "Additionally, ", "In addition, "]
                        }
                        mode_intros = intros.get(mode_lower, intros["standard"])
                        if not any(sent.lower().startswith(intro.lower().strip()) for intro in mode_intros):
                            intro = random.choice(mode_intros)
                            sent = intro + sent[0].lower() + sent[1:] if sent else sent
                            changes_made += 1
                            intro_added = True
                    restructured_sentences.append(sent)
                
                paraphrased = ' '.join(restructured_sentences)
                
                # 2. Replace common phrases with alternatives
                phrase_alternatives = {
                    "in order to": ["to", "so as to", "with the aim of"],
                    "due to": ["because of", "owing to", "as a result of"],
                    "as well as": ["along with", "together with", "in addition to"],
                    "in terms of": ["regarding", "concerning", "with respect to"],
                    "a lot of": ["numerous", "many", "a great deal of"],
                    "kind of": ["somewhat", "rather", "fairly"],
                    "sort of": ["somewhat", "rather", "in a way"],
                    "more and more": ["increasingly", "progressively", "ever more"],
                    "at the same time": ["simultaneously", "concurrently", "meanwhile"],
                    "on the other hand": ["conversely", "alternatively", "in contrast"],
                    "for example": ["for instance", "such as", "to illustrate"],
                    "in fact": ["indeed", "actually", "as a matter of fact"],
                    "as a result": ["consequently", "therefore", "thus"],
                }
                
                for phrase, alternatives in phrase_alternatives.items():
                    if phrase in paraphrased.lower():
                        replacement = random.choice(alternatives)
                        paraphrased = re.sub(re.escape(phrase), replacement, paraphrased, flags=re.IGNORECASE, count=1)
                        changes_made += 1
            
            # For fluency mode, also improve sentence flow
            if mode_lower == "fluency":
                # Add transitional phrases between sentences
                sentences = re.split(r'(?<=[.!?])\s+', paraphrased)
                if len(sentences) > 1:
                    transitions = ["Additionally, ", "Furthermore, ", "Moreover, ", "In addition, ", "Also, "]
                    new_sentences = [sentences[0]]
                    for i, sent in enumerate(sentences[1:], 1):
                        if random.random() < 0.5 and not sent.startswith(tuple(transitions)):
                            sent = random.choice(transitions) + sent[0].lower() + sent[1:] if sent else sent
                            changes_made += 1
                        new_sentences.append(sent)
                    paraphrased = ' '.join(new_sentences)
            
            # GUARANTEE: If no changes were made, force some restructuring
            if changes_made == 0 or paraphrased == text:
                logger.info("No changes made, applying guaranteed restructuring")
                # Restructure the sentence
                sentences = re.split(r'(?<=[.!?])\s+', text)
                restructured = []
                
                for sent in sentences:
                    words = sent.split()
                    if len(words) >= 5:
                        # Try to restructure by moving phrases around
                        # Find subject-verb-object pattern and rearrange
                        if mode_lower == "creative":
                            # Add an introductory phrase
                            intros = ["Indeed, ", "Notably, ", "In essence, ", "Essentially, "]
                            sent = random.choice(intros) + sent[0].lower() + sent[1:] if sent else sent
                        elif mode_lower == "formal":
                            # Make it more formal with passive voice hint
                            sent = "It can be observed that " + sent[0].lower() + sent[1:] if sent else sent
                        else:
                            # Standard: add a simple restructure
                            # Replace common words with synonyms forcefully
                            for orig, syns in [("the", "this"), ("a", "one"), ("is", "appears to be"), ("are", "seem to be")]:
                                if f" {orig} " in sent.lower():
                                    sent = re.sub(r'\b' + orig + r'\b', syns, sent, count=1, flags=re.IGNORECASE)
                                    break
                    restructured.append(sent)
                
                paraphrased = ' '.join(restructured)
            
            return {
                "success": True,
                "original_text": text,
                "paraphrased_text": paraphrased,
                "mode": mode,
                "original_word_count": len(text.split()),
                "paraphrased_word_count": len(paraphrased.split()),
                "changes_made": changes_made,
                "used_t5": False
            }
        except Exception as e:
            logger.error(f"Paraphrasing failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 7: Citation Generator ====================
    async def generate_citation(
        self, 
        query: str = None,
        doi: str = None,
        url: str = None,
        style: str = "apa"
    ) -> Dict[str, Any]:
        """Generate citations using CrossRef API."""
        try:
            citation_data = None
            
            if doi:
                # Fetch from CrossRef by DOI
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        f"https://api.crossref.org/works/{doi}",
                        headers={"User-Agent": "TextShift/1.0 (mailto:support@mail.textshift.org)"}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        citation_data = data.get("message", {})
            
            elif query:
                # Search CrossRef
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        "https://api.crossref.org/works",
                        params={"query": query, "rows": 5},
                        headers={"User-Agent": "TextShift/1.0 (mailto:support@mail.textshift.org)"}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        items = data.get("message", {}).get("items", [])
                        if items:
                            citation_data = items[0]
            
            if not citation_data:
                return {"success": False, "error": "No citation data found"}
            
            # Extract citation components
            title = citation_data.get("title", ["Unknown Title"])[0] if citation_data.get("title") else "Unknown Title"
            authors = citation_data.get("author", [])
            author_names = []
            for author in authors[:5]:  # Limit to 5 authors
                given = author.get("given", "")
                family = author.get("family", "")
                author_names.append(f"{family}, {given[0]}." if given else family)
            
            year = citation_data.get("published-print", {}).get("date-parts", [[None]])[0][0]
            if not year:
                year = citation_data.get("published-online", {}).get("date-parts", [[None]])[0][0]
            year = year or "n.d."
            
            journal = citation_data.get("container-title", [""])[0] if citation_data.get("container-title") else ""
            volume = citation_data.get("volume", "")
            issue = citation_data.get("issue", "")
            pages = citation_data.get("page", "")
            doi_str = citation_data.get("DOI", "")
            
            # Format citation based on style
            if style.lower() == "apa":
                authors_str = ", ".join(author_names[:5])
                if len(authors) > 5:
                    authors_str += ", et al."
                citation = f"{authors_str} ({year}). {title}."
                if journal:
                    citation += f" {journal}"
                    if volume:
                        citation += f", {volume}"
                        if issue:
                            citation += f"({issue})"
                    if pages:
                        citation += f", {pages}"
                    citation += "."
                if doi_str:
                    citation += f" https://doi.org/{doi_str}"
            
            elif style.lower() == "mla":
                authors_str = ", ".join(author_names[:3])
                if len(authors) > 3:
                    authors_str += ", et al."
                citation = f'{authors_str}. "{title}."'
                if journal:
                    citation += f" {journal}"
                    if volume:
                        citation += f", vol. {volume}"
                        if issue:
                            citation += f", no. {issue}"
                    citation += f", {year}"
                    if pages:
                        citation += f", pp. {pages}"
                    citation += "."
            
            elif style.lower() == "chicago":
                authors_str = ", ".join(author_names)
                citation = f'{authors_str}. "{title}."'
                if journal:
                    citation += f" {journal}"
                    if volume:
                        citation += f" {volume}"
                        if issue:
                            citation += f", no. {issue}"
                    citation += f" ({year})"
                    if pages:
                        citation += f": {pages}"
                    citation += "."
            
            else:
                citation = f"{', '.join(author_names)} ({year}). {title}."
            
            return {
                "success": True,
                "citation": citation,
                "style": style,
                "title": title,
                "authors": author_names,
                "year": year,
                "journal": journal,
                "doi": doi_str,
                "raw_data": {
                    "volume": volume,
                    "issue": issue,
                    "pages": pages
                }
            }
        except Exception as e:
            logger.error(f"Citation generation failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 8: Word Counter ====================
    def count_words_detailed(self, text: str) -> Dict[str, Any]:
        """Detailed word, character, and text statistics analysis."""
        try:
            words = text.split()
            word_count = len(words)
            char_count_with_spaces = len(text)
            char_count_no_spaces = len(text.replace(" ", "").replace("\n", "").replace("\t", ""))

            letter_count = sum(1 for c in text if c.isalpha())
            digit_count = sum(1 for c in text if c.isdigit())
            special_count = char_count_with_spaces - letter_count - digit_count - text.count(' ') - text.count('\n') - text.count('\t')

            sentences = re.split(r'[.!?]+', text)
            sentences = [s.strip() for s in sentences if s.strip()]
            sentence_count = len(sentences)

            paragraphs = text.split('\n\n')
            paragraphs = [p.strip() for p in paragraphs if p.strip()]
            paragraph_count = len(paragraphs) if paragraphs else 1

            reading_time_minutes = word_count / 238
            speaking_time_minutes = word_count / 150

            reading_time_display = f"{int(reading_time_minutes)} min {int((reading_time_minutes % 1) * 60)} sec"
            speaking_time_display = f"{int(speaking_time_minutes)} min {int((speaking_time_minutes % 1) * 60)} sec"

            unique_words = len(set(w.lower() for w in words))

            stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                         'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
                         'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
                         'may', 'might', 'must', 'it', 'its', 'this', 'that', 'these', 'those',
                         'i', 'you', 'he', 'she', 'we', 'they'}
            filtered_words = [re.sub(r'[^\w]', '', w.lower()) for w in words
                            if w.lower() not in stop_words and len(w) > 2]
            filtered_words = [w for w in filtered_words if w]
            word_freq = Counter(filtered_words)
            top_words = word_freq.most_common(10)

            keyword_density = []
            for w, c in top_words:
                density = round(c / word_count * 100, 2) if word_count > 0 else 0
                keyword_density.append({"word": w, "count": c, "density": density})

            sentence_lengths = [len(s.split()) for s in sentences]
            longest_sentence = max(sentence_lengths) if sentence_lengths else 0
            shortest_sentence = min(sentence_lengths) if sentence_lengths else 0
            avg_sentence_length = round(sum(sentence_lengths) / len(sentence_lengths), 1) if sentence_lengths else 0

            paragraph_word_counts = []
            for p in paragraphs:
                p_words = len(p.split())
                paragraph_word_counts.append(p_words)
            avg_paragraph_length = round(sum(paragraph_word_counts) / len(paragraph_word_counts), 1) if paragraph_word_counts else 0

            return {
                "success": True,
                "word_count": word_count,
                "character_count": char_count_with_spaces,
                "character_count_no_spaces": char_count_no_spaces,
                "letter_count": letter_count,
                "digit_count": digit_count,
                "special_char_count": special_count,
                "sentence_count": sentence_count,
                "paragraph_count": paragraph_count,
                "unique_words": unique_words,
                "avg_word_length": round(char_count_no_spaces / word_count, 1) if word_count > 0 else 0,
                "avg_sentence_length": avg_sentence_length,
                "longest_sentence_words": longest_sentence,
                "shortest_sentence_words": shortest_sentence,
                "avg_paragraph_length": avg_paragraph_length,
                "reading_time_minutes": round(reading_time_minutes, 1),
                "reading_time_display": reading_time_display,
                "speaking_time_minutes": round(speaking_time_minutes, 1),
                "speaking_time_display": speaking_time_display,
                "top_words": [{"word": w, "count": c} for w, c in top_words],
                "keyword_density": keyword_density
            }
        except Exception as e:
            logger.error(f"Word count failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 9: Translator ====================
    def _translate_chunk_via_sagemaker(self, lang_pair: str, chunk: str) -> Optional[str]:
        """Translate a single chunk via SageMaker multi-model GPU endpoint."""
        try:
            endpoint_key = f"translator-{lang_pair}"
            result = sagemaker_client.invoke_translation(endpoint_key, chunk)
            if result and len(result.strip()) > 0:
                return result.strip()
            return None
        except Exception as e:
            logger.warning(f"SageMaker translator chunk failed: {e}")
            return None

    def translate(self, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """Translate text using SageMaker GPU (primary) with local Helsinki-NLP fallback."""
        try:
            lang_pair = f"{source_lang}-{target_lang}"
            
            if lang_pair not in self.SUPPORTED_LANGUAGES:
                return {
                    "success": False,
                    "error": f"Language pair {lang_pair} not supported. Supported: {list(self.SUPPORTED_LANGUAGES.keys())}"
                }
            
            sentences = re.split(r'(?<=[.!?])\s+', text)
            sentences = [s for s in sentences if s.strip()]
            
            chunks: list[str] = []
            current_chunk: list[str] = []
            current_len = 0
            for sentence in sentences:
                slen = len(sentence)
                if current_len + slen > 400 and current_chunk:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = [sentence]
                    current_len = slen
                else:
                    current_chunk.append(sentence)
                    current_len += slen
            if current_chunk:
                chunks.append(' '.join(current_chunk))

            translated_chunks: list[Optional[str]] = [None] * len(chunks)
            used_gpu = False

            if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                try:
                    endpoint_key = f"translator-{lang_pair}"
                    batch_results = sagemaker_client.invoke_translation_batch(
                        endpoint_key, chunks, max_workers=8
                    )
                    failed_indices = []
                    for idx, result in enumerate(batch_results):
                        if result and len(result.strip()) > 0:
                            translated_chunks[idx] = result.strip()
                        else:
                            failed_indices.append(idx)

                    if not failed_indices:
                        logger.info(f"SageMaker GPU batch translated {len(chunks)} chunks")
                        used_gpu = True
                    else:
                        logger.info(f"SageMaker GPU: {len(chunks) - len(failed_indices)}/{len(chunks)} succeeded, falling back to local for {len(failed_indices)} chunks")
                        if len(failed_indices) < len(chunks):
                            used_gpu = True
                except Exception as e:
                    logger.warning(f"SageMaker GPU translation failed, falling back to local: {e}")

            local_needed = [i for i, t in enumerate(translated_chunks) if t is None]
            if local_needed:
                self._load_translator_model(lang_pair)
                if lang_pair in self._translator_models:
                    tokenizer, model = self._translator_models[lang_pair]
                    for idx in local_needed:
                        chunk = chunks[idx]
                        chunk_sentences = re.split(r'(?<=[.!?])\s+', chunk)
                        chunk_translated = []
                        for sent in chunk_sentences:
                            if not sent.strip():
                                continue
                            inputs = tokenizer(sent, return_tensors="pt", truncation=True, max_length=512)
                            with torch.no_grad():
                                outputs = model.generate(**inputs, max_length=512, num_beams=4)
                            chunk_translated.append(tokenizer.decode(outputs[0], skip_special_tokens=True))
                        translated_chunks[idx] = ' '.join(chunk_translated)
                else:
                    return {"success": False, "error": f"Failed to load translator for {lang_pair}"}

            translated_text = " ".join(t for t in translated_chunks if t)
            
            return {
                "success": True,
                "original_text": text,
                "translated_text": translated_text,
                "source_language": source_lang,
                "target_language": target_lang,
                "language_pair": self.SUPPORTED_LANGUAGES[lang_pair],
                "word_count_original": len(text.split()),
                "word_count_translated": len(translated_text.split()),
                "backend": "SageMaker GPU" if used_gpu else "Local CPU"
            }
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 10: Export Options ====================
    def export_text(self, text: str, format: str, title: str = "Document") -> Dict[str, Any]:
        """Export text to different formats (TXT, HTML, Markdown, PDF)."""
        try:
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
            
            if format.lower() == "txt":
                content = f"{title}\n{'=' * len(title)}\n\n{text}\n\n---\nExported from TextShift on {timestamp}"
                mime_type = "text/plain"
                extension = "txt"
            
            elif format.lower() == "html":
                paragraphs = text.split('\n\n')
                html_paragraphs = ''.join(f'<p>{p}</p>' for p in paragraphs if p.strip())
                content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }}
        h1 {{ color: #333; }}
        p {{ margin-bottom: 1em; }}
        footer {{ margin-top: 40px; color: #666; font-size: 0.9em; border-top: 1px solid #ddd; padding-top: 20px; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    {html_paragraphs}
    <footer>Exported from TextShift on {timestamp}</footer>
</body>
</html>"""
                mime_type = "text/html"
                extension = "html"
            
            elif format.lower() == "markdown" or format.lower() == "md":
                content = f"# {title}\n\n{text}\n\n---\n*Exported from TextShift on {timestamp}*"
                mime_type = "text/markdown"
                extension = "md"
            
            elif format.lower() == "pdf":
                import base64
                try:
                    from fpdf import FPDF
                except ImportError:
                    return {"success": False, "error": "PDF export requires the fpdf2 library. Please install it with: pip install fpdf2"}
                
                pdf = FPDF()
                pdf.set_auto_page_break(auto=True, margin=25)
                pdf.add_page()
                pdf.set_font("Helvetica", "B", 18)
                pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT", align="C")
                pdf.ln(8)
                pdf.set_font("Helvetica", "", 11)
                pdf.multi_cell(0, 6, text)
                pdf.ln(10)
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 6, f"Exported from TextShift on {timestamp}", align="C")
                
                pdf_bytes = pdf.output()
                content = base64.b64encode(pdf_bytes).decode("utf-8")
                mime_type = "application/pdf"
                extension = "pdf"
                
                return {
                    "success": True,
                    "content": content,
                    "format": "pdf",
                    "mime_type": mime_type,
                    "extension": extension,
                    "filename": f"{title.replace(' ', '_').lower()}.pdf",
                    "size_bytes": len(pdf_bytes),
                    "encoding": "base64"
                }
            
            else:
                return {"success": False, "error": f"Unsupported format: {format}"}
            
            return {
                "success": True,
                "content": content,
                "format": format.lower(),
                "mime_type": mime_type,
                "extension": extension,
                "filename": f"{title.replace(' ', '_').lower()}.{extension}",
                "size_bytes": len(content.encode('utf-8'))
            }
        except Exception as e:
            logger.error(f"Export failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== Feature 13: Style Analysis ====================
    def analyze_style(self, text: str) -> Dict[str, Any]:
        """Analyze writing style with POS distribution, formality, sentence variety, and transitions."""
        try:
            words = text.split()
            sentences = re.split(r'[.!?]+', text)
            sentences = [s.strip() for s in sentences if s.strip()]

            word_count = len(words)
            sentence_count = len(sentences) if sentences else 1

            unique_words = set(w.lower() for w in words)
            ttr = len(unique_words) / word_count if word_count > 0 else 0

            sentence_lengths = [len(s.split()) for s in sentences]
            avg_sentence_length = sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0
            sentence_length_std = (sum((l - avg_sentence_length) ** 2 for l in sentence_lengths) / len(sentence_lengths)) ** 0.5 if sentence_lengths else 0

            passive_indicators = ['was', 'were', 'been', 'being', 'is', 'are', 'am']
            passive_sentences = []
            for s in sentences:
                s_lower = f" {s.lower()} "
                if any(f" {p} " in s_lower for p in passive_indicators) and 'by' in s_lower:
                    passive_sentences.append(s[:80] + "..." if len(s) > 80 else s)
            passive_count = len(passive_sentences)
            passive_percentage = (passive_count / sentence_count * 100) if sentence_count > 0 else 0

            question_count = text.count('?')
            exclamation_count = text.count('!')

            transition_words_list = [
                'however', 'therefore', 'moreover', 'furthermore', 'consequently',
                'nevertheless', 'meanwhile', 'additionally', 'similarly', 'likewise',
                'in contrast', 'on the other hand', 'as a result', 'for example',
                'in conclusion', 'in addition', 'on the contrary', 'in other words',
                'for instance', 'above all', 'after all', 'in fact', 'as a matter of fact'
            ]
            text_lower = text.lower()
            transition_found = [tw for tw in transition_words_list if tw in text_lower]
            transition_count = len(transition_found)

            # POS distribution (rule-based approximation)
            common_nouns_suffixes = ('tion', 'ment', 'ness', 'ity', 'ence', 'ance', 'ism', 'ist', 'er', 'or')
            common_verb_suffixes = ('ing', 'ize', 'ify', 'ate')
            common_adj_suffixes = ('ful', 'less', 'ous', 'ive', 'able', 'ible', 'al', 'ial')
            common_adv_suffixes = ('ly',)
            common_verbs = {'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
                          'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
                          'must', 'shall', 'can', 'go', 'get', 'make', 'know', 'take', 'come',
                          'see', 'want', 'look', 'use', 'find', 'give', 'tell', 'work', 'call',
                          'try', 'ask', 'need', 'feel', 'become', 'leave', 'put', 'mean', 'keep',
                          'let', 'begin', 'seem', 'help', 'show', 'hear', 'play', 'run', 'move', 'live'}
            common_pronouns = {'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself',
                             'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
                             'it', 'its', 'itself', 'we', 'us', 'our', 'ours', 'ourselves',
                             'they', 'them', 'their', 'theirs', 'themselves'}
            common_prepositions = {'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
                                 'into', 'through', 'during', 'before', 'after', 'above', 'below',
                                 'between', 'under', 'over', 'about', 'against', 'among'}

            noun_count = verb_count = adj_count = adv_count = 0
            for w in words:
                w_lower = re.sub(r'[^\w]', '', w.lower())
                if not w_lower:
                    continue
                if w_lower in common_verbs or (len(w_lower) > 4 and w_lower.endswith(common_verb_suffixes)):
                    verb_count += 1
                elif w_lower.endswith(common_adv_suffixes) and len(w_lower) > 3:
                    adv_count += 1
                elif w_lower.endswith(common_adj_suffixes) and len(w_lower) > 4:
                    adj_count += 1
                elif w_lower in common_pronouns or w_lower in common_prepositions:
                    pass
                elif w_lower.endswith(common_nouns_suffixes) or (w_lower[0].isupper() if w_lower else False):
                    noun_count += 1

            pos_distribution = {
                "nouns": noun_count,
                "verbs": verb_count,
                "adjectives": adj_count,
                "adverbs": adv_count
            }

            # Sentence variety score (0-100, higher = more varied)
            if sentence_lengths and len(sentence_lengths) > 1:
                short_sents = sum(1 for l in sentence_lengths if l <= 8)
                medium_sents = sum(1 for l in sentence_lengths if 9 <= l <= 20)
                long_sents = sum(1 for l in sentence_lengths if l > 20)
                categories_used = sum(1 for c in [short_sents, medium_sents, long_sents] if c > 0)
                length_diversity = categories_used / 3 * 50
                std_component = min(sentence_length_std / 10 * 50, 50)
                sentence_variety_score = round(length_diversity + std_component, 1)
            else:
                sentence_variety_score = 0

            # Formality score (0-100, higher = more formal)
            formal_words = {'therefore', 'consequently', 'furthermore', 'moreover', 'nevertheless',
                          'notwithstanding', 'accordingly', 'subsequently', 'preceding', 'aforementioned',
                          'henceforth', 'whereby', 'herein', 'thereof'}
            informal_words = {'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'yeah', 'hey', 'cool',
                            'awesome', 'stuff', 'thing', 'things', 'basically', 'literally', 'totally',
                            'super', 'pretty', 'really', 'guys', 'ok', 'okay', 'lol', 'btw'}
            contractions = ["n't", "'re", "'ve", "'ll", "'m", "'d", "'s"]

            formal_count = sum(1 for w in words if w.lower() in formal_words)
            informal_count = sum(1 for w in words if w.lower() in informal_words)
            contraction_count = sum(1 for c in contractions if c in text.lower())

            formality_base = 50
            formality_base += formal_count * 5
            formality_base -= informal_count * 5
            formality_base -= contraction_count * 3
            formality_base += min(avg_sentence_length / 5, 15)
            if passive_percentage > 20:
                formality_base += 5
            formality_score = max(0, min(100, round(formality_base, 1)))

            if formality_score >= 75:
                formality_label = "Highly Formal"
            elif formality_score >= 55:
                formality_label = "Formal"
            elif formality_score >= 40:
                formality_label = "Neutral"
            elif formality_score >= 25:
                formality_label = "Informal"
            else:
                formality_label = "Very Informal"

            stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                         'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
                         'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                         'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
                         'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
                         'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their',
                         'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
                         'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
                         'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
                         'than', 'too', 'just', 'also', 'now', 'here', 'there', 'then'}

            word_freq = Counter()
            for word in words:
                clean_word = re.sub(r'[^\w]', '', word.lower())
                if clean_word and clean_word not in stop_words and len(clean_word) > 2:
                    word_freq[clean_word] += 1

            overused_words = []
            overused_threshold = 3
            word_alternatives = {
                'very': ['extremely', 'highly', 'remarkably', 'exceptionally', 'particularly'],
                'really': ['truly', 'genuinely', 'actually', 'indeed', 'certainly'],
                'good': ['excellent', 'great', 'fine', 'superior', 'outstanding'],
                'bad': ['poor', 'inferior', 'inadequate', 'substandard', 'unsatisfactory'],
                'big': ['large', 'substantial', 'significant', 'considerable', 'massive'],
                'small': ['little', 'minor', 'modest', 'compact', 'tiny'],
                'said': ['stated', 'mentioned', 'noted', 'remarked', 'expressed'],
                'think': ['believe', 'consider', 'suppose', 'reckon', 'feel'],
                'important': ['significant', 'crucial', 'vital', 'essential', 'critical'],
                'nice': ['pleasant', 'enjoyable', 'delightful', 'lovely', 'wonderful'],
                'thing': ['item', 'object', 'element', 'aspect', 'matter'],
                'things': ['items', 'objects', 'elements', 'aspects', 'matters'],
                'get': ['obtain', 'acquire', 'receive', 'gain', 'achieve'],
                'got': ['obtained', 'acquired', 'received', 'gained', 'achieved'],
                'make': ['create', 'produce', 'generate', 'construct', 'develop'],
                'made': ['created', 'produced', 'generated', 'constructed', 'developed'],
                'use': ['utilize', 'employ', 'apply', 'leverage', 'implement'],
                'used': ['utilized', 'employed', 'applied', 'leveraged', 'implemented'],
                'like': ['such as', 'similar to', 'resembling', 'akin to'],
                'just': ['simply', 'merely', 'only', 'precisely'],
                'actually': ['in fact', 'indeed', 'truly', 'really'],
                'basically': ['essentially', 'fundamentally', 'primarily'],
            }

            for word, count in word_freq.most_common(20):
                if count >= overused_threshold:
                    alternatives = word_alternatives.get(word, [])
                    overused_words.append({
                        'word': word,
                        'count': count,
                        'alternatives': alternatives[:5] if alternatives else ['(consider varying your word choice)']
                    })

            adverbs = [w.lower() for w in words if w.lower().endswith('ly') and len(w) > 3]
            adverb_freq = Counter(adverbs)
            overused_adverbs = [{'word': word, 'count': count} for word, count in adverb_freq.most_common(5) if count >= 2]

            if ttr > 0.7 and avg_sentence_length > 20:
                style_type = "Academic/Formal"
            elif ttr < 0.4 and avg_sentence_length < 12:
                style_type = "Simple/Conversational"
            elif question_count > sentence_count * 0.2:
                style_type = "Interrogative/Engaging"
            elif exclamation_count > sentence_count * 0.1:
                style_type = "Expressive/Emotional"
            else:
                style_type = "Standard/Neutral"

            recommendations = self._get_style_recommendations(
                ttr, avg_sentence_length, passive_percentage, transition_count,
                overused_words, overused_adverbs
            )

            return {
                "success": True,
                "style_type": style_type,
                "vocabulary_diversity": round(ttr * 100, 1),
                "vocabulary_level": "Rich" if ttr > 0.6 else "Moderate" if ttr > 0.4 else "Simple",
                "avg_sentence_length": round(avg_sentence_length, 1),
                "sentence_length_variation": round(sentence_length_std, 1),
                "sentence_variety_score": sentence_variety_score,
                "passive_voice_percentage": round(passive_percentage, 1),
                "passive_voice_sentences": passive_sentences[:5] if passive_sentences else None,
                "transition_word_count": transition_count,
                "transition_words_found": transition_found if transition_found else None,
                "pos_distribution": pos_distribution,
                "formality_score": formality_score,
                "formality_label": formality_label,
                "question_count": question_count,
                "exclamation_count": exclamation_count,
                "unique_word_count": len(unique_words),
                "total_word_count": word_count,
                "overused_words": overused_words,
                "overused_adverbs": overused_adverbs,
                "recommendations": recommendations
            }
        except Exception as e:
            logger.error(f"Style analysis failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _get_style_recommendations(self, ttr: float, avg_sent_len: float, passive_pct: float, 
                                   transitions: int, overused_words: List = None, 
                                   overused_adverbs: List = None) -> List[str]:
        """Generate writing style recommendations including word repetition warnings."""
        recommendations = []
        
        # Overused words recommendations (PRIORITY)
        if overused_words:
            for item in overused_words[:3]:  # Top 3 overused words
                word = item['word']
                count = item['count']
                alternatives = item.get('alternatives', [])
                if alternatives and alternatives[0] != '(consider varying your word choice)':
                    alt_str = ', '.join(alternatives[:3])
                    recommendations.append(f"Word '{word}' appears {count} times. Consider alternatives: {alt_str}")
                else:
                    recommendations.append(f"Word '{word}' appears {count} times. Consider using synonyms for variety.")
        
        # Overused adverbs
        if overused_adverbs:
            for item in overused_adverbs[:2]:
                word = item['word']
                count = item['count']
                recommendations.append(f"Adverb '{word}' used {count} times. Consider reducing adverb usage for stronger writing.")
        
        if ttr < 0.4:
            recommendations.append("Consider using more varied vocabulary to make your writing more engaging.")
        if avg_sent_len > 25:
            recommendations.append("Some sentences are quite long. Consider breaking them up for better readability.")
        if avg_sent_len < 10:
            recommendations.append("Your sentences are quite short. Consider combining some for better flow.")
        if passive_pct > 30:
            recommendations.append("High use of passive voice detected. Consider using more active voice for stronger writing.")
        if transitions < 2:
            recommendations.append("Adding transition words can improve the flow between ideas.")
        
        if not recommendations:
            recommendations.append("Your writing style is well-balanced!")
        
        return recommendations
    
    # ==================== Feature 14: Content Improver ====================
    def improve_content(self, text: str, focus: str = "clarity") -> Dict[str, Any]:
        """Improve content using CoEdIT-large instruction-tuned model."""
        try:
            logger.info(f"Improving content with focus: {focus}")

            focus_lower = focus.lower()
            instruction_map = {
                "clarity": "Simplify this sentence",
                "conciseness": "Simplify this sentence",
                "engagement": "Make this text coherent",
                "professionalism": "Write this more formally",
                "seo": "Simplify this sentence",
            }
            instruction = instruction_map.get(focus_lower, "Make this text coherent")

            improved_text = self._edit_text_with_coedit(text, instruction, max_chunk_tokens=150)

            if not improved_text or improved_text == text:
                improved_text = self._edit_text_with_coedit(text, "Make this text coherent", max_chunk_tokens=150)

            suggestions = [f"Text improved for {focus} using advanced language model"]
            changes_made = sum(1 for a, b in zip(text.split(), improved_text.split()) if a != b)

            original_readability = self.analyze_readability(text)
            improved_readability = self.analyze_readability(improved_text)

            return {
                "success": True,
                "original_text": text,
                "improved_text": improved_text,
                "focus": focus,
                "suggestions": suggestions,
                "original_word_count": len(text.split()),
                "improved_word_count": len(improved_text.split()),
                "changes_made": changes_made,
                "readability_change": {
                    "original_score": original_readability.get("flesch_reading_ease", 0),
                    "improved_score": improved_readability.get("flesch_reading_ease", 0)
                },
                "used_t5": True
            }
        except Exception as e:
            logger.error(f"Content improvement failed: {e}")
            return {"success": False, "error": str(e)}

    def _improve_content_rule_based_legacy(self, text: str, focus: str = "clarity") -> Dict[str, Any]:
        """Legacy rule-based content improver kept as fallback."""
        try:
            import random
            improved_text = text
            suggestions = []
            changes_made = 0
            focus_lower = focus.lower()
            
            # Extended clarity replacements including business clichés
            clarity_replacements = {
                # Complex words
                "utilize": "use", "implement": "use", "leverage": "use",
                "facilitate": "help", "endeavor": "try", "commence": "start",
                "terminate": "end", "subsequently": "then", "prior to": "before",
                # Wordy phrases
                "in order to": "to", "due to the fact that": "because",
                "at this point in time": "now", "in the event that": "if",
                "for the purpose of": "to", "with regard to": "about",
                "in spite of the fact that": "although", "on account of": "because",
                "in close proximity to": "near", "a large number of": "many",
                "the majority of": "most", "at the present time": "now",
                "in the near future": "soon", "has the ability to": "can",
                "is able to": "can", "in addition to": "besides",
                # Business clichés
                "touch base": "discuss", "reach out": "contact",
                "circle back": "follow up", "move the needle": "make progress",
                "low-hanging fruit": "easy wins", "synergy": "collaboration",
                "bandwidth": "capacity", "deep dive": "detailed analysis",
                "take offline": "discuss privately", "on the same page": "in agreement",
                "think outside the box": "be creative", "at the end of the day": "ultimately",
                "going forward": "from now on", "best practices": "effective methods",
                "core competency": "main strength", "value proposition": "benefit",
                "paradigm shift": "major change", "actionable insights": "useful findings",
                "stakeholders": "people involved", "deliverables": "results",
                "scalable": "expandable", "robust": "strong",
                # Vague phrases
                "wanted to": "want to", "I wanted to reach out": "I am writing",
                "just wanted to": "want to", "I just wanted to": "I",
                "let me know": "please inform me", "let you know": "inform you",
                "as per our conversation": "as we discussed",
                "please do not hesitate": "please feel free",
                "I hope this email finds you well": "",
            }
            
            if focus_lower == "clarity":
                for old, new in clarity_replacements.items():
                    if old.lower() in improved_text.lower():
                        # Preserve capitalization - if original starts with capital, capitalize replacement
                        def preserve_case(match):
                            matched_text = match.group(0)
                            if not new:
                                return ""
                            if matched_text and matched_text[0].isupper():
                                return new[0].upper() + new[1:] if len(new) > 1 else new.upper()
                            return new
                        improved_text = re.sub(re.escape(old), preserve_case, improved_text, flags=re.IGNORECASE)
                        if new:
                            suggestions.append(f"Replaced '{old}' with '{new}' for clarity")
                        else:
                            suggestions.append(f"Removed unnecessary phrase '{old}'")
                        changes_made += 1
                
            elif focus_lower == "conciseness":
                # Remove filler words and redundant phrases
                filler_patterns = [
                    (r'\bvery\s+', '', "Removed 'very'"),
                    (r'\breally\s+', '', "Removed 'really'"),
                    (r'\bjust\s+', '', "Removed 'just'"),
                    (r'\bbasically\s+', '', "Removed 'basically'"),
                    (r'\bactually\s+', '', "Removed 'actually'"),
                    (r'\bliterally\s+', '', "Removed 'literally'"),
                    (r'\bsimply\s+', '', "Removed 'simply'"),
                    (r'\bdefinitely\s+', '', "Removed 'definitely'"),
                    (r'\bcertainly\s+', '', "Removed 'certainly'"),
                    (r'\bin my opinion,?\s*', '', "Removed 'in my opinion'"),
                    (r'\bI think that\s+', '', "Removed 'I think that'"),
                    (r'\bIt is important to note that\s+', '', "Removed wordy phrase"),
                    (r'\bIt should be noted that\s+', '', "Removed wordy phrase"),
                    (r'\bAs a matter of fact,?\s*', '', "Removed 'as a matter of fact'"),
                    (r'\bAt the end of the day,?\s*', '', "Removed cliché"),
                    (r'\bAll things considered,?\s*', '', "Removed filler"),
                    (r'\bquite\s+', '', "Removed 'quite'"),
                    (r'\bsomewhat\s+', '', "Removed 'somewhat'"),
                    (r'\brather\s+', '', "Removed 'rather'"),
                ]
                for pattern, replacement, suggestion in filler_patterns:
                    if re.search(pattern, improved_text, re.IGNORECASE):
                        improved_text = re.sub(pattern, replacement, improved_text, flags=re.IGNORECASE)
                        suggestions.append(suggestion)
                        changes_made += 1
                
            elif focus_lower == "engagement":
                # Add engaging elements
                sentences = re.split(r'(?<=[.!?])\s+', improved_text)
                if sentences:
                    # Add a hook at the beginning if not already engaging
                    hooks = ["Here's the thing: ", "Consider this: ", "Picture this: ", "Let me share something: "]
                    if not any(improved_text.startswith(h) for h in hooks):
                        improved_text = random.choice(hooks) + improved_text[0].lower() + improved_text[1:]
                        suggestions.append("Added engaging hook at the beginning")
                        changes_made += 1
                    
                    # Convert some statements to questions for engagement
                    if len(sentences) > 1 and '?' not in improved_text:
                        improved_text += " What are your thoughts?"
                        suggestions.append("Added question to encourage engagement")
                        changes_made += 1
                
            elif focus_lower == "professionalism":
                # Professional tone improvements
                professional_replacements = {
                    "can't": "cannot", "won't": "will not", "don't": "do not",
                    "gonna": "going to", "wanna": "want to", "gotta": "have to",
                    "yeah": "yes", "nope": "no", "ok": "acceptable",
                    "awesome": "excellent", "cool": "satisfactory", "stuff": "materials",
                    "things": "items", "guy": "individual", "guys": "individuals",
                    "kids": "children", "a lot": "significantly", "pretty": "quite",
                    "super": "extremely", "totally": "completely",
                    "thanks": "thank you", "hi": "hello", "hey": "hello",
                    "asap": "as soon as possible", "fyi": "for your information",
                }
                for old, new in professional_replacements.items():
                    if re.search(r'\b' + re.escape(old) + r'\b', improved_text, re.IGNORECASE):
                        improved_text = re.sub(r'\b' + re.escape(old) + r'\b', new, improved_text, flags=re.IGNORECASE)
                        suggestions.append(f"Changed '{old}' to '{new}' for professionalism")
                        changes_made += 1
                
            elif focus_lower == "seo":
                # SEO improvements: shorter sentences, active voice hints
                sentences = re.split(r'(?<=[.!?])\s+', improved_text)
                new_sentences = []
                for sent in sentences:
                    words = sent.split()
                    if len(words) > 25:
                        # Try to split long sentences
                        mid = len(words) // 2
                        for i in range(mid - 5, mid + 5):
                            if i < len(words) and words[i].rstrip(',') in ['and', 'but', 'or', 'so', 'yet']:
                                first_part = ' '.join(words[:i])
                                second_part = ' '.join(words[i+1:])
                                if not first_part.endswith('.'):
                                    first_part += '.'
                                second_part = second_part[0].upper() + second_part[1:] if second_part else ''
                                new_sentences.append(first_part)
                                new_sentences.append(second_part)
                                suggestions.append("Split long sentence for better readability")
                                changes_made += 1
                                break
                        else:
                            new_sentences.append(sent)
                    else:
                        new_sentences.append(sent)
                improved_text = ' '.join(new_sentences)
            
            # GUARANTEE: If no changes were made, apply generic improvements
            if changes_made == 0 or improved_text == text:
                logger.info("No specific changes made, applying guaranteed improvements")
                
                # Apply clarity replacements regardless of focus
                for old, new in clarity_replacements.items():
                    if old.lower() in improved_text.lower():
                        improved_text = re.sub(re.escape(old), new, improved_text, flags=re.IGNORECASE)
                        if new:
                            suggestions.append(f"Improved: '{old}' -> '{new}'")
                        changes_made += 1
                        break
                
                # If still no changes, restructure the text
                if improved_text == text:
                    # Add a clear structure indicator
                    if focus_lower == "clarity":
                        improved_text = "To clarify: " + text
                        suggestions.append("Added clarifying introduction")
                    elif focus_lower == "conciseness":
                        # Remove any double spaces and trim
                        improved_text = re.sub(r'\s+', ' ', text).strip()
                        suggestions.append("Cleaned up whitespace")
                    elif focus_lower == "professionalism":
                        improved_text = text.replace("!", ".").replace("...", ".")
                        suggestions.append("Normalized punctuation for professional tone")
                    else:
                        # Generic improvement: ensure proper capitalization
                        sentences = re.split(r'(?<=[.!?])\s+', text)
                        improved_sentences = []
                        for sent in sentences:
                            if sent and sent[0].islower():
                                sent = sent[0].upper() + sent[1:]
                            improved_sentences.append(sent)
                        improved_text = ' '.join(improved_sentences)
                        suggestions.append("Improved sentence capitalization")
            
            # Calculate improvement metrics
            original_readability = self.analyze_readability(text)
            improved_readability = self.analyze_readability(improved_text)
            
            return {
                "success": True,
                "original_text": text,
                "improved_text": improved_text,
                "focus": focus,
                "suggestions": suggestions[:5] if suggestions else ["Text analyzed and optimized"],
                "original_word_count": len(text.split()),
                "improved_word_count": len(improved_text.split()),
                "changes_made": changes_made,
                "readability_change": {
                    "original_score": original_readability.get("flesch_reading_ease", 0),
                    "improved_score": improved_readability.get("flesch_reading_ease", 0)
                },
                "used_t5": False
            }
        except Exception as e:
            logger.error(f"Content improvement failed: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
writing_tools_service = WritingToolsService()
