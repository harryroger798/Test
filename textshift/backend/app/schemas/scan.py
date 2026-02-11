from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.scan import ScanType, ScanStatus


class ScanCreate(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000)
    scan_type: ScanType
    mode: Optional[str] = Field(default='casual', pattern='^(academic|professional|casual)$')


class AIDetectionResult(BaseModel):
    ai_probability: float
    human_probability: float
    confidence_level: str  # very_low, low, medium, high, very_high
    confidence_score: int  # 1-10
    analysis: Dict[str, Any]
    sentence_analysis: Optional[List[Dict[str, Any]]] = None


class HumanizeResult(BaseModel):
    original_text: str
    humanized_text: str
    changes_made: int
    ai_score_before: Optional[float] = None
    ai_score_after: Optional[float] = None


class PlagiarismSource(BaseModel):
    url: str
    title: str
    similarity_score: float
    matched_text: str


class PlagiarismResult(BaseModel):
    plagiarism_score: float
    risk_level: str  # minimal, low, medium, high
    sources_found: int
    sources: List[PlagiarismSource]
    original_content_percentage: float


class ScanResponse(BaseModel):
    id: int
    scan_type: ScanType
    status: ScanStatus
    input_text: str
    input_length: int
    output_text: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    ai_probability: Optional[float] = None
    confidence_level: Optional[str] = None
    plagiarism_score: Optional[float] = None
    sources_found: Optional[int] = None
    credits_used: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class ScanListResponse(BaseModel):
    scans: List[ScanResponse]
    total: int
    page: int
    per_page: int
