.PHONY: help build up down restart logs ps clean backup restore test

# Default target
help:
	@echo "UE5 AI Studio - Available Commands:"
	@echo ""
	@echo "  make build          - Build Docker images"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - View logs (all services)"
	@echo "  make logs-backend   - View backend logs"
	@echo "  make logs-frontend  - View frontend logs"
	@echo "  make ps             - Show service status"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make backup         - Backup database"
	@echo "  make restore        - Restore database from backup"
	@echo "  make test           - Run tests"
	@echo "  make init-db        - Initialize database"
	@echo "  make shell-backend  - Open backend shell"
	@echo "  make shell-db       - Open database shell"
	@echo ""

# Build Docker images
build:
	docker-compose build

# Start services
up:
	docker-compose up -d
	@echo "Services started. Access:"
	@echo "  Frontend: http://localhost"
	@echo "  Backend:  http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/docs"

# Stop services
down:
	docker-compose down

# Restart services
restart:
	docker-compose restart

# View logs
logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

logs-db:
	docker-compose logs -f database

# Show service status
ps:
	docker-compose ps

# Clean up
clean:
	docker-compose down -v
	docker system prune -f

# Backup database
backup:
	@mkdir -p backups
	docker-compose exec -T database pg_dump -U ue5admin ue5_ai_studio > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup created in backups/"

# Restore database
restore:
	@echo "Available backups:"
	@ls -1 backups/
	@read -p "Enter backup filename: " backup; \
	docker-compose exec -T database psql -U ue5admin ue5_ai_studio < backups/$$backup

# Run tests
test:
	docker-compose exec backend pytest tests/ -v

# Initialize database
init-db:
	docker-compose exec backend python scripts/init_db.py

# Backend shell
shell-backend:
	docker-compose exec backend /bin/bash

# Database shell
shell-db:
	docker-compose exec database psql -U ue5admin ue5_ai_studio

# Production deployment
deploy-prod:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Health check
health:
	@echo "Checking service health..."
	@curl -s http://localhost:8000/api/health | python -m json.tool || echo "Backend unhealthy"
	@curl -s http://localhost/ > /dev/null && echo "Frontend: healthy" || echo "Frontend: unhealthy"

# Update application
update:
	git pull origin main
	docker-compose down
	docker-compose build
	docker-compose up -d
	docker-compose exec backend python -m alembic upgrade head
	@echo "Application updated successfully"
