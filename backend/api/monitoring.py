"""
Monitoring API Endpoints
Provides access to application metrics and health data
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from core.monitoring import get_performance_monitor, HealthMetrics, RequestMetrics
from core.logging_config import get_logger
from api.auth import get_current_user, require_admin
from models.user import User

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])
logger = get_logger(__name__)


@router.get("/health")
async def get_health():
    """
    Get system health metrics
    
    Returns:
        System health information
    """
    
    try:
        monitor = get_performance_monitor()
        health = monitor.get_health_metrics()
        
        return {
            "status": "healthy",
            "metrics": {
                "cpu_percent": health.cpu_percent,
                "memory_percent": health.memory_percent,
                "memory_used_mb": health.memory_used_mb,
                "memory_available_mb": health.memory_available_mb,
                "disk_percent": health.disk_percent,
                "disk_used_gb": health.disk_used_gb,
                "disk_free_gb": health.disk_free_gb,
                "uptime_seconds": health.uptime_seconds
            },
            "timestamp": health.timestamp
        }
    
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Health check failed")


@router.get("/metrics")
async def get_metrics(current_user: User = Depends(require_admin)):
    """
    Get application performance metrics (Admin only)
    
    Returns:
        Performance metrics
    """
    
    try:
        monitor = get_performance_monitor()
        metrics = monitor.get_request_metrics()
        
        return {
            "total_requests": metrics.total_requests,
            "requests_per_second": metrics.requests_per_second,
            "average_response_time_ms": metrics.average_response_time_ms,
            "p95_response_time_ms": metrics.p95_response_time_ms,
            "p99_response_time_ms": metrics.p99_response_time_ms,
            "error_rate": metrics.error_rate,
            "status_codes": metrics.status_codes
        }
    
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")


@router.get("/endpoints")
async def get_endpoint_metrics(current_user: User = Depends(require_admin)):
    """
    Get per-endpoint performance metrics (Admin only)
    
    Returns:
        Endpoint performance data
    """
    
    try:
        monitor = get_performance_monitor()
        endpoints = monitor.get_endpoint_metrics()
        
        return {
            "endpoints": endpoints,
            "total_endpoints": len(endpoints)
        }
    
    except Exception as e:
        logger.error(f"Failed to get endpoint metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve endpoint metrics")


@router.get("/summary")
async def get_monitoring_summary(current_user: User = Depends(require_admin)):
    """
    Get comprehensive monitoring summary (Admin only)
    
    Returns:
        Complete monitoring data including health, metrics, and endpoints
    """
    
    try:
        monitor = get_performance_monitor()
        summary = monitor.get_summary()
        
        return summary
    
    except Exception as e:
        logger.error(f"Failed to get monitoring summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve monitoring summary")


@router.get("/logs/recent")
async def get_recent_logs(
    lines: int = 100,
    level: str = "INFO",
    current_user: User = Depends(require_admin)
):
    """
    Get recent log entries (Admin only)
    
    Args:
        lines: Number of log lines to retrieve (default: 100, max: 1000)
        level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        Recent log entries
    """
    
    try:
        import os
        from pathlib import Path
        
        # Limit lines
        lines = min(lines, 1000)
        
        # Read log file
        log_file = Path("logs/app.log")
        
        if not log_file.exists():
            return {"logs": [], "message": "No logs available"}
        
        # Read last N lines
        with open(log_file, "r") as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:]
        
        # Filter by level if needed
        level_priority = {
            "DEBUG": 0,
            "INFO": 1,
            "WARNING": 2,
            "ERROR": 3,
            "CRITICAL": 4
        }
        
        min_level = level_priority.get(level.upper(), 1)
        
        filtered_logs = []
        for line in recent_lines:
            try:
                import json
                log_entry = json.loads(line)
                entry_level = level_priority.get(log_entry.get("level", "INFO"), 1)
                
                if entry_level >= min_level:
                    filtered_logs.append(log_entry)
            except:
                # Non-JSON log line, include it
                filtered_logs.append({"message": line.strip()})
        
        return {
            "logs": filtered_logs,
            "total": len(filtered_logs),
            "level_filter": level
        }
    
    except Exception as e:
        logger.error(f"Failed to get recent logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve logs")


@router.get("/alerts")
async def get_alerts(current_user: User = Depends(require_admin)):
    """
    Get system alerts and warnings (Admin only)
    
    Returns:
        Active alerts
    """
    
    try:
        monitor = get_performance_monitor()
        health = monitor.get_health_metrics()
        metrics = monitor.get_request_metrics()
        
        alerts = []
        
        # Check CPU
        if health.cpu_percent > 80:
            alerts.append({
                "level": "warning" if health.cpu_percent < 90 else "critical",
                "type": "cpu",
                "message": f"High CPU usage: {health.cpu_percent:.1f}%",
                "value": health.cpu_percent
            })
        
        # Check memory
        if health.memory_percent > 80:
            alerts.append({
                "level": "warning" if health.memory_percent < 90 else "critical",
                "type": "memory",
                "message": f"High memory usage: {health.memory_percent:.1f}%",
                "value": health.memory_percent
            })
        
        # Check disk
        if health.disk_percent > 80:
            alerts.append({
                "level": "warning" if health.disk_percent < 90 else "critical",
                "type": "disk",
                "message": f"Low disk space: {health.disk_percent:.1f}% used",
                "value": health.disk_percent
            })
        
        # Check error rate
        if metrics.error_rate > 5:
            alerts.append({
                "level": "warning" if metrics.error_rate < 10 else "critical",
                "type": "error_rate",
                "message": f"High error rate: {metrics.error_rate:.1f}%",
                "value": metrics.error_rate
            })
        
        # Check response time
        if metrics.p95_response_time_ms > 1000:
            alerts.append({
                "level": "warning" if metrics.p95_response_time_ms < 2000 else "critical",
                "type": "response_time",
                "message": f"Slow response time: P95 = {metrics.p95_response_time_ms:.0f}ms",
                "value": metrics.p95_response_time_ms
            })
        
        return {
            "alerts": alerts,
            "total": len(alerts),
            "critical_count": sum(1 for a in alerts if a["level"] == "critical"),
            "warning_count": sum(1 for a in alerts if a["level"] == "warning")
        }
    
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve alerts")
