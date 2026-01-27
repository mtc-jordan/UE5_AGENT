# UE5 AI Studio - Deployment Guide

This guide provides step-by-step instructions for deploying the UE5 AI Studio platform in production.

---

## Prerequisites

### Required Software
- Docker (v20.10+)
- Docker Compose (v2.0+)
- Git
- Domain name (for production)
- SSL certificate (recommended)

### Recommended Server Specifications

#### Minimum (Development/Testing)
- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB
- OS: Ubuntu 22.04 LTS or similar

#### Recommended (Production)
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 50+ GB SSD
- OS: Ubuntu 22.04 LTS or similar

---

## Quick Start (Development)

### 1. Clone the Repository

```bash
git clone https://github.com/mtc-jordan/UE5_AGENT.git
cd UE5_AGENT
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### 3. Start Services

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

## Production Deployment

### Step 1: Server Preparation

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### Configure Firewall
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if not already)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Step 2: Clone and Configure

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/mtc-jordan/UE5_AGENT.git
cd UE5_AGENT

# Set permissions
sudo chown -R $USER:$USER /opt/UE5_AGENT

# Configure environment
cp .env.example .env
nano .env
```

### Step 3: SSL Certificate (Recommended)

#### Option A: Let's Encrypt (Free)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

#### Option B: Custom Certificate

Place your certificate files in `/opt/UE5_AGENT/ssl/`:
- `fullchain.pem` - Full certificate chain
- `privkey.pem` - Private key

### Step 4: Update Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Nginx Reverse Proxy with SSL
  nginx:
    image: nginx:alpine
    container_name: ue5-ai-studio-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl.conf:/etc/nginx/conf.d/ssl.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks:
      - ue5-network

  backend:
    environment:
      ENVIRONMENT: production
      LOG_LEVEL: warning
      DEBUG: false
    # ... rest of backend config from docker-compose.yml

  # ... other services
```

### Step 5: Deploy

```bash
# Build images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Verify health
docker-compose ps
```

### Step 6: Database Migration

```bash
# Run database migrations
docker-compose exec backend python -m alembic upgrade head

# Create admin user (optional)
docker-compose exec backend python scripts/create_admin.py
```

### Step 7: Verify Deployment

```bash
# Check backend health
curl http://localhost:8000/api/health

# Check frontend
curl http://localhost/

# Check SSL (if configured)
curl https://yourdomain.com/
```

---

## Environment Variables

### Critical Variables (Must Change)

```env
# Security
JWT_SECRET_KEY=<generate-with-openssl-rand-hex-32>
DATABASE_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>

# Domain
CORS_ORIGINS=https://yourdomain.com

# AI Keys (or configure via UI)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...
```

### Optional Variables

```env
# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=ue5-ai-studio
```

---

## Maintenance

### Backup Database

```bash
# Backup
docker-compose exec database pg_dump -U ue5admin ue5_ai_studio > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T database psql -U ue5admin ue5_ai_studio < backup_20260127.sql
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Run migrations
docker-compose exec backend python -m alembic upgrade head
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

### Stop Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

---

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:8000/api/health

# Database
docker-compose exec database pg_isready -U ue5admin

# Redis
docker-compose exec redis redis-cli ping
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker-compose logs backend

# Check database connection
docker-compose exec backend python -c "from sqlalchemy import create_engine; engine = create_engine('postgresql://ue5admin:password@database:5432/ue5_ai_studio'); engine.connect()"

# Restart
docker-compose restart backend
```

### Frontend 502 Bad Gateway

```bash
# Check backend is running
docker-compose ps backend

# Check nginx logs
docker-compose logs nginx

# Verify backend health
curl http://localhost:8000/api/health
```

### Database Connection Issues

```bash
# Check database is running
docker-compose ps database

# Check logs
docker-compose logs database

# Test connection
docker-compose exec database psql -U ue5admin -d ue5_ai_studio -c "SELECT 1;"
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -a --volumes

# Clean logs
docker-compose exec backend find /app/logs -type f -mtime +7 -delete
```

---

## Security Best Practices

### 1. Change Default Passwords
- Database password
- Redis password
- JWT secret key

### 2. Use SSL/TLS
- Obtain certificate from Let's Encrypt
- Force HTTPS redirects
- Use HSTS headers

### 3. Firewall Configuration
- Only allow necessary ports (80, 443, 22)
- Block direct database access from internet
- Use fail2ban for SSH protection

### 4. Regular Updates
- Keep Docker images updated
- Apply security patches
- Update dependencies

### 5. Backup Strategy
- Daily database backups
- Store backups off-site
- Test restore procedures

### 6. Monitoring
- Set up error tracking (Sentry)
- Monitor resource usage
- Set up alerts for downtime

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  backend:
    deploy:
      replicas: 3
    
  # Add load balancer
  load_balancer:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/load_balancer.conf:/etc/nginx/nginx.conf
```

### Vertical Scaling

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/mtc-jordan/UE5_AGENT/issues
- Documentation: https://github.com/mtc-jordan/UE5_AGENT/wiki

---

**Last Updated**: January 27, 2026  
**Version**: 2.1.0
