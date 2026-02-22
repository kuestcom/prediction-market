# Docker

Deploy target for Docker Compose (local and production).

## Prerequisites

1. Docker Engine + Docker Compose plugin installed.
2. Access to this repository.
3. [Configure Environment Variables](../../README.md#quick-start-15-minutes).
4. Choose between Supabase vs Postgres+S3 and [set the required env variables](../README.md#storage-options)

## Local compose

Use `infra/docker/docker-compose.yml` for local/self-hosted runtime:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

With local Postgres container (only if not using Supabase):

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml --profile local-postgres up --build
```

If using the `local-postgres` profile, set:

```env
POSTGRES_DB=kuest
POSTGRES_USER=kuest
POSTGRES_PASSWORD=replace-with-strong-password
POSTGRES_URL=postgresql://kuest:replace-with-strong-password@postgres:5432/kuest?sslmode=disable
```

## Production compose

Use `infra/docker/docker-compose.production.yml` (web + Caddy, optional local Postgres):

Supabase mode:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.production.yml up -d --build
```

Postgres+S3 mode with local Postgres profile:

```bash
docker compose --env-file .env -f infra/docker/docker-compose.production.yml --profile local-postgres up -d --build
```

Required for production compose:

- `NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID` (build arg)
- `SITE_URL` (runtime)
- `CADDY_DOMAIN` (recommended for automatic TLS)

If using production `local-postgres` profile:

- `POSTGRES_PASSWORD` must be non-empty (container exits otherwise)

## Operations

```bash
# status
docker compose -f infra/docker/docker-compose.production.yml ps

# logs
docker compose -f infra/docker/docker-compose.production.yml logs -f web
docker compose -f infra/docker/docker-compose.production.yml logs -f caddy

# update
git pull
docker compose --env-file .env -f infra/docker/docker-compose.production.yml up -d --build
```
