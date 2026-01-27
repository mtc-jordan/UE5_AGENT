"""
Global Error Handlers and Exception Middleware
Provides comprehensive error handling for the UE5 AI Studio backend
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from pydantic import ValidationError
import logging
import traceback
from typing import Union
from datetime import datetime

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Base application exception"""
    def __init__(self, message: str, status_code: int = 500, details: dict = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class DatabaseException(AppException):
    """Database-related exceptions"""
    def __init__(self, message: str = "Database error occurred", details: dict = None):
        super().__init__(message, status_code=500, details=details)


class AuthenticationException(AppException):
    """Authentication-related exceptions"""
    def __init__(self, message: str = "Authentication failed", details: dict = None):
        super().__init__(message, status_code=401, details=details)


class AuthorizationException(AppException):
    """Authorization-related exceptions"""
    def __init__(self, message: str = "Access denied", details: dict = None):
        super().__init__(message, status_code=403, details=details)


class ResourceNotFoundException(AppException):
    """Resource not found exceptions"""
    def __init__(self, resource: str = "Resource", details: dict = None):
        super().__init__(f"{resource} not found", status_code=404, details=details)


class ValidationException(AppException):
    """Validation-related exceptions"""
    def __init__(self, message: str = "Validation error", details: dict = None):
        super().__init__(message, status_code=422, details=details)


class ExternalAPIException(AppException):
    """External API-related exceptions"""
    def __init__(self, provider: str, message: str = "External API error", details: dict = None):
        details = details or {}
        details["provider"] = provider
        super().__init__(message, status_code=502, details=details)


def create_error_response(
    status_code: int,
    message: str,
    details: dict = None,
    error_type: str = "error",
    request_id: str = None
) -> dict:
    """Create a standardized error response"""
    response = {
        "error": {
            "type": error_type,
            "message": message,
            "status_code": status_code,
            "timestamp": datetime.utcnow().isoformat()
        }
    }
    
    if details:
        response["error"]["details"] = details
    
    if request_id:
        response["error"]["request_id"] = request_id
    
    return response


async def app_exception_handler(request: Request, exc: AppException):
    """Handle custom application exceptions"""
    logger.error(
        f"Application error: {exc.message}",
        extra={
            "status_code": exc.status_code,
            "details": exc.details,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            status_code=exc.status_code,
            message=exc.message,
            details=exc.details,
            error_type=exc.__class__.__name__
        )
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions"""
    logger.warning(
        f"HTTP {exc.status_code}: {exc.detail}",
        extra={
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=create_error_response(
            status_code=exc.status_code,
            message=str(exc.detail),
            error_type="HTTPException"
        )
    )


async def validation_exception_handler(request: Request, exc: Union[RequestValidationError, ValidationError]):
    """Handle validation errors"""
    errors = []
    
    if isinstance(exc, RequestValidationError):
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"]
            })
    else:
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"]
            })
    
    logger.warning(
        f"Validation error: {len(errors)} field(s) invalid",
        extra={
            "path": request.url.path,
            "method": request.method,
            "errors": errors
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=create_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Validation error",
            details={"errors": errors},
            error_type="ValidationError"
        )
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database exceptions"""
    error_message = "Database error occurred"
    details = {}
    
    if isinstance(exc, IntegrityError):
        error_message = "Data integrity constraint violated"
        details["type"] = "IntegrityError"
        
        # Try to extract meaningful info from the error
        if "UNIQUE constraint failed" in str(exc):
            details["reason"] = "Duplicate entry"
        elif "FOREIGN KEY constraint failed" in str(exc):
            details["reason"] = "Invalid reference"
    
    logger.error(
        f"Database error: {error_message}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "error_type": type(exc).__name__,
            "details": details
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=error_message,
            details=details,
            error_type="DatabaseError"
        )
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    error_id = f"ERR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    logger.error(
        f"Unhandled exception [{error_id}]: {str(exc)}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "error_id": error_id,
            "error_type": type(exc).__name__
        },
        exc_info=True
    )
    
    # In production, don't expose internal error details
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="An internal server error occurred",
            details={
                "error_id": error_id,
                "support_message": "Please contact support with this error ID if the problem persists"
            },
            error_type="InternalServerError",
            request_id=error_id
        )
    )


def setup_error_handlers(app):
    """Setup all error handlers for the FastAPI app"""
    
    # Custom application exceptions
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(DatabaseException, app_exception_handler)
    app.add_exception_handler(AuthenticationException, app_exception_handler)
    app.add_exception_handler(AuthorizationException, app_exception_handler)
    app.add_exception_handler(ResourceNotFoundException, app_exception_handler)
    app.add_exception_handler(ValidationException, app_exception_handler)
    app.add_exception_handler(ExternalAPIException, app_exception_handler)
    
    # HTTP exceptions
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    
    # Validation exceptions
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)
    
    # Database exceptions
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)
    app.add_exception_handler(IntegrityError, database_exception_handler)
    
    # Generic exception handler (catch-all)
    app.add_exception_handler(Exception, generic_exception_handler)
    
    logger.info("Error handlers configured successfully")
