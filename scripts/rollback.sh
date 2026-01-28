#!/bin/bash
#
# UE5 AI Studio - Rollback Script
# Rolls back to a previous version
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/UE5_AGENT"
BACKUP_DIR="/opt/backups/ue5-ai-studio"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "Please run as root or with sudo"
fi

log "UE5 AI Studio - Rollback Tool"
echo ""

# Show current commit
cd "$PROJECT_DIR"
CURRENT_COMMIT=$(git rev-parse HEAD)
log "Current commit: ${CURRENT_COMMIT:0:7}"
echo ""

# Show recent commits
log "Recent commits:"
git log --oneline -10
echo ""

# Ask for commit to rollback to
read -p "Enter commit hash to rollback to: " TARGET_COMMIT

if [ -z "$TARGET_COMMIT" ]; then
    error "No commit hash provided"
fi

# Verify commit exists
if ! git cat-file -e "$TARGET_COMMIT" 2>/dev/null; then
    error "Invalid commit hash: $TARGET_COMMIT"
fi

# Confirm rollback
echo ""
warn "This will rollback to commit: $TARGET_COMMIT"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "Rollback cancelled"
    exit 0
fi

# Perform rollback
log "Starting rollback..."

# Step 1: Stop services
log "Step 1/5: Stopping services..."
docker-compose down

# Step 2: Checkout target commit
log "Step 2/5: Checking out commit $TARGET_COMMIT..."
git checkout "$TARGET_COMMIT" || error "Failed to checkout commit"

# Step 3: Rebuild images
log "Step 3/5: Rebuilding Docker images..."
docker-compose build || error "Failed to build images"

# Step 4: Start services
log "Step 4/5: Starting services..."
docker-compose up -d || error "Failed to start services"

# Step 5: Verify
log "Step 5/5: Verifying services..."
sleep 10

if curl -f http://localhost:8000/api/monitoring/health > /dev/null 2>&1; then
    log "✅ Backend is healthy"
else
    warn "❌ Backend health check failed"
fi

if curl -f http://localhost/ > /dev/null 2>&1; then
    log "✅ Frontend is accessible"
else
    warn "❌ Frontend check failed"
fi

log "✅ Rollback completed!"
log "Current commit: $(git rev-parse --short HEAD)"
echo ""
log "To restore database from backup:"
echo "  1. List backups: ls -lh $BACKUP_DIR"
echo "  2. Restore: docker-compose exec -T database psql -U ue5admin ue5_ai_studio < $BACKUP_DIR/backup_YYYYMMDD_HHMMSS.sql"

exit 0
