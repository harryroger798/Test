import os
import gc
import re
import json
import hashlib
import torch
import torch.nn as nn
import logging
import random
import httpx
import asyncio
import boto3
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from transformers import AutoTokenizer, AutoModelForSequenceClassification, T5Tokenizer, T5ForConditionalGeneration
from sentence_transformers import SentenceTransformer
import numpy as np
from collections import Counter
from app.core.config import settings

logger = logging.getLogger(__name__)


class ABTestingIntegration:
    """
    A/B Testing integration for ML model serving.
    Part of Phase 3: Self-Learning ML System.
    
    This class handles:
    - Determining which model version to serve to each user
    - Recording model version used for each scan
    - Supporting gradual rollout of new models
    """
    
    # Cache for user assignments to avoid repeated DB lookups
    _assignment_cache: Dict[int, Dict[str, str]] = {}
    _cache_ttl = 300  # 5 minutes
    _cache_timestamps: Dict[str, datetime] = {}
    
    @classmethod
    def get_model_version_for_user(
        cls,
        user_id: int,
        model_type: str,
        db_session = None
    ) -> Dict[str, Any]:
        """
        Determine which model version to use for a given user.
        
        Args:
            user_id: The user's ID
            model_type: 'detector', 'humanizer', or 'plagiarism'
            db_session: Optional database session for A/B test lookups
            
        Returns:
            Dict with 'version_name', 'is_test_group', 'adapter_path' (if applicable)
        """
        # Check cache first
        cache_key = f"{user_id}_{model_type}"
        if cache_key in cls._assignment_cache:
            cached_time = cls._cache_timestamps.get(cache_key)
            if cached_time and (datetime.utcnow() - cached_time).seconds < cls._cache_ttl:
                return cls._assignment_cache[cache_key]
        
        # Default to production model
        result = {
            'version_name': f'{model_type}_v1.0',
            'is_test_group': False,
            'adapter_path': None,
            'model_type': model_type
        }
        
        # If we have a DB session, check for active A/B tests
        if db_session:
            try:
                from app.services.ab_testing_service import ABTestingService
                ab_service = ABTestingService(db_session)
                
                # Get user's assignment for this model type
                assignment = ab_service.get_user_assignment(user_id, model_type)
                
                if assignment:
                    result = {
                        'version_name': assignment.get('version_name', result['version_name']),
                        'is_test_group': assignment.get('is_test_group', False),
                        'adapter_path': assignment.get('adapter_path'),
                        'model_type': model_type,
                        'ab_test_id': assignment.get('ab_test_id')
                    }
            except Exception as e:
                logger.warning(f"A/B testing lookup failed, using default: {e}")
        
        # Cache the result
        cls._assignment_cache[cache_key] = result
        cls._cache_timestamps[cache_key] = datetime.utcnow()
        
        return result
    
    @classmethod
    def record_model_usage(
        cls,
        user_id: int,
        model_type: str,
        version_name: str,
        scan_id: int,
        db_session = None
    ):
        """
        Record that a specific model version was used for a scan.
        This data is used for A/B test analysis.
        """
        if db_session:
            try:
                from app.services.ab_testing_service import ABTestingService
                ab_service = ABTestingService(db_session)
                ab_service.record_scan_with_version(
                    user_id=user_id,
                    model_type=model_type,
                    version_name=version_name,
                    scan_id=scan_id
                )
            except Exception as e:
                logger.warning(f"Failed to record model usage: {e}")
    
    @classmethod
    def clear_cache(cls, user_id: Optional[int] = None):
        """Clear the assignment cache, optionally for a specific user."""
        if user_id:
            keys_to_remove = [k for k in cls._assignment_cache if k.startswith(f"{user_id}_")]
            for key in keys_to_remove:
                cls._assignment_cache.pop(key, None)
                cls._cache_timestamps.pop(key, None)
        else:
            cls._assignment_cache.clear()
            cls._cache_timestamps.clear()


class IDriveCacheService:
    """Service for caching plagiarism search results on iDrive e2."""
    
    _instance = None
    _s3_client = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def _get_s3_client(self):
        """Get or create S3 client for iDrive e2."""
        if self._s3_client is None:
            try:
                self._s3_client = boto3.client(
                    's3',
                    endpoint_url=getattr(settings, 'S3_ENDPOINT', 'https://s3.us-west-1.idrivee2.com'),
                    aws_access_key_id=getattr(settings, 'S3_ACCESS_KEY', ''),
                    aws_secret_access_key=getattr(settings, 'S3_SECRET_KEY', '')
                )
            except Exception as e:
                logger.warning(f"Failed to create S3 client: {e}")
        return self._s3_client
    
    def _get_cache_key(self, text: str) -> str:
        """Generate a cache key from text hash."""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        return f"plagiarism-cache/{text_hash}.json"
    
    def get_cached_results(self, text: str) -> Optional[Dict[str, Any]]:
        """Get cached plagiarism results from iDrive e2."""
        try:
            s3 = self._get_s3_client()
            if not s3:
                return None
            
            bucket = getattr(settings, 'S3_BUCKET', 'crop-spray-uploads')
            cache_key = self._get_cache_key(text)
            
            response = s3.get_object(Bucket=bucket, Key=cache_key)
            cached_data = json.loads(response['Body'].read().decode('utf-8'))
            
            cached_time = datetime.fromisoformat(cached_data.get('cached_at', '2000-01-01'))
            if datetime.utcnow() - cached_time > timedelta(days=7):
                return None
            
            logger.info(f"Cache hit for plagiarism check")
            return cached_data.get('results')
        except Exception as e:
            logger.debug(f"Cache miss or error: {e}")
            return None
    
    def cache_results(self, text: str, results: Dict[str, Any]) -> bool:
        """Cache plagiarism results to iDrive e2."""
        try:
            s3 = self._get_s3_client()
            if not s3:
                return False
            
            bucket = getattr(settings, 'S3_BUCKET', 'crop-spray-uploads')
            cache_key = self._get_cache_key(text)
            
            cache_data = {
                'cached_at': datetime.utcnow().isoformat(),
                'text_preview': text[:100],
                'results': results
            }
            
            s3.put_object(
                Bucket=bucket,
                Key=cache_key,
                Body=json.dumps(cache_data),
                ContentType='application/json'
            )
            logger.info(f"Cached plagiarism results to iDrive e2")
            return True
        except Exception as e:
            logger.warning(f"Failed to cache results: {e}")
            return False


idrive_cache = IDriveCacheService()


# Stop words for Jaccard similarity calculation
STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
    'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then'
}


class WebSearchService:
    """Service for searching the web using DuckDuckGo + Serper.dev fallback for plagiarism detection."""
    
    DUCKDUCKGO_URL = "https://html.duckduckgo.com/html/"
    SERPER_URL = "https://google.serper.dev/search"
    
    @staticmethod
    def _extract_key_sentences(text: str, max_queries: int = 5) -> List[str]:
        """Extract 5 most distinctive sentences (8-25 words each) for searching."""
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        valid_sentences = []
        for sentence in sentences:
            words = sentence.split()
            word_count = len(words)
            if 8 <= word_count <= 25:
                valid_sentences.append(sentence)
        
        if len(valid_sentences) < max_queries:
            for sentence in sentences:
                words = sentence.split()
                if len(words) >= 5 and sentence not in valid_sentences:
                    valid_sentences.append(sentence)
                if len(valid_sentences) >= max_queries:
                    break
        
        return valid_sentences[:max_queries]
    
    @staticmethod
    def _calculate_jaccard_similarity(text1: str, text2: str) -> float:
        """Calculate Jaccard similarity between two texts (matching user's algorithm)."""
        words1 = set(text1.lower().split()) - STOP_WORDS
        words2 = set(text2.lower().split()) - STOP_WORDS
        intersection = words1 & words2
        union = words1 | words2
        return len(intersection) / len(union) if union else 0.0
    
    @staticmethod
    async def search_duckduckgo(query: str, timeout: float = 10.0) -> List[Dict[str, str]]:
        """Search DuckDuckGo and return results."""
        results = []
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.post(
                    WebSearchService.DUCKDUCKGO_URL,
                    data={"q": f'"{query}"', "b": ""},
                    headers=headers
                )
                if response.status_code == 200:
                    html = response.text
                    result_pattern = r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)</a>'
                    snippet_pattern = r'<a[^>]*class="result__snippet"[^>]*>([^<]*)</a>'
                    
                    urls = re.findall(result_pattern, html)
                    snippets = re.findall(snippet_pattern, html)
                    
                    for i, (url, title) in enumerate(urls[:5]):
                        snippet = snippets[i] if i < len(snippets) else ""
                        snippet = re.sub(r'<[^>]+>', '', snippet)
                        results.append({
                            "url": url,
                            "title": title.strip(),
                            "snippet": snippet.strip(),
                            "source": "duckduckgo"
                        })
        except Exception as e:
            logger.warning(f"DuckDuckGo search failed: {e}")
        
        return results
    
    @staticmethod
    async def search_serper(query: str, timeout: float = 10.0) -> List[Dict[str, str]]:
        """Search using Serper.dev API as fallback (2,500 free queries/month)."""
        results = []
        try:
            serper_api_key = getattr(settings, 'SERPER_API_KEY', None)
            if not serper_api_key:
                return results
            
            headers = {
                "X-API-KEY": serper_api_key,
                "Content-Type": "application/json"
            }
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    WebSearchService.SERPER_URL,
                    json={"q": f'"{query}"', "num": 5},
                    headers=headers
                )
                if response.status_code == 200:
                    data = response.json()
                    organic = data.get("organic", [])
                    for item in organic[:5]:
                        results.append({
                            "url": item.get("link", ""),
                            "title": item.get("title", ""),
                            "snippet": item.get("snippet", ""),
                            "source": "serper"
                        })
        except Exception as e:
            logger.warning(f"Serper search failed: {e}")
        
        return results
    
    @staticmethod
    async def fetch_page_content(url: str, timeout: float = 10.0) -> str:
        """Fetch and extract text content from a URL."""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    html = response.text
                    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
                    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text)
                    return text.strip()[:5000]
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
        return ""
    
    @staticmethod
    async def search_for_plagiarism(text: str) -> List[Dict[str, Any]]:
        """Search the web for potential plagiarism sources using DuckDuckGo + Serper fallback."""
        sentences = WebSearchService._extract_key_sentences(text)
        all_results = []
        seen_urls = set()
        
        for sentence in sentences:
            results = await WebSearchService.search_duckduckgo(sentence)
            
            if len(results) < 2:
                serper_results = await WebSearchService.search_serper(sentence)
                results.extend(serper_results)
            
            for result in results:
                url = result.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    snippet = result.get("snippet", "")
                    jaccard_score = WebSearchService._calculate_jaccard_similarity(sentence, snippet)
                    result["jaccard_similarity"] = round(jaccard_score * 100, 2)
                    result["matched_sentence"] = sentence
                    all_results.append(result)
        
        all_results.sort(key=lambda x: x.get("jaccard_similarity", 0), reverse=True)
        return all_results[:10]


web_search_service = WebSearchService()

logger = logging.getLogger(__name__)


# StealthWriter Post-Processor Constants
CONTRACTION_EXPANSIONS = {
    "it's": "it is", "don't": "do not", "can't": "cannot", "won't": "will not",
    "wouldn't": "would not", "couldn't": "could not", "shouldn't": "should not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "hasn't": "has not", "haven't": "have not", "hadn't": "had not",
    "doesn't": "does not", "didn't": "did not", "I'm": "I am", "I've": "I have",
    "I'll": "I will", "I'd": "I would", "you're": "you are", "you've": "you have",
    "you'll": "you will", "you'd": "you would", "he's": "he is", "she's": "she is",
    "we're": "we are", "we've": "we have", "we'll": "we will",
    "they're": "they are", "they've": "they have", "they'll": "they will",
    "that's": "that is", "there's": "there is", "here's": "here is",
    "what's": "what is", "who's": "who is", "let's": "let us",
}

FORMAL_STARTERS = [
    "It is almost a given that ", "One must acknowledge that ",
    "In point of fact, ", "As a matter of fact, ",
    "It bears mentioning that ", "It is worth noting that ",
    "From a practical standpoint, ", "Upon closer examination, ",
]

SYNONYM_REPLACEMENTS = {
    "help": "assist", "use": "utilize", "get": "obtain", "think": "believe",
    "very": "quite", "big": "substantial", "small": "modest", "good": "favorable",
    "bad": "unfavorable", "important": "significant", "show": "demonstrate",
    "make": "create", "need": "require", "want": "desire", "start": "commence",
    "end": "conclude", "give": "provide", "take": "acquire", "find": "discover",
    "tell": "inform", "ask": "inquire", "try": "attempt", "keep": "maintain",
    "let": "permit", "seem": "appear", "feel": "sense", "become": "evolve into",
    "leave": "depart", "put": "place", "mean": "signify", "old": "aged",
    "new": "recent", "last": "final", "long": "extended", "great": "remarkable",
    "little": "minimal", "own": "possess", "other": "alternative", "right": "correct",
    "high": "elevated", "different": "distinct", "whole": "entire",
    "large": "considerable", "next": "subsequent", "early": "initial",
    "young": "youthful", "hard": "difficult", "major": "principal",
    "better": "superior", "best": "optimal",
}

FILLERS_TO_REMOVE = [
    "like, ", "you know, ", "basically, ", "honestly, ", "I mean, ",
    "just ", "really ", "actually ", "literally ", "obviously ",
    "clearly ", "simply ", "definitely ", "certainly ", "absolutely ",
    "totally ", "completely ", "pretty much ", "kind of ", "sort of ",
]

# Meta-commentary patterns to remove from model output
META_COMMENTARY_PATTERNS = [
    r"^(okay|ok|alright|sure|well|so),?\s*(here\s+is|here's|let\s+me|i('ll|'m\s+going\s+to|am\s+going\s+to)|this\s+is)\s+.*?(rewrite|rewritten|version|text|paraphrase).*?[.!:]\s*",
    r"^(as\s+a\s+matter\s+of\s+fact,?\s*)?(okay|ok)?,?\s*(here\s+is|here's).*?(rewrite|version|text).*?[.!:]\s*",
    r"^i('m|\s+am)\s+(going\s+to|gonna)\s+.*?(rewrite|paraphrase|humanize).*?[.!:]\s*",
    r"^(let\s+me|allow\s+me\s+to)\s+.*?(rewrite|paraphrase|humanize).*?[.!:]\s*",
    r"^(here\s+is|here's)\s+(a\s+)?(more\s+)?(conversational|human|natural|casual).*?(version|rewrite|text).*?[.!:]\s*",
    r"^trying\s+to\s+(make|create)\s+it\s+sound.*?[.!:]\s*",
    r"^(this\s+is\s+)?(a\s+)?(more\s+)?(conversational|human-like|natural).*?(rewrite|version).*?[.!:]\s*",
    r"(makes?\s+sense,?\s*(though|right)?,?\s*(does\s+)?(not\s+)?(it|n't\s+it)[.?!]?\s*$)",
    r"(you\s+know[.?!]?\s*$)",
    r"(right[.?!]?\s*$)",
    r"(does\s+not\s+it[.?!]?\s*$)",
]


class PlagiarismClassifier(nn.Module):
    """Neural network classifier for plagiarism detection."""
    
    def __init__(self, embedding_dim: int = 384):
        super().__init__()
        input_dim = embedding_dim * 4
        self.classifier = nn.Sequential(
            nn.Linear(input_dim, 512), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(512, 256), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(256, 64), nn.ReLU(), nn.Linear(64, 1), nn.Sigmoid()
        )
    
    def forward(self, emb1: torch.Tensor, emb2: torch.Tensor) -> torch.Tensor:
        diff = emb1 - emb2
        product = emb1 * emb2
        combined = torch.cat([emb1, emb2, diff, product], dim=1)
        return self.classifier(combined)


class MLModelService:
    """Singleton service for ML models with lazy loading. Uses trained models from iDrive e2.
    
    AI Detection: Uses TriBoost V4 ensemble (XGBoost + LightGBM + CatBoost) with 565 features
                  for 99.18% accuracy. Falls back to RoBERTa if TriBoost unavailable.
    
    Humanization: Uses Final Humanizer with ESL-style patterns, personal anecdotes,
                  and question-based openings for 0.8% average AI detection rate.
    
    Plagiarism: Uses Sentence-BERT + Neural Network Classifier with web search.
    """
    
    _instance = None
    _current_model: Optional[str] = None
    _detector_model = None
    _detector_tokenizer = None
    _humanizer_model = None
    _humanizer_tokenizer = None
    _plagiarism_encoder = None
    _plagiarism_classifier = None
    _triboost_predictor = None
    _final_humanizer = None
    _stealthwriter_postprocessor = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def _unload_all_models(self):
        logger.info("Unloading all models...")
        self._detector_model = None
        self._detector_tokenizer = None
        self._humanizer_model = None
        self._humanizer_tokenizer = None
        self._plagiarism_encoder = None
        self._plagiarism_classifier = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self._current_model = None
        logger.info("All models unloaded")
    
    def _load_detector(self):
        if self._current_model != "detector":
            self._unload_all_models()
            logger.info("Loading AI detector model (RoBERTa)...")
            model_path = settings.DETECTOR_MODEL_PATH
            if os.path.exists(os.path.join(model_path, "model.safetensors")):
                self._detector_tokenizer = AutoTokenizer.from_pretrained(model_path)
                self._detector_model = AutoModelForSequenceClassification.from_pretrained(model_path, torch_dtype=torch.float32)
                self._detector_model.eval()
                logger.info(f"Loaded trained RoBERTa model from {model_path}")
            else:
                logger.warning(f"Local model not found at {model_path}, using fallback")
                self._detector_tokenizer = AutoTokenizer.from_pretrained("roberta-base")
                self._detector_model = AutoModelForSequenceClassification.from_pretrained("roberta-base", num_labels=2)
            self._current_model = "detector"
    
    def _load_humanizer(self):
        if self._current_model != "humanizer":
            self._unload_all_models()
            logger.info("Loading humanizer model (T5 V3)...")
            model_path = settings.HUMANIZER_MODEL_PATH
            if os.path.exists(os.path.join(model_path, "model.safetensors")):
                self._humanizer_tokenizer = T5Tokenizer.from_pretrained(model_path)
                self._humanizer_model = T5ForConditionalGeneration.from_pretrained(model_path, torch_dtype=torch.float32)
                self._humanizer_model.eval()
                logger.info(f"Loaded trained T5 V3 model from {model_path}")
            else:
                logger.warning(f"Local model not found at {model_path}, using base T5")
                self._humanizer_tokenizer = T5Tokenizer.from_pretrained("t5-base")
                self._humanizer_model = T5ForConditionalGeneration.from_pretrained("t5-base")
            self._current_model = "humanizer"
    
    def _load_plagiarism(self):
        if self._current_model != "plagiarism":
            self._unload_all_models()
            logger.info("Loading plagiarism model...")
            model_path = settings.PLAGIARISM_MODEL_PATH
            self._plagiarism_encoder = SentenceTransformer('all-MiniLM-L6-v2')
            classifier_path = os.path.join(model_path, "plagiarism_classifier.pt")
            if os.path.exists(classifier_path):
                self._plagiarism_classifier = PlagiarismClassifier(embedding_dim=384)
                state_dict = torch.load(classifier_path, map_location='cpu')
                self._plagiarism_classifier.load_state_dict(state_dict)
                self._plagiarism_classifier.eval()
                logger.info(f"Loaded trained plagiarism classifier")
            else:
                self._plagiarism_classifier = None
            self._current_model = "plagiarism"
    
    def _split_sentences(self, text: str) -> List[str]:
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _calculate_confidence_score(self, ai_prob: float) -> int:
        if ai_prob >= 0.95:
            return 10
        elif ai_prob >= 0.85:
            return 9
        elif ai_prob >= 0.75:
            return 8
        elif ai_prob >= 0.65:
            return 7
        elif ai_prob >= 0.55:
            return 6
        elif ai_prob >= 0.45:
            return 5
        elif ai_prob >= 0.35:
            return 4
        elif ai_prob >= 0.25:
            return 3
        elif ai_prob >= 0.15:
            return 2
        else:
            return 1
    
    def _get_confidence_level(self, score: int) -> str:
        if score >= 9:
            return "very_high"
        elif score >= 7:
            return "high"
        elif score >= 5:
            return "medium"
        elif score >= 3:
            return "low"
        else:
            return "very_low"
    
    def _avg_sentence_length(self, text: str) -> float:
        sentences = self._split_sentences(text)
        if not sentences:
            return 0
        return sum(len(s.split()) for s in sentences) / len(sentences)
    
    def _analyze_sentences(self, text: str) -> List[Dict[str, Any]]:
        sentences = [s for s in self._split_sentences(text) if len(s) > 10]
        results = []
        for sentence in sentences[:10]:
            inputs = self._detector_tokenizer(sentence, return_tensors="pt", truncation=True, max_length=512, padding=True)
            with torch.no_grad():
                outputs = self._detector_model(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1)
            results.append({
                "text": sentence[:100] + "..." if len(sentence) > 100 else sentence,
                "ai_probability": round(probs[0][1].item() * 100, 2)
            })
        return results
    
    def _perform_10_level_analysis(self, text: str, ai_prob: float) -> Dict[str, Any]:
        words = text.split()
        sentences = self._split_sentences(text)
        word_freq = Counter(w.lower() for w in words)
        
        formal_markers = sum(1 for w in words if w.lower() in ['therefore', 'however', 'furthermore', 'moreover', 'consequently', 'nevertheless'])
        casual_markers = sum(1 for w in words if w.lower() in ['like', 'just', 'really', 'actually', 'basically', 'literally'])
        statistical_score = min(1.0, formal_markers / max(1, len(words) / 50)) if formal_markers > casual_markers else 0.3
        
        passive_count = len(re.findall(r'\b(is|are|was|were|been|being)\s+\w+ed\b', text, re.IGNORECASE))
        syntactic_score = min(1.0, (passive_count / max(1, len(sentences))) * 2)
        
        unique_ratio = len(word_freq) / max(1, len(words))
        entropy_score = 1.0 - unique_ratio
        
        ttr = len(set(w.lower() for w in words)) / max(1, len(words))
        hapax = sum(1 for w, c in word_freq.items() if c == 1)
        hapax_ratio = hapax / max(1, len(word_freq))
        lexical_score = 1.0 - (ttr * 0.5 + hapax_ratio * 0.5)
        
        entities = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        entity_score = 1.0 - min(1.0, len(entities) / max(1, len(words) / 10))
        
        temporal_words = ['yesterday', 'today', 'tomorrow', 'last week', 'next month', 'recently', 'currently']
        temporal_count = sum(1 for t in temporal_words if t.lower() in text.lower())
        temporal_score = 1.0 - min(1.0, temporal_count / 3)
        
        weights = {"statistical": 0.20, "syntactic": 0.15, "entropy": 0.20, "lexical": 0.15, "entities": 0.15, "temporal": 0.15}
        combined_score = sum([
            statistical_score * weights["statistical"],
            syntactic_score * weights["syntactic"],
            entropy_score * weights["entropy"],
            lexical_score * weights["lexical"],
            entity_score * weights["entities"],
            temporal_score * weights["temporal"]
        ])
        
        return {
            "statistical_fingerprinting": {
                "score": round(statistical_score * 100, 2),
                "formal_markers": formal_markers,
                "casual_markers": casual_markers,
                "description": "Formal language patterns vs casual markers"
            },
            "syntactic_patterns": {
                "score": round(syntactic_score * 100, 2),
                "passive_voice_count": passive_count,
                "description": "Sentence structure and passive voice usage"
            },
            "ngram_entropy": {
                "score": round(entropy_score * 100, 2),
                "unique_word_ratio": round(unique_ratio, 3),
                "description": "Vocabulary repetition patterns"
            },
            "lexical_diversity": {
                "score": round(lexical_score * 100, 2),
                "type_token_ratio": round(ttr, 3),
                "hapax_ratio": round(hapax_ratio, 3),
                "description": "Type-token ratio and hapax legomena"
            },
            "named_entities": {
                "score": round(entity_score * 100, 2),
                "entity_count": len(entities),
                "description": "Specific names, dates, numbers"
            },
            "temporal_contextual": {
                "score": round(temporal_score * 100, 2),
                "temporal_references": temporal_count,
                "description": "Generic vs specific time references"
            },
            "combined_score": round(combined_score * 100, 2),
            "weights": weights
        }
    
    def _load_triboost(self):
        """Load TriBoost V4 ensemble predictor."""
        if self._triboost_predictor is not None:
            return True
        
        try:
            from app.services.triboost_predictor import TriBoostPredictor
            self._triboost_predictor = TriBoostPredictor()
            logger.info("TriBoost V4 predictor loaded")
            return True
        except Exception as e:
            logger.warning(f"Failed to load TriBoost predictor: {e}")
            return False
    
    def _load_final_humanizer(self):
        """Load Final Humanizer with ESL patterns."""
        if self._final_humanizer is not None:
            return True
        
        try:
            from app.services.final_humanizer import FinalHumanizer
            self._final_humanizer = FinalHumanizer()
            logger.info("Final Humanizer loaded")
            return True
        except Exception as e:
            logger.warning(f"Failed to load Final Humanizer: {e}")
            return False
    
    def _load_stealthwriter_postprocessor(self):
        """Load Stealthwriter Post-Processor V7 for bypassing Stealthwriter detection."""
        if self._stealthwriter_postprocessor is not None:
            return True
        
        try:
            from app.services.stealthwriter_postprocessor import StealthwriterPostProcessor
            self._stealthwriter_postprocessor = StealthwriterPostProcessor()
            logger.info("Stealthwriter Post-Processor V7 loaded")
            return True
        except Exception as e:
            logger.warning(f"Failed to load Stealthwriter Post-Processor: {e}")
            return False
    
    def detect_ai(self, text: str, use_triboost: bool = True) -> Dict[str, Any]:
        """Detect AI-generated text using TriBoost V4 ensemble or RoBERTa fallback.
        
        Args:
            text: Text to analyze
            use_triboost: If True, use TriBoost V4 (99.18% accuracy). If False, use RoBERTa.
        
        Returns:
            Dict with ai_probability, human_probability, confidence_score, etc.
        """
        # Try TriBoost V4 first (if enabled and available)
        if use_triboost and getattr(settings, 'USE_TRIBOOST_DETECTOR', True):
            if self._load_triboost():
                try:
                    result = self._triboost_predictor.predict(text)
                    if "error" not in result:
                        # Add additional analysis
                        result["analysis"] = {
                            "text_length": len(text),
                            "word_count": len(text.split()),
                            "avg_sentence_length": self._avg_sentence_length(text)
                        }
                        result["level_analysis"] = self._perform_10_level_analysis(
                            text, result["ai_probability"] / 100
                        )
                        result["detector_model"] = "triboost_v4"
                        return result
                except Exception as e:
                    logger.warning(f"TriBoost prediction failed, falling back to RoBERTa: {e}")
        
        # Fallback to RoBERTa
        self._load_detector()
        inputs = self._detector_tokenizer(text, return_tensors="pt", truncation=True, max_length=512, padding=True)
        with torch.no_grad():
            outputs = self._detector_model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1)
        human_prob = probabilities[0][0].item()
        ai_prob = probabilities[0][1].item()
        confidence_score = self._calculate_confidence_score(ai_prob)
        return {
            "ai_probability": round(ai_prob * 100, 2),
            "human_probability": round(human_prob * 100, 2),
            "confidence_score": confidence_score,
            "confidence_level": self._get_confidence_level(confidence_score),
            "analysis": {
                "text_length": len(text),
                "word_count": len(text.split()),
                "avg_sentence_length": self._avg_sentence_length(text)
            },
            "sentence_analysis": self._analyze_sentences(text),
            "level_analysis": self._perform_10_level_analysis(text, ai_prob),
            "detector_model": "roberta"
        }
    
    def _remove_meta_commentary(self, text: str) -> str:
        """Remove meta-commentary from model output like 'okay, here is a rewrite...'"""
        result = text.strip()
        # Apply meta-commentary removal patterns
        for pattern in META_COMMENTARY_PATTERNS:
            result = re.sub(pattern, '', result, flags=re.IGNORECASE)
        # Also remove common conversational fillers at the start
        start_fillers = [
            "okay, ", "ok, ", "alright, ", "sure, ", "well, ", "so, ",
            "as a matter of fact, ", "in point of fact, ",
        ]
        lower_result = result.lower()
        for filler in start_fillers:
            if lower_result.startswith(filler):
                result = result[len(filler):]
                lower_result = result.lower()
        # Capitalize first letter if needed
        if result and result[0].islower():
            result = result[0].upper() + result[1:]
        return result.strip()
    
    def _apply_stealthwriter_postprocessor(self, text: str, passes: int = 2, mode: str = 'casual') -> str:
        result = text
        # First remove meta-commentary
        result = self._remove_meta_commentary(result)
        for _ in range(passes):
            for contraction, expansion in CONTRACTION_EXPANSIONS.items():
                result = re.sub(re.escape(contraction), expansion, result, flags=re.IGNORECASE)
            for filler in FILLERS_TO_REMOVE:
                result = result.replace(filler, "").replace(filler.capitalize(), "")
            words = result.split()
            new_words = []
            for word in words:
                lower_word = word.lower()
                if lower_word in SYNONYM_REPLACEMENTS:
                    replacement = SYNONYM_REPLACEMENTS[lower_word]
                    if word[0].isupper():
                        replacement = replacement.capitalize()
                    new_words.append(replacement)
                else:
                    new_words.append(word)
            result = " ".join(new_words)
            sentences = self._split_sentences(result)
            new_sentences = []
            for i, sentence in enumerate(sentences):
                if i == 0 and len(sentence) > 20 and random.random() < 0.3:
                    starter = random.choice(FORMAL_STARTERS)
                    sentence = starter + sentence[0].lower() + sentence[1:]
                new_sentences.append(sentence)
            result = ". ".join(new_sentences)
            if not result.endswith("."):
                result += "."
        return re.sub(r'\s+', ' ', result).strip()
    
    def _humanize_with_hf_api(self, text: str) -> str:
        """Fallback humanization using HuggingFace Inference API."""
        try:
            hf_token = getattr(settings, 'HUGGINGFACE_API_KEY', '')
            if not hf_token:
                logger.warning("No HuggingFace API key configured for fallback")
                return text
            
            headers = {"Authorization": f"Bearer {hf_token}"}
            # Use Flan-T5 for paraphrasing
            api_url = "https://api-inference.huggingface.co/models/google/flan-t5-base"
            
            response = httpx.post(
                api_url,
                headers=headers,
                json={"inputs": f"Paraphrase the following text to sound more natural and human-written: {text}"},
                timeout=60.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    generated = result[0].get("generated_text", "")
                    if generated and len(generated) > 20:
                        return generated
            elif response.status_code == 503:
                # Model is loading, wait and retry once
                logger.info("HuggingFace model loading, waiting...")
                import time
                time.sleep(20)
                response = httpx.post(
                    api_url,
                    headers=headers,
                    json={"inputs": f"Paraphrase the following text to sound more natural and human-written: {text}"},
                    timeout=60.0
                )
                if response.status_code == 200:
                    result = response.json()
                    if isinstance(result, list) and len(result) > 0:
                        generated = result[0].get("generated_text", "")
                        if generated and len(generated) > 20:
                            return generated
            
            logger.warning(f"HuggingFace API returned status {response.status_code}")
            return text
        except Exception as e:
            logger.warning(f"HuggingFace API fallback failed: {e}")
            return text
    
    def humanize(self, text: str, use_two_stage: bool = True, intensity: str = 'high', mode: str = 'casual') -> Dict[str, Any]:
        """Humanize AI-generated text using two-stage pipeline to bypass BOTH Originality.ai AND Stealthwriter.
        
        Two-Stage Pipeline:
        - Stage 1: Final Humanizer (ESL patterns + anecdotes) - bypasses Originality.ai (<3% AI)
        - Stage 2: Stealthwriter Post-Processor V7 - bypasses Stealthwriter (<10% AI)
        
        Args:
            text: Text to humanize
            use_two_stage: If True, apply both stages. If False, only Stage 1.
            intensity: Post-processor intensity ('low', 'medium', 'high')
            mode: Humanizer mode ('academic', 'professional', 'casual')
        
        Returns:
            Dict with original_text, humanized_text, stages_applied, etc.
        """
        mode_config = {
            'academic': {'temperature': 0.7, 'top_p': 0.9},
            'professional': {'temperature': 0.75, 'top_p': 0.92},
            'casual': {'temperature': 0.85, 'top_p': 0.93},
        }
        config = mode_config.get(mode, mode_config['casual'])
        stages_applied = []
        stage1_output = None
        stage2_output = None
        use_fallback = False
        
        # Stage 1: Final Humanizer (for Originality.ai bypass)
        if self._load_final_humanizer():
            try:
                result = self._final_humanizer.humanize(text, aggressive=True)
                stage1_output = result["humanized_text"]
                stages_applied.append("final_humanizer")
                logger.info(f"Stage 1 (Final Humanizer) applied, topic: {result.get('topic', 'unknown')}")
            except Exception as e:
                logger.warning(f"Stage 1 (Final Humanizer) failed: {e}, using T5 fallback")
                stage1_output = None
        
        # Fallback to T5 model if Final Humanizer fails
        if stage1_output is None:
            try:
                self._load_humanizer()
                input_text = f"humanize: {text}"
                inputs = self._humanizer_tokenizer(input_text, return_tensors="pt", truncation=True, max_length=512, padding=True)
                with torch.no_grad():
                    outputs = self._humanizer_model.generate(
                        **inputs,
                        max_length=512,
                        num_beams=4,
                        do_sample=True,
                        temperature=config['temperature'],
                        top_p=config['top_p'],
                        repetition_penalty=2.5,
                        no_repeat_ngram_size=3
                    )
                stage1_output = self._humanizer_tokenizer.decode(outputs[0], skip_special_tokens=True)
                stages_applied.append("t5_fallback")
                use_fallback = True
            except Exception as e:
                logger.warning(f"T5 fallback failed: {e}, using HuggingFace API")
                stage1_output = self._humanize_with_hf_api(text)
                stages_applied.append("huggingface_api_fallback")
                use_fallback = True
        
        # Stage 2: Stealthwriter Post-Processor (for Stealthwriter bypass)
        final_output = stage1_output
        if use_two_stage and self._load_stealthwriter_postprocessor():
            try:
                result = self._stealthwriter_postprocessor.process(stage1_output, intensity=intensity, mode=mode)
                stage2_output = result["processed_text"]
                final_output = stage2_output
                stages_applied.append("stealthwriter_postprocessor_v7")
                logger.info(f"Stage 2 (Stealthwriter Post-Processor) applied, transformations: {result.get('transformations_applied', [])}")
            except Exception as e:
                logger.warning(f"Stage 2 (Stealthwriter Post-Processor) failed: {e}")
                final_output = stage1_output
                stages_applied.append("stealthwriter_postprocessor_v7_failed")
        
        original_words = text.lower().split()
        final_words = final_output.lower().split()
        changes = len(set(original_words).symmetric_difference(set(final_words)))
        
        return {
            "original_text": text,
            "stage1_output": stage1_output,
            "stage2_output": stage2_output,
            "humanized_text": final_output,
            "changes_made": changes,
            "original_length": len(text),
            "humanized_length": len(final_output),
            "stages_applied": stages_applied,
            "humanizer_model": "two_stage_pipeline" if len(stages_applied) >= 2 else stages_applied[0] if stages_applied else "none",
            "used_fallback": use_fallback,
            "intensity": intensity,
            "mode": mode,
            "expected_results": {
                "originality_ai": "<3% AI detection (Stage 1)",
                "stealthwriter": "<10% AI detection (Stage 2)",
                "triboost_v4": "Will still detect as AI (expected - our own detector)"
            }
        }
    
    def _sync_web_search(self, text: str) -> List[Dict[str, Any]]:
        """Perform synchronous web search for plagiarism detection."""
        import concurrent.futures
        
        def run_async_search():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(web_search_service.search_for_plagiarism(text))
            finally:
                loop.close()
        
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_async_search)
                web_results = future.result(timeout=30)
        except Exception as e:
            logger.warning(f"Web search failed: {e}")
            web_results = []
        
        return web_results
    
    def check_plagiarism(self, text: str, source_text: Optional[str] = None) -> Dict[str, Any]:
        """Check text for plagiarism using web search with Jaccard + semantic similarity.
        
        Risk Assessment Thresholds (matching documentation):
        - 70-100%: HIGH RISK - Strong matches found
        - 50-70%: MEDIUM RISK - Some similarities detected
        - 30-50%: LOW RISK - Minor similarities found
        - 0-30%: MINIMAL RISK - Very low similarity
        
        Uses iDrive e2 caching for faster repeated checks (7-day cache).
        """
        self._load_plagiarism()
        
        if source_text:
            return self._check_against_source(text, source_text)
        
        cached_results = idrive_cache.get_cached_results(text)
        if cached_results:
            cached_results["from_cache"] = True
            return cached_results
        
        web_results = self._sync_web_search(text)
        
        if not web_results:
            return {
                "plagiarism_score": 0.0,
                "risk_level": "minimal",
                "sources_found": 0,
                "sources": [],
                "original_content_percentage": 100.0,
                "message": "No matching sources found on the web"
            }
        
        sources_with_scores = []
        max_similarity = 0.0
        
        for result in web_results:
            snippet = result.get("snippet", "")
            if len(snippet) < 20:
                continue
            
            jaccard_score = result.get("jaccard_similarity", 0)
            
            matched_sentence = result.get("matched_sentence", "")
            if matched_sentence and snippet:
                text_embedding = self._plagiarism_encoder.encode([matched_sentence], convert_to_tensor=True)
                snippet_embedding = self._plagiarism_encoder.encode([snippet], convert_to_tensor=True)
                semantic_similarity = torch.nn.functional.cosine_similarity(text_embedding, snippet_embedding).item()
                semantic_score = max(0, semantic_similarity) * 100
            else:
                semantic_score = 0
            
            combined_score = (jaccard_score * 0.6) + (semantic_score * 0.4)
            
            if combined_score >= 30:
                sources_with_scores.append({
                    "url": result.get("url", ""),
                    "title": result.get("title", "Unknown Source"),
                    "similarity_score": round(combined_score, 2),
                    "jaccard_score": round(jaccard_score, 2),
                    "semantic_score": round(semantic_score, 2),
                    "matched_text": snippet[:200] + "..." if len(snippet) > 200 else snippet,
                    "source_api": result.get("source", "unknown")
                })
                max_similarity = max(max_similarity, combined_score)
        
        sources_with_scores.sort(key=lambda x: x["similarity_score"], reverse=True)
        sources_with_scores = sources_with_scores[:10]
        
        plagiarism_score = max_similarity if sources_with_scores else 0.0
        
        if plagiarism_score >= 70:
            risk_level = "high"
        elif plagiarism_score >= 50:
            risk_level = "medium"
        elif plagiarism_score >= 30:
            risk_level = "low"
        else:
            risk_level = "minimal"
        
        results = {
            "plagiarism_score": round(plagiarism_score, 2),
            "risk_level": risk_level,
            "sources_found": len(sources_with_scores),
            "sources": sources_with_scores,
            "original_content_percentage": round(100 - plagiarism_score, 2),
            "web_search_performed": True,
            "total_sources_checked": len(web_results),
            "search_apis_used": list(set(r.get("source", "unknown") for r in web_results))
        }
        
        idrive_cache.cache_results(text, results)
        
        return results
    
    def _check_against_source(self, text: str, source_text: str) -> Dict[str, Any]:
        """Check text against a provided source text."""
        text_embedding = self._plagiarism_encoder.encode([text], convert_to_tensor=True)
        source_embedding = self._plagiarism_encoder.encode([source_text], convert_to_tensor=True)
        
        if self._plagiarism_classifier is not None:
            with torch.no_grad():
                plagiarism_prob = self._plagiarism_classifier(text_embedding, source_embedding).item()
            plagiarism_score = plagiarism_prob * 100
        else:
            similarity = torch.nn.functional.cosine_similarity(text_embedding, source_embedding).item()
            plagiarism_score = similarity * 100
        
        if plagiarism_score >= 70:
            risk_level = "high"
        elif plagiarism_score >= 50:
            risk_level = "medium"
        elif plagiarism_score >= 30:
            risk_level = "low"
        else:
            risk_level = "minimal"
        
        return {
            "plagiarism_score": round(plagiarism_score, 2),
            "risk_level": risk_level,
            "sources_found": 1 if plagiarism_score > 30 else 0,
            "sources": [{
                "url": "provided_source",
                "title": "Provided Source Text",
                "similarity_score": round(plagiarism_score, 2),
                "matched_text": source_text[:200] + "..." if len(source_text) > 200 else source_text
            }] if plagiarism_score > 30 else [],
            "original_content_percentage": round(100 - plagiarism_score, 2),
            "web_search_performed": False
        }


# Singleton instance
ml_service = MLModelService()
