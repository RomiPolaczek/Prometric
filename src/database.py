from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./prometheus_retention.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class RetentionPolicy(Base):
    __tablename__ = "retention_policies"

    id = Column(Integer, primary_key=True, index=True)
    metric_name_pattern = Column(String(255), nullable=False, index=True)
    retention_days = Column(Float, nullable=False) 
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_executed = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<RetentionPolicy(id={self.id}, pattern='{self.metric_name_pattern}', days={self.retention_days})>"

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, nullable=False, index=True)
    metric_name_pattern = Column(String(255), nullable=False)
    metrics_found = Column(Integer, default=0)
    series_deleted = Column(Integer, default=0)
    execution_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    success = Column(Boolean, nullable=False)
    error_message = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ExecutionLog(id={self.id}, policy_id={self.policy_id}, success={self.success})>"

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """Initialize the database with tables"""
    Base.metadata.create_all(bind=engine)