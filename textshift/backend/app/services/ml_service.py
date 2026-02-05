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

# COMPREHENSIVE FORMAL-TO-NATURAL WORD REPLACEMENTS (400+ patterns)
# =============================================================================
# Combined from Stealthwriter analysis + Manus AI formal writing transformation
# Transforms formal/academic vocabulary into everyday natural language
# =============================================================================

SYNONYM_REPLACEMENTS = {
    # -------------------------------------------------------------------------
    # FORMAL VERBS - Action words that sound stiff or bureaucratic
    # -------------------------------------------------------------------------
    
    # Common formal verbs -> simple alternatives
    "utilize": "use", "utilise": "use", "leverage": "use", "employ": "use",
    "implement": "put in place", "execute": "carry out", "facilitate": "help",
    "expedite": "speed up", "optimize": "improve", "optimise": "improve",
    "maximize": "increase", "maximise": "increase", "minimize": "reduce",
    "minimise": "reduce", "prioritize": "focus on", "prioritise": "focus on",
    "incentivize": "encourage", "incentivise": "encourage",
    "conceptualize": "imagine", "conceptualise": "imagine",
    "operationalize": "put into action", "operationalise": "put into action",
    "institutionalize": "make standard", "institutionalise": "make standard",
    "contextualize": "put in context", "contextualise": "put in context",
    
    # Communication verbs
    "communicate": "share", "articulate": "express", "elucidate": "explain",
    "explicate": "explain", "delineate": "describe", "enumerate": "list",
    "stipulate": "state", "postulate": "suggest", "promulgate": "announce",
    "disseminate": "spread", "propagate": "spread", "convey": "share",
    "impart": "give", "transmit": "send", "relay": "pass on",
    
    # Analysis and thinking verbs
    "ascertain": "find out", "determine": "figure out", "discern": "see",
    "perceive": "notice", "cognize": "understand", "comprehend": "understand",
    "apprehend": "grasp", "hypothesize": "guess", "hypothesise": "guess",
    "theorize": "suggest", "theorise": "suggest", "speculate": "wonder",
    "contemplate": "think about", "deliberate": "discuss", "ruminate": "think over",
    "cogitate": "think", "ponder": "consider", "scrutinize": "examine",
    "scrutinise": "examine", "analyze": "look at", "analyse": "look at",
    "evaluate": "assess", "appraise": "judge", "adjudicate": "decide",
    
    # Action and change verbs
    "commence": "start", "initiate": "begin", "inaugurate": "launch",
    "terminate": "end", "conclude": "finish", "finalize": "wrap up",
    "finalise": "wrap up", "discontinue": "stop", "cease": "stop",
    "desist": "stop", "proceed": "go ahead", "advance": "move forward",
    "progress": "move along", "accelerate": "speed up", "decelerate": "slow down",
    "ameliorate": "improve", "enhance": "boost", "augment": "add to",
    "supplement": "add", "modify": "change", "alter": "change",
    "transform": "change", "revise": "update", "amend": "fix",
    "rectify": "correct", "remediate": "fix",
    
    # Inclusion and scope verbs
    "encompass": "include", "comprise": "make up", "constitute": "form",
    "incorporate": "include", "integrate": "combine", "consolidate": "bring together",
    "aggregate": "gather", "accumulate": "build up", "assimilate": "absorb",
    "synthesize": "combine", "synthesise": "combine", "amalgamate": "merge",
    "unify": "bring together", "coalesce": "come together",
    
    # Cause and effect verbs
    "precipitate": "cause", "engender": "create", "generate": "create",
    "produce": "make", "manufacture": "make", "fabricate": "build",
    "construct": "build", "formulate": "create", "devise": "come up with",
    "conceive": "think up", "originate": "start", "instigate": "start",
    "provoke": "trigger", "elicit": "bring out", "evoke": "bring up",
    "induce": "cause", "stimulate": "spark", "catalyze": "trigger",
    "catalyse": "trigger",
    
    # Support and enable verbs
    "enable": "let", "empower": "give power to", "authorize": "allow",
    "authorise": "allow", "sanction": "approve", "endorse": "support",
    "advocate": "push for", "champion": "support", "bolster": "strengthen",
    "reinforce": "back up", "substantiate": "back up", "corroborate": "confirm",
    "validate": "prove", "authenticate": "verify", "certify": "confirm",
    
    # Reduction and limitation verbs
    "mitigate": "lessen", "alleviate": "ease", "attenuate": "weaken",
    "diminish": "shrink", "curtail": "cut back", "abridge": "shorten",
    "truncate": "cut short", "abbreviate": "shorten", "condense": "shrink",
    "compress": "squeeze", "constrain": "limit", "restrict": "limit",
    "confine": "keep to", "circumscribe": "limit",
    
    # Additional verbs from Stealthwriter analysis
    "demonstrates": "shows", "indicates": "shows", "necessitate": "require",
    "cultivate": "develop", "foster": "build", "harness": "use",
    "streamlines": "simplifies", "revolutionized": "changed",
    "alters": "changes", "enables": "allows", "empowers": "helps",
    "anticipate": "expect", "mitigating": "reducing",
    "capitalizing": "taking advantage of", "underscore": "highlight",
    "illuminate": "explain", "exemplify": "show", "manifest": "show",
    "proliferate": "spread", "exacerbate": "worsen", "obviate": "prevent",
    "preclude": "prevent", "buttress": "support", "fortify": "strengthen",
    "hasten": "hurry", "impede": "block", "hinder": "slow down",
    "obstruct": "block", "transcend": "go beyond", "surpass": "beat",
    "exceed": "go beyond", "permeate": "spread through", "pervade": "fill",
    "saturate": "fill", "epitomize": "represent", "embody": "represent",
    "personify": "represent", "juxtapose": "compare", "contrast": "compare",
    "differentiate": "tell apart", "bifurcate": "split", "diverge": "separate",
    "deviate": "differ", "converge": "come together", "recalibrate": "adjust",
    "reconfigure": "change", "restructure": "reorganize",
    
    # -------------------------------------------------------------------------
    # ACADEMIC NOUNS - Abstract or technical terms
    # -------------------------------------------------------------------------
    
    # Methodology and approach nouns
    "paradigm": "approach", "methodology": "method", "framework": "structure",
    "mechanism": "way", "modality": "method", "apparatus": "system",
    "infrastructure": "setup", "architecture": "design", "configuration": "setup",
    "schema": "plan", "protocol": "process", "procedure": "steps",
    "algorithm": "process", "heuristic": "rule of thumb", "rubric": "guide",
    "template": "model", "blueprint": "plan",
    
    # Concept and idea nouns
    "phenomenon": "event", "manifestation": "sign", "instantiation": "example",
    "embodiment": "form", "exemplification": "example", "illustration": "example",
    "representation": "picture", "conceptualization": "idea", "abstraction": "concept",
    "construct": "idea", "notion": "idea", "proposition": "suggestion",
    "hypothesis": "guess", "conjecture": "guess", "supposition": "assumption",
    "premise": "starting point", "postulation": "claim", "assertion": "statement",
    "contention": "argument", "thesis": "main point",
    
    # Scope and extent nouns
    "magnitude": "size", "amplitude": "range", "breadth": "width",
    "scope": "range", "purview": "area", "domain": "field",
    "sphere": "area", "realm": "world", "arena": "field",
    "milieu": "setting", "context": "background", "backdrop": "setting",
    "landscape": "scene", "terrain": "ground", "spectrum": "range",
    "continuum": "range", "gamut": "range", "array": "variety",
    "plethora": "lots", "multitude": "many", "myriad": "countless",
    "abundance": "plenty", "profusion": "wealth", "preponderance": "majority",
    
    # Process and outcome nouns
    "implementation": "rollout", "execution": "carrying out", "deployment": "launch",
    "utilization": "use", "application": "use", "administration": "running",
    "facilitation": "help", "optimization": "improvement", "enhancement": "boost",
    "augmentation": "addition", "modification": "change", "alteration": "change",
    "transformation": "shift", "transition": "change", "progression": "progress",
    "advancement": "step forward", "development": "growth", "evolution": "change",
    "culmination": "peak", "fruition": "success", "realization": "achievement",
    "attainment": "reaching", "acquisition": "getting", "procurement": "buying",
    "obtainment": "getting",
    
    # Relationship nouns
    "correlation": "link", "causation": "cause", "causality": "cause and effect",
    "interrelation": "connection", "interdependence": "reliance on each other",
    "reciprocity": "give and take", "synergy": "teamwork", "symbiosis": "partnership",
    "confluence": "meeting", "convergence": "coming together", "divergence": "split",
    "discrepancy": "gap", "disparity": "difference", "dichotomy": "split",
    "juxtaposition": "contrast", "antithesis": "opposite", "paradox": "contradiction",
    "anomaly": "oddity", "aberration": "exception", "deviation": "shift",
    
    # Additional nouns from Stealthwriter analysis
    "trajectory": "path", "ramification": "effect", "implication": "meaning",
    "connotation": "meaning", "duality": "two sides", "proliferation": "spread",
    "dissemination": "sharing", "propagation": "spread", "mitigation": "reduction",
    "alleviation": "relief", "amelioration": "improvement", "exacerbation": "worsening",
    "deterioration": "decline", "degradation": "damage", "apex": "peak",
    "zenith": "peak", "nadir": "low point", "inception": "start",
    "commencement": "beginning", "cessation": "end", "termination": "end",
    "stakeholders": "people involved", "constituents": "members", "participants": "people",
    "efficacy": "effectiveness", "potency": "strength", "viability": "workability",
    "feasibility": "possibility", "sustainability": "long-term success",
    "scalability": "growth potential", "resilience": "toughness", "robustness": "strength",
    "durability": "lasting power", "volatility": "instability", "fluctuation": "change",
    "variability": "variation", "homogeneity": "sameness", "heterogeneity": "variety",
    "diversity": "variety", "ubiquity": "presence everywhere", "prevalence": "commonness",
    "pervasiveness": "spread", "scarcity": "shortage", "paucity": "lack",
    "dearth": "lack", "deficit": "shortage", "surplus": "extra",
    
    # -------------------------------------------------------------------------
    # CORPORATE JARGON - Business buzzwords
    # -------------------------------------------------------------------------
    
    "synergies": "benefits", "bandwidth": "time", "deliverables": "results",
    "actionables": "next steps", "takeaways": "lessons", "learnings": "lessons",
    "demographics": "groups", "cohorts": "groups", "verticals": "industries",
    "horizontals": "functions", "ecosystems": "networks", "touchpoints": "interactions",
    "bottlenecks": "slowdowns", "roadblocks": "obstacles", "headwinds": "challenges",
    "tailwinds": "advantages", "benchmarks": "standards", "metrics": "measures",
    "scalability": "growth potential", "visibility": "awareness",
    "transparency": "openness", "accountability": "responsibility",
    "alignment": "agreement", "mindshare": "attention",
    "ideation": "brainstorming", "iteration": "version", "pivot": "shift",
    "disruption": "shake-up", "innovation": "new ideas", "digitalization": "going digital",
    "automation": "automatic processing", "streamlining": "simplifying",
    "rightsizing": "adjusting", "restructuring": "reorganizing",
    "rebranding": "new image", "repositioning": "new direction",
    "synergize": "work together", "monetize": "make money from",
    "strategize": "plan", "streamline": "simplify", "benchmark": "compare",
    "actionable": "useful", "scalable": "growable", "stakeholder": "person involved",
    
    # -------------------------------------------------------------------------
    # ABSTRACT ADJECTIVES - Overly formal descriptors
    # -------------------------------------------------------------------------
    
    # Importance and significance
    "paramount": "key", "pivotal": "crucial", "quintessential": "classic",
    "seminal": "groundbreaking", "instrumental": "key", "indispensable": "essential",
    "imperative": "vital", "requisite": "needed", "prerequisite": "required",
    "obligatory": "required", "mandatory": "required", "compulsory": "required",
    "discretionary": "optional", "ancillary": "extra", "supplementary": "additional",
    "complementary": "matching", "auxiliary": "backup", "peripheral": "side",
    "tangential": "related", "incidental": "minor", "negligible": "tiny",
    "marginal": "small", "nominal": "token", "trivial": "minor",
    "inconsequential": "unimportant",
    
    # Quality and nature
    "substantive": "meaningful", "comprehensive": "complete", "exhaustive": "thorough",
    "meticulous": "careful", "rigorous": "strict", "stringent": "tight",
    "exacting": "demanding", "scrupulous": "careful", "fastidious": "picky",
    "judicious": "wise", "prudent": "careful", "sagacious": "wise",
    "astute": "sharp", "perspicacious": "insightful", "discerning": "sharp-eyed",
    "perceptive": "observant", "cognizant": "aware", "conversant": "familiar",
    "proficient": "skilled", "adept": "good at", "competent": "capable",
    "efficacious": "effective", "expedient": "practical", "pragmatic": "realistic",
    "utilitarian": "practical", "functional": "working", "operational": "running",
    "viable": "workable", "feasible": "doable", "tenable": "defensible",
    "sustainable": "lasting", "durable": "long-lasting", "resilient": "tough",
    "robust": "strong",
    
    # Scope and extent adjectives
    "ubiquitous": "everywhere", "pervasive": "widespread", "prevalent": "common",
    "predominant": "main", "preponderant": "dominant", "salient": "notable",
    "conspicuous": "obvious", "pronounced": "clear", "palpable": "obvious",
    "tangible": "real", "discernible": "noticeable", "perceptible": "detectable",
    "appreciable": "noticeable", "considerable": "significant", "substantial": "large",
    "voluminous": "huge", "copious": "plenty of", "ample": "enough",
    "sufficient": "enough", "adequate": "enough", "commensurate": "matching",
    "proportionate": "balanced", "equitable": "fair", "impartial": "unbiased",
    "objective": "neutral", "dispassionate": "calm", "detached": "removed",
    "aloof": "distant",
    
    # Time and sequence adjectives
    "antecedent": "earlier", "precedent": "previous", "prior": "earlier",
    "preliminary": "early", "initial": "first", "nascent": "new",
    "incipient": "beginning", "embryonic": "early-stage", "rudimentary": "basic",
    "foundational": "basic", "fundamental": "core", "elemental": "basic",
    "intrinsic": "built-in", "inherent": "natural", "innate": "inborn",
    "congenital": "from birth", "subsequent": "later", "ensuing": "following",
    "resultant": "resulting", "consequent": "following", "ultimate": "final",
    "terminal": "end", "conclusive": "final", "definitive": "final",
    "categorical": "absolute", "unequivocal": "clear", "unambiguous": "clear",
    "explicit": "clear", "implicit": "implied", "tacit": "unspoken",
    "latent": "hidden", "dormant": "inactive", "quiescent": "quiet",
    
    # Additional adjectives from Stealthwriter analysis
    "unprecedented": "never seen before", "remarkable": "amazing", "profound": "deep",
    "extensive": "wide", "volatile": "unstable", "dynamic": "changing",
    "static": "fixed", "holistic": "complete", "multifaceted": "complex",
    "nuanced": "subtle", "intricate": "complex", "convoluted": "complicated",
    "labyrinthine": "maze-like", "straightforward": "simple", "elementary": "basic",
    "sophisticated": "advanced", "cutting-edge": "latest", "state-of-the-art": "newest",
    "innovative": "new", "novel": "new", "groundbreaking": "revolutionary",
    "crucial": "important", "superfluous": "unnecessary", "redundant": "extra",
    "extraneous": "unrelated", "pertinent": "relevant", "germane": "related",
    "apposite": "fitting", "extrinsic": "external", "exogenous": "outside",
    "omnipresent": "always there", "sporadic": "occasional", "intermittent": "on and off",
    "episodic": "happening sometimes", "perpetual": "constant", "incessant": "nonstop",
    "relentless": "never stopping", "transient": "temporary", "ephemeral": "short-lived",
    "fleeting": "brief", "enduring": "lasting", "persistent": "continuing",
    "sustained": "ongoing",
    
    # -------------------------------------------------------------------------
    # STIFF TRANSITIONS AND CONNECTORS
    # -------------------------------------------------------------------------
    
    "furthermore": "also", "moreover": "what's more", "additionally": "also",
    "consequently": "so", "subsequently": "then", "henceforth": "from now on",
    "heretofore": "until now", "hitherto": "until now", "thereby": "by doing this",
    "whereby": "by which", "wherein": "where", "whereupon": "after which",
    "notwithstanding": "despite", "nonetheless": "still", "nevertheless": "even so",
    "conversely": "on the other hand", "alternatively": "or",
    "correspondingly": "similarly", "accordingly": "so", "hence": "so",
    "thus": "so", "therefore": "so", "ergo": "so", "viz": "namely",
    "apropos": "about", "regarding": "about", "concerning": "about",
    "pertaining": "relating", "respecting": "about", "insofar": "as far as",
    "inasmuch": "since", "whereas": "while", "whilst": "while",
    "albeit": "although", "lest": "in case", "provided": "if",
    "assuming": "if", "given": "considering", "granted": "admittedly",
    "admittedly": "true", "undoubtedly": "certainly", "indubitably": "without doubt",
    "unquestionably": "clearly", "ostensibly": "seemingly", "presumably": "probably",
    "purportedly": "supposedly", "allegedly": "supposedly",
    "reportedly": "according to reports", "apparently": "it seems",
    "evidently": "clearly", "manifestly": "obviously", "patently": "clearly",
    "demonstrably": "provably", "verifiably": "checkably",
    "empirically": "through testing", "theoretically": "in theory",
    "hypothetically": "in theory", "conceptually": "in concept",
    "fundamentally": "basically", "essentially": "basically",
    "intrinsically": "by nature", "inherently": "naturally",
    "predominantly": "mainly", "primarily": "mainly", "principally": "mainly",
    "chiefly": "mainly", "largely": "mostly", "substantially": "mostly",
    "considerably": "a lot", "significantly": "a lot", "markedly": "noticeably",
    "notably": "especially", "particularly": "especially",
    "specifically": "in particular", "explicitly": "clearly",
    "expressly": "specifically", "precisely": "exactly", "accurately": "correctly",
    "appropriately": "properly", "suitably": "fittingly", "adequately": "enough",
    "sufficiently": "enough", "exceedingly": "very", "exceptionally": "unusually",
    "extraordinarily": "extremely", "remarkably": "surprisingly",
    "strikingly": "noticeably", "conspicuously": "obviously",
    "prominently": "noticeably", "eminently": "highly", "supremely": "extremely",
    "profoundly": "deeply", "intensely": "strongly", "acutely": "sharply",
    "severely": "seriously", "drastically": "sharply", "radically": "completely",
    "thoroughly": "completely", "entirely": "completely", "wholly": "fully",
    "utterly": "completely", "absolutely": "totally", "categorically": "completely",
    "unconditionally": "without limits", "unambiguously": "clearly",
    "unmistakably": "clearly", "undeniably": "without question",
    "irrefutably": "beyond argument", "incontrovertibly": "undeniably",
    "indisputably": "without question",
}

# =============================================================================
# COMPREHENSIVE FORMAL-TO-NATURAL PHRASE REPLACEMENTS (100+ patterns)
# =============================================================================
# Combined from Stealthwriter analysis + Manus AI formal writing transformation
# Applied BEFORE word replacements (sorted by length, longest first)
# =============================================================================

STEALTHWRITER_PHRASE_REPLACEMENTS = {
    # -------------------------------------------------------------------------
    # HEDGING AND QUALIFICATION PHRASES
    # -------------------------------------------------------------------------
    
    "it is worth noting that": "notably",
    "it should be noted that": "note that",
    "it is important to note that": "importantly",
    "it is interesting to note that": "interestingly",
    "it bears mentioning that": "worth mentioning",
    "it is imperative that": "we must",
    "it is essential that": "we need to",
    "it is necessary to": "we need to",
    "it is advisable to": "you should",
    "it is recommended that": "we recommend",
    "it is suggested that": "we suggest",
    "it would appear that": "it seems",
    "it would seem that": "it looks like",
    "it can be argued that": "you could say",
    "it could be said that": "you might say",
    "it may be the case that": "maybe",
    "it is possible that": "possibly",
    "it is conceivable that": "it's possible",
    "it is plausible that": "it's likely",
    "it is reasonable to assume that": "we can assume",
    "it stands to reason that": "it makes sense that",
    "it goes without saying that": "obviously",
    "needless to say": "of course",
    "suffice it to say": "simply put",
    "for all intents and purposes": "basically",
    "to all intents and purposes": "essentially",
    "in all likelihood": "probably",
    "in all probability": "most likely",
    "in the event that": "if",
    "in the unlikely event that": "if by chance",
    "on the off chance that": "just in case",
    "under the circumstances": "given the situation",
    "under no circumstances": "never",
    "under certain conditions": "sometimes",
    "provided that": "as long as",
    "on the condition that": "if",
    "with the proviso that": "as long as",
    "subject to": "depending on",
    "contingent upon": "depending on",
    "predicated on": "based on",
    "premised on": "based on",
    
    # -------------------------------------------------------------------------
    # PERSPECTIVE AND STANDPOINT PHRASES
    # -------------------------------------------------------------------------
    
    "from a practical standpoint": "practically speaking",
    "from a theoretical perspective": "in theory",
    "from an empirical standpoint": "based on evidence",
    "from a historical perspective": "historically",
    "from a strategic standpoint": "strategically",
    "from an operational perspective": "operationally",
    "from a financial standpoint": "financially",
    "from a technical perspective": "technically",
    "from the perspective of": "from the view of",
    "from the standpoint of": "looking at it from",
    "from the vantage point of": "from the position of",
    "in terms of": "regarding",
    "with respect to": "about",
    "with regard to": "about",
    "with reference to": "about",
    "in reference to": "about",
    "in relation to": "related to",
    "in connection with": "connected to",
    "in conjunction with": "along with",
    "in association with": "with",
    "in collaboration with": "working with",
    "in partnership with": "partnering with",
    "in coordination with": "coordinating with",
    "in accordance with": "following",
    "in compliance with": "following",
    "in conformity with": "matching",
    "in alignment with": "aligned with",
    "in keeping with": "consistent with",
    "in line with": "matching",
    "consistent with": "matching",
    "commensurate with": "matching",
    "proportional to": "in proportion to",
    "relative to": "compared to",
    "as compared to": "compared to",
    "as opposed to": "unlike",
    "in contrast to": "unlike",
    "in contradistinction to": "as opposed to",
    "as distinct from": "different from",
    "differentiated from": "different from",
    
    # -------------------------------------------------------------------------
    # SCOPE AND DOMAIN PHRASES
    # -------------------------------------------------------------------------
    
    "in the realm of": "in",
    "in the domain of": "in",
    "in the sphere of": "in",
    "in the arena of": "in",
    "in the field of": "in",
    "in the area of": "in",
    "within the context of": "in",
    "within the framework of": "within",
    "within the scope of": "within",
    "within the confines of": "within",
    "within the parameters of": "within",
    "within the purview of": "under",
    "within the ambit of": "within",
    "falls within the scope of": "is part of",
    "falls under the category of": "is a type of",
    "pertains to the domain of": "relates to",
    "encompasses the entirety of": "covers all of",
    "spans the breadth of": "covers",
    "extends across the spectrum of": "ranges across",
    "traverses the landscape of": "crosses",
    
    # -------------------------------------------------------------------------
    # CAUSATION AND RESULT PHRASES
    # -------------------------------------------------------------------------
    
    "as a consequence of": "because of",
    "as a result of": "because of",
    "in consequence of": "due to",
    "by virtue of": "because of",
    "by reason of": "because of",
    "on account of": "because of",
    "owing to the fact that": "because",
    "due to the fact that": "because",
    "given the fact that": "since",
    "in light of the fact that": "since",
    "in view of the fact that": "considering",
    "taking into account that": "considering",
    "taking into consideration": "considering",
    "bearing in mind that": "remembering that",
    "with a view to": "to",
    "with the aim of": "to",
    "with the intention of": "intending to",
    "with the purpose of": "to",
    "with the objective of": "to",
    "with the goal of": "to",
    "for the purpose of": "to",
    "for the sake of": "for",
    "in order to": "to",
    "so as to": "to",
    "in an effort to": "trying to",
    "in an attempt to": "trying to",
    "in a bid to": "trying to",
    "with a view toward": "aiming to",
    "toward the end of": "to",
    "to the end that": "so that",
    "to the effect that": "saying that",
    "such that": "so that",
    "insofar as": "as far as",
    "inasmuch as": "since",
    "to the extent that": "as much as",
    "to the degree that": "as much as",
    "to such an extent that": "so much that",
    "to such a degree that": "so much that",
    
    # -------------------------------------------------------------------------
    # TIME AND SEQUENCE PHRASES
    # -------------------------------------------------------------------------
    
    "at the present time": "now",
    "at this point in time": "now",
    "at this juncture": "now",
    "at the current juncture": "currently",
    "at the present moment": "right now",
    "in the present day": "today",
    "in this day and age": "nowadays",
    "in the current climate": "these days",
    "in the contemporary era": "today",
    "in the modern era": "today",
    "in recent times": "recently",
    "in recent years": "lately",
    "in the recent past": "recently",
    "in the not-too-distant future": "soon",
    "in the foreseeable future": "soon",
    "in the near future": "soon",
    "in the immediate future": "very soon",
    "in due course": "eventually",
    "in the fullness of time": "eventually",
    "over the course of": "during",
    "throughout the duration of": "during",
    "for the duration of": "during",
    "during the course of": "during",
    "in the course of": "while",
    "over the span of": "over",
    "across the span of": "across",
    "prior to the commencement of": "before starting",
    "subsequent to the completion of": "after finishing",
    "following the conclusion of": "after",
    "upon completion of": "after finishing",
    "upon the occurrence of": "when",
    "in the aftermath of": "after",
    "in the wake of": "after",
    "as a precursor to": "before",
    "as a prelude to": "before",
    "as a preliminary to": "before",
    "antecedent to": "before",
    "precedent to": "before",
    "concurrent with": "at the same time as",
    "contemporaneous with": "at the same time as",
    "simultaneous with": "at the same time as",
    "in parallel with": "alongside",
    "in tandem with": "together with",
    
    # -------------------------------------------------------------------------
    # EMPHASIS AND DEGREE PHRASES
    # -------------------------------------------------------------------------
    
    "to a significant degree": "significantly",
    "to a considerable extent": "considerably",
    "to a large extent": "largely",
    "to a great extent": "greatly",
    "to a substantial degree": "substantially",
    "to a marked degree": "markedly",
    "to a notable extent": "notably",
    "to an appreciable degree": "appreciably",
    "to a certain extent": "somewhat",
    "to some extent": "partly",
    "to a limited extent": "slightly",
    "to a lesser extent": "less so",
    "to a greater extent": "more so",
    "to the fullest extent": "fully",
    "to the maximum extent": "as much as possible",
    "to the greatest possible extent": "as much as possible",
    "in no small measure": "significantly",
    "in large measure": "largely",
    "in great measure": "greatly",
    "in equal measure": "equally",
    "by and large": "mostly",
    "on the whole": "overall",
    "all things considered": "overall",
    "taking everything into account": "all in all",
    "when all is said and done": "in the end",
    "at the end of the day": "ultimately",
    "in the final analysis": "ultimately",
    "in the last analysis": "in the end",
    "when push comes to shove": "when it matters",
    "first and foremost": "first",
    "above all else": "most importantly",
    "of paramount importance": "most important",
    "of utmost importance": "extremely important",
    "of critical importance": "crucial",
    "of vital importance": "vital",
    "of fundamental importance": "fundamentally important",
    "of considerable significance": "quite significant",
    "of particular significance": "especially significant",
    "of special significance": "particularly meaningful",
    
    # -------------------------------------------------------------------------
    # ACCURACY AND PRECISION PHRASES
    # -------------------------------------------------------------------------
    
    "with unprecedented accuracy": "more accurately than ever",
    "with remarkable precision": "very precisely",
    "with a high degree of accuracy": "very accurately",
    "with considerable precision": "quite precisely",
    "with pinpoint accuracy": "exactly",
    "with surgical precision": "very precisely",
    "with meticulous attention to detail": "carefully",
    "with painstaking attention": "with great care",
    "in a precise manner": "precisely",
    "in an accurate fashion": "accurately",
    "in a rigorous manner": "rigorously",
    "in a systematic fashion": "systematically",
    "in a methodical manner": "methodically",
    "in a comprehensive manner": "comprehensively",
    "in a thorough fashion": "thoroughly",
    "in an exhaustive manner": "exhaustively",
    "in a detailed fashion": "in detail",
    "in an elaborate manner": "elaborately",
    "in a nuanced fashion": "with nuance",
    "in a sophisticated manner": "sophisticatedly",
    
    # -------------------------------------------------------------------------
    # COMPARISON AND CONTRAST PHRASES
    # -------------------------------------------------------------------------
    
    "in comparison to": "compared to",
    "in comparison with": "compared with",
    "by comparison": "comparatively",
    "when compared to": "compared to",
    "when compared with": "compared with",
    "when juxtaposed with": "next to",
    "when contrasted with": "unlike",
    "when set against": "against",
    "when measured against": "against",
    "when weighed against": "against",
    "as against": "versus",
    "in juxtaposition to": "next to",
    "by way of contrast": "in contrast",
    "on the contrary": "however",
    "quite the contrary": "actually the opposite",
    "to the contrary": "otherwise",
    "notwithstanding the foregoing": "despite this",
    "irrespective of": "regardless of",
    "regardless of the fact that": "even though",
    "despite the fact that": "even though",
    "in spite of the fact that": "even though",
    "notwithstanding the fact that": "even though",
    
    # -------------------------------------------------------------------------
    # CONCLUSION AND SUMMARY PHRASES
    # -------------------------------------------------------------------------
    
    "in conclusion": "to conclude",
    "in summary": "to sum up",
    "to summarize": "in short",
    "to recapitulate": "to recap",
    "in summation": "summing up",
    "by way of conclusion": "finally",
    "by way of summary": "in brief",
    "as a final point": "lastly",
    "as a concluding remark": "finally",
    "as a closing observation": "to close",
    "it can be concluded that": "we can conclude",
    "it may be concluded that": "we can say",
    "the conclusion can be drawn that": "we can conclude",
    "the inference can be made that": "we can infer",
    "based on the foregoing": "based on this",
    "based on the above": "from this",
    "in light of the above": "given this",
    "in view of the above": "considering this",
    "taking the above into consideration": "with this in mind",
    "with the above in mind": "keeping this in mind",
    "having considered the above": "after considering this",
    "having examined the evidence": "after looking at the evidence",
    "having reviewed the data": "after reviewing the data",
    "having analyzed the findings": "after analyzing the findings",
    "the evidence suggests that": "the evidence shows",
    "the data indicates that": "the data shows",
    "the findings demonstrate that": "the findings show",
    "the results reveal that": "the results show",
    "the analysis confirms that": "the analysis shows",
    
    # -------------------------------------------------------------------------
    # INTRODUCTION AND FRAMING PHRASES
    # -------------------------------------------------------------------------
    
    "the purpose of this": "this aims to",
    "the objective of this": "this is meant to",
    "the aim of this": "this tries to",
    "the intention of this": "this intends to",
    "the goal of this": "this seeks to",
    "this paper aims to": "this paper tries to",
    "this study seeks to": "this study looks at",
    "this research endeavors to": "this research tries to",
    "this analysis attempts to": "this analysis looks at",
    "this investigation explores": "this investigation looks into",
    "it is the purpose of this": "this aims to",
    "it is the objective of this": "this is meant to",
    "the present study": "this study",
    "the current investigation": "this investigation",
    "the aforementioned": "the above",
    "the above-mentioned": "the above",
    "the previously stated": "what was said",
    "the previously discussed": "what we discussed",
    "as previously mentioned": "as mentioned",
    "as stated earlier": "as said before",
    "as noted above": "as noted",
    "as indicated previously": "as shown",
    "as discussed previously": "as discussed",
    "as outlined above": "as outlined",
    "as described earlier": "as described",
    "as explained previously": "as explained",
    "as demonstrated above": "as shown",
    "as illustrated earlier": "as shown",
    "as evidenced by": "as shown by",
    "as exemplified by": "as shown by",
    "as manifested in": "as seen in",
    "as reflected in": "as seen in",
    "as embodied in": "as found in",
    "as encapsulated in": "as captured in",
    "as articulated in": "as stated in",
    "as delineated in": "as described in",
    "as elucidated in": "as explained in",
    "as expounded in": "as detailed in",
    
    # -------------------------------------------------------------------------
    # ADDITIONAL STEALTHWRITER-SPECIFIC PATTERNS
    # -------------------------------------------------------------------------
    
    "navigate the complexities of": "deal with the challenges of",
    "navigate complex": "work through difficult",
    "demonstrates remarkable": "shows amazing",
    "exhibits remarkable": "shows amazing",
    "yields dividends": "pays off",
    "fosters innovation": "encourages new ideas",
    "drives sustainable": "supports lasting",
    "enables seamless": "allows smooth",
    "facilitates effective": "helps with good",
    "ensures optimal": "makes sure of the best",
    "achieves significant": "gets major",
    "presents unprecedented opportunities": "offers huge new chances",
    "poses existential challenges": "creates serious problems",
    "necessitates comprehensive": "requires complete",
    "encompasses a wide range": "includes many",
    "spans multiple": "covers several",
    "transcends traditional": "goes beyond usual",
    "revolutionizes the way": "changes how",
    "transforms the landscape": "changes the field",
    "reshapes the future": "changes what comes next",
    "with unprecedented efficiency": "more efficiently than ever before",
    "in light of": "considering",
    "in the context of": "within",
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
    
    def _apply_stealthwriter_postprocessor(self, text: str, passes: int = 2) -> str:
        """
        Apply Stealthwriter-style transformations to make text sound more human.
        
        Process order (important for best results):
        1. Remove meta-commentary
        2. Apply phrase replacements (longer patterns first)
        3. Expand contractions
        4. Remove filler words
        5. Apply word replacements
        6. Add occasional formal starters
        """
        result = text
        result = self._remove_meta_commentary(result)
        
        for _ in range(passes):
            sorted_phrases = sorted(STEALTHWRITER_PHRASE_REPLACEMENTS.items(), 
                                   key=lambda x: len(x[0]), reverse=True)
            for phrase, replacement in sorted_phrases:
                pattern = re.compile(re.escape(phrase), re.IGNORECASE)
                matches = pattern.findall(result)
                for match in matches:
                    if match[0].isupper():
                        new_replacement = replacement[0].upper() + replacement[1:]
                    else:
                        new_replacement = replacement
                    result = result.replace(match, new_replacement, 1)
            
            for contraction, expansion in CONTRACTION_EXPANSIONS.items():
                result = re.sub(re.escape(contraction), expansion, result, flags=re.IGNORECASE)
            
            for filler in FILLERS_TO_REMOVE:
                result = result.replace(filler, "").replace(filler.capitalize(), "")
            
            words = result.split()
            new_words = []
            for word in words:
                clean_word = word.strip('.,!?;:()[]{}"\'-')
                lower_word = clean_word.lower()
                
                if lower_word in SYNONYM_REPLACEMENTS:
                    replacement = SYNONYM_REPLACEMENTS[lower_word]
                    if clean_word and clean_word[0].isupper():
                        replacement = replacement.capitalize()
                    prefix = word[:len(word) - len(word.lstrip('.,!?;:()[]{}"\'-'))]
                    suffix = word[len(word.rstrip('.,!?;:()[]{}"\'-')):]
                    new_words.append(prefix + replacement + suffix)
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
    
    def humanize(self, text: str, use_two_stage: bool = True, intensity: str = 'high') -> Dict[str, Any]:
        """Humanize AI-generated text using two-stage pipeline to bypass BOTH Originality.ai AND Stealthwriter.
        
        Two-Stage Pipeline:
        - Stage 1: Final Humanizer (ESL patterns + anecdotes) - bypasses Originality.ai (<3% AI)
        - Stage 2: Stealthwriter Post-Processor V7 - bypasses Stealthwriter (<10% AI)
        
        Args:
            text: Text to humanize
            use_two_stage: If True, apply both stages. If False, only Stage 1.
            intensity: Post-processor intensity ('low', 'medium', 'high')
        
        Returns:
            Dict with original_text, humanized_text, stages_applied, etc.
        """
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
                        temperature=0.8,
                        top_p=0.9,
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
                result = self._stealthwriter_postprocessor.process(stage1_output, intensity=intensity)
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
