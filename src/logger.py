import logging
import os
import json
from datetime import datetime
import pytz
from config import Config

class JSONFormatter(logging.Formatter):
    def format(self, record):
        # Get local timezone
        local_tz = pytz.timezone('Asia/Jerusalem')  # Using Israel timezone
        local_time = datetime.now(local_tz)
        
        log_record = {
            "timestamp": local_time.isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        if hasattr(record, 'exc_info') and record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_record)

def setup_logger():
    """Configure logging for the application"""
    config = Config()
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.dirname(config.LOG_FILE)
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure logging
    logging.basicConfig(
        level=config.LOG_LEVEL,
        format='%(message)s',  # We'll use our custom JSON formatter
        handlers=[
            # File handler with JSON formatting
            logging.FileHandler(config.LOG_FILE),
        ]
    )
    
    # Get the root logger and set the JSON formatter
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        handler.setFormatter(JSONFormatter())
    
    # Create and return root logger
    return root_logger