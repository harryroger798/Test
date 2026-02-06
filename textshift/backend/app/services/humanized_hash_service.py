"""
Humanized Text Hash Service

This service manages the storage and lookup of humanized text hashes.
When TextShift humanizes text, we store a SHA256 hash of the output.
When AI detection runs, we first check if the text hash exists.
If found, we return 0% AI probability automatically.

This ensures TextShift's own humanized outputs always pass our detector.
"""

import hashlib
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.humanized_hash import HumanizedTextHash

logger = logging.getLogger(__name__)


class HumanizedHashService:
    """Service for managing humanized text hashes."""
    
    @staticmethod
    def compute_hash(text: str) -> str:
        """
        Compute SHA256 hash of text.
        
        We normalize the text before hashing:
        - Strip leading/trailing whitespace
        - Normalize multiple spaces to single space
        
        This ensures minor formatting differences don't affect the hash.
        """
        # Normalize text
        normalized = ' '.join(text.strip().split())
        # Compute SHA256 hash
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    
    @staticmethod
    def store_hash(
        db: Session,
        humanized_text: str,
        user_id: Optional[int] = None,
        scan_id: Optional[int] = None
    ) -> HumanizedTextHash:
        """
        Store the hash of humanized text in the database.
        
        Args:
            db: Database session
            humanized_text: The humanized text output
            user_id: Optional user ID who created this
            scan_id: Optional scan ID that created this
            
        Returns:
            The created HumanizedTextHash record
        """
        text_hash = HumanizedHashService.compute_hash(humanized_text)
        
        # Check if hash already exists
        existing = db.query(HumanizedTextHash).filter(
            HumanizedTextHash.text_hash == text_hash
        ).first()
        
        if existing:
            logger.debug(f"Hash already exists: {text_hash[:16]}...")
            return existing
        
        # Create new hash record
        hash_record = HumanizedTextHash(
            text_hash=text_hash,
            user_id=user_id,
            scan_id=scan_id,
            created_at=datetime.utcnow()
        )
        
        db.add(hash_record)
        db.commit()
        db.refresh(hash_record)
        
        logger.info(f"Stored humanized text hash: {text_hash[:16]}...")
        return hash_record
    
    @staticmethod
    def check_hash(db: Session, text: str) -> bool:
        """
        Check if the text hash exists in the database.
        
        Args:
            db: Database session
            text: The text to check
            
        Returns:
            True if the hash exists (text was humanized by TextShift), False otherwise
        """
        text_hash = HumanizedHashService.compute_hash(text)
        
        exists = db.query(HumanizedTextHash).filter(
            HumanizedTextHash.text_hash == text_hash
        ).first() is not None
        
        if exists:
            logger.info(f"Found TextShift humanized text hash: {text_hash[:16]}...")
        
        return exists
    
    @staticmethod
    def get_hash_record(db: Session, text: str) -> Optional[HumanizedTextHash]:
        """
        Get the hash record for a text if it exists.
        
        Args:
            db: Database session
            text: The text to check
            
        Returns:
            The HumanizedTextHash record if found, None otherwise
        """
        text_hash = HumanizedHashService.compute_hash(text)
        
        return db.query(HumanizedTextHash).filter(
            HumanizedTextHash.text_hash == text_hash
        ).first()


# Singleton instance for convenience
humanized_hash_service = HumanizedHashService()
