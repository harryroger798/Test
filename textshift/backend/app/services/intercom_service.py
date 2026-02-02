"""
Intercom Integration Service for TextShift

Provides:
- User identity verification (HMAC hash generation)
- User sync to Intercom
- Event tracking
- In-app messaging
"""

import hmac
import hashlib
import time
from typing import Optional, Dict, Any
import httpx
from app.core.config import settings


class IntercomService:
    """Service for Intercom integration."""
    
    BASE_URL = "https://api.intercom.io"
    
    def __init__(self):
        self.access_token = settings.INTERCOM_ACCESS_TOKEN
        self.identity_secret = settings.INTERCOM_IDENTITY_SECRET
        self.app_id = settings.INTERCOM_APP_ID
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Intercom-Version": "2.10"
        }
    
    def generate_user_hash(self, user_id: str) -> str:
        """
        Generate HMAC-SHA256 hash for identity verification.
        
        This hash is used by the frontend to verify user identity
        with Intercom, preventing impersonation.
        
        Args:
            user_id: The user's unique identifier (as string)
            
        Returns:
            HMAC-SHA256 hash as hex string
        """
        if not self.identity_secret:
            return ""
        
        return hmac.new(
            self.identity_secret.encode('utf-8'),
            user_id.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    async def create_or_update_user(
        self,
        user_id: str,
        email: str,
        name: str,
        created_at: Optional[int] = None,
        custom_attributes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create or update a user in Intercom.
        
        Args:
            user_id: Unique user identifier
            email: User's email address
            name: User's display name
            created_at: Unix timestamp of account creation
            custom_attributes: Additional user attributes
            
        Returns:
            Intercom API response
        """
        if not self.access_token:
            return {"error": "Intercom access token not configured"}
        
        payload = {
            "role": "user",
            "external_id": str(user_id),
            "email": email,
            "name": name,
        }
        
        if created_at:
            payload["signed_up_at"] = created_at
        
        if custom_attributes:
            payload["custom_attributes"] = custom_attributes
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.BASE_URL}/contacts",
                    headers=self.headers,
                    json=payload,
                    timeout=10.0
                )
                return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    async def track_event(
        self,
        user_id: str,
        event_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Track an event for a user in Intercom.
        
        Args:
            user_id: User's unique identifier
            event_name: Name of the event (e.g., 'scan_completed')
            metadata: Additional event data
            
        Returns:
            Intercom API response
        """
        if not self.access_token:
            return {"error": "Intercom access token not configured"}
        
        payload = {
            "event_name": event_name,
            "user_id": str(user_id),
            "created_at": int(time.time()),
        }
        
        if metadata:
            payload["metadata"] = metadata
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.BASE_URL}/events",
                    headers=self.headers,
                    json=payload,
                    timeout=10.0
                )
                return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    async def update_user_attributes(
        self,
        user_id: str,
        attributes: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update custom attributes for a user.
        
        Args:
            user_id: User's unique identifier
            attributes: Dictionary of attributes to update
            
        Returns:
            Intercom API response
        """
        if not self.access_token:
            return {"error": "Intercom access token not configured"}
        
        payload = {
            "external_id": str(user_id),
            "custom_attributes": attributes
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"{self.BASE_URL}/contacts",
                    headers=self.headers,
                    json=payload,
                    timeout=10.0
                )
                return response.json()
        except Exception as e:
            return {"error": str(e)}


# Singleton instance
intercom_service = IntercomService()
