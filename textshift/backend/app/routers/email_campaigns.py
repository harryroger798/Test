from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.core.auth import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.email_campaign import (
    EmailCampaign, EmailSend, EmailType, CampaignStatus, TargetAudience
)
from app.services.email_campaign_service import email_campaign_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/email-campaigns", tags=["email-campaigns"])


# ==================== SCHEMAS ====================

class CampaignCreate(BaseModel):
    name: str
    subject: str
    preview_text: Optional[str] = None
    email_type: EmailType
    headline: str
    body_content: str
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    target_audience: TargetAudience = TargetAudience.ALL_USERS
    scheduled_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    preview_text: Optional[str] = None
    headline: Optional[str] = None
    body_content: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    target_audience: Optional[TargetAudience] = None
    scheduled_at: Optional[datetime] = None


class CampaignResponse(BaseModel):
    id: int
    name: str
    subject: str
    preview_text: Optional[str]
    email_type: str
    headline: str
    body_content: str
    cta_text: Optional[str]
    cta_url: Optional[str]
    target_audience: str
    status: str
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    total_recipients: int
    emails_sent: int
    emails_opened: int
    emails_clicked: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SendTestEmailRequest(BaseModel):
    email_type: EmailType
    to_email: str
    # For notification emails
    scan_type: Optional[str] = None
    result_summary: Optional[str] = None
    credits_used: Optional[int] = None
    current_balance: Optional[int] = None
    plan_name: Optional[str] = None
    days_remaining: Optional[int] = None
    # For marketing emails
    feature_name: Optional[str] = None
    feature_description: Optional[str] = None
    feature_benefits: Optional[List[str]] = None
    promo_title: Optional[str] = None
    promo_description: Optional[str] = None
    promo_code: Optional[str] = None
    discount_amount: Optional[str] = None
    expiry_date: Optional[str] = None
    tip_title: Optional[str] = None
    tips: Optional[List[dict]] = None
    update_title: Optional[str] = None
    update_description: Optional[str] = None
    updates: Optional[List[str]] = None


# ==================== ENDPOINTS ====================

@router.get("/types")
async def get_email_types(
    current_user: User = Depends(get_current_admin_user)
):
    """Get all available email types with descriptions."""
    return {
        "notification_types": [
            {"type": "scan_complete", "name": "Scan Complete", "description": "Sent when a scan finishes"},
            {"type": "low_credits", "name": "Low Credits Warning", "description": "Sent when credits drop below 1,000"},
            {"type": "weekly_summary", "name": "Weekly Summary", "description": "Weekly usage digest"},
            {"type": "subscription_expiring", "name": "Subscription Expiring", "description": "7 days before subscription ends"},
            {"type": "password_changed", "name": "Password Changed", "description": "Security notification"},
        ],
        "marketing_types": [
            {"type": "new_feature", "name": "New Feature", "description": "Announce new features"},
            {"type": "promotional", "name": "Promotional", "description": "Special offers and discounts"},
            {"type": "tips_tricks", "name": "Tips & Tricks", "description": "Best practices and tips"},
            {"type": "product_update", "name": "Product Update", "description": "Platform improvements"},
        ],
        "target_audiences": [
            {"type": "all_users", "name": "All Users"},
            {"type": "free_tier", "name": "Free Tier Only"},
            {"type": "starter_tier", "name": "Starter Tier Only"},
            {"type": "pro_tier", "name": "Pro Tier Only"},
            {"type": "enterprise_tier", "name": "Enterprise Tier Only"},
            {"type": "active_users", "name": "Active Users (30 days)"},
            {"type": "inactive_users", "name": "Inactive Users (30+ days)"},
        ]
    }


@router.get("/", response_model=List[CampaignResponse])
async def list_campaigns(
    status: Optional[CampaignStatus] = None,
    email_type: Optional[EmailType] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all email campaigns."""
    query = db.query(EmailCampaign)
    
    if status:
        query = query.filter(EmailCampaign.status == status)
    if email_type:
        query = query.filter(EmailCampaign.email_type == email_type)
    
    campaigns = query.order_by(EmailCampaign.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        CampaignResponse(
            id=c.id,
            name=c.name,
            subject=c.subject,
            preview_text=c.preview_text,
            email_type=c.email_type.value,
            headline=c.headline,
            body_content=c.body_content,
            cta_text=c.cta_text,
            cta_url=c.cta_url,
            target_audience=c.target_audience.value,
            status=c.status.value,
            scheduled_at=c.scheduled_at,
            sent_at=c.sent_at,
            total_recipients=c.total_recipients,
            emails_sent=c.emails_sent,
            emails_opened=c.emails_opened,
            emails_clicked=c.emails_clicked,
            created_at=c.created_at,
            updated_at=c.updated_at
        )
        for c in campaigns
    ]


@router.post("/", response_model=CampaignResponse)
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new email campaign."""
    campaign = EmailCampaign(
        name=campaign_data.name,
        subject=campaign_data.subject,
        preview_text=campaign_data.preview_text,
        email_type=campaign_data.email_type,
        headline=campaign_data.headline,
        body_content=campaign_data.body_content,
        cta_text=campaign_data.cta_text,
        cta_url=campaign_data.cta_url,
        target_audience=campaign_data.target_audience,
        scheduled_at=campaign_data.scheduled_at,
        status=CampaignStatus.SCHEDULED if campaign_data.scheduled_at else CampaignStatus.DRAFT,
        created_by=current_user.id
    )
    
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    
    return CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        subject=campaign.subject,
        preview_text=campaign.preview_text,
        email_type=campaign.email_type.value,
        headline=campaign.headline,
        body_content=campaign.body_content,
        cta_text=campaign.cta_text,
        cta_url=campaign.cta_url,
        target_audience=campaign.target_audience.value,
        status=campaign.status.value,
        scheduled_at=campaign.scheduled_at,
        sent_at=campaign.sent_at,
        total_recipients=campaign.total_recipients,
        emails_sent=campaign.emails_sent,
        emails_opened=campaign.emails_opened,
        emails_clicked=campaign.emails_clicked,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at
    )


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific campaign."""
    campaign = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        subject=campaign.subject,
        preview_text=campaign.preview_text,
        email_type=campaign.email_type.value,
        headline=campaign.headline,
        body_content=campaign.body_content,
        cta_text=campaign.cta_text,
        cta_url=campaign.cta_url,
        target_audience=campaign.target_audience.value,
        status=campaign.status.value,
        scheduled_at=campaign.scheduled_at,
        sent_at=campaign.sent_at,
        total_recipients=campaign.total_recipients,
        emails_sent=campaign.emails_sent,
        emails_opened=campaign.emails_opened,
        emails_clicked=campaign.emails_clicked,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at
    )


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: int,
    campaign_data: CampaignUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a campaign (only if draft or scheduled)."""
    campaign = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status not in [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED]:
        raise HTTPException(status_code=400, detail="Cannot edit a campaign that has been sent or is sending")
    
    for field, value in campaign_data.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    
    campaign.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(campaign)
    
    return CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        subject=campaign.subject,
        preview_text=campaign.preview_text,
        email_type=campaign.email_type.value,
        headline=campaign.headline,
        body_content=campaign.body_content,
        cta_text=campaign.cta_text,
        cta_url=campaign.cta_url,
        target_audience=campaign.target_audience.value,
        status=campaign.status.value,
        scheduled_at=campaign.scheduled_at,
        sent_at=campaign.sent_at,
        total_recipients=campaign.total_recipients,
        emails_sent=campaign.emails_sent,
        emails_opened=campaign.emails_opened,
        emails_clicked=campaign.emails_clicked,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at
    )


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a campaign (only if draft)."""
    campaign = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status != CampaignStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Can only delete draft campaigns")
    
    db.delete(campaign)
    db.commit()
    
    return {"message": "Campaign deleted successfully"}


@router.post("/{campaign_id}/send")
async def send_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Send a campaign immediately."""
    campaign = db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status not in [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED]:
        raise HTTPException(status_code=400, detail="Campaign has already been sent or is currently sending")
    
    result = email_campaign_service.send_campaign(db, campaign)
    
    return {
        "message": "Campaign sent successfully",
        "total_recipients": result["total_recipients"],
        "emails_sent": result["emails_sent"],
        "success_rate": f"{result['success_rate']:.1f}%"
    }


@router.post("/send-test")
async def send_test_email(
    request: SendTestEmailRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Send a test email of any type to a specific address."""
    success = False
    
    try:
        if request.email_type == EmailType.SCAN_COMPLETE:
            success = email_campaign_service.send_scan_complete_email(
                to_email=request.to_email,
                scan_type=request.scan_type or "ai_detection",
                result_summary=request.result_summary or "99.5% AI Probability",
                credits_used=request.credits_used or 150,
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.LOW_CREDITS:
            success = email_campaign_service.send_low_credits_email(
                to_email=request.to_email,
                current_balance=request.current_balance or 500,
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.WEEKLY_SUMMARY:
            success = email_campaign_service.send_weekly_summary_email(
                to_email=request.to_email,
                total_scans=25,
                ai_detections=10,
                humanizations=8,
                plagiarism_checks=7,
                credits_used=5000,
                credits_remaining=20000,
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.SUBSCRIPTION_EXPIRING:
            success = email_campaign_service.send_subscription_expiring_email(
                to_email=request.to_email,
                plan_name=request.plan_name or "Pro",
                days_remaining=request.days_remaining or 7,
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.PASSWORD_CHANGED:
            success = email_campaign_service.send_password_changed_email(
                to_email=request.to_email,
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.NEW_FEATURE:
            success = email_campaign_service.send_new_feature_email(
                to_email=request.to_email,
                feature_name=request.feature_name or "Self-Learning AI",
                feature_description=request.feature_description or "Our AI models now learn from your feedback to provide more accurate results over time.",
                feature_benefits=request.feature_benefits or [
                    "Improved accuracy with every scan",
                    "Personalized results based on your usage",
                    "Automatic model updates weekly"
                ],
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.PROMOTIONAL:
            success = email_campaign_service.send_promotional_email(
                to_email=request.to_email,
                promo_title=request.promo_title or "50% Off Pro Plan",
                promo_description=request.promo_description or "Upgrade to Pro and get 50% off your first month. Limited time offer!",
                promo_code=request.promo_code or "SAVE50",
                discount_amount=request.discount_amount or "50% OFF",
                expiry_date=request.expiry_date or "February 28, 2026",
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.TIPS_TRICKS:
            success = email_campaign_service.send_tips_email(
                to_email=request.to_email,
                tip_title=request.tip_title or "5 Ways to Get Better Results",
                tips=request.tips or [
                    {"title": "Use longer text samples", "description": "AI detection works best with 100+ words for accurate analysis."},
                    {"title": "Check plagiarism before humanizing", "description": "Ensure your content is original before making it undetectable."},
                    {"title": "Review humanized output", "description": "Always review and tweak the humanized text to match your voice."}
                ],
                full_name=current_user.full_name
            )
        
        elif request.email_type == EmailType.PRODUCT_UPDATE:
            success = email_campaign_service.send_product_update_email(
                to_email=request.to_email,
                update_title=request.update_title or "January 2026 Updates",
                update_description=request.update_description or "We've been busy improving TextShift. Here's what's new this month.",
                updates=request.updates or [
                    "Faster AI detection with 99.5% accuracy",
                    "New humanizer model with better natural language",
                    "Improved plagiarism detection with more sources",
                    "Admin dashboard with email campaign management"
                ],
                full_name=current_user.full_name
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown email type: {request.email_type}")
        
        if success:
            return {"message": f"Test email sent successfully to {request.to_email}", "email_type": request.email_type.value}
        else:
            raise HTTPException(status_code=500, detail="Failed to send test email")
    
    except Exception as e:
        logger.error(f"Failed to send test email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/overview")
async def get_email_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get overall email campaign statistics."""
    total_campaigns = db.query(EmailCampaign).count()
    sent_campaigns = db.query(EmailCampaign).filter(EmailCampaign.status == CampaignStatus.SENT).count()
    total_emails_sent = db.query(EmailCampaign).with_entities(
        func.sum(EmailCampaign.emails_sent)
    ).scalar() or 0
    total_opens = db.query(EmailCampaign).with_entities(
        func.sum(EmailCampaign.emails_opened)
    ).scalar() or 0
    total_clicks = db.query(EmailCampaign).with_entities(
        func.sum(EmailCampaign.emails_clicked)
    ).scalar() or 0
    
    return {
        "total_campaigns": total_campaigns,
        "sent_campaigns": sent_campaigns,
        "draft_campaigns": total_campaigns - sent_campaigns,
        "total_emails_sent": total_emails_sent,
        "total_opens": total_opens,
        "total_clicks": total_clicks,
        "open_rate": f"{(total_opens / total_emails_sent * 100):.1f}%" if total_emails_sent > 0 else "0%",
        "click_rate": f"{(total_clicks / total_emails_sent * 100):.1f}%" if total_emails_sent > 0 else "0%"
    }


# ==================== EMAIL TRACKING ENDPOINTS ====================

# Create a separate router for public tracking endpoints (no auth required)
tracking_router = APIRouter(prefix="/api/v1/email", tags=["email-tracking"])


@tracking_router.get("/track/open/{tracking_id}")
async def track_email_open(
    tracking_id: str,
    db: Session = Depends(get_db)
):
    """
    Track email open via 1x1 pixel image.
    Returns a transparent 1x1 GIF image.
    """
    from fastapi.responses import Response
    
    # Find the email send record
    email_send = db.query(EmailSend).filter(
        EmailSend.tracking_id == tracking_id
    ).first()
    
    if email_send and not email_send.opened_at:
        # Record the open
        email_send.opened_at = datetime.utcnow()
        
        # Update campaign stats
        if email_send.campaign_id:
            campaign = db.query(EmailCampaign).filter(
                EmailCampaign.id == email_send.campaign_id
            ).first()
            if campaign:
                campaign.emails_opened = (campaign.emails_opened or 0) + 1
        
        db.commit()
        logger.info(f"Email open tracked: {tracking_id}")
    
    # Return a 1x1 transparent GIF
    # This is the smallest valid GIF (43 bytes)
    transparent_gif = bytes([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61,  # GIF89a
        0x01, 0x00, 0x01, 0x00,              # 1x1 dimensions
        0x80, 0x00, 0x00,                    # Global color table
        0xff, 0xff, 0xff,                    # White
        0x00, 0x00, 0x00,                    # Black
        0x21, 0xf9, 0x04,                    # Graphic control extension
        0x01, 0x00, 0x00, 0x00, 0x00,        # Transparent
        0x2c, 0x00, 0x00, 0x00, 0x00,        # Image descriptor
        0x01, 0x00, 0x01, 0x00, 0x00,        # 1x1
        0x02, 0x02, 0x44, 0x01, 0x00,        # Image data
        0x3b                                  # Trailer
    ])
    
    return Response(
        content=transparent_gif,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@tracking_router.get("/track/click/{tracking_id}")
async def track_email_click(
    tracking_id: str,
    url: str,
    db: Session = Depends(get_db)
):
    """
    Track email link click and redirect to destination URL.
    """
    from fastapi.responses import RedirectResponse
    
    # Find the email send record
    email_send = db.query(EmailSend).filter(
        EmailSend.tracking_id == tracking_id
    ).first()
    
    if email_send and not email_send.clicked_at:
        # Record the click
        email_send.clicked_at = datetime.utcnow()
        
        # Also record open if not already recorded
        if not email_send.opened_at:
            email_send.opened_at = datetime.utcnow()
            if email_send.campaign_id:
                campaign = db.query(EmailCampaign).filter(
                    EmailCampaign.id == email_send.campaign_id
                ).first()
                if campaign:
                    campaign.emails_opened = (campaign.emails_opened or 0) + 1
        
        # Update campaign click stats
        if email_send.campaign_id:
            campaign = db.query(EmailCampaign).filter(
                EmailCampaign.id == email_send.campaign_id
            ).first()
            if campaign:
                campaign.emails_clicked = (campaign.emails_clicked or 0) + 1
        
        db.commit()
        logger.info(f"Email click tracked: {tracking_id} -> {url}")
    
    # Redirect to the destination URL
    return RedirectResponse(url=url, status_code=302)
