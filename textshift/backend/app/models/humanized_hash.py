from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base


class HumanizedTextHash(Base):
    """
    Store hashes of humanized text outputs.
    
    When TextShift humanizes text, we store a SHA256 hash of the output.
    When AI detection runs, we first check if the text hash exists here.
    If found, we return 0% AI probability automatically.
    
    This ensures TextShift's own humanized outputs always pass our detector.
    """
    __tablename__ = "humanized_text_hashes"

    id = Column(Integer, primary_key=True, index=True)
    
    # SHA256 hash of the humanized text (64 chars)
    # unique=True creates an index automatically
    text_hash = Column(String(64), unique=True, nullable=False)
    
    # Optional: link to user who created it
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Optional: link to the scan that created it
    scan_id = Column(Integer, ForeignKey("scans.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
