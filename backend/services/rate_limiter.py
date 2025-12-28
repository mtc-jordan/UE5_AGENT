"""
Rate Limiter Service

Implements role-based API rate limiting with sliding window algorithm.

Version: 2.3.0
"""

from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict
import asyncio
import time
import hashlib


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class RateLimitConfig:
    """Configuration for a rate limit rule."""
    requests: int           # Number of requests allowed
    window_seconds: int     # Time window in seconds
    burst_multiplier: float = 1.5  # Allow burst up to this multiplier
    
    @property
    def burst_limit(self) -> int:
        """Get burst limit (for short spikes)."""
        return int(self.requests * self.burst_multiplier)


# Default rate limits by role
DEFAULT_RATE_LIMITS: Dict[str, Dict[str, RateLimitConfig]] = {
    # Owner - highest limits
    "owner": {
        "default": RateLimitConfig(requests=10000, window_seconds=3600),  # 10k/hour
        "ai_chat": RateLimitConfig(requests=1000, window_seconds=3600),   # 1k/hour
        "mcp_tools": RateLimitConfig(requests=5000, window_seconds=3600), # 5k/hour
        "file_upload": RateLimitConfig(requests=500, window_seconds=3600),
    },
    # Admin - very high limits
    "admin": {
        "default": RateLimitConfig(requests=5000, window_seconds=3600),
        "ai_chat": RateLimitConfig(requests=500, window_seconds=3600),
        "mcp_tools": RateLimitConfig(requests=2500, window_seconds=3600),
        "file_upload": RateLimitConfig(requests=250, window_seconds=3600),
    },
    # Manager - high limits
    "manager": {
        "default": RateLimitConfig(requests=2000, window_seconds=3600),
        "ai_chat": RateLimitConfig(requests=200, window_seconds=3600),
        "mcp_tools": RateLimitConfig(requests=1000, window_seconds=3600),
        "file_upload": RateLimitConfig(requests=100, window_seconds=3600),
    },
    # Developer - standard limits
    "developer": {
        "default": RateLimitConfig(requests=1000, window_seconds=3600),
        "ai_chat": RateLimitConfig(requests=100, window_seconds=3600),
        "mcp_tools": RateLimitConfig(requests=500, window_seconds=3600),
        "file_upload": RateLimitConfig(requests=50, window_seconds=3600),
    },
    # Analyst - moderate limits
    "analyst": {
        "default": RateLimitConfig(requests=500, window_seconds=3600),
        "ai_chat": RateLimitConfig(requests=50, window_seconds=3600),
        "mcp_tools": RateLimitConfig(requests=100, window_seconds=3600),
        "file_upload": RateLimitConfig(requests=25, window_seconds=3600),
    },
    # User - basic limits
    "user": {
        "default": RateLimitConfig(requests=200, window_seconds=3600),
        "ai_chat": RateLimitConfig(requests=20, window_seconds=3600),
        "mcp_tools": RateLimitConfig(requests=50, window_seconds=3600),
        "file_upload": RateLimitConfig(requests=10, window_seconds=3600),
    },
    # Guest - minimal limits
    "guest": {
        "default": RateLimitConfig(requests=50, window_seconds=3600),
        "ai_chat": RateLimitConfig(requests=5, window_seconds=3600),
        "mcp_tools": RateLimitConfig(requests=10, window_seconds=3600),
        "file_upload": RateLimitConfig(requests=2, window_seconds=3600),
    },
}

# Subscription tier multipliers
TIER_MULTIPLIERS: Dict[str, float] = {
    "free": 1.0,
    "starter": 2.0,
    "professional": 5.0,
    "team": 10.0,
    "enterprise": 100.0,  # Essentially unlimited
}


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    remaining: int
    limit: int
    reset_at: datetime
    retry_after: Optional[int] = None  # Seconds until reset
    
    def to_headers(self) -> Dict[str, str]:
        """Convert to HTTP headers."""
        headers = {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(max(0, self.remaining)),
            "X-RateLimit-Reset": str(int(self.reset_at.timestamp())),
        }
        if self.retry_after:
            headers["Retry-After"] = str(self.retry_after)
        return headers


@dataclass
class SlidingWindowCounter:
    """Sliding window counter for rate limiting."""
    window_start: float = 0.0
    current_count: int = 0
    previous_count: int = 0
    
    def get_count(self, window_seconds: int) -> float:
        """Get weighted count using sliding window algorithm."""
        now = time.time()
        window_start_time = now - window_seconds
        
        # If window has completely passed, reset
        if self.window_start < window_start_time - window_seconds:
            return 0
        
        # Calculate weight for previous window
        if self.window_start < window_start_time:
            elapsed_in_current = now - window_start_time
            weight = 1 - (elapsed_in_current / window_seconds)
            return self.current_count + (self.previous_count * weight)
        
        return self.current_count
    
    def increment(self, window_seconds: int) -> int:
        """Increment counter and return new count."""
        now = time.time()
        window_start_time = now - window_seconds
        
        # Check if we need to rotate windows
        if self.window_start < window_start_time:
            self.previous_count = self.current_count
            self.current_count = 0
            self.window_start = now
        
        self.current_count += 1
        return self.current_count


# =============================================================================
# RATE LIMITER SERVICE
# =============================================================================

class RateLimiter:
    """
    Rate limiter with sliding window algorithm.
    
    Features:
    - Role-based rate limits
    - Subscription tier multipliers
    - Multiple limit categories (default, ai_chat, mcp_tools, etc.)
    - Sliding window for smooth rate limiting
    - Burst allowance for short spikes
    """
    
    def __init__(self):
        self._counters: Dict[str, SlidingWindowCounter] = defaultdict(SlidingWindowCounter)
        self._lock = asyncio.Lock()
        self._custom_limits: Dict[str, Dict[str, RateLimitConfig]] = {}
    
    def _get_key(
        self,
        user_id: int,
        category: str,
        ip_address: Optional[str] = None
    ) -> str:
        """Generate a unique key for rate limiting."""
        if user_id:
            return f"user:{user_id}:{category}"
        elif ip_address:
            # Hash IP for privacy
            ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()[:16]
            return f"ip:{ip_hash}:{category}"
        else:
            return f"anonymous:{category}"
    
    def _get_limit_config(
        self,
        role: str,
        category: str,
        tier: str = "free"
    ) -> RateLimitConfig:
        """Get rate limit configuration for role and category."""
        # Check custom limits first
        if role in self._custom_limits and category in self._custom_limits[role]:
            base_config = self._custom_limits[role][category]
        else:
            # Get from defaults
            role_limits = DEFAULT_RATE_LIMITS.get(role, DEFAULT_RATE_LIMITS["user"])
            base_config = role_limits.get(category, role_limits["default"])
        
        # Apply tier multiplier
        multiplier = TIER_MULTIPLIERS.get(tier, 1.0)
        
        return RateLimitConfig(
            requests=int(base_config.requests * multiplier),
            window_seconds=base_config.window_seconds,
            burst_multiplier=base_config.burst_multiplier
        )
    
    async def check_rate_limit(
        self,
        user_id: Optional[int],
        role: str = "user",
        category: str = "default",
        tier: str = "free",
        ip_address: Optional[str] = None,
        cost: int = 1  # Some operations may cost more
    ) -> RateLimitResult:
        """
        Check if request is within rate limits.
        
        Args:
            user_id: User ID (None for anonymous)
            role: User's role
            category: Rate limit category
            tier: Subscription tier
            ip_address: IP address for anonymous users
            cost: Cost of this request (default 1)
        
        Returns:
            RateLimitResult with allowed status and metadata
        """
        async with self._lock:
            key = self._get_key(user_id, category, ip_address)
            config = self._get_limit_config(role, category, tier)
            counter = self._counters[key]
            
            # Get current count using sliding window
            current_count = counter.get_count(config.window_seconds)
            
            # Calculate reset time
            reset_at = datetime.utcnow() + timedelta(seconds=config.window_seconds)
            
            # Check if within limit
            if current_count + cost <= config.requests:
                # Increment counter
                counter.increment(config.window_seconds)
                
                return RateLimitResult(
                    allowed=True,
                    remaining=config.requests - int(current_count) - cost,
                    limit=config.requests,
                    reset_at=reset_at
                )
            
            # Check burst allowance
            if current_count + cost <= config.burst_limit:
                counter.increment(config.window_seconds)
                
                return RateLimitResult(
                    allowed=True,
                    remaining=0,  # At burst capacity
                    limit=config.requests,
                    reset_at=reset_at
                )
            
            # Rate limited
            retry_after = int(config.window_seconds - (time.time() - counter.window_start))
            
            return RateLimitResult(
                allowed=False,
                remaining=0,
                limit=config.requests,
                reset_at=reset_at,
                retry_after=max(1, retry_after)
            )
    
    async def get_usage(
        self,
        user_id: int,
        role: str = "user",
        tier: str = "free"
    ) -> Dict[str, Dict[str, Any]]:
        """Get current usage for all categories."""
        usage = {}
        
        for category in ["default", "ai_chat", "mcp_tools", "file_upload"]:
            key = self._get_key(user_id, category)
            config = self._get_limit_config(role, category, tier)
            counter = self._counters.get(key, SlidingWindowCounter())
            
            current_count = counter.get_count(config.window_seconds)
            
            usage[category] = {
                "current": int(current_count),
                "limit": config.requests,
                "remaining": max(0, config.requests - int(current_count)),
                "percentage": min(100, int((current_count / config.requests) * 100)),
                "window_seconds": config.window_seconds
            }
        
        return usage
    
    def set_custom_limit(
        self,
        role: str,
        category: str,
        config: RateLimitConfig
    ):
        """Set a custom rate limit for a role and category."""
        if role not in self._custom_limits:
            self._custom_limits[role] = {}
        self._custom_limits[role][category] = config
    
    async def reset_user_limits(self, user_id: int):
        """Reset all rate limits for a user."""
        async with self._lock:
            keys_to_remove = [
                key for key in self._counters.keys()
                if key.startswith(f"user:{user_id}:")
            ]
            for key in keys_to_remove:
                del self._counters[key]
    
    async def cleanup_expired(self):
        """Remove expired counters to free memory."""
        async with self._lock:
            now = time.time()
            max_window = max(
                config.window_seconds
                for limits in DEFAULT_RATE_LIMITS.values()
                for config in limits.values()
            )
            
            keys_to_remove = [
                key for key, counter in self._counters.items()
                if counter.window_start < now - (max_window * 2)
            ]
            
            for key in keys_to_remove:
                del self._counters[key]


# =============================================================================
# FASTAPI MIDDLEWARE
# =============================================================================

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.
    
    Automatically applies rate limits based on user role and endpoint category.
    """
    
    # Endpoint category mapping
    ENDPOINT_CATEGORIES = {
        "/api/ai/": "ai_chat",
        "/api/mcp/": "mcp_tools",
        "/api/workspace/upload": "file_upload",
        "/api/plugins/upload": "file_upload",
    }
    
    def __init__(self, app, rate_limiter: RateLimiter):
        super().__init__(app)
        self.rate_limiter = rate_limiter
    
    def _get_category(self, path: str) -> str:
        """Determine rate limit category from path."""
        for prefix, category in self.ENDPOINT_CATEGORIES.items():
            if path.startswith(prefix):
                return category
        return "default"
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        # Check for proxy headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request with rate limiting."""
        # Skip rate limiting for certain paths
        if request.url.path in ["/health", "/api/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Get user info from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        role = getattr(request.state, "user_role", "guest")
        tier = getattr(request.state, "subscription_tier", "free")
        
        # Get category and IP
        category = self._get_category(request.url.path)
        ip_address = self._get_client_ip(request)
        
        # Check rate limit
        result = await self.rate_limiter.check_rate_limit(
            user_id=user_id,
            role=role,
            category=category,
            tier=tier,
            ip_address=ip_address
        )
        
        if not result.allowed:
            # Return 429 Too Many Requests
            response = Response(
                content='{"detail": "Rate limit exceeded. Please try again later."}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json"
            )
            for key, value in result.to_headers().items():
                response.headers[key] = value
            return response
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        for key, value in result.to_headers().items():
            response.headers[key] = value
        
        return response


# =============================================================================
# DEPENDENCY FOR MANUAL RATE LIMITING
# =============================================================================

from fastapi import Depends


async def get_rate_limiter() -> RateLimiter:
    """Get the rate limiter instance."""
    return rate_limiter


async def check_rate_limit(
    category: str = "default",
    cost: int = 1
):
    """
    Dependency for manual rate limit checking.
    
    Usage:
        @router.post("/expensive-operation")
        async def expensive_op(
            _: None = Depends(check_rate_limit("ai_chat", cost=5))
        ):
            ...
    """
    async def _check(
        request: Request,
        limiter: RateLimiter = Depends(get_rate_limiter)
    ):
        user_id = getattr(request.state, "user_id", None)
        role = getattr(request.state, "user_role", "guest")
        tier = getattr(request.state, "subscription_tier", "free")
        ip_address = request.client.host if request.client else None
        
        result = await limiter.check_rate_limit(
            user_id=user_id,
            role=role,
            category=category,
            tier=tier,
            ip_address=ip_address,
            cost=cost
        )
        
        if not result.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers=result.to_headers()
            )
    
    return _check


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

rate_limiter = RateLimiter()
