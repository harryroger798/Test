from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.user import User
from app.models.credit import CreditTransaction, TransactionType
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


def count_words(text: str) -> int:
    """Count words in text."""
    return len(text.split())


def calculate_credits_needed(text: str, scan_type: str) -> int:
    """Calculate credits (words) needed based on text length and scan type.
    
    Credits are now word-based:
    - AI Detection: 1 word = 1 credit
    - Humanize: 1 word = 2 credits (more processing intensive)
    - Plagiarism: 1 word = 1.5 credits (rounded up)
    
    Minimum: 50 words per scan
    """
    word_count = count_words(text)
    
    # Multiplier based on scan type
    if scan_type == "ai_detection":
        multiplier = 1.0
    elif scan_type == "humanize":
        multiplier = 2.0
    elif scan_type == "plagiarism":
        multiplier = 1.5
    else:
        multiplier = 1.0
    
    # Calculate credits (minimum 50 credits per scan)
    credits = max(50, int(word_count * multiplier))
    return credits


def deduct_credits(db: Session, user: User, amount: int, description: str, reference_id: str = None) -> bool:
    """Deduct credits from user account and log transaction.
    
    Uses atomic SQL UPDATE with WHERE clause to prevent race conditions
    on concurrent deductions.
    """
    if amount <= 0:
        logger.warning("Invalid credit deduction amount: %s", amount)
        return False
    if user.credits_balance == -1:
        result = db.execute(
            text(
                "UPDATE users SET credits_used_total = credits_used_total + :amount "
                "WHERE id = :user_id AND credits_balance = -1"
            ),
            {"amount": amount, "user_id": user.id}
        )
        if result.rowcount == 0:
            db.rollback()
            return False
        transaction = CreditTransaction(
            user_id=user.id,
            transaction_type=TransactionType.USAGE,
            amount=-amount,
            balance_after=-1,
            description=description,
            reference_id=reference_id
        )
        db.add(transaction)
        db.commit()
        db.refresh(user)
        logger.info(f"Deducted {amount} credits from unlimited user {user.id}.")
        return True

    result = db.execute(
        text(
            "UPDATE users SET credits_balance = credits_balance - :amount, "
            "credits_used_total = credits_used_total + :amount "
            "WHERE id = :user_id AND credits_balance >= :amount"
        ),
        {"amount": amount, "user_id": user.id}
    )
    
    if result.rowcount == 0:
        db.rollback()
        return False
    
    db.refresh(user)
    
    transaction = CreditTransaction(
        user_id=user.id,
        transaction_type=TransactionType.USAGE,
        amount=-amount,
        balance_after=user.credits_balance,
        description=description,
        reference_id=reference_id
    )
    db.add(transaction)
    db.commit()
    
    logger.info(f"Deducted {amount} credits from user {user.id}. New balance: {user.credits_balance}")
    return True


def add_credits(db: Session, user: User, amount: int, transaction_type: TransactionType, description: str, reference_id: str = None):
    """Add credits to user account and log transaction."""
    user.add_credits(amount)
    
    # Log transaction
    transaction = CreditTransaction(
        user_id=user.id,
        transaction_type=transaction_type,
        amount=amount,
        balance_after=user.credits_balance,
        description=description,
        reference_id=reference_id
    )
    db.add(transaction)
    db.commit()
    
    logger.info(f"Added {amount} credits to user {user.id}. New balance: {user.credits_balance}")


def get_credits_per_tier(tier: str) -> int:
    """Get monthly credits (words) for a subscription tier.
    Returns -1 for unlimited tiers (Pro, Enterprise).
    """
    tier_credits = {
        "Free": settings.FREE_TIER_CREDITS,  # 5,000 words
        "Starter": settings.STARTER_TIER_CREDITS,  # 25,000 words
        "Pro": settings.PRO_TIER_CREDITS,  # -1 (Unlimited)
        "Enterprise": settings.ENTERPRISE_TIER_CREDITS  # -1 (Unlimited)
    }
    return tier_credits.get(tier.capitalize(), settings.FREE_TIER_CREDITS)


def get_daily_scan_limit(tier: str) -> int:
    """Get daily scan limit for a subscription tier.
    Returns -1 for unlimited.
    """
    limits = {
        "Free": settings.FREE_DAILY_SCANS,  # 10
        "Starter": settings.STARTER_DAILY_SCANS,  # 100
        "Pro": settings.PRO_DAILY_SCANS,  # 500
        "Enterprise": settings.ENTERPRISE_DAILY_SCANS  # -1 (Unlimited)
    }
    return limits.get(tier.capitalize(), settings.FREE_DAILY_SCANS)
