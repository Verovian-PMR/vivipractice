# VivIPractice

VivIPractice is a multi-tenant pharmacy platform built as a monorepo. It includes:

- Public tenant websites (marketing + booking)
- Tenant dashboard for pharmacy operations and content management
- Control Hub for super admins to provision and manage tenants
- NestJS API with tenant-aware routing and control-plane support
- Shared packages for database, types, UI, lint, and TS config

## Monorepo Structure

```text
apps/
  api/           NestJS API
  control-hub/   Super-admin app (Next.js)
  dashboard/     Tenant admin app (Next.js)
  public-site/   Tenant public website (Next.js)
packages/
  database/      Prisma schemas + DB scripts
  types/         Shared types
  ui/            Shared React UI primitives
docker/
  Dockerfiles + nginx config
docker-compose.prod.yml
```

## Core Architecture

- **Tenant resolution**: API resolves tenant using incoming `Host` header (e.g. `tarpharm.vivipractice.com`).
- **Control plane**: Stores tenant metadata (slug, status, db name, plan, admin details).
- **Tenant data plane**: Each tenant has isolated DB schema/database access through tenant-aware Prisma service.
- **Reverse proxy**: Nginx routes:
  - `app.vivipractice.com` -> Control Hub + `/api`
  - `*.vivipractice.com/dashboard` -> Dashboard
  - `*.vivipractice.com` -> Public Site
  - `*.vivipractice.com/api/*` -> API

See [nginx.conf](file:///d:/work/Tar/PROJECTS/VIVI/vivipractice/docker/nginx/nginx.conf) and [docker-compose.prod.yml](file:///d:/work/Tar/PROJECTS/VIVI/vivipractice/docker-compose.prod.yml).

## Tech Stack

- **Backend**: NestJS, Prisma, PostgreSQL, JWT auth
- **Frontend**: Next.js (React 19), TailwindCSS
- **Monorepo tooling**: npm workspaces + Turbo
- **Infra**: Docker Compose + Nginx (TLS termination)

## Prerequisites

- Node.js 20+
- npm 11+
- Docker + Docker Compose
- PostgreSQL (for non-container local dev flows)

## Environment Configuration

Copy `.env.example` to `.env` and set secure values:

```bash
cp .env.example .env
```

Important variables:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `CONTROL_POSTGRES_DB`
- `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION`
- App URL values (`API_URL`, `DASHBOARD_URL`, `PUBLIC_SITE_URL`, `CONTROL_HUB_URL`)

For production, `docker-compose.prod.yml` reads env from shell/.env.

## Install Dependencies

```bash
npm install
```

## Local Development (Workspace Mode)

Run all apps with Turbo:

```bash
npm run dev
```

Or run individual workspaces:

```bash
npm run dev --workspace=@vivipractice/api
npm run dev --workspace=@vivipractice/control-hub
npm run dev --workspace=@vivipractice/dashboard
npm run dev --workspace=@vivipractice/public-site
```

Default local ports:

- API: `3001`
- Dashboard: `3002`
- Public Site: `3003`
- Control Hub: `3004`

## Database Commands

```bash
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
```

Control-plane schema commands:

```bash
npm run push:control --workspace=@vivipractice/database
npm run generate:control --workspace=@vivipractice/database
```

## Production Deployment (Docker Compose)

Main compose file: [docker-compose.prod.yml](file:///d:/work/Tar/PROJECTS/VIVI/vivipractice/docker-compose.prod.yml)

### Bring up stack

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

### Build images (low-memory safe, sequential)

```bash
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml build --no-cache dashboard
docker compose -f docker-compose.prod.yml build --no-cache public-site
docker compose -f docker-compose.prod.yml build --no-cache control-hub
```

### Initialize databases

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $CONTROL_POSTGRES_DB;" || true

docker compose -f docker-compose.prod.yml exec -T api sh -lc \
  'export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"; npx prisma db push --schema=packages/database/prisma/schema.prisma'

docker compose -f docker-compose.prod.yml exec -T api sh -lc \
  'export CONTROL_PLANE_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${CONTROL_POSTGRES_DB}?schema=public"; npx prisma db push --schema=packages/database/prisma/control-schema.prisma'
```

### Automated Lightsail deployment script

Use [scripts/lightsail-deploy.sh](file:///d:/work/Tar/PROJECTS/VIVI/vivipractice/scripts/lightsail-deploy.sh):

```bash
chmod +x scripts/lightsail-deploy.sh
export POSTGRES_PASSWORD='YOUR_STRONG_DB_PASSWORD'
export JWT_SECRET='YOUR_LONG_RANDOM_SECRET'
./scripts/lightsail-deploy.sh
```

## AWS Lightsail Notes (2 GB / 2 vCPU)

- Prefer sequential image builds to avoid memory pressure.
- Keep `docker compose` logs monitored during first cold start.
- Ensure wildcard DNS (`*.vivipractice.com`) and `app.vivipractice.com` resolve to instance IP.
- Open ports `80` and `443`.
- Mount valid cert files to `docker/nginx/certs/fullchain.pem` and `docker/nginx/certs/privkey.pem`.

## Local Domain Testing

For local wildcard-like testing, map hosts in:

`C:\Windows\System32\drivers\etc\hosts`

Example:

```text
127.0.0.1 app.vivipractice.com
127.0.0.1 tarpharm.vivipractice.com
```

Flush DNS:

```powershell
ipconfig /flushdns
```

## Super Admin (Local Dry Run)

Seed/login behavior:

- `/api/v1/super/seed` works in non-production runtime.
- In production mode, seed endpoint is blocked by design.
- For local production-style validation, seed record can be inserted directly in control-plane DB.

Common test credentials used during dry runs:

- Email: `admin@vivipractice.com`
- Password: `Admin1234!`

Change these immediately in real environments.

## Health and Smoke Checks

### Health

```bash
curl -k -i https://localhost/api/v1/health
```

### Tenant routing smoke

1. Login as super admin.
2. Create tenant with slug.
3. Verify:
   - `https://<slug>.vivipractice.com` returns `200`
   - Suspend -> returns `403`
   - Reactivate -> returns `200`
   - Delete -> returns `404`

## Quality Checks

```bash
npm run typecheck
npm run lint
```

## Troubleshooting

### 504 Gateway Timeout on tenant public site

- Check public-site and nginx logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 public-site
docker compose -f docker-compose.prod.yml logs --tail=200 nginx
```

- Ensure public-site can reach API internally (`API_URL=http://api:3001/api/v1` in compose).
- Rebuild and recreate `public-site` service after config/code changes.

### Server not found for tenant domain

- Add tenant domain to local hosts file for local testing, or configure real DNS in production.

### Super seed endpoint returns "Not available in production"

- Expected in production mode. Use non-production seed flow or manual DB insert for bootstrap.

## Git Workflow for Lightsail

### Lightsail first-time server setup (before `git pull`)

Run these once on a fresh Ubuntu Lightsail instance:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
git --version
```

Open Lightsail networking/firewall ports:

- `80` (HTTP)
- `443` (HTTPS)
- `22` (SSH)

Prepare DNS before app deploy:

- `A` record for `app.vivipractice.com` -> Lightsail public IP
- `A` record wildcard `*.vivipractice.com` -> Lightsail public IP

Prepare TLS cert files expected by nginx:

```bash
mkdir -p docker/nginx/certs
# Place your certs as:
# docker/nginx/certs/fullchain.pem
# docker/nginx/certs/privkey.pem
```

Then proceed with repo clone/pull and deployment script below.

On local:

```bash
git add .
git commit -m "your message"
git push origin main
```

On Lightsail:

```bash
git pull origin main
./scripts/lightsail-deploy.sh
```

## Security Checklist

- Use strong, unique `POSTGRES_PASSWORD` and `JWT_SECRET`.
- Do not commit `.env` files.
- Replace default/test credentials before go-live.
- Use valid TLS certificates in production.
- Restrict SSH and database access by IP/security group.

---

If you are onboarding a new environment, start with:

1. `.env` setup
2. `docker-compose.prod.yml` validation
3. sequential build
4. `lightsail-deploy.sh`
5. health + tenant lifecycle smoke
