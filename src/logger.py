import logging
import os
from config import Config

def setup_logger():
    """Configure logging for the application"""
    config = Config()
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.dirname(config.LOG_FILE)
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure logging
    logging.basicConfig(
        level=config.LOG_LEVEL,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            # File handler
            logging.FileHandler(config.LOG_FILE),
            # Console handler
            logging.StreamHandler()
        ]
    )
    
    # Create and return root logger
    return logging.getLogger()