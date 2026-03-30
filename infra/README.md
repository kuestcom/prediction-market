# Infra

This folder provides deployment runbooks for both the default Vercel setup
and portable self-hosted targets.

## Layout

- [vercel/](./vercel/README.md): Vercel + Supabase deployment runbook
- [docker/](./docker/README.md): Docker image plus local/production Compose runbook
- [cloud-run/](./cloud-run/README.md): Google Cloud Run deployment runbook
- [fly/](./fly/README.md): Fly.io deployment runbook
- [digital-ocean/](./digital-ocean/README.md): DigitalOcean deployment runbook (Droplet or App Platform)
- [vps/](./vps/README.md): generic VPS (DigitalOcean Droplets, Vultr, Hetzner, EC2, etc.) deployment runbook
- [kubernetes/](./kubernetes/README.md): baseline manifests for app deployment and ingress
- [terraform/](./terraform/README.md): reusable deployment target modules and production stacks
- [scheduler-contract.md](./scheduler-contract.md): single scheduler contract for `/api/sync/*`

## Deployment decision tree

1. Deploying on Vercel with one-click Supabase.
   - Follow the [Vercel runbook](./vercel/README.md).
2. Deploying outside Vercel with Supabase.
   - Configure a Supabase project and follow [Supabase mode](#option-a-supabase-mode).
3. Deploying outside Vercel without Supabase.
   - Use Postgres+S3 mode.
   - You must schedule `/api/sync/*` via platform/external scheduler.

## Required environment variables

Start from [`.env.example`](../.env.example) and fill in these base variables
for every deployment target:

| Variable | Description |
| --- | --- |
| `KUEST_ADDRESS` / `KUEST_API_KEY` / `KUEST_API_SECRET` / `KUEST_PASSPHRASE` | CLOB auth credentials generated at [auth.kuest.com](https://auth.kuest.com) using your Polygon EVM wallet |
| `ADMIN_WALLETS` | Comma-separated 0x addresses that should have admin access |
| `REOWN_APPKIT_PROJECT_ID` | Reown AppKit project ID from [dashboard.reown.com](https://dashboard.reown.com) |
| `BETTER_AUTH_SECRET` | 32-character Better Auth secret from the [Better Auth setup docs](https://www.better-auth.com/docs/installation#set-environment-variables) |
| `CRON_SECRET` | Random secret used to protect `/api/sync/*` endpoints |

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
