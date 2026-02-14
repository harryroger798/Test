import requests
import secrets
from datetime import datetime
from typing import Optional
from app.core.config import settings


def get_base_email_template(content: str, preview_text: str = "") -> str:
    """Generate a professional, mobile-optimized email template with solid dark colors for maximum email client compatibility."""
    current_year = datetime.now().year
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>TextShift</title>
        <!--[if mso]>
        <style type="text/css">
            body, table, td {{font-family: Arial, Helvetica, sans-serif !important;}}
        </style>
        <![endif]-->
        <style>
            body, table, td, p, a, li, blockquote {{
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }}
            table, td {{
                mso-table-lspace: 0pt;
                mso-table-rspace: 0pt;
            }}
            img {{
                -ms-interpolation-mode: bicubic;
                border: 0;
                height: auto;
                line-height: 100%;
                outline: none;
                text-decoration: none;
            }}
            body {{
                margin: 0 !important;
                padding: 0 !important;
                background-color: #0a0a0a;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }}
            .button-td {{
                padding: 0 20px;
            }}
            .button-a {{
                background-color: #10b981;
                color: #000000 !important;
                font-size: 16px;
                font-weight: 600;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 50px;
                display: inline-block;
                text-align: center;
            }}
            @media only screen and (max-width: 600px) {{
                .container {{
                    width: 100% !important;
                    padding: 0 12px !important;
                }}
                .content-cell {{
                    padding: 24px 16px !important;
                }}
                .button-td {{
                    padding: 0 16px !important;
                }}
                .button-a {{
                    display: block !important;
                    width: 100% !important;
                    padding: 14px 20px !important;
                    box-sizing: border-box !important;
                }}
            }}
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a;" bgcolor="#0a0a0a">
        <div style="display: none; max-height: 0; overflow: hidden;">
            {preview_text}
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;" bgcolor="#0a0a0a">
            <tr>
                <td align="center" style="padding: 24px 12px;" bgcolor="#0a0a0a">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="container" style="max-width: 560px; width: 100%;">
                        <tr>
                            <td align="center" style="padding: 0 0 24px 0;" bgcolor="#0a0a0a">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                        <td style="vertical-align: middle; padding-right: 10px;">
                                            <div style="width: 12px; height: 12px; background-color: #10b981; border-radius: 50%;"></div>
                                        </td>
                                        <td style="vertical-align: middle;">
                                            <span style="font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: 2px;">TextShift</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0 8px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; overflow: hidden;" bgcolor="#1a1a1a">
                                    {content}
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 24px 16px;" bgcolor="#0a0a0a">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                        <td align="center" style="padding-bottom: 12px;">
                                            <a href="https://textshift.org" style="color: #10b981; text-decoration: none; font-size: 13px; margin: 0 8px;">Website</a>
                                            <span style="color: #4b5563;">|</span>
                                            <a href="https://textshift.org/pricing" style="color: #10b981; text-decoration: none; font-size: 13px; margin: 0 8px;">Pricing</a>
                                            <span style="color: #4b5563;">|</span>
                                            <a href="mailto:support@mail.textshift.org" style="color: #10b981; text-decoration: none; font-size: 13px; margin: 0 8px;">Support</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center">
                                            <p style="margin: 0; color: #6b7280; font-size: 11px; line-height: 1.5;">
                                                &copy; {current_year} TextShift. All rights reserved.<br>
                                                AI Content Detection, Humanization &amp; Plagiarism Checking
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


class EmailService:
    def __init__(self):
        self.api_key = settings.MAILGUN_API_KEY
        self.domain = settings.MAILGUN_DOMAIN
        self.from_email = f"{settings.MAILGUN_FROM_NAME} <{settings.MAILGUN_FROM_EMAIL}>"
        self.base_url = f"https://api.mailgun.net/v3/{self.domain}"
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        try:
            response = requests.post(
                f"{self.base_url}/messages",
                auth=("api", self.api_key),
                data={
                    "from": self.from_email,
                    "to": to_email,
                    "subject": subject,
                    "html": html_content,
                    "text": text_content or html_content
                },
                timeout=30
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Email sending failed: {e}")
            return False
    
    def send_verification_email(self, to_email: str, token: str) -> bool:
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        
        content = f"""
        <tr>
            <td class="content-cell" style="padding: 48px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                                <span style="font-size: 28px;">✉️</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #ffffff; text-align: center; line-height: 1.3;">
                    Verify Your Email
                </h1>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #9ca3af; text-align: center; line-height: 1.6;">
                    Thanks for signing up for TextShift! Please verify your email address to unlock all features and start using our AI content tools.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center">
                            <a href="{verification_url}" class="button" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 50px; text-align: center;">
                                Verify Email Address
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 32px 0 0 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.6;">
                    Or copy this link into your browser:<br>
                    <a href="{verification_url}" style="color: #10b981; word-break: break-all;">{verification_url}</a>
                </p>
                <div style="margin-top: 32px; padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 12px; border-left: 4px solid #10b981;">
                    <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                        <strong style="color: #ffffff;">Note:</strong> This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
                    </p>
                </div>
            </td>
        </tr>
        """
        
        html_content = get_base_email_template(content, "Verify your email to start using TextShift")
        
        text_content = f"""
Verify Your Email

Thanks for signing up for TextShift! Please verify your email address to unlock all features.

Click here to verify: {verification_url}

This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.

- The TextShift Team
        """
        
        return self.send_email(
            to_email=to_email,
            subject="Verify Your Email - TextShift",
            html_content=html_content,
            text_content=text_content
        )
    
    def send_password_reset_email(self, to_email: str, token: str) -> bool:
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        content = f"""
        <tr>
            <td class="content-cell" style="padding: 48px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <div style="width: 64px; height: 64px; background: rgba(251, 191, 36, 0.15); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                                <span style="font-size: 28px;">🔐</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #ffffff; text-align: center; line-height: 1.3;">
                    Reset Your Password
                </h1>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #9ca3af; text-align: center; line-height: 1.6;">
                    We received a request to reset your password. Click the button below to create a new password for your account.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center">
                            <a href="{reset_url}" class="button" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 50px; text-align: center;">
                                Reset Password
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 32px 0 0 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.6;">
                    Or copy this link into your browser:<br>
                    <a href="{reset_url}" style="color: #10b981; word-break: break-all;">{reset_url}</a>
                </p>
                <div style="margin-top: 32px; padding: 16px; background: rgba(251, 191, 36, 0.1); border-radius: 12px; border-left: 4px solid #fbbf24;">
                    <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                        <strong style="color: #fbbf24;">Security Notice:</strong> This link expires in 30 minutes. If you didn't request this reset, please ignore this email.
                    </p>
                </div>
            </td>
        </tr>
        """
        
        html_content = get_base_email_template(content, "Reset your TextShift password")
        
        text_content = f"""
Reset Your Password

We received a request to reset your password. Click the link below to create a new password:

{reset_url}

IMPORTANT: This link expires in 30 minutes for security reasons.

If you didn't request this reset, please ignore this email.

- The TextShift Team
        """
        
        return self.send_email(
            to_email=to_email,
            subject="Reset Your Password - TextShift",
            html_content=html_content,
            text_content=text_content
        )
    
    def send_welcome_email(self, to_email: str, full_name: Optional[str] = None) -> bool:
        name = full_name.split()[0] if full_name else "there"
        dashboard_url = f"{settings.FRONTEND_URL}/dashboard"
        
        content = f"""
        <tr>
            <td class="content-cell" style="padding: 48px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                                <span style="font-size: 28px;">🎉</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #ffffff; text-align: center; line-height: 1.3;">
                    Welcome to TextShift, {name}!
                </h1>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #9ca3af; text-align: center; line-height: 1.6;">
                    You're all set! Your account is ready with <strong style="color: #10b981;">5,000 free words</strong> to explore our powerful AI content tools.
                </p>
                
                <!-- Features -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px;">
                    <tr>
                        <td style="padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; margin-bottom: 12px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="48" style="vertical-align: top;">
                                        <div style="width: 40px; height: 40px; background: rgba(16, 185, 129, 0.15); border-radius: 10px; text-align: center; line-height: 40px;">
                                            <span style="font-size: 18px;">🔍</span>
                                        </div>
                                    </td>
                                    <td style="padding-left: 16px; vertical-align: top;">
                                        <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #ffffff;">AI Detection</h3>
                                        <p style="margin: 0; font-size: 14px; color: #9ca3af;">Detect AI-generated content with 99% accuracy</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td style="height: 12px;"></td></tr>
                    <tr>
                        <td style="padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="48" style="vertical-align: top;">
                                        <div style="width: 40px; height: 40px; background: rgba(168, 85, 247, 0.15); border-radius: 10px; text-align: center; line-height: 40px;">
                                            <span style="font-size: 18px;">✨</span>
                                        </div>
                                    </td>
                                    <td style="padding-left: 16px; vertical-align: top;">
                                        <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #ffffff;">Text Humanizer</h3>
                                        <p style="margin: 0; font-size: 14px; color: #9ca3af;">Transform robotic text into authentic content</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td style="height: 12px;"></td></tr>
                    <tr>
                        <td style="padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td width="48" style="vertical-align: top;">
                                        <div style="width: 40px; height: 40px; background: rgba(59, 130, 246, 0.15); border-radius: 10px; text-align: center; line-height: 40px;">
                                            <span style="font-size: 18px;">📄</span>
                                        </div>
                                    </td>
                                    <td style="padding-left: 16px; vertical-align: top;">
                                        <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #ffffff;">Plagiarism Checker</h3>
                                        <p style="margin: 0; font-size: 14px; color: #9ca3af;">Scan against billions of sources in real-time</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center">
                            <a href="{dashboard_url}" class="button" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 50px; text-align: center;">
                                Go to Dashboard
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 32px 0 0 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6;">
                    Need help? Reply to this email or visit our <a href="https://textshift.org" style="color: #10b981; text-decoration: none;">website</a>.
                </p>
            </td>
        </tr>
        """
        
        html_content = get_base_email_template(content, f"Welcome to TextShift, {name}! Your account is ready.")
        
        text_content = f"""
Welcome to TextShift, {name}!

You're all set! Your account is ready with 5,000 free words to explore our powerful AI content tools.

What you can do:
- AI Detection: Detect AI-generated content with 99% accuracy
- Text Humanizer: Transform robotic text into authentic content
- Plagiarism Checker: Scan against billions of sources

Get started: {dashboard_url}

Need help? Reply to this email or visit our website.

- The TextShift Team
        """
        
        return self.send_email(
            to_email=to_email,
            subject="Welcome to TextShift! Your Account is Ready",
            html_content=html_content,
            text_content=text_content
        )
    
    def send_subscription_confirmation(self, to_email: str, plan_name: str, credits: int, full_name: Optional[str] = None) -> bool:
        name = full_name.split()[0] if full_name else "there"
        dashboard_url = f"{settings.FRONTEND_URL}/dashboard"
        credits_display = "Unlimited" if credits == -1 else f"{credits:,}"
        
        content = f"""
        <tr>
            <td class="content-cell" style="padding: 48px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                                <span style="font-size: 28px;">💎</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #ffffff; text-align: center; line-height: 1.3;">
                    Subscription Confirmed!
                </h1>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #9ca3af; text-align: center; line-height: 1.6;">
                    Thanks for upgrading, {name}! Your <strong style="color: #10b981;">{plan_name}</strong> plan is now active.
                </p>
                
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 16px; padding: 24px; margin-bottom: 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                            <td align="center">
                                <p style="margin: 0 0 8px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Your Plan</p>
                                <p style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #10b981;">{plan_name}</p>
                                <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                                    <strong style="color: #ffffff; font-size: 20px;">{credits_display}</strong> words added
                                </p>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center">
                            <a href="{dashboard_url}" class="button" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 50px; text-align: center;">
                                Start Using Your Credits
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 32px 0 0 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6;">
                    Your words never expire. Cancel or change your plan anytime.
                </p>
            </td>
        </tr>
        """
        
        html_content = get_base_email_template(content, f"Your {plan_name} subscription is now active!")
        
        text_content = f"""
Subscription Confirmed!

Thanks for upgrading, {name}! Your {plan_name} plan is now active.

Plan: {plan_name}
Words Added: {credits_display}

Your credits never expire. Cancel or change your plan anytime.

Go to Dashboard: {dashboard_url}

- The TextShift Team
        """
        
        return self.send_email(
            to_email=to_email,
            subject=f"Subscription Confirmed - {plan_name} Plan",
            html_content=html_content,
            text_content=text_content
        )


    def send_notification_preferences_email(self, to_email: str, email_notifications: bool, marketing_emails: bool, full_name: Optional[str] = None) -> bool:
        """Send email confirming notification preference changes."""
        name = full_name.split()[0] if full_name else "there"
        settings_url = f"{settings.FRONTEND_URL}/settings"
        
        email_status = "enabled" if email_notifications else "disabled"
        marketing_status = "enabled" if marketing_emails else "disabled"
        
        content = f"""
        <tr>
            <td class="content-cell" style="padding: 48px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                                <span style="font-size: 28px;">🔔</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #ffffff; text-align: center; line-height: 1.3;">
                    Notification Preferences Updated
                </h1>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #9ca3af; text-align: center; line-height: 1.6;">
                    Hi {name}, your notification preferences have been updated.
                </p>
                
                <div style="background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; margin-bottom: 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #9ca3af; font-size: 14px;">Email Notifications</td>
                                        <td align="right" style="color: {'#10b981' if email_notifications else '#ef4444'}; font-size: 14px; font-weight: 600;">{email_status.upper()}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #9ca3af; font-size: 14px;">Marketing Emails</td>
                                        <td align="right" style="color: {'#10b981' if marketing_emails else '#ef4444'}; font-size: 14px; font-weight: 600;">{marketing_status.upper()}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center">
                            <a href="{settings_url}" class="button" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 50px; text-align: center;">
                                Manage Settings
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 32px 0 0 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.6;">
                    You can change these preferences anytime in your account settings.
                </p>
            </td>
        </tr>
        """
        
        html_content = get_base_email_template(content, "Your notification preferences have been updated")
        
        text_content = f"""
Notification Preferences Updated

Hi {name}, your notification preferences have been updated.

Email Notifications: {email_status.upper()}
Marketing Emails: {marketing_status.upper()}

You can change these preferences anytime at: {settings_url}

- The TextShift Team
        """
        
        return self.send_email(
            to_email=to_email,
            subject="Notification Preferences Updated - TextShift",
            html_content=html_content,
            text_content=text_content
        )
    
    def send_credit_topup_confirmation(self, to_email: str, credits_added: int, new_balance: int, price: float, full_name: Optional[str] = None) -> bool:
        """Send email confirming credit top-up purchase."""
        name = full_name.split()[0] if full_name else "there"
        dashboard_url = f"{settings.FRONTEND_URL}/dashboard"
        
        content = f"""
        <tr>
            <td class="content-cell" style="padding: 48px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <div style="width: 64px; height: 64px; background: rgba(16, 185, 129, 0.15); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                                <span style="font-size: 28px;">💰</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #ffffff; text-align: center; line-height: 1.3;">
                    Words Added Successfully!
                </h1>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #9ca3af; text-align: center; line-height: 1.6;">
                    Thanks for your purchase, {name}! Your words have been added to your account.
                </p>
                
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 16px; padding: 24px; margin-bottom: 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid rgba(16, 185, 129, 0.2);">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #9ca3af; font-size: 14px;">Words Added</td>
                                        <td align="right" style="color: #10b981; font-size: 18px; font-weight: 700;">+{credits_added:,}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid rgba(16, 185, 129, 0.2);">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #9ca3af; font-size: 14px;">Amount Paid</td>
                                        <td align="right" style="color: #ffffff; font-size: 16px; font-weight: 600;">${price:.2f}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #9ca3af; font-size: 14px;">New Balance</td>
                                        <td align="right" style="color: #ffffff; font-size: 18px; font-weight: 700;">{new_balance:,} words</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td align="center">
                            <a href="{dashboard_url}" class="button" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 50px; text-align: center;">
                                Use Your Words
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="margin: 32px 0 0 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.6;">
                    Your words never expire. Use them anytime!
                </p>
            </td>
        </tr>
        """
        
        html_content = get_base_email_template(content, f"You've added {credits_added:,} words to your account!")
        
        text_content = f"""
Words Added Successfully!

Thanks for your purchase, {name}! Your words have been added to your account.

Words Added: +{credits_added:,}
Amount Paid: ${price:.2f}
New Balance: {new_balance:,} words

Your words never expire. Use them anytime!

Go to Dashboard: {dashboard_url}

- The TextShift Team
        """
        
        return self.send_email(
            to_email=to_email,
            subject="Words Added - TextShift",
            html_content=html_content,
            text_content=text_content
        )


def generate_token() -> str:
    return secrets.token_urlsafe(32)


email_service = EmailService()
