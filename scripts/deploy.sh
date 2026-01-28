#!/bin/bash
#
# UE5 AI Studio - Deployment Script
# Automates deployment to production server
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/UE5_AGENT"
BACKUP_DIR="/opt/backups/ue5-ai-studio"
LOG_FILE="/var/log/ue5-ai-studio-deploy.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    error "Please run as root or with sudo"
fi

log "Starting deployment..."

# Step 1: Backup database
log "Step 1/7: Backing up database..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

if docker-compose -f "$PROJECT_DIR/docker-compose.yml" exec -T database pg_dump -U ue5admin ue5_ai_studio > "$BACKUP_FILE" 2>/dev/null; then
    log "Database backup created: $BACKUP_FILE"
else
    warn "Database backup failed (database may not be running)"
fi

# Step 2: Pull latest code
log "Step 2/7: Pulling latest code from GitHub..."
cd "$PROJECT_DIR"
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git rev-parse origin/main)

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ]; then
    log "Already up to date (commit: ${CURRENT_COMMIT:0:7})"
else
    log "Updating from ${CURRENT_COMMIT:0:7} to ${LATEST_COMMIT:0:7}"
    git pull origin main || error "Failed to pull latest code"
fi

# Step 3: Pull Docker images
log "Step 3/7: Pulling Docker images..."
docker-compose pull || error "Failed to pull Docker images"

# Step 4: Stop services
log "Step 4/7: Stopping services..."
docker-compose down || warn "Failed to stop services gracefully"

# Step 5: Start services
log "Step 5/7: Starting services..."
docker-compose up -d || error "Failed to start services"

# Step 6: Run database migrations
log "Step 6/7: Running database migrations..."
sleep 10  # Wait for database to be ready
docker-compose exec -T backend python -m alembic upgrade head || warn "Database migrations failed"

# Step 7: Verify deployment
log "Step 7/7: Verifying deployment..."
sleep 5

# Check backend health
if curl -f http://localhost:8000/api/monitoring/health > /dev/null 2>&1; then
    log "✅ Backend is healthy"
else
    error "❌ Backend health check failed"
fi

# Check frontend
if curl -f http://localhost/ > /dev/null 2>&1; then
    log "✅ Frontend is accessible"
else
    warn "❌ Frontend check failed"
fi

# Clean up old Docker resources
log "Cleaning up old Docker resources..."
docker system prune -f > /dev/null 2>&1

# Clean up old backups (keep last 7 days)
log "Cleaning up old backups..."
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete

log "✅ Deployment completed successfully!"
log "Current commit: ${LATEST_COMMIT:0:7}"
log "Services:"
docker-compose ps

exit 0
