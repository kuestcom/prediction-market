# Infra

This folder provides a portable deployment foundation outside Vercel.

## Layout

- `docker/`: Docker image plus local/production Compose runbook
- `kubernetes/`: baseline manifests for app deployment and ingress
- `terraform/`: reusable deployment target modules and production stacks
- `cloud-run/`: Google Cloud Run deployment runbook
- `fly/`: Fly.io deployment runbook
- `digital-ocean/`: DigitalOcean deployment runbook (Droplet or App Platform)
- `vps/`: generic VPS (DigitalOcean Droplets, Vultr, Hetzner, EC2, etc.) deployment runbook
- `scheduler-contract.md`: single scheduler contract for `/api/sync/*`

## Deployment decision tree

1. Deploying on Vercel with one-click Supabase.
   - Keep existing Vercel flow from [README Quick Start](../README.md#quick-start-15-minutes).
2. Deploying outside Vercel with Supabase.
   - Configure a Supabase project and follow [Supabase mode](#option-a-supabase-mode).
3. Deploying outside Vercel without Supabase.
   - Use Postgres+S3 mode.
   - You must schedule `/api/sync/*` via platform/external scheduler.

## Storage options

### Option A: Supabase mode

Required secrets:

- `POSTGRES_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Storage:

- Supabase Storage bucket `kuest-assets`

### Option B: Postgres + S3 mode

Required secrets:

- `POSTGRES_URL`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Optional S3 settings:

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_PUBLIC_URL`
- `S3_FORCE_PATH_STYLE`

Storage:

- S3-compatible object storage

Scheduler:

- External/platform scheduler implementing `infra/scheduler-contract.md`

## Scheduler contract

All non-Supabase targets should implement the same [HTTP scheduler contract](./scheduler-contract.md).

## Quick start

Always start from base variables in [Configure environment variables](../README.md#2-configure-environment-variables-before-deploy).

Use immutable image references in production (`@sha256:digest` preferred, `:latest` forbidden).

### Docker

[Docker runbook](./docker/README.md)

### Cloud Run

[Cloud Run runbook](./cloud-run/README.md)

### Fly.io

[Fly.io runbook](./fly/README.md)

### DigitalOcean App Platform

[DigitalOcean runbook](./digital-ocean/README.md)

### VPS (DigitalOcean Droplets, Vultr, Hetzner, EC2, etc.)

[VPS runbook](./vps/README.md)

### Kubernetes

[Kubernetes runbook](./kubernetes/README.md)

### Terraform

[Terraform runbook](./terraform/README.md)
