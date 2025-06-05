import os
from typing import Optional

class Config:
    """Application configuration"""
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/prometheus_retention.db")
    
    # Prometheus
    PROMETHEUS_URL: str = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    PROMETHEUS_TIMEOUT: int = int(os.getenv("PROMETHEUS_TIMEOUT", "30"))
    
    # Scheduler
    RETENTION_CHECK_INTERVAL_HOURS: int = int(os.getenv("RETENTION_CHECK_INTERVAL_HOURS", "6"))
    
    # API
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "/app/logs/app.log")
    
    @classmethod
    def get_prometheus_url(cls) -> str:
        """Get the Prometheus URL with validation"""
        url = cls.PROMETHEUS_URL
        if not url.startswith(('http://', 'https://')):
            url = f"http://{url}"
        return url.rstrip('/')
    
    @classmethod
    def validate(cls) -> None:
        """Validate configuration"""
        errors = []
        
        # Validate Prometheus URL
        if not cls.PROMETHEUS_URL:
            errors.append("PROMETHEUS_URL is required")
        
        # Validate intervals
        if cls.RETENTION_CHECK_INTERVAL_HOURS < 1:
            errors.append("RETENTION_CHECK_INTERVAL_HOURS must be at least 1")
        
        # Validate timeouts
        if cls.PROMETHEUS_TIMEOUT < 1:
            errors.append("PROMETHEUS_TIMEOUT must be at least 1")
        
        if errors:
            raise ValueError("Configuration errors: " + "; ".join(errors))

# Environment-specific configurations
class DevelopmentConfig(Config):
    LOG_LEVEL = "DEBUG"

class ProductionConfig(Config):
    LOG_LEVEL = "WARNING"

class TestConfig(Config):
    DATABASE_URL = "sqlite:///./test_prometheus_retention.db"
    PROMETHEUS_URL = "http://localhost:9091"  # Test Prometheus instance

# Configuration factory
def get_config() -> Config:
    """Get configuration based on environment"""
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return ProductionConfig()
    elif env == "test":
        return TestConfig()
    else:
        return DevelopmentConfig()