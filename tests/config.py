"""
Test configuration settings for Prometric test suite.
"""

import os

# API Configuration
API_BASE_URL = os.getenv("PROMETRIC_API_URL", "http://localhost:8000")
API_TIMEOUT = int(os.getenv("PROMETRIC_API_TIMEOUT", "30"))

# Prometheus Configuration  
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
PROMETHEUS_TIMEOUT = int(os.getenv("PROMETHEUS_TIMEOUT", "30"))

# Database Configuration
DATABASE_PATH = os.getenv("PROMETRIC_DB_PATH", "./data/prometheus_retention.db")

# Test Configuration
DEFAULT_METRIC_ANALYSIS_HOURS = int(os.getenv("TEST_ANALYSIS_HOURS", "24"))
DEFAULT_API_PORT = int(os.getenv("PROMETRIC_API_PORT", "8000"))

# Output Configuration
VERBOSE_OUTPUT = os.getenv("TEST_VERBOSE", "false").lower() in ("true", "1", "yes")
COLORED_OUTPUT = os.getenv("TEST_COLORED", "true").lower() in ("true", "1", "yes")

# Test Categories
INTEGRATION_TESTS = [
    "test_connection.py",
    "test_endpoints.py", 
    "test_metric_analysis.py"
]

UTILITY_SCRIPTS = [
    "count_metric_timestamps.py"
]

def get_config_summary():
    """Return a summary of current configuration"""
    return {
        "api_base_url": API_BASE_URL,
        "prometheus_url": PROMETHEUS_URL,
        "database_path": DATABASE_PATH,
        "api_timeout": API_TIMEOUT,
        "prometheus_timeout": PROMETHEUS_TIMEOUT,
        "verbose_output": VERBOSE_OUTPUT,
        "colored_output": COLORED_OUTPUT
    } 