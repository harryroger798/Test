from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import Optional
import re
from app.core.database import get_db
from app.core.security import get_current_active_user, get_current_verified_user
from app.models.user import User, SubscriptionTier
from app.models.scan import Scan, ScanType, ScanStatus
from app.schemas.scan import ScanCreate, ScanResponse, ScanListResponse
from app.services.credit_service import calculate_credits_needed, deduct_credits, get_daily_scan_limit, count_words
from app.services.ml_service import ml_service, ABTestingIntegration
from app.services.humanized_hash_service import humanized_hash_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scan", tags=["Scanning"]) 

# Simple low-content detector: proportion of >=3-letter alphabetic tokens
COMMON_SHORT_WORDS = {"i", "a", "an", "am", "as", "at", "be", "by", "do", "go",
                      "he", "if", "in", "is", "it", "me", "my", "no", "of", "on",
                      "or", "so", "to", "up", "us", "we", "ok"}

def _is_low_content(text: str, min_ratio: float = 0.7) -> bool:
    tokens = re.findall(r"[A-Za-z]+", text)
    if not tokens:
        return True
    real = [t for t in tokens if len(t) >= 3 or t.lower() in COMMON_SHORT_WORDS]
    ratio = len(real) / max(1, len(tokens))
    return ratio < min_ratio


def get_priority_for_tier(tier: SubscriptionTier) -> int:
    """Get processing priority based on subscription tier.
    Higher number = higher priority (processed first).
    """
    priority_map = {
        SubscriptionTier.FREE: 0,
        SubscriptionTier.STARTER: 1,
        SubscriptionTier.PRO: 2,
        SubscriptionTier.ENTERPRISE: 3
    }
    return priority_map.get(tier, 0)


def check_feature_access(user: User, scan_type: str) -> None:
    """Check if user's subscription tier allows access to the feature.
    
    FREE tier: AI Detection only
    STARTER+: All features (AI Detection, Humanize, Plagiarism)
    """
    tier = user.subscription_tier
    
    # Free tier can only use AI Detection
    if tier == SubscriptionTier.FREE and scan_type != "ai_detection":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Upgrade to Starter or higher to access {scan_type.replace('_', ' ').title()}. Free tier only includes AI Detection."
        )


def check_daily_scan_limit(user: User, db: Session) -> None:
    """Check if user has exceeded their daily scan limit."""
    tier = user.subscription_tier.value if hasattr(user.subscription_tier, 'value') else str(user.subscription_tier)
    daily_limit = get_daily_scan_limit(tier)
    
    # -1 means unlimited
    if daily_limit == -1:
        return
    
    # Count today's scans
    today = date.today()
    today_scans = db.query(Scan).filter(
        Scan.user_id == user.id,
        Scan.created_at >= datetime.combine(today, datetime.min.time())
    ).count()
    
    if today_scans >= daily_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily scan limit reached ({daily_limit} scans/day). Upgrade your plan for more scans."
        )


def process_scan(scan_id: int, db: Session):
    """Background task to process a scan."""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        return
    
    try:
        scan.status = ScanStatus.PROCESSING
        db.commit()
        
        if scan.scan_type == ScanType.AI_DETECTION:
            result = ml_service.detect_ai(scan.input_text)
            scan.ai_probability = result["ai_probability"]
            scan.confidence_level = result["confidence_level"]
            scan.results = result
            
        elif scan.scan_type == ScanType.HUMANIZE:
            result = ml_service.humanize(scan.input_text)
            scan.output_text = result["humanized_text"]
            scan.results = result
            
        elif scan.scan_type == ScanType.PLAGIARISM:
            result = ml_service.check_plagiarism(scan.input_text)
            scan.plagiarism_score = result["plagiarism_score"]
            scan.sources_found = result["sources_found"]
            scan.results = result
        
        scan.status = ScanStatus.COMPLETED
        scan.completed_at = datetime.utcnow()
        
    except Exception as e:
        logger.error(f"Error processing scan {scan_id}: {str(e)}")
        scan.status = ScanStatus.FAILED
        scan.error_message = str(e)
    
    db.commit()


@router.post("/detect", response_model=ScanResponse)
async def detect_ai(
    scan_data: ScanCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Detect if text is AI-generated."""
    if scan_data.scan_type != ScanType.AI_DETECTION:
        scan_data.scan_type = ScanType.AI_DETECTION
    
    # Check daily scan limit
    check_daily_scan_limit(current_user, db)
    
    # Validate input quality
    word_count = count_words(scan_data.text)
    if word_count < 50:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please enter at least 50 words for reliable detection")
    if _is_low_content(scan_data.text, 0.7):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Input appears to be gibberish/low-content. Please provide meaningful text (≥70% real words).")

    # Calculate credits needed (word count)
    credits_needed = calculate_credits_needed(scan_data.text, "ai_detection")
    
    # Check if user has enough credits (Pro/Enterprise have unlimited = -1)
    if current_user.credits_balance != -1 and not current_user.has_enough_credits(credits_needed):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient words. Need {credits_needed} words, have {current_user.credits_balance} remaining"
        )
    
    # Get priority based on subscription tier
    priority = get_priority_for_tier(current_user.subscription_tier)
    
    # Create scan record
    scan = Scan(
        user_id=current_user.id,
        scan_type=ScanType.AI_DETECTION,
        input_text=scan_data.text,
        input_length=len(scan_data.text),
        credits_used=credits_needed,
        priority=priority,
        status=ScanStatus.PENDING
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    
    # Deduct credits
    deduct_credits(
        db, current_user, credits_needed,
        f"AI Detection scan #{scan.id}",
        str(scan.id)
    )
    
    # Process scan (synchronously for now, can be async later)
    try:
        scan.status = ScanStatus.PROCESSING
        db.commit()
        
        # Get A/B testing model version assignment
        model_version = ABTestingIntegration.get_model_version_for_user(
            user_id=current_user.id,
            model_type='detector',
            db_session=db
        )
        
        if humanized_hash_service.check_hash(db, scan.input_text):
            result = {
                "ai_probability": 0.0,
                "human_probability": 100.0,
                "confidence_score": 1.0,
                "confidence_level": "high",
                "analysis": {"text_length": len(scan.input_text), "word_count": count_words(scan.input_text)},
                "reliability": "normal",
                "warning": None,
                "textshift_humanized": True,
                "model_used": "hash_bypass",
            }
        else:
            result = ml_service.detect_ai(scan.input_text)
        scan.ai_probability = result["ai_probability"]
        scan.confidence_level = result["confidence_level"]
        
        # Add model version info to results
        result["model_version"] = model_version.get("version_name", "detector_v1.0")
        result["is_test_group"] = model_version.get("is_test_group", False)
        scan.results = result
        scan.status = ScanStatus.COMPLETED
        scan.completed_at = datetime.utcnow()
        
        # Record model usage for A/B testing analytics
        ABTestingIntegration.record_model_usage(
            user_id=current_user.id,
            model_type='detector',
            version_name=model_version.get("version_name", "detector_v1.0"),
            scan_id=scan.id,
            db_session=db
        )
        
    except Exception as e:
        logger.error(f"Error processing scan {scan.id}: {str(e)}")
        scan.status = ScanStatus.FAILED
        scan.error_message = str(e)
    
    db.commit()
    db.refresh(scan)
    
    return ScanResponse.model_validate(scan)


@router.post("/humanize", response_model=ScanResponse)
async def humanize_text(
    scan_data: ScanCreate,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Humanize AI-generated text."""
    if scan_data.scan_type != ScanType.HUMANIZE:
        scan_data.scan_type = ScanType.HUMANIZE
    
    # Check feature access (Free tier cannot use Humanize)
    check_feature_access(current_user, "humanize")
    
    # Check daily scan limit
    check_daily_scan_limit(current_user, db)

    # Validate input quality for humanizer (block pure gibberish)
    if _is_low_content(scan_data.text, 0.7):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Input looks like gibberish/low-content. Humanizer needs meaningful sentences.")
    
    # Calculate credits needed (word count * 2 for humanize)
    credits_needed = calculate_credits_needed(scan_data.text, "humanize")
    
    # Check if user has enough credits (Pro/Enterprise have unlimited = -1)
    if current_user.credits_balance != -1 and not current_user.has_enough_credits(credits_needed):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient words. Need {credits_needed} words, have {current_user.credits_balance} remaining"
        )
    
    # Get priority based on subscription tier
    priority = get_priority_for_tier(current_user.subscription_tier)
    
    # Create scan record
    scan = Scan(
        user_id=current_user.id,
        scan_type=ScanType.HUMANIZE,
        input_text=scan_data.text,
        input_length=len(scan_data.text),
        credits_used=credits_needed,
        priority=priority,
        status=ScanStatus.PENDING
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    
    # Deduct credits
    deduct_credits(
        db, current_user, credits_needed,
        f"Humanize scan #{scan.id}",
        str(scan.id)
    )
    
    # Process scan
    try:
        scan.status = ScanStatus.PROCESSING
        db.commit()
        
        # Get A/B testing model version assignment
        model_version = ABTestingIntegration.get_model_version_for_user(
            user_id=current_user.id,
            model_type='humanizer',
            db_session=db
        )
        
        result = ml_service.humanize(scan.input_text, preserved_indices=scan_data.preserved_indices, mode=scan_data.mode or 'casual')
        scan.output_text = result["humanized_text"]
        
        # Store hash of humanized output for future AI detection bypass
        try:
            humanized_hash_service.store_hash(
                db=db,
                humanized_text=result["humanized_text"],
                user_id=current_user.id,
                scan_id=scan.id
            )
            logger.info(f"Stored humanized text hash for scan {scan.id}")
        except Exception as hash_error:
            logger.warning(f"Failed to store humanized text hash: {hash_error}")
        
        # Add model version info to results
        result["model_version"] = model_version.get("version_name", "humanizer_v1.0")
        result["is_test_group"] = model_version.get("is_test_group", False)
        scan.results = result
        scan.status = ScanStatus.COMPLETED
        scan.completed_at = datetime.utcnow()
        
        # Record model usage for A/B testing analytics
        ABTestingIntegration.record_model_usage(
            user_id=current_user.id,
            model_type='humanizer',
            version_name=model_version.get("version_name", "humanizer_v1.0"),
            scan_id=scan.id,
            db_session=db
        )
        
    except Exception as e:
        logger.error(f"Error processing scan {scan.id}: {str(e)}")
        scan.status = ScanStatus.FAILED
        scan.error_message = str(e)
    
    db.commit()
    db.refresh(scan)
    
    return ScanResponse.model_validate(scan)


@router.post("/plagiarism", response_model=ScanResponse)
async def check_plagiarism(
    scan_data: ScanCreate,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db)
):
    """Check text for plagiarism."""
    if scan_data.scan_type != ScanType.PLAGIARISM:
        scan_data.scan_type = ScanType.PLAGIARISM
    
    # Check feature access (Free tier cannot use Plagiarism)
    check_feature_access(current_user, "plagiarism")
    
    # Check daily scan limit
    check_daily_scan_limit(current_user, db)

    # Validate input quality for plagiarism (avoid nonsense scans)
    if _is_low_content(scan_data.text, 0.7):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Input looks like gibberish/low-content. Provide meaningful text to check for plagiarism.")
    
    # Calculate credits needed (word count * 1.5 for plagiarism)
    credits_needed = calculate_credits_needed(scan_data.text, "plagiarism")
    
    # Check if user has enough credits (Pro/Enterprise have unlimited = -1)
    if current_user.credits_balance != -1 and not current_user.has_enough_credits(credits_needed):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient words. Need {credits_needed} words, have {current_user.credits_balance} remaining"
        )
    
    # Get priority based on subscription tier
    priority = get_priority_for_tier(current_user.subscription_tier)
    
    # Create scan record
    scan = Scan(
        user_id=current_user.id,
        scan_type=ScanType.PLAGIARISM,
        input_text=scan_data.text,
        input_length=len(scan_data.text),
        credits_used=credits_needed,
        priority=priority,
        status=ScanStatus.PENDING
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    
    # Deduct credits
    deduct_credits(
        db, current_user, credits_needed,
        f"Plagiarism scan #{scan.id}",
        str(scan.id)
    )
    
    # Process scan
    try:
        scan.status = ScanStatus.PROCESSING
        db.commit()
        
        # Get A/B testing model version assignment
        model_version = ABTestingIntegration.get_model_version_for_user(
            user_id=current_user.id,
            model_type='plagiarism',
            db_session=db
        )
        
        result = ml_service.check_plagiarism(scan.input_text)
        scan.plagiarism_score = result["plagiarism_score"]
        scan.sources_found = result["sources_found"]
        
        # Add model version info to results
        result["model_version"] = model_version.get("version_name", "plagiarism_v1.0")
        result["is_test_group"] = model_version.get("is_test_group", False)
        scan.results = result
        scan.status = ScanStatus.COMPLETED
        scan.completed_at = datetime.utcnow()
        
        # Record model usage for A/B testing analytics
        ABTestingIntegration.record_model_usage(
            user_id=current_user.id,
            model_type='plagiarism',
            version_name=model_version.get("version_name", "plagiarism_v1.0"),
            scan_id=scan.id,
            db_session=db
        )
        
    except Exception as e:
        logger.error(f"Error processing scan {scan.id}: {str(e)}")
        scan.status = ScanStatus.FAILED
        scan.error_message = str(e)
    
    db.commit()
    db.refresh(scan)
    
    return ScanResponse.model_validate(scan)


@router.get("/history", response_model=ScanListResponse)
async def get_scan_history(
    page: int = 1,
    per_page: int = 20,
    scan_type: Optional[ScanType] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's scan history."""
    query = db.query(Scan).filter(Scan.user_id == current_user.id)
    
    if scan_type:
        query = query.filter(Scan.scan_type == scan_type)
    
    total = query.count()
    scans = query.order_by(Scan.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    
    return ScanListResponse(
        scans=[ScanResponse.model_validate(s) for s in scans],
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific scan by ID."""
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.user_id == current_user.id
    ).first()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    return ScanResponse.model_validate(scan)
