from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
import httpx
import time as _time
import logging

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

_auth0_jwks_cache: Optional[dict] = None
_auth0_jwks_cache_time: float = 0


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def _get_auth0_jwks() -> dict:
    global _auth0_jwks_cache, _auth0_jwks_cache_time
    now = _time.time()
    if _auth0_jwks_cache and (now - _auth0_jwks_cache_time) < 3600:
        return _auth0_jwks_cache
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json",
            )
        _auth0_jwks_cache = resp.json()
        _auth0_jwks_cache_time = now
        return _auth0_jwks_cache
    except Exception as e:
        logger.warning(f"Failed to fetch Auth0 JWKS: {e}")
        if _auth0_jwks_cache:
            return _auth0_jwks_cache
        return {"keys": []}


async def decode_auth0_token(token: str) -> Optional[dict]:
    try:
        unverified_header = jwt.get_unverified_header(token)
        jwks = await _get_auth0_jwks()
        rsa_key: dict = {}
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break
        if not rsa_key:
            return None
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.AUTH0_CLIENT_ID,
            issuer=f"https://{settings.AUTH0_DOMAIN}/",
        )
        return payload
    except Exception as e:
        logger.debug(f"Auth0 token decode failed: {e}")
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is not None:
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        from app.models.user import User
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise credentials_exception
        return user

    auth0_payload = await decode_auth0_token(token)
    if auth0_payload is not None:
        auth0_sub = auth0_payload.get("sub")
        if not auth0_sub:
            raise credentials_exception
        from app.models.user import User
        user = db.query(User).filter(User.auth0_sub == auth0_sub).first()
        if user is None:
            email = auth0_payload.get("email")
            if email:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    user.auth0_sub = auth0_sub
                    db.commit()
        if user is None:
            raise credentials_exception
        return user

    raise credentials_exception


async def get_current_active_user(current_user = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_verified_user(current_user = Depends(get_current_active_user)):
    """Require user to have verified email before accessing protected resources."""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email to access this feature."
        )
    return current_user


async def get_current_admin_user(current_user = Depends(get_current_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user
