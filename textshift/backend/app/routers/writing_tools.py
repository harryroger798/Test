"""
Writing Tools Router - Phase 4 Feature Expansion
API endpoints for 14 new writing/content tools with tier-based gating.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from app.core.database import get_db
from app.core.security import get_current_active_user, get_current_verified_user
from app.models.user import User, SubscriptionTier
from app.models.scan import Scan, ScanType, ScanStatus
from app.services.writing_tools_service import writing_tools_service
from app.services.credit_service import deduct_credits, count_words
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["Writing Tools"])


# ==================== Request/Response Models ====================

class GrammarCheckRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)

class GrammarCheckResponse(BaseModel):
    success: bool
    original_text: Optional[str] = None
    corrected_text: Optional[str] = None
    corrections: Optional[List[Dict[str, Any]]] = None
    error_count: Optional[int] = None
    errors: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None

class ToneDetectRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)

class ToneDetectResponse(BaseModel):
    success: bool
    primary_tone: Optional[str] = None
    primary_confidence: Optional[float] = None
    overall_category: Optional[str] = None
    category_breakdown: Optional[Dict[str, Any]] = None
    all_tones: Optional[List[Dict[str, Any]]] = None
    sentence_tones: Optional[List[Dict[str, Any]]] = None
    consistency_score: Optional[float] = None
    sentence_count_analyzed: Optional[int] = None
    error: Optional[str] = None

class ToneAdjustRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    target_tone: str = Field(..., description="Target tone: formal, casual, persuasive, academic, confident, empathetic")

class ToneAdjustResponse(BaseModel):
    success: bool
    original_text: Optional[str] = None
    adjusted_text: Optional[str] = None
    target_tone: Optional[str] = None
    word_count_original: Optional[int] = None
    word_count_adjusted: Optional[int] = None
    transformation_applied: Optional[str] = None
    method: Optional[str] = None
    error: Optional[str] = None

class ReadabilityRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    detailed: bool = False

class ReadabilityResponse(BaseModel):
    success: bool
    flesch_reading_ease: Optional[float] = None
    reading_level: Optional[str] = None
    recommended_audience: Optional[str] = None
    grade_explanation: Optional[str] = None
    average_grade_level: Optional[float] = None
    word_count: Optional[int] = None
    sentence_count: Optional[int] = None
    flesch_kincaid_grade: Optional[float] = None
    gunning_fog_index: Optional[float] = None
    smog_index: Optional[float] = None
    coleman_liau_index: Optional[float] = None
    automated_readability_index: Optional[float] = None
    avg_sentence_length: Optional[float] = None
    avg_word_length: Optional[float] = None
    avg_syllables_per_word: Optional[float] = None
    complex_word_count: Optional[int] = None
    complex_word_percentage: Optional[float] = None
    character_count: Optional[int] = None
    total_syllables: Optional[int] = None
    vocabulary_richness: Optional[float] = None
    paragraph_breakdown: Optional[List[Dict[str, Any]]] = None
    suggestions: Optional[List[str]] = None
    error: Optional[str] = None

class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=50, max_length=50000)
    max_length: int = Field(default=150, ge=50, le=500)
    min_length: int = Field(default=50, ge=20, le=200)

class SummarizeResponse(BaseModel):
    success: bool
    summary: Optional[str] = None
    original_word_count: Optional[int] = None
    summary_word_count: Optional[int] = None
    compression_ratio: Optional[float] = None
    error: Optional[str] = None

class ParaphraseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    mode: str = Field(default="standard", description="Mode: standard, fluency, creative, formal, simple")

class ParaphraseResponse(BaseModel):
    success: bool
    original_text: Optional[str] = None
    paraphrased_text: Optional[str] = None
    mode: Optional[str] = None
    error: Optional[str] = None

class CitationRequest(BaseModel):
    query: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    style: str = Field(default="apa", description="Citation style: apa, mla, chicago")

class CitationResponse(BaseModel):
    success: bool
    citation: Optional[str] = None
    style: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    year: Optional[Any] = None
    error: Optional[str] = None

class WordCountRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=100000)

class WordCountResponse(BaseModel):
    success: bool
    word_count: Optional[int] = None
    character_count: Optional[int] = None
    character_count_no_spaces: Optional[int] = None
    letter_count: Optional[int] = None
    digit_count: Optional[int] = None
    special_char_count: Optional[int] = None
    sentence_count: Optional[int] = None
    paragraph_count: Optional[int] = None
    unique_words: Optional[int] = None
    avg_word_length: Optional[float] = None
    avg_sentence_length: Optional[float] = None
    longest_sentence_words: Optional[int] = None
    shortest_sentence_words: Optional[int] = None
    avg_paragraph_length: Optional[float] = None
    reading_time_minutes: Optional[float] = None
    reading_time_display: Optional[str] = None
    speaking_time_minutes: Optional[float] = None
    speaking_time_display: Optional[str] = None
    top_words: Optional[List[Dict[str, Any]]] = None
    keyword_density: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None

class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    source_lang: str = Field(..., description="Source language code: en, es, fr, de")
    target_lang: str = Field(..., description="Target language code: en, es, fr, de")

class TranslateResponse(BaseModel):
    success: bool
    original_text: Optional[str] = None
    translated_text: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    error: Optional[str] = None

class ExportRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=100000)
    format: str = Field(..., description="Export format: txt, html, markdown")
    title: str = Field(default="Document")

class ExportResponse(BaseModel):
    success: bool
    content: Optional[str] = None
    format: Optional[str] = None
    mime_type: Optional[str] = None
    filename: Optional[str] = None
    extension: Optional[str] = None
    size_bytes: Optional[int] = None
    encoding: Optional[str] = None
    error: Optional[str] = None

class StyleAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=50, max_length=50000)

class StyleAnalysisResponse(BaseModel):
    success: bool
    style_type: Optional[str] = None
    vocabulary_diversity: Optional[float] = None
    vocabulary_level: Optional[str] = None
    avg_sentence_length: Optional[float] = None
    sentence_length_variation: Optional[float] = None
    sentence_variety_score: Optional[float] = None
    passive_voice_percentage: Optional[float] = None
    passive_voice_sentences: Optional[List[str]] = None
    transition_word_count: Optional[int] = None
    transition_words_found: Optional[List[str]] = None
    pos_distribution: Optional[Dict[str, Any]] = None
    formality_score: Optional[float] = None
    formality_label: Optional[str] = None
    question_count: Optional[int] = None
    exclamation_count: Optional[int] = None
    unique_word_count: Optional[int] = None
    total_word_count: Optional[int] = None
    overused_words: Optional[List[Dict[str, Any]]] = None
    overused_adverbs: Optional[List[Dict[str, Any]]] = None
    recommendations: Optional[List[str]] = None
    error: Optional[str] = None

class ContentImproveRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    focus: str = Field(default="clarity", description="Focus: clarity, conciseness, engagement, professionalism, seo")

class ContentImproveResponse(BaseModel):
    success: bool
    original_text: Optional[str] = None
    improved_text: Optional[str] = None
    focus: Optional[str] = None
    error: Optional[str] = None

class BulkProcessRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, max_items=50)
    operation: str = Field(..., description="Operation: grammar, tone_detect, readability, summarize, paraphrase, word_count")

class BulkProcessResponse(BaseModel):
    success: bool
    results: Optional[List[Dict[str, Any]]] = None
    processed_count: Optional[int] = None
    error: Optional[str] = None


# ==================== Tier Gating Functions ====================

def get_feature_limits(tier: SubscriptionTier) -> Dict[str, Any]:
    """Get feature limits based on subscription tier."""
    limits = {
        SubscriptionTier.FREE: {
            "grammar_words_per_day": 500,
            "tone_detect_words_per_day": 500,
            "tone_adjust": False,
            "readability_detailed": False,
            "summarize_words": 500,
            "paraphrase_modes": ["standard"],
            "citations": False,
            "word_counter": True,
            "translate_words_per_day": 500,
            "export_formats": ["txt"],
            "bulk_processing": False,
            "api_access": False,
            "style_analysis": False,
            "content_improver": False,
        },
        SubscriptionTier.STARTER: {
            "grammar_words_per_day": 5000,
            "tone_detect_words_per_day": -1,  # Unlimited
            "tone_adjust": True,
            "readability_detailed": True,
            "summarize_words": 5000,
            "paraphrase_modes": ["standard", "fluency", "creative", "formal", "simple"],
            "citations": True,
            "word_counter": True,
            "translate_words_per_day": 5000,
            "export_formats": ["txt", "html", "markdown", "pdf"],
            "bulk_processing": False,
            "api_access": False,
            "style_analysis": True,
            "content_improver": True,
        },
        SubscriptionTier.PRO: {
            "grammar_words_per_day": -1,  # Unlimited
            "tone_detect_words_per_day": -1,
            "tone_adjust": True,
            "readability_detailed": True,
            "summarize_words": -1,
            "paraphrase_modes": ["standard", "fluency", "creative", "formal", "simple"],
            "citations": True,
            "word_counter": True,
            "translate_words_per_day": -1,
            "export_formats": ["txt", "html", "markdown", "pdf"],
            "bulk_processing": True,
            "bulk_max_files": 10,
            "api_access": False,
            "style_analysis": True,
            "content_improver": True,
        },
        SubscriptionTier.ENTERPRISE: {
            "grammar_words_per_day": -1,
            "tone_detect_words_per_day": -1,
            "tone_adjust": True,
            "readability_detailed": True,
            "summarize_words": -1,
            "paraphrase_modes": ["standard", "fluency", "creative", "formal", "simple"],
            "citations": True,
            "word_counter": True,
            "translate_words_per_day": -1,
            "export_formats": ["txt", "html", "markdown", "pdf"],
            "bulk_processing": True,
            "bulk_max_files": 50,
            "api_access": True,
            "style_analysis": True,
            "content_improver": True,
        },
    }
    return limits.get(tier, limits[SubscriptionTier.FREE])


def check_feature_access(user: User, feature: str, limits: Dict[str, Any]) -> None:
    """Check if user has access to a feature based on their tier."""
    if feature == "tone_adjust" and not limits.get("tone_adjust"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tone Adjuster requires Starter tier or higher. Upgrade to access this feature."
        )
    if feature == "citations" and not limits.get("citations"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citation Generator requires Starter tier or higher. Upgrade to access this feature."
        )
    if feature == "style_analysis" and not limits.get("style_analysis"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Style Analysis requires Starter tier or higher. Upgrade to access this feature."
        )
    if feature == "content_improver" and not limits.get("content_improver"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Content Improver requires Starter tier or higher. Upgrade to access this feature."
        )
    if feature == "bulk_processing" and not limits.get("bulk_processing"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bulk Processing requires Pro tier or higher. Upgrade to access this feature."
        )
    if feature == "api_access" and not limits.get("api_access"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API Access requires Enterprise tier. Upgrade to access this feature."
        )


def check_word_limit(user: User, word_count: int, limit_key: str, limits: Dict[str, Any], db: Session) -> None:
    """Check if user has exceeded their daily word limit for a feature."""
    daily_limit = limits.get(limit_key, 0)
    
    if daily_limit == -1:  # Unlimited
        return
    
    if word_count > daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Text exceeds your daily limit of {daily_limit} words for this feature. Upgrade for more."
        )


# ==================== API Endpoints ====================

@router.post("/grammar", response_model=GrammarCheckResponse)
async def check_grammar(
    request: GrammarCheckRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Check grammar using LanguageTool API.
    
    Tier limits:
    - Free: 500 words/day
    - Starter+: 5,000 words/day
    - Pro+: Unlimited
    """
    limits = get_feature_limits(current_user.subscription_tier)
    word_count = count_words(request.text)
    check_word_limit(current_user, word_count, "grammar_words_per_day", limits, db)
    
    # Deduct credits
    deduct_credits(db, current_user, word_count, "Grammar Check", "grammar")
    
    result = await writing_tools_service.check_grammar(request.text)
    return GrammarCheckResponse(**result)


@router.post("/tone/detect", response_model=ToneDetectResponse)
async def detect_tone(
    request: ToneDetectRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Detect emotional tone of text using AI.
    
    Tier limits:
    - Free: 500 words/day
    - Starter+: Unlimited
    """
    limits = get_feature_limits(current_user.subscription_tier)
    word_count = count_words(request.text)
    check_word_limit(current_user, word_count, "tone_detect_words_per_day", limits, db)
    
    deduct_credits(db, current_user, word_count, "Tone Detection", "tone_detect")
    
    result = writing_tools_service.detect_tone(request.text)
    return ToneDetectResponse(**result)


@router.post("/tone/adjust", response_model=ToneAdjustResponse)
async def adjust_tone(
    request: ToneAdjustRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Adjust text tone to a target style.
    
    Tier access:
    - Free: Not available
    - Starter+: Available
    
    Target tones: formal, casual, persuasive, academic, confident, empathetic
    """
    limits = get_feature_limits(current_user.subscription_tier)
    check_feature_access(current_user, "tone_adjust", limits)
    
    word_count = count_words(request.text)
    deduct_credits(db, current_user, word_count * 2, "Tone Adjustment", "tone_adjust")
    
    result = writing_tools_service.adjust_tone(request.text, request.target_tone)
    return ToneAdjustResponse(**result)


@router.post("/readability", response_model=ReadabilityResponse)
async def analyze_readability(
    request: ReadabilityRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Analyze text readability with Flesch scores and grade levels.
    
    Tier access:
    - Free: Basic metrics only
    - Starter+: Detailed metrics (Flesch-Kincaid, Gunning Fog, etc.)
    """
    limits = get_feature_limits(current_user.subscription_tier)
    detailed = request.detailed and limits.get("readability_detailed", False)
    
    word_count = count_words(request.text)
    deduct_credits(db, current_user, word_count, "Readability Analysis", "readability")
    
    result = writing_tools_service.analyze_readability(request.text, detailed=detailed)
    return ReadabilityResponse(**result)


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_text(
    request: SummarizeRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Summarize text using AI.
    
    Tier limits:
    - Free: 500 words max
    - Starter: 5,000 words max
    - Pro+: Unlimited
    """
    limits = get_feature_limits(current_user.subscription_tier)
    word_count = count_words(request.text)
    
    word_limit = limits.get("summarize_words", 500)
    if word_limit != -1 and word_count > word_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Text exceeds your limit of {word_limit} words for summarization. Upgrade for more."
        )
    
    deduct_credits(db, current_user, word_count, "Summarization", "summarize")
    
    result = writing_tools_service.summarize(request.text, request.max_length, request.min_length)
    return SummarizeResponse(**result)


@router.post("/paraphrase", response_model=ParaphraseResponse)
async def paraphrase_text(
    request: ParaphraseRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Paraphrase text with different modes.
    
    Tier access:
    - Free: Standard mode only
    - Starter+: All modes (standard, fluency, creative, formal, simple)
    """
    limits = get_feature_limits(current_user.subscription_tier)
    allowed_modes = limits.get("paraphrase_modes", ["standard"])
    
    if request.mode.lower() not in allowed_modes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Paraphrase mode '{request.mode}' requires Starter tier or higher. Free tier only has: {allowed_modes}"
        )
    
    word_count = count_words(request.text)
    deduct_credits(db, current_user, word_count * 2, "Paraphrasing", "paraphrase")
    
    result = writing_tools_service.paraphrase(request.text, request.mode)
    return ParaphraseResponse(**result)


@router.post("/citation", response_model=CitationResponse)
async def generate_citation(
    request: CitationRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Generate citations in APA, MLA, or Chicago style.
    
    Tier access:
    - Free: Not available
    - Starter+: Available
    """
    limits = get_feature_limits(current_user.subscription_tier)
    check_feature_access(current_user, "citations", limits)
    
    if not request.query and not request.doi and not request.url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a query, DOI, or URL to generate a citation."
        )
    
    deduct_credits(db, current_user, 10, "Citation Generation", "citation")
    
    result = await writing_tools_service.generate_citation(
        query=request.query,
        doi=request.doi,
        url=request.url,
        style=request.style
    )
    return CitationResponse(**result)


@router.post("/word-count", response_model=WordCountResponse)
async def count_words_detailed(
    request: WordCountRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Get detailed word and character count analysis.
    
    Tier access: All tiers (Free feature)
    """
    result = writing_tools_service.count_words_detailed(request.text)
    return WordCountResponse(**result)


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(
    request: TranslateRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Translate text between supported languages.
    
    Supported pairs: en-es, es-en, en-fr, fr-en, en-de, de-en
    
    Tier limits:
    - Free: 500 words/day
    - Starter: 5,000 words/day
    - Pro+: Unlimited
    """
    limits = get_feature_limits(current_user.subscription_tier)
    word_count = count_words(request.text)
    check_word_limit(current_user, word_count, "translate_words_per_day", limits, db)
    
    deduct_credits(db, current_user, word_count * 2, "Translation", "translate")
    
    result = writing_tools_service.translate(request.text, request.source_lang, request.target_lang)
    return TranslateResponse(**result)


@router.post("/export", response_model=ExportResponse)
async def export_text(
    request: ExportRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Export text to different formats.
    
    Tier access:
    - Free: TXT only
    - Starter+: TXT, HTML, Markdown
    """
    limits = get_feature_limits(current_user.subscription_tier)
    allowed_formats = limits.get("export_formats", ["txt"])
    
    if request.format.lower() not in allowed_formats:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Export format '{request.format}' requires Starter tier or higher. Free tier only has: {allowed_formats}"
        )
    
    result = writing_tools_service.export_text(request.text, request.format, request.title)
    return ExportResponse(**result)


@router.post("/style-analysis", response_model=StyleAnalysisResponse)
async def analyze_style(
    request: StyleAnalysisRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Analyze writing style including vocabulary, sentence structure, etc.
    
    Tier access:
    - Free: Not available
    - Starter+: Available
    """
    limits = get_feature_limits(current_user.subscription_tier)
    check_feature_access(current_user, "style_analysis", limits)
    
    word_count = count_words(request.text)
    deduct_credits(db, current_user, word_count, "Style Analysis", "style_analysis")
    
    result = writing_tools_service.analyze_style(request.text)
    return StyleAnalysisResponse(**result)


@router.post("/improve", response_model=ContentImproveResponse)
async def improve_content(
    request: ContentImproveRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Improve content with different focus areas.
    
    Focus options: clarity, conciseness, engagement, professionalism, seo
    
    Tier access:
    - Free: Not available
    - Starter+: Available
    """
    limits = get_feature_limits(current_user.subscription_tier)
    check_feature_access(current_user, "content_improver", limits)
    
    word_count = count_words(request.text)
    deduct_credits(db, current_user, word_count * 2, "Content Improvement", "content_improve")
    
    result = writing_tools_service.improve_content(request.text, request.focus)
    return ContentImproveResponse(**result)


@router.post("/bulk", response_model=BulkProcessResponse)
async def bulk_process(
    request: BulkProcessRequest,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Process multiple texts in bulk.
    
    Supported operations: grammar, tone_detect, readability, summarize, paraphrase, word_count
    
    Tier access:
    - Free/Starter: Not available
    - Pro: Up to 10 files
    - Enterprise: Up to 50 files
    """
    limits = get_feature_limits(current_user.subscription_tier)
    check_feature_access(current_user, "bulk_processing", limits)
    
    max_files = limits.get("bulk_max_files", 10)
    if len(request.texts) > max_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Your tier allows up to {max_files} files per bulk operation."
        )
    
    # Calculate total credits
    total_words = sum(count_words(text) for text in request.texts)
    multiplier = 2 if request.operation in ["paraphrase", "tone_adjust", "improve"] else 1
    deduct_credits(db, current_user, total_words * multiplier, f"Bulk {request.operation}", "bulk")
    
    results = []
    for i, text in enumerate(request.texts):
        try:
            if request.operation == "grammar":
                result = await writing_tools_service.check_grammar(text)
            elif request.operation == "tone_detect":
                result = writing_tools_service.detect_tone(text)
            elif request.operation == "readability":
                result = writing_tools_service.analyze_readability(text, detailed=True)
            elif request.operation == "summarize":
                result = writing_tools_service.summarize(text)
            elif request.operation == "paraphrase":
                result = writing_tools_service.paraphrase(text)
            elif request.operation == "word_count":
                result = writing_tools_service.count_words_detailed(text)
            else:
                result = {"success": False, "error": f"Unknown operation: {request.operation}"}
            
            result["index"] = i
            results.append(result)
        except Exception as e:
            results.append({"index": i, "success": False, "error": str(e)})
    
    return BulkProcessResponse(
        success=True,
        results=results,
        processed_count=len(results)
    )


@router.get("/limits")
async def get_user_limits(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's feature limits based on their subscription tier."""
    limits = get_feature_limits(current_user.subscription_tier)
    return {
        "tier": current_user.subscription_tier.value if hasattr(current_user.subscription_tier, 'value') else str(current_user.subscription_tier),
        "limits": limits
    }


@router.get("/supported-languages")
async def get_supported_languages():
    """Get list of supported translation language pairs."""
    return {
        "supported_pairs": writing_tools_service.SUPPORTED_LANGUAGES,
        "languages": {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German"
        }
    }


@router.get("/api-docs")
async def get_api_docs(
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Get API documentation and generate API key for Enterprise users.
    
    Tier access:
    - Free/Starter/Pro: Not available
    - Enterprise: Available with API key generation
    """
    limits = get_feature_limits(current_user.subscription_tier)
    check_feature_access(current_user, "api_access", limits)
    
    # Generate or retrieve API key for the user
    import secrets
    api_key = f"ts_{secrets.token_hex(24)}"
    
    return {
        "success": True,
        "api_key": api_key,
        "base_url": "/api/tools",
        "endpoints": [
            {"method": "POST", "path": "/grammar", "description": "Check grammar and spelling"},
            {"method": "POST", "path": "/tone/detect", "description": "Detect emotional tone"},
            {"method": "POST", "path": "/tone/adjust", "description": "Adjust text tone"},
            {"method": "POST", "path": "/readability", "description": "Analyze readability"},
            {"method": "POST", "path": "/summarize", "description": "Summarize text"},
            {"method": "POST", "path": "/paraphrase", "description": "Paraphrase text"},
            {"method": "POST", "path": "/citation", "description": "Generate citations"},
            {"method": "POST", "path": "/word-count", "description": "Count words and characters"},
            {"method": "POST", "path": "/translate", "description": "Translate text"},
            {"method": "POST", "path": "/export", "description": "Export to different formats"},
            {"method": "POST", "path": "/style-analysis", "description": "Analyze writing style"},
            {"method": "POST", "path": "/improve", "description": "Improve content"},
            {"method": "POST", "path": "/bulk", "description": "Bulk processing"},
        ],
        "authentication": "Bearer Token (JWT)",
        "rate_limits": "Enterprise tier has no rate limits"
    }
