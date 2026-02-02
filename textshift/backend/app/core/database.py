from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create engine - use SQLite for local development, PostgreSQL for production
# With connection pooling for better performance and reliability
if "sqlite" in settings.DATABASE_URL:
    # SQLite doesn't support connection pooling the same way
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,  # Verify connections before use
    )
else:
    # PostgreSQL with connection pooling
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=10,  # Number of connections to keep open
        max_overflow=20,  # Additional connections when pool is exhausted
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=3600,  # Recycle connections after 1 hour
        pool_timeout=30,  # Wait up to 30 seconds for a connection
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
