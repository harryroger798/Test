from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.services.email_service import email_service
from app.core.captcha import verify_captcha_token
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contact", tags=["Contact"])


class ContactSalesRequest(BaseModel):
    name: str
    email: EmailStr
    company: str = ""
    phone: str = ""
    message: str
    plan_interest: str = "Enterprise"
    captcha_token: Optional[str] = None


class ContactSupportRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str = ""
    message: str
    captcha_token: Optional[str] = None


class ContactSalesResponse(BaseModel):
    success: bool
    message: str


@router.post("/sales", response_model=ContactSalesResponse)
async def contact_sales(request: ContactSalesRequest):
    """Submit a contact sales inquiry for Enterprise plan."""
    if not await verify_captcha_token(request.captcha_token or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed. Please try again."
        )

    try:
        # Send email to sales team (harryroger798@gmail.com)
        subject = f"TextShift Enterprise Inquiry from {request.name}"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">New Enterprise Inquiry</h1>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
                <h2 style="color: #111827;">Contact Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Name:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Company:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.company or 'Not provided'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Phone:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.phone or 'Not provided'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Plan Interest:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.plan_interest.title()}</td>
                    </tr>
                </table>
                
                <h2 style="color: #111827; margin-top: 30px;">Message</h2>
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p style="color: #374151; line-height: 1.6; margin: 0;">{request.message}</p>
                </div>
                
                <div style="margin-top: 30px; padding: 20px; background: #ecfdf5; border-radius: 8px;">
                    <p style="color: #065f46; margin: 0;">
                        <strong>Action Required:</strong> Please respond to this inquiry within 24 hours.
                    </p>
                </div>
            </div>
            <div style="padding: 20px; text-align: center; background: #111827;">
                <p style="color: #9ca3af; margin: 0;">TextShift - AI Content Platform</p>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        New Enterprise Inquiry
        
        Name: {request.name}
        Email: {request.email}
        Company: {request.company or 'Not provided'}
        Phone: {request.phone or 'Not provided'}
        Plan Interest: {request.plan_interest.title()}
        
        Message:
        {request.message}
        
        Please respond to this inquiry within 24 hours.
        """
        
        # Send to sales team
        email_service.send_email(
            to_email="harryroger798@gmail.com",
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        
        # Send confirmation to the user
        confirmation_subject = "Thank you for contacting TextShift"
        confirmation_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">Thank You!</h1>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi {request.name},
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                    Thank you for your interest in TextShift Enterprise! We've received your inquiry and our team will get back to you within 24 hours.
                </p>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                    In the meantime, feel free to explore our platform with a free account to see how TextShift can help your organization.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://textshift.org/register" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        Create Free Account
                    </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">
                    Best regards,<br>
                    The TextShift Team
                </p>
            </div>
            <div style="padding: 20px; text-align: center; background: #111827;">
                <p style="color: #9ca3af; margin: 0;">TextShift - AI Content Platform</p>
            </div>
        </body>
        </html>
        """
        
        email_service.send_email(
            to_email=request.email,
            subject=confirmation_subject,
            html_content=confirmation_html,
            text_content=f"Hi {request.name}, Thank you for your interest in TextShift Enterprise! We've received your inquiry and our team will get back to you within 24 hours."
        )
        
        logger.info(f"Contact sales inquiry received from {request.email}")
        
        return ContactSalesResponse(
            success=True,
            message="Thank you for your inquiry! Our team will contact you within 24 hours."
        )
        
    except Exception as e:
        logger.error(f"Error processing contact sales request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit inquiry. Please try again or email us directly at harryroger798@gmail.com"
        )


@router.post("/support", response_model=ContactSalesResponse)
async def contact_support(request: ContactSupportRequest):
    """Submit a general support / contact inquiry."""
    if not await verify_captcha_token(request.captcha_token or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed. Please try again."
        )

    try:
        subject = f"TextShift Support: {request.subject or 'General Inquiry'} from {request.name}"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">New Support Message</h1>
            </div>
            <div style="padding: 30px; background: #f9fafb;">
                <h2 style="color: #111827;">Contact Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Name:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Email:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Subject:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{request.subject or 'General Inquiry'}</td>
                    </tr>
                </table>
                <h2 style="color: #111827; margin-top: 30px;">Message</h2>
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p style="color: #374151; line-height: 1.6; margin: 0;">{request.message}</p>
                </div>
            </div>
            <div style="padding: 20px; text-align: center; background: #111827;">
                <p style="color: #9ca3af; margin: 0;">TextShift - AI Content Platform</p>
            </div>
        </body>
        </html>
        """

        email_service.send_email(
            to_email="harryroger798@gmail.com",
            subject=subject,
            html_content=html_content,
            text_content=f"Name: {request.name}\\nEmail: {request.email}\\nSubject: {request.subject}\\nMessage: {request.message}"
        )

        logger.info(f"Support inquiry received from {request.email}")

        return ContactSalesResponse(
            success=True,
            message="Thank you for your message! We'll get back to you within 24-48 hours."
        )

    except Exception as e:
        logger.error(f"Error processing support request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message. Please email us directly at support@mail.textshift.org"
        )
