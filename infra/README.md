# Infra

This folder provides a portable deployment foundation outside Vercel.

## Layout

- `docker/`: production image and local compose profile
- `kubernetes/`: baseline manifests for app deployment and ingress
- `terraform/`: reusable deployment target modules and production stacks
- `cloud-run/`: Google Cloud Run deployment runbook
- `fly/`: Fly.io deployment runbook
- `digital-ocean/`: DigitalOcean App Platform runbook
- `scheduler-contract.md`: single scheduler contract for `/api/sync/*`
- `scripts/`: shared env and image validation helpers

## Deployment decision tree

1. Deploying on Vercel with one-click Supabase.
   - Keep existing Vercel flow from [README Quick Start](../README.md#quick-start-15-minutes).
2. Deploying outside Vercel with Supabase.
   - Configure a Supabase project and follow [Supabase mode](#option-a-supabase-mode-recommended).
3. Deploying outside Vercel without Supabase.
   - Use Postgres+S3 mode.
   - You must schedule `/api/sync/*` via platform/external scheduler.

## Storage options

### Option A: Supabase mode (recommended)

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

All non-Vercel targets should implement the same HTTP scheduler contract:

- Contract and canonical schedules: `infra/scheduler-contract.md`
- Security: always send `Authorization: Bearer $CRON_SECRET`
- Do not run multiple scheduler backends for the same endpoints unless intentional

## Current infra template status

Some helper scripts/templates are still Supabase-first.

- `infra/scripts/validate-runtime-env.sh` currently validates the Supabase option from `infra/scripts/required-runtime-env.txt`.
- Some target helpers (`sync-secrets.sh`, Terraform `secret_env` validations) still require `SUPABASE_*`.

For Postgres+S3 mode today:

- Treat current target templates as a starting point.
- Add `S3_*` envs manually in your platform secrets manager.
- Skip `SUPABASE_*` only when the chosen target tooling no longer enforces those variables.

## Quick start

Always start from base variables in [Configure environment variables](../README.md#2-configure-environment-variables-before-deploy).

Use immutable image references in production (`@sha256:digest` preferred, `:latest` forbidden).

### Docker

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

`NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID` is required at build time and is passed as a Docker build argument.

### Kubernetes (manifests)

```bash
cp infra/kubernetes/secret.example.yaml infra/kubernetes/secret.yaml
kubectl apply -k infra/kubernetes
```

Scheduler implementation details: `infra/kubernetes/README.md`

### Cloud Run

```bash
PROJECT_ID=<gcp-project> ENV_FILE=.env ./infra/cloud-run/sync-secrets.sh
PROJECT_ID=<gcp-project> REGION=us-central1 IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> ENV_FILE=.env ./infra/cloud-run/deploy.sh
```

### Fly.io

```bash
FLY_APP=<fly-app-name> ENV_FILE=.env ./infra/fly/sync-secrets.sh
FLY_APP=<fly-app-name> IMAGE_REF=ghcr.io/kuestcom/prediction-market@sha256:<digest> ENV_FILE=.env ./infra/fly/deploy.sh
```

### DigitalOcean (manual)

```bash
cat infra/digital-ocean/README.md
```

### Terraform

```bash
cd infra/terraform/environments/production/kubernetes
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Additional Terraform targets:

- `infra/terraform/environments/production/gke`
- `infra/terraform/environments/production/cloud-run`
- `infra/terraform/environments/production/fly`
- `infra/terraform/environments/production/digital-ocean`

See `infra/terraform/README.md` for target-specific details.
