---
title: Production Deployment
description: Deploy VivIPractice to AWS Lightsail with Docker Compose
---

# Production Deployment

## Target Infrastructure
- **Provider:** AWS Lightsail
- **Instance:** 2 GB RAM, 2 vCPUs, 60 GB SSD
- **Domain:** services.vivipractice.com
- **Stack:** Docker Compose (PostgreSQL + API + Dashboard + Public Site + Nginx)

## Prerequisites
- AWS Lightsail instance with Docker & Docker Compose installed
- Domain DNS pointed to the instance IP
- SSL certificates (Let's Encrypt recommended)

## Step-by-Step

### 1. Clone & Configure
```bash
git clone https://github.com/Verovian-PMR/pmr2.git vivipractice
cd vivipractice
cp .env.example .env
```

Edit `.env` and set:
- `POSTGRES_PASSWORD` — Strong database password
- `JWT_SECRET` — Random 256-bit secret for JWT signing

### 2. SSL Certificates
Place your SSL certificate files in `docker/nginx/certs/`:
- `fullchain.pem`
- `privkey.pem`

For Let's Encrypt:
```bash
sudo certbot certonly --standalone -d services.vivipractice.com
cp /etc/letsencrypt/live/services.vivipractice.com/fullchain.pem docker/nginx/certs/
cp /etc/letsencrypt/live/services.vivipractice.com/privkey.pem docker/nginx/certs/
```

### 3. Build & Start
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Run Database Migrations
```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db push --schema=packages/database/prisma/schema.prisma
```

### 5. Create Admin User
```bash
chmod +x scripts/create-admin.sh
./scripts/create-admin.sh
```

Or with environment variables:
```bash
ADMIN_EMAIL=admin@pharmacy.com ADMIN_PASSWORD=SecureP@ss123 ./scripts/create-admin.sh
```

## Service Architecture

| Service | Internal Port | Memory Limit |
|---------|--------------|--------------|
| PostgreSQL | 5432 | 384 MB |
| API (NestJS) | 3001 | 384 MB |
| Dashboard (Next.js) | 3002 | 384 MB |
| Public Site (Next.js) | 3003 | 384 MB |
| Nginx | 80/443 | 64 MB |

Total: ~1.6 GB, well within the 2 GB instance limit.

## Nginx Routing
- `/api/*` → API service
- `/dashboard*` → Dashboard app
- Everything else → Public Site

## Monitoring & Maintenance
```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart a service
docker compose -f docker-compose.prod.yml restart api

# Update deployment
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
