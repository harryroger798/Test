import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "your-very-long-random-secret-key")
JWT_ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta = timedelta(days=30)) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(token: str) -> dict | None:
    import database
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("user_id")
    if not user_id:
        return None
    user = database.get_user_by_id(user_id)
    if not user:
        return None
    return user


def require_premium(user: dict) -> bool:
    if user.get("plan") != "premium":
        return False
    expires = user.get("plan_expires_at")
    if not expires:
        return False
    try:
        exp_dt = datetime.fromisoformat(expires)
        return exp_dt > datetime.utcnow()
    except (ValueError, TypeError):
        return False


def require_admin(user: dict) -> bool:
    return user.get("is_admin") == 1
