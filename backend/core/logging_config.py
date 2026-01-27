"""
Structured Logging Configuration
Provides JSON-formatted logging with context and request tracking
"""

import logging
import logging.config
import json
import sys
from datetime import datetime
from typing import Any, Dict
from pathlib import Path
import os


class JSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        
        if hasattr(record, "duration"):
            log_data["duration_ms"] = record.duration
        
        if hasattr(record, "status_code"):
            log_data["status_code"] = record.status_code
        
        if hasattr(record, "method"):
            log_data["method"] = record.method
        
        if hasattr(record, "path"):
            log_data["path"] = record.path
        
        # Add custom extra fields
        for key, value in record.__dict__.items():
            if key not in [
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "message", "pathname", "process", "processName", "relativeCreated",
                "thread", "threadName", "exc_info", "exc_text", "stack_info",
                "request_id", "user_id", "duration", "status_code", "method", "path"
            ]:
                if not key.startswith("_"):
                    log_data[key] = value
        
        return json.dumps(log_data)


def setup_logging(
    log_level: str = "INFO",
    log_file: str = "logs/app.log",
    json_format: bool = True
) -> None:
    """
    Setup application logging
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file
        json_format: Use JSON formatting (True) or standard formatting (False)
    """
    
    # Create logs directory
    log_dir = Path(log_file).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine formatter
    if json_format:
        formatter_class = "core.logging_config.JSONFormatter"
        format_string = ""  # Not used by JSONFormatter
    else:
        formatter_class = "logging.Formatter"
        format_string = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Logging configuration
    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "()": formatter_class,
                "format": format_string,
            },
            "simple": {
                "format": "%(levelname)s - %(message)s"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "default" if json_format else "simple",
                "stream": "ext://sys.stdout",
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": log_level,
                "formatter": "default",
                "filename": log_file,
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "ERROR",
                "formatter": "default",
                "filename": "logs/error.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8",
            },
        },
        "loggers": {
            "": {  # Root logger
                "level": log_level,
                "handlers": ["console", "file", "error_file"],
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console", "file"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "INFO",
                "handlers": ["file"],
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "level": "WARNING",
                "handlers": ["file"],
                "propagate": False,
            },
        },
    }
    
    logging.config.dictConfig(config)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance
    
    Args:
        name: Logger name (usually __name__)
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)


# Request logging middleware helper
class RequestLogger:
    """Helper class for logging HTTP requests"""
    
    @staticmethod
    def log_request(
        logger: logging.Logger,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        request_id: str = None,
        user_id: str = None,
        **kwargs
    ):
        """
        Log HTTP request
        
        Args:
            logger: Logger instance
            method: HTTP method
            path: Request path
            status_code: Response status code
            duration_ms: Request duration in milliseconds
            request_id: Request ID
            user_id: User ID
            **kwargs: Additional fields
        """
        
        extra = {
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration": duration_ms,
        }
        
        if request_id:
            extra["request_id"] = request_id
        
        if user_id:
            extra["user_id"] = user_id
        
        extra.update(kwargs)
        
        # Determine log level based on status code
        if status_code >= 500:
            logger.error(f"{method} {path} - {status_code}", extra=extra)
        elif status_code >= 400:
            logger.warning(f"{method} {path} - {status_code}", extra=extra)
        else:
            logger.info(f"{method} {path} - {status_code}", extra=extra)


# Initialize logging on import
environment = os.getenv("ENVIRONMENT", "development")
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
json_logging = environment == "production"

setup_logging(
    log_level=log_level,
    log_file="logs/app.log",
    json_format=json_logging
)
