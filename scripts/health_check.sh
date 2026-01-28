#!/bin/bash
#
# UE5 AI Studio - Health Check Script
# Monitors system health and sends alerts
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_FILE="/var/log/ue5-ai-studio-health.log"

# Status
ALL_HEALTHY=true

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    ALL_HEALTHY=false
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

check_service() {
    local name=$1
    local url=$2
    
    if curl -f -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
        log "✅ $name is healthy"
        return 0
    else
        error "❌ $name is unhealthy"
        return 1
    fi
}

check_docker_service() {
    local service=$1
    
    if docker-compose ps "$service" | grep -q "Up"; then
        log "✅ Docker service '$service' is running"
        return 0
    else
        error "❌ Docker service '$service' is not running"
        return 1
    fi
}

check_disk_space() {
    local threshold=80
    local usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -lt "$threshold" ]; then
        log "✅ Disk usage: ${usage}%"
        return 0
    else
        warn "⚠️  Disk usage high: ${usage}%"
        return 1
    fi
}

check_memory() {
    local threshold=80
    local usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    if [ "$usage" -lt "$threshold" ]; then
        log "✅ Memory usage: ${usage}%"
        return 0
    else
        warn "⚠️  Memory usage high: ${usage}%"
        return 1
    fi
}

send_alert() {
    local message=$1
    
    if [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "UE5 AI Studio Health Alert" "$ALERT_EMAIL"
        log "Alert sent to $ALERT_EMAIL"
    fi
}

# Main health checks
log "Starting health check..."

# Check Docker services
check_docker_service "backend"
check_docker_service "frontend"
check_docker_service "database"
check_docker_service "redis"

# Check HTTP endpoints
check_service "Backend API" "$BACKEND_URL/api/monitoring/health"
check_service "Frontend" "$FRONTEND_URL/"

# Check system resources
check_disk_space
check_memory

# Check database connectivity
if docker-compose exec -T database pg_isready -U ue5admin > /dev/null 2>&1; then
    log "✅ Database is ready"
else
    error "❌ Database is not ready"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    log "✅ Redis is responding"
else
    error "❌ Redis is not responding"
fi

# Summary
echo ""
if [ "$ALL_HEALTHY" = true ]; then
    log "✅ All systems healthy"
    exit 0
else
    error "❌ Some systems are unhealthy"
    send_alert "UE5 AI Studio health check failed. Check logs at $LOG_FILE"
    exit 1
fi
