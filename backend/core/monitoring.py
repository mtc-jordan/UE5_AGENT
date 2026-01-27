"""
Performance Monitoring and Metrics
Tracks application performance and health metrics
"""

import time
import psutil
import asyncio
from typing import Dict, Any, List
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class HealthMetrics:
    """System health metrics"""
    timestamp: str
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_available_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_free_gb: float
    uptime_seconds: float


@dataclass
class RequestMetrics:
    """Request performance metrics"""
    total_requests: int
    requests_per_second: float
    average_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    error_rate: float
    status_codes: Dict[int, int]


class PerformanceMonitor:
    """
    Monitor application performance and collect metrics
    """
    
    def __init__(self, window_size: int = 1000):
        """
        Initialize performance monitor
        
        Args:
            window_size: Number of recent requests to track
        """
        self.window_size = window_size
        self.start_time = time.time()
        
        # Request tracking
        self.request_times = deque(maxlen=window_size)
        self.request_timestamps = deque(maxlen=window_size)
        self.status_codes = defaultdict(int)
        self.error_count = 0
        self.total_requests = 0
        
        # Endpoint tracking
        self.endpoint_metrics = defaultdict(lambda: {
            "count": 0,
            "total_time": 0,
            "errors": 0,
            "times": deque(maxlen=100)
        })
    
    def record_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float
    ):
        """
        Record a request
        
        Args:
            endpoint: API endpoint
            method: HTTP method
            status_code: Response status code
            duration_ms: Request duration in milliseconds
        """
        
        # Update global metrics
        self.total_requests += 1
        self.request_times.append(duration_ms)
        self.request_timestamps.append(time.time())
        self.status_codes[status_code] += 1
        
        if status_code >= 400:
            self.error_count += 1
        
        # Update endpoint metrics
        key = f"{method} {endpoint}"
        metrics = self.endpoint_metrics[key]
        metrics["count"] += 1
        metrics["total_time"] += duration_ms
        metrics["times"].append(duration_ms)
        
        if status_code >= 400:
            metrics["errors"] += 1
    
    def get_health_metrics(self) -> HealthMetrics:
        """
        Get current system health metrics
        
        Returns:
            HealthMetrics object
        """
        
        # CPU and memory
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        
        # Disk
        disk = psutil.disk_usage('/')
        
        # Uptime
        uptime = time.time() - self.start_time
        
        return HealthMetrics(
            timestamp=datetime.utcnow().isoformat() + "Z",
            cpu_percent=cpu_percent,
            memory_percent=memory.percent,
            memory_used_mb=memory.used / (1024 * 1024),
            memory_available_mb=memory.available / (1024 * 1024),
            disk_percent=disk.percent,
            disk_used_gb=disk.used / (1024 * 1024 * 1024),
            disk_free_gb=disk.free / (1024 * 1024 * 1024),
            uptime_seconds=uptime
        )
    
    def get_request_metrics(self) -> RequestMetrics:
        """
        Get request performance metrics
        
        Returns:
            RequestMetrics object
        """
        
        if not self.request_times:
            return RequestMetrics(
                total_requests=0,
                requests_per_second=0.0,
                average_response_time_ms=0.0,
                p95_response_time_ms=0.0,
                p99_response_time_ms=0.0,
                error_rate=0.0,
                status_codes={}
            )
        
        # Calculate requests per second (last 60 seconds)
        now = time.time()
        recent_requests = sum(1 for ts in self.request_timestamps if now - ts <= 60)
        requests_per_second = recent_requests / 60.0
        
        # Calculate response time percentiles
        sorted_times = sorted(self.request_times)
        avg_time = sum(sorted_times) / len(sorted_times)
        p95_index = int(len(sorted_times) * 0.95)
        p99_index = int(len(sorted_times) * 0.99)
        p95_time = sorted_times[p95_index] if p95_index < len(sorted_times) else sorted_times[-1]
        p99_time = sorted_times[p99_index] if p99_index < len(sorted_times) else sorted_times[-1]
        
        # Calculate error rate
        error_rate = (self.error_count / self.total_requests) * 100 if self.total_requests > 0 else 0.0
        
        return RequestMetrics(
            total_requests=self.total_requests,
            requests_per_second=requests_per_second,
            average_response_time_ms=avg_time,
            p95_response_time_ms=p95_time,
            p99_response_time_ms=p99_time,
            error_rate=error_rate,
            status_codes=dict(self.status_codes)
        )
    
    def get_endpoint_metrics(self) -> Dict[str, Dict[str, Any]]:
        """
        Get per-endpoint metrics
        
        Returns:
            Dictionary of endpoint metrics
        """
        
        result = {}
        
        for endpoint, metrics in self.endpoint_metrics.items():
            if metrics["count"] > 0:
                avg_time = metrics["total_time"] / metrics["count"]
                error_rate = (metrics["errors"] / metrics["count"]) * 100
                
                # Calculate percentiles if we have timing data
                if metrics["times"]:
                    sorted_times = sorted(metrics["times"])
                    p95_index = int(len(sorted_times) * 0.95)
                    p95_time = sorted_times[p95_index] if p95_index < len(sorted_times) else sorted_times[-1]
                else:
                    p95_time = 0
                
                result[endpoint] = {
                    "count": metrics["count"],
                    "avg_response_time_ms": avg_time,
                    "p95_response_time_ms": p95_time,
                    "error_rate": error_rate,
                    "errors": metrics["errors"]
                }
        
        # Sort by count (most called endpoints first)
        result = dict(sorted(result.items(), key=lambda x: x[1]["count"], reverse=True))
        
        return result
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get comprehensive monitoring summary
        
        Returns:
            Dictionary with all metrics
        """
        
        health = self.get_health_metrics()
        requests = self.get_request_metrics()
        endpoints = self.get_endpoint_metrics()
        
        return {
            "health": asdict(health),
            "requests": asdict(requests),
            "top_endpoints": dict(list(endpoints.items())[:10]),  # Top 10
            "total_endpoints": len(endpoints)
        }


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


def get_performance_monitor() -> PerformanceMonitor:
    """Get the global performance monitor instance"""
    return performance_monitor
