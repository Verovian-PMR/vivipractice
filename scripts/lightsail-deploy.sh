#!/usr/bin/env bash
set -euo pipefail

export POSTGRES_USER="${POSTGRES_USER:-vivi}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
export POSTGRES_DB="${POSTGRES_DB:-vivipractice}"
export CONTROL_POSTGRES_DB="${CONTROL_POSTGRES_DB:-vivipractice_control}"
export JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}"
export JWT_EXPIRATION="${JWT_EXPIRATION:-1h}"
export JWT_REFRESH_EXPIRATION="${JWT_REFRESH_EXPIRATION:-7d}"

docker compose -f docker-compose.prod.yml config >/tmp/vivi-prod.rendered.yml
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml build --no-cache dashboard
docker compose -f docker-compose.prod.yml build --no-cache public-site
docker compose -f docker-compose.prod.yml build --no-cache control-hub
docker compose -f docker-compose.prod.yml up -d --remove-orphans

docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $CONTROL_POSTGRES_DB;" || true

docker compose -f docker-compose.prod.yml exec -T api sh -lc 'export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"; npx prisma db push --schema=packages/database/prisma/schema.prisma'
docker compose -f docker-compose.prod.yml exec -T api sh -lc 'export CONTROL_PLANE_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${CONTROL_POSTGRES_DB}?schema=public"; npx prisma db push --schema=packages/database/prisma/control-schema.prisma'

docker compose -f docker-compose.prod.yml ps
curl -ksS https://localhost/api/v1/health
